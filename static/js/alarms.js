// ===== GESTIÓN DE ALARMAS =====
let currentAlarmUser = null;

firebase.auth().onAuthStateChanged((user) => {
    currentAlarmUser = user;
    if (user) {
        startAlarmChecker();
    }
});

function showAlarmNotif(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

async function getUserAlarms() {
    if (!currentAlarmUser) return [];
    const snapshot = await firebase.database().ref(`users/${currentAlarmUser.uid}/alarms`).once('value');
    const alarms = [];
    snapshot.forEach((child) => {
        alarms.push({ id: child.key, ...child.val() });
    });
    return alarms;
}

async function checkPendingAlarms() {
    if (!currentAlarmUser) return;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const alarms = await getUserAlarms();

    for (const alarm of alarms) {
        if (alarm.active && alarm.time === currentTime) {
            console.log('🔔 Alarma activa para:', alarm);
            try {
                await firebase.database().ref('dispenser/commands').set({
                    action: 'dispense',
                    compartment: alarm.compartment,
                    alarmId: alarm.id,
                    timestamp: Date.now()
                });
                console.log('✅ Comando enviado a ESP32');
            } catch (e) {
                console.log('Error notificando a ESP32:', e);
            }

            if (typeof window.showNotification === 'function') {
                window.showNotification(`🔔 Alarma: Compartimento ${alarm.compartment}`, 'warning');
            }
        }
    }
}

let alarmInterval = null;
function startAlarmChecker() {
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = setInterval(checkPendingAlarms, 60000);
    checkPendingAlarms();
}

window.checkPendingAlarms = checkPendingAlarms;
