import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let storiesData = [];
let clickCount = 0;
let clickTimer = null;

// Variables para el Lector de Voz (TTS Público), Diccionario y Posición de Pausa
let synth = window.speechSynthesis;
let lecturaUtterance = null;
let diccionarioIgnorados = JSON.parse(localStorage.getItem('marsesan_diccionario_ignorados')) || ["Latias", "Latios", "Amigurumi"];
let charIndexPausa = 0; // Guarda la posición de la letra donde se pausó

document.addEventListener('DOMContentLoaded', () => {
  initProfileTrigger();
  loadData();
  initSearchAndFilters();
  initPublicTTSControls();
});

/* --- FORMATER FECHAS DE FIRESTORE --- */
function formatDate(dateValue) {
  if (!dateValue) return '';

  try {
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } else if (dateValue.seconds) {
      return new Date(dateValue.seconds * 1000).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch (e) {
    console.warn("Error formateando fecha:", e);
  }

  return dateValue;
}

/* --- ACCESO OCULTO A MODO ADMINISTRADOR (3 Clics rápidos) --- */
function initProfileTrigger() {
  const profileImg = document.getElementById('profileTrigger');
  if (!profileImg) return;

  profileImg.addEventListener('click', () => {
    clickCount++;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clickCount = 0; }, 1200);

    if (clickCount >= 3) {
      clickCount = 0;
      clearTimeout(clickTimer);
      window.location.href = 'Atributos/admin/index.html';
    }
  });
}

/* --- CARGA CONJUNTA DE HISTORIAS Y UNIVERSOS DESDE FIRESTORE --- */
async function loadData() {
  const grid = document.getElementById('storiesGrid');
  if (!grid) return;

  try {
    const querySnapshot = await getDocs(collection(db, "historias"));
    storiesData = [];
    
    querySnapshot.forEach((doc) => {
      storiesData.push({ id: doc.id, ...doc.data() });
    });

    await loadUniverses();
    renderGrid(storiesData);

  } catch (error) {
    console.error("Error al cargar los datos desde Firebase:", error);
    grid.innerHTML = `<div class="col-12 text-center text-white-50"><p>Error al cargar las historias.</p></div>`;
  }
}

/* --- CARGAR BOTONES DE UNIVERSOS --- */
async function loadUniverses() {
  const filterContainer = document.getElementById('universeFilters');
  if (!filterContainer) return;

  let universosNombres = [];

  try {
    const snap = await getDocs(collection(db, "universos"));
    snap.forEach(doc => {
      const data = doc.data();
      if (data.nombre) universosNombres.push(data.nombre);
    });
  } catch (error) {
    console.warn("No se pudo leer la colección de universos directa:", error);
  }

  if (universosNombres.length === 0 && storiesData.length > 0) {
    universosNombres = [...new Set(storiesData.map(s => s.universo).filter(Boolean))];
  }

  let buttonsHTML = `
    <button class="btn btn-sm btn-outline-light active btn-filter text-start text-nowrap" data-filter="all">
      <i class="bi bi-journal-album me-1"></i>Todos los Escritos
    </button>
  `;

  universosNombres.forEach(uni => {
    buttonsHTML += `
      <button class="btn btn-sm btn-outline-light btn-filter text-start text-nowrap mb-1" data-filter="${uni}">
        <i class="bi bi-stars me-1"></i>${uni}
      </button>
    `;
  });

  filterContainer.innerHTML = buttonsHTML;
}

