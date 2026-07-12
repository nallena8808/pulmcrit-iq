const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const CACHE_KEY = "pulmcrit-iq-latest-articles-v5-autofeed-only";
const GUIDELINE_CACHE_KEY = "pulmcrit-iq-guidelines-v5-no-quality-chest-pain";
const USER_STORE_KEY = "pulmcrit-iq-users";
const ACTIVE_USER_KEY = "pulmcrit-iq-active-user";
const SERVER_ORIGIN = window.location.protocol === "file:"
  ? "http://127.0.0.1:4177"
  : window.location.hostname === "127.0.0.1" && ["4173", "4174", "4175", "4176"].includes(window.location.port)
    ? "http://127.0.0.1:4177"
    : "";
if (window.location.protocol === "file:") {
  window.location.href = `${SERVER_ORIGIN}/`;
}
const API_URL = `${SERVER_ORIGIN}/api/articles`;
const GUIDELINE_API_URL = `${SERVER_ORIGIN}/api/guidelines`;
const TRIAL_API_URL = `${SERVER_ORIGIN}/api/trial`;
const CONTENT_API_URL = `${SERVER_ORIGIN}/api/admin/content`;

const pccmKeywords = [
  "acute respiratory",
  "airway",
  "ards",
  "asthma",
  "bronchiectasis",
  "copd",
  "critical care",
  "dyspnea",
  "emphysema",
  "hypoxemia",
  "icu",
  "interstitial lung",
  "lung",
  "mechanical ventilation",
  "nodule",
  "pneumonia",
  "pulmonary",
  "respiratory",
  "sepsis",
  "shock",
  "ventilation",
  "ventilator",
];

const feedSources = [
  {
    name: "NEJM",
    url: "https://www.nejm.org/action/showFeed?type=etoc&feed=rss&jc=nejm",
    filterForPccm: true,
  },
  {
    name: "JAMA",
    url: "https://jamanetwork.com/rss/site_3/0.xml",
    filterForPccm: true,
  },
  {
    name: "AJRCCM",
    url: "https://www.atsjournals.org/action/showFeed?type=etoc&feed=rss&jc=ajrccm",
  },
  {
    name: "The Lancet Respiratory Medicine",
    url: "https://www.thelancet.com/rssfeed/lanres_current.xml",
  },
  {
    name: "European Respiratory Journal",
    url: "https://publications.ersnet.org/rss/current/erj",
  },
  {
    name: "Critical Care",
    url: "https://ccforum.biomedcentral.com/articles?query=&searchType=&tab=keyword&format=rss",
  },
  {
    name: "Thorax",
    url: "https://thorax.bmj.com/rss/current.xml",
  },
];

const fallbackArticles = [
  {
    title: "Pulmonary and critical care update stream from NEJM",
    source: "NEJM",
    link: "https://www.nejm.org/",
    date: "Journal source configured",
  },
  {
    title: "Pulmonary and critical care update stream from JAMA",
    source: "JAMA",
    link: "https://jamanetwork.com/journals/jama",
    date: "Journal source configured",
  },
  {
    title: "Latest respiratory and critical care articles from AJRCCM",
    source: "AJRCCM",
    link: "https://www.atsjournals.org/journal/ajrccm",
    date: "Journal source configured",
  },
  {
    title: "Latest respiratory medicine articles from The Lancet",
    source: "The Lancet Respiratory Medicine",
    link: "https://www.thelancet.com/journals/lanres/home",
    date: "Journal source configured",
  },
  {
    title: "Latest respiratory articles from the European Respiratory Journal",
    source: "European Respiratory Journal",
    link: "https://publications.ersnet.org/content/erj",
    date: "Journal source configured",
  },
  {
    title: "Latest critical care articles from Critical Care",
    source: "Critical Care",
    link: "https://ccforum.biomedcentral.com/",
    date: "Journal source configured",
  },
  {
    title: "Latest respiratory articles from BMJ Thorax",
    source: "Thorax",
    link: "https://thorax.bmj.com/",
    date: "Journal source configured",
  },
];

