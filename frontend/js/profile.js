class ProfileManager {
    constructor() {
        this.user = JSON.parse(localStorage.getItem('user')) || {};
        this.init();
    }

    init() {
        this.displayUserInfo();
        this.setupEventListeners();
        this.loadUserStats();
    }

    displayUserInfo() {
        document.getElementById('userName').textContent = this.user.name || '';
        document.getElementById('userRole').textContent = this.user.role || '';
        document.getElementById('userEmail').textContent = this.user.email || '';
    }

    setupEventListeners() {
        // Changement de mot de passe
        document.getElementById('changePasswordForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.changePassword();
        });
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('Les nouveaux mots de passe ne correspondent pas');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                alert('Mot de passe modifié avec succès');
                document.getElementById('changePasswordForm').reset();
            } else {
                alert('Erreur lors du changement de mot de passe');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur de connexion');
        }
    }

    async loadUserStats() {
        try {
            const response = await fetch('/api/stock/movements?user=' + this.user.id, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (response.ok) {
                const movements = await response.json();
                this.displayStats(movements);
            }
        } catch (error) {
            console.error('Erreur lors du chargement des statistiques:', error);
        }
    }

    displayStats(movements) {
        const totalMovements = movements.length;
        const entriesCount = movements.filter(m => m.type === 'entry').length;
        const exitsCount = movements.filter(m => m.type === 'exit').length;

        document.getElementById('totalMovements').textContent = totalMovements;
        document.getElementById('totalEntries').textContent = entriesCount;
        document.getElementById('totalExits').textContent = exitsCount;
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});
