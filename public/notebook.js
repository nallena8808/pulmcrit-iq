const SERVER_ORIGIN = window.location.protocol === "file:"
  ? "http://127.0.0.1:4177"
  : window.location.hostname === "127.0.0.1" && ["4173", "4174", "4175", "4176", "4178"].includes(window.location.port)
    ? "http://127.0.0.1:4177"
    : "";

if (window.location.protocol === "file:") {
  window.location.href = `${SERVER_ORIGIN}/notebook.html`;
}

const ACTIVE_USER_KEY = "pulmcrit-iq-active-user";
const USER_STORE_KEY = "pulmcrit-iq-users";
const USER_NOTEBOOK_API_URL = `${SERVER_ORIGIN}/api/users/notebook`;
const USER_BOOKMARK_DELETE_API_URL = `${SERVER_ORIGIN}/api/users/bookmark-delete`;

const notebookBuckets = [
  "Latest PCCM Articles",
  "Guidelines",
  "Landmark Trials",
  "Ventilator Hub",
  "Pulmonary Physiology",
  "Case Rounds",
  "PCCM Image Atlas",
  "Airway",
  "Critical Care",
  "Uploaded Content",
  "Saved Items",
];

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

const statusEl = document.querySelector("#notebook-page-status");
const contentEl = document.querySelector("#notebook-page-content");
const searchInput = document.querySelector("#notebook-search-input");
const searchForm = document.querySelector("#notebook-search-form");

let notebookItems = [];

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function getActiveUser() {
  const email = localStorage.getItem(ACTIVE_USER_KEY);
  return email ? getUsers().find((user) => user.email.toLowerCase() === email.toLowerCase()) : null;
}

function bucketFor(item) {
  if (item.type === "guideline") return "Guidelines";
  if (item.type === "trial") return "Landmark Trials";
  if (item.type === "article" && item.bucket === "Latest PCCM Articles") return "Latest PCCM Articles";
  if (item.type === "upload") return sectionLabels[item.section] || item.bucket || "Uploaded Content";
  return item.bucket || "Saved Items";
}

function bookmarkKey(item) {
  return String(item.id || `${item.type}:${item.bucket}:${item.title}:${item.link}`).trim().toLowerCase();
}

function localNotebookItems(user) {
  if (!user) return [];
  try {
    return JSON.parse(localStorage.getItem(`pulmcrit-iq-notebook-${user.email}`) || "[]");
  } catch {
    return [];
  }
}

function mergeNotebookItems(...groups) {
  const merged = new Map();
  groups.flat().filter(Boolean).forEach((item) => {
    const normalized = {
      ...item,
      id: bookmarkKey(item),
      bucket: item.bucket || bucketFor(item),
    };
    if (normalized.title && !merged.has(normalized.id)) merged.set(normalized.id, normalized);
  });
  return [...merged.values()];
}

function saveNotebookLocal(user, items) {
  if (!user) return;
  localStorage.setItem(`pulmcrit-iq-notebook-${user.email}`, JSON.stringify(items));
}

function itemMatches(item, query) {
  const tokens = String(query || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = JSON.stringify(item).toLowerCase().replace(/[^a-z0-9]+/g, " ");
  return tokens.every((token) => haystack.includes(token));
}

function renderNotebook() {
  const user = getActiveUser();
  if (!user) {
    statusEl.innerHTML = 'Login first to view My Notebook. <a href="./index.html?login=1">Go to login</a>';
    contentEl.innerHTML = "";
    return;
  }

  const query = searchInput.value.trim();
  const filteredItems = notebookItems.filter((item) => itemMatches(item, query));
  statusEl.textContent = filteredItems.length
    ? `${filteredItems.length} saved item${filteredItems.length === 1 ? "" : "s"} for ${user.username}.`
    : query ? "No saved items match that search." : "No bookmarks yet.";

  const extraBuckets = [...new Set(filteredItems.map(bucketFor))].filter((bucket) => !notebookBuckets.includes(bucket));
  const allBuckets = [...notebookBuckets, ...extraBuckets];
  contentEl.innerHTML = allBuckets.map((bucket) => {
    const items = filteredItems.filter((item) => bucketFor(item) === bucket);
    return `
      <article class="notebook-page-bucket">
        <div class="notebook-page-bucket-head">
          <h2>${escapeHtml(bucket)}</h2>
          <span>${items.length}</span>
        </div>
        ${items.length ? `
          <ul>
            ${items.map((item) => `
              <li>
                <div class="notebook-item-row">
                  <a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title || "Saved item")}</a>
                  <button class="notebook-delete-button" type="button" aria-label="Remove ${escapeHtml(item.title || "saved item")}" title="Remove from My Notebook" data-notebook-remove="${escapeHtml(bookmarkKey(item))}">×</button>
                </div>
                <small>${escapeHtml([item.mediaBucket, item.source, item.summary].filter(Boolean).join(" · "))}</small>
              </li>
            `).join("")}
          </ul>
        ` : '<p>No saved items in this bucket yet.</p>'}
      </article>
    `;
  }).join("");
}

async function loadNotebook() {
  const user = getActiveUser();
  if (!user) {
    renderNotebook();
    return;
  }
  try {
    const response = await fetch(`${USER_NOTEBOOK_API_URL}?email=${encodeURIComponent(user.email)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Notebook unavailable.");
    notebookItems = mergeNotebookItems(result.items || [], localNotebookItems(user));
  } catch {
    notebookItems = mergeNotebookItems(localNotebookItems(user));
  }
  saveNotebookLocal(user, notebookItems);
  renderNotebook();
}

async function removeNotebookItem(id) {
  const user = getActiveUser();
  if (!user) return;
  const normalizedId = String(id || "").trim().toLowerCase();
  if (!normalizedId) return;
  try {
    const response = await fetch(USER_BOOKMARK_DELETE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, id: normalizedId }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Remove failed.");
    notebookItems = mergeNotebookItems(result.items || []).filter((item) => item.id !== normalizedId);
  } catch {
    notebookItems = notebookItems.filter((item) => bookmarkKey(item) !== normalizedId);
  }
  saveNotebookLocal(user, notebookItems);
  renderNotebook();
}

searchForm.addEventListener("submit", (event) => event.preventDefault());
searchInput.addEventListener("input", renderNotebook);
contentEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-notebook-remove]");
  if (!button) return;
  removeNotebookItem(button.dataset.notebookRemove);
});
loadNotebook();
