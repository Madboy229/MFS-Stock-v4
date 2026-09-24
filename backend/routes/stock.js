const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errors');
const svc = require('../services/stockService');
const { toCsv } = require('../services/csv');

router.use(authenticate);

router.get('/current', asyncHandler(async (req, res) => {
    const storeId = await svc.resolveStore(req.user, req.query.storeId);
    res.json(await svc.getCurrentStock(storeId));
}));

router.get('/movements', asyncHandler(async (req, res) => {
    const storeId = await svc.resolveStore(req.user, req.query.storeId);
    const { user, productId, startDate, endDate, limit } = req.query;
    res.json(await svc.listMovements({ storeId, userId: user, productId, startDate, endDate, limit }));
}));

router.post('/movements',
    validateBody({
        productId: { required: true, type: 'uuid' },
        storeId: { type: 'uuid' },
        type: { required: true, type: 'enum', values: ['entry', 'exit'] },
        quantity: { required: true, type: 'int', min: 1, max: 100000 },
        reason: { maxLength: 255 }
    }),
    asyncHandler(async (req, res) => {
        const storeId = await svc.resolveStore(req.user, req.body.storeId, { requireOne: true });
        const { movement, product, newStock } = await svc.applyMovement({ ...req.body, storeId, userId: req.user.id });
        res.status(201).json({
            message: 'Mouvement enregistré avec succès',
            movement: { ...movement.toJSON(), productName: product.name, userName: req.user.name },
            newStock
        });
    }));

// Exports CSV (séparateur « ; » pour Excel FR)
router.get('/export/current.csv', asyncHandler(async (req, res) => {
    const storeId = await svc.resolveStore(req.user, req.query.storeId);
    const rows = await svc.getCurrentStock(storeId);
    res.type('text/csv').attachment('stock_courant.csv').send(toCsv(rows,
        ['productName', 'productCategory', 'unit', 'quantity', 'minimumStock', 'isLowStock', 'updatedAt']));
}));

router.get('/export/movements.csv', asyncHandler(async (req, res) => {
    const storeId = await svc.resolveStore(req.user, req.query.storeId);
    const rows = await svc.listMovements({ storeId, ...req.query, limit: 1000 });
    res.type('text/csv').attachment('mouvements.csv').send(toCsv(rows,
        ['createdAt', 'storeName', 'productName', 'type', 'quantity', 'reason', 'userName']));
}));

module.exports = router;
