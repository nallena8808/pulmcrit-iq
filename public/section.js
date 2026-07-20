const SERVER_ORIGIN = window.location.protocol === "file:"
  ? "http://127.0.0.1:4177"
  : window.location.hostname === "127.0.0.1" && ["4173", "4174", "4175", "4176", "4178"].includes(window.location.port)
    ? "http://127.0.0.1:4177"
    : "";

if (window.location.protocol === "file:") {
  window.location.href = `${SERVER_ORIGIN}/section.html${window.location.search}`;
}

const sectionLabels = {
  "latest-articles": "Latest PCCM Articles",
  guidelines: "Guidelines",
  "ventilator-lab": "Ventilator Hub",
  "pulmonary-physiology": "Pulmonary Physiology",
  "case-rounds": "Case Rounds",
  "landmark-trials": "Landmark Trials",
  "core-topics-illustrated": "Core Topics",
  "image-atlas": "PCCM Image Atlas",
  airway: "Airway",
  "critical-care": "Critical Care",
};

const section = new URLSearchParams(window.location.search).get("section") || "ventilator-lab";
const sectionTitle = document.querySelector("#section-title");
const sectionContent = document.querySelector("#section-content");
const sectionSearchForm = document.querySelector("#section-search-form");
const sectionSearchInput = document.querySelector("#section-search-input");
const initialSectionQuery = new URLSearchParams(window.location.search).get("q") || "";
const ACTIVE_USER_KEY = "pulmcrit-iq-active-user";
const USER_STORE_KEY = "pulmcrit-iq-users";
const USER_NOTEBOOK_API_URL = `${SERVER_ORIGIN}/api/users/notebook`;
const USER_BOOKMARK_API_URL = `${SERVER_ORIGIN}/api/users/bookmark`;
const USER_BOOKMARK_DELETE_API_URL = `${SERVER_ORIGIN}/api/users/bookmark-delete`;
const CONTENT_SYNC_INTERVAL_MS = 5 * 1000;

let library = { articles: [], uploads: [], subtopics: [] };
let liveArticles = [];
let liveGuidelines = [];
let currentNotebookItems = [];
const contentChannel = "BroadcastChannel" in window ? new BroadcastChannel("pulmcrit-iq-content") : null;

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
  ["Lung Cancer", ["NLST", "NELSON", "PACIFIC", "CHECKMATE", "KEYNOTE 024", "KEYNOTE 042"]],
  ["Critical Care Infectious Diseases", ["RECOVERY", "ACTT-1"]],
  ["Neurocritical Care", ["TTM", "TTM2", "HYPERION", "INTERACT", "INTERACT2", "ATACH", "ATACH-II", "CLEAR III", "MISTIE III"]],
  ["ECMO & Cardiac Arrest", ["CESAR", "EOLIA", "ARREST"]],
].map(([bucket, trials]) => ({ bucket, trials }));

