// ===== GESTIÓN DE HISTORIAL =====
let currentHistUser = null;

firebase.auth().onAuthStateChanged((user) => {
    currentHistUser = user;
    if (user && window.location.pathname.includes('historial.html')) {
        loadHistoryTable();
    }
});

function showHistNotif(message, type = 'info') {
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

async function getHistory(filters = {}) {
    if (!currentHistUser) return [];

    let query = firebase.database().ref(`users/${currentHistUser.uid}/history`).orderByChild('timestamp');

    if (filters.dateFrom) {
        const fromTimestamp = new Date(filters.dateFrom).getTime();
        query = query.startAt(fromTimestamp);
    }
    if (filters.dateTo) {
        const toTimestamp = new Date(filters.dateTo).getTime() + 86400000;
        query = query.endAt(toTimestamp);
    }

    const snapshot = await query.once('value');
    const history = [];
    snapshot.forEach((child) => {
        history.push({ id: child.key, ...child.val() });
    });

    if (filters.compartment && filters.compartment !== 'all') {
        return history.filter(h => h.compartment === parseInt(filters.compartment));
    }
    return history.reverse();
}

async function registerSuccessfulDose(medicineId, compartment) {
    if (!currentHistUser) return false;
    try {
        await firebase.database().ref(`users/${currentHistUser.uid}/history`).push({
            medicineId: medicineId,
            compartment: compartment,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            status: 'taken'
        });
        showHistNotif('✅ Dosis registrada en historial', 'success');
        return true;
    } catch (error) {
        console.error('Error al registrar:', error);
        return false;
    }
}

async function loadHistoryTable() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;

    if (!currentHistUser) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">Inicia sesión para ver el historial</td></tr>';
        return;
    }

    const filters = {
        dateFrom: document.getElementById('filter-date-from')?.value,
        dateTo: document.getElementById('filter-date-to')?.value,
        compartment: document.getElementById('filter-compartment')?.value || 'all'
    };

    const history = await getHistory(filters);
    const medicinesSnapshot = await firebase.database().ref(`users/${currentHistUser.uid}/medicines`).once('value');
    const medicines = [];
    medicinesSnapshot.forEach((child) => {
        medicines.push({ id: child.key, ...child.val() });
    });

    tbody.innerHTML = '';
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-text">No hay registros de tomas</td></tr>';
        return;
    }

    for (const record of history) {
        const medicine = medicines.find(m => m.id === record.medicineId);
        const date = new Date(record.timestamp);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date.toLocaleString()}</td>
            <td>${medicine ? medicine.name : 'Desconocido'}</td>
            <td>Compartimento ${record.compartment}</td>
            <td>${medicine ? medicine.dose : '-'} ${medicine ? medicine.unit : ''}</td>
            <td class="${record.status === 'taken' ? 'status-taken' : 'status-missed'}">
                ${record.status === 'taken' ? '✓ Tomada' : '✗ Omitida'}
            </td>
        `;
        tbody.appendChild(row);
    }

    updateStatistics(history);
}

async function updateStatistics(history) {
    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;

    const totalDoses = history.length;
    const takenDoses = history.filter(h => h.status === 'taken').length;
    const missedDoses = history.filter(h => h.status === 'missed').length;
    const adherenceRate = totalDoses > 0 ? (takenDoses / totalDoses * 100).toFixed(1) : 0;

    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${totalDoses}</div>
            <div class="stat-label">Total de dosis</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${adherenceRate}%</div>
            <div class="stat-label">Adherencia</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${takenDoses}</div>
            <div class="stat-label">Tomadas</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${missedDoses}</div>
            <div class="stat-label">Omitidas</div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    const applyFilters = document.getElementById('apply-filters');
    if (applyFilters) {
        applyFilters.onclick = () => loadHistoryTable();
    }
});
