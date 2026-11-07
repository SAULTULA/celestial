/* ==================================================================
   CELESTIAL FM 106.7 — PWA (Service Worker + Instalación)
   ================================================================== */

// 1. Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('✅ Service Worker activo para Celestial FM:', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ No se pudo registrar el Service Worker:', err);
      });
  });
}

// 2. Control del evento de instalación nativa (beforeinstallprompt)
let deferredInstallPrompt = null;
const btnInstall = document.getElementById('btnInstall');

// Comprobar si ya está instalada o en modo standalone
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

if (!isStandalone) {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Evita el infobar genérico del navegador
    e.preventDefault();
    // Almacena el evento para dispararlo cuando el usuario presione el botón
    deferredInstallPrompt = e;
    // Muestra el botón de instalación
    if (btnInstall) {
      btnInstall.removeAttribute('hidden');
      btnInstall.style.display = 'flex';
    }
  });

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      // Dispara el prompt nativo
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      console.log('Resultado de instalación:', choiceResult.outcome);
      deferredInstallPrompt = null;
      btnInstall.setAttribute('hidden', '');
      btnInstall.style.display = 'none';
    });
  }

  window.addEventListener('appinstalled', () => {
    console.log('🎉 Celestial FM se instaló con éxito');
    if (btnInstall) {
      btnInstall.setAttribute('hidden', '');
      btnInstall.style.display = 'none';
    }
    deferredInstallPrompt = null;
  });
}