const articleList = document.querySelector("#article-list");
const siteSearchForm = document.querySelector("#site-search-form");
const siteSearchInput = document.querySelector("#site-search");
const articleStatus = document.querySelector("#article-status");
const refreshButton = document.querySelector("#refresh-articles");
const guidelineList = document.querySelector("#guideline-list");
const guidelineStatus = document.querySelector("#guideline-status");
const guidelineRefreshButton = document.querySelector("#refresh-guidelines");
const guidelineSearch = document.querySelector("#guideline-search");
const trialSearch = document.querySelector("#trial-search");
const trialList = document.querySelector("#trial-list");
const trialStatus = document.querySelector("#trial-status");
const uploadPanels = [...document.querySelectorAll(".upload-panel")];
const sectionUploads = [...document.querySelectorAll(".section-upload")];
const userLoginOpen = document.querySelector("#user-login-open");
const userLoginClose = document.querySelector("#user-login-close");
const userAuthModal = document.querySelector("#user-auth-modal");
const userAuthStatus = document.querySelector("#user-auth-status");
const signinForm = document.querySelector("#signin-form");
const registerForm = document.querySelector("#register-form");
const recoverForm = document.querySelector("#recover-form");
const mainMenuOpen = document.querySelector("#main-menu-open");
const mainMenuClose = document.querySelector("#main-menu-close");
const mainMenu = document.querySelector("#main-menu");
const accountSettingsOpen = document.querySelector("#account-settings-open");
const helpOpen = document.querySelector("#help-open");
const accountSettingsPanel = document.querySelector("#account-settings-panel");
const helpPanel = document.querySelector("#help-panel");
const changePasswordForm = document.querySelector("#change-password-form");
const accountSettingsStatus = document.querySelector("#account-settings-status");
const heroIllustration = document.querySelector("#hero-illustration");

let currentGuidelines = [];
let activeGuidelineBucket = null;
let activeTrialBucket = null;
let activeTrialKey = null;
let currentContentLibrary = { articles: [], uploads: [], subtopics: [] };
const trialDetailCache = new Map();
const defaultTileOrder = ["1", "2", "6", "9", "10", "3", "4", "8", "5"];
const contentChannel = "BroadcastChannel" in window ? new BroadcastChannel("pulmcrit-iq-content") : null;

const tileContentMap = {
  "1": { sections: ["latest-articles"], labels: ["Latest PCCM Articles"] },
  "2": { sections: ["guidelines"], labels: ["Guidelines"] },
  "3": { sections: ["ventilator-lab"], labels: ["Ventilator Hub", "Ventilator Lab"] },
  "4": { sections: ["pulmonary-physiology"], labels: ["Pulmonary Physiology"] },
  "5": { sections: ["case-rounds"], labels: ["Case Rounds"] },
  "6": { sections: ["landmark-trials"], labels: ["Landmark Trials"] },
  "8": { sections: ["image-atlas"], labels: ["PCCM Image Atlas"] },
  "9": { sections: ["airway"], labels: ["Airway"] },
  "10": { sections: ["critical-care"], labels: ["Critical Care"] },
};

const guidelineBucketOrder = [
  "ARDS & Mechanical Ventilation",
  "Sepsis, Shock & ICU Care",
  "COPD, Asthma & Airways",
  "ILD & Sarcoidosis",
  "Pulmonary Hypertension & PE",
  "Pneumonia, TB, NTM & Fungal Disease",
  "Pleural Disease",
  "Lung Cancer, Nodules & Screening",
  "Sleep & Home Ventilation",
  "Procedures & Interventional Pulm",
  "ECMO & Transplant",
];

const landmarkTrialBuckets = [
  ["Mechanical Ventilation", ["ARMA - Low tidal volume ventilation", "PROSEVA - Prone positioning", "FACCT - Conservative fluid strategy", "ALVEOLI - High vs low PEEP", "ACURASYS - Early neuromuscular blockade", "ROSE - Neuromuscular blockade", "DEXA-ARDS - Dexamethasone", "EOLIA - VV ECMO", "CESAR - ECMO referral", "Esteban SBT Trial - Spontaneous breathing trials"]],
  ["Sepsis & Septic Shock", ["Rivers EGDT", "ProCESS", "ARISE", "ProMISe", "SAFE", "SMART", "CLASSIC", "CLOVERS", "ADRENAL", "APROCCHSS"]],
  ["Shock & Hemodynamics", ["VASST", "ATHOS-3", "IABP-SHOCK II", "CULPRIT-SHOCK"]],
  ["Transfusion & Fluids", ["TRICC", "BaSICS", "PLUS"]],
  ["Acute Kidney Injury", ["AKIKI", "ELAIN", "STARRT-AKI", "RENAL"]],
  ["ICU Nutrition", ["EDEN", "EPaNIC", "NUTRIREA-2"]],
  ["Pulmonary Embolism", ["PEITHO", "ULTIMA", "MOPETT"]],
  ["COPD", ["TORCH", "UPLIFT", "FLAME", "IMPACT", "ETHOS"]],
  ["Asthma", ["SYGMA", "Novel START", "NAVIGATOR", "LIBERTY ASTHMA QUEST"]],
  ["Interstitial Lung Disease", ["ASCEND", "INPULSIS", "INBUILD", "SENSCIS"]],
  ["Pulmonary Hypertension", ["SERAPHIN", "AMBITION", "GRIPHON", "INCREASE"]],
  ["Pleural Disease", ["MIST-2", "AMPLE"]],
  ["Sleep Medicine", ["SAVE", "SERVE-HF"]],
  ["Lung Cancer", ["NLST", "NELSON", "PACIFIC"]],
  ["Critical Care Infectious Diseases", ["RECOVERY", "ACTT-1"]],
  ["Neurocritical Care", ["TTM", "TTM2", "HYPERION", "INTERACT", "INTERACT2", "ATACH", "ATACH-II", "CLEAR III", "MISTIE III"]],
  ["ECMO & Cardiac Arrest", ["CESAR", "EOLIA", "ARREST"]],
].map(([bucket, trials]) => ({
  bucket,
  trials: trials.map((trial) => {
    const [name, description] = trial.split(" - ");
    return { name, description: description || "" };
  }),
}));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function renderArticles(articles, status) {
  articleList.innerHTML = articles.slice(0, 100).map((article) => `
    <li>
      <a href="${escapeHtml(article.link)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
      <small>${escapeHtml(article.source)} · ${escapeHtml(article.date)}</small>
    </li>
  `).join("");
  articleStatus.textContent = status;
}

