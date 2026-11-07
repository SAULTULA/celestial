/* ==================================================================
   CELESTIAL FM 106.7 — Lógica del reproductor
   ================================================================== */

// -------- CONFIGURACIÓN --------
const ZENO_MOUNT = 'mfer4shs398uv';
const STREAM_URL = `https://stream.zeno.fm/${ZENO_MOUNT}`;
const API_URL    = `https://api.zeno.fm/mounts/metadata/subscribe/${ZENO_MOUNT}`;
const ITUNES_API = 'https://itunes.apple.com/search';

// -------- ELEMENTOS DOM --------
const audio        = document.getElementById('audioPlayer');
const btnPlay      = document.getElementById('btnPlay');
const playIcon     = document.getElementById('playIcon');
const vinylDisc    = document.getElementById('vinylDisc');
const vinylCover   = document.getElementById('vinylCover');
const songTitle    = document.getElementById('songTitle');
const songArtist   = document.getElementById('songArtist');
const bgBlur       = document.getElementById('bg-blur');
const visualizer   = document.getElementById('visualizer');
const btnVolume    = document.getElementById('btnVolume');
const volumePop    = document.getElementById('volumePop');
const volumeSlider = document.getElementById('volumeSlider');
const tickerText   = document.getElementById('tickerText');

// -------- ESTADO --------
let isPlaying       = false;
let audioCtx        = null;
let analyser        = null;
let sourceNode      = null;
let currentSongKey  = '';
let barCount        = 0;
let visualizerRAF   = null;
let simStep         = 0;
let sseSource       = null;

// ================================================================
// 1. TICKER DE VERSÍCULOS (cambio diario automático)
// ================================================================
const VERSICULOS = [
  "Juan 3:16 — Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito...",
  "Salmos 23:1 — Jehová es mi pastor; nada me faltará.",
  "Filipenses 4:13 — Todo lo puedo en Cristo que me fortalece.",
  "Proverbios 3:5 — Fíate de Jehová de todo tu corazón...",
  "Isaías 40:31 — Pero los que esperan a Jehová tendrán nuevas fuerzas...",
  "Romanos 8:28 — Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.",
  "Mateo 11:28 — Venid a mí todos los que estáis trabajados y cargados...",
  "Josué 1:9 — Mira que te mando que te esfuerces y seas valiente...",
  "Salmos 46:1 — Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.",
  "Jeremías 29:11 — Porque yo sé los pensamientos que tengo acerca de vosotros...",
  "Salmos 111:10 — El principio de la sabiduría es el temor de Jehová...",
  "Isaías 51:11 — Porque Jehová consolará a Sion; consolará todas sus soledades...",
  "Salmos 34:8 — Gustad, y ved que es bueno Jehová; Dichoso el hombre que confía en él.",
  "Mateo 6:33 — Mas buscad primeramente el reino de Dios y su justicia...",
  "Juan 14:6 — Jesús le dijo: Yo soy el camino, y la verdad, y la vida...",
  "Romanos 12:2 — No os conforméis a este siglo, sino transformaos...",
  "Gálatas 5:22 — Mas el fruto del Espíritu es amor, gozo, paz, paciencia...",
  "Salmos 121:1-2 — Alzaré mis ojos a los montes; ¿De dónde vendrá mi socorro? Mi socorro viene de Jehová...",
  "Proverbios 16:9 — El corazón del hombre piensa su camino; Mas Jehová endereza sus pasos.",
  "Isaías 41:10 — No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios...",
  "Salmos 37:4 — Deléitate asimismo en Jehová, Y él te concederá las peticiones de tu corazón.",
  "Mateo 5:16 — Así alumbre vuestra luz delante de los hombres...",
  "Juan 8:12 — Yo soy la luz del mundo; el que me sigue, no andará en tinieblas...",
  "Salmos 91:1-2 — El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente...",
  "Romanos 15:13 — Y el Dios de esperanza os llene de todo gozo y paz en el creer...",
  "Isaías 26:3 — Tú guardarás en completa paz a aquel cuyo pensamiento en ti persevera...",
  "Salmos 30:5 — Porque un momento será su ira, Pero su favor dura toda la vida...",
  "Proverbios 18:10 — El nombre de Jehová es torre fuerte; A él correrá el justo, y será levantado.",
  "Filipenses 4:6-7 — Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios...",
  "Salmos 119:105 — Lámpara es a mis pies tu palabra, Y lumbre a mi camino.",
  "Mateo 7:7 — Pedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá."
];

