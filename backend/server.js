const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');

(async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync(); // crée les tables manquantes sans rien effacer
        app.listen(config.port, () => {
            console.log(`🚀 MFS Stock démarré sur http://localhost:${config.port} (${config.env}, SQLite)`);
        });
    } catch (err) {
        console.error('❌ Démarrage impossible :', err.message);
        process.exit(1);
    }
})();
