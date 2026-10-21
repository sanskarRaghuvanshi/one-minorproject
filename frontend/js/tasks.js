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
  document.getElementById("dashboardLink").href = `dashboard.html?workspace_id=${encodeURIComponent(workspaceId)}`;
  document.getElementById("backDashboard").href = `dashboard.html?workspace_id=${encodeURIComponent(workspaceId)}`;

  const tasksBody = document.getElementById("tasksBody");
  const tasksEmpty = document.getElementById("tasksEmpty");
  const tasksCard = document.getElementById("tasksCard");
  const tasksKanban = document.getElementById("tasksKanban");
  const viewTableBtn = document.getElementById("viewTableBtn");
  const viewKanbanBtn = document.getElementById("viewKanbanBtn");

  const statTotal = document.getElementById("statTotal");
  const statToDo = document.getElementById("statToDo");
  const statInProgress = document.getElementById("statInProgress");
  const statDone = document.getElementById("statDone");
  const statProgressText = document.getElementById("statProgressText");
  const statProgressBar = document.getElementById("statProgressBar");

  const kanbanToDo = document.getElementById("kanbanToDo");
  const kanbanInProgress = document.getElementById("kanbanInProgress");
  const kanbanDone = document.getElementById("kanbanDone");
  const kanbanCountToDo = document.getElementById("kanbanCountToDo");
  const kanbanCountInProgress = document.getElementById("kanbanCountInProgress");
  const kanbanCountDone = document.getElementById("kanbanCountDone");

  const statusFilter = document.getElementById("statusFilter");
  const priorityFilter = document.getElementById("priorityFilter");
  const searchInput = document.getElementById("searchInput");
  const clearSearch = document.getElementById("clearSearch");
  const addTaskBtn = document.getElementById("addTaskBtn");
  const emptyAddTaskBtn = document.getElementById("emptyAddTaskBtn");

  const taskModalEl = document.getElementById("taskModal");
  const taskModal = new bootstrap.Modal(taskModalEl);
  const taskForm = document.getElementById("taskForm");
  const taskIdInput = document.getElementById("taskId");
  const taskTitleInput = document.getElementById("taskTitle");
  const taskDescriptionInput = document.getElementById("taskDescription");
  const taskStatusInput = document.getElementById("taskStatus");
  const taskPriorityInput = document.getElementById("taskPriority");
  const taskDueDateInput = document.getElementById("taskDueDate");
  const taskSubmit = document.getElementById("taskSubmit");
  const taskBtnText = taskSubmit.querySelector(".btn-text");
  const taskBtnLoading = taskSubmit.querySelector(".btn-loading");
  const modalLabel = document.getElementById("taskModalLabel");

  // View mode state
  let currentViewMode = window.localStorage.getItem("onespace_tasks_view") || "table";

  // Read initial filter from URL params (e.g. from Dashboard cards)
  const initialStatus = window.OneSpaceUtils.getQueryParam("status");
  if (initialStatus && ["To Do", "In Progress", "Done", "open"].includes(initialStatus)) {
    statusFilter.value = initialStatus;
  }
  const initialPriority = window.OneSpaceUtils.getQueryParam("priority");
  if (initialPriority && ["High", "Medium", "Low"].includes(initialPriority)) {
    priorityFilter.value = initialPriority;
  }

  let allTasks = [];

  function setViewMode(mode) {
    currentViewMode = mode;
    window.localStorage.setItem("onespace_tasks_view", mode);

    const activeClasses = ["bg-surface", "text-primary", "shadow-sm"];
    const inactiveClasses = ["text-on-surface-variant", "hover:text-on-surface"];

    if (mode === "table") {
      viewTableBtn.classList.add(...activeClasses);
      viewTableBtn.classList.remove(...inactiveClasses);
      viewKanbanBtn.classList.remove(...activeClasses);
      viewKanbanBtn.classList.add(...inactiveClasses);

      tasksCard.classList.remove("d-none");
      tasksKanban.classList.add("d-none");
    } else {
      viewKanbanBtn.classList.add(...activeClasses);
      viewKanbanBtn.classList.remove(...inactiveClasses);
      viewTableBtn.classList.remove(...activeClasses);
      viewTableBtn.classList.add(...inactiveClasses);

      tasksCard.classList.add("d-none");
      tasksKanban.classList.remove("d-none");
    }
    applyFilters();
  }

  viewTableBtn.addEventListener("click", function () { setViewMode("table"); });
  viewKanbanBtn.addEventListener("click", function () { setViewMode("kanban"); });

  async function loadTasks() {
    try {
      allTasks = await window.OneSpaceAPI.getTasks(workspaceId);
      updateStats();
      applyFilters();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to load tasks");
    }
  }

  function updateStats() {
    const total = allTasks.length;
    const todo = allTasks.filter(function (t) { return t.status === "To Do"; }).length;
    const inProg = allTasks.filter(function (t) { return t.status === "In Progress"; }).length;
    const done = allTasks.filter(function (t) { return t.status === "Done"; }).length;
    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);

    if (statTotal) statTotal.textContent = total;
    if (statToDo) statToDo.textContent = todo;
    if (statInProgress) statInProgress.textContent = inProg;
    if (statDone) statDone.textContent = done;
    if (statProgressText) statProgressText.textContent = `${percentage}% Completed`;
    if (statProgressBar) statProgressBar.style.width = `${percentage}%`;
  }

  function applyFilters() {
    const statusVal = statusFilter.value;
    const priorityVal = priorityFilter.value;
    const searchVal = searchInput.value.trim().toLowerCase();

    let filtered = allTasks;
    if (statusVal === "open") {
      filtered = filtered.filter(function (t) { return t.status === "To Do" || t.status === "In Progress"; });
    } else if (statusVal) {
      filtered = filtered.filter(function (t) { return t.status === statusVal; });
    }

    if (priorityVal) {
      filtered = filtered.filter(function (t) { return t.priority === priorityVal; });
    }

    if (searchVal) {
      filtered = filtered.filter(function (t) {
        return (t.title || "").toLowerCase().includes(searchVal) ||
               (t.description || "").toLowerCase().includes(searchVal) ||
               (t.status || "").toLowerCase().includes(searchVal) ||
               (t.priority || "").toLowerCase().includes(searchVal);
      });
    }

    if (currentViewMode === "table") {
      renderTableTasks(filtered);
    } else {
      renderKanbanTasks(filtered);
    }
  }

  function renderTableTasks(tasks) {
    if (!tasks.length) {
      tasksBody.innerHTML = "";
      tasksCard.classList.add("d-none");
      tasksEmpty.classList.remove("d-none");
      return;
    }
    tasksCard.classList.remove("d-none");
    tasksEmpty.classList.add("d-none");

    tasksBody.innerHTML = tasks.map(function (t) {
      const badgeClass = t.status === "Done" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : t.status === "In Progress" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-surface-container-high text-on-surface-variant border border-outline-variant/30";
      const priorityClass = t.priority === "High" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : t.priority === "Medium" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-sky-500/10 text-sky-600 border border-sky-500/20";
      const due = t.due_date ? window.OneSpaceUtils.formatDate(t.due_date) : "—";
      const overdue = t.due_date && t.status !== "Done" && new Date(t.due_date + "T23:59:59") < new Date();

      return `
        <tr data-id="${t.id}" class="hover:bg-surface-container-low/60 transition-colors">
          <td class="px-md py-sm">
            <strong class="text-on-surface font-semibold text-sm block">${window.OneSpaceUtils.escapeHtml(t.title)}</strong>
            ${t.description ? `<div class="text-on-surface-variant text-xs mt-0.5 line-clamp-1">${window.OneSpaceUtils.escapeHtml(t.description)}</div>` : ""}
          </td>
          <td class="px-md py-sm">
            <select class="status-select bg-surface border border-outline-variant/40 rounded-lg px-2 py-1 text-xs font-medium text-on-surface cursor-pointer focus:outline-none focus:border-primary shadow-sm" data-id="${t.id}" aria-label="Change status">
              <option value="To Do" ${t.status === "To Do" ? "selected" : ""}>To Do</option>
              <option value="In Progress" ${t.status === "In Progress" ? "selected" : ""}>In Progress</option>
              <option value="Done" ${t.status === "Done" ? "selected" : ""}>Done</option>
            </select>
          </td>
          <td class="px-md py-sm hidden sm:table-cell">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${priorityClass}">${window.OneSpaceUtils.escapeHtml(t.priority)}</span>
          </td>
          <td class="px-md py-sm hidden md:table-cell ${overdue ? "text-error font-bold" : "text-on-surface-variant text-xs"}">
            <div class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px]">${overdue ? "warning" : "calendar_today"}</span>
              <span>${due}</span>
            </div>
          </td>
          <td class="px-md py-sm text-right">
            <div class="inline-flex items-center gap-1">
              <button type="button" class="p-1.5 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high transition-colors edit-btn" data-id="${t.id}" title="Edit task" aria-label="Edit task">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
              <button type="button" class="p-1.5 rounded-lg border border-outline-variant/50 text-error hover:bg-error-container/30 transition-colors delete-btn" data-id="${t.id}" title="Delete task" aria-label="Delete task">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    attachActionListeners(tasksBody);
  }

  function renderKanbanTasks(tasks) {
    tasksCard.classList.add("d-none");

    const todoTasks = tasks.filter(function (t) { return t.status === "To Do"; });
    const inProgressTasks = tasks.filter(function (t) { return t.status === "In Progress"; });
    const doneTasks = tasks.filter(function (t) { return t.status === "Done"; });

    kanbanCountToDo.textContent = todoTasks.length;
    kanbanCountInProgress.textContent = inProgressTasks.length;
    kanbanCountDone.textContent = doneTasks.length;

    if (!tasks.length) {
      tasksEmpty.classList.remove("d-none");
    } else {
      tasksEmpty.classList.add("d-none");
    }

    kanbanToDo.innerHTML = renderKanbanCards(todoTasks);
    kanbanInProgress.innerHTML = renderKanbanCards(inProgressTasks);
    kanbanDone.innerHTML = renderKanbanCards(doneTasks);

    attachActionListeners(tasksKanban);
    setupDragAndDrop();
  }

  function renderKanbanCards(taskList) {
    if (!taskList.length) {
      return '<div class="py-8 text-center text-xs text-on-surface-variant/60 border border-dashed border-outline-variant/40 rounded-xl bg-surface/30">No tasks</div>';
    }

    return taskList.map(function (t) {
      const priorityClass = t.priority === "High" ? "bg-rose-500/10 text-rose-600 border border-rose-500/20" : t.priority === "Medium" ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-sky-500/10 text-sky-600 border border-sky-500/20";
      const due = t.due_date ? window.OneSpaceUtils.formatDate(t.due_date) : "";
      const overdue = t.due_date && t.status !== "Done" && new Date(t.due_date + "T23:59:59") < new Date();

      let nextStatusAction = "";
      if (t.status === "To Do") {
        nextStatusAction = `
          <button type="button" class="quick-status-btn p-1 rounded-md text-amber-600 hover:bg-amber-50 transition-colors" data-id="${t.id}" data-target-status="In Progress" title="Move to In Progress">
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        `;
      } else if (t.status === "In Progress") {
        nextStatusAction = `
          <button type="button" class="quick-status-btn p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors" data-id="${t.id}" data-target-status="Done" title="Mark Completed">
            <span class="material-symbols-outlined text-[18px]">task_alt</span>
          </button>
        `;
      } else if (t.status === "Done") {
        nextStatusAction = `
          <button type="button" class="quick-status-btn p-1 rounded-md text-secondary hover:bg-surface-container-high transition-colors" data-id="${t.id}" data-target-status="In Progress" title="Reopen task">
            <span class="material-symbols-outlined text-[18px]">replay</span>
          </button>
        `;
      }

      return `
        <div class="task-kanban-card bg-surface border border-outline-variant/60 rounded-xl p-md shadow-sm hover:shadow transition-all cursor-grab active:cursor-grabbing group" draggable="true" data-id="${t.id}">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${priorityClass}">${window.OneSpaceUtils.escapeHtml(t.priority)}</span>
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              ${nextStatusAction}
              <button type="button" class="p-1 rounded-md text-on-surface-variant hover:bg-surface-container-high transition-colors edit-btn" data-id="${t.id}" title="Edit task">
                <span class="material-symbols-outlined text-[16px]">edit</span>
              </button>
              <button type="button" class="p-1 rounded-md text-error hover:bg-error-container/30 transition-colors delete-btn" data-id="${t.id}" title="Delete task">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
          <h5 class="text-sm font-semibold text-on-surface mb-1 leading-snug">${window.OneSpaceUtils.escapeHtml(t.title)}</h5>
          ${t.description ? `<p class="text-xs text-on-surface-variant line-clamp-2 mb-2 leading-relaxed">${window.OneSpaceUtils.escapeHtml(t.description)}</p>` : ""}
          <div class="flex items-center justify-between pt-2 border-t border-outline-variant/30 text-[11px] text-on-surface-variant">
            <span class="flex items-center gap-1 ${overdue ? "text-error font-bold" : ""}">
              <span class="material-symbols-outlined text-[14px]">${overdue ? "warning" : "calendar_today"}</span>
              ${due || "No due date"}
            </span>
            <span class="text-[10px] text-on-surface-variant/60">#${t.id.slice(-4)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  function setupDragAndDrop() {
    const cards = document.querySelectorAll(".task-kanban-card");
    const columns = document.querySelectorAll(".kanban-col");

    cards.forEach(function (card) {
      card.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", this.dataset.id);
        this.classList.add("opacity-40", "scale-95");
      });
      card.addEventListener("dragend", function () {
        this.classList.remove("opacity-40", "scale-95");
      });
    });

    columns.forEach(function (col) {
      col.addEventListener("dragover", function (e) {
        e.preventDefault();
        this.classList.add("bg-primary/5", "border-primary/40");
      });
      col.addEventListener("dragleave", function () {
        this.classList.remove("bg-primary/5", "border-primary/40");
      });
      col.addEventListener("drop", async function (e) {
        e.preventDefault();
        this.classList.remove("bg-primary/5", "border-primary/40");
        const taskId = e.dataTransfer.getData("text/plain");
        const newStatus = this.dataset.status;
        const task = allTasks.find(function (t) { return t.id === taskId; });

        if (task && task.status !== newStatus) {
          try {
            await window.OneSpaceAPI.updateTask(workspaceId, taskId, { status: newStatus });
            window.OneSpaceUtils.showSuccess(`Task moved to ${newStatus}`);
            loadTasks();
          } catch (err) {
            window.OneSpaceUtils.showError(err.message || "Failed to update task status");
          }
        }
      });
    });
  }

  function attachActionListeners(container) {
    // Status select in Table View
    container.querySelectorAll(".status-select").forEach(function (select) {
      select.addEventListener("change", async function () {
        const taskId = this.dataset.id;
        const newStatus = this.value;
        const task = allTasks.find(function (t) { return t.id === taskId; });
        if (task && task.status !== newStatus) {
          try {
            await window.OneSpaceAPI.updateTask(workspaceId, taskId, { status: newStatus });
            window.OneSpaceUtils.showSuccess("Task status updated");
            loadTasks();
          } catch (err) {
            window.OneSpaceUtils.showError(err.message);
            loadTasks();
          }
        }
      });
    });

    // Quick status button in Kanban View
    container.querySelectorAll(".quick-status-btn").forEach(function (btn) {
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        const taskId = this.dataset.id;
        const targetStatus = this.dataset.targetStatus;
        try {
          await window.OneSpaceAPI.updateTask(workspaceId, taskId, { status: targetStatus });
          window.OneSpaceUtils.showSuccess(`Moved to ${targetStatus}`);
          loadTasks();
        } catch (err) {
          window.OneSpaceUtils.showError(err.message);
        }
      });
    });

    // Edit buttons
    container.querySelectorAll(".edit-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        openEditModal(this.dataset.id);
      });
    });

    // Delete buttons
    container.querySelectorAll(".delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteTask(this.dataset.id);
      });
    });
  }

  // Column + buttons
  document.querySelectorAll(".add-column-task-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const defaultStatus = this.dataset.status || "To Do";
      openAddModal(defaultStatus);
    });
  });

  function openAddModal(defaultStatus = "To Do") {
    taskForm.reset();
    taskForm.classList.remove("was-validated");
    taskIdInput.value = "";
    modalLabel.textContent = "New Task";
    taskStatusInput.value = defaultStatus;
    taskPriorityInput.value = "Medium";
    taskDueDateInput.value = "";
    taskModal.show();
  }

  function openEditModal(taskId) {
    const task = allTasks.find(function (t) { return t.id === taskId; });
    if (!task) return;
    taskForm.reset();
    taskForm.classList.remove("was-validated");
    taskIdInput.value = task.id;
    taskTitleInput.value = task.title || "";
    taskDescriptionInput.value = task.description || "";
    taskStatusInput.value = task.status || "To Do";
    taskPriorityInput.value = task.priority || "Medium";
    taskDueDateInput.value = task.due_date || "";
    modalLabel.textContent = "Edit Task";
    taskModal.show();
  }

  taskForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!taskForm.checkValidity()) {
      taskForm.classList.add("was-validated");
      return;
    }

    setSubmitLoading(true);
    const data = {
      title: taskTitleInput.value.trim(),
      description: taskDescriptionInput.value.trim(),
      status: taskStatusInput.value,
      priority: taskPriorityInput.value,
      due_date: taskDueDateInput.value || null
    };

    try {
      if (taskIdInput.value) {
        await window.OneSpaceAPI.updateTask(workspaceId, taskIdInput.value, data);
        window.OneSpaceUtils.showSuccess("Task updated");
      } else {
        await window.OneSpaceAPI.createTask(workspaceId, data);
        window.OneSpaceUtils.showSuccess("Task created");
      }
      taskModal.hide();
      loadTasks();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  });

  async function deleteTask(taskId) {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      await window.OneSpaceAPI.deleteTask(workspaceId, taskId);
      window.OneSpaceUtils.showSuccess("Task deleted");
      loadTasks();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    }
  }

  function setSubmitLoading(isLoading) {
    taskSubmit.disabled = isLoading;
    taskBtnText.classList.toggle("d-none", isLoading);
    taskBtnLoading.classList.toggle("d-none", !isLoading);
  }

  // Event listeners
  addTaskBtn.addEventListener("click", function () { openAddModal("To Do"); });
  emptyAddTaskBtn.addEventListener("click", function () { openAddModal("To Do"); });
  statusFilter.addEventListener("change", applyFilters);
  priorityFilter.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", window.OneSpaceUtils.debounce(applyFilters, 300));
  clearSearch.addEventListener("click", function () {
    searchInput.value = "";
    applyFilters();
  });

  taskModalEl.addEventListener("hidden.bs.modal", function () {
    taskForm.reset();
    taskForm.classList.remove("was-validated");
  });

  // Initialize view mode
  setViewMode(currentViewMode);

  // Initial load
  loadTasks();
});