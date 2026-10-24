window.OneSpaceAPI = window.OneSpaceAPI || {};

const ONE_SPACE_STORAGE_KEYS = {
  users: "onespace_users",
  workspaces: "onespace_workspaces",
  tasks: "onespace_tasks",
  notes: "onespace_notes",
  resources: "onespace_resources",
  files: "onespace_files",
  snippets: "onespace_snippets",
  activity: "onespace_activity"
};

window.OneSpaceAPI.getWorkspaces = async function () {
  return withMockData(async function () {
    return readCollection(ONE_SPACE_STORAGE_KEYS.workspaces);
  }, async function () {
    return requestJson("/api/workspaces/", "GET");
  });
};

window.OneSpaceAPI.createWorkspace = async function (data) {
  return withMockData(async function () {
    const workspace = normalizeWorkspace(data);
    const workspaces = await readCollection(ONE_SPACE_STORAGE_KEYS.workspaces);
    workspace.id = createId("ws");
    workspace.created_at = nowIsoString();
    workspace.updated_at = workspace.created_at;
    workspace.archived = false;
    workspaces.push(workspace);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.workspaces, workspaces);
    return clone(workspace);
  }, async function () {
    return requestJson("/api/workspaces/", "POST", data);
  });
};

window.OneSpaceAPI.updateWorkspace = async function (id, data) {
  return withMockData(async function () {
    const workspaces = await readCollection(ONE_SPACE_STORAGE_KEYS.workspaces);
    const index = findIndexById(workspaces, id);
    if (index === -1) {
      throw new Error("Workspace not found.");
    }
    const updated = {
      ...clone(workspaces[index]),
      ...normalizeWorkspace(data, true),
      id: workspaces[index].id,
      created_at: workspaces[index].created_at,
      updated_at: nowIsoString()
    };
    workspaces[index] = updated;
    await writeCollection(ONE_SPACE_STORAGE_KEYS.workspaces, workspaces);
    return clone(updated);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(id)}/`, "PATCH", data);
  });
};

window.OneSpaceAPI.archiveWorkspace = async function (id) {
  return withMockData(async function () {
    const workspaces = await readCollection(ONE_SPACE_STORAGE_KEYS.workspaces);
    const index = findIndexById(workspaces, id);
    if (index === -1) {
      throw new Error("Workspace not found.");
    }
    workspaces[index].archived = true;
    workspaces[index].updated_at = nowIsoString();
    await writeCollection(ONE_SPACE_STORAGE_KEYS.workspaces, workspaces);
    return clone(workspaces[index]);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(id)}/archive/`, "POST");
  });
};

window.OneSpaceAPI.deleteWorkspace = async function (id) {
  return withMockData(async function () {
    const workspaces = await readCollection(ONE_SPACE_STORAGE_KEYS.workspaces);
    const index = findIndexById(workspaces, id);
    if (index === -1) {
      throw new Error("Workspace not found.");
    }
    workspaces.splice(index, 1);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.workspaces, workspaces);

    await Promise.all([
      filterCollectionByWorkspace(ONE_SPACE_STORAGE_KEYS.tasks, id),
      filterCollectionByWorkspace(ONE_SPACE_STORAGE_KEYS.notes, id),
      filterCollectionByWorkspace(ONE_SPACE_STORAGE_KEYS.resources, id),
      filterCollectionByWorkspace(ONE_SPACE_STORAGE_KEYS.files, id),
      filterCollectionByWorkspace(ONE_SPACE_STORAGE_KEYS.snippets, id),
      filterCollectionByWorkspace(ONE_SPACE_STORAGE_KEYS.activity, id)
    ]);
    return { success: true };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(id)}/`, "DELETE");
  });
};

window.OneSpaceAPI.getTasks = async function (workspaceId) {
  return withMockData(async function () {
    return filterByWorkspace(ONE_SPACE_STORAGE_KEYS.tasks, workspaceId);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/`, "GET");
  });
};