const articleTopicBuckets = [
  {
    name: "ARDS & Mechanical Ventilation",
    keywords: ["ards", "acute respiratory distress", "mechanical ventilation", "ventilator", "ventilation", "peep", "tidal volume", "prone", "weaning", "extubation", "respiratory failure", "noninvasive ventilation", "high-flow"],
  },
  {
    name: "Sepsis, Shock & ICU Care",
    keywords: ["sepsis", "septic", "shock", "vasopressor", "norepinephrine", "icu", "intensive care", "critical care", "sedation", "delirium", "analgesia", "resuscitation", "lactate"],
  },
  {
    name: "COPD, Asthma & Airways",
    keywords: ["copd", "asthma", "airway", "bronchiectasis", "exacerbation", "eosinophil", "inhaled", "bronchodilator", "dupilumab", "mucus"],
  },
  {
    name: "ILD & Sarcoidosis",
    keywords: ["interstitial", "fibrosis", "fibrotic", "ipf", "sarcoidosis", "hypersensitivity pneumonitis", "nintedanib", "pirfenidone"],
  },
  {
    name: "Pulmonary Hypertension & PE",
    keywords: ["pulmonary hypertension", "pulmonary arterial hypertension", "pulmonary embolism", "embolism", "vte", "thromboembolism", "right ventricle", "anticoagulation"],
  },
  {
    name: "Pneumonia, TB, NTM & Fungal Disease",
    keywords: ["pneumonia", "tuberculosis", "tb", "ntm", "mycobacter", "fungal", "aspergillus", "influenza", "rsv", "covid", "infection", "antibiotic"],
  },
  {
    name: "Pleural Disease",
    keywords: ["pleural", "pleura", "effusion", "pneumothorax", "empyema", "mesothelioma"],
  },
  {
    name: "Lung Cancer, Nodules & Screening",
    keywords: ["lung cancer", "nodule", "nodules", "screening", "nsclc", "small-cell", "non-small-cell", "malignancy", "immunotherapy", "checkpoint"],
  },
  {
    name: "Sleep & Home Ventilation",
    keywords: ["sleep", "osa", "apnea", "cpap", "home ventilation", "home oxygen", "obesity hypoventilation", "long-term ventilation"],
  },
  {
    name: "Procedures & Interventional Pulm",
    keywords: ["bronchoscopy", "ebus", "procedure", "interventional", "biopsy", "thoracentesis", "ultrasound", "spirometry", "pulmonary function"],
  },
  {
    name: "ECMO & Transplant",
    keywords: ["ecmo", "ecls", "extracorporeal", "transplant", "transplantation", "donor lung"],
  },
  {
    name: "Pulmonary Physiology & Imaging",
    keywords: ["physiology", "gas exchange", "hypoxemia", "hypercapnia", "ct", "x-ray", "radiograph", "imaging", "ultrasound", "pft"],
  },
];

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function isImageUpload(item) {
  return item.isImage || /\.(png|jpe?g|gif|webp|svg)$/i.test(item.filename || item.path || "");
}

function isVideoUpload(item) {
  return item.isVideo || /\.(mp4|m4v|mov|webm|ogv|ogg)$/i.test(item.filename || item.path || "");
}

function assetUrl(path) {
  if (!path) return "#";
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path}`;
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
    const normalized = { ...item, id: bookmarkKey(item) };
    if (normalized.title && !merged.has(normalized.id)) merged.set(normalized.id, normalized);
  });
  return [...merged.values()];
}

function saveNotebookLocal(user, items) {
  if (!user) return;
  localStorage.setItem(`pulmcrit-iq-notebook-${user.email}`, JSON.stringify(items));
}

function notebookHas(item) {
  const key = bookmarkKey(item);
  return currentNotebookItems.some((saved) => saved.id === key);
}

function bookmarkButton(item) {
  const saved = notebookHas(item);
  const label = saved ? "Remove from My Notebook" : "Save to My Notebook";
  return `<button class="bookmark-button${saved ? " saved" : ""}" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" data-bookmark-type="${escapeHtml(item.type)}" data-bookmark-title="${escapeHtml(item.title)}" data-bookmark-link="${escapeHtml(item.link || "#")}" data-bookmark-source="${escapeHtml(item.source || "")}" data-bookmark-summary="${escapeHtml(item.summary || "")}" data-bookmark-bucket="${escapeHtml(item.bucket || "")}" data-bookmark-section="${escapeHtml(item.section || "")}" data-bookmark-media-bucket="${escapeHtml(item.mediaBucket || "")}"><span aria-hidden="true">⌑</span></button>`;
}

