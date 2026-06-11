// ===== CONFIGURACIÓN DE FIREBASE =====
const firebaseConfig = {
    apiKey: "AIzaSyAjeUvC7ZIR7WfLDINNEoaU9TanpqxsHAk",
    authDomain: "meditrack-dfccb.firebaseapp.com",
    databaseURL: "https://meditrack-dfccb-default-rtdb.firebaseio.com",
    projectId: "meditrack-dfccb",
    storageBucket: "meditrack-dfccb.firebasestorage.app",
    messagingSenderId: "1097533589516",
    appId: "1:1097533589516:web:6ea67d70486feb83648629"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Servicios globales
const auth = firebase.auth();
const database = firebase.database();

// Verificar conexión
database.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
        console.log('✅ Firebase conectado');
        if (typeof window.showNotification === 'function') {
            window.showNotification('✅ Conectado a Firebase', 'success');
        }
    } else {
        console.log('❌ Firebase desconectado');
    }
});