/* --- RENDERIZAR CATÁLOGO DE HISTORIAS --- */
function renderGrid(stories) {
  const grid = document.getElementById('storiesGrid');
  if (!grid) return;

  if (stories.length === 0) {
    grid.innerHTML = `<div class="col-12 text-center text-white-50 py-5"><p>No se encontraron historias guardadas.</p></div>`;
    return;
  }

  grid.innerHTML = stories.map(story => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = story.contenido || '';
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    const previewText = story.resumen || (plainText.substring(0, 120) + (plainText.length > 120 ? '...' : ''));
    
    // Formatear la fecha procesada
    const fechaFormateada = formatDate(story.fecha);

    return `
      <div class="col-12 col-md-6 col-lg-4 story-card">
        <div class="card bg-dark text-white border-secondary card-hover h-100 shadow-sm">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge bg-secondary font-artistic">${story.universo || 'Independiente'}</span>
              <small class="text-white-50">${fechaFormateada}</small>
            </div>
            <h5 class="card-title font-artistic text-white fs-4">${story.titulo || 'Sin título'}</h5>
            <p class="card-text text-white-50 small flex-grow-1">${previewText}</p>
            <button class="btn btn-sm btn-outline-light font-artistic mt-3 w-100 btn-read" data-id="${story.id}">
              <i class="bi bi-book-half me-1"></i> Leer Historia
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.btn-read').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      openReaderModal(id);
    });
  });
}

/* --- ABRIR MODAL DE LECTURA --- */
function openReaderModal(id) {
  const story = storiesData.find(s => s.id === id);
  if (!story) return;

  // Cancelar la lectura previa si se abre una nueva historia
  stopPublicReading();

  document.getElementById('readerTitle').textContent = story.titulo || 'Sin título';
  document.getElementById('readerUniverse').textContent = story.universo || 'Independiente';
  document.getElementById('readerContent').innerHTML = story.contenido || '';

  const readerModalElement = document.getElementById('readerModal');
  const modal = new bootstrap.Modal(readerModalElement);
  
  // Al cerrar el modal se detiene la voz inmediatamente
  readerModalElement.addEventListener('hidden.bs.modal', () => {
    stopPublicReading();
  }, { once: true });

  modal.show();
}

/* --- CONTROLES Y LÓGICA ROBUSTA DE TEXTO A VOZ (PUBLIC TTS) --- */
function initPublicTTSControls() {
  const btnPlay = document.getElementById('btnPlayPublicTTS');
  const btnPause = document.getElementById('btnPausePublicTTS');
  const btnStop = document.getElementById('btnStopPublicTTS');

  // BOTÓN LEER (Inicia siempre desde el principio)
  btnPlay?.addEventListener('click', () => {
    stopPublicReading();
    reproducirDesdePosicion(0);
  });

  // BOTÓN PAUSA / REANUDAR (Funciona como un interruptor)
  btnPause?.addEventListener('click', () => {
    // 1. Si está leyendo activamente -> Pausar
    if (synth.speaking && !synth.paused) {
      synth.pause();
      restablecerBotonPausa(true);
      return;
    }

    // 2. Si estaba pausado -> Reanudar
    if (synth.paused) {
      synth.resume();

      // Si el navegador se traba y no reanuda la voz, forzamos la lectura desde la palabra guardada
      setTimeout(() => {
        if (synth.paused) {
          synth.cancel();
          reproducirDesdePosicion(charIndexPausa);
        }
      }, 200);

      restablecerBotonPausa(false);
      return;
    }

    // 3. Si se detuvo tras la pausa pero guardó la posición previa
    if (!synth.speaking && charIndexPausa > 0) {
      reproducirDesdePosicion(charIndexPausa);
    }
  });

  // BOTÓN DETENER
  btnStop?.addEventListener('click', () => {
    stopPublicReading();
  });
}

function reproducirDesdePosicion(startCharIndex = 0) {
  const readerContent = document.getElementById('readerContent');
  if (!readerContent) return;

  let texto = readerContent.innerText.trim();
  if (!texto) {
    alert("No hay texto para leer en este capítulo.");
    return;
  }

  // Actualizar el diccionario desde localStorage
  diccionarioIgnorados = JSON.parse(localStorage.getItem('marsesan_diccionario_ignorados')) || ["Latias", "Latios", "Amigurumi"];

  // Filtrar palabras ignoradas
  let textoProcesado = texto;
  diccionarioIgnorados.forEach(palabra => {
    const regex = new RegExp(`\\b${palabra}\\b`, 'gi');
    textoProcesado = textoProcesado.replace(regex, '');
  });

  // Recortar el texto para comenzar exactamente donde se pausó
  if (startCharIndex > 0 && startCharIndex < textoProcesado.length) {
    textoProcesado = textoProcesado.substring(startCharIndex);
  } else {
    charIndexPausa = 0;
  }

  lecturaUtterance = new SpeechSynthesisUtterance(textoProcesado);
  lecturaUtterance.lang = 'es-ES';
  lecturaUtterance.rate = 1.0;

  // Registrar en tiempo real por qué palabra va leyendo
  lecturaUtterance.onboundary = (event) => {
    if (event.name === 'word') {
      charIndexPausa = startCharIndex + event.charIndex;
    }
  };

  // Al finalizar la narración completa
  lecturaUtterance.onend = () => {
    charIndexPausa = 0;
    restablecerBotonPausa(false);
  };

  synth.speak(lecturaUtterance);
  restablecerBotonPausa(false);
}

function restablecerBotonPausa(estaPausado) {
  const btnPause = document.getElementById('btnPausePublicTTS');
  if (!btnPause) return;

  if (estaPausado) {
    btnPause.innerHTML = '<i class="bi bi-play-circle-fill"></i> Reanudar';
    btnPause.classList.remove('btn-outline-warning');
    btnPause.classList.add('btn-warning');
  } else {
    btnPause.innerHTML = '<i class="bi bi-pause-fill"></i> Pausa';
    btnPause.classList.remove('btn-warning');
    btnPause.classList.add('btn-outline-warning');
  }
}

function stopPublicReading() {
  charIndexPausa = 0;
  if (synth && (synth.speaking || synth.paused)) {
    synth.cancel();
  }
  restablecerBotonPausa(false);
}

/* --- BÚSQUEDA Y FILTRADO --- */
function initSearchAndFilters() {
  const searchInput = document.getElementById('searchInput');
  const filterContainer = document.getElementById('universeFilters');

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  if (filterContainer) {
    filterContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-filter');
      if (!btn) return;

      filterContainer.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      applyFilters();
    });
  }
}

function applyFilters() {
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const activeFilterBtn = document.querySelector('.btn-filter.active');
  const filterVal = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';

  const filtered = storiesData.filter(story => {
    const matchesSearch = (story.titulo || '').toLowerCase().includes(searchVal) ||
                          (story.contenido || '').toLowerCase().includes(searchVal);
    
    const matchesUniverse = filterVal === 'all' || (story.universo || 'Independiente') === filterVal;

    return matchesSearch && matchesUniverse;
  });

  renderGrid(filtered);
}