const { HttpError } = require('./errors');

/**
 * Validation déclarative minimale (sans dépendance externe).
 * schema = { champ: { required, type: 'string'|'int'|'email'|'enum'|'uuid', min, max, values, maxLength } }
 * Seuls les champs déclarés sont conservés dans req.body (protection contre l'assignation de masse).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateBody(schema, { partial = false } = {}) {
    return (req, res, next) => {
        const src = req.body || {};
        const out = {};
        const errors = [];
        for (const [field, rule] of Object.entries(schema)) {
            let v = src[field];
            const missing = v === undefined || v === null || v === '';
            if (missing) {
                if (rule.required && !partial) errors.push(`${field} est obligatoire`);
                continue;
            }
            switch (rule.type) {
                case 'int': {
                    const n = Number(v);
                    if (!Number.isInteger(n)) { errors.push(`${field} doit être un entier`); continue; }
                    if (rule.min !== undefined && n < rule.min) { errors.push(`${field} doit être ≥ ${rule.min}`); continue; }
                    if (rule.max !== undefined && n > rule.max) { errors.push(`${field} doit être ≤ ${rule.max}`); continue; }
                    v = n; break;
                }
                case 'enum':
                    if (!rule.values.includes(v)) { errors.push(`${field} doit valoir : ${rule.values.join(', ')}`); continue; }
                    break;
                case 'uuid':
                    if (typeof v !== 'string' || !UUID_RE.test(v)) { errors.push(`${field} doit être un identifiant valide`); continue; }
                    break;
                case 'email':
                    if (typeof v !== 'string' || !EMAIL_RE.test(v)) { errors.push(`${field} doit être un email valide`); continue; }
                    v = v.trim().toLowerCase(); break;
                default: // string
                    if (typeof v !== 'string') { errors.push(`${field} doit être du texte`); continue; }
                    v = v.trim();
                    if (rule.minLength && v.length < rule.minLength) { errors.push(`${field} : ${rule.minLength} caractères minimum`); continue; }
                    if (rule.maxLength && v.length > rule.maxLength) { errors.push(`${field} : ${rule.maxLength} caractères maximum`); continue; }
            }
            out[field] = v;
        }
        if (errors.length) return next(new HttpError(400, 'Données invalides', errors));
        req.body = out;
        return next();
    };
}

module.exports = { validateBody, UUID_RE };