function obtenerVersiculoDelDia() {
  const hoy = new Date();
  const inicioAno = new Date(hoy.getFullYear(), 0, 0);
  const diff = hoy - inicioAno;
  const unDia = 1000 * 60 * 60 * 24;
  const diaDelAno = Math.floor(diff / unDia);
  return VERSICULOS[diaDelAno % VERSICULOS.length];
}

(function iniciarTicker() {
  if (tickerText) {
    tickerText.textContent = ' ✝ ' + obtenerVersiculoDelDia() + '   •   ';
  }
})();

// ================================================================
// 2. VISUALIZADOR DE ONDAS
// ================================================================
function initVisualizer() {
  const numBars = 28;
  visualizer.innerHTML = '';
  for (let i = 0; i < numBars; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    visualizer.appendChild(bar);
  }
  barCount = numBars;
}

function animateVisualizer() {
  if (!isPlaying) return;

  const bars = visualizer.querySelectorAll('.bar');
  let hasRealData = false;

  if (analyser) {
    try {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      let sumTotal = 0;
      for (let i = 0; i < dataArray.length; i++) sumTotal += dataArray[i];

      if (sumTotal > 0) {
        hasRealData = true;
        const step = Math.floor(dataArray.length / barCount);
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
          const avg = sum / step;
          bars[i].style.height = Math.max(3, (avg / 255) * 40) + 'px';
        }
      }
    } catch (_) {}
  }

  // Animación armónica continua si Tracking Prevention o CORS restringe el analizador
  if (!hasRealData) {
    simStep += 0.08;
    for (let i = 0; i < barCount; i++) {
      const wave = (Math.sin(simStep + i * 0.45) + Math.cos(simStep * 1.5 + i * 0.25) + 2) / 4;
      const height = Math.max(3, wave * 36);
      if (bars[i]) bars[i].style.height = height + 'px';
    }
  }

  visualizerRAF = requestAnimationFrame(animateVisualizer);
}

function startVisualizer() {
  if (!audioCtx) {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
        sourceNode = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
    } catch (err) {
      console.info('Visualizador en modo simulación armónica (CORS protegido):', err.message);
      analyser = null;
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  if (visualizerRAF) cancelAnimationFrame(visualizerRAF);
  animateVisualizer();
}

function stopVisualizer() {
  if (visualizerRAF) {
    cancelAnimationFrame(visualizerRAF);
    visualizerRAF = null;
  }
  visualizer.querySelectorAll('.bar').forEach(b => b.style.height = '3px');
}

initVisualizer();

// ================================================================
// 3. REPRODUCCIÓN RESILIENTE (PLAY / PAUSA)
// ================================================================
function updatePlayUI(playing) {
  isPlaying = playing;
  btnPlay.classList.remove('loading');

  if (playing) {
    btnPlay.classList.add('playing');
    vinylDisc.classList.add('playing');
    playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    startVisualizer();
    conectarMetadatos();
  } else {
    btnPlay.classList.remove('playing');
    vinylDisc.classList.remove('playing');
    playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    stopVisualizer();
  }
}

async function iniciarAudio() {
  btnPlay.classList.add('loading');
  audio.volume = parseFloat(volumeSlider.value);

  // Asegurar la fuente correcta
  if (!audio.src || !audio.src.includes(ZENO_MOUNT)) {
    audio.src = STREAM_URL;
  }

  try {
    await audio.play();
    updatePlayUI(true);
  } catch (err) {
    console.warn('Primer intento de reproducción falló, activando modo seguro:', err);

    // Si Tracking Prevention o CORS bloquearon la reproducción, se remueve crossorigin
    if (audio.hasAttribute('crossorigin')) {
      audio.removeAttribute('crossorigin');
    }

    // Se reinicia el elemento de audio con el stream directo
    audio.src = STREAM_URL;
    audio.load();

    try {
      await audio.play();
      updatePlayUI(true);
    } catch (errFallback) {
      console.error('No se pudo reproducir la señal de audio:', errFallback);
      btnPlay.classList.remove('loading');
      updatePlayUI(false);
    }
  }
}

btnPlay.addEventListener('click', () => {
  if (isPlaying) {
    audio.pause();
    updatePlayUI(false);
  } else {
    iniciarAudio();
  }
});

// Sincronización de eventos de audio nativos
audio.addEventListener('play', () => updatePlayUI(true));
audio.addEventListener('pause', () => updatePlayUI(false));
audio.addEventListener('waiting', () => btnPlay.classList.add('loading'));
audio.addEventListener('playing', () => {
  btnPlay.classList.remove('loading');
  updatePlayUI(true);
});
audio.addEventListener('error', () => {
  console.warn('Alerta en elemento de audio, reajustando estado');
  btnPlay.classList.remove('loading');
  updatePlayUI(false);
});

// ================================================================
// 4. CONTROL DE VOLUMEN
// ================================================================
btnVolume.addEventListener('click', (e) => {
  e.stopPropagation();
  volumePop.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!volumePop.contains(e.target) && e.target !== btnVolume) {
    volumePop.classList.remove('open');
  }
});

