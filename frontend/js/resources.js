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

  const resourcesContainer = document.getElementById("resourcesContainer");
  const resourcesEmpty = document.getElementById("resourcesEmpty");
  const addResourceBtn = document.getElementById("addResourceBtn");
  const emptyAddResourceBtn = document.getElementById("emptyAddResourceBtn");
  const resourceModalEl = document.getElementById("resourceModal");
  const resourceModal = new bootstrap.Modal(resourceModalEl);
  const resourceForm = document.getElementById("resourceForm");
  const resourceIdInput = document.getElementById("resourceId");
  const resourceTitleInput = document.getElementById("resourceTitle");
  const resourceUrlInput = document.getElementById("resourceUrl");
  const resourceDescriptionInput = document.getElementById("resourceDescription");
  const resourceSubmit = document.getElementById("resourceSubmit");
  const resourceBtnText = resourceSubmit.querySelector(".btn-text");
  const resourceBtnLoading = resourceSubmit.querySelector(".btn-loading");
  const modalLabel = document.getElementById("resourceModalLabel");

  let allResources = [];

  async function loadResources() {
    try {
      allResources = await window.OneSpaceAPI.getResources(workspaceId);
      renderResources();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to load resources");
    }
  }

  function renderResources() {
    if (!allResources.length) {
      resourcesContainer.innerHTML = "";
      resourcesEmpty.classList.remove("d-none");
      resourcesEmpty.classList.remove("hidden");
      return;
    }
    resourcesEmpty.classList.add("d-none");
    resourcesEmpty.classList.add("hidden");
    resourcesContainer.innerHTML = allResources.map(function (r) {
      const safeUrl = r.url && /^https?:\/\//i.test(r.url) ? r.url : (r.url ? `https://${r.url}` : "#");
      return `
        <div class="card bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div class="card-body p-lg flex flex-col flex-grow">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h5 class="card-title mb-0">${window.OneSpaceUtils.escapeHtml(r.title)}</h5>
              <div class="btn-group btn-group-sm">
                <button type="button" class="btn btn-outline-secondary edit-btn" data-id="${r.id}" aria-label="Edit resource">
                  <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-outline-danger delete-btn" data-id="${r.id}" aria-label="Delete resource">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <p class="card-text text-muted small mb-2 flex-grow">${window.OneSpaceUtils.escapeHtml(r.description || "No description")}</p>
            <div class="d-flex align-items-center justify-content-between pt-sm border-t border-outline-variant mt-auto">
              <a href="${window.OneSpaceUtils.escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-box-arrow-up-right me-1"></i> Open
              </a>
              <small class="text-muted">Added ${window.OneSpaceUtils.formatRelativeTime(r.updated_at)}</small>
            </div>
          </div>
        </div>
      `;
    }).join("");

    resourcesContainer.querySelectorAll(".edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { openEditModal(this.dataset.id); });
    });
    resourcesContainer.querySelectorAll(".delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteResource(this.dataset.id); });
    });
  }

  function openAddModal() {
    resourceForm.reset();
    resourceForm.classList.remove("was-validated");
    resourceIdInput.value = "";
    modalLabel.textContent = "Add Resource";
    resourceModal.show();
  }

  function openEditModal(resourceId) {
    const resource = allResources.find(function (r) { return r.id === resourceId; });
    if (!resource) return;
    resourceForm.reset();
    resourceForm.classList.remove("was-validated");
    resourceIdInput.value = resource.id;
    resourceTitleInput.value = resource.title || "";
    resourceUrlInput.value = resource.url || "";
    resourceDescriptionInput.value = resource.description || "";
    modalLabel.textContent = "Edit Resource";
    resourceModal.show();
  }

  resourceForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!resourceForm.checkValidity()) {
      resourceForm.classList.add("was-validated");
      return;
    }

    setSubmitLoading(true);
    const data = {
      title: resourceTitleInput.value.trim(),
      url: resourceUrlInput.value.trim(),
      description: resourceDescriptionInput.value.trim()
    };

    try {
      if (resourceIdInput.value) {
        await window.OneSpaceAPI.updateResource(workspaceId, resourceIdInput.value, data);
        window.OneSpaceUtils.showSuccess("Resource updated");
      } else {
        await window.OneSpaceAPI.createResource(workspaceId, data);
        window.OneSpaceUtils.showSuccess("Resource created");
      }
      resourceModal.hide();
      loadResources();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  });

  async function deleteResource(resourceId) {
    if (!confirm("Delete this resource? This cannot be undone.")) return;
    try {
      await window.OneSpaceAPI.deleteResource(workspaceId, resourceId);
      window.OneSpaceUtils.showSuccess("Resource deleted");
      loadResources();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    }
  }

  function setSubmitLoading(isLoading) {
    resourceSubmit.disabled = isLoading;
    resourceBtnText.classList.toggle("d-none", isLoading);
    resourceBtnLoading.classList.toggle("d-none", !isLoading);
  }

  addResourceBtn.addEventListener("click", openAddModal);
  emptyAddResourceBtn.addEventListener("click", openAddModal);

  resourceModalEl.addEventListener("hidden.bs.modal", function () {
    resourceForm.reset();
    resourceForm.classList.remove("was-validated");
  });

  loadResources();
});