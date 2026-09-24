document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    loadDashboard();
});

async function loadDashboard() {
    try {
        await Promise.all([
            loadStats(),
            loadCurrentStock(),
            loadRecentMovements(),
            loadInsights()
        ]);
    } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        showError('Erreur lors du chargement des données');
    }
}

async function loadStats() {
    try {
        const stats = await API.getDashboardStats();

        document.getElementById('total-products').textContent = stats.totalProducts;
        document.getElementById('total-stock').textContent = stats.totalStockValue;
        document.getElementById('low-stock').textContent = stats.lowStockProducts;
        document.getElementById('recent-movements').textContent = stats.todayMovements;

    } catch (error) {
        console.error('Erreur stats:', error);
        // Fallback en cas d'erreur
        document.getElementById('total-products').textContent = '—';
        document.getElementById('total-stock').textContent = '—';
        document.getElementById('low-stock').textContent = '—';
        document.getElementById('recent-movements').textContent = '—';
    }
}

async function loadCurrentStock() {
    try {
        const stock = await API.getCurrentStock();
        const tbody = document.getElementById('stock-tbody');
        
        if (stock.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucun stock disponible</td></tr>';
            return;
        }

        tbody.innerHTML = stock.map(item => `
            <tr>
                <td>${esc(item.productName)}</td>
                <td>${item.quantity}</td>
                <td>${esc(item.productCategory || 'N/A')}</td>
                <td>
                    <span style="color: ${item.isLowStock ? 'red' : item.quantity < 50 ? 'orange' : 'green'}">
                        ${item.isLowStock ? 'Stock faible' : item.quantity < 50 ? 'Stock moyen' : 'Stock OK'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-success" onclick="showMovementModal('${item.productId}', 'entry')">Entrée</button>
                    <button class="btn btn-warning" onclick="showMovementModal('${item.productId}', 'exit')">Sortie</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erreur stock:', error);
        document.getElementById('stock-tbody').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; color: red;">Erreur chargement stock</td></tr>';
    }
}

async function loadRecentMovements() {
    try {
        const movements = await API.getMovements(10);
        const tbody = document.getElementById('movements-tbody');
        
        if (movements.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Aucun mouvement récent</td></tr>';
            return;
        }

        tbody.innerHTML = movements.map(movement => `
            <tr>
                <td>${new Date(movement.createdAt).toLocaleDateString()}</td>
                <td>${esc(movement.productName || 'Produit inconnu')}</td>
                <td>
                    <span style="color: ${movement.type === 'entry' ? 'green' : 'red'}">
                        ${movement.type === 'entry' ? 'Entrée' : 'Sortie'}
                    </span>
                </td>
                <td>${movement.quantity}</td>
                <td>${esc(movement.userName)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erreur mouvements:', error);
        document.getElementById('movements-tbody').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; color: red;">Erreur chargement mouvements</td></tr>';
    }
}

function showMovementModal(productId, type) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 8px; width: 400px;">
            <h3>${type === 'in' ? 'Entrée' : 'Sortie'} de stock</h3>
            <form id="movementForm">
                <div class="form-group">
                    <label>Quantité :</label>
                    <input type="number" id="quantity" class="form-control" min="1" required>
                </div>
                <div class="form-group">
                    <label>Motif :</label>
                    <input type="text" id="reason" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary">Valider</button>
                <button type="button" class="btn" onclick="this.closest('div').parentElement.remove()" style="margin-left: 1rem;">Annuler</button>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('movementForm').onsubmit = async (e) => {
        e.preventDefault();
        const quantity = parseInt(document.getElementById('quantity').value);
        const reason = document.getElementById('reason').value;
        
        try {
            await API.addMovement(productId, type, quantity, reason);
            modal.remove();
            loadDashboard();
            showSuccess('Mouvement enregistré avec succès');
        } catch (error) {
            showError('Erreur lors de l\'enregistrement');
        }
    };
}

function showError(message) {
    const alert = document.createElement('div');
    alert.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: red; color: white;
        padding: 1rem; border-radius: 6px; z-index: 1001;
    `;
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}

function showSuccess(message) {
    const alert = document.createElement('div');
    alert.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: green; color: white;
        padding: 1rem; border-radius: 6px; z-index: 1001;
    `;
    alert.textContent = message;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}


// ---------- Aide au réapprovisionnement (API /analytics/insights) ----------
const STATUS_STYLE = {
    rupture: ['Rupture', '#c0392b'],
    critique: ['Critique', '#e67e22'],
    surveillance: ['À surveiller', '#d4ac0d'],
    ok: ['OK', '#27ae60']
};

async function loadInsights() {
    const tbody = document.getElementById('insights-tbody');
    if (!tbody) return;
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const label = document.getElementById('scope-label');
        if (label && user.storeName) label.textContent = `Périmètre : ${user.storeName}. ` + label.textContent;
        const data = await API.getInsights(30);
        if (!data.items.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Aucune donnée</td></tr>';
            return;
        }
        tbody.innerHTML = data.items.map(i => {
            const [txt, color] = STATUS_STYLE[i.status];
            const coverage = i.coverageDays === null ? '—' : `${i.coverageDays} j`;
            return `<tr>
                <td>${esc(i.productName)}</td>
                <td>${i.quantity} <small>${esc(i.unit)}</small></td>
                <td>${i.dailyUsage}</td>
                <td>${coverage}</td>
                <td><span style="background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:0.85rem;">${txt}</span></td>
                <td><strong>${i.suggestedReorder}</strong></td>
            </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">${esc(error.message)}</td></tr>`;
    }
}

// Export CSV authentifié (le lien simple n'envoie pas le jeton)
document.addEventListener('click', async (e) => {
    const link = e.target.closest('#export-stock');
    if (!link) return;
    e.preventDefault();
    const res = await fetch(link.getAttribute('href'), { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (!res.ok) return showError('Export impossible');
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'stock_courant.csv' });
    a.click();
    URL.revokeObjectURL(url);
});