window.OneSpaceAPI.createTask = async function (workspaceId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const task = normalizeTask(data);
    task.id = createId("task");
    task.workspace_id = workspaceId;
    task.created_at = nowIsoString();
    task.updated_at = task.created_at;
    const tasks = await readCollection(ONE_SPACE_STORAGE_KEYS.tasks);
    tasks.push(task);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.tasks, tasks);
    await logActivity(workspaceId, "task_created", `Created task "${task.title}"`);
    return clone(task);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/`, "POST", data);
  });
};

window.OneSpaceAPI.updateTask = async function (workspaceId, taskId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const tasks = await readCollection(ONE_SPACE_STORAGE_KEYS.tasks);
    const index = findIndexById(tasks, taskId);
    if (index === -1 || tasks[index].workspace_id !== workspaceId) {
      throw new Error("Task not found.");
    }
    const updated = {
      ...clone(tasks[index]),
      ...normalizeTask(data, true),
      id: tasks[index].id,
      workspace_id: workspaceId,
      created_at: tasks[index].created_at,
      updated_at: nowIsoString()
    };
    tasks[index] = updated;
    await writeCollection(ONE_SPACE_STORAGE_KEYS.tasks, tasks);
    const actionMsg = updated.status === "Done" ? `Completed task "${updated.title}"` : `Updated task "${updated.title}"`;
    const actionType = updated.status === "Done" ? "task_completed" : "task_updated";
    await logActivity(workspaceId, actionType, actionMsg);
    return clone(updated);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/`, "PATCH", data);
  });
};

window.OneSpaceAPI.deleteTask = async function (workspaceId, taskId) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const tasks = await readCollection(ONE_SPACE_STORAGE_KEYS.tasks);
    const index = findIndexById(tasks, taskId);
    if (index === -1 || tasks[index].workspace_id !== workspaceId) {
      throw new Error("Task not found.");
    }
    tasks.splice(index, 1);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.tasks, tasks);
    return { success: true };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/`, "DELETE");
  });
};

window.OneSpaceAPI.getNotes = async function (workspaceId) {
  return withMockData(async function () {
    return filterByWorkspace(ONE_SPACE_STORAGE_KEYS.notes, workspaceId);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/notes/`, "GET");
  });
};

window.OneSpaceAPI.createNote = async function (workspaceId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const note = normalizeNote(data);
    note.id = createId("note");
    note.workspace_id = workspaceId;
    note.created_at = nowIsoString();
    note.updated_at = note.created_at;
    const notes = await readCollection(ONE_SPACE_STORAGE_KEYS.notes);
    notes.push(note);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.notes, notes);
    await logActivity(workspaceId, "note_created", `Created note "${note.title}"`);
    return clone(note);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/notes/`, "POST", data);
  });
};

window.OneSpaceAPI.updateNote = async function (workspaceId, noteId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const notes = await readCollection(ONE_SPACE_STORAGE_KEYS.notes);
    const index = findIndexById(notes, noteId);
    if (index === -1 || notes[index].workspace_id !== workspaceId) {
      throw new Error("Note not found.");
    }
    const updated = {
      ...clone(notes[index]),
      ...normalizeNote(data, true),
      id: notes[index].id,
      workspace_id: workspaceId,
      created_at: notes[index].created_at,
      updated_at: nowIsoString()
    };
    notes[index] = updated;
    await writeCollection(ONE_SPACE_STORAGE_KEYS.notes, notes);
    return clone(updated);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(noteId)}/`, "PATCH", data);
  });
};

window.OneSpaceAPI.deleteNote = async function (workspaceId, noteId) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const notes = await readCollection(ONE_SPACE_STORAGE_KEYS.notes);
    const index = findIndexById(notes, noteId);
    if (index === -1 || notes[index].workspace_id !== workspaceId) {
      throw new Error("Note not found.");
    }
    notes.splice(index, 1);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.notes, notes);
    return { success: true };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/notes/${encodeURIComponent(noteId)}/`, "DELETE");
  });
};

window.OneSpaceAPI.getResources = async function (workspaceId) {
  return withMockData(async function () {
    return filterByWorkspace(ONE_SPACE_STORAGE_KEYS.resources, workspaceId);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/resources/`, "GET");
  });
};

