// ===== GESTIÓN DE CONTACTO DE EMERGENCIA =====
let currentContactUser = null;
let perfilData = null;

firebase.auth().onAuthStateChanged((user) => {
    currentContactUser = user;
    if (user && window.location.pathname.includes('perfil.html')) {
        loadPerfil();
        setupContactForm();
    }
});

function showContactNotif(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`[${type}] ${message}`);
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.innerHTML = message;
        document.body.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
    }
}

async function loadPerfil() {
    if (!currentContactUser) return null;
    try {
        const snapshot = await firebase.database().ref(`users/${currentContactUser.uid}/contacto`).once('value');
        if (snapshot.exists()) {
            perfilData = snapshot.val();
            mostrarPerfilEnUI();
        } else {
            perfilData = null;
            mostrarFormulario();
        }
        return perfilData;
    } catch (error) {
        console.error('Error cargando perfil:', error);
        return null;
    }
}

async function savePerfil(perfil) {
    if (!currentContactUser) return false;
    try {
        await firebase.database().ref(`users/${currentContactUser.uid}/contacto`).set({
            paciente: perfil.paciente,
            contacto: perfil.contacto,
            actualizado: firebase.database.ServerValue.TIMESTAMP
        });
        perfilData = perfil;
        showContactNotif('✅ Contacto guardado correctamente', 'success');
        mostrarPerfilEnUI();
        return true;
    } catch (error) {
        console.error('Error guardando perfil:', error);
        showContactNotif('❌ Error al guardar contacto', 'error');
        return false;
    }
}

window.enviarNotificacionContacto = async function(tipo, detalles = {}) {
    if (!perfilData || !perfilData.contacto || !perfilData.contacto.nombre) {
        console.log('No hay contacto registrado');
        return false;
    }

    const contacto = perfilData.contacto;
    const paciente = perfilData.paciente;

    let mensaje = '';
    switch (tipo) {
        case 'ALARMA':
            mensaje = `🔔 ALARMA: ${paciente.nombre} debe tomar ${detalles.medicamento} (${detalles.dosis}) a las ${detalles.horario}.`;
            break;
        case 'TOMA_REGISTRADA':
            mensaje = `✅ ${paciente.nombre} ha tomado ${detalles.medicamento} (${detalles.dosis}) a las ${detalles.horaTomado}.`;
            break;
        default:
            mensaje = `📋 ${paciente.nombre}: ${detalles.mensaje || 'Notificación desde MEDITRACK'}`;
    }

    console.log(`📱 NOTIFICACIÓN enviada a ${contacto.nombre} (${contacto.telefono}): ${mensaje}`);
    showContactNotif(`📱 Notificación enviada a ${contacto.nombre}`, 'success');
    return true;
};

function mostrarPerfilEnUI() {
    const previewDiv = document.getElementById('contact-preview');
    const formSection = document.getElementById('profile-form-section');

    if (perfilData && previewDiv) {
        document.getElementById('preview-paciente-nombre').textContent = perfilData.paciente?.nombre || '';
        document.getElementById('preview-paciente-telefono').textContent = perfilData.paciente?.telefono || '';
        document.getElementById('preview-contacto-nombre').textContent = perfilData.contacto?.nombre || '';
        document.getElementById('preview-contacto-telefono').textContent = perfilData.contacto?.telefono || '';
        document.getElementById('preview-contacto-email').textContent = perfilData.contacto?.email || '';

        previewDiv.style.display = 'block';
        if (formSection) formSection.style.display = 'none';
    } else if (previewDiv) {
        previewDiv.style.display = 'none';
        mostrarFormulario();
    }
}

function mostrarFormulario() {
    const formSection = document.getElementById('profile-form-section');
    if (formSection) formSection.style.display = 'block';
}

function setupContactForm() {
    const guardarBtn = document.getElementById('guardar-contacto');
    const editBtn = document.getElementById('edit-profile-btn');
    const formSection = document.getElementById('profile-form-section');
    const previewDiv = document.getElementById('contact-preview');

    if (guardarBtn) {
        guardarBtn.onclick = async () => {
            const nuevoPerfil = {
                paciente: {
                    nombre: document.getElementById('paciente-nombre').value,
                    telefono: document.getElementById('paciente-telefono').value
                },
                contacto: {
                    nombre: document.getElementById('contacto-nombre').value,
                    telefono: document.getElementById('contacto-telefono').value,
                    email: document.getElementById('contacto-email').value
                }
            };
            await savePerfil(nuevoPerfil);
        };
    }

    if (editBtn) {
        editBtn.onclick = () => {
            if (formSection) formSection.style.display = 'block';
            if (previewDiv) previewDiv.style.display = 'none';
            if (perfilData) {
                document.getElementById('paciente-nombre').value = perfilData.paciente?.nombre || '';
                document.getElementById('paciente-telefono').value = perfilData.paciente?.telefono || '';
                document.getElementById('contacto-nombre').value = perfilData.contacto?.nombre || '';
                document.getElementById('contacto-telefono').value = perfilData.contacto?.telefono || '';
                document.getElementById('contacto-email').value = perfilData.contacto?.email || '';
            }
        };
    }
}