function renderGuidelines(guidelines, status) {
  currentGuidelines = guidelines;
  const searchTerm = guidelineSearch.value.trim().toLowerCase();
  const bucketMarkup = guidelineBucketOrder.map((bucket) => {
    const bucketGuidelines = guidelines.filter((guideline) => guideline.bucket === bucket);
    const activeClass = activeGuidelineBucket === bucket ? " active" : "";
    const filteredGuidelines = bucketGuidelines.filter((guideline) => {
      if (!searchTerm) return true;
      return `${guideline.title} ${guideline.organization} ${guideline.topic} ${guideline.date}`.toLowerCase().includes(searchTerm);
    });
    const shouldShowGuidelines = activeGuidelineBucket === bucket || Boolean(searchTerm);
    const guidelineMarkup = shouldShowGuidelines
      ? filteredGuidelines.map((guideline) => `
          <li class="guideline-item">
            <a href="${escapeHtml(guideline.link)}" target="_blank" rel="noreferrer">${escapeHtml(guideline.title)}</a>
            <small>${escapeHtml(guideline.organization)} · ${escapeHtml(guideline.topic || "Guideline")} · ${escapeHtml(guideline.date || "Current")}</small>
          </li>
        `).join("") || '<li class="guideline-item muted">No matching guidelines in this bucket.</li>'
      : "";

    return `
      <li class="guideline-bucket${activeClass}" data-bucket="${escapeHtml(bucket)}" role="button" tabindex="0">
        <strong>${escapeHtml(bucket)}</strong>
        <small>${bucketGuidelines.length} guidelines</small>
      </li>
      ${guidelineMarkup}
    `;
  }).join("");

  guidelineList.innerHTML = `${bucketMarkup}${activeGuidelineBucket || searchTerm ? "" : '<li class="guideline-item muted">Select a bucket to view guidelines.</li>'}`;
  guidelineStatus.textContent = status;
}

function readCache(key = CACHE_KEY) {
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (!cached || Date.now() - cached.savedAt > REFRESH_INTERVAL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(articles, key = CACHE_KEY) {
  localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), articles }));
}

function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USER_STORE_KEY, JSON.stringify(users));
}

function findUserByEmail(email) {
  return getUsers().find((user) => user.email.toLowerCase() === email.trim().toLowerCase());
}

function getActiveUser() {
  const email = localStorage.getItem(ACTIVE_USER_KEY);
  return email ? findUserByEmail(email) : null;
}

function setAuthStatus(message) {
  userAuthStatus.textContent = message;
}

function setActiveUser(user) {
  localStorage.setItem(ACTIVE_USER_KEY, user.email);
  userLoginOpen.querySelector(".login-avatar").textContent = user.username.slice(0, 1).toUpperCase();
  userLoginOpen.querySelector("span:last-child").textContent = user.username;
}

function restoreActiveUser() {
  const user = getActiveUser();
  if (user) setActiveUser(user);
}

function openUserAuth(view = "signin") {
  userAuthModal.hidden = false;
  switchAuthView(view);
}

function closeUserAuth() {
  userAuthModal.hidden = true;
}

function openMainMenu() {
  mainMenu.hidden = false;
  accountSettingsPanel.hidden = true;
  helpPanel.hidden = true;
  accountSettingsOpen.hidden = !getActiveUser();
}

function closeMainMenu() {
  mainMenu.hidden = true;
}

