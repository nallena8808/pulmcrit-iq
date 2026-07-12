const SERVER_ORIGIN = window.location.protocol === "file:"
  ? "http://127.0.0.1:4177"
  : window.location.hostname === "127.0.0.1" && ["4173", "4174", "4175", "4176"].includes(window.location.port)
    ? "http://127.0.0.1:4177"
    : "";
if (window.location.protocol === "file:") {
  window.location.href = `${SERVER_ORIGIN}/admin.html`;
}

let adminAccessKey = "";
const ADMIN_SESSION_KEY = "pulmcrit-iq-admin-key";

const adminKey = document.querySelector("#admin-key");
const adminUnlock = document.querySelector("#admin-unlock");
const adminLockStatus = document.querySelector("#admin-lock-status");
const uploadForm = document.querySelector("#admin-upload-form");
const adminSection = document.querySelector("#admin-section");
const adminFiles = document.querySelector("#admin-files");
const adminUploadTitle = document.querySelector("#admin-upload-title");
const adminUploadTitleLabel = document.querySelector("#admin-upload-title-label");
const adminUploadNote = document.querySelector("#admin-upload-note");
const adminUploadNoteLabel = document.querySelector("#admin-upload-note-label");
const adminFileMetaList = document.querySelector("#admin-file-meta-list");
const adminUploadLinkWrap = document.querySelector("#admin-upload-link-wrap");
const adminUploadLinkLabel = document.querySelector("#admin-upload-link-label");
const adminUploadLink = document.querySelector("#admin-upload-link");
const adminUploadGuidelineBucketWrap = document.querySelector("#admin-upload-guideline-bucket-wrap");
const adminUploadGuidelineBucket = document.querySelector("#admin-upload-guideline-bucket");
const adminUploadTrialBucketWrap = document.querySelector("#admin-upload-trial-bucket-wrap");
const adminUploadTrialBucket = document.querySelector("#admin-upload-trial-bucket");
const adminUploadImageBucketWrap = document.querySelector("#admin-upload-image-bucket-wrap");
const adminUploadImageBucket = document.querySelector("#admin-upload-image-bucket");
const adminUploadStatus = document.querySelector("#admin-upload-status");
const libraryList = document.querySelector("#admin-library-list");
const adminTileHeight = document.querySelector("#admin-tile-height");
const adminTileHeightLabel = document.querySelector("#admin-tile-height-label");
const adminTileOrderList = document.querySelector("#admin-tile-order-list");
const adminSaveLayout = document.querySelector("#admin-save-layout");
const adminLayoutStatus = document.querySelector("#admin-layout-status");
const adminHeroForm = document.querySelector("#admin-hero-form");
const adminHeroFile = document.querySelector("#admin-hero-file");
const adminHeroNote = document.querySelector("#admin-hero-note");
const adminHeroStatus = document.querySelector("#admin-hero-status");

let currentLibrary = { articles: [], uploads: [], subtopics: [] };
let currentTileOrder = ["1", "2", "6", "9", "10", "3", "4", "8", "5"];
let trialBucketTouched = false;
const contentChannel = "BroadcastChannel" in window ? new BroadcastChannel("pulmcrit-iq-content") : null;

const sectionLabels = {
  "latest-articles": "Latest PCCM Articles",
  guidelines: "Guidelines",
  "ventilator-lab": "Ventilator Hub",
  "pulmonary-physiology": "Pulmonary Physiology",
  "case-rounds": "Case Rounds",
  "landmark-trials": "Landmark Trials",
  "image-atlas": "PCCM Image Atlas",
  airway: "Airway",
  "critical-care": "Critical Care",
};

const tileLabels = {
  "1": "Latest PCCM Articles",
  "2": "Guidelines",
  "3": "Ventilator Hub",
  "4": "Pulmonary Physiology",
  "5": "Case Rounds",
  "6": "Landmark Trials",
  "8": "PCCM Image Atlas",
  "9": "Airway",
  "10": "Critical Care",
};