volumeSlider.addEventListener('input', () => {
  audio.volume = parseFloat(volumeSlider.value);
});

// ================================================================
// 5. METADATOS EN TIEMPO REAL ("AHORA SUENA") + CARÁTULA
// ================================================================
function formatearNombreCancion(raw) {
  if (!raw) return { artist: 'Celestial FM 106.7', title: 'Radio Cristiana' };
  let partes = raw.split(' - ');
  if (partes.length >= 2) {
    return { artist: partes[0].trim(), title: partes.slice(1).join(' - ').trim() };
  }
  partes = raw.split('|');
  if (partes.length >= 2) {
    return { artist: partes[0].trim(), title: partes[1].trim() };
  }
  return { artist: 'Celestial FM 106.7', title: raw.trim() };
}

function buscarCaratula(artist, title) {
  const query = encodeURIComponent(`${artist} ${title}`);
  return fetch(`${ITUNES_API}?term=${query}&entity=song&limit=1`)
    .then(r => r.json())
    .then(data => {
      if (data.results && data.results.length > 0) {
        return data.results[0].artworkUrl100.replace('100x100', '600x600');
      }
      return null;
    })
    .catch(() => null);
}

function aplicarMetadatos(raw) {
  if (!raw || raw === currentSongKey) return;
  currentSongKey = raw;

  const { artist, title } = formatearNombreCancion(raw);
  songTitle.textContent  = title  || 'En Vivo';
  songArtist.textContent = artist || 'Celestial FM 106.7';

  buscarCaratula(artist, title).then(coverUrl => {
    if (coverUrl) {
      vinylCover.src = coverUrl;
      bgBlur.style.backgroundImage = `url(${coverUrl})`;
    } else {
      vinylCover.src = 'image/logo.png';
      bgBlur.style.backgroundImage = 'none';
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'Celestial FM 106.7',
      artist: artist || 'Campo Grande, Misiones',
      album: 'Una Radio con Propósito',
      artwork: [
        { src: 'image/logo-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'image/logo-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'logo.png', sizes: '192x192', type: 'image/png' }
      ]
    });
  }
}

function conectarMetadatos() {
  if (sseSource) return;

  if (typeof EventSource !== 'undefined') {
    try {
      sseSource = new EventSource(API_URL);

      sseSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const raw = data.streamTitle || data.currentSong || data.title || '';
          if (raw) aplicarMetadatos(raw);
        } catch (_) {}
      };

      sseSource.onerror = () => {
        // En caso de desconexión momentánea, EventSource reintenta automáticamente
      };
    } catch (e) {
      console.info('Metadatos por EventSource no disponibles:', e);
    }
  }
}

// ================================================================
// 6. MEDIA SESSION API (CONTROLES DEL SISTEMA / BLOQUEO)
// ================================================================
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Celestial FM 106.7',
    artist: 'Campo Grande, Misiones',
    album: 'Una Radio con Propósito',
    artwork: [
      { src: 'image/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'image/logo-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'logo.png', sizes: '192x192', type: 'image/png' }
    ]
  });
  navigator.mediaSession.setActionHandler('play',  () => btnPlay.click());
  navigator.mediaSession.setActionHandler('pause', () => btnPlay.click());
}

// ================================================================
// 7. ATAJOS DE TECLADO
// ================================================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    btnPlay.click();
  }
  if (e.code === 'ArrowUp') {
    e.preventDefault();
    audio.volume = Math.min(1, parseFloat((audio.volume + 0.05).toFixed(2)));
    volumeSlider.value = audio.volume;
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    audio.volume = Math.max(0, parseFloat((audio.volume - 0.05).toFixed(2)));
    volumeSlider.value = audio.volume;
  }
});

// ================================================================
// 8. INICIALIZACIÓN
// ================================================================
audio.volume = parseFloat(volumeSlider.value);
conectarMetadatos();

console.log('🎵 Celestial FM 106.7 — Reproductor listo (Fuente: mfer4shs398uv)');