function showAccountSettings() {
  helpPanel.hidden = true;
  accountSettingsPanel.hidden = false;
  const user = getActiveUser();
  if (!user) {
    accountSettingsPanel.hidden = true;
    openUserAuth("signin");
    return;
  }
  accountSettingsStatus.textContent = `Changing password for ${user.username}.`;
}

function showHelp() {
  accountSettingsPanel.hidden = true;
  helpPanel.hidden = false;
}

function switchAuthView(view) {
  document.querySelectorAll(".auth-form").forEach((form) => {
    form.classList.toggle("active", form.dataset.authPanel === view);
  });
  const titles = {
    signin: "User Login",
    register: "Create Account",
    recover: "Password Recovery",
  };
  document.querySelector("#user-auth-title").textContent = titles[view] || "User Login";
  setAuthStatus(view === "recover" ? "Enter the email used for the account, then set a new password." : "Use your email for user ID or password recovery.");
}

function togglePassword(button) {
  const input = document.querySelector(button.dataset.togglePassword);
  if (!input) return;
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  button.textContent = showing ? "Show" : "Hide";
}

function registerUser(event) {
  event.preventDefault();
  const email = document.querySelector("#register-email").value.trim();
  const username = document.querySelector("#register-username").value.trim();
  const password = document.querySelector("#register-password").value;
  if (!email || !username || !password) {
    setAuthStatus("Fill in email, username, and password.");
    return;
  }

  const users = getUsers();
  if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    setAuthStatus("An account already exists for that email.");
    return;
  }
  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    setAuthStatus("That username is already taken.");
    return;
  }

  const user = { email, username, password, createdAt: new Date().toISOString() };
  saveUsers([user, ...users]);
  setActiveUser(user);
  setAuthStatus("Account created. You are logged in.");
}

function signInUser(event) {
  event.preventDefault();
  const email = document.querySelector("#signin-email").value.trim();
  const password = document.querySelector("#signin-password").value;
  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    setAuthStatus("Email or password does not match.");
    return;
  }
  setActiveUser(user);
  setAuthStatus("Logged in.");
  closeUserAuth();
}

function recoverUsername() {
  const email = document.querySelector("#signin-email").value.trim() || document.querySelector("#recover-email").value.trim();
  const user = findUserByEmail(email);
  setAuthStatus(email ? (user ? `User ID for this email: ${user.username}` : "No account found for that email.") : "Enter your email above first.");
}

function preparePasswordReset() {
  const email = document.querySelector("#signin-email").value.trim();
  const user = findUserByEmail(email);
  if (!email) {
    setAuthStatus("Enter your email above first.");
    return;
  }
  if (!user) {
    setAuthStatus("No account found for that email.");
    return;
  }
  document.querySelector("#recover-email").value = email;
  switchAuthView("recover");
}

function resetUserPassword(event) {
  event.preventDefault();
  const email = document.querySelector("#recover-email").value.trim();
  const newPassword = document.querySelector("#reset-password").value;
  const users = getUsers();
  const index = users.findIndex((user) => user.email.toLowerCase() === email.toLowerCase());
  if (index === -1) {
    setAuthStatus("No account found for that email.");
    return;
  }
  if (!newPassword) {
    setAuthStatus("Type a new password first.");
    return;
  }
  users[index].password = newPassword;
  users[index].passwordUpdatedAt = new Date().toISOString();
  saveUsers(users);
  setAuthStatus("Password updated. You can log in now.");
  switchAuthView("signin");
}

function changeActiveUserPassword(event) {
  event.preventDefault();
  const user = getActiveUser();
  if (!user) {
    accountSettingsStatus.textContent = "Login first to change password.";
    openUserAuth("signin");
    return;
  }

  const password = document.querySelector("#settings-password").value;
  const confirmPassword = document.querySelector("#settings-password-confirm").value;
  if (!password || !confirmPassword) {
    accountSettingsStatus.textContent = "Type the new password twice.";
    return;
  }
  if (password !== confirmPassword) {
    accountSettingsStatus.textContent = "Passwords do not match.";
    return;
  }

  const users = getUsers();
  const index = users.findIndex((candidate) => candidate.email.toLowerCase() === user.email.toLowerCase());
  if (index === -1) {
    accountSettingsStatus.textContent = "Account was not found.";
    return;
  }
  users[index].password = password;
  users[index].passwordUpdatedAt = new Date().toISOString();
  saveUsers(users);
  changePasswordForm.reset();
  accountSettingsStatus.textContent = "Password changed.";
}

function normalizeContentKey(value) {
  return String(value || "").trim().toLowerCase();
}

