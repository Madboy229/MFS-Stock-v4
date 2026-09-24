const { toCsv, cell } = require('../backend/services/csv');
const { escapeHtml } = require('../backend/routes/contact');

describe('Utilitaires de sécurité', () => {
    test('cell() échappe les guillemets', () => expect(cell('a"b')).toBe('"a""b"'));
    test('cell() neutralise =, +, -, @', () => {
        for (const c of ['=', '+', '-', '@']) expect(cell(`${c}1`)).toBe(`"'${c}1"`);
    });
    test('toCsv() produit en-tête + lignes', () => {
        const csv = toCsv([{ a: 1, b: 'x' }], ['a', 'b']);
        expect(csv.slice(1).split('\r\n')).toEqual(['"a";"b"', '"1";"x"']);
    });
    test('escapeHtml() neutralise les balises', () => {
        expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
});
