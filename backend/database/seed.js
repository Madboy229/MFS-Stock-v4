/**
 * Initialise une base de DÉMONSTRATION (efface les données existantes).
 * Usage : npm run seed
 * Les mots de passe de démo viennent de SEED_ADMIN_PASSWORD / SEED_MANAGER_PASSWORD (sinon valeurs de démo).
 */
const bcrypt = require('bcrypt');
const { sequelize, Store, User, Product } = require('../models');
const { applyMovement } = require('../services/stockService');

async function seed({ silent = false } = {}) {
    const log = silent ? () => {} : console.log;
    await sequelize.sync({ force: true });

    const stores = await Store.bulkCreate([
        { name: 'Magasin Central', city: 'Cotonou' },
        { name: 'Magasin 2', city: 'Cotonou' },
        { name: 'Magasin 3', city: 'Porto-Novo' }
    ]);
    const adminPwd = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin-Demo-2026', 12);
    const chefPwd = await bcrypt.hash(process.env.SEED_MANAGER_PASSWORD || 'Chef-Demo-2026', 12);

    const admin = await User.create({ name: 'Propriétaire MFS', email: 'admin@mfs-sarl.com', password: adminPwd, role: 'admin' });
    const chefs = [];
    for (let i = 0; i < 3; i++) {
        chefs.push(await User.create({
            name: `Chef ${stores[i].name}`, email: `chef${i + 1}@mfs-sarl.com`,
            password: chefPwd, role: 'manager', storeId: stores[i].id
        }));
    }

    const products = await Product.bulkCreate([
        { name: 'Riz blanc', category: 'Riz', unit: 'sac 25 kg', minimumStock: 10, createdBy: admin.id },
        { name: 'Sucre cristallisé', category: 'Sucre', unit: 'sac 50 kg', minimumStock: 8, createdBy: admin.id },
        { name: 'Huile végétale', category: 'Huile', unit: 'bidon 20 L', minimumStock: 5, createdBy: admin.id },
        { name: 'Spaghetti', category: 'Pâtes', unit: 'carton 12 kg', minimumStock: 12, createdBy: admin.id }
    ]);

    // Historique cohérent : les stocks courants sont DÉRIVÉS des mouvements (jamais saisis à la main)
    const initial = [[60, 30, 15, 20], [40, 20, 10, 15], [30, 15, 8, 10]];
    const exits = [[20, 8, 6, 14], [12, 6, 3, 9], [9, 4, 2, 6]];
    for (let s = 0; s < 3; s++) {
        for (let p = 0; p < products.length; p++) {
            await applyMovement({ productId: products[p].id, storeId: stores[s].id, type: 'entry',
                quantity: initial[s][p], reason: 'Livraison fournisseur', userId: admin.id });
            await applyMovement({ productId: products[p].id, storeId: stores[s].id, type: 'exit',
                quantity: exits[s][p], reason: 'Ventes', userId: chefs[s].id });
        }
    }
    log('✅ Base de démonstration prête : 3 magasins, 1 admin, 3 chefs, 4 produits, 24 mouvements');
    log('   admin@mfs-sarl.com / chef1..3@mfs-sarl.com (mots de passe : voir README ou variables SEED_*)');
    return { stores, admin, chefs, products };
}

if (require.main === module) {
    seed().then(() => sequelize.close()).catch(err => { console.error(err); process.exit(1); });
}

module.exports = seed;
