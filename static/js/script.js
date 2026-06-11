// ============ DATA STORES ============
let perfil = {
    paciente: { nombre: '', telefono: '' },
    contacto: { nombre: '', telefono: '' },
    registrado: false
};

let medicamentos = [];
let alarmasActivas = [];
let intervalVerificacion = null;
let alarmaActualTimeout = null;

// Historial de tomas
let historialTomas = [];

// ============ ELEMENTOS DOM ============
const recordatoriosGrid = document.getElementById('recordatoriosGrid');
const medicamentosGrid = document.getElementById('medicamentosGrid');
const modalOverlay = document.getElementById('modalOverlay');
const alarmaModal = document.getElementById('alarmaModal');
const addRecordatorioBtn = document.getElementById('addRecordatorioBtn');
const addMedicamentoBtn = document.getElementById('addMedicamentoBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const addForm = document.getElementById('addForm');
const registroForm = document.getElementById('registroForm');
const toastMsg = document.getElementById('toastMsg');
const alarmasActivasDiv = document.getElementById('alarmasActivas');
const historialList = document.getElementById('historialList');

// Variable para la alarma actual mostrada
let alarmaMostrando = null;
let alarmaTimeoutRef = null;

// ============ NAVEGACIÓN ============
const navLinks = document.querySelectorAll('.nav-link');
const sections = {
    recordatorios: document.getElementById('recordatorios-section'),
    medicamentos: document.getElementById('medicamentos-section'),
    panel: document.getElementById('panel-section'),
    perfil: document.getElementById('perfil-section')
};

function switchSection(sectionId) {
    Object.keys(sections).forEach(key => {
        if (sections[key]) sections[key].classList.remove('active');
    });
    if (sections[sectionId]) sections[sectionId].classList.add('active');

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionId) {
            link.classList.add('active');
        }
    });

    if (sectionId === 'panel') {
        renderHistorial();
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        if (section && sections[section]) {
            switchSection(section);
        }
    });
});

document.querySelector('.profile-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchSection('perfil');
});

// ============ INICIALIZACIÓN ============
function init() {
    cargarDatos();

    // Configurar modal de alarma
    document.getElementById('apagarAlarmaBtn')?.addEventListener('click', apagarAlarma);
    document.getElementById('posponerAlarmaBtn')?.addEventListener('click', posponerAlarma);

    if (!perfil.registrado) {
        switchSection('perfil');
        mostrarPerfilInfo();
    } else {
        mostrarPerfilInfo();
        renderMedicamentos();
        actualizarRecordatorios();
        iniciarVerificacionAlarmas();
        renderHistorial();
        switchSection('recordatorios');
    }

    setupEventListeners();
}

function cargarDatos() {
    const savedPerfil = localStorage.getItem('meditrack_perfil');
    if (savedPerfil) {
        perfil = JSON.parse(savedPerfil);
    }

    const savedMedicamentos = localStorage.getItem('meditrack_medicamentos');
    if (savedMedicamentos) {
        medicamentos = JSON.parse(savedMedicamentos);
    }

    const savedAlarmas = localStorage.getItem('meditrack_alarmas');
    if (savedAlarmas) {
        alarmasActivas = JSON.parse(savedAlarmas);
    }

    const savedHistorial = localStorage.getItem('meditrack_historial');
    if (savedHistorial) {
        historialTomas = JSON.parse(savedHistorial);
    }
}

function guardarDatos() {
    localStorage.setItem('meditrack_perfil', JSON.stringify(perfil));
    localStorage.setItem('meditrack_medicamentos', JSON.stringify(medicamentos));
    localStorage.setItem('meditrack_alarmas', JSON.stringify(alarmasActivas));
    localStorage.setItem('meditrack_historial', JSON.stringify(historialTomas));
}

function guardarYActualizar() {
    guardarDatos();
    renderMedicamentos();
    actualizarRecordatorios();
    renderHistorial();
}

