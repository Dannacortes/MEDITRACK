// ===== MEDITRACK - LÓGICA PRINCIPAL =====
let currentUser = null;
let medicines = [];
let alarms = [];

// Mostrar notificación temporal
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Cargar nombre del usuario
async function loadUserName() {
    if (!currentUser) return;

    try {
        const snapshot = await firebase.database().ref(`users/${currentUser.uid}/profile`).once('value');
        const profile = snapshot.val();
        const userNameSpan = document.getElementById('user-name');
        if (userNameSpan && profile) {
            userNameSpan.textContent = `👋 ${profile.fullname}`;
            userNameSpan.style.display = 'block';
            userNameSpan.style.color = '#00c4ff';
        }
    } catch (error) {
        console.error('Error loading user name:', error);
    }
}

// Cargar dashboard
async function loadDashboard() {
    if (!currentUser) {
        console.log('No hay usuario logueado');
        return;
    }

    const userId = currentUser.uid;

    try {
        // Cargar medicamentos
        const medSnapshot = await firebase.database().ref(`users/${userId}/medicines`).once('value');
        medicines = [];
        medSnapshot.forEach((child) => {
            medicines.push({ id: child.key, ...child.val() });
        });

        const medCountElem = document.getElementById('med-count');
        if (medCountElem) medCountElem.textContent = medicines.length;

        // Cargar alarmas
        const alarmSnapshot = await firebase.database().ref(`users/${userId}/alarms`).once('value');
        alarms = [];
        alarmSnapshot.forEach((child) => {
            alarms.push({ id: child.key, ...child.val() });
        });

        // Actualizar UI
        updateCompartments();
        updateAlarmsList();
        updateReminders();
        updateNextDose();

        // Estado del dispensador
        const statusSnapshot = await firebase.database().ref('dispenser/status').once('value');
        const status = statusSnapshot.val() || {};
        const wifiStatusElem = document.getElementById('wifi-status');
        if (wifiStatusElem) {
            wifiStatusElem.innerHTML = status.connected ? '✅ Conectado' : '❌ Desconectado';
            wifiStatusElem.style.color = status.connected ? '#4CAF50' : '#ff4444';
        }

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error al cargar datos', 'error');
    }
}

// Actualizar lista de recordatorios del día
function updateReminders() {
    const remindersList = document.getElementById('reminders-list');
    if (!remindersList) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    // Filtrar alarmas para hoy (próximas 24 horas)
    const upcomingAlarms = alarms.filter(alarm => {
        const [hours, minutes] = alarm.time.split(':');
        const alarmTime = parseInt(hours) * 60 + parseInt(minutes);
        // Mostrar alarmas que aún no han pasado hoy
        return alarmTime > currentTime;
    }).sort((a, b) => {
        const [ah, am] = a.time.split(':');
        const [bh, bm] = b.time.split(':');
        return (parseInt(ah) * 60 + parseInt(am)) - (parseInt(bh) * 60 + parseInt(bm));
    });

    if (upcomingAlarms.length === 0) {
        remindersList.innerHTML = '<p class="no-data">🎉 No hay más recordatorios para hoy</p>';
        return;
    }

    remindersList.innerHTML = '';
    upcomingAlarms.forEach(alarm => {
        const med = medicines.find(m => m.id === alarm.medicineId);
        const [hours, minutes] = alarm.time.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';

        const reminderItem = document.createElement('div');
        reminderItem.className = 'reminder-item';
        reminderItem.innerHTML = `
            <div class="reminder-time">⏰ ${hour12}:${minutes} ${ampm}</div>
            <div class="reminder-info">
                <strong>${med ? med.name : 'Medicamento'}</strong>
                <span class="reminder-dose">${med ? `${med.dose} ${med.unit}` : ''}</span>
            </div>
            <div class="reminder-compartment">Compartimento ${alarm.compartment}</div>
            <button onclick="dispenseNow(${alarm.compartment})" class="btn-reminder">💊 Tomar ahora</button>
        `;
        remindersList.appendChild(reminderItem);
    });
}

// Actualizar compartimentos
function updateCompartments() {
    const grid = document.getElementById('compartments-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        const med = medicines.find(m => m.compartment === i);
        const card = document.createElement('div');
        card.className = 'compartment-card';
        card.onclick = () => showCompartmentDetails(i);

        let statusText = 'Vacío';
        let statusColor = '#666';
        if (med) {
            if (med.quantity > 10) {
                statusText = '✅ Disponible';
                statusColor = '#4CAF50';
            } else if (med.quantity > 0) {
                statusText = `⚠️ Quedan ${med.quantity}`;
                statusColor = '#ff9800';
            } else {
                statusText = '❌ Agotado';
                statusColor = '#ff4444';
            }
        }

        card.innerHTML = `
            <div class="compartment-number">Compartimento ${i}</div>
            <div class="compartment-medicine">${med ? med.name : '---'}</div>
            <div style="color: ${statusColor}; margin-top: 10px; font-size: 0.9em;">${statusText}</div>
        `;
        grid.appendChild(card);
    }
}

