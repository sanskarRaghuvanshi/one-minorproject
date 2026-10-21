document.addEventListener("DOMContentLoaded", async function () {
  if (!window.OneSpaceAuth.requireAuth()) return;

  const listContainer = document.getElementById("workspaceList");
  const emptyState = document.getElementById("emptyState");
  const createForm = document.getElementById("createWorkspaceForm");
  const createNameInput = document.getElementById("workspaceName");
  const createDescInput = document.getElementById("workspaceDescription");
  const createSubmit = document.getElementById("createWorkspaceSubmit");
  const createBtnText = createSubmit.querySelector(".btn-text");
  const createBtnLoading = createSubmit.querySelector(".btn-loading");
  const createModalEl = document.getElementById("createWorkspaceModal");
  const createModal = (window.bootstrap && bootstrap.Modal) ? bootstrap.Modal.getOrCreateInstance(createModalEl) : null;

  createForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!createForm.checkValidity()) {
      createForm.classList.add("was-validated");
      return;
    }

    setCreateLoading(true);
    try {
      const workspace = await window.OneSpaceAPI.createWorkspace({
        name: createNameInput.value.trim(),
        description: createDescInput.value.trim()
      });
      window.OneSpaceUtils.showSuccess("Workspace created");
      if (createModal) createModal.hide();
      createForm.reset();
      createForm.classList.remove("was-validated");
      renderWorkspaces();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to create workspace");
    } finally {
      setCreateLoading(false);
    }
  });

  if (createModalEl) {
    createModalEl.addEventListener("hidden.bs.modal", function () {
      createForm.reset();
      createForm.classList.remove("was-validated");
    });
  }

  async function renderWorkspaces() {
    try {
      const workspaces = await window.OneSpaceAPI.getWorkspaces();
      listContainer.innerHTML = "";

      if (!workspaces.length) {
        listContainer.classList.add("d-none");
        emptyState.classList.remove("d-none");
        emptyState.classList.remove("hidden");
        return;
      }

      listContainer.classList.remove("d-none");
      emptyState.classList.add("d-none");

      workspaces.forEach(function (ws) {
        const card = createWorkspaceCard(ws);
        listContainer.appendChild(card);
      });
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to load workspaces");
    }
  }

  function createWorkspaceCard(ws) {
    const col = document.createElement("div");
    col.className = "bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col " + (ws.archived ? "opacity-60" : "");

    const archivedBadge = ws.archived
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm"><span class="material-symbols-outlined text-[14px]">archive</span>Archived</span>'
      : "";

    const updated = window.OneSpaceUtils.formatRelativeTime(ws.updated_at);
    const description = ws.description ? window.OneSpaceUtils.escapeHtml(ws.description) : '<span class="text-muted">No description</span>';

    col.innerHTML = `
      <div class="p-lg flex flex-col flex-grow">
        <div class="flex items-start justify-between gap-sm mb-sm">
          <h5 class="font-headline-sm text-headline-sm text-on-surface flex-grow-1">${window.OneSpaceUtils.escapeHtml(ws.name)}</h5>
          ${archivedBadge}
        </div>
        <p class="text-muted small flex-grow-1 mb-md">${description}</p>
        <div class="flex items-center justify-between pt-md border-t border-outline-variant">
          <span class="text-muted small flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">schedule</span>Updated ${updated}</span>
          <div class="flex gap-sm">
            <button type="button" class="open-btn px-3 py-1.5 rounded-lg border border-primary text-primary font-label-sm text-label-sm hover:bg-primary/5 transition-colors flex items-center gap-1" data-id="${ws.id}" ${ws.archived ? "disabled" : ""} aria-label="Open workspace">
              <span class="material-symbols-outlined text-[16px]">open_in_new</span> Open
            </button>
            <button type="button" class="archive-btn p-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high transition-colors" data-id="${ws.id}" data-archived="${ws.archived}" aria-label="${ws.archived ? "Unarchive" : "Archive"} workspace">
              <span class="material-symbols-outlined text-[18px]">${ws.archived ? "unarchive" : "archive"}</span>
            </button>
            <button type="button" class="delete-btn p-1.5 rounded-lg border border-outline-variant text-error hover:bg-error-container/30 transition-colors" data-id="${ws.id}" aria-label="Delete workspace">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;

    col.querySelector(".open-btn").addEventListener("click", function () {
      window.location.href = `dashboard.html?workspace_id=${ws.id}`;
    });

    col.querySelector(".archive-btn").addEventListener("click", async function () {
      const confirmMsg = ws.archived ? "Unarchive this workspace?" : "Archive this workspace? This hides it from the main list but keeps all data.";
      if (!confirm(confirmMsg)) return;

      try {
        if (ws.archived) {
          await window.OneSpaceAPI.updateWorkspace(ws.id, { archived: false });
        } else {
          await window.OneSpaceAPI.archiveWorkspace(ws.id);
        }
        window.OneSpaceUtils.showSuccess(ws.archived ? "Workspace unarchived" : "Workspace archived");
        renderWorkspaces();
      } catch (err) {
        window.OneSpaceUtils.showError(err.message);
      }
    });

    col.querySelector(".delete-btn").addEventListener("click", async function () {
      if (!confirm("Delete this workspace? This will permanently remove all tasks, notes, resources, files, and activity.")) return;

      try {
        await window.OneSpaceAPI.deleteWorkspace(ws.id);
        window.OneSpaceUtils.showSuccess("Workspace deleted");
        renderWorkspaces();
      } catch (err) {
        window.OneSpaceUtils.showError(err.message);
      }
    });

    return col;
  }

  function setCreateLoading(isLoading) {
    createSubmit.disabled = isLoading;
    createBtnText.classList.toggle("d-none", isLoading);
    createBtnLoading.classList.toggle("d-none", !isLoading);
  }

  // Initial load
  renderWorkspaces();
});