// ============ PERFIL ============
if (registroForm) {
    registroForm.addEventListener('submit', (e) => {
        e.preventDefault();
        perfil = {
            paciente: {
                nombre: document.getElementById('pacienteNombre').value,
                telefono: document.getElementById('pacienteTelefono').value || 'No registrado'
            },
            contacto: {
                nombre: document.getElementById('contactoNombre').value,
                telefono: document.getElementById('contactoTelefono').value
            },
            registrado: true
        };
        guardarDatos();
        mostrarPerfilInfo();
        showToast(`✅ Perfil guardado. Contacto: ${perfil.contacto.nombre}`);
        switchSection('recordatorios');
        renderMedicamentos();
        actualizarRecordatorios();
        iniciarVerificacionAlarmas();
    });
}

function mostrarPerfilInfo() {
    const infoDiv = document.getElementById('perfilInfo');
    if (infoDiv && perfil.registrado) {
        infoDiv.innerHTML = `
            <p><strong>🧑 Paciente:</strong> ${perfil.paciente.nombre}</p>
            <p><strong>📞 Teléfono:</strong> ${perfil.paciente.telefono}</p>
            <p><strong>👥 Contacto de seguimiento:</strong> ${perfil.contacto.nombre}</p>
            <p><strong>📱 Contacto teléfono:</strong> ${perfil.contacto.telefono}</p>
        `;
    }
}

// ============ MEDICAMENTOS ============
function agregarMedicamento(event) {
    event.preventDefault();

    const nombre = document.getElementById('medNombre').value.trim();
    const dosis = document.getElementById('medDosis').value.trim();
    const dosisPorDia = parseInt(document.getElementById('medDosisPorDia').value);
    const frecuenciaDias = parseInt(document.getElementById('medFrecuenciaDias').value);
    const horariosStr = document.getElementById('medHorarios').value;
    const diasSeleccionados = Array.from(document.querySelectorAll('.dias-checkbox input:checked'))
        .map(cb => parseInt(cb.value));

    if (!nombre || !dosis || !horariosStr) {
        showToast('❌ Por favor completa todos los campos');
        return;
    }

    const horarios = horariosStr.split(',').map(h => h.trim());
    if (horarios.length !== dosisPorDia) {
        showToast(`⚠️ Debes ingresar exactamente ${dosisPorDia} horario(s) separados por coma`);
        return;
    }

    const nuevoMed = {
        id: Date.now(),
        nombre: nombre,
        dosis: dosis,
        dosisPorDia: dosisPorDia,
        frecuenciaDias: frecuenciaDias,
        diasEspecificos: diasSeleccionados,
        horarios: horarios,
        activo: true,
        fechaCreacion: new Date().toISOString()
    };

    medicamentos.push(nuevoMed);
    guardarYActualizar();
    cerrarModal();
    showToast(`✅ Medicamento "${nombre}" agregado correctamente`);
}

function renderMedicamentos() {
    if (!medicamentosGrid) return;
    medicamentosGrid.innerHTML = '';

    if (medicamentos.length === 0) {
        medicamentosGrid.innerHTML = '<div class="empty-state">💊 No hay medicamentos registrados. Agrega uno nuevo.</div>';
        return;
    }

    medicamentos.forEach(med => {
        const card = document.createElement('div');
        card.className = 'medicamento-card';
        card.innerHTML = `
            <div class="card-header">
                <h3>💊 ${escapeHtml(med.nombre)}</h3>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span class="badge-dose">📦 ${escapeHtml(med.dosis)}</span>
                    <span class="badge-time">🕒 ${med.dosisPorDia} dosis/día</span>
                </div>
                <div class="info-row">
                    <span>⏰ Horarios: ${med.horarios.join(', ')}</span>
                </div>
                <div class="info-row">
                    <span>📅 Frecuencia: ${med.frecuenciaDias === 1 ? 'Diario' : `Cada ${med.frecuenciaDias} días`}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-delete" data-id="${med.id}">🗑 Eliminar</button>
                </div>
            </div>
        `;
        medicamentosGrid.appendChild(card);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = parseInt(btn.dataset.id);
            medicamentos = medicamentos.filter(m => m.id !== id);
            // Eliminar alarmas asociadas
            alarmasActivas = alarmasActivas.filter(a => a.medicamentoId !== id);
            guardarYActualizar();
            showToast('🗑 Medicamento eliminado');
        });
    });
}