window.OneSpaceAPI.createResource = async function (workspaceId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const resource = normalizeResource(data);
    resource.id = createId("resource");
    resource.workspace_id = workspaceId;
    resource.created_at = nowIsoString();
    resource.updated_at = resource.created_at;
    const resources = await readCollection(ONE_SPACE_STORAGE_KEYS.resources);
    resources.push(resource);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.resources, resources);
    await logActivity(workspaceId, "resource_added", `Added resource "${resource.title}"`);
    return clone(resource);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/resources/`, "POST", data);
  });
};

window.OneSpaceAPI.updateResource = async function (workspaceId, resourceId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const resources = await readCollection(ONE_SPACE_STORAGE_KEYS.resources);
    const index = findIndexById(resources, resourceId);
    if (index === -1 || resources[index].workspace_id !== workspaceId) {
      throw new Error("Resource not found.");
    }
    const updated = {
      ...clone(resources[index]),
      ...normalizeResource(data, true),
      id: resources[index].id,
      workspace_id: workspaceId,
      created_at: resources[index].created_at,
      updated_at: nowIsoString()
    };
    resources[index] = updated;
    await writeCollection(ONE_SPACE_STORAGE_KEYS.resources, resources);
    return clone(updated);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/resources/${encodeURIComponent(resourceId)}/`, "PATCH", data);
  });
};

window.OneSpaceAPI.deleteResource = async function (workspaceId, resourceId) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const resources = await readCollection(ONE_SPACE_STORAGE_KEYS.resources);
    const index = findIndexById(resources, resourceId);
    if (index === -1 || resources[index].workspace_id !== workspaceId) {
      throw new Error("Resource not found.");
    }
    resources.splice(index, 1);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.resources, resources);
    return { success: true };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/resources/${encodeURIComponent(resourceId)}/`, "DELETE");
  });
};

window.OneSpaceAPI.getFiles = async function (workspaceId) {
  return withMockData(async function () {
    return filterByWorkspace(ONE_SPACE_STORAGE_KEYS.files, workspaceId);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/files/`, "GET");
  });
};

window.OneSpaceAPI.createMockFile = async function (workspaceId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const file = normalizeFile(data);
    file.id = createId("file");
    file.workspace_id = workspaceId;
    file.upload_date = nowIsoString();
    const files = await readCollection(ONE_SPACE_STORAGE_KEYS.files);
    files.push(file);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.files, files);
    await logActivity(workspaceId, "file_uploaded", `Uploaded ${file.filename}`);
    return clone(file);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/files/`, "POST", data, true);
  });
};

window.OneSpaceAPI.deleteFile = async function (workspaceId, fileId) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const files = await readCollection(ONE_SPACE_STORAGE_KEYS.files);
    const index = findIndexById(files, fileId);
    if (index === -1 || files[index].workspace_id !== workspaceId) {
      throw new Error("File not found.");
    }
    files.splice(index, 1);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.files, files);
    return { success: true };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/files/${encodeURIComponent(fileId)}/`, "DELETE");
  });
};

window.OneSpaceAPI.getSnippets = async function (workspaceId) {
  return withMockData(async function () {
    return filterByWorkspace(ONE_SPACE_STORAGE_KEYS.snippets, workspaceId);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/snippets/`, "GET");
  });
};

window.OneSpaceAPI.createSnippet = async function (workspaceId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const snippet = normalizeSnippet(data);
    snippet.id = createId("snippet");
    snippet.workspace_id = workspaceId;
    snippet.created_at = nowIsoString();
    snippet.updated_at = snippet.created_at;
    const snippets = await readCollection(ONE_SPACE_STORAGE_KEYS.snippets);
    snippets.push(snippet);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.snippets, snippets);
    await logActivity(workspaceId, "snippet_created", `Saved program "${snippet.title}"`);
    return clone(snippet);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/snippets/`, "POST", data);
  });
};