function applyHomeSettings(settings = {}) {
  const savedHeight = Number(localStorage.getItem("pulmcrit-iq-home-tile-height"));
  const order = Array.isArray(settings.tileOrder) ? settings.tileOrder.map(String) : defaultTileOrder;
  document.querySelectorAll(".tile[data-tile]").forEach((tile) => {
    const index = order.indexOf(tile.dataset.tile);
    tile.style.order = index >= 0 ? String(index + 1) : "99";
  });
  const height = Math.max(320, Math.min(500, savedHeight || Number(settings.tileHeight) || 500));
  document.documentElement.style.setProperty("--home-tile-height", `${height}px`);
}

function renderHeroImage(library) {
  const image = (library.uploads || [])
    .filter((item) => item.section === "hero-image" && (item.isImage || /\.(png|jpe?g|gif|webp|svg)$/i.test(item.filename || item.path || "")))
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
  if (!heroIllustration) return;
  if (image) {
    heroIllustration.innerHTML = `<img class="hero-custom-image" src="${escapeHtml(image.path)}" alt="${escapeHtml(image.note || "PulmCrit IQ hero image")}" />`;
  }
}

function setupTileResizeHandles() {
  document.querySelectorAll(".tile[data-tile]").forEach((tile) => {
    if (tile.querySelector(".tile-resize-handle")) return;
    ["top", "bottom"].forEach((edge) => {
      const handle = document.createElement("span");
      handle.className = `tile-resize-handle ${edge}`;
      handle.setAttribute("aria-hidden", "true");
      tile.appendChild(handle);
    });
  });
}

function setupTileResizing() {
  setupTileResizeHandles();
  let resizeState = null;
  document.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest(".tile-resize-handle");
    if (!handle) return;
    resizeState = {
      y: event.clientY,
      edge: handle.classList.contains("top") ? "top" : "bottom",
      height: Number(getComputedStyle(document.documentElement).getPropertyValue("--home-tile-height").replace("px", "")) || 500,
    };
    event.preventDefault();
  });
  document.addEventListener("pointermove", (event) => {
    if (!resizeState) return;
    const delta = event.clientY - resizeState.y;
    const nextHeight = Math.max(320, Math.min(500, resizeState.height + (resizeState.edge === "top" ? -delta : delta)));
    document.documentElement.style.setProperty("--home-tile-height", `${Math.round(nextHeight)}px`);
  });
  document.addEventListener("pointerup", () => {
    if (!resizeState) return;
    const current = Number(getComputedStyle(document.documentElement).getPropertyValue("--home-tile-height").replace("px", "")) || 500;
    localStorage.setItem("pulmcrit-iq-home-tile-height", String(Math.round(current / 10) * 10));
    resizeState = null;
  });
}

function renderTileLibraries(library) {
  currentContentLibrary = library;
  document.querySelectorAll(".tile-library").forEach((panel) => panel.remove());
}

async function loadContentLibrary() {
  try {
    const response = await fetch(CONTENT_API_URL, { cache: "no-store" });
    if (!response.ok) return;
    const library = await response.json();
    applyHomeSettings(library.settings);
    renderHeroImage(library);
    renderTileLibraries(library);
    renderLandmarkTrials();
  } catch {
    // The public dashboard still works if the local admin service is unavailable.
  }
}

contentChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "content-updated") loadContentLibrary();
});

window.addEventListener("storage", (event) => {
  if (event.key === "pulmcrit-iq-content-updated") loadContentLibrary();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadContentLibrary();
});

window.addEventListener("focus", loadContentLibrary);

function formatRefreshStatus(data) {
  if (!data.updatedAt) return data.status || "Waiting for journal refresh";

  const updatedAt = new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const nextRefreshAt = data.nextRefreshAt
    ? new Date(data.nextRefreshAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "soon";
  return `${data.articles?.length || 0} articles from last 3 months · updated ${updatedAt}; next check ${nextRefreshAt}`;
}

function formatGuidelineStatus(data) {
  if (!data.updatedAt) return data.status || "Waiting for guideline refresh";

  const updatedAt = new Date(data.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const nextRefreshAt = data.nextRefreshAt
    ? new Date(data.nextRefreshAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "soon";
  return `${data.guidelines?.length || 0} guidelines across 12 buckets · updated ${updatedAt}; next check ${nextRefreshAt}`;
}

function isPccmArticle(article) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return pccmKeywords.some((keyword) => text.includes(keyword));
}

function parseRss(xmlText, source) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const items = [...doc.querySelectorAll("item, entry")];

  return items.map((item) => {
    const title = item.querySelector("title")?.textContent?.trim() || "Untitled article";
    const link = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent?.trim() || "#";
    const dateText = item.querySelector("pubDate, published, updated")?.textContent;
    const date = dateText ? new Date(dateText).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "New";
    const summary = item.querySelector("description, summary, content")?.textContent?.trim() || "";
    const timestamp = dateText ? new Date(dateText).getTime() : 0;
    return { title, link, source, date, summary, timestamp };
  });
}

async function fetchFeed(source) {
  const controller = new AbortController();
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error(`Feed timeout: ${source.name}`));
    }, 4500);
  });

  const response = await Promise.race([
    fetch(proxyUrl, { cache: "no-store", signal: controller.signal }),
    timeout,
  ]);
  if (!response.ok) throw new Error(`Feed unavailable: ${source.name}`);
  const xmlText = await response.text();
  const articles = parseRss(xmlText, source.name);
  return source.filterForPccm ? articles.filter(isPccmArticle) : articles;
}