// ============ RECORDATORIOS Y ALARMAS ============
function debeTomarHoy(med) {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const inicio = new Date(med.fechaCreacion);
    const diasDesdeCreacion = Math.floor((hoy - inicio) / (1000 * 60 * 60 * 24));

    if (med.diasEspecificos && med.diasEspecificos.length > 0) {
        return med.diasEspecificos.includes(diaSemana);
    } else {
        return diasDesdeCreacion % med.frecuenciaDias === 0;
    }
}

function obtenerDosisPendientesHoy() {
    let pendientes = [];
    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();

    medicamentos.forEach(med => {
        if (!debeTomarHoy(med)) return;

        med.horarios.forEach(horario => {
            const [hora, minuto] = horario.split(':').map(Number);
            const yaPaso = (hora < horaActual) || (hora === horaActual && minuto < minutoActual);
            const yaTomado = historialTomas.some(h =>
                h.medicamentoId === med.id &&
                h.horario === horario &&
                new Date(h.fecha).toDateString() === new Date().toDateString()
            );

            if (!yaPaso && !yaTomado) {
                pendientes.push({
                    medicamentoId: med.id,
                    nombre: med.nombre,
                    dosis: med.dosis,
                    horario: horario
                });
            }
        });
    });

    pendientes.sort((a, b) => a.horario.localeCompare(b.horario));
    return pendientes;
}

function actualizarRecordatorios() {
    if (!recordatoriosGrid) return;

    const pendientes = obtenerDosisPendientesHoy();
    const alarmas = alarmasActivas.filter(a => !a.apagada);

    if (pendientes.length === 0 && alarmas.length === 0) {
        recordatoriosGrid.innerHTML = '<div class="empty-state">✅ No hay dosis pendientes para hoy</div>';
        return;
    }

    recordatoriosGrid.innerHTML = '';

    // Mostrar alarmas activas primero
    alarmas.forEach(alarma => {
        const med = medicamentos.find(m => m.id === alarma.medicamentoId);
        if (!med) return;

        const card = document.createElement('div');
        card.className = 'recordatorio-card urgente';
        card.innerHTML = `
            <div class="card-header">
                <h3>🔔 ¡ALARMA ACTIVA! ${escapeHtml(med.nombre)}</h3>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span class="badge-time">⏰ ${alarma.horario}</span>
                    <span class="badge-dose">💊 ${escapeHtml(med.dosis)}</span>
                </div>
                <div class="info-row">
                    <span>⚠️ <strong style="color:#fca5a5;">¡ES HORA DE TOMAR TU MEDICAMENTO!</strong></span>
                </div>
                <div class="card-actions">
                    <button class="btn-tomar-alarma" data-id="${alarma.id}" data-med="${med.id}" data-horario="${alarma.horario}" data-nombre="${med.nombre}" data-dosis="${med.dosis}">💊 Marcar como tomado</button>
                </div>
            </div>
        `;
        recordatoriosGrid.appendChild(card);
    });

    // Mostrar dosis pendientes sin alarma activa
    pendientes.forEach(dosis => {
        const tieneAlarmaActiva = alarmas.some(a => a.medicamentoId === dosis.medicamentoId && a.horario === dosis.horario);
        if (tieneAlarmaActiva) return;

        const card = document.createElement('div');
        card.className = 'recordatorio-card';
        card.innerHTML = `
            <div class="card-header">
                <h3>🔔 ${escapeHtml(dosis.nombre)}</h3>
            </div>
            <div class="card-body">
                <div class="info-row">
                    <span class="badge-time">⏰ ${dosis.horario}</span>
                    <span class="badge-dose">💊 ${escapeHtml(dosis.dosis)}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-tomar" data-med="${dosis.medicamentoId}" data-horario="${dosis.horario}" data-nombre="${dosis.nombre}" data-dosis="${dosis.dosis}">💊 Marcar como tomado</button>
                </div>
            </div>
        `;
        recordatoriosGrid.appendChild(card);
    });

    // Eventos para botones
    document.querySelectorAll('.btn-tomar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const medId = parseInt(btn.dataset.med);
            const horario = btn.dataset.horario;
            const nombre = btn.dataset.nombre;
            const dosis = btn.dataset.dosis;
            marcarComoTomado(medId, horario, nombre, dosis, false);
        });
    });

    document.querySelectorAll('.btn-tomar-alarma').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const alarmaId = parseInt(btn.dataset.id);
            const medId = parseInt(btn.dataset.med);
            const horario = btn.dataset.horario;
            const nombre = btn.dataset.nombre;
            const dosis = btn.dataset.dosis;
            marcarComoTomado(medId, horario, nombre, dosis, true, alarmaId);
        });
    });
}

