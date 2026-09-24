const { request, app, sequelize, resetDb, login, ADMIN, CHEF1, CHEF2 } = require('./helpers');

let admin, chef1, chef2, products, stores;
const auth = t => ({ Authorization: `Bearer ${t}` });

beforeEach(async () => {
    ({ products, stores } = await resetDb());
    [admin, chef1, chef2] = await Promise.all([login(...ADMIN), login(...CHEF1), login(...CHEF2)]);
});
afterAll(() => sequelize.close());

const riz = () => products[0].id;
async function stockOf(token, productId) {
    const res = await request(app).get('/api/stock/current').set(auth(token));
    return res.body.find(s => s.productId === productId).quantity;
}

describe('Jeu d\'essai — mouvements de stock (fonctionnalité la plus représentative)', () => {
    test('JE1 — entrée de 10 : stock +10 et mouvement historisé', async () => {
        const before = await stockOf(chef1, riz());
        const res = await request(app).post('/api/stock/movements').set(auth(chef1))
            .send({ productId: riz(), type: 'entry', quantity: 10, reason: 'Livraison' });
        expect(res.status).toBe(201);
        expect(res.body.newStock).toBe(before + 10);
        const hist = await request(app).get('/api/stock/movements?limit=1').set(auth(chef1));
        expect(hist.body[0]).toMatchObject({ type: 'entry', quantity: 10, reason: 'Livraison', storeName: 'Magasin Central' });
    });

    test('JE2 — sortie de 5 : stock -5', async () => {
        const before = await stockOf(chef1, riz());
        const res = await request(app).post('/api/stock/movements').set(auth(chef1))
            .send({ productId: riz(), type: 'exit', quantity: 5, reason: 'Vente' });
        expect(res.status).toBe(201);
        expect(res.body.newStock).toBe(before - 5);
    });

    test('JE3 — sortie supérieure au stock : 400 et stock inchangé (rollback)', async () => {
        const before = await stockOf(chef1, riz());
        const res = await request(app).post('/api/stock/movements').set(auth(chef1))
            .send({ productId: riz(), type: 'exit', quantity: before + 1 });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Stock insuffisant/);
        expect(await stockOf(chef1, riz())).toBe(before);
    });

    test('JE4 — mouvement sans authentification : 401', async () => {
        const res = await request(app).post('/api/stock/movements').send({ productId: riz(), type: 'entry', quantity: 1 });
        expect(res.status).toBe(401);
    });

    test.each([
        ['quantité négative', { type: 'entry', quantity: -50 }],
        ['quantité nulle', { type: 'exit', quantity: 0 }],
        ['quantité décimale', { type: 'entry', quantity: 2.5 }],
        ['quantité texte', { type: 'entry', quantity: 'dix' }],
        ['type inconnu', { type: 'vol', quantity: 3 }]
    ])('JE5 — %s → 400 (faille v3 corrigée)', async (_, body) => {
        const before = await stockOf(chef1, riz());
        const res = await request(app).post('/api/stock/movements').set(auth(chef1)).send({ productId: riz(), ...body });
        expect(res.status).toBe(400);
        expect(await stockOf(chef1, riz())).toBe(before);
    });

    test('JE6 — produit inexistant → 404', async () => {
        const res = await request(app).post('/api/stock/movements').set(auth(chef1))
            .send({ productId: '11111111-1111-4111-8111-111111111111', type: 'entry', quantity: 1 });
        expect(res.status).toBe(404);
    });
});

describe('Cloisonnement par magasin', () => {
    test('un chef ne voit que les mouvements de son magasin', async () => {
        const res = await request(app).get('/api/stock/movements?limit=100').set(auth(chef1));
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body.every(m => m.storeName === 'Magasin Central')).toBe(true);
    });

    test('un chef ne peut pas écrire dans un autre magasin → 403', async () => {
        const res = await request(app).post('/api/stock/movements').set(auth(chef1))
            .send({ productId: riz(), storeId: stores[1].id, type: 'entry', quantity: 1 });
        expect(res.status).toBe(403);
    });

    test('le mouvement du chef 1 ne modifie pas le stock du chef 2', async () => {
        const before2 = await stockOf(chef2, riz());
        await request(app).post('/api/stock/movements').set(auth(chef1)).send({ productId: riz(), type: 'entry', quantity: 7 });
        expect(await stockOf(chef2, riz())).toBe(before2);
    });

    test('l\'admin voit le total consolidé tous magasins', async () => {
        const [a, c1, c2] = await Promise.all([stockOf(admin, riz()), stockOf(chef1, riz()), stockOf(chef2, riz())]);
        expect(a).toBeGreaterThan(c1 + c2 - 1);
        expect(a).toBe(40 + 28 + 21); // (60-20) + (40-12) + (30-9)
    });
});

describe('Catalogue produits — droits', () => {
    test('un chef ne peut pas créer de produit → 403', async () => {
        const res = await request(app).post('/api/products').set(auth(chef1))
            .send({ name: 'Farine', category: 'Farine', unit: 'sac 50 kg' });
        expect(res.status).toBe(403);
    });

    test('l\'admin crée un produit ; les champs non autorisés sont ignorés', async () => {
        const res = await request(app).post('/api/products').set(auth(admin))
            .send({ name: 'Farine', category: 'Farine', unit: 'sac 50 kg', minimumStock: 4, createdBy: 'pirate', id: 'x' });
        expect(res.status).toBe(201);
        expect(res.body.createdBy).not.toBe('pirate');
    });

    test('doublon de nom → 409', async () => {
        const res = await request(app).post('/api/products').set(auth(admin))
            .send({ name: 'Riz blanc', category: 'Riz', unit: 'sac' });
        expect(res.status).toBe(409);
    });

    test('suppression d\'un produit ayant un historique → 409 (traçabilité)', async () => {
        const res = await request(app).delete(`/api/products/${riz()}`).set(auth(admin));
        expect(res.status).toBe(409);
    });
});

describe('Analytique et exports', () => {
    test('insights : couverture en jours et suggestion de réappro', async () => {
        const res = await request(app).get('/api/analytics/insights?days=30').set(auth(chef1));
        expect(res.status).toBe(200);
        const spag = res.body.items.find(i => i.productName === 'Spaghetti');
        // Magasin Central : 20 entrés, 14 sortis → 6 en stock, seuil 12 → critique
        expect(spag).toMatchObject({ quantity: 6, exitsOverPeriod: 14, status: 'critique' });
        expect(spag.coverageDays).toBeCloseTo(6 / (14 / 30), 1);
        expect(spag.suggestedReorder).toBe(Math.ceil(14 + 12 - 6));
    });

    test('export CSV : BOM, séparateur ; et neutralisation des formules', async () => {
        await request(app).post('/api/stock/movements').set(auth(chef1))
            .send({ productId: riz(), type: 'entry', quantity: 1, reason: '=HYPERLINK("http://x")' });
        const res = await request(app).get('/api/stock/export/movements.csv').set(auth(chef1));
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.text.charCodeAt(0)).toBe(0xFEFF);
        expect(res.text).toContain(`"'=HYPERLINK(""http://x"")"`);
    });
});