async function loadArticles(force = false) {
  const cached = !force && readCache();
  if (cached) {
    renderArticles(cached.articles, `${cached.articles.length} cached articles from the last 3 months`);
  }

  if (!cached) {
    renderArticles([{ title: "Checking literature feeds...", source: "PulmCrit IQ", link: "#", date: "Now" }], "Updating");
  }

  try {
    const response = await fetch(`${API_URL}${force ? "?refresh=1" : ""}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (data.articles?.length) {
        writeCache(data.articles);
        renderArticles(data.articles, formatRefreshStatus(data));
        return;
      }
    }

    const results = await Promise.allSettled(feedSources.map(fetchFeed));
    const articles = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((article, index, all) => all.findIndex((candidate) => candidate.title === article.title) === index)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);

    if (!articles.length) throw new Error("No feed items returned");
    writeCache(articles);
    renderArticles(articles, `${articles.length} articles · updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
  } catch {
    if (!cached) renderArticles(fallbackArticles, "Live feeds blocked; showing curated fallback");
  }
}

async function loadGuidelines(force = false) {
  const cached = !force && readCache(GUIDELINE_CACHE_KEY);
  if (cached) {
    renderGuidelines(cached.articles, `${cached.articles.length} cached guidelines`);
  }

  if (!cached) {
    renderGuidelines([{ title: "Checking guideline sources...", organization: "PulmCrit IQ", topic: "Guidelines", link: "#", date: "Now" }], "Updating");
  }

  try {
    const response = await fetch(`${GUIDELINE_API_URL}${force ? "?refresh=1" : ""}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Guideline service unavailable");
    const data = await response.json();
    if (data.guidelines?.length) {
      writeCache(data.guidelines, GUIDELINE_CACHE_KEY);
      renderGuidelines(data.guidelines, formatGuidelineStatus(data));
    }
  } catch {
    if (!cached) {
      renderGuidelines([
        { organization: "BTS", topic: "Guideline hub", title: "British Thoracic Society Guidelines", link: "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/", date: "Official hub" },
        { organization: "ATS", topic: "Guideline hub", title: "ATS Clinical Practice Guidelines, Statements & Reports", link: "https://site.thoracic.org/clinicians-researchers/clinical-practice-guidelines-statements-and-reports", date: "Official hub" },
        { organization: "CHEST", topic: "Guideline hub", title: "CHEST Guidelines and Topic Collections", link: "https://www.chestnet.org/Guidelines-and-Topic-Collections", date: "Official hub" },
        { organization: "ERS", topic: "Guideline hub", title: "European Respiratory Society Guidelines", link: "https://www.ersnet.org/science-and-research/guidelines/", date: "Official hub" },
        { organization: "SCCM", topic: "Guideline hub", title: "Society of Critical Care Medicine Guidelines", link: "https://www.sccm.org/Clinical-Resources/Guidelines", date: "Official hub" },
        { organization: "ELSO", topic: "ECMO", title: "ELSO Guidelines for ECMO and ECLS", link: "https://www.elso.org/ecmo-resources/elso-ecmo-guidelines.aspx", date: "Official hub" },
      ], "Guideline service blocked; showing official hubs");
    }
  }
}

function renderLandmarkTrials() {
  const searchTerm = trialSearch.value.trim().toLowerCase();
  const manualTrials = (currentContentLibrary.articles || [])
    .filter((article) => article.tile === "Landmark Trials")
    .map((article) => ({
      name: article.title,
      description: article.summary || "Saved trial article",
      link: article.link,
      bucket: article.trialBucket || "Mechanical Ventilation",
      manual: true,
    }));

  const markup = landmarkTrialBuckets.map(({ bucket, trials }) => {
    const manualForBucket = manualTrials.filter((trial) => trial.bucket === bucket);
    const bucketTrials = [
      ...trials.map((trial) => {
        const manualMatch = manualForBucket.find((manualTrial) => manualTrial.name.toLowerCase() === trial.name.toLowerCase());
        return manualMatch ? { ...trial, description: trial.description, savedAbstract: manualMatch.description, link: manualMatch.link, manualMerged: true } : trial;
      }),
      ...manualForBucket.filter((manualTrial) => !trials.some((trial) => trial.name.toLowerCase() === manualTrial.name.toLowerCase())),
    ];
    const filteredTrials = bucketTrials.filter((trial) => {
      if (!searchTerm) return true;
      return `${bucket} ${trial.name} ${trial.description}`.toLowerCase().includes(searchTerm);
    });
    const activeClass = activeTrialBucket === bucket ? " active" : "";
    const shouldShowTrials = activeTrialBucket === bucket || Boolean(searchTerm);
    const trialMarkup = shouldShowTrials
      ? filteredTrials.map((trial) => `
          <li class="trial-item" data-trial-key="${escapeHtml(`${bucket}::${trial.name}`)}" data-trial-name="${escapeHtml(trial.name)}" data-trial-description="${escapeHtml(trial.savedAbstract || trial.description)}" data-trial-bucket-name="${escapeHtml(bucket)}" data-trial-link="${escapeHtml(trial.link || "")}">
            <strong>${escapeHtml(trial.name)}</strong>
            ${trial.description ? `<small>${escapeHtml(trial.description)}</small>` : ""}
            ${activeTrialKey === `${bucket}::${trial.name}` ? renderTrialDetail(bucket, trial) : ""}
          </li>
        `).join("") || '<li class="trial-item muted">No matching trials in this bucket.</li>'
      : "";

    return `
      <li class="trial-bucket${activeClass}" data-trial-bucket="${escapeHtml(bucket)}" role="button" tabindex="0">
        <strong>${escapeHtml(bucket)}</strong>
        <small>${bucketTrials.length} trials</small>
      </li>
      ${trialMarkup}
    `;
  }).join("");

  const mergedManualCount = manualTrials.filter((manualTrial) => {
    const bucket = landmarkTrialBuckets.find((group) => group.bucket === manualTrial.bucket);
    return bucket?.trials.some((trial) => trial.name.toLowerCase() === manualTrial.name.toLowerCase());
  }).length;
  const totalTrials = landmarkTrialBuckets.reduce((sum, bucket) => sum + bucket.trials.length, 0) + manualTrials.length - mergedManualCount;
  trialList.innerHTML = `${markup}${activeTrialBucket || searchTerm ? "" : '<li class="trial-item muted">Select a trial bucket to view studies.</li>'}`;
  trialStatus.textContent = `${totalTrials} landmark trials across ${landmarkTrialBuckets.length} buckets`;
}

function renderTrialDetail(bucket, trial) {
  const key = `${bucket}::${trial.name}`;
  const detail = trialDetailCache.get(key);
  if (!detail) {
    return '<div class="trial-detail">Loading abstract...</div>';
  }

  return `
    <div class="trial-detail">
      <b>${escapeHtml(detail.title || trial.name)}</b>
      <p>${escapeHtml(detail.abstract || "Abstract unavailable.")}</p>
      <a href="${escapeHtml(detail.link)}" target="_blank" rel="noreferrer">Access article</a>
    </div>
  `;
}

async function openTrialDetail(trialItem) {
  const key = trialItem.dataset.trialKey;
  const name = trialItem.dataset.trialName;
  const description = trialItem.dataset.trialDescription;
  const bucket = trialItem.dataset.trialBucketName;
  const link = trialItem.dataset.trialLink;
  activeTrialKey = activeTrialKey === key ? null : key;
  renderLandmarkTrials();
  if (!activeTrialKey || trialDetailCache.has(key)) return;
  if (link) {
    trialDetailCache.set(key, {
      title: name,
      abstract: description || "Saved landmark-trial link.",
      link,
    });
    renderLandmarkTrials();
    return;
  }

  try {
    const response = await fetch(`${TRIAL_API_URL}?name=${encodeURIComponent(name)}&description=${encodeURIComponent(description)}&bucket=${encodeURIComponent(bucket)}`, { cache: "no-store" });
    trialDetailCache.set(key, await response.json());
  } catch {
    trialDetailCache.set(key, {
      title: name,
      abstract: "Abstract unavailable. Use the article search link below.",
      link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`${name} ${description}`)}`,
    });
  }
  renderLandmarkTrials();
}