function iniciarVerificacionAlarmas() {
    if (intervalVerificacion) clearInterval(intervalVerificacion);

    // Verificar cada minuto
    intervalVerificacion = setInterval(() => {
        verificarYDispararAlarmas();
    }, 60000);

    verificarYDispararAlarmas(); // Verificar inmediatamente
}

function verificarYDispararAlarmas() {
    if (!perfil.registrado) return;

    const ahora = new Date();
    const horaActual = ahora.getHours();
    const minutoActual = ahora.getMinutes();
    const horaStr = `${horaActual.toString().padStart(2, '0')}:${minutoActual.toString().padStart(2, '0')}`;

    const pendientes = obtenerDosisPendientesHoy();

    pendientes.forEach(dosis => {
        // Verificar si es hora de esta dosis
        if (dosis.horario === horaStr) {
            // Verificar si ya hay una alarma activa para esta dosis
            const alarmaExistente = alarmasActivas.find(a =>
                a.medicamentoId === dosis.medicamentoId &&
                a.horario === dosis.horario &&
                !a.apagada
            );

            if (!alarmaExistente) {
                // Crear nueva alarma
                const nuevaAlarma = {
                    id: Date.now(),
                    medicamentoId: dosis.medicamentoId,
                    horario: dosis.horario,
                    nombre: dosis.nombre,
                    dosis: dosis.dosis,
                    activada: new Date().toISOString(),
                    apagada: false
                };
                alarmasActivas.push(nuevaAlarma);
                guardarDatos();
                actualizarRecordatorios();

                // Mostrar modal de alarma
                mostrarAlarma(nuevaAlarma);

                // Enviar notificación al contacto
                enviarNotificacionContacto({
                    tipo: 'ALARMA',
                    mensaje: `🔔 ALARMA DE MEDICAMENTO: ${perfil.paciente.nombre} debe tomar ${dosis.nombre} (${dosis.dosis}) a las ${dosis.horario}. Por favor recordarle.`
                });
            }
        }
    });
}

function mostrarAlarma(alarma) {
    if (alarmaMostrando) return;
    alarmaMostrando = alarma;

    const med = medicamentos.find(m => m.id === alarma.medicamentoId);
    if (!med) return;

    const alarmaInfo = document.getElementById('alarmaInfo');
    if (alarmaInfo) {
        alarmaInfo.innerHTML = `
            <p><strong>💊 Medicamento:</strong> ${escapeHtml(med.nombre)}</p>
            <p><strong>💉 Dosis:</strong> ${escapeHtml(med.dosis)}</p>
            <p><strong>⏰ Hora programada:</strong> ${alarma.horario}</p>
            <p><strong>👤 Paciente:</strong> ${perfil.paciente.nombre}</p>
        `;
    }

    if (alarmaModal) {
        alarmaModal.classList.add('active');
    }

    // Reproducir sonido (si el usuario lo permite)
    try {
        const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBzb3VuZCBub3QgYXZhaWxhYmxl');
        audio.play().catch(e => console.log('Audio no soportado'));
    } catch(e) {}

    // Auto-cerrar después de 2 minutos si no se apaga
    if (alarmaTimeoutRef) clearTimeout(alarmaTimeoutRef);
    alarmaTimeoutRef = setTimeout(() => {
        if (alarmaModal && alarmaModal.classList.contains('active')) {
            // Posponer automáticamente
            posponerAlarma();
        }
    }, 120000);
}

function apagarAlarma() {
    if (!alarmaMostrando) return;

    const ahora = new Date();
    const horaApagado = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;

    // Marcar como tomado
    marcarComoTomado(
        alarmaMostrando.medicamentoId,
        alarmaMostrando.horario,
        alarmaMostrando.nombre,
        alarmaMostrando.dosis,
        true,
        alarmaMostrando.id
    );

    if (alarmaModal) alarmaModal.classList.remove('active');
    if (alarmaTimeoutRef) clearTimeout(alarmaTimeoutRef);
    alarmaMostrando = null;
}