// Actualizar lista de alarmas
function updateAlarmsList() {
    const list = document.getElementById('alarms-list');
    if (!list) return;

    if (alarms.length === 0) {
        list.innerHTML = '<p class="no-data">No hay alarmas programadas. Agrega medicamentos desde la sección "Medicamentos".</p>';
        return;
    }

    list.innerHTML = '';
    alarms.forEach(alarm => {
        const med = medicines.find(m => m.id === alarm.medicineId);
        const [hours, minutes] = alarm.time.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';

        const item = document.createElement('div');
        item.className = 'alarm-item';
        item.innerHTML = `
            <div class="alarm-time">⏰ ${hour12}:${minutes} ${ampm}</div>
            <div><strong>${med ? med.name : 'Medicamento'}</strong></div>
            <div>📦 Compartimento ${alarm.compartment}</div>
            <div>💊 ${med ? `${med.dose} ${med.unit}` : ''}</div>
            <button onclick="dispenseNow(${alarm.compartment})" class="btn-small">Dispensar</button>
        `;
        list.appendChild(item);
    });
}

// Actualizar próxima dosis
function updateNextDose() {
    const nextDoseElem = document.getElementById('next-dose');
    if (!nextDoseElem) return;

    if (alarms.length === 0) {
        nextDoseElem.textContent = 'No hay alarmas';
        return;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    let nextAlarm = null;
    let minDiff = 24 * 60;

    alarms.forEach(alarm => {
        const [hours, minutes] = alarm.time.split(':');
        const alarmTime = parseInt(hours) * 60 + parseInt(minutes);
        let diff = alarmTime - currentTime;
        if (diff < 0) diff += 24 * 60;
        if (diff < minDiff) {
            minDiff = diff;
            nextAlarm = alarm;
        }
    });

    if (nextAlarm) {
        const [hours, minutes] = nextAlarm.time.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        nextDoseElem.innerHTML = `${hour12}:${minutes} ${ampm}<br><small style="font-size: 0.5em;">${nextAlarm.time}</small>`;
    } else {
        nextDoseElem.textContent = '---';
    }
}

// Dispensar ahora
async function dispenseNow(compartment) {
    if (!currentUser) {
        showNotification('❌ Usuario no autenticado', 'error');
        return;
    }

    showNotification(`⏳ Dispensando compartimento ${compartment}...`, 'warning');
    try {
        await firebase.database().ref('dispenser/commands').set({
            action: 'dispense',
            compartment: compartment,
            timestamp: Date.now(),
            userId: currentUser.uid
        });
        showNotification(`✅ Compartimento ${compartment} dispensado correctamente`, 'success');
    } catch (error) {
        console.error('Error:', error);
        showNotification('❌ Error al dispensar', 'error');
    }
}

// Mostrar detalles del compartimento
function showCompartmentDetails(compartment) {
    const med = medicines.find(m => m.compartment === compartment);
    if (med) {
        showNotification(`${med.name} - Compartimento ${compartment}: ${med.quantity} ${med.unit} restantes`, 'info');
    } else {
        showNotification(`Compartimento ${compartment} está vacío`, 'warning');
    }
}

// Configurar event listeners
function setupDashboardEventListeners() {
    // Refrescar estado
    const refreshBtn = document.getElementById('refresh-status');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            showNotification('🔄 Actualizando datos...', 'info');
            loadDashboard();
        };
    }

    // Dispensación de emergencia
    const emergencyBtn = document.getElementById('emergency-dispense');
    if (emergencyBtn) {
        emergencyBtn.onclick = () => {
            if (confirm('⚠️ ¿Estás seguro de que quieres dispensar TODOS los medicamentos? Esta acción no se puede deshacer.')) {
                for (let i = 1; i <= 4; i++) {
                    setTimeout(() => dispenseNow(i), i * 500);
                }
            }
        };
    }
}

// Escuchar cambios en tiempo real
function startRealtimeUpdates() {
    if (!currentUser) return;

    // Escuchar cambios en alarmas
    const alarmsRef = firebase.database().ref(`users/${currentUser.uid}/alarms`);
    alarmsRef.on('value', () => {
        loadDashboard();
    });

    // Escuchar cambios en medicamentos
    const medicinesRef = firebase.database().ref(`users/${currentUser.uid}/medicines`);
    medicinesRef.on('value', () => {
        loadDashboard();
    });

    // Escuchar comandos del dispensador
    const statusRef = firebase.database().ref('dispenser/status');
    statusRef.on('value', (snapshot) => {
        const status = snapshot.val();
        if (status && status.lastDispense && status.lastDispense > Date.now() - 5000) {
            showNotification(`✅ Medicamento dispensado del compartimento ${status.lastCompartment}`, 'success');
            loadDashboard();
        }
    });
}

// Inicializar dashboard
function initDashboard() {
    setupDashboardEventListeners();
    loadDashboard();
    startRealtimeUpdates();
}

// Verificar autenticación y cargar dashboard
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;

            // Mostrar email del usuario
            const userEmailElem = document.getElementById('user-email');
            if (userEmailElem) {
                userEmailElem.textContent = user.email;
                userEmailElem.style.fontSize = '0.9em';
                userEmailElem.style.color = '#aaa';
            }

            // Cargar nombre del usuario
            await loadUserName();

            // Inicializar dashboard
            initDashboard();

        } else {
            // No hay usuario, redirigir a login
            const currentPath = window.location.pathname;
            if (!currentPath.includes('index.html') && !currentPath.includes('registro.html')) {
                window.location.href = 'index.html';
            }
        }
    });
});

// Exponer funciones globalmente
window.dispenseNow = dispenseNow;
window.showNotification = showNotification;
