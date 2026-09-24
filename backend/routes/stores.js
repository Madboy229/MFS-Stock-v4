const router = require('express').Router();
const { Store } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errors');

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
    const where = req.user.role === 'manager' ? { id: req.user.storeId } : {};
    res.json(await Store.findAll({ where, order: [['name', 'ASC']] }));
}));

router.post('/', requireRole('admin'),
    validateBody({ name: { required: true, maxLength: 100 }, city: { required: true, maxLength: 100 } }),
    asyncHandler(async (req, res) => res.status(201).json(await Store.create(req.body))));

module.exports = router;