async function loadNotebook() {
  const user = getActiveUser();
  if (!user) {
    currentNotebookItems = [];
    return;
  }
  try {
    const response = await fetch(`${USER_NOTEBOOK_API_URL}?email=${encodeURIComponent(user.email)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Notebook unavailable.");
    currentNotebookItems = mergeNotebookItems(result.items || [], localNotebookItems(user));
  } catch {
    currentNotebookItems = mergeNotebookItems(localNotebookItems(user));
  }
  saveNotebookLocal(user, currentNotebookItems);
}

async function toggleBookmark(item) {
  const user = getActiveUser();
  if (!user) {
    sessionStorage.setItem("pulmcrit-iq-return-after-login", window.location.href);
    window.location.href = "./index.html?login=1";
    return;
  }
  const normalized = { ...item, id: bookmarkKey(item) };
  const wasSaved = notebookHas(normalized);
  try {
    const response = await fetch(wasSaved ? USER_BOOKMARK_DELETE_API_URL : USER_BOOKMARK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wasSaved ? { email: user.email, id: normalized.id } : { email: user.email, item: normalized }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Bookmark failed.");
    currentNotebookItems = wasSaved
      ? mergeNotebookItems(result.items || []).filter((saved) => saved.id !== normalized.id)
      : mergeNotebookItems(result.items || [], localNotebookItems(user));
  } catch {
    const existing = currentNotebookItems.findIndex((saved) => saved.id === normalized.id);
    if (existing >= 0) currentNotebookItems.splice(existing, 1);
    else currentNotebookItems.unshift(normalized);
  }
  saveNotebookLocal(user, currentNotebookItems);
  renderSection();
}

function articleBelongs(article) {
  const legacyLabels = {
    "ventilator-lab": ["Ventilator Lab"],
    "core-topics-illustrated": ["Core Topics Illustrated"],
  };
  return article.tile === sectionLabels[section] || (legacyLabels[section] || []).includes(article.tile);
}

function itemMatches(item, searchTerm) {
  if (!searchTerm) return true;
  const tokens = String(searchTerm || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const haystack = JSON.stringify(item)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  return tokens.every((token) => haystack.includes(token));
}

function classifyArticleTopic(article) {
  const text = `${article.title || ""} ${article.summary || ""} ${article.source || ""}`.toLowerCase();
  const match = articleTopicBuckets.find((bucket) => bucket.keywords.some((keyword) => text.includes(keyword)));
  return match?.name || "General PCCM Updates";
}

function renderLiveSection(searchTerm, adminArticles) {
  if (section === "latest-articles") {
    const articles = liveArticles.filter((item) => itemMatches(item, searchTerm));
    if (!articles.length) return "";
    const bucketNames = [
      ...articleTopicBuckets.map((bucket) => bucket.name),
      "General PCCM Updates",
    ];
    const buckets = bucketNames.map((bucket) => ({
      bucket,
      articles: articles.filter((item) => classifyArticleTopic(item) === bucket),
    })).filter((group) => group.articles.length);
    return `
      <div class="section-block">
        <h2>Latest PCCM Articles</h2>
        <div class="section-subtopics">
          ${buckets.map((group) => `
            <details class="section-subtopic" open>
              <summary>${escapeHtml(group.bucket)} <small>${group.articles.length}</small></summary>
              <ul>
                ${group.articles.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.source || "Journal")} · ${escapeHtml(item.date || "Recent")}</small>${bookmarkButton({ type: "article", title: item.title, link: item.link, source: item.source || "Journal", summary: [group.bucket, item.date || ""].filter(Boolean).join(" · "), bucket: "Latest PCCM Articles" })}</li>`).join("")}
              </ul>
            </details>
          `).join("")}
        </div>
      </div>
    `;
  }

  if (section === "guidelines") {
    const guidelines = liveGuidelines.filter((item) => itemMatches(item, searchTerm));
    if (!guidelines.length) return "";
    const buckets = [...new Set(guidelines.map((item) => item.bucket).filter(Boolean))];
    return `
      <div class="section-block">
        <h2>Guidelines</h2>
        <div class="section-subtopics">
          ${buckets.map((bucket) => {
            const bucketGuidelines = guidelines.filter((item) => item.bucket === bucket);
            return `
              <details class="section-subtopic" open>
                <summary>${escapeHtml(bucket)}</summary>
                <ul>
                  ${bucketGuidelines.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.organization || "Guideline")} · ${escapeHtml(item.topic || "PCCM")} · ${escapeHtml(item.date || "Current")}</small>${bookmarkButton({ type: "guideline", title: item.title, link: item.link, source: item.organization || "Guideline", summary: item.topic || "", bucket: "Guidelines" })}</li>`).join("")}
                </ul>
              </details>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  if (section === "landmark-trials") {
    const hiddenTrials = new Set(library.hiddenTrials || []);
    const manualTrials = adminArticles
      .filter((article) => article.tile === "Landmark Trials")
      .filter((article) => !hiddenTrials.has(`${String(article.trialBucket || "Mechanical Ventilation").trim().toLowerCase()}::${String(article.title || "").trim().toLowerCase()}`))
      .map((article) => ({
        bucket: article.trialBucket || "Mechanical Ventilation",
        title: article.title,
        link: article.link,
        meta: article.summary || "Saved trial article",
      }));
    const buckets = landmarkTrialBuckets.map(({ bucket, trials }) => {
      const manualForBucket = manualTrials.filter((trial) => trial.bucket === bucket);
      return {
        bucket,
        trials: [
          ...trials.filter((trial) => !hiddenTrials.has(`${bucket.toLowerCase()}::${trial.toLowerCase()}`)).map((trial) => {
            const manualMatch = manualForBucket.find((manualTrial) => manualTrial.title.toLowerCase() === trial.toLowerCase());
            return {
              title: trial,
              link: manualMatch?.link || `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`${trial} critical care trial`)}`,
              meta: "Landmark PCCM trial",
            };
          }),
          ...manualForBucket.filter((manualTrial) => !trials.some((trial) => trial.toLowerCase() === manualTrial.title.toLowerCase())),
        ].filter((trial) => itemMatches({ ...trial, bucket }, searchTerm)),
      };
    }).filter((group) => group.trials.length);
    if (!buckets.length) return "";
    return `
      <div class="section-block">
        <h2>Landmark Trials</h2>
        <div class="section-subtopics">
          ${buckets.map((group) => `
            <details class="section-subtopic" open>
              <summary>${escapeHtml(group.bucket)}</summary>
              <ul>
                ${group.trials.map((trial) => `<li><a href="${escapeHtml(trial.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(trial.title)}</a><small>${escapeHtml(trial.meta)}</small>${bookmarkButton({ type: "trial", title: trial.title, link: trial.link, source: "Landmark Trial", summary: trial.meta, bucket: "Landmark Trials" })}</li>`).join("")}
              </ul>
            </details>
          `).join("")}
        </div>
      </div>
    `;
  }

  return "";
}

