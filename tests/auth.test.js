const { request, app, sequelize, resetDb, login, ADMIN, CHEF1 } = require('./helpers');

beforeAll(resetDb);
afterAll(() => sequelize.close());

describe('Authentification', () => {
    test('connexion valide → 200 + JWT, sans mot de passe dans la réponse', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: ADMIN[0], password: ADMIN[1] });
        expect(res.status).toBe(200);
        expect(res.body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
        expect(res.body.user.role).toBe('admin');
        expect(res.body.user.password).toBeUndefined();
    });

    test('mauvais mot de passe → 401 message générique', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: ADMIN[0], password: 'faux' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Identifiants invalides');
    });

    test('email inexistant → même 401 (pas d\'énumération de comptes)', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'inconnu@x.com', password: 'x' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Identifiants invalides');
    });

    test('email mal formé → 400', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'pas-un-email', password: 'x' });
        expect(res.status).toBe(400);
    });

    test('route protégée sans jeton → 401', async () => {
        expect((await request(app).get('/api/stock/current')).status).toBe(401);
    });

    test('route protégée avec jeton falsifié → 401', async () => {
        const res = await request(app).get('/api/stock/current').set('Authorization', 'Bearer abc.def.ghi');
        expect(res.status).toBe(401);
    });

    test('/me ne renvoie jamais le hash du mot de passe', async () => {
        const token = await login(...CHEF1);
        const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.password).toBeUndefined();
        expect(res.body.store.name).toBe('Magasin Central');
    });

    test('changement de mot de passe : 10 caractères minimum', async () => {
        const token = await login(...CHEF1);
        const res = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
            .send({ currentPassword: CHEF1[1], newPassword: 'court' });
        expect(res.status).toBe(400);
    });

    test('en-têtes de sécurité Helmet présents', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
});