window.OneSpaceAPI.updateSnippet = async function (workspaceId, snippetId, data) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const snippets = await readCollection(ONE_SPACE_STORAGE_KEYS.snippets);
    const index = findIndexById(snippets, snippetId);
    if (index === -1 || snippets[index].workspace_id !== workspaceId) {
      throw new Error("Program not found.");
    }
    const updated = {
      ...clone(snippets[index]),
      ...normalizeSnippet(data, true),
      id: snippets[index].id,
      workspace_id: workspaceId,
      created_at: snippets[index].created_at,
      updated_at: nowIsoString()
    };
    snippets[index] = updated;
    await writeCollection(ONE_SPACE_STORAGE_KEYS.snippets, snippets);
    await logActivity(workspaceId, "snippet_updated", `Updated program "${updated.title}"`);
    return clone(updated);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/snippets/${encodeURIComponent(snippetId)}/`, "PATCH", data);
  });
};

window.OneSpaceAPI.deleteSnippet = async function (workspaceId, snippetId) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const snippets = await readCollection(ONE_SPACE_STORAGE_KEYS.snippets);
    const index = findIndexById(snippets, snippetId);
    if (index === -1 || snippets[index].workspace_id !== workspaceId) {
      throw new Error("Program not found.");
    }
    snippets.splice(index, 1);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.snippets, snippets);
    return { success: true };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/snippets/${encodeURIComponent(snippetId)}/`, "DELETE");
  });
};

