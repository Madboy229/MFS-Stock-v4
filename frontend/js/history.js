let currentPage = 1;
let itemsPerPage = 20;
let allMovements = [];
let filteredMovements = [];
let sortDirection = 'desc';
let sortField = 'date';

document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    initializeFilters();
    loadMovements();
});

async function initializeFilters() {
    try {
        const products = await API.getProducts();
        const productSelect = document.getElementById('productFilter');
        
        productSelect.innerHTML = '<option value="">Tous les produits</option>';
        products.forEach(product => {
            productSelect.innerHTML += `<option value="${product.id}">${esc(product.name)}</option>`;
        });
        
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        document.getElementById('dateEnd').value = today.toISOString().split('T')[0];
        document.getElementById('dateStart').value = thirtyDaysAgo.toISOString().split('T')[0];
        
    } catch (error) {
        console.error('Erreur initialisation filtres:', error);
    }
}

async function loadMovements() {
    try {
        const movements = await API.getMovements(1000);
        allMovements = movements;
        applyFilters();
    } catch (error) {
        console.error('Erreur chargement mouvements:', error);
        document.getElementById('history-tbody').innerHTML = 
            '<tr><td colspan="7" style="text-align: center; color: red;">Erreur chargement de l\'historique</td></tr>';
    }
}

function applyFilters() {
    const dateStart = document.getElementById('dateStart').value;
    const dateEnd = document.getElementById('dateEnd').value;
    const productId = document.getElementById('productFilter').value;
    const type = document.getElementById('typeFilter').value;
    
    filteredMovements = allMovements.filter(movement => {
        const movementDate = new Date(movement.createdAt).toISOString().split('T')[0];
        
        if (dateStart && movementDate < dateStart) return false;
        if (dateEnd && movementDate > dateEnd) return false;
        if (productId && movement.productId !== productId) return false;
        if (type && movement.type !== type) return false;
        
        return true;
    });
    
    sortMovements();
    displayMovements();
    updatePagination();
}

function resetFilters() {
    document.getElementById('dateStart').value = '';
    document.getElementById('dateEnd').value = '';
    document.getElementById('productFilter').value = '';
    document.getElementById('typeFilter').value = '';
    
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    document.getElementById('dateEnd').value = today.toISOString().split('T')[0];
    document.getElementById('dateStart').value = thirtyDaysAgo.toISOString().split('T')[0];
    
    applyFilters();
}

function sortBy(field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'desc';
    }
    
    sortMovements();
    displayMovements();
}

function sortMovements() {
    filteredMovements.sort((a, b) => {
        let valueA, valueB;
        
        switch(sortField) {
            case 'date':
                valueA = new Date(a.createdAt);
                valueB = new Date(b.createdAt);
                break;
            case 'product':
                valueA = a.productName.toLowerCase();
                valueB = b.productName.toLowerCase();
                break;
            case 'type':
                valueA = a.type;
                valueB = b.type;
                break;
            case 'quantity':
                valueA = a.quantity;
                valueB = b.quantity;
                break;
            case 'user':
                valueA = a.userName.toLowerCase();
                valueB = b.userName.toLowerCase();
                break;
            default:
                return 0;
        }
        
        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function displayMovements() {
    const tbody = document.getElementById('history-tbody');
    const totalMovements = document.getElementById('totalMovements');
    
    totalMovements.textContent = filteredMovements.length;
    
    if (filteredMovements.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Aucun mouvement trouvé</td></tr>';
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageMovements = filteredMovements.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageMovements.map(movement => `
        <tr>
            <td>${new Date(movement.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</td>
            <td>${esc(movement.productName)}</td>
            <td>
                <span style="
                    padding: 0.25rem 0.5rem; 
                    border-radius: 4px; 
                    color: white; 
                    background-color: ${movement.type === 'entry' ? 'var(--vert)' : 'var(--orange)'};
                    font-size: 0.8rem;
                ">
                    ${movement.type === 'entry' ? '⬆️ Entrée' : '⬇️ Sortie'}
                </span>
            </td>
            <td style="font-weight: bold; color: ${movement.type === 'entry' ? 'green' : 'red'}">
                ${movement.type === 'entry' ? '+' : '-'}${movement.quantity}
            </td>
            <td>${esc(movement.reason || '-')}</td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <strong style="color: var(--bleu);">${esc(movement.userName)}</strong>
                    <small style="color: #666; font-size: 0.75rem;">${movement.userEmail || 'Email non disponible'}</small>
                </div>
            </td>
            <td>${movement.stockAfter || '-'}</td>
        </tr>
    `).join('');
}

function updatePagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredMovements.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    if (currentPage > 1) {
        paginationHTML += `<button class="btn" onclick="changePage(${currentPage - 1})">‹ Précédent</button>`;
    }
    
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        paginationHTML += `
            <button class="btn ${i === currentPage ? 'btn-primary' : ''}" 
                    onclick="changePage(${i})" 
                    style="margin: 0 0.25rem;">
                ${i}
            </button>
        `;
    }
    
    if (currentPage < totalPages) {
        paginationHTML += `<button class="btn" onclick="changePage(${currentPage + 1})">Suivant ›</button>`;
    }
    
    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    currentPage = page;
    displayMovements();
    updatePagination();
}

function exportHistory() {
    if (filteredMovements.length === 0) {
        showError('Aucune donnée à exporter');
        return;
    }
    
    const csvContent = [
        ['Date', 'Produit', 'Type', 'Quantité', 'Motif', 'Utilisateur', 'Stock après'],
        ...filteredMovements.map(movement => [
            new Date(movement.createdAt).toLocaleDateString('fr-FR'),
            movement.productName,
            movement.type === 'entry' ? 'Entrée' : 'Sortie',
            movement.quantity,
            movement.reason || '',
            movement.userName,
            movement.stockAfter || ''
        ])
    ];
    
    const csv = csvContent.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    link.href = URL.createObjectURL(blob);
    link.download = `historique_stock_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showSuccess('Export CSV réalisé avec succès');
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
