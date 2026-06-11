// ===== AUTENTICACIÓN SIMPLE =====

async function registerUser(email, password, fullname) {
    try {
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await firebase.database().ref(`users/${user.uid}/profile`).set({
            fullname: fullname,
            email: email,
            createdAt: Date.now()
        });

        alert(`✅ ¡Bienvenido ${fullname}!`);
        window.location.href = 'dashboard.html';  // REDIRECCIÓN DIRECTA
        return true;
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
        return false;
    }
}

async function loginUser(email, password) {
    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const snapshot = await firebase.database().ref(`users/${user.uid}/profile`).once('value');
        const profile = snapshot.val();
        const nombre = profile ? profile.fullname : email;

        alert(`✅ ¡Bienvenido ${nombre}!`);
        window.location.href = 'dashboard.html';  // REDIRECCIÓN DIRECTA
        return true;
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
        return false;
    }
}

async function logoutUser() {
    await firebase.auth().signOut();
    window.location.href = 'index.html';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirm-password')?.value;
            const fullname = document.getElementById('fullname').value;

            if (password !== confirm) {
                alert('❌ Las contraseñas no coinciden');
                return;
            }
            await registerUser(email, password, fullname);
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            await loginUser(email, password);
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logoutUser);
    }
});
