// Génération CSV sécurisée : échappement des guillemets + neutralisation de l'injection de formules (=, +, -, @)
function cell(v) {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows, columns, sep = ';') {
    const lines = [columns.map(cell).join(sep)];
    for (const r of rows) lines.push(columns.map(c => cell(r[c])).join(sep));
    return '﻿' + lines.join('\r\n'); // BOM pour l'ouverture correcte des accents dans Excel
}

module.exports = { toCsv, cell };
