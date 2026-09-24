const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const { User, Store } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { HttpError, asyncHandler } = require('../middleware/errors');

// Anti force brute : N tentatives / 15 min / IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.loginRateLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

router.post('/login', loginLimiter,
    validateBody({ email: { required: true, type: 'email' }, password: { required: true, maxLength: 128 } }),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;
        const user = await User.scope('withPassword').findOne({ where: { email } });
        // Même message que l'email existe ou non : pas d'énumération de comptes
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new HttpError(401, 'Identifiants invalides');
        }
        const payload = { id: user.id, email: user.email, role: user.role, name: user.name, storeId: user.storeId };
        const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
        const store = user.storeId ? await Store.findByPk(user.storeId) : null;
        res.json({ token, user: { ...payload, storeName: store ? store.name : 'Tous les magasins' } });
    }));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, { include: [{ model: Store, as: 'store' }] });
    if (!user) throw new HttpError(404, 'Utilisateur introuvable');
    res.json(user);
}));

router.post('/change-password', authenticate,
    validateBody({
        currentPassword: { required: true, maxLength: 128 },
        newPassword: { required: true, minLength: 10, maxLength: 128 }
    }),
    asyncHandler(async (req, res) => {
        const user = await User.scope('withPassword').findByPk(req.user.id);
        if (!user || !(await bcrypt.compare(req.body.currentPassword, user.password))) {
            throw new HttpError(400, 'Mot de passe actuel incorrect');
        }
        await user.update({ password: await bcrypt.hash(req.body.newPassword, 12) });
        res.json({ message: 'Mot de passe modifié avec succès' });
    }));

module.exports = router;
