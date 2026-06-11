// ===== GESTIÓN DE MEDICAMENTOS =====
let currentMedUser = null;

firebase.auth().onAuthStateChanged((user) => {
    currentMedUser = user;
    if (user && window.location.pathname.includes('medicamentos.html')) {
        loadMedicinesList();
    }
});

function showMedNotif(message, type = 'info') {
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

window.addMedicine = async function(medicineData) {
    if (!currentMedUser) {
        showMedNotif('❌ Debes iniciar sesión', 'error');
        return false;
    }

    try {
        const medicinesRef = firebase.database().ref(`users/${currentMedUser.uid}/medicines`);
        const newRef = medicinesRef.push();
        await newRef.set({
            name: medicineData.name,
            compartment: medicineData.compartment,
            quantity: medicineData.quantity,
            unit: medicineData.unit,
            dose: medicineData.dose,
            schedules: medicineData.schedules,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });

        const schedules = medicineData.schedules.split(',');
        const alarmsRef = firebase.database().ref(`users/${currentMedUser.uid}/alarms`);
        for (const time of schedules) {
            await alarmsRef.push({
                medicineId: newRef.key,
                compartment: medicineData.compartment,
                time: time.trim(),
                active: true,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }

        showMedNotif('✅ Medicamento agregado correctamente', 'success');
        loadMedicinesList();
        return true;
    } catch (error) {
        console.error('Error al agregar:', error);
        showMedNotif('❌ Error al agregar medicamento', 'error');
        return false;
    }
};

async function loadMedicinesList() {
    if (!currentMedUser) return;

    const snapshot = await firebase.database().ref(`users/${currentMedUser.uid}/medicines`).once('value');
    const grid = document.getElementById('medicines-grid');
    if (!grid) return;

    grid.innerHTML = '';
    if (!snapshot.exists()) {
        grid.innerHTML = '<div class="no-data">No hay medicamentos. Haz clic en "+ ADD" para agregar.</div>';
        return;
    }

    snapshot.forEach((child) => {
        const med = { id: child.key, ...child.val() };
        const card = document.createElement('div');
        card.className = 'medicine-card';
        card.innerHTML = `
            <div class="medicine-name">${escapeHtml(med.name)}</div>
            <div class="medicine-details">
                📦 Compartimento: ${med.compartment}<br>
                💊 Cantidad: ${med.quantity} ${med.unit}<br>
                💉 Dosis: ${med.dose} ${med.unit}<br>
                ⏰ Horarios: ${med.schedules}
            </div>
            <div class="medicine-actions">
                <button onclick="deleteMedicine('${med.id}')" class="btn-delete">🗑️ Eliminar</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.deleteMedicine = async function(medicineId) {
    if (!currentMedUser) return;
    if (!confirm('¿Eliminar este medicamento? También se eliminarán sus alarmas')) return;

    try {
        await firebase.database().ref(`users/${currentMedUser.uid}/medicines/${medicineId}`).remove();

        const alarmsSnapshot = await firebase.database().ref(`users/${currentMedUser.uid}/alarms`)
            .orderByChild('medicineId')
            .equalTo(medicineId)
            .once('value');

        const updates = {};
        alarmsSnapshot.forEach((child) => {
            updates[`users/${currentMedUser.uid}/alarms/${child.key}`] = null;
        });
        await firebase.database().ref().update(updates);

        showMedNotif('✅ Medicamento eliminado', 'success');
        loadMedicinesList();
    } catch (error) {
        console.error('Error al eliminar:', error);
        showMedNotif('❌ Error al eliminar', 'error');
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

firebase.auth().onAuthStateChanged((user) => {
    currentMedUser = user;
    if (user && window.location.pathname.includes('medicamentos.html')) {
        loadMedicinesList();
    }
});