function posponerAlarma() {
    if (!alarmaMostrando) return;

    // Eliminar la alarma actual
    alarmasActivas = alarmasActivas.filter(a => a.id !== alarmaMostrando.id);
    guardarDatos();

    if (alarmaModal) alarmaModal.classList.remove('active');
    if (alarmaTimeoutRef) clearTimeout(alarmaTimeoutRef);

    showToast('⏰ Alarma pospuesta. Se volverá a activar en 5 minutos');

    // Programar nueva alarma en 5 minutos
    setTimeout(() => {
        verificarYDispararAlarmas();
    }, 300000); // 5 minutos

    alarmaMostrando = null;
}

function marcarComoTomado(medicamentoId, horario, nombre, dosis, esAlarma = false, alarmaId = null) {
    const ahora = new Date();
    const horaTomado = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}`;

    // Registrar en historial
    const registro = {
        id: Date.now(),
        medicamentoId: medicamentoId,
        nombre: nombre,
        dosis: dosis,
        horarioProgramado: horario,
        horarioTomado: horaTomado,
        fecha: ahora.toISOString(),
        paciente: perfil.paciente.nombre
    };
    historialTomas.unshift(registro);

    // Limitar historial a 100 registros
    if (historialTomas.length > 100) historialTomas.pop();

    // Eliminar alarma si existe
    if (alarmaId) {
        alarmasActivas = alarmasActivas.filter(a => a.id !== alarmaId);
    } else {
        alarmasActivas = alarmasActivas.filter(a =>
            !(a.medicamentoId === medicamentoId && a.horario === horario)
        );
    }

    guardarDatos();

    // Enviar notificación al contacto
    enviarNotificacionContacto({
        tipo: 'TOMA_REGISTRADA',
        mensaje: `✅ ${perfil.paciente.nombre} ha tomado su medicamento ${nombre} (${dosis}) programado para las ${horario}. Se tomó a las ${horaTomado}.`
    });

    actualizarRecordatorios();
    renderHistorial();

    showToast(`✅ Registrado: ${nombre} tomado a las ${horaTomado}`);

    // Cerrar modal si estaba abierto
    if (alarmaModal && alarmaModal.classList.contains('active')) {
        alarmaModal.classList.remove('active');
        if (alarmaTimeoutRef) clearTimeout(alarmaTimeoutRef);
        alarmaMostrando = null;
    }
}

function enviarNotificacionContacto(notificacion) {
    // Simular envío de SMS/notificación al contacto
    console.log('📱 NOTIFICACIÓN ENVIADA AL CONTACTO:', {
        contacto: perfil.contacto.nombre,
        telefono: perfil.contacto.telefono,
        ...notificacion
    });

    // Mostrar en toast que se envió notificación
    showToast(`📱 Notificación enviada a ${perfil.contacto.nombre}`);

    // Guardar en historial de notificaciones
    const notifRegistro = {
        id: Date.now(),
        contacto: perfil.contacto.nombre,
        telefono: perfil.contacto.telefono,
        ...notificacion,
        fecha: new Date().toISOString()
    };

    let notificacionesEnviadas = JSON.parse(localStorage.getItem('meditrack_notificaciones') || '[]');
    notificacionesEnviadas.unshift(notifRegistro);
    if (notificacionesEnviadas.length > 50) notificacionesEnviadas.pop();
    localStorage.setItem('meditrack_notificaciones', JSON.stringify(notificacionesEnviadas));
}

// ============ HISTORIAL ============
function renderHistorial() {
    if (!historialList) return;

    if (historialTomas.length === 0) {
        historialList.innerHTML = '<p class="empty-state">📭 No hay historial de tomas registrado</p>';
        return;
    }

    historialList.innerHTML = '';
    historialTomas.slice(0, 30).forEach(registro => {
        const fecha = new Date(registro.fecha);
        const fechaStr = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()} ${registro.horarioTomado}`;

        const item = document.createElement('div');
        item.className = 'historial-item';
        item.innerHTML = `
            <strong>💊 ${escapeHtml(registro.nombre)}</strong><br>
            📦 Dosis: ${escapeHtml(registro.dosis)}<br>
            ⏰ Programado: ${registro.horarioProgramado} | ✅ Tomado: ${registro.horarioTomado}<br>
            📅 Fecha: ${fechaStr}<br>
            👤 Paciente: ${escapeHtml(registro.paciente)}
        `;
        historialList.appendChild(item);
    });
}