window.OneSpaceAPI.getActivity = async function (workspaceId) {
  return withMockData(async function () {
    return filterByWorkspace(ONE_SPACE_STORAGE_KEYS.activity, workspaceId);
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/activity/`, "GET");
  });
};

window.OneSpaceAPI.searchWorkspace = async function (workspaceId, query) {
  return withMockData(async function () {
    await requireWorkspace(workspaceId);
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
      return { tasks: [], notes: [], resources: [], files: [] };
    }

    const tasks = (await readCollection(ONE_SPACE_STORAGE_KEYS.tasks)).filter(function (task) {
      return task.workspace_id === workspaceId && matchesQuery(task, ["title", "description", "status", "priority"], normalizedQuery);
    });
    const notes = (await readCollection(ONE_SPACE_STORAGE_KEYS.notes)).filter(function (note) {
      return note.workspace_id === workspaceId && matchesQuery(note, ["title", "body"], normalizedQuery);
    });
    const resources = (await readCollection(ONE_SPACE_STORAGE_KEYS.resources)).filter(function (resource) {
      return resource.workspace_id === workspaceId && matchesQuery(resource, ["title", "description", "url"], normalizedQuery);
    });
    const files = (await readCollection(ONE_SPACE_STORAGE_KEYS.files)).filter(function (file) {
      return file.workspace_id === workspaceId && matchesQuery(file, ["filename"], normalizedQuery);
    });

    return {
      tasks: tasks.map(clone),
      notes: notes.map(clone),
      resources: resources.map(clone),
      files: files.map(clone)
    };
  }, async function () {
    return requestJson(`/api/workspaces/${encodeURIComponent(workspaceId)}/search/?q=${encodeURIComponent(query || "")}`, "GET");
  });
};

async function withMockData(mockOperation, realOperation) {
  if (window.OneSpaceConfig.USE_MOCK_DATA) {
    if (window.OneSpaceMockData) {
      window.OneSpaceMockData.seed();
    }
    return Promise.resolve().then(mockOperation);
  }
  return realOperation();
}

async function readCollection(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeCollection(key, collection) {
  window.localStorage.setItem(key, JSON.stringify(collection));
}

async function filterByWorkspace(key, workspaceId) {
  const collection = await readCollection(key);
  return collection.filter(function (item) {
    return item.workspace_id === workspaceId;
  }).map(clone);
}

async function filterCollectionByWorkspace(key, workspaceId) {
  const collection = await readCollection(key);
  const filtered = collection.filter(function (item) {
    return item.workspace_id !== workspaceId;
  });
  await writeCollection(key, filtered);
  return filtered;
}

async function logActivity(workspaceId, type, message) {
  try {
    const activities = await readCollection(ONE_SPACE_STORAGE_KEYS.activity);
    const item = {
      id: createId("activity"),
      workspace_id: workspaceId,
      type: type,
      message: message,
      timestamp: nowIsoString()
    };
    activities.unshift(item);
    await writeCollection(ONE_SPACE_STORAGE_KEYS.activity, activities);
  } catch (err) {
    // Non-fatal if activity logging fails
  }
}

async function requireWorkspace(workspaceId) {
  const workspaces = await readCollection(ONE_SPACE_STORAGE_KEYS.workspaces);
  if (findIndexById(workspaces, workspaceId) === -1) {
    throw new Error("Workspace not found.");
  }
}

function normalizeWorkspace(data, partial = false) {
  const normalized = {};
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "name")) {
    normalized.name = String(data.name || "").trim();
    if (!normalized.name) {
      throw new Error("Workspace name is required.");
    }
  }
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "description")) {
    normalized.description = String(data.description || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(data || {}, "archived")) {
    normalized.archived = Boolean(data.archived);
  }
  return normalized;
}

function normalizeTask(data, partial = false) {
  const normalized = {};
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "title")) {
    normalized.title = String(data.title || "").trim();
    if (!normalized.title) {
      throw new Error("Task title is required.");
    }
  }
  copyOptionalString(data, normalized, "description", partial);
  copyOptionalString(data, normalized, "status", partial);
  copyOptionalString(data, normalized, "priority", partial);
  copyOptionalString(data, normalized, "due_date", partial);
  return normalized;
}

function normalizeNote(data, partial = false) {
  const normalized = {};
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "title")) {
    normalized.title = String(data.title || "").trim();
    if (!normalized.title) {
      throw new Error("Note title is required.");
    }
  }
  copyOptionalString(data, normalized, "body", partial);
  return normalized;
}

function normalizeResource(data, partial = false) {
  const normalized = {};
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "title")) {
    normalized.title = String(data.title || "").trim();
    if (!normalized.title) {
      throw new Error("Resource title is required.");
    }
  }
  copyOptionalString(data, normalized, "url", partial);
  copyOptionalString(data, normalized, "description", partial);
  return normalized;
}

function normalizeFile(data) {
  const filename = String(data.filename || "").trim();
  if (!filename) {
    throw new Error("Filename is required.");
  }
  const size = Number(data.size);
  return {
    filename,
    size: Number.isFinite(size) && size >= 0 ? size : 0
  };
}

function normalizeSnippet(data, partial = false) {
  const normalized = {};
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "title")) {
    normalized.title = String(data.title || "").trim() || "Untitled program";
  }
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "language")) {
    normalized.language = String(data.language || "").trim();
  }
  if (!partial || Object.prototype.hasOwnProperty.call(data || {}, "code")) {
    normalized.code = String(data.code || "");
  }
  return normalized;
}

function copyOptionalString(source, target, key, partial) {
  if (partial && !Object.prototype.hasOwnProperty.call(source || {}, key)) {
    return;
  }
  target[key] = String(source[key] || "");
}

function matchesQuery(item, fields, query) {
  return fields.some(function (field) {
    return String(item[field] || "").toLowerCase().includes(query);
  });
}

function findIndexById(collection, id) {
  return collection.findIndex(function (item) {
    return item.id === id;
  });
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIsoString() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function requestJson(path, method, body = null, useFormData = false) {
  const headers = {};
  const token = window.OneSpaceAuth ? window.OneSpaceAuth.getToken() : "";
  let payload = body;
  const isLoginRequest = path.includes("/api/auth/login/");

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== null && !useFormData) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${window.OneSpaceConfig.API_BASE_URL}${path}`, {
      method,
      headers,
      body: payload
    });
  } catch (netErr) {
    console.error("Network / API Error:", netErr);
    throw new Error(
      "Unable to connect to backend server. If running on Render free tier, it may be waking up from sleep (~30-50 seconds). Please try again in a moment."
    );
  }

  let responseData = null;
  try {
    responseData = await response.json();
  } catch (error) {
    responseData = null;
  }

  if (!response.ok) {
    // On 401 (invalid/expired token), clear auth and redirect to login
    // except during the login request itself to avoid redirect loops
    if (response.status === 401 && !isLoginRequest) {
      window.OneSpaceAuth.clearToken();
      window.location.replace("login.html");
    }

    const message = responseData && responseData.message ? responseData.message : "The request could not be completed.";
    throw new Error(message);
  }
  return responseData && Object.prototype.hasOwnProperty.call(responseData, "data") ? responseData.data : responseData;
}