function labelToSection(label) {
  const match = Object.entries(sectionLabels).find(([, value]) => value === label);
  return match?.[0] || "";
}

function setAdminEnabled(enabled) {
  document.querySelectorAll("input, select, textarea, button").forEach((control) => {
    if (control.id === "admin-key" || control.id === "admin-unlock") return;
    if (control.matches("[data-toggle-password]")) return;
    control.disabled = !enabled;
  });
  adminLockStatus.textContent = enabled ? "Unlocked" : "Locked";
  adminUploadStatus.textContent = enabled ? "Ready to upload." : "Unlock admin to upload.";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function notifyContentUpdated() {
  const payload = { type: "content-updated", updatedAt: Date.now() };
  contentChannel?.postMessage(payload);
  localStorage.setItem("pulmcrit-iq-content-updated", String(payload.updatedAt));
}

async function refreshLibrary() {
  const response = await fetch(`${SERVER_ORIGIN}/api/admin/content`, { cache: "no-store" });
  const library = await response.json();
  currentLibrary = library;
  const articles = library.articles || [];
  const uploads = library.uploads || [];
  renderHomeLayout(library.settings || {});
  renderUploadOptions();

  libraryList.innerHTML = `
    <small id="admin-library-status" class="admin-library-status">Delete removes the item from this library and the front end.</small>
    <div class="library-list">
      ${articles.map((article) => `
        <div class="library-item">
          <div class="library-item-main">
            <a href="${escapeHtml(article.link)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
            <small>${escapeHtml(article.tile)}${article.guidelineBucket ? ` · ${escapeHtml(article.guidelineBucket)}` : ""}${article.trialBucket ? ` · ${escapeHtml(article.trialBucket)}` : ""} · ${escapeHtml(article.source)} · ${escapeHtml(article.date)}</small>
          </div>
          <button class="delete-content-button" type="button" data-delete-type="article" data-delete-id="${escapeHtml(article.id)}">Delete</button>
        </div>
      `).join("")}
      ${uploads.map((upload) => `
        <div class="library-item">
          <div class="library-item-main">
            <a href="${escapeHtml(upload.path)}" target="_blank" rel="noreferrer">${escapeHtml(upload.title || upload.filename)}</a>
            <small>${escapeHtml(sectionLabels[upload.section] || upload.section)}${upload.mediaBucket ? ` · ${escapeHtml(upload.mediaBucket)}` : ""} · ${Math.round((upload.bytes || 0) / 1024)} KB</small>
          </div>
          <button class="delete-content-button" type="button" data-delete-type="upload" data-delete-id="${escapeHtml(upload.path || upload.filename)}">Delete</button>
        </div>
      `).join("")}
      ${!articles.length && !uploads.length ? '<div class="library-item">No admin content saved yet.</div>' : ""}
    </div>
  `;
}

async function deleteContent(type, id) {
  const key = adminAccessKey || sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
  const response = await fetch(`${SERVER_ORIGIN}/api/admin/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": key },
    body: JSON.stringify({ type, id }),
  });
  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText || "{}");
  } catch {
    throw new Error("Delete endpoint is not active yet. Restart the local preview, then refresh admin.");
  }
  if (!response.ok) throw new Error(result.error || "Delete failed");
  if (!result.ok) throw new Error(result.error || "Delete failed");
  if (!result.deleted) throw new Error("This item was not found in the content library.");
  notifyContentUpdated();
  await refreshLibrary();
  return result;
}

function normalizeTileOrder(tileOrder) {
  const defaults = Object.keys(tileLabels);
  const requested = Array.isArray(tileOrder) ? tileOrder.map(String).filter((tile) => defaults.includes(tile)) : currentTileOrder;
  return [...requested, ...defaults.filter((tile) => !requested.includes(tile))];
}

function renderHomeLayout(settings = {}) {
  currentTileOrder = normalizeTileOrder(settings.tileOrder);
  const height = Math.max(320, Math.min(500, Number(settings.tileHeight) || 500));
  adminTileHeight.value = String(height);
  adminTileHeightLabel.textContent = height === 500 ? "Current max height" : `Home tile height: ${height}px`;
  adminTileOrderList.innerHTML = currentTileOrder.map((tile, index) => `
    <div class="tile-order-item" data-tile="${escapeHtml(tile)}" draggable="true">
      <span class="drag-grip" aria-hidden="true">☰</span>
      <strong>${index + 1}. ${escapeHtml(tileLabels[tile])}</strong>
    </div>
  `).join("");
}

async function saveHomeLayout() {
  adminLayoutStatus.textContent = "Saving layout...";
  const response = await fetch(`${SERVER_ORIGIN}/api/admin/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminAccessKey },
    body: JSON.stringify({
      tileOrder: currentTileOrder,
      tileHeight: adminTileHeight.value,
    }),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Layout save failed");
  currentLibrary.settings = result.settings;
  renderHomeLayout(result.settings);
  adminLayoutStatus.textContent = "Home layout saved.";
}

function renderUploadOptions() {
  const uploadSection = adminSection.value;
  trialBucketTouched = false;
  adminUploadGuidelineBucketWrap.hidden = uploadSection !== "guidelines";
  adminUploadTrialBucketWrap.hidden = uploadSection !== "landmark-trials";
  adminUploadImageBucketWrap.hidden = uploadSection !== "image-atlas";
  const linkLabels = {
    "latest-articles": ["Article link", "Paste the PCCM article link"],
    guidelines: ["Guideline link", "Paste the guideline link"],
    "landmark-trials": ["Trial article link", "Paste the landmark trial article link"],
  };
  const linkConfig = linkLabels[uploadSection] || ["Article or reference link", "Paste a link for this tile"];
  adminUploadLinkWrap.hidden = false;
  adminUploadLinkLabel.textContent = linkConfig[0];
  adminUploadLink.placeholder = linkConfig[1];
  adminUploadTitleLabel.textContent = uploadSection === "landmark-trials" ? "Trial name" : "Name";
  adminUploadTitle.placeholder = uploadSection === "landmark-trials"
    ? "Type the trial name, e.g. INTERACT"
    : "Optional title; article links can auto-fill this";
  adminUploadNoteLabel.textContent = uploadSection === "landmark-trials" ? "Abstract" : "Description";
  adminUploadNote.placeholder = uploadSection === "landmark-trials"
    ? "Paste the abstract or your trial summary; it will appear when the trial is opened"
    : "Optional abstract, caption, teaching pearl, or description";
}

function renderFileMetaRows() {
  const files = [...adminFiles.files];
  adminFileMetaList.hidden = !files.length;
  adminFileMetaList.innerHTML = files.map((file, index) => `
    <fieldset class="file-meta-item">
      <legend>File ${index + 1}: ${escapeHtml(file.name)}</legend>
      <label>Name
        <input type="text" data-file-title="${index}" value="${escapeHtml(adminUploadTitle.value.trim() || file.name.replace(/\.[^.]+$/, ""))}" />
      </label>
      <label>Description
        <textarea rows="3" data-file-description="${index}">${escapeHtml(adminUploadNote.value.trim())}</textarea>
      </label>
    </fieldset>
  `).join("");
}

function collectFileMeta(files) {
  return files.map((file, index) => ({
    filename: file.name,
    title: adminFileMetaList.querySelector(`[data-file-title="${index}"]`)?.value.trim() || adminUploadTitle.value.trim() || file.name,
    description: adminFileMetaList.querySelector(`[data-file-description="${index}"]`)?.value.trim() || adminUploadNote.value.trim(),
  }));
}

async function unlockAdmin(key) {
  adminAccessKey = key.trim();
  if (!adminAccessKey) {
    setAdminEnabled(false);
    adminLockStatus.textContent = "Enter key";
    return;
  }
  adminLockStatus.textContent = "Checking...";
  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/admin/verify`, {
      headers: { "X-Admin-Key": adminAccessKey },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Incorrect key");
    sessionStorage.setItem(ADMIN_SESSION_KEY, adminAccessKey);
    adminKey.value = adminAccessKey;
    setAdminEnabled(true);
    await refreshLibrary();
  } catch {
    adminAccessKey = "";
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminEnabled(false);
    adminLockStatus.textContent = "Incorrect key";
  }
}

adminUnlock.addEventListener("click", async () => {
  await unlockAdmin(adminKey.value);
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-toggle-password]");
  if (!button) return;
  const input = document.querySelector(button.dataset.togglePassword);
  if (!input) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  button.textContent = showing ? "Show" : "Hide";
});

libraryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-type]");
  if (!button) return;
  const name = button.closest(".library-item")?.querySelector("a")?.textContent || "this item";
  const status = libraryList.querySelector("#admin-library-status") || adminUploadStatus;
  button.disabled = true;
  button.textContent = "Deleting...";
  status.textContent = `Deleting ${name}...`;
  try {
    await deleteContent(button.dataset.deleteType, button.dataset.deleteId);
    adminUploadStatus.textContent = `${name} deleted.`;
  } catch (error) {
    button.disabled = false;
    button.textContent = "Delete";
    status.textContent = `Delete failed: ${error.message}`;
    adminUploadStatus.textContent = `Delete failed: ${error.message}`;
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = [...adminFiles.files];
  const note = adminUploadNote.value.trim();
  const link = adminUploadLink.value.trim();
  const title = adminUploadTitle.value.trim();

  if (!files.length) {
    if (link) {
      try {
        const article = await saveArticleFromUpload({ link, note, title });
        adminUploadStatus.textContent = "Link saved.";
        if (adminSection.value === "landmark-trials" && article.trialBucket) {
          adminUploadStatus.textContent = `Link saved under ${article.trialBucket}.`;
        }
        adminUploadLink.value = "";
        adminUploadTitle.value = "";
        adminUploadNote.value = "";
      } catch (error) {
        adminUploadStatus.textContent = error.message;
      }
    } else {
      adminUploadStatus.textContent = "Choose files or paste a link first.";
    }
    notifyContentUpdated();
    await refreshLibrary();
    return;
  }

  const data = new FormData();
  files.forEach((file) => data.append("files", file, file.name));
  const fileMeta = collectFileMeta(files);
  adminUploadStatus.textContent = `Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`;
  const response = await fetch(`${SERVER_ORIGIN}/api/upload?section=${encodeURIComponent(adminSection.value)}&title=${encodeURIComponent(title)}&note=${encodeURIComponent(note)}&mediaBucket=${encodeURIComponent(adminSection.value === "image-atlas" ? adminUploadImageBucket.value : "")}&fileMeta=${encodeURIComponent(JSON.stringify(fileMeta))}`, {
    method: "POST",
    headers: { "X-Admin-Key": adminAccessKey },
    body: data,
  });
  const result = await response.json();
  adminUploadStatus.textContent = result.ok ? `${result.saved.length} file${result.saved.length === 1 ? "" : "s"} saved.` : "Upload failed.";
  if (result.ok && link) {
    try {
      await saveArticleFromUpload({ link, note, title });
      adminUploadStatus.textContent += " Link saved.";
    } catch (error) {
      adminUploadStatus.textContent += ` Link not saved: ${error.message}`;
    }
  }
  adminFiles.value = "";
  adminFileMetaList.innerHTML = "";
  adminFileMetaList.hidden = true;
  adminUploadTitle.value = "";
  adminUploadNote.value = "";
  adminUploadLink.value = "";
  notifyContentUpdated();
  await refreshLibrary();
});

async function saveArticleFromUpload({ link, note, title }) {
  const tile = sectionLabels[adminSection.value] || "Latest PCCM Articles";
  const response = await fetch(`${SERVER_ORIGIN}/api/admin/article`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Key": adminAccessKey },
    body: JSON.stringify({
      title,
      manualTitle: title,
      source: adminSection.value === "landmark-trials" ? "Landmark Trial" : "PulmCrit IQ Admin",
      link,
      tile,
      guidelineBucket: adminSection.value === "guidelines" ? adminUploadGuidelineBucket.value : "",
      trialBucket: adminSection.value === "landmark-trials" ? adminUploadTrialBucket.value : "",
      trialBucketLocked: adminSection.value === "landmark-trials" ? trialBucketTouched : false,
      summary: note,
    }),
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Link save failed");
  return result.article;
}

adminSection.addEventListener("change", renderUploadOptions);
adminUploadTrialBucket.addEventListener("change", () => {
  trialBucketTouched = true;
});
adminFiles.addEventListener("change", renderFileMetaRows);
adminUploadTitle.addEventListener("input", () => {
  if ([...adminFiles.files].length) renderFileMetaRows();
});
adminUploadNote.addEventListener("input", () => {
  if ([...adminFiles.files].length) renderFileMetaRows();
});
adminTileHeight.addEventListener("input", () => {
  adminTileHeightLabel.textContent = Number(adminTileHeight.value) === 500 ? "Current max height" : `Home tile height: ${adminTileHeight.value}px`;
});

adminTileOrderList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".tile-order-item");
  if (!item) return;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", item.dataset.tile);
});

adminTileOrderList.addEventListener("dragend", (event) => {
  event.target.closest(".tile-order-item")?.classList.remove("dragging");
});

adminTileOrderList.addEventListener("dragover", (event) => {
  event.preventDefault();
  const draggingTile = adminTileOrderList.querySelector(".tile-order-item.dragging");
  const target = event.target.closest(".tile-order-item");
  if (!draggingTile || !target || draggingTile === target) return;
  const targetBox = target.getBoundingClientRect();
  const insertAfter = event.clientY > targetBox.top + targetBox.height / 2;
  adminTileOrderList.insertBefore(draggingTile, insertAfter ? target.nextSibling : target);
});

adminTileOrderList.addEventListener("drop", (event) => {
  event.preventDefault();
  currentTileOrder = [...adminTileOrderList.querySelectorAll(".tile-order-item")].map((item) => item.dataset.tile);
  renderHomeLayout({ tileOrder: currentTileOrder, tileHeight: adminTileHeight.value });
});

adminSaveLayout.addEventListener("click", async () => {
  try {
    await saveHomeLayout();
    notifyContentUpdated();
  } catch (error) {
    adminLayoutStatus.textContent = error.message;
  }
});

adminHeroForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = adminHeroFile.files[0];
  if (!file) {
    adminHeroStatus.textContent = "Choose an image first.";
    return;
  }
  const data = new FormData();
  data.append("files", file, file.name);
  adminHeroStatus.textContent = "Uploading hero image...";
  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/upload?section=hero-image&note=${encodeURIComponent(adminHeroNote.value.trim())}&featuredSlot=1`, {
      method: "POST",
      headers: { "X-Admin-Key": adminAccessKey },
      body: data,
    });
    const result = await response.json();
    adminHeroStatus.textContent = result.ok ? "Hero image updated." : "Hero upload failed.";
    adminHeroFile.value = "";
    adminHeroNote.value = "";
    if (result.ok) notifyContentUpdated();
    await refreshLibrary();
  } catch (error) {
    adminHeroStatus.textContent = error.message;
  }
});

setAdminEnabled(false);
const savedAdminKey = sessionStorage.getItem(ADMIN_SESSION_KEY);
if (savedAdminKey) unlockAdmin(savedAdminKey);
