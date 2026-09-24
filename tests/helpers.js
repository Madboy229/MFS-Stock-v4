process.env.NODE_ENV = 'test';
const request = require('supertest');
const app = require('../backend/app');
const { sequelize } = require('../backend/models');
const seed = require('../backend/database/seed');

async function resetDb() {
    return seed({ silent: true });
}

async function login(email, password) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.token;
}

const ADMIN = ['admin@mfs-sarl.com', 'Admin-Demo-2026'];
const CHEF1 = ['chef1@mfs-sarl.com', 'Chef-Demo-2026'];
const CHEF2 = ['chef2@mfs-sarl.com', 'Chef-Demo-2026'];

module.exports = { request, app, sequelize, resetDb, login, ADMIN, CHEF1, CHEF2 };