// ============ MODAL ============
function setupEventListeners() {
    if (addRecordatorioBtn) {
        addRecordatorioBtn.addEventListener('click', () => abrirModal('medicamento'));
    }
    if (addMedicamentoBtn) {
        addMedicamentoBtn.addEventListener('click', () => abrirModal('medicamento'));
    }
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', cerrarModal);
    }
    if (addForm) {
        addForm.addEventListener('submit', agregarMedicamento);
    }
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) cerrarModal();
        });
    }
}

function abrirModal(tipo) {
    if (modalOverlay) {
        document.getElementById('medNombre').value = '';
        document.getElementById('medDosis').value = '';
        document.getElementById('medDosisPorDia').value = '2';
        document.getElementById('medFrecuenciaDias').value = '1';
        document.getElementById('medHorarios').value = '';
        document.querySelectorAll('.dias-checkbox input').forEach(cb => cb.checked = false);
        modalOverlay.classList.add('active');
    }
}

function cerrarModal() {
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
    }
}

// ============ UTILIDADES ============
function showToast(message) {
    if (toastMsg) {
        toastMsg.textContent = message;
        toastMsg.classList.add('show');
        setTimeout(() => {
            toastMsg.classList.remove('show');
        }, 3000);
    } else {
        alert(message);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ============ PANNEAU (números 1-1356) ============
function generatePanneauNumbers() {
    const container = document.getElementById('panneauNumbersGrid');
    if (!container) return;
    container.innerHTML = '';
    const total = 1356;
    for (let i = 1; i <= total; i++) {
        const tile = document.createElement('div');
        tile.className = 'num-tile';
        tile.textContent = i;
        if (i % 47 === 0 || i === 1000 || i === 777) {
            tile.classList.add('special');
        }
        tile.addEventListener('click', () => {
            showToast(`🔎 Lote #${i} | Código de referencia médica activo`);
        });
        container.appendChild(tile);
    }
    const totalDisplay = document.getElementById('totalCountDisplay');
    if (totalDisplay) totalDisplay.innerText = total;
}

function setupPanneauSearch() {
    const searchBtn = document.getElementById('panneauSearchBtn');
    const searchInput = document.getElementById('panneauSearchInput');
    if (!searchBtn) return;
    searchBtn.addEventListener('click', () => {
        let val = parseInt(searchInput.value);
        if (isNaN(val) || val < 1 || val > 1356) {
            showToast('⚠️ Ingrese número entre 1 y 1356');
            return;
        }
        const tiles = document.querySelectorAll('.num-tile');
        let found = null;
        for (let tile of tiles) {
            if (parseInt(tile.textContent) === val) {
                found = tile;
                break;
            }
        }
        if (found) {
            found.scrollIntoView({ behavior: 'smooth', block: 'center' });
            found.style.transform = 'scale(1.2)';
            found.style.backgroundColor = '#1e3a8a';
            setTimeout(() => {
                found.style.transform = '';
                found.style.backgroundColor = '';
            }, 600);
            showToast(`✅ Lote ${val} localizado`);
        } else {
            showToast(`❌ Lote ${val} no encontrado`);
        }
    });

}
// De tu archivo script.js - ¡Esto es lo que necesitas!
let perfil = {
    paciente: { nombre: '', telefono: '' },
    contacto: { nombre: '', telefono: '' },  // ← ¡Aquí está el contacto!
    registrado: false
};
function enviarNotificacionContacto(notificacion) {
    console.log('📱 NOTIFICACIÓN ENVIADA AL CONTACTO:', {
        contacto: perfil.contacto.nombre,
        telefono: perfil.contacto.telefono,
        ...notificacion
    });
}
// Inicializar todo
generatePanneauNumbers();
setupPanneauSearch();
init();