function renderSection() {
  const searchTerm = sectionSearchInput.value.trim().toLowerCase();
  const uploads = (library.uploads || []).filter((item) => item.section === section && itemMatches(item, searchTerm));
  const articles = (library.articles || []).filter((item) => articleBelongs(item) && itemMatches(item, searchTerm));
  const subtopics = (library.subtopics || []).filter((item) => item.section === section && itemMatches(item, searchTerm));
  const imageUploads = uploads.filter(isImageUpload);
  const videoUploads = uploads.filter(isVideoUpload);
  const fileUploads = uploads.filter((item) => !isImageUpload(item) && !isVideoUpload(item));
  const liveSectionMarkup = renderLiveSection(searchTerm, library.articles || []);

  sectionTitle.textContent = sectionLabels[section] || "PulmCrit IQ Section";
  const imageAtlasBuckets = ["X-rays", "CT scans", "Ultrasound", "Echo", "PET scan", "PFTs", "Bronchoscopy"];
  const atlasGroupTitle = (item) => String(item.title || item.note || item.filename || "Untitled image set").trim();
  const renderAtlasItem = (item) => {
    const url = escapeHtml(assetUrl(item.path));
    const title = escapeHtml(item.title || item.note || item.filename);
    const description = escapeHtml(item.description || item.note || `${Math.round((item.bytes || 0) / 1024)} KB`);
    if (isImageUpload(item)) {
      return `
        <article class="section-image-card">
          <a href="${url}" target="_blank" rel="noreferrer"><img src="${url}" alt="${title}" /></a>
          <strong>${title}</strong>
          <small>${description}</small>
          ${bookmarkButton({ type: "upload", title: item.title || item.note || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}
        </article>
      `;
    }
    if (isVideoUpload(item)) {
      return `
        <article class="section-video-card">
          <video src="${url}" controls preload="metadata"></video>
          <a href="${url}" target="_blank" rel="noreferrer">${title}</a>
          <small>${description}</small>
          ${bookmarkButton({ type: "upload", title: item.title || item.note || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}
        </article>
      `;
    }
    return `
      <article class="section-image-card">
        <strong>${title}</strong>
        <small>${description}</small>
        <a href="${url}" target="_blank" rel="noreferrer">Open file</a>
        ${bookmarkButton({ type: "upload", title: item.title || item.note || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}
      </article>
    `;
  };
  const imageMarkup = section === "image-atlas"
    ? imageAtlasBuckets.map((bucket) => {
        const bucketItems = uploads.filter((item) => (item.mediaBucket || "X-rays") === bucket);
        const groupedItems = bucketItems.reduce((groups, item) => {
          const title = atlasGroupTitle(item);
          groups[title] = groups[title] || [];
          groups[title].push(item);
          return groups;
        }, {});
        const groupMarkup = Object.entries(groupedItems).map(([title, items]) => {
          const firstItems = items.slice(0, 3);
          const hiddenItems = items.slice(3);
          return `
            <details class="section-subtopic atlas-title-tab">
              <summary>${escapeHtml(title)} <small>${items.length} image${items.length === 1 ? "" : "s"}</small></summary>
              <div class="section-image-grid section-atlas-grid">
                ${firstItems.map(renderAtlasItem).join("")}
                ${hiddenItems.map((item) => `<div class="atlas-extra-image" hidden>${renderAtlasItem(item)}</div>`).join("")}
              </div>
              ${hiddenItems.length ? `<button class="atlas-more-button" type="button" data-atlas-more>More Images</button>` : ""}
            </details>
          `;
        }).join("");
        return `
          <details class="section-subtopic" open>
            <summary>${escapeHtml(bucket)}</summary>
            <div class="atlas-title-tabs">
              ${bucketItems.length ? groupMarkup : '<div class="section-empty compact">No uploads in this bucket yet.</div>'}
            </div>
          </details>
        `;
      }).join("")
    : "";

  sectionContent.innerHTML = `
    ${liveSectionMarkup}

    ${section === "image-atlas" ? `
      <div class="section-block">
        <h2>Image Atlas Buckets</h2>
        <div class="section-subtopics">${imageMarkup}</div>
      </div>
    ` : imageUploads.length ? `
      <div class="section-block">
        <h2>Images</h2>
        <div class="section-image-grid">
          ${imageUploads.map((item) => `
            <article class="section-image-card">
              <a href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer"><img src="${escapeHtml(assetUrl(item.path))}" alt="${escapeHtml(item.title || item.note || item.filename)}" /></a>
              <strong>${escapeHtml(item.title || item.note || item.filename)}</strong>
              <small>${escapeHtml(item.description || item.note || "Image")}</small>
              ${bookmarkButton({ type: "upload", title: item.title || item.note || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}
            </article>
          `).join("")}
        </div>
      </div>
    ` : ""}

    ${section !== "image-atlas" && videoUploads.length ? `
      <div class="section-block">
        <h2>Videos</h2>
        <div class="section-video-grid">
          ${videoUploads.map((item) => `
            <article class="section-video-card">
              <video src="${escapeHtml(assetUrl(item.path))}" controls preload="metadata"></video>
              <a href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer">${escapeHtml(item.title || item.note || item.filename)}</a>
              <small>${escapeHtml(item.description || item.note || "Video")}</small>
              ${bookmarkButton({ type: "upload", title: item.title || item.note || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}
            </article>
          `).join("")}
        </div>
      </div>
    ` : ""}

    ${subtopics.length ? `
      <div class="section-block">
        <h2>Subtopics</h2>
        <div class="section-subtopics">
          ${subtopics.map((subtopic) => {
            const linkedArticles = articles.filter((item) => item.subtopicId === subtopic.id);
            const linkedUploads = uploads.filter((item) => item.subtopicId === subtopic.id);
            return `
              <details class="section-subtopic" open>
                <summary>${escapeHtml(subtopic.title)}</summary>
                ${subtopic.body ? `<p>${escapeHtml(subtopic.body)}</p>` : ""}
                ${linkedArticles.length || linkedUploads.length ? `
                  <ul>
                    ${linkedArticles.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.summary || item.source || "Article")}</small>${bookmarkButton({ type: "article", title: item.title, link: item.link, source: item.source || "Article", summary: item.summary || "", bucket: sectionLabels[section] || "Uploaded Content" })}</li>`).join("")}
                    ${linkedUploads.map((item) => `<li><a href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer">${escapeHtml(item.title || item.filename)}</a><small>${escapeHtml(item.note || `${Math.round((item.bytes || 0) / 1024)} KB`)}</small>${bookmarkButton({ type: "upload", title: item.title || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}</li>`).join("")}
                  </ul>
                ` : ""}
              </details>
            `;
          }).join("")}
        </div>
      </div>
    ` : ""}

    ${section !== "image-atlas" && (articles.length || fileUploads.length) ? `
      <div class="section-block">
        <h2>Articles And Files</h2>
        <ul class="section-resource-list">
          ${articles.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.summary || item.source || "Article")}</small>${bookmarkButton({ type: "article", title: item.title, link: item.link, source: item.source || "Article", summary: item.summary || "", bucket: sectionLabels[section] || "Uploaded Content" })}</li>`).join("")}
          ${fileUploads.map((item) => `<li><a href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer">${escapeHtml(item.title || item.filename)}</a><small>${escapeHtml(item.description || item.note || `${Math.round((item.bytes || 0) / 1024)} KB`)}</small>${bookmarkButton({ type: "upload", title: item.title || item.filename, link: assetUrl(item.path), source: "Upload", summary: item.description || item.note || "", bucket: sectionLabels[item.section] || "Uploaded Content", section: item.section, mediaBucket: item.mediaBucket })}</li>`).join("")}
        </ul>
      </div>
    ` : ""}

    ${section !== "image-atlas" && !liveSectionMarkup && !imageUploads.length && !videoUploads.length && !subtopics.length && !articles.length && !fileUploads.length ? '<div class="section-empty">No uploaded content matches this section yet.</div>' : ""}
  `;
}

sectionSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = new URL(window.location.href);
  const query = sectionSearchInput.value.trim();
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  window.history.replaceState({}, "", url);
  renderSection();
});

sectionSearchInput.addEventListener("input", renderSection);

document.addEventListener("click", (event) => {
  const moreButton = event.target.closest("[data-atlas-more]");
  if (moreButton) {
    const tab = moreButton.closest(".atlas-title-tab");
    const hiddenItems = tab ? [...tab.querySelectorAll(".atlas-extra-image[hidden]")] : [];
    hiddenItems.slice(0, 3).forEach((item) => {
      item.hidden = false;
    });
    if (!tab || !tab.querySelector(".atlas-extra-image[hidden]")) {
      moreButton.remove();
    }
    return;
  }

  const button = event.target.closest("[data-bookmark-type]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  toggleBookmark({
    type: button.dataset.bookmarkType,
    title: button.dataset.bookmarkTitle,
    link: button.dataset.bookmarkLink,
    source: button.dataset.bookmarkSource,
    summary: button.dataset.bookmarkSummary,
    bucket: button.dataset.bookmarkBucket,
    section: button.dataset.bookmarkSection,
    mediaBucket: button.dataset.bookmarkMediaBucket,
  });
});

if (initialSectionQuery) {
  sectionSearchInput.value = initialSectionQuery;
}

