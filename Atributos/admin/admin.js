/* ==========================================================
   Panel de Administración - Lógica de Gestión (admin.js)
   ========================================================== */

import { db } from '../js/firebase-config.js';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

let historiasData = [];
let universosLista = [];
let quillAdmin = null;
let adminModalInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
  inicializarQuillAdmin();
  adminModalInstance = new bootstrap.Modal(document.getElementById('storyAdminModal'));
  
  await cargarHistoriasFirestore();
  configurarEventosAdmin();
});

// Inicializar el editor Quill
function inicializarQuillAdmin() {
  quillAdmin = new Quill('#admin-editor-container', {
    theme: 'snow',
    placeholder: 'Escribe el capítulo o borrador aquí...',
    modules: {
      toolbar: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['clean']
      ]
    }
  });
}

// Cargar historias desde Firestore
async function cargarHistoriasFirestore() {
  try {
    const q = query(collection(db, "historias"), orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);

    historiasData = [];
    querySnapshot.forEach((documento) => {
      historiasData.push({
        id: documento.id,
        ...documento.data()
      });
    });
    
    actualizarUniversos();
    renderizarGridAdmin();
  } catch (error) {
    console.error('Error al cargar la base de datos de Firestore en Admin:', error);
  }
}

// Extraer universos únicos
function actualizarUniversos() {
  const universosUnicos = [...new Set(historiasData.map(h => h.universo))].filter(Boolean);
  universosLista = universosUnicos;

  const select = document.getElementById('adminUniverseSelect');
  select.innerHTML = '';

  if (universosLista.length === 0) {
    const defaultOpt = document.createElement('option');
    defaultOpt.value = "Ideas Random";
    defaultOpt.textContent = "Ideas Random";
    select.appendChild(defaultOpt);
  } else {
    universosLista.forEach(universo => {
      const option = document.createElement('option');
      option.value = universo;
      option.textContent = universo;
      select.appendChild(option);
    });
  }
}

// Renderizar tarjetas en el panel privado
function renderizarGridAdmin() {
  const container = document.getElementById('adminStoriesGrid');
  container.innerHTML = '';

  if (historiasData.length === 0) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-5 font-artistic fs-4">No hay historias registradas en la nube aún.</div>`;
    return;
  }

  historiasData.forEach(story => {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    col.innerHTML = `
      <div class="card bg-dark text-white border-secondary card-hover h-100">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="badge bg-warning text-dark font-artistic">${story.universo || 'Sin categoría'}</span>
            <small class="text-white-50" style="font-size: 0.75rem;">${story.fecha || ''}</small>
          </div>
          <h5 class="card-title font-artistic text-warning fs-4">${story.titulo || 'Sin título'}</h5>
          <p class="card-text text-white-50 small flex-grow-1">${story.resumen || ''}</p>
          <button class="btn btn-sm btn-outline-warning font-artistic mt-3 w-100 btn-edit-story" data-id="${story.id}">
            <i class="bi bi-pencil-square me-1"></i> Editar / Gestionar
          </button>
        </div>
      </div>
    `;
    container.appendChild(col);
  });

  document.querySelectorAll('.btn-edit-story').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      abrirModalEditar(id);
    });
  });
}

// Configuración de botones y eventos de Firestore
function configurarEventosAdmin() {
  const checkNew = document.getElementById('checkNewUniverseAdmin');
  const inputNew = document.getElementById('adminNewUniverseInput');
  const selectUniverse = document.getElementById('adminUniverseSelect');
  const btnOpenCreate = document.getElementById('btnOpenCreateModal');
  const btnSave = document.getElementById('btnSaveAdminStory');
  const btnDelete = document.getElementById('btnDeleteStory');

  checkNew.addEventListener('change', () => {
    if (checkNew.checked) {
      inputNew.classList.remove('d-none');
      selectUniverse.disabled = true;
    } else {
      inputNew.classList.add('d-none');
      selectUniverse.disabled = false;
    }
  });

  btnOpenCreate.addEventListener('click', () => {
    document.getElementById('editingStoryId').value = '';
    document.getElementById('modalAdminTitle').textContent = '✨ Redactar Nueva Historia';
    document.getElementById('adminStoryTitle').value = '';
    inputNew.value = '';
    checkNew.checked = false;
    inputNew.classList.add('d-none');
    selectUniverse.disabled = false;
    quillAdmin.setText('');
    btnDelete.classList.add('d-none');

    adminModalInstance.show();
  });

  // Guardar (Crear o Modificar en Firestore)
  btnSave.addEventListener('click', async () => {
    const storyId = document.getElementById('editingStoryId').value;
    const titulo = document.getElementById('adminStoryTitle').value.trim();
    
    let universo = checkNew.checked ? inputNew.value.trim() : selectUniverse.value;
    const contenidoHTML = quillAdmin.root.innerHTML;

    if (!titulo || !universo || quillAdmin.getText().trim() === '') {
      alert('Por favor, completa el título, universo y contenido.');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    try {
      if (storyId) {
        // Actualizar documento existente
        const docRef = doc(db, "historias", storyId);
        await updateDoc(docRef, {
          titulo: titulo,
          universo: universo,
          contenido: contenidoHTML,
          resumen: quillAdmin.getText().substring(0, 100) + '...'
        });
      } else {
        // Crear nuevo documento
        await addDoc(collection(db, "historias"), {
          titulo: titulo,
          universo: universo,
          fecha: new Date().toISOString().split('T')[0],
          resumen: quillAdmin.getText().substring(0, 100) + '...',
          contenido: contenidoHTML
        });
      }

      await cargarHistoriasFirestore();
      adminModalInstance.hide();
      alert('¡Operación realizada con éxito!');
    } catch (error) {
      console.error('Error al guardar en Firestore:', error);
      alert('Ocurrió un error al intentar guardar.');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Guardar Obra';
    }
  });

  // Eliminar en Firestore
  btnDelete.addEventListener('click', async () => {
    const storyId = document.getElementById('editingStoryId').value;
    if (confirm('¿Estás segura de que deseas eliminar esta historia?')) {
      try {
        await deleteDoc(doc(db, "historias", storyId));
        await cargarHistoriasFirestore();
        adminModalInstance.hide();
      } catch (error) {
        console.error('Error al eliminar de Firestore:', error);
        alert('Ocurrió un error al intentar eliminar.');
      }
    }
  });
}

function abrirModalEditar(id) {
  const story = historiasData.find(h => h.id === id);
  if (!story) return;

  document.getElementById('editingStoryId').value = story.id;
  document.getElementById('modalAdminTitle').textContent = `✏️ Editando: ${story.titulo}`;
  document.getElementById('adminStoryTitle').value = story.titulo;
  
  const selectUniverse = document.getElementById('adminUniverseSelect');
  selectUniverse.value = story.universo;

  quillAdmin.root.innerHTML = story.contenido;
  document.getElementById('btnDeleteStory').classList.remove('d-none');

  adminModalInstance.show();
}