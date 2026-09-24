document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (localStorage.getItem('token') && window.location.pathname.includes('login.html')) {
        window.location.href = 'dashboard.html';
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-message');
    
    try {
        const response = await API.login(email, password);
        
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        errorDiv.style.display = 'block';
        errorDiv.textContent = error.message || 'Erreur de connexion';
    }
}