async function loadSection() {
  const [libraryResponse, articlesResponse, guidelinesResponse] = await Promise.all([
    fetch(`${SERVER_ORIGIN}/api/admin/content?v=${Date.now()}`, { cache: "no-store" }),
    section === "latest-articles" ? fetch(`${SERVER_ORIGIN}/api/articles`, { cache: "no-store" }) : Promise.resolve(null),
    section === "guidelines" ? fetch(`${SERVER_ORIGIN}/api/guidelines`, { cache: "no-store" }) : Promise.resolve(null),
  ]);
  library = await libraryResponse.json();
  if (articlesResponse?.ok) {
    const data = await articlesResponse.json();
    liveArticles = data.articles || [];
  }
  if (guidelinesResponse?.ok) {
    const data = await guidelinesResponse.json();
    liveGuidelines = data.guidelines || [];
  }
  await loadNotebook();
  renderSection();
}

loadSection()
  .catch(() => {
    sectionContent.textContent = "Could not load this section. Make sure the PulmCrit IQ local server is running.";
  });

contentChannel?.addEventListener("message", (event) => {
  if (event.data?.type === "content-updated") loadSection();
});

window.addEventListener("storage", (event) => {
  if (event.key === "pulmcrit-iq-content-updated") loadSection();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadSection();
});

window.addEventListener("focus", loadSection);
setInterval(() => {
  if (!document.hidden) loadSection();
}, CONTENT_SYNC_INTERVAL_MS);
