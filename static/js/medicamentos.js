// ===== Gestión de Medicamentos =====

// Agregar medicamento
async function addMedicine(medicineData) {
    const userId = firebase.auth().currentUser.uid;
    try {
        const newMedicineRef = firebase.database().ref(`users/${userId}/medicines`).push();
        await newMedicineRef.set({
            ...medicineData,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });

        // Crear alarmas automáticamente
        await createAlarmsForMedicine(newMedicineRef.key, medicineData);

        showNotification('Medicamento agregado correctamente', 'success');
        return true;
    } catch (error) {
        console.error('Error al agregar medicamento:', error);
        showNotification('Error al agregar medicamento', 'error');
        return false;
    }
}

// Crear alarmas para un medicamento
async function createAlarmsForMedicine(medicineId, medicineData) {
    const userId = firebase.auth().currentUser.uid;
    const schedules = medicineData.schedules.split(',');

    for (const schedule of schedules) {
        const time = schedule.trim();
        await firebase.database().ref(`users/${userId}/alarms`).push({
            medicineId: medicineId,
            compartment: medicineData.compartment,
            time: time,
            active: true,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

// Actualizar medicamento
async function updateMedicine(medicineId, medicineData) {
    const userId = firebase.auth().currentUser.uid;
    try {
        await firebase.database().ref(`users/${userId}/medicines/${medicineId}`).update({
            ...medicineData,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        showNotification('Medicamento actualizado', 'success');
        return true;
    } catch (error) {
        console.error('Error al actualizar:', error);
        return false;
    }
}

// Eliminar medicamento
async function deleteMedicine(medicineId) {
    const userId = firebase.auth().currentUser.uid;
    if (!confirm('¿Eliminar este medicamento? También se eliminarán sus alarmas')) {
        return false;
    }

    try {
        // Eliminar medicamento
        await firebase.database().ref(`users/${userId}/medicines/${medicineId}`).remove();

        // Eliminar alarmas asociadas
        const alarmsSnapshot = await firebase.database().ref(`users/${userId}/alarms`)
            .orderByChild('medicineId')
            .equalTo(medicineId)
            .once('value');

        const updates = {};
        alarmsSnapshot.forEach((child) => {
            updates[`users/${userId}/alarms/${child.key}`] = null;
        });
        await firebase.database().ref().update(updates);

        showNotification('Medicamento eliminado', 'success');
        return true;
    } catch (error) {
        console.error('Error al eliminar:', error);
        return false;
    }
}

// Event listener para formulario de medicamentos
document.addEventListener('DOMContentLoaded', () => {
    const addMedicineForm = document.getElementById('add-medicine-form');
    if (addMedicineForm) {
        addMedicineForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const medicineData = {
                name: document.getElementById('med-name').value,
                compartment: parseInt(document.getElementById('med-compartment').value),
                quantity: parseInt(document.getElementById('med-quantity').value),
                unit: document.getElementById('med-unit').value,
                dose: parseFloat(document.getElementById('med-dose').value),
                frequency: parseInt(document.getElementById('med-frequency').value),
                schedules: document.getElementById('med-schedules').value
            };
            await addMedicine(medicineData);
            addMedicineForm.reset();
            // Recargar la página para mostrar cambios
            window.location.reload();
        });
    }
});
