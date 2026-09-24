const { Sequelize } = require('sequelize');
const config = require('./index');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.dbStorage,
    logging: process.env.DB_LOGGING === 'true' ? console.log : false
});

module.exports = sequelize;
