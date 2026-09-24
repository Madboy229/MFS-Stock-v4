const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errors');
const svc = require('../services/stockService');

router.use(authenticate);

// GET /api/analytics/insights?days=30&targetDays=30&storeId=...
router.get('/insights', asyncHandler(async (req, res) => {
    const storeId = await svc.resolveStore(req.user, req.query.storeId);
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const targetDays = Math.min(Math.max(parseInt(req.query.targetDays, 10) || 30, 1), 180);
    res.json(await svc.computeInsights(storeId, { days, targetDays }));
}));

module.exports = router;
