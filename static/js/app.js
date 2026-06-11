// ===== MEDITRACK - APP PRINCIPAL =====

window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
    console.log(`[${type}] ${message}`);
};

window.dispenseNow = async function(compartment) {
    const user = firebase.auth().currentUser;
    if (!user) {
        window.showNotification('❌ Usuario no autenticado', 'error');
        return;
    }

    window.showNotification(`⏳ Dispensando compartimento ${compartment}...`, 'warning');
    try {
        await firebase.database().ref('dispenser/commands').set({
            action: 'dispense',
            compartment: compartment,
            timestamp: Date.now(),
            userId: user.uid
        });
        window.showNotification(`✅ Compartimento ${compartment} dispensado`, 'success');
    } catch (error) {
        console.error('Error:', error);
        window.showNotification('❌ Error al dispensar', 'error');
    }
};

async function loadDashboard() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    const userId = user.uid;

    try {
        const medSnapshot = await firebase.database().ref(`users/${userId}/medicines`).once('value');
        const medicines = [];
        medSnapshot.forEach((child) => {
            medicines.push({ id: child.key, ...child.val() });
        });

        const medCountElem = document.getElementById('med-count');
        if (medCountElem) medCountElem.textContent = medicines.length;

        const alarmSnapshot = await firebase.database().ref(`users/${userId}/alarms`).once('value');
        const alarms = [];
        alarmSnapshot.forEach((child) => {
            alarms.push({ id: child.key, ...child.val() });
        });

        updateCompartments(medicines);
        updateAlarmsList(alarms, medicines);
        updateReminders(alarms, medicines);
        updateNextDose(alarms);

        const statusSnapshot = await firebase.database().ref('dispenser/status').once('value');
        const status = statusSnapshot.val() || {};
        const wifiStatusElem = document.getElementById('wifi-status');
        if (wifiStatusElem) {
            wifiStatusElem.innerHTML = status.connected ? '✅ Conectado' : '❌ Desconectado';
            wifiStatusElem.style.color = status.connected ? '#4CAF50' : '#ff4444';
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        window.showNotification('Error al cargar datos', 'error');
    }
}

function updateCompartments(medicines) {
    const grid = document.getElementById('compartments-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        const med = medicines.find(m => m.compartment === i);
        const card = document.createElement('div');
        card.className = 'compartment-card';

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

function updateAlarmsList(alarms, medicines) {
    const list = document.getElementById('alarms-list');
    if (!list) return;

    if (alarms.length === 0) {
        list.innerHTML = '<p class="no-data">No hay alarmas programadas</p>';
        return;
    }

    list.innerHTML = '';
    alarms.forEach(alarm => {
        const med = medicines.find(m => m.id === alarm.medicineId);
        const item = document.createElement('div');
        item.className = 'alarm-item';
        item.innerHTML = `
            <div class="alarm-time">⏰ ${alarm.time}</div>
            <div><strong>${med ? med.name : 'Medicamento'}</strong></div>
            <div>📦 Compartimento ${alarm.compartment}</div>
            <button onclick="dispenseNow(${alarm.compartment})" class="btn-small">Dispensar</button>
        `;
        list.appendChild(item);
    });
}

function updateReminders(alarms, medicines) {
    const remindersList = document.getElementById('reminders-list');
    if (!remindersList) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const upcomingAlarms = alarms.filter(alarm => {
        const [hours, minutes] = alarm.time.split(':');
        const alarmTime = parseInt(hours) * 60 + parseInt(minutes);
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

function updateNextDose(alarms) {
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

// Inicializar dashboard si estamos en dashboard.html
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                loadDashboard();

                // Escuchar cambios en tiempo real
                const userId = user.uid;
                firebase.database().ref(`users/${userId}/medicines`).on('value', () => loadDashboard());
                firebase.database().ref(`users/${userId}/alarms`).on('value', () => loadDashboard());
                firebase.database().ref('dispenser/status').on('value', (snapshot) => {
                    const status = snapshot.val();
                    if (status && status.lastDispense && status.lastDispense > Date.now() - 5000) {
                        window.showNotification(`✅ Medicamento dispensado del compartimento ${status.lastCompartment}`, 'success');
                        loadDashboard();
                    }
                });
            }
        });
    }
});
