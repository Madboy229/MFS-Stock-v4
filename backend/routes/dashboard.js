const router = require('express').Router();
const { Op } = require('sequelize');
const { Product, StockMovement } = require('../models');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const svc = require('../services/stockService');

router.use(authenticate);

router.get('/stats', asyncHandler(async (req, res) => {
    const storeId = await svc.resolveStore(req.user, req.query.storeId);
    const scope = storeId ? { storeId } : {};
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [totalProducts, stock, todayMovements, recent] = await Promise.all([
        Product.count(),
        svc.getCurrentStock(storeId),
        StockMovement.count({ where: { ...scope, createdAt: { [Op.gte]: today } } }),
        svc.listMovements({ storeId, limit: 5 })
    ]);

    res.json({
        totalProducts,
        totalUnits: stock.reduce((s, x) => s + x.quantity, 0),
        totalStockValue: stock.reduce((s, x) => s + x.quantity, 0), // conservé pour compatibilité front (= unités)
        lowStockProducts: stock.filter(s => s.isLowStock).length,
        todayMovements,
        recentMovements: recent.map(m => ({
            id: m.id, productName: m.productName, storeName: m.storeName,
            type: m.type, quantity: m.quantity, userName: m.userName, createdAt: m.createdAt
        }))
    });
}));

module.exports = router;
