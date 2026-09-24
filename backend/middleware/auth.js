const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('./errors');

function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Authentification requise'));
    try {
        req.user = jwt.verify(token, config.jwtSecret);
        return next();
    } catch (e) {
        return next(new HttpError(401, 'Session expirée ou jeton invalide'));
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new HttpError(403, 'Action non autorisée pour votre rôle'));
        }
        return next();
    };
}

module.exports = { authenticate, requireRole };
