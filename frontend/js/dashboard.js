document.addEventListener("DOMContentLoaded", async function () {
  if (!window.OneSpaceAuth.requireAuth()) return;

  const workspaceId = window.OneSpaceUtils.getQueryParam("workspace_id");
  if (!workspaceId) {
    window.location.replace("workspaces.html");
    return;
  }

  // Update all navigation links with workspace_id
  document.querySelectorAll("[data-nav]").forEach(function (link) {
    const page = link.getAttribute("data-nav");
    link.href = `${page}.html?workspace_id=${encodeURIComponent(workspaceId)}`;
  });

  try {
    const [workspace, tasks, notes, resources, files, activity] = await Promise.all([
      window.OneSpaceAPI.getWorkspaces().then(function (ws) { return ws.find(function (w) { return w.id === workspaceId; }); }),
      window.OneSpaceAPI.getTasks(workspaceId),
      window.OneSpaceAPI.getNotes(workspaceId),
      window.OneSpaceAPI.getResources(workspaceId),
      window.OneSpaceAPI.getFiles(workspaceId),
      window.OneSpaceAPI.getActivity(workspaceId)
    ]);

    if (!workspace) {
      window.location.replace("workspaces.html");
      return;
    }

    renderWorkspaceHeader(workspace);
    renderSummaryCards(workspaceId, tasks, notes, resources, files);
    renderVisualAnalytics(tasks, notes, resources, files);
    renderRecentTasks(tasks);
    renderRecentNotes(notes);
    renderRecentResources(resources);
    renderRecentFiles(files);
    renderRecentActivity(activity);
  } catch (err) {
    window.OneSpaceUtils.showError(err.message || "Failed to load dashboard");
  }

  function renderWorkspaceHeader(ws) {
    const titleEl = document.getElementById("workspaceTitle");
    const nameEl = document.getElementById("workspaceName");
    const descEl = document.getElementById("workspaceDescription");
    if (titleEl) titleEl.textContent = ws.name;
    if (nameEl) nameEl.textContent = ws.name;
    if (descEl) descEl.textContent = ws.description || "Workspace overview and visual analytics";
  }

  function renderSummaryCards(wsId, tasks, notes, resources, files) {
    const completedTasks = tasks.filter(function (t) { return t.status === "Done"; }).length;
    const openTasks = tasks.filter(function (t) { return t.status !== "Done"; }).length;

    const cards = [
      {
        label: "Total Tasks",
        value: tasks.length,
        icon: "checklist",
        color: "text-primary bg-primary/10",
        border: "border-primary/20",
        link: `tasks.html?workspace_id=${encodeURIComponent(wsId)}`
      },
      {
        label: "Completed",
        value: completedTasks,
        icon: "task_alt",
        color: "text-emerald-600 bg-emerald-500/10",
        border: "border-emerald-500/20",
        link: `tasks.html?workspace_id=${encodeURIComponent(wsId)}&status=Done`
      },
      {
        label: "Open Tasks",
        value: openTasks,
        icon: "pending_actions",
        color: "text-amber-600 bg-amber-500/10",
        border: "border-amber-500/20",
        link: `tasks.html?workspace_id=${encodeURIComponent(wsId)}&status=open`
      },
      {
        label: "Notes",
        value: notes.length,
        icon: "description",
        color: "text-indigo-600 bg-indigo-500/10",
        border: "border-indigo-500/20",
        link: `notes.html?workspace_id=${encodeURIComponent(wsId)}`
      },
      {
        label: "Resources",
        value: resources.length,
        icon: "bookmark",
        color: "text-teal-600 bg-teal-500/10",
        border: "border-teal-500/20",
        link: `resources.html?workspace_id=${encodeURIComponent(wsId)}`
      },
      {
        label: "Files",
        value: files.length,
        icon: "folder",
        color: "text-blue-600 bg-blue-500/10",
        border: "border-blue-500/20",
        link: `files.html?workspace_id=${encodeURIComponent(wsId)}`
      }
    ];

    const container = document.getElementById("summaryCards");
    if (!container) return;

    container.innerHTML = cards.map(function (c) {
      return `
        <a href="${c.link}" class="group bg-surface border border-outline-variant/60 rounded-xl p-md shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col justify-between block text-decoration-none">
          <div class="flex items-center justify-between mb-sm">
            <span class="text-xs font-semibold text-on-surface-variant group-hover:text-primary transition-colors">${c.label}</span>
            <div class="w-8 h-8 rounded-lg ${c.color} flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">${c.icon}</span>
            </div>
          </div>
          <div class="text-2xl font-bold text-on-surface">${c.value}</div>
        </a>
      `;
    }).join("");
  }

  function renderVisualAnalytics(tasks, notes, resources, files) {
    const total = tasks.length;
    const todo = tasks.filter(function (t) { return t.status === "To Do"; }).length;
    const inProg = tasks.filter(function (t) { return t.status === "In Progress"; }).length;
    const done = tasks.filter(function (t) { return t.status === "Done"; }).length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    // Circular Gauge
    const circle = document.getElementById("analyticsProgressRing");
    const percentEl = document.getElementById("analyticsPercent");
    if (circle) {
      const circumference = 264; // 2 * pi * 42 ~= 263.89
      const offset = circumference - (circumference * percent / 100);
      circle.style.strokeDashoffset = offset;
    }
    if (percentEl) percentEl.textContent = `${percent}%`;

    // Status counts
    const todoEl = document.getElementById("analyticsCountToDo");
    const inProgEl = document.getElementById("analyticsCountInProgress");
    const doneEl = document.getElementById("analyticsCountDone");
    if (todoEl) todoEl.textContent = `${todo} (${total ? Math.round((todo / total) * 100) : 0}%)`;
    if (inProgEl) inProgEl.textContent = `${inProg} (${total ? Math.round((inProg / total) * 100) : 0}%)`;
    if (doneEl) doneEl.textContent = `${done} (${percent}%)`;

    // Priority Distribution
    const high = tasks.filter(function (t) { return t.priority === "High"; }).length;
    const medium = tasks.filter(function (t) { return t.priority === "Medium"; }).length;
    const low = tasks.filter(function (t) { return t.priority === "Low"; }).length;

    const summaryEl = document.getElementById("analyticsPrioritySummary");
    if (summaryEl) summaryEl.textContent = `${total} Tasks tracked`;

    const barHigh = document.getElementById("barPriorityHigh");
    const barMed = document.getElementById("barPriorityMedium");
    const barLow = document.getElementById("barPriorityLow");

    if (total > 0) {
      if (barHigh) barHigh.style.width = `${(high / total) * 100}%`;
      if (barMed) barMed.style.width = `${(medium / total) * 100}%`;
      if (barLow) barLow.style.width = `${(low / total) * 100}%`;
    }

    const countHighEl = document.getElementById("countPriorityHigh");
    const countMedEl = document.getElementById("countPriorityMedium");
    const countLowEl = document.getElementById("countPriorityLow");
    if (countHighEl) countHighEl.textContent = high;
    if (countMedEl) countMedEl.textContent = medium;
    if (countLowEl) countLowEl.textContent = low;

    // Storage & Knowledge Footprint
    const totalBytes = files.reduce(function (sum, f) { return sum + (Number(f.size) || 0); }, 0);
    const storageEl = document.getElementById("analyticsStorageSize");
    const knowledgeEl = document.getElementById("analyticsKnowledgeCount");

    if (storageEl) storageEl.textContent = window.OneSpaceUtils.formatFileSize(totalBytes);
    if (knowledgeEl) knowledgeEl.textContent = `${notes.length + resources.length} items`;
  }

  function renderRecentTasks(tasks) {
    const list = document.getElementById("recentTasksList");
    if (!list) return;

    const recent = [...tasks].sort(function (a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    }).slice(0, 5);

    if (!recent.length) {
      list.innerHTML = '<div class="py-6 text-center text-xs text-on-surface-variant/60">No tasks created yet</div>';
      return;
    }

    list.innerHTML = recent.map(function (t) {
      const badgeClass = t.status === "Done" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : t.status === "In Progress" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-surface-container-high text-on-surface-variant border border-outline-variant/30";
      const priorityClass = t.priority === "High" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : t.priority === "Medium" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-sky-500/10 text-sky-600 border border-sky-500/20";
      const due = t.due_date ? window.OneSpaceUtils.formatDate(t.due_date) : "";
      const overdue = t.due_date && t.status !== "Done" && new Date(t.due_date + "T23:59:59") < new Date();

      return `
        <a href="tasks.html?workspace_id=${encodeURIComponent(workspaceId)}" class="flex items-center justify-between p-3 rounded-lg border border-outline-variant/40 bg-surface hover:bg-surface-container-low transition-colors text-decoration-none group">
          <div class="pr-3">
            <h6 class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors mb-0.5">${window.OneSpaceUtils.escapeHtml(t.title)}</h6>
            <div class="flex items-center gap-2 text-[11px] text-on-surface-variant">
              <span>Updated ${window.OneSpaceUtils.formatRelativeTime(t.updated_at || t.created_at)}</span>
              ${due ? `<span class="flex items-center gap-0.5 ${overdue ? "text-error font-semibold" : ""}"><span class="material-symbols-outlined text-[13px]">${overdue ? "warning" : "calendar_today"}</span> ${due}</span>` : ""}
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${priorityClass}">${window.OneSpaceUtils.escapeHtml(t.priority)}</span>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeClass}">${window.OneSpaceUtils.escapeHtml(t.status)}</span>
          </div>
        </a>
      `;
    }).join("");
  }

  function renderRecentNotes(notes) {
    const list = document.getElementById("recentNotesList");
    if (!list) return;

    const recent = [...notes].sort(function (a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    }).slice(0, 4);

    if (!recent.length) {
      list.innerHTML = '<div class="py-6 text-center text-xs text-on-surface-variant/60">No notes written yet</div>';
      return;
    }

    list.innerHTML = recent.map(function (n) {
      const bodyText = n.body || "";
      const preview = window.OneSpaceUtils.escapeHtml(bodyText).substring(0, 110) + (bodyText.length > 110 ? "…" : "");
      return `
        <a href="notes.html?workspace_id=${encodeURIComponent(workspaceId)}" class="p-3 rounded-lg border border-outline-variant/40 bg-surface hover:bg-surface-container-low transition-colors text-decoration-none block group">
          <div class="flex items-center justify-between mb-1">
            <h6 class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors">${window.OneSpaceUtils.escapeHtml(n.title)}</h6>
            <small class="text-[11px] text-on-surface-variant">${window.OneSpaceUtils.formatRelativeTime(n.updated_at || n.created_at)}</small>
          </div>
          <p class="text-xs text-on-surface-variant line-clamp-1 mb-0">${preview || '<span class="italic text-on-surface-variant/50">Empty note</span>'}</p>
        </a>
      `;
    }).join("");
  }

  function renderRecentResources(resources) {
    const list = document.getElementById("recentResourcesList");
    if (!list) return;

    const recent = [...resources].sort(function (a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    }).slice(0, 4);

    if (!recent.length) {
      list.innerHTML = '<div class="py-6 text-center text-xs text-on-surface-variant/60">No resources saved yet</div>';
      return;
    }

    list.innerHTML = recent.map(function (r) {
      return `
        <a href="resources.html?workspace_id=${encodeURIComponent(workspaceId)}" class="flex items-center justify-between p-3 rounded-lg border border-outline-variant/40 bg-surface hover:bg-surface-container-low transition-colors text-decoration-none group">
          <div class="pr-2">
            <h6 class="font-semibold text-xs text-on-surface group-hover:text-primary transition-colors mb-0.5">${window.OneSpaceUtils.escapeHtml(r.title)}</h6>
            <p class="text-xs text-on-surface-variant line-clamp-1 mb-0">${window.OneSpaceUtils.escapeHtml(r.description || r.url || "No description")}</p>
          </div>
          <span class="material-symbols-outlined text-[16px] text-on-surface-variant/60 group-hover:text-primary transition-colors">open_in_new</span>
        </a>
      `;
    }).join("");
  }

  function renderRecentFiles(files) {
    const list = document.getElementById("recentFilesList");
    if (!list) return;

    const recent = [...files].sort(function (a, b) {
      return new Date(b.upload_date) - new Date(a.upload_date);
    }).slice(0, 4);

    if (!recent.length) {
      list.innerHTML = '<div class="py-6 text-center text-xs text-on-surface-variant/60">No files uploaded yet</div>';
      return;
    }

    list.innerHTML = recent.map(function (f) {
      const size = window.OneSpaceUtils.formatFileSize(f.size);
      return `
        <div class="flex items-center justify-between p-3 rounded-lg border border-outline-variant/40 bg-surface">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[16px]">description</span>
            </div>
            <div>
              <h6 class="font-semibold text-xs text-on-surface mb-0.5">${window.OneSpaceUtils.escapeHtml(f.filename)}</h6>
              <small class="text-[11px] text-on-surface-variant">${size} • ${window.OneSpaceUtils.formatRelativeTime(f.upload_date)}</small>
            </div>
          </div>
          <a href="files.html?workspace_id=${encodeURIComponent(workspaceId)}" class="p-1 rounded-md text-on-surface-variant hover:text-primary transition-colors" title="View in files">
            <span class="material-symbols-outlined text-[18px]">folder_open</span>
          </a>
        </div>
      `;
    }).join("");
  }

  function renderRecentActivity(activity) {
    const list = document.getElementById("recentActivityList");
    if (!list) return;

    const recent = [...activity].sort(function (a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }).slice(0, 8);

    if (!recent.length) {
      list.innerHTML = '<div class="py-6 text-center text-xs text-on-surface-variant/60">No activity logged yet</div>';
      return;
    }

    list.innerHTML = recent.map(function (a) {
      let icon = "info";
      let badgeColor = "bg-primary/10 text-primary";

      if (a.type.includes("task")) {
        icon = "task_alt";
        badgeColor = "bg-emerald-500/10 text-emerald-600";
      } else if (a.type.includes("note")) {
        icon = "description";
        badgeColor = "bg-indigo-500/10 text-indigo-600";
      } else if (a.type.includes("resource")) {
        icon = "bookmark";
        badgeColor = "bg-teal-500/10 text-teal-600";
      } else if (a.type.includes("file")) {
        icon = "folder";
        badgeColor = "bg-blue-500/10 text-blue-600";
      } else if (a.type.includes("snippet")) {
        icon = "code";
        badgeColor = "bg-amber-500/10 text-amber-600";
      }

      return `
        <div class="flex items-start gap-3 p-2 rounded-lg hover:bg-surface-container-low/50 transition-colors">
          <div class="w-7 h-7 rounded-full ${badgeColor} flex items-center justify-center flex-shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-[15px]">${icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-on-surface font-medium leading-snug mb-0.5">${window.OneSpaceUtils.escapeHtml(a.message)}</p>
            <span class="text-[11px] text-on-surface-variant">${window.OneSpaceUtils.formatRelativeTime(a.timestamp)}</span>
          </div>
        </div>
      `;
    }).join("");
  }
});