import { db } from '../js/firebase-config.js';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let historiasData = [];
let universosLista = [];
let quillAdmin = null;
let adminModalInstance = null;

const STORAGE_KEY = 'marsesan_admin_token';

// Validar Token de GitHub al cargar
document.addEventListener('DOMContentLoaded', async () => {
  const tieneAcceso = await verificarAccesoToken();
  if (!tieneAcceso) return; // Si falla el token, detiene la carga del panel

  inicializarQuillAdmin();
  
  const modalElement = document.getElementById('storyAdminModal');
  adminModalInstance = new bootstrap.Modal(modalElement);

  // Evitar advertencias de accesibilidad (aria-hidden)
  modalElement.addEventListener('hidden.bs.modal', () => {
    if (document.activeElement) document.activeElement.blur();
  });

  await cargarUniversos();
  await cargarHistoriasFirestore();
  configurarEventosAdmin();
});

// Función para pedir y validar el Token de GitHub
async function verificarAccesoToken() {
  let token = localStorage.getItem(STORAGE_KEY);

  if (!token) {
    token = prompt("🔒 Acceso Privado MarseSan\nPor favor ingresa tu Token de GitHub activo:");
    if (!token) {
      alert("Acceso denegado.");
      window.location.href = "../../index.html";
      return false;
    }
  }

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token ${token}` }
    });

    if (response.ok) {
      localStorage.setItem(STORAGE_KEY, token);
      return true;
    } else {
      alert("El Token de GitHub es inválido o ha expirado.");
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "../../index.html";
      return false;
    }
  } catch (error) {
    console.error("Error al verificar el token:", error);
    alert("Error de conexión al validar el token.");
    window.location.href = "../../index.html";
    return false;
  }
}

// 1. Inicializar el editor Quill
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

// 2. Cargar universos registrados desde Firestore
async function cargarUniversos() {
  const select = document.getElementById('adminUniverseSelect');
  if (!select) return;

  select.innerHTML = '';
  const setUniversos = new Set(["Ideas Random"]);

  try {
    const querySnapshot = await getDocs(collection(db, "universos"));
    querySnapshot.forEach(docSnap => {
      if (docSnap.exists() && docSnap.data().nombre) {
        setUniversos.add(docSnap.data().nombre.trim());
      }
    });
  } catch (error) {
    console.warn('No se pudo cargar la colección de universos (se extraerán de las historias):', error);
  }

  universosLista = Array.from(setUniversos);

  universosLista.forEach(universo => {
    const option = document.createElement('option');
    option.value = universo;
    option.textContent = universo;
    select.appendChild(option);
  });
}

// 3. Cargar historias desde Firestore
async function cargarHistoriasFirestore() {
  try {
    const q = query(collection(db, "historias"), orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);

    historiasData = [];
    querySnapshot.forEach((documento) => {
      const data = documento.data();

      let fechaFormateada = '';
      if (data.fecha && typeof data.fecha.toDate === 'function') {
        fechaFormateada = data.fecha.toDate().toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } else if (typeof data.fecha === 'string') {
        fechaFormateada = data.fecha;
      }

      historiasData.push({
        id: documento.id,
        ...data,
        fechaFormateada
      });
    });
    
    renderizarGridAdmin();
  } catch (error) {
    console.error('Error al cargar historias en Admin:', error);
  }
}

// 4. Renderizar tarjetas en el panel privado
function renderizarGridAdmin() {
  const container = document.getElementById('adminStoriesGrid');
  if (!container) return;

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
            <span class="badge bg-outline-light text-light font-artistic">${story.universo || 'Sin categoría'}</span>
            <small class="text-white-50" style="font-size: 0.75rem;">${story.fechaFormateada || ''}</small>
          </div>
          <h5 class="card-title font-artistic text-light fs-4">${story.titulo || 'Sin título'}</h5>
          <p class="card-text text-white-50 small flex-grow-1">${story.resumen || ''}</p>
          <button class="btn btn-sm btn-outline-light font-artistic mt-3 w-100 btn-edit-story" data-id="${story.id}">
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

// 5. Eventos y lógica de creación / edición
function configurarEventosAdmin() {
  const checkNew = document.getElementById('checkNewUniverseAdmin');
  const inputNew = document.getElementById('adminNewUniverseInput');
  const selectUniverse = document.getElementById('adminUniverseSelect');
  const btnOpenCreate = document.getElementById('btnOpenCreateModal');
  const btnSave = document.getElementById('btnSaveAdminStory');
  const btnDelete = document.getElementById('btnDeleteStory');

  checkNew?.addEventListener('change', () => {
    if (checkNew.checked) {
      inputNew.classList.remove('d-none');
      selectUniverse.disabled = true;
    } else {
      inputNew.classList.add('d-none');
      selectUniverse.disabled = false;
    }
  });

  btnOpenCreate?.addEventListener('click', () => {
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

  // Guardar en Firestore
  btnSave?.addEventListener('click', async () => {
    const storyId = document.getElementById('editingStoryId').value;
    const titulo = document.getElementById('adminStoryTitle').value.trim();
    const esUniversoNuevo = checkNew.checked;
    
    let universo = esUniversoNuevo ? inputNew.value.trim() : selectUniverse.value;
    const contenidoHTML = quillAdmin.root.innerHTML;
    const textoPlano = quillAdmin.getText().trim();

    if (!titulo || !universo || textoPlano === '') {
      alert('Por favor, completa el título, universo y contenido.');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    try {
      // Registrar Universo en la colección 'universos' si se seleccionó la opción de nuevo
      if (esUniversoNuevo) {
        await setDoc(doc(db, "universos", universo), {
          nombre: universo,
          creado: serverTimestamp()
        });
      }

      // Preparar payload de la historia
      const payloadHistoria = {
        titulo: titulo,
        universo: universo,
        resumen: textoPlano.substring(0, 100) + '...',
        contenido: contenidoHTML
      };

      if (storyId) {
        // Editar existente
        await updateDoc(doc(db, "historias", storyId), payloadHistoria);
      } else {
        // Crear nueva historia
        payloadHistoria.fecha = serverTimestamp();
        await addDoc(collection(db, "historias"), payloadHistoria);
      }

      await cargarUniversos();
      await cargarHistoriasFirestore();
      adminModalInstance.hide();
      alert('¡Operación realizada con éxito!');
    } catch (error) {
      console.error('Error al guardar en Firestore:', error);
      alert('Ocurrió un error al intentar guardar. Revisa las reglas de Firestore o la consola.');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Guardar Obra';
    }
  });

  // Eliminar
  btnDelete?.addEventListener('click', async () => {
    const storyId = document.getElementById('editingStoryId').value;
    if (!storyId) return;

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
  const checkNew = document.getElementById('checkNewUniverseAdmin');
  const inputNew = document.getElementById('adminNewUniverseInput');

  checkNew.checked = false;
  inputNew.classList.add('d-none');
  selectUniverse.disabled = false;
  selectUniverse.value = story.universo;

  quillAdmin.root.innerHTML = story.contenido;
  document.getElementById('btnDeleteStory').classList.remove('d-none');

  adminModalInstance.show();
}