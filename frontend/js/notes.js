document.addEventListener("DOMContentLoaded", async function () {
  if (!window.OneSpaceAuth.requireAuth()) return;

  const workspaceId = window.OneSpaceUtils.getQueryParam("workspace_id");
  if (!workspaceId) {
    window.location.replace("workspaces.html");
    return;
  }

  document.querySelectorAll("[data-nav]").forEach(function (link) {
    const page = link.getAttribute("data-nav");
    link.href = `${page}.html?workspace_id=${encodeURIComponent(workspaceId)}`;
  });
  document.getElementById("dashboardLink").href = `dashboard.html?workspace_id=${encodeURIComponent(workspaceId)}`;
  document.getElementById("backDashboard").href = `dashboard.html?workspace_id=${encodeURIComponent(workspaceId)}`;

  const notesContainer = document.getElementById("notesContainer");
  const notesEmpty = document.getElementById("notesEmpty");
  const addNoteBtn = document.getElementById("addNoteBtn");
  const emptyAddNoteBtn = document.getElementById("emptyAddNoteBtn");
  const noteModalEl = document.getElementById("noteModal");
  const noteModal = new bootstrap.Modal(noteModalEl);
  const noteForm = document.getElementById("noteForm");
  const noteIdInput = document.getElementById("noteId");
  const noteTitleInput = document.getElementById("noteTitle");
  const noteBodyInput = document.getElementById("noteBody");
  const noteSubmit = document.getElementById("noteSubmit");
  const noteBtnText = noteSubmit.querySelector(".btn-text");
  const noteBtnLoading = noteSubmit.querySelector(".btn-loading");
  const modalLabel = document.getElementById("noteModalLabel");

  let allNotes = [];

  async function loadNotes() {
    try {
      allNotes = await window.OneSpaceAPI.getNotes(workspaceId);
      renderNotes();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to load notes");
    }
  }

  function renderNotes() {
    if (!allNotes.length) {
      notesContainer.innerHTML = "";
      notesEmpty.classList.remove("d-none");
      notesEmpty.classList.remove("hidden");
      return;
    }
    notesEmpty.classList.add("d-none");
    notesEmpty.classList.add("hidden");
    notesContainer.innerHTML = allNotes.map(function (n) {
      const bodyText = n.body || "";
      const preview = window.OneSpaceUtils.escapeHtml(bodyText).substring(0, 200) + (bodyText.length > 200 ? "…" : "");
      return `
        <div class="card bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div class="card-body p-lg flex flex-col flex-grow">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${window.OneSpaceUtils.escapeHtml(n.title)}</h5>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-secondary edit-btn" data-id="${n.id}" aria-label="Edit note">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-outline-danger delete-btn" data-id="${n.id}" aria-label="Delete note">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <p class="card-text text-muted small mb-1">${preview}</p>
            <small class="text-muted">Updated ${window.OneSpaceUtils.formatRelativeTime(n.updated_at)}</small>
          </div>
        </div>
      `;
    }).join("");

    notesContainer.querySelectorAll(".edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditModal(this.dataset.id); });
    });
    notesContainer.querySelectorAll(".delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteNote(this.dataset.id); });
    });
  }

  function openAddModal() {
    noteForm.reset();
    noteForm.classList.remove("was-validated");
    noteIdInput.value = "";
    modalLabel.textContent = "Add Note";
    noteModal.show();
  }

  function openEditModal(noteId) {
    const note = allNotes.find(function (n) { return n.id === noteId; });
    if (!note) return;
    noteForm.reset();
    noteForm.classList.remove("was-validated");
    noteIdInput.value = note.id;
    noteTitleInput.value = note.title || "";
    noteBodyInput.value = note.body || "";
    modalLabel.textContent = "Edit Note";
    noteModal.show();
  }

  noteForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!noteForm.checkValidity()) {
      noteForm.classList.add("was-validated");
      return;
    }

    setSubmitLoading(true);
    const data = {
      title: noteTitleInput.value.trim(),
      body: noteBodyInput.value.trim()
    };

    try {
      if (noteIdInput.value) {
        await window.OneSpaceAPI.updateNote(workspaceId, noteIdInput.value, data);
        window.OneSpaceUtils.showSuccess("Note updated");
      } else {
        await window.OneSpaceAPI.createNote(workspaceId, data);
        window.OneSpaceUtils.showSuccess("Note created");
      }
      noteModal.hide();
      loadNotes();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  });

  async function deleteNote(noteId) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    try {
      await window.OneSpaceAPI.deleteNote(workspaceId, noteId);
      window.OneSpaceUtils.showSuccess("Note deleted");
      loadNotes();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    }
  }

  function setSubmitLoading(isLoading) {
    noteSubmit.disabled = isLoading;
    noteBtnText.classList.toggle("d-none", isLoading);
    noteBtnLoading.classList.toggle("d-none", !isLoading);
  }

  addNoteBtn.addEventListener("click", openAddModal);
  emptyAddNoteBtn.addEventListener("click", openAddModal);

  noteModalEl.addEventListener("hidden.bs.modal", function () {
    noteForm.reset();
    noteForm.classList.remove("was-validated");
  });

  loadNotes();
});