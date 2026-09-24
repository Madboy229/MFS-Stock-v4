document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) return;
    
    loadProducts();
});

async function loadProducts() {
    try {
        const [products, stock] = await Promise.all([
            API.getProducts(),
            API.getCurrentStock()
        ]);

        const tbody = document.getElementById('products-tbody');
        
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Aucun produit disponible</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(product => {
            const currentStock = stock.find(s => s.productId === product.id);
            const stockQuantity = currentStock ? currentStock.quantity : 0;
            
            return `
                <tr>
                    <td>${esc(product.name)}</td>
                    <td>${esc(product.category)}</td>
                    <td>${esc(product.unit)}</td>
                    <td>${product.minimumStock}</td>
                    <td>
                        <span style="color: ${stockQuantity < product.minimumStock ? 'red' : 'green'}">
                            ${stockQuantity}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-warning" onclick="editProduct('${product.id}')">Modifier</button>
                        <button class="btn" onclick="deleteProduct('${product.id}')" style="background: red; color: white; margin-left: 0.5rem;">Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Erreur chargement produits:', error);
        document.getElementById('products-tbody').innerHTML = 
            '<tr><td colspan="7" style="text-align: center; color: red;">Erreur chargement produits</td></tr>';
    }
}

function showProductModal(product = null) {
    const isEdit = product !== null;
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 8px; width: 500px; max-height: 90vh; overflow-y: auto;">
            <h3>${isEdit ? 'Modifier' : 'Ajouter'} un produit</h3>
            <form id="productForm">
                <div class="form-group">
                    <label>Nom du produit :</label>
                    <input type="text" id="productName" class="form-control" value="${product?.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label>Catégorie :</label>
                    <select id="productCategory" class="form-control" required>
                        <option value="">Sélectionner...</option>
                        <option value="Riz" ${product?.category === 'Riz' ? 'selected' : ''}>Riz</option>
                        <option value="Sucre" ${product?.category === 'Sucre' ? 'selected' : ''}>Sucre</option>
                        <option value="Huile" ${product?.category === 'Huile' ? 'selected' : ''}>Huile végétale</option>
                        <option value="Pâtes" ${product?.category === 'Pâtes' ? 'selected' : ''}>Pâtes/Spaghetti</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Unité :</label>
                    <select id="productUnit" class="form-control" required>
                        <option value="">Sélectionner...</option>
                        <option value="kg" ${product?.unit === 'kg' ? 'selected' : ''}>Kilogramme (kg)</option>
                        <option value="L" ${product?.unit === 'L' ? 'selected' : ''}>Litre (L)</option>
                        <option value="sac" ${product?.unit === 'sac' ? 'selected' : ''}>Sac</option>
                        <option value="carton" ${product?.unit === 'carton' ? 'selected' : ''}>Carton</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Stock minimum :</label>
                    <input type="number" id="productMinStock" class="form-control" value="${product?.minimumStock || ''}" min="0" required>
                </div>
                
                <button type="submit" class="btn btn-primary">${isEdit ? 'Modifier' : 'Ajouter'}</button>
                <button type="button" class="btn" onclick="this.closest('div').parentElement.remove()" style="margin-left: 1rem;">Annuler</button>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('productForm').onsubmit = async (e) => {
        e.preventDefault();
        
        const productData = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            unit: document.getElementById('productUnit').value,
            minimumStock: parseInt(document.getElementById('productMinStock').value) || 0
        };
        
        console.log('📦 Données envoyées au serveur:', productData);
        
        try {
            if (isEdit) {
                await API.updateProduct(product.id, productData);
                showSuccess('Produit modifié avec succès');
            } else {
                await API.createProduct(productData);
                showSuccess('Produit ajouté avec succès');
            }
            
            modal.remove();
            loadProducts();
        } catch (error) {
            showError('Erreur lors de l\'enregistrement');
        }
    };
}

async function editProduct(productId) {
    try {
        const products = await API.getProducts();
        const product = products.find(p => p.id === productId);
        if (product) {
            showProductModal(product);
        }
    } catch (error) {
        showError('Erreur lors du chargement du produit');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
        return;
    }
    
    try {
        await API.deleteProduct(productId);
        showSuccess('Produit supprimé avec succès');
        loadProducts();
    } catch (error) {
        showError('Erreur lors de la suppression');
    }
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
