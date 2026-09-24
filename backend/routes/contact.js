const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const config = require('../config');
const { validateBody } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errors');

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let transporter = null;
function getTransporter() {
    if (transporter || !process.env.SMTP_HOST) return transporter;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return transporter;
}

router.post('/', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, message: { error: 'Trop de messages, réessayez plus tard.' } }),
    validateBody({
        name: { required: true, maxLength: 100 },
        email: { required: true, type: 'email' },
        phone: { maxLength: 30 },
        company: { maxLength: 100 },
        message: { required: true, minLength: 5, maxLength: 2000 }
    }),
    asyncHandler(async (req, res) => {
        const { name, email, phone, company, message } = req.body;
        const t = getTransporter();
        if (!t || !config.contactRecipient) {
            // Pas de SMTP configuré (dev/test) : on accepte le message sans l'envoyer
            return res.status(202).json({ success: true, message: 'Message reçu' });
        }
        await t.sendMail({
            from: `"Site MFS" <${process.env.SMTP_USER}>`,
            to: config.contactRecipient,
            replyTo: email,
            subject: `Contact site MFS - ${name.slice(0, 60)}`,
            // Toutes les données utilisateur sont échappées : pas d'injection HTML dans l'email
            html: `<h2>Nouveau message</h2>
                   <p><b>Nom :</b> ${escapeHtml(name)}<br><b>Email :</b> ${escapeHtml(email)}<br>
                   ${phone ? `<b>Téléphone :</b> ${escapeHtml(phone)}<br>` : ''}
                   ${company ? `<b>Entreprise :</b> ${escapeHtml(company)}` : ''}</p>
                   <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`
        });
        res.json({ success: true, message: 'Message envoyé avec succès' });
    }));

module.exports = { router, escapeHtml };
