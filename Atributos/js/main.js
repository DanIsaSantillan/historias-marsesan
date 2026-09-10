/* ==========================================================
   Blog de Historias de MarseSan - Lógica Principal (main.js)
   ========================================================== */

import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let historiasData = [];
let universosLista = [];

document.addEventListener('DOMContentLoaded', async () => {
  await cargarHistoriasFirestore();
  configurarBuscadorYFiltros();
  configurarModoAdmin();
});

// --- 1. CARGA DE HISTORIAS DESDE FIRESTORE ---
async function cargarHistoriasFirestore() {
  try {
    const q = query(collection(db, "historias"), orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);

    historiasData = [];
    querySnapshot.forEach((doc) => {
      historiasData.push({
        id: doc.id,
        ...doc.data()
      });
    });

    extraerUniversosYRenderizar();
    renderizarTarjetas(historiasData);
  } catch (error) {
    console.error('Error al cargar historias desde Firestore:', error);
  }
}

// --- 2. GENERACIÓN DINÁMICA DE BOTONES DE FILTRO ---
function extraerUniversosYRenderizar() {
  const universosUnicos = [...new Set(historiasData.map(h => h.universo))]
    .filter(u => u !== "Ideas Random" && u !== "Independiente");

  universosLista = universosUnicos;
  const container = document.getElementById('universeFiltersContainer');

  if (!container) return;

  document.querySelectorAll('.btn-universe-dynamic').forEach(btn => btn.remove());

  universosLista.forEach((universo, index) => {
    const idUnico = `U${index + 1}`;

    const btn = document.createElement('button');
    btn.id = idUnico;
    btn.className = 'btn btn-sm btn-outline-light btn-filter btn-universe-dynamic text-start text-nowrap';
    btn.setAttribute('data-filter', universo);
    btn.innerHTML = `<i class="bi bi-stars me-1"></i>${universo}`;
    btn.addEventListener('click', () => filtrarPorUniverso(universo, btn));

    container.appendChild(btn);
  });
}

// --- 3. RENDERIZADO DE TARJETAS DE HISTORIAS ---
function renderizarTarjetas(historias) {
  const grid = document.getElementById('storiesGrid');
  if (!grid) return;

  grid.innerHTML = '';

  if (historias.length === 0) {
    grid.innerHTML = `<div class="col-12 text-center text-muted py-5 font-artistic fs-4">No se encontraron historias en esta categoría.</div>`;
    return;
  }

  historias.forEach(story => {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4 story-card';
    col.innerHTML = `
      <div class="card bg-dark text-white border-secondary card-hover h-100 shadow-sm">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-primary font-artistic">${story.universo || 'Sin categoría'}</span>
            <small class="text-white-50" style="font-size: 0.75rem;">${story.fecha || ''}</small>
          </div>
          <h5 class="card-title font-artistic text-light fs-4">${story.titulo || 'Sin título'}</h5>
          <p class="card-text text-white-50 small flex-grow-1">${story.resumen || ''}</p>
          <button class="btn btn-sm btn-outline-light font-artistic mt-3 w-100 btn-read-story" data-id="${story.id}">
            <i class="bi bi-book-half me-1"></i> Leer Historia
          </button>
        </div>
      </div>
    `;
    grid.appendChild(col);
  });

  document.querySelectorAll('.btn-read-story').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      abrirModalLectura(id);
    });
  });
}

// --- 4. FILTRADO Y BÚSQUEDA ---
function configurarBuscadorYFiltros() {
  const searchInput = document.getElementById('searchInput');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const queryStr = e.target.value.toLowerCase().trim();
      const filtradas = historiasData.filter(h => 
        (h.titulo && h.titulo.toLowerCase().includes(queryStr)) || 
        (h.resumen && h.resumen.toLowerCase().includes(queryStr))
      );
      renderizarTarjetas(filtradas);
    });
  }

  document.getElementById('U0')?.addEventListener('click', function() {
    activarBotonFiltro(this);
    renderizarTarjetas(historiasData);
  });

  document.getElementById('U_IDEAS')?.addEventListener('click', function() {
    activarBotonFiltro(this);
    filtrarPorUniverso('Ideas Random', this);
  });
}

function filtrarPorUniverso(universo, btnElement) {
  activarBotonFiltro(btnElement);
  const filtradas = historiasData.filter(h => h.universo === universo);
  renderizarTarjetas(filtradas);
}

function activarBotonFiltro(btnActivo) {
  document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
  if (btnActivo) btnActivo.classList.add('active');
}

// --- 5. MODAL DE LECTURA PÚBLICA ---
function abrirModalLectura(id) {
  const historia = historiasData.find(h => h.id === id);
  if (!historia) return;

  const titleEl = document.getElementById('readerTitle');
  const universeEl = document.getElementById('readerUniverse');
  const contentEl = document.getElementById('readerContent');

  if (titleEl) titleEl.textContent = historia.titulo;
  if (universeEl) universeEl.textContent = historia.universo;
  if (contentEl) contentEl.innerHTML = historia.contenido;

  const modalEl = document.getElementById('readerModal');
  if (modalEl) {
    const readerModal = new bootstrap.Modal(modalEl);
    readerModal.show();
  }
}

// --- 6. ACCESO AL PANEL PRIVADO (TRIPLE CLICK EN PERFIL) ---
function configurarModoAdmin() {
  const profileImg = document.getElementById('profileTrigger');
  
  if (!profileImg) return;

  let clicks = 0;
  let timer = null;

  profileImg.addEventListener('click', () => {
    clicks++;
    if (clicks === 1) {
      timer = setTimeout(() => { clicks = 0; }, 800);
    }
    if (clicks === 3) {
      clearTimeout(timer);
      clicks = 0;
      window.location.href = 'Atributos/admin/index.html';
    }
  });
}