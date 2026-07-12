const SERVER_ORIGIN = window.location.protocol === "file:"
  ? "http://127.0.0.1:4177"
  : window.location.hostname === "127.0.0.1" && ["4173", "4174", "4175", "4176"].includes(window.location.port)
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

let library = { articles: [], uploads: [], subtopics: [] };
let liveArticles = [];
let liveGuidelines = [];
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
  ["Lung Cancer", ["NLST", "NELSON", "PACIFIC"]],
  ["Critical Care Infectious Diseases", ["RECOVERY", "ACTT-1"]],
  ["Neurocritical Care", ["TTM", "TTM2", "HYPERION", "INTERACT", "INTERACT2", "ATACH", "ATACH-II", "CLEAR III", "MISTIE III"]],
  ["ECMO & Cardiac Arrest", ["CESAR", "EOLIA", "ARREST"]],
].map(([bucket, trials]) => ({ bucket, trials }));

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

function articleBelongs(article) {
  const legacyLabels = {
    "ventilator-lab": ["Ventilator Lab"],
    "core-topics-illustrated": ["Core Topics Illustrated"],
  };
  return article.tile === sectionLabels[section] || (legacyLabels[section] || []).includes(article.tile);
}

function itemMatches(item, searchTerm) {
  if (!searchTerm) return true;
  return JSON.stringify(item).toLowerCase().includes(searchTerm);
}

function renderLiveSection(searchTerm, adminArticles) {
  if (section === "latest-articles") {
    const articles = liveArticles.filter((item) => itemMatches(item, searchTerm));
    if (!articles.length) return "";
    return `
      <div class="section-block">
        <h2>Latest PCCM Articles</h2>
        <ul class="section-resource-list">
          ${articles.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.source || "Journal")} · ${escapeHtml(item.date || "Recent")}</small></li>`).join("")}
        </ul>
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
                  ${bucketGuidelines.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.organization || "Guideline")} · ${escapeHtml(item.topic || "PCCM")} · ${escapeHtml(item.date || "Current")}</small></li>`).join("")}
                </ul>
              </details>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  if (section === "landmark-trials") {
    const manualTrials = adminArticles
      .filter((article) => article.tile === "Landmark Trials")
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
          ...trials.map((trial) => {
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
                ${group.trials.map((trial) => `<li><a href="${escapeHtml(trial.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(trial.title)}</a><small>${escapeHtml(trial.meta)}</small></li>`).join("")}
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
  const imageAtlasBuckets = ["X-rays", "CT scans", "Ultrasound", "Echo", "PET scan", "PFTs"];
  const renderAtlasItem = (item) => {
    const url = escapeHtml(assetUrl(item.path));
    const title = escapeHtml(item.title || item.note || item.filename);
    const description = escapeHtml(item.description || item.note || `${Math.round((item.bytes || 0) / 1024)} KB`);
    if (isImageUpload(item)) {
      return `
        <a class="section-image-card" href="${url}" target="_blank" rel="noreferrer">
          <img src="${url}" alt="${title}" />
          <strong>${title}</strong>
          <small>${description}</small>
        </a>
      `;
    }
    if (isVideoUpload(item)) {
      return `
        <article class="section-video-card">
          <video src="${url}" controls preload="metadata"></video>
          <a href="${url}" target="_blank" rel="noreferrer">${title}</a>
          <small>${description}</small>
        </article>
      `;
    }
    return `
      <a class="section-image-card" href="${url}" target="_blank" rel="noreferrer">
        <strong>${title}</strong>
        <small>${description}</small>
      </a>
    `;
  };
  const imageMarkup = section === "image-atlas"
    ? imageAtlasBuckets.map((bucket) => {
        const bucketItems = uploads.filter((item) => (item.mediaBucket || "X-rays") === bucket);
        return `
          <details class="section-subtopic" open>
            <summary>${escapeHtml(bucket)}</summary>
            <div class="section-image-grid section-atlas-grid">
              ${bucketItems.length ? bucketItems.map(renderAtlasItem).join("") : '<div class="section-empty compact">No uploads in this bucket yet.</div>'}
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
            <a class="section-image-card" href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer">
              <img src="${escapeHtml(assetUrl(item.path))}" alt="${escapeHtml(item.title || item.note || item.filename)}" />
              <strong>${escapeHtml(item.title || item.note || item.filename)}</strong>
              <small>${escapeHtml(item.description || item.note || "Image")}</small>
            </a>
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
                    ${linkedArticles.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.summary || item.source || "Article")}</small></li>`).join("")}
                    ${linkedUploads.map((item) => `<li><a href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer">${escapeHtml(item.filename)}</a><small>${escapeHtml(item.note || `${Math.round((item.bytes || 0) / 1024)} KB`)}</small></li>`).join("")}
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
          ${articles.map((item) => `<li><a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a><small>${escapeHtml(item.summary || item.source || "Article")}</small></li>`).join("")}
          ${fileUploads.map((item) => `<li><a href="${escapeHtml(assetUrl(item.path))}" target="_blank" rel="noreferrer">${escapeHtml(item.title || item.filename)}</a><small>${escapeHtml(item.description || item.note || `${Math.round((item.bytes || 0) / 1024)} KB`)}</small></li>`).join("")}
        </ul>
      </div>
    ` : ""}

    ${section !== "image-atlas" && !liveSectionMarkup && !imageUploads.length && !videoUploads.length && !subtopics.length && !articles.length && !fileUploads.length ? '<div class="section-empty">No uploaded content matches this section yet.</div>' : ""}
  `;
}

sectionSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderSection();
});

sectionSearchInput.addEventListener("input", renderSection);

async function loadSection() {
  const [libraryResponse, articlesResponse, guidelinesResponse] = await Promise.all([
    fetch(`${SERVER_ORIGIN}/api/admin/content`, { cache: "no-store" }),
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
setInterval(loadSection, 30 * 1000);
