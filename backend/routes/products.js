const router = require('express').Router();
const { Product, User, CurrentStock, StockMovement } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { HttpError, asyncHandler } = require('../middleware/errors');
const { resolveStore } = require('../services/stockService');

const productSchema = {
    name: { required: true, maxLength: 120 },
    category: { required: true, maxLength: 60 },
    unit: { required: true, maxLength: 40 },
    minimumStock: { type: 'int', min: 0, max: 1000000 }
};

router.use(authenticate);

// Lecture : tout utilisateur connecté (quantité = celle de son magasin, ou total pour l'admin)
router.get('/', asyncHandler(async (req, res) => {
    const storeId = await resolveStore(req.user, req.query.storeId);
    const products = await Product.findAll({
        include: [
            { model: User, as: 'creator', attributes: ['name'] },
            { model: CurrentStock, as: 'stocks', attributes: ['quantity', 'storeId'], required: false,
              where: storeId ? { storeId } : undefined }
        ],
        order: [['name', 'ASC']]
    });
    res.json(products.map(p => {
        const quantity = (p.stocks || []).reduce((s, x) => s + x.quantity, 0);
        const { stocks, ...rest } = p.toJSON();
        return { ...rest, currentStock: { quantity } };
    }));
}));

// Écriture du catalogue : réservée au propriétaire (admin)
router.post('/', requireRole('admin'), validateBody(productSchema), asyncHandler(async (req, res) => {
    const product = await Product.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(product);
}));

router.put('/:id', requireRole('admin'), validateBody(productSchema, { partial: true }), asyncHandler(async (req, res) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw new HttpError(404, 'Produit introuvable');
    await product.update(req.body); // req.body ne contient que les champs autorisés (validateBody)
    res.json({ message: 'Produit modifié avec succès', product });
}));

// Suppression : interdite si des mouvements existent (on préserve la traçabilité)
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
    const product = await Product.findByPk(req.params.id);
    if (!product) throw new HttpError(404, 'Produit introuvable');
    const movements = await StockMovement.count({ where: { productId: product.id } });
    if (movements > 0) {
        throw new HttpError(409, 'Produit utilisé dans l\'historique : suppression impossible (traçabilité)');
    }
    await CurrentStock.destroy({ where: { productId: product.id } });
    await product.destroy();
    res.json({ message: 'Produit supprimé avec succès' });
}));

module.exports = router;
