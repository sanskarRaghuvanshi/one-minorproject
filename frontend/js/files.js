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

  const filesBody = document.getElementById("filesBody");
  const filesEmpty = document.getElementById("filesEmpty");
  const filesTable = document.getElementById("filesTable");
  const filesCountBadge = document.getElementById("filesCountBadge");
  const uploadFileBtn = document.getElementById("uploadFileBtn");
  const dropzone = document.getElementById("dropzone");
  const filePickerInput = document.getElementById("filePickerInput");

  const uploadProgress = document.getElementById("uploadProgress");
  const uploadFileName = document.getElementById("uploadFileName");
  const uploadProgressPercent = document.getElementById("uploadProgressPercent");
  const uploadProgressBar = document.getElementById("uploadProgressBar");

  let isUploading = false;
  let isOpeningDialog = false;

  async function loadFiles() {
    try {
      const files = await window.OneSpaceAPI.getFiles(workspaceId);
      renderFiles(files);
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to load files");
    }
  }

  function renderFiles(files) {
    if (filesCountBadge) {
      filesCountBadge.textContent = `${files.length} file${files.length === 1 ? "" : "s"}`;
    }

    if (!files.length) {
      filesBody.innerHTML = "";
      filesTable.classList.add("d-none");
      filesEmpty.classList.remove("d-none");
      return;
    }

    filesTable.classList.remove("d-none");
    filesEmpty.classList.add("d-none");

    filesBody.innerHTML = files.map(function (f) {
      const size = window.OneSpaceUtils.formatFileSize(f.size);
      const ext = f.filename.split(".").pop().toLowerCase();
      let icon = "description";
      let iconColor = "text-primary bg-primary/10";

      if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) {
        icon = "image";
        iconColor = "text-purple-600 bg-purple-500/10";
      } else if (["pdf"].includes(ext)) {
        icon = "picture_as_pdf";
        iconColor = "text-rose-600 bg-rose-500/10";
      } else if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) {
        icon = "folder_zip";
        iconColor = "text-amber-600 bg-amber-500/10";
      } else if (["js", "py", "html", "css", "ts", "json", "md"].includes(ext)) {
        icon = "code";
        iconColor = "text-emerald-600 bg-emerald-500/10";
      }

      return `
        <tr data-id="${f.id}" class="hover:bg-surface-container-low/50 transition-colors">
          <td class="px-md py-sm">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-[18px]">${icon}</span>
              </div>
              <span class="font-medium text-sm text-on-surface truncate max-w-xs md:max-w-md">${window.OneSpaceUtils.escapeHtml(f.filename)}</span>
            </div>
          </td>
          <td class="px-md py-sm hidden sm:table-cell text-xs text-on-surface-variant font-medium">${size}</td>
          <td class="px-md py-sm hidden md:table-cell text-xs text-on-surface-variant">${window.OneSpaceUtils.formatRelativeTime(f.upload_date)}</td>
          <td class="px-md py-sm text-right">
            <div class="inline-flex items-center gap-1">
              ${window.OneSpaceConfig.USE_MOCK_DATA ? `
                <button type="button" class="p-1.5 rounded-lg border border-outline-variant/40 text-on-surface-variant/40 cursor-not-allowed" title="Download unavailable in mock mode" aria-label="Download unavailable">
                  <span class="material-symbols-outlined text-[16px]">download</span>
                </button>
              ` : `
                <button type="button" class="p-1.5 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-high transition-colors download-btn" onclick="downloadFile('${window.OneSpaceUtils.escapeHtml(f.id)}')" title="Download file" aria-label="Download file">
                  <span class="material-symbols-outlined text-[16px]">download</span>
                </button>
              `}
              <button type="button" class="p-1.5 rounded-lg border border-outline-variant/50 text-error hover:bg-error-container/30 transition-colors delete-btn" data-id="${f.id}" title="Delete file" aria-label="Delete file">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    filesBody.querySelectorAll(".delete-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { deleteFile(this.dataset.id); });
    });
  }

  // Upload file with visual progress tracking
  async function uploadFile(file) {
    if (!file) return;
    if (isUploading) return;
    isUploading = true;

    // Show progress
    if (uploadProgress) {
      uploadProgress.classList.remove("d-none");
      uploadFileName.textContent = file.name;
      uploadProgressPercent.textContent = "0%";
      uploadProgressBar.style.width = "0%";
    }

    try {
      if (window.OneSpaceConfig.USE_MOCK_DATA) {
        await window.OneSpaceAPI.createMockFile(workspaceId, {
          filename: file.name,
          size: file.size
        });
        window.OneSpaceUtils.showSuccess(`File "${file.name}" added (mock)`);
      } else {
        const formData = new FormData();
        formData.append("file", file);

        const token = window.OneSpaceAuth ? window.OneSpaceAuth.getToken() : "";
        const xhr = new XMLHttpRequest();

        await new Promise(function (resolve, reject) {
          xhr.open("POST", `${window.OneSpaceConfig.API_BASE_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/files/`);

          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }

          xhr.upload.onprogress = function (e) {
            if (e.lengthComputable && uploadProgress) {
              const percent = Math.round((e.loaded / e.total) * 100);
              uploadProgressPercent.textContent = `${percent}%`;
              uploadProgressBar.style.width = `${percent}%`;
            }
          };

          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.response);
            } else {
              let msg = "Upload failed";
              try {
                const res = JSON.parse(xhr.responseText);
                if (res && res.message) msg = res.message;
              } catch (_) {}
              reject(new Error(msg));
            }
          };

          xhr.onerror = function () {
            reject(new Error("Network error during file upload"));
          };

          xhr.send(formData);
        });

        window.OneSpaceUtils.showSuccess(`"${file.name}" uploaded successfully`);
      }

      await loadFiles();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message || "Failed to upload file");
    } finally {
      isUploading = false;
      if (uploadProgress) {
        setTimeout(function () {
          uploadProgress.classList.add("d-none");
          uploadProgressBar.style.width = "0%";
        }, 1200);
      }
    }
  }

  // Safe file picker trigger with debounce guard
  function triggerFilePicker(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isOpeningDialog || isUploading) return;
    isOpeningDialog = true;

    // Reset value so change event always fires
    filePickerInput.value = "";

    // Trigger click on static element
    try {
      filePickerInput.click();
    } catch (err) {
      console.warn("File picker trigger failed:", err);
    }

    // Release dialog lock after window refocus
    setTimeout(function () {
      isOpeningDialog = false;
    }, 1000);
  }

  // Listeners for file picker
  if (uploadFileBtn) {
    uploadFileBtn.addEventListener("click", triggerFilePicker);
  }

  if (dropzone) {
    dropzone.addEventListener("click", function (e) {
      triggerFilePicker(e);
    });

    // Drag and Drop handlers
    ["dragenter", "dragover"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("border-primary", "bg-primary/5", "scale-[1.01]");
      });
    });

    ["dragleave", "drop"].forEach(function (eventName) {
      dropzone.addEventListener(eventName, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("border-primary", "bg-primary/5", "scale-[1.01]");
      });
    });

    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) {
        uploadFile(dt.files[0]);
      }
    });
  }

  filePickerInput.addEventListener("change", function () {
    if (filePickerInput.files && filePickerInput.files.length) {
      uploadFile(filePickerInput.files[0]);
    }
  });

  // Download file
  window.downloadFile = async function (fileId) {
    try {
      const response = await fetch(
        `${window.OneSpaceConfig.API_BASE_URL}/api/workspaces/${workspaceId}/files/${fileId}/download/`,
        {
          headers: {
            "Authorization": `Bearer ${window.OneSpaceAuth.getToken()}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download file");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      let filename = response.headers.get("X-Original-Filename") || "";
      if (!filename && disposition) {
        const match = disposition.match(/filename\*?=['"]?(?:UTF-\d['"]*)?([^;\r\n"']*)['"]?/i);
        if (match && match[1]) filename = match[1].trim();
      }
      if (!filename) filename = "file";

      if (window.downloadFile.lastUrl) {
        URL.revokeObjectURL(window.downloadFile.lastUrl);
      }

      const url = URL.createObjectURL(blob);
      window.downloadFile.lastUrl = url;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    }
  };

  // Delete file
  async function deleteFile(fileId) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    try {
      await window.OneSpaceAPI.deleteFile(workspaceId, fileId);
      window.OneSpaceUtils.showSuccess("File deleted");
      loadFiles();
    } catch (err) {
      window.OneSpaceUtils.showError(err.message);
    }
  }

  loadFiles();
});