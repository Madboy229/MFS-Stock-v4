class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

function notFound(req, res, next) {
    next(new HttpError(404, 'Ressource introuvable'));
}

// Gestionnaire centralisé : aucun détail technique n'est renvoyé au client en cas d'erreur 500
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ error: 'Cette ressource existe déjà' });
    }
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: 'Données invalides', details: err.errors.map(e => e.message) });
    }
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'JSON invalide' });
    }
    const status = err.status || 500;
    if (status >= 500) console.error('[ERREUR]', err);
    const body = { error: status >= 500 ? 'Erreur serveur' : err.message };
    if (err.details) body.details = err.details;
    return res.status(status).json(body);
}

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, notFound, errorHandler, asyncHandler };
