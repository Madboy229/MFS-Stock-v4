require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';

if (!process.env.JWT_SECRET && env !== 'test') {
    console.error('❌ JWT_SECRET manquant : copiez .env.example en .env et renseignez-le.');
    process.exit(1);
}

module.exports = {
    env,
    port: parseInt(process.env.PORT, 10) || 3001,
    jwtSecret: process.env.JWT_SECRET || 'test-secret-only',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    dbStorage: env === 'test' ? ':memory:' : (process.env.DB_STORAGE || './backend/database/mfs_stock.sqlite'),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001').split(','),
    contactRecipient: process.env.CONTACT_RECIPIENT || '',
    loginRateLimit: env === 'test' ? 1000 : (parseInt(process.env.LOGIN_RATE_LIMIT, 10) || 10)
};
