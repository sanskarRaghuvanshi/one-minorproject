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

  const searchInput = document.getElementById("searchInput");
  const clearSearch = document.getElementById("clearSearch");
  const searchResults = document.getElementById("searchResults");
  const searchEmpty = document.getElementById("searchEmpty");
  const searchInitial = document.getElementById("searchInitial");

  let debouncedSearch = window.OneSpaceUtils.debounce(performSearch, 300);

  searchInput.addEventListener("input", function () {
    const query = searchInput.value.trim();
    if (query) {
      searchInitial.classList.add("d-none");
      searchEmpty.classList.add("d-none");
      debouncedSearch(query);
    } else {
      searchResults.innerHTML = "";
      searchEmpty.classList.add("d-none");
      searchInitial.classList.remove("d-none");
    }
  });

  clearSearch.addEventListener("click", function () {
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
  });

  async function performSearch(query) {
    try {
      const results = await window.OneSpaceAPI.searchWorkspace(workspaceId, query);
      renderResults(results, query);
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Search failed");
    }
  }

  function renderResults(results, query) {
    const hasResults = results.tasks.length || results.notes.length || results.resources.length || results.files.length;
    if (!hasResults) {
      searchResults.innerHTML = "";
      searchEmpty.classList.remove("d-none");
      searchEmpty.classList.remove("hidden");
      return;
    }
    searchEmpty.classList.add("d-none");

    let html = "";
    if (results.tasks.length) {
      html += `
        <section class="mb-4">
          <h5 class="mb-3"><i class="bi bi-kanban text-primary me-2"></i>Tasks (${results.tasks.length})</h5>
          <div class="list-group">
            ${results.tasks.map(function (t) {
              const badgeClass = t.status === "Done" ? "bg-success" : t.status === "In Progress" ? "bg-primary" : "bg-secondary";
              return `
                <a href="tasks.html?workspace_id=${encodeURIComponent(workspaceId)}" class="list-group-item list-group-item-action">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <h6 class="mb-1">${highlightMatch(window.OneSpaceUtils.escapeHtml(t.title), query)}</h6>
                      <small class="text-muted">${window.OneSpaceUtils.formatRelativeTime(t.updated_at)}</small>
                    </div>
                    <span class="badge ${badgeClass}">${window.OneSpaceUtils.escapeHtml(t.status)}</span>
                  </div>
                </a>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }
    if (results.notes.length) {
      html += `
        <section class="mb-4">
          <h5 class="mb-3"><i class="bi bi-journal-text text-info me-2"></i>Notes (${results.notes.length})</h5>
          <div class="list-group">
            ${results.notes.map(function (n) {
              const bodyStr = n.body || "";
              const preview = highlightMatch(window.OneSpaceUtils.escapeHtml(bodyStr).substring(0, 200), query) + (bodyStr.length > 200 ? "…" : "");
              return `
                <a href="notes.html?workspace_id=${encodeURIComponent(workspaceId)}" class="list-group-item list-group-item-action">
                  <h6 class="mb-1">${highlightMatch(window.OneSpaceUtils.escapeHtml(n.title), query)}</h6>
                  <p class="mb-1 small text-muted">${preview}</p>
                  <small class="text-muted">${window.OneSpaceUtils.formatRelativeTime(n.updated_at)}</small>
                </a>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }
    if (results.resources.length) {
      html += `
        <section class="mb-4">
          <h5 class="mb-3"><i class="bi bi-link-45deg text-success me-2"></i>Resources (${results.resources.length})</h5>
          <div class="list-group">
            ${results.resources.map(function (r) {
              return `
                <a href="resources.html?workspace_id=${encodeURIComponent(workspaceId)}" class="list-group-item list-group-item-action">
                  <h6 class="mb-1">${highlightMatch(window.OneSpaceUtils.escapeHtml(r.title), query)}</h6>
                  <p class="mb-1 small text-muted">${highlightMatch(window.OneSpaceUtils.escapeHtml(r.description || ""), query)}</p>
                  <small class="text-muted">${window.OneSpaceUtils.formatRelativeTime(r.updated_at)}</small>
                </a>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }
    if (results.files.length) {
      html += `
        <section class="mb-4">
          <h5 class="mb-3"><i class="bi bi-file-earmark text-secondary me-2"></i>Files (${results.files.length})</h5>
          <div class="list-group">
            ${results.files.map(function (f) {
              return `
                <a href="files.html?workspace_id=${encodeURIComponent(workspaceId)}" class="list-group-item list-group-item-action">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-file-earmark text-secondary me-2"></i>
                    <div>
                      <h6 class="mb-1">${highlightMatch(window.OneSpaceUtils.escapeHtml(f.filename), query)}</h6>
                      <small class="text-muted">Uploaded ${window.OneSpaceUtils.formatRelativeTime(f.upload_date)}</small>
                    </div>
                  </div>
                </a>
              `;
            }).join("")}
          </div>
        </section>
      `;
    }

    searchResults.innerHTML = html;
  }

  function highlightMatch(escapedText, query) {
    if (!query || !escapedText) return escapedText || "";
    const escapedQuery = window.OneSpaceUtils.escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    return escapedText.replace(regex, '<mark class="bg-warning">$1</mark>');
  }
});