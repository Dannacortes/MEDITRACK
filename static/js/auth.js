// ===== AUTENTICACIÓN CON ALERTAS Y REDIRECCIONES =====

// Mostrar alerta personalizada
function showAuthAlert(message, type, onClose = null) {
    // Crear elemento de alerta flotante
    const alertDiv = document.createElement('div');
    alertDiv.className = `auth-alert ${type}`;
    alertDiv.innerHTML = `
        <div class="alert-content">
            <span class="alert-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="alert-message">${message}</span>
        </div>
    `;
    document.body.appendChild(alertDiv);

    // Animar entrada
    setTimeout(() => alertDiv.classList.add('show'), 10);

    // Auto-cerrar después de 2 segundos
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => {
            alertDiv.remove();
            if (onClose) onClose();
        }, 300);
    }, 2000);
}

// Registro de usuario con alerta y redirección
async function registerUser(email, password, fullname) {
    try {
        // Mostrar loading
        const submitBtn = document.querySelector('#register-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Registrando...';
        submitBtn.disabled = true;

        // Crear usuario en Firebase Auth
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Guardar datos adicionales en Realtime Database
        await firebase.database().ref(`users/${user.uid}/profile`).set({
            fullname: fullname,
            email: email,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Alerta de éxito
        showAuthAlert(`¡Bienvenido ${fullname}! Usuario registrado correctamente`, 'success', () => {
            // Redirigir al dashboard después de la alerta
            window.location.href = 'dashboard.html';
        });

        return true;

    } catch (error) {
        console.error('Error en registro:', error);

        let errorMessage = 'Error al registrar usuario';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = '❌ Este correo ya está registrado';
                break;
            case 'auth/invalid-email':
                errorMessage = '❌ Correo electrónico inválido';
                break;
            case 'auth/weak-password':
                errorMessage = '❌ La contraseña debe tener al menos 6 caracteres';
                break;
            default:
                errorMessage = `❌ ${error.message}`;
        }

        showAuthAlert(errorMessage, 'error');

        // Restaurar botón
        const submitBtn = document.querySelector('#register-form button[type="submit"]');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

        return false;
    }
}

// Inicio de sesión con alerta y redirección
async function loginUser(email, password) {
    try {
        // Mostrar loading
        const submitBtn = document.querySelector('#login-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ Iniciando sesión...';
        submitBtn.disabled = true;

        // Iniciar sesión
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Obtener nombre del usuario
        const profileSnapshot = await firebase.database().ref(`users/${user.uid}/profile`).once('value');
        const profile = profileSnapshot.val();
        const fullname = profile ? profile.fullname : email;

        // Alerta de éxito
        showAuthAlert(`✅ ¡Bienvenido de vuelta ${fullname}!`, 'success', () => {
            // Redirigir al dashboard después de la alerta
            window.location.href = 'dashboard.html';
        });

        return true;

    } catch (error) {
        console.error('Error en login:', error);

        let errorMessage = '❌ Error al iniciar sesión';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = '❌ Usuario no encontrado';
                break;
            case 'auth/wrong-password':
                errorMessage = '❌ Contraseña incorrecta';
                break;
            case 'auth/invalid-email':
                errorMessage = '❌ Correo electrónico inválido';
                break;
            case 'auth/too-many-requests':
                errorMessage = '❌ Demasiados intentos. Intenta más tarde';
                break;
            default:
                errorMessage = `❌ ${error.message}`;
        }

        showAuthAlert(errorMessage, 'error');

        // Restaurar botón
        const submitBtn = document.querySelector('#login-form button[type="submit"]');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;

        return false;
    }
}

// Cerrar sesión
async function logoutUser() {
    try {
        await firebase.auth().signOut();
        showAuthAlert('✅ Sesión cerrada correctamente', 'success', () => {
            window.location.href = 'index.html';
        });
    } catch (error) {
        console.error('Error en logout:', error);
        showAuthAlert('❌ Error al cerrar sesión', 'error');
    }
}

// Verificar estado de autenticación (para mantener sesión)
function checkAuthState() {
    firebase.auth().onAuthStateChanged((user) => {
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.includes('index.html') || currentPath.includes('registro.html') || currentPath === '/' || currentPath === '/index.html';

        if (user) {
            // Usuario logueado
            console.log('Usuario logueado:', user.email);

            // Si está en página de login/registro, redirigir a dashboard
            if (isAuthPage) {
                window.location.href = 'dashboard.html';
            }
        } else {
            // Usuario no logueado
            console.log('Usuario no logueado');

            // Si no está en página de autenticación, redirigir a login
            if (!isAuthPage && !currentPath.includes('dashboard.html')) {
                window.location.href = 'index.html';
            }
        }
    });
}

// Event listeners para los formularios
document.addEventListener('DOMContentLoaded', () => {
    // Verificar estado de autenticación al cargar
    checkAuthState();

    // Formulario de registro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const fullname = document.getElementById('fullname').value;

            // Validaciones
            if (!fullname.trim()) {
                showAuthAlert('❌ Por favor ingresa tu nombre completo', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showAuthAlert('❌ Las contraseñas no coinciden', 'error');
                return;
            }

            if (password.length < 6) {
                showAuthAlert('❌ La contraseña debe tener al menos 6 caracteres', 'error');
                return;
            }

            await registerUser(email, password, fullname);
        });
    }

    // Formulario de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showAuthAlert('❌ Por favor completa todos los campos', 'error');
                return;
            }

            await loginUser(email, password);
        });
    }

    // Botón de logout (si existe en la página)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutUser();
        });
    }
});
