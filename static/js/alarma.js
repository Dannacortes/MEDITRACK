// ===== Gestión de Alarmas =====

// Obtener alarmas del usuario
async function getUserAlarms() {
    const userId = firebase.auth().currentUser.uid;
    const snapshot = await firebase.database().ref(`users/${userId}/alarms`).once('value');
    const alarms = [];
    snapshot.forEach((child) => {
        alarms.push({
            id: child.key,
            ...child.val()
        });
    });
    return alarms;
}

// Activar/Desactivar alarma
async function toggleAlarm(alarmId, active) {
    const userId = firebase.auth().currentUser.uid;
    try {
        await firebase.database().ref(`users/${userId}/alarms/${alarmId}`).update({
            active: active,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification(`Alarma ${active ? 'activada' : 'desactivada'}`, 'success');
        return true;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

// Eliminar alarma
async function deleteAlarm(alarmId) {
    const userId = firebase.auth().currentUser.uid;
    if (!confirm('¿Eliminar esta alarma?')) return false;

    try {
        await firebase.database().ref(`users/${userId}/alarms/${alarmId}`).remove();
        showNotification('Alarma eliminada', 'success');
        return true;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

// Verificar alarmas pendientes (ejecutado cada minuto)
function checkPendingAlarms() {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    getUserAlarms().then(alarms => {
        alarms.forEach(alarm => {
            if (alarm.active && alarm.time === currentTime) {
                // Notificar al ESP32
                firebase.database().ref('dispenser/commands').set({
                    action: 'dispense',
                    compartment: alarm.compartment,
                    alarmId: alarm.id,
                    timestamp: Date.now()
                });

                // Registrar en historial
                registerMissedDose(alarm.medicineId, alarm.compartment, 'pending');
            }
        });
    });
}

// Iniciar verificación de alarmas cada minuto
setInterval(checkPendingAlarms, 60000);
