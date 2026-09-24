// Chemin relatif : le front est servi par le même serveur Express (fonctionne en local, Docker ou en ligne)
const API_BASE = '/api';

// Échappement HTML : toute donnée venant de l'API est échappée avant insertion via innerHTML (anti-XSS stocké)
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

class API {
    static async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            const data = await response.json().catch(() => ({}));

            if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
                logout(); // session expirée : retour à la connexion
            }
            if (!response.ok) {
                const details = Array.isArray(data.details) ? ' : ' + data.details.join(', ') : '';
                throw new Error((data.error || data.message || 'Erreur API') + details);
            }
            
            return data;
        } catch (error) {
            console.error('Erreur API:', error);
            throw error;
        }
    }

    static async login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: { email, password }
        });
    }

    static async getProducts() {
        return this.request('/products');
    }

    static async getCurrentStock() {
        return this.request('/stock/current');
    }

    static async getMovements(limit = 50) {
        return this.request(`/stock/movements?limit=${limit}`);
    }

    static async addMovement(productId, type, quantity, reason) {
        return this.request('/stock/movements', {
            method: 'POST',
            body: { productId, type, quantity: parseInt(quantity, 10), reason }
        });
    }

    static async getInsights(days = 30) {
        return this.request(`/analytics/insights?days=${days}`);
    }

    static async getDashboardStats() {
        return this.request('/dashboard/stats');
    }

    static async createProduct(product) {
        return this.request('/products', {
            method: 'POST',
            body: product
        });
    }

    static async updateProduct(id, product) {
        return this.request(`/products/${id}`, {
            method: 'PUT',
            body: product
        });
    }

    static async deleteProduct(id) {
        return this.request(`/products/${id}`, {
            method: 'DELETE'
        });
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}