function unlockMasterAccess() {
  const masterKey = document.querySelector("#master-key");
  const masterStatus = document.querySelector("#master-status");
  if (!masterKey || !masterStatus) return;
  const unlocked = Boolean(masterKey.value.trim());
  sectionUploads.forEach((input) => {
    input.disabled = !unlocked;
  });
  uploadPanels.forEach((panel) => {
    panel.querySelector("small").textContent = unlocked ? "Unlocked" : "Locked";
  });
  masterStatus.textContent = unlocked ? "Master upload enabled for this browser session" : "Enter the admin key";
}

async function uploadFiles(input) {
  const files = [...input.files];
  if (!files.length) return;

  const panel = input.closest(".upload-panel, .master-panel");
  const status = panel?.querySelector("small") || document.querySelector("#master-status");
  const section = input.dataset.section || panel?.dataset.section || "general";
  const data = new FormData();
  files.forEach((file) => data.append("files", file, file.name));
  status.textContent = `Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`;

  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/upload?section=${encodeURIComponent(section)}`, {
      method: "POST",
      headers: { "X-Admin-Key": document.querySelector("#master-key")?.value.trim() || "" },
      body: data,
    });
    const result = await response.json();
    status.textContent = result.ok ? `${result.saved.length} file${result.saved.length === 1 ? "" : "s"} saved` : "Upload failed";
    if (result.ok) await loadContentLibrary();
  } catch {
    status.textContent = "Upload failed; make sure the local server is running";
  }
}

function openResourceLink(event) {
  const link = event.target.closest("a");
  if (!link || link.getAttribute("href") === "#") return;
  event.preventDefault();
  window.open(link.href, "_blank", "noopener");
}

guidelineList.addEventListener("click", (event) => {
  const bucket = event.target.closest(".guideline-bucket")?.dataset.bucket;
  if (!bucket) return;
  activeGuidelineBucket = activeGuidelineBucket === bucket ? null : bucket;
  renderGuidelines(currentGuidelines, guidelineStatus.textContent);
});

guidelineSearch.addEventListener("input", () => renderGuidelines(currentGuidelines, guidelineStatus.textContent));
trialSearch.addEventListener("input", renderLandmarkTrials);
trialList.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const trialItem = event.target.closest(".trial-item:not(.muted)");
  if (trialItem) {
    openTrialDetail(trialItem);
    return;
  }
  const bucket = event.target.closest(".trial-bucket")?.dataset.trialBucket;
  if (!bucket) return;
  activeTrialBucket = activeTrialBucket === bucket ? null : bucket;
  activeTrialKey = null;
  renderLandmarkTrials();
});
document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-toggle-password]");
  if (toggle) togglePassword(toggle);
});
userLoginOpen.addEventListener("click", () => openUserAuth("signin"));
userLoginClose.addEventListener("click", closeUserAuth);
userAuthModal.addEventListener("click", (event) => {
  if (event.target === userAuthModal) closeUserAuth();
});
mainMenuOpen.addEventListener("click", openMainMenu);
mainMenuClose.addEventListener("click", closeMainMenu);
mainMenu.addEventListener("click", (event) => {
  if (event.target === mainMenu) closeMainMenu();
});
accountSettingsOpen.addEventListener("click", showAccountSettings);
helpOpen.addEventListener("click", showHelp);
changePasswordForm.addEventListener("submit", changeActiveUserPassword);
document.querySelectorAll("[data-auth-view]").forEach((tab) => {
  tab.addEventListener("click", () => switchAuthView(tab.dataset.authView));
});
signinForm.addEventListener("submit", signInUser);
registerForm.addEventListener("submit", registerUser);
recoverForm.addEventListener("submit", resetUserPassword);
document.querySelector("#forgot-username").addEventListener("click", recoverUsername);
document.querySelector("#forgot-password").addEventListener("click", preparePasswordReset);
document.querySelector("#master-unlock")?.addEventListener("click", unlockMasterAccess);
sectionUploads.forEach((input) => input.addEventListener("change", () => uploadFiles(input)));
articleList.addEventListener("click", openResourceLink);
guidelineList.addEventListener("click", openResourceLink);
siteSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = siteSearchInput.value.trim();
  if (!query) return;
  window.open(`./search.html?q=${encodeURIComponent(query)}`, "_blank", "noopener");
});

refreshButton.addEventListener("click", () => loadArticles(true));
guidelineRefreshButton.addEventListener("click", () => loadGuidelines(true));
renderLandmarkTrials();
restoreActiveUser();
applyHomeSettings();
setupTileResizing();
loadContentLibrary();
loadArticles();
loadGuidelines();
setInterval(() => loadArticles(), 5 * 60 * 1000);
setInterval(() => loadGuidelines(), 30 * 60 * 1000);
setInterval(() => loadContentLibrary(), 30 * 1000);
