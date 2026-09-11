import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let storiesData = [];
let clickCount = 0;
let clickTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initProfileTrigger();
  loadStories();
  initSearchAndFilters();
});

/* --- ACCESO OCULTO A MODO ADMINISTRADOR (3 Clics rápidos) --- */
function initProfileTrigger() {
  const profileImg = document.getElementById('profileTrigger');
  
  if (!profileImg) return;

  profileImg.addEventListener('click', () => {
    clickCount++;

    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 1200);

    // Al llegar a los 3 clics abre el panel de administración
    if (clickCount >= 3) {
      clickCount = 0;
      clearTimeout(clickTimer);
      window.location.href = './admin/index.html';
    }
  });
}

/* --- CARGA DE HISTORIAS DESDE FIRESTORE --- */
async function loadStories() {
  const grid = document.getElementById('storiesGrid');
  if (!grid) return;

  try {
    const querySnapshot = await getDocs(collection(db, "historias"));
    storiesData = [];
    
    querySnapshot.forEach((doc) => {
      storiesData.push({ id: doc.id, ...doc.data() });
    });

    renderUniverses(storiesData);
    renderGrid(storiesData);
  } catch (error) {
    console.error("Error al cargar historias de Firebase:", error);
    grid.innerHTML = `<div class="col-12 text-center text-white-50"><p>Error al cargar las historias.</p></div>`;
  }
}

/* --- RENDERIZAR BOTONES DE UNIVERSOS DINÁMICOS --- */
function renderUniverses(stories) {
  const filterContainer = document.getElementById('universeFilters');
  if (!filterContainer) return;

  const universes = [...new Set(stories.map(s => s.universo || 'Independiente'))];

  let buttonsHTML = `
    <button class="btn btn-sm btn-outline-light active btn-filter text-start text-nowrap" data-filter="all">
      <i class="bi bi-journal-album me-1"></i>Todos los Escritos
    </button>
  `;

  universes.forEach(uni => {
    buttonsHTML += `
      <button class="btn btn-sm btn-outline-light btn-filter text-start text-nowrap" data-filter="${uni}">
        <i class="bi bi-stars me-1"></i>${uni}
      </button>
    `;
  });

  filterContainer.innerHTML = buttonsHTML;
}

/* --- RENDERIZAR Mosaico / CATÁLOGO DE HISTORIAS --- */
function renderGrid(stories) {
  const grid = document.getElementById('storiesGrid');
  if (!grid) return;

  if (stories.length === 0) {
    grid.innerHTML = `<div class="col-12 text-center text-white-50 py-5"><p>No se encontraron historias.</p></div>`;
    return;
  }

  grid.innerHTML = stories.map(story => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = story.contenido || '';
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    const previewText = plainText.substring(0, 120) + (plainText.length > 120 ? '...' : '');

    return `
      <div class="col-12 col-md-6 col-lg-4 story-card">
        <div class="card bg-dark text-white border-secondary card-hover h-100 shadow-sm">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="badge bg-secondary font-artistic">${story.universo || 'Independiente'}</span>
              <small class="text-white-50">${story.fecha || ''}</small>
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

  document.getElementById('readerTitle').textContent = story.titulo || 'Sin título';
  document.getElementById('readerUniverse').textContent = story.universo || 'Independiente';
  document.getElementById('readerContent').innerHTML = story.contenido || '';

  const modal = new bootstrap.Modal(document.getElementById('readerModal'));
  modal.show();
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