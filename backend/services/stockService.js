const { Op } = require('sequelize');
const { sequelize, Store, Product, CurrentStock, StockMovement, User } = require('../models');
const { HttpError } = require('../middleware/errors');

/**
 * Détermine le magasin concerné par une requête.
 *  - un chef de magasin est TOUJOURS limité à son magasin (le paramètre demandé est ignoré s'il diffère → 403)
 *  - l'admin peut cibler un magasin précis, ou tous (null) en lecture
 */
async function resolveStore(user, requestedStoreId, { requireOne = false } = {}) {
    if (user.role === 'manager') {
        if (!user.storeId) throw new HttpError(403, 'Aucun magasin rattaché à ce compte');
        if (requestedStoreId && requestedStoreId !== user.storeId) {
            throw new HttpError(403, 'Accès limité à votre magasin');
        }
        return user.storeId;
    }
    if (requestedStoreId) {
        const store = await Store.findByPk(requestedStoreId);
        if (!store) throw new HttpError(404, 'Magasin introuvable');
        return store.id;
    }
    if (requireOne) {
        // Compatibilité avec l'interface actuelle : l'admin agit sur le magasin principal par défaut
        const main = await Store.findOne({ order: [['createdAt', 'ASC']] });
        if (!main) throw new HttpError(400, 'Aucun magasin configuré');
        return main.id;
    }
    return null;
}

/**
 * Enregistre un mouvement et met à jour le stock courant dans UNE transaction.
 * Règle métier : une sortie ne peut jamais rendre le stock négatif.
 */
async function applyMovement({ productId, storeId, type, quantity, reason, userId }) {
    return sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId, { transaction: t });
        if (!product) throw new HttpError(404, 'Produit introuvable');

        const [stock] = await CurrentStock.findOrCreate({
            where: { productId, storeId },
            defaults: { productId, storeId, quantity: 0 },
            transaction: t
        });

        const newQuantity = type === 'entry' ? stock.quantity + quantity : stock.quantity - quantity;
        if (newQuantity < 0) {
            throw new HttpError(400, `Stock insuffisant. Disponible : ${stock.quantity}, demandé : ${quantity}`);
        }

        const movement = await StockMovement.create(
            { productId, storeId, type, quantity, reason, userId },
            { transaction: t }
        );
        await stock.update({ quantity: newQuantity }, { transaction: t });

        return { movement, product, newStock: newQuantity };
    });
}

/** Stock courant ; si storeId est null (admin), agrégation tous magasins confondus. */
async function getCurrentStock(storeId) {
    const where = storeId ? { storeId } : {};
    const rows = await CurrentStock.findAll({
        where,
        include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'category', 'unit', 'minimumStock'] }]
    });
    const byProduct = new Map();
    for (const r of rows) {
        const key = r.productId;
        const prev = byProduct.get(key);
        if (prev) {
            prev.quantity += r.quantity;
            if (r.updatedAt > prev.updatedAt) prev.updatedAt = r.updatedAt;
        } else {
            byProduct.set(key, {
                productId: r.productId,
                productName: r.product.name,
                productCategory: r.product.category,
                unit: r.product.unit,
                quantity: r.quantity,
                minimumStock: r.product.minimumStock,
                updatedAt: r.updatedAt
            });
        }
    }
    return [...byProduct.values()]
        .map(s => ({ ...s, isLowStock: s.quantity <= s.minimumStock }))
        .sort((a, b) => a.productName.localeCompare(b.productName, 'fr'));
}

async function listMovements({ storeId, userId, productId, startDate, endDate, limit = 50 }) {
    const where = {};
    if (storeId) where.storeId = storeId;
    if (userId) where.userId = userId;
    if (productId) where.productId = productId;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }
    const rows = await StockMovement.findAll({
        where,
        include: [
            { model: Product, as: 'product', attributes: ['name', 'category', 'unit'] },
            { model: User, as: 'user', attributes: ['name', 'email', 'role'] },
            { model: Store, as: 'store', attributes: ['name'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 1000)
    });
    return rows.map(m => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        productCategory: m.product.category,
        storeId: m.storeId,
        storeName: m.store.name,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        userId: m.userId,
        userName: m.user.name,
        userEmail: m.user.email,
        userRole: m.user.role,
        createdAt: m.createdAt
    }));
}

/**
 * Indicateurs d'aide à la décision (angle « data ») sur une fenêtre glissante :
 *  - consommation moyenne journalière (sorties / nb jours)
 *  - couverture en jours = stock / conso journalière
 *  - statut : rupture / critique (≤ seuil ou couverture < 7 j) / surveillance (< 14 j) / ok
 *  - quantité suggérée de réapprovisionnement pour couvrir `targetDays`
 */
async function computeInsights(storeId, { days = 30, targetDays = 30, now = new Date() } = {}) {
    const since = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const stock = await getCurrentStock(storeId);
    const where = { type: 'exit', createdAt: { [Op.gte]: since } };
    if (storeId) where.storeId = storeId;
    const exits = await StockMovement.findAll({
        where,
        attributes: ['productId', [sequelize.fn('SUM', sequelize.col('quantity')), 'total']],
        group: ['productId'],
        raw: true
    });
    const exitByProduct = Object.fromEntries(exits.map(e => [e.productId, Number(e.total)]));

    const items = stock.map(s => {
        const totalExits = exitByProduct[s.productId] || 0;
        const dailyUsage = totalExits / days;
        const coverageDays = dailyUsage > 0 ? Math.round((s.quantity / dailyUsage) * 10) / 10 : null;
        let status = 'ok';
        if (s.quantity === 0) status = 'rupture';
        else if (s.quantity <= s.minimumStock || (coverageDays !== null && coverageDays < 7)) status = 'critique';
        else if (coverageDays !== null && coverageDays < 14) status = 'surveillance';
        const suggestedReorder = Math.max(0, Math.ceil(dailyUsage * targetDays + s.minimumStock - s.quantity));
        return {
            productId: s.productId,
            productName: s.productName,
            unit: s.unit,
            quantity: s.quantity,
            minimumStock: s.minimumStock,
            exitsOverPeriod: totalExits,
            dailyUsage: Math.round(dailyUsage * 100) / 100,
            coverageDays,
            status,
            suggestedReorder
        };
    });
    const order = { rupture: 0, critique: 1, surveillance: 2, ok: 3 };
    items.sort((a, b) => order[a.status] - order[b.status] || a.productName.localeCompare(b.productName, 'fr'));
    return { periodDays: days, targetDays, generatedAt: now.toISOString(), items };
}

module.exports = { resolveStore, applyMovement, getCurrentStock, listMovements, computeInsights };
