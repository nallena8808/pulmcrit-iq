const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const ARTICLE_WINDOW_DAYS = 90;
const ARTICLE_LIMIT = 100;
const GUIDELINE_LIMIT = 80;

const publicDir = path.join(__dirname, "public");
const isVercel = Boolean(process.env.VERCEL);
const bundledArticleCachePath = path.join(__dirname, "articles-cache.json");
const bundledGuidelineCachePath = path.join(__dirname, "guidelines-cache.json");
const bundledContentLibraryPath = path.join(__dirname, "content-library.json");
const runtimeRoot = isVercel ? path.join("/tmp", "pulmcrit-iq") : __dirname;
fs.mkdirSync(runtimeRoot, { recursive: true });
const articleCachePath = path.join(runtimeRoot, "articles-cache.json");
const guidelineCachePath = path.join(runtimeRoot, "guidelines-cache.json");
const uploadRoot = path.join(runtimeRoot, "uploads");
const contentLibraryPath = path.join(runtimeRoot, "content-library.json");
const adminKeyPath = path.join(runtimeRoot, ".pulmcrit-admin-key");
const trialAbstractCache = new Map();
const defaultTileOrder = ["1", "2", "6", "9", "10", "3", "4", "8", "5"];
const defaultHomeSettings = {
  tileOrder: defaultTileOrder,
  tileHeight: 500,
};

const guidelineBuckets = [
  {
    name: "ARDS & Mechanical Ventilation",
    keywords: ["ards", "acute respiratory distress", "mechanical ventilation", "ventilator", "ventilatory", "acute respiratory failure", "noninvasive respiratory support", "liberation", "weaning", "prone"],
  },
  {
    name: "Sepsis, Shock & ICU Care",
    keywords: ["sepsis", "septic", "shock", "vasopressor", "hemodynamic", "haemodynamic", "critical care", "critically ill", "intensive care", "icu", "sedation", "analgesia", "delirium", "immobility", "sleep disruption", "nutrition", "fever", "glycemic"],
  },
  {
    name: "COPD, Asthma & Airways",
    keywords: ["copd", "asthma", "airway", "cough", "bronchiectasis", "bronchoscopy", "tracheostomy", "obstruction"],
  },
  {
    name: "ILD & Sarcoidosis",
    keywords: ["interstitial", "fibrosis", "fibrotic", "ipf", "sarcoidosis", "hypersensitivity pneumonitis"],
  },
  {
    name: "Pulmonary Hypertension & PE",
    keywords: ["pulmonary hypertension", "pulmonary arterial hypertension", "pulmonary embolism", "embolism", "vte", "venous thromboembolism", "antithrombotic", "anticoagulation"],
  },
  {
    name: "Pneumonia, TB, NTM & Fungal Disease",
    keywords: ["pneumonia", "tuberculosis", "tb", "ntm", "nontuberculous", "mycobacterial", "fungal", "aspergillus", "aspergillosis", "infection", "influenza", "rsv", "covid"],
  },
  {
    name: "Pleural Disease",
    keywords: ["pleural", "pleura", "pneumothorax", "effusion", "mesothelioma"],
  },
  {
    name: "Lung Cancer, Nodules & Screening",
    keywords: ["lung cancer", "nodule", "nodules", "screening", "small-cell", "non-small-cell", "malignancy"],
  },
  {
    name: "Sleep & Home Ventilation",
    keywords: ["sleep", "home ventilation", "home mechanical", "home oxygen", "oxygen therapy", "obesity hypoventilation", "long-term ventilation", "long term ventilation"],
  },
  {
    name: "Procedures & Interventional Pulm",
    keywords: ["procedure", "procedural", "interventional", "ebus", "thoracic ultrasound", "ultrasound", "spirometry", "lung function", "pulmonary function", "pleural procedures"],
  },
  {
    name: "ECMO & Transplant",
    keywords: ["ecmo", "extracorporeal", "ecls", "transplant", "transplantation"],
  },
];

const pccmKeywords = [
  "acute respiratory",
  "airway",
  "ards",
  "asthma",
  "bronchiectasis",
  "copd",
  "critically ill",
  "critical care",
  "dyspnea",
  "emphysema",
  "hypoxemia",
  "icu",
  "intensive care",
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

const pubMedJournalQuery = [
  '"N Engl J Med"[ta]',
  '"JAMA"[ta]',
  '"Am J Respir Crit Care Med"[ta]',
  '"Lancet Respir Med"[ta]',
  '"Eur Respir J"[ta]',
  '"Crit Care"[ta]',
  '"Thorax"[ta]',
].join(" OR ");

const pubMedTopicQuery = [
  "pulmonary",
  "respiratory",
  "lung",
  "airway",
  "ventilation",
  "ventilator",
  "critical care",
  "sepsis",
  "shock",
  "ARDS",
  "COPD",
  "asthma",
  "pneumonia",
].join(" OR ");

const fallbackArticles = [
  {
    title: "Pulmonary and critical care update stream from NEJM",
    source: "NEJM",
    link: "https://www.nejm.org/",
    date: "Journal source configured",
    timestamp: 0,
  },
  {
    title: "Pulmonary and critical care update stream from JAMA",
    source: "JAMA",
    link: "https://jamanetwork.com/journals/jama",
    date: "Journal source configured",
    timestamp: 0,
  },
  {
    title: "Latest respiratory and critical care articles from AJRCCM",
    source: "AJRCCM",
    link: "https://www.atsjournals.org/journal/ajrccm",
    date: "Journal source configured",
    timestamp: 0,
  },
  {
    title: "Latest respiratory medicine articles from The Lancet",
    source: "The Lancet Respiratory Medicine",
    link: "https://www.thelancet.com/journals/lanres/home",
    date: "Journal source configured",
    timestamp: 0,
  },
  {
    title: "Latest respiratory articles from the European Respiratory Journal",
    source: "European Respiratory Journal",
    link: "https://publications.ersnet.org/content/erj",
    date: "Journal source configured",
    timestamp: 0,
  },
  {
    title: "Latest critical care articles from Critical Care",
    source: "Critical Care",
    link: "https://ccforum.biomedcentral.com/",
    date: "Journal source configured",
    timestamp: 0,
  },
  {
    title: "Latest respiratory articles from BMJ Thorax",
    source: "Thorax",
    link: "https://thorax.bmj.com/",
    date: "Journal source configured",
    timestamp: 0,
  },
];

const btsGuidelines = [
  ["Asthma (Chronic)", "BTS/NICE/SIGN Joint Guideline on Asthma: diagnosis, monitoring and chronic asthma management", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/asthma-chronic/", "Nov 2024"],
  ["Bronchiectasis", "BTS Guideline for Bronchiectasis in Adults", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/bronchiectasis-in-adults/", "Dec 2018"],
  ["Emergency Oxygen", "BTS Guideline for oxygen use in adults in healthcare and emergency settings", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/emergency-oxygen/", "May 2017"],
  ["Long Term Macrolide Use", "BTS Guideline for Long Term Macrolide Use", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/long-term-macrolide-use/", "Apr 2020"],
  ["Mesothelioma", "BTS Guideline for the Investigation and Management of Pleural Mesothelioma", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/mesothelioma/", "Mar 2018"],
  ["NIV", "BTS/ICS Guideline for the Ventilatory Management of Acute Hypercapnic Respiratory Failure in Adults", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/niv/", "Mar 2016"],
  ["NTM", "BTS Guideline for the Management of Non-Tuberculous Mycobacterial Pulmonary Disease", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/ntm/", "Oct 2017"],
  ["Paediatric sleep-disordered breathing", "BTS Guideline paediatric sleep-disordered breathing", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/paediatric-sleep-disordered-breathing/", "Jun 2023"],
  ["Pleural Disease", "BTS Guideline for Pleural Disease", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/pleural-disease/", "Jul 2023"],
  ["Pneumonia Adults", "Annotated BTS CAP Guideline Summary of Recommendations", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/pneumonia-adults/", "Jan 2015"],
  ["Pulmonary Embolism", "BTS Guideline for the initial outpatient management of pulmonary embolism", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/pulmonary-embolism/", "Jun 2018"],
  ["Pulmonary Nodules", "BTS Guidelines for the Investigation and Management of Pulmonary Nodules", "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/pulmonary-nodules/", "Aug 2015"],
].map(([topic, title, link, date]) => ({ organization: "BTS", topic, title, link, date, source: "Official BTS guideline page" }));

const societyGuidelineSeeds = [
  ["ATS", "Community-acquired pneumonia", "Diagnosis and Treatment of Adults with Community-acquired Pneumonia", "https://www.atsjournals.org/doi/full/10.1164/rccm.201908-1581ST", "2019"],
  ["ATS", "Home oxygen", "Home Oxygen Therapy for Adults with Chronic Lung Disease", "https://www.atsjournals.org/doi/full/10.1164/rccm.202009-3608ST", "2020"],
  ["ATS", "Obesity hypoventilation", "Evaluation and Management of Obesity Hypoventilation Syndrome", "https://www.atsjournals.org/doi/full/10.1164/rccm.201905-1071ST", "2019"],
  ["ATS", "Sarcoidosis", "Diagnosis and Detection of Sarcoidosis", "https://www.atsjournals.org/doi/full/10.1164/rccm.202002-0251ST", "2020"],
  ["ATS", "NTM", "Treatment of Nontuberculous Mycobacterial Pulmonary Disease", "https://www.atsjournals.org/doi/full/10.1164/rccm.202003-0490ST", "2020"],
  ["ATS", "Idiopathic pulmonary fibrosis", "Idiopathic Pulmonary Fibrosis: Diagnosis and Treatment Update", "https://www.atsjournals.org/doi/full/10.1164/rccm.202202-0399ST", "2022"],
  ["ATS", "Severe asthma", "Management of Severe Asthma: ERS/ATS Guideline Update", "https://erj.ersjournals.com/content/55/1/1900588", "2019"],
  ["ATS", "Pulmonary function testing", "ERS/ATS Interpretive Strategies for Routine Lung Function Tests", "https://erj.ersjournals.com/content/60/1/2101499", "2022"],
  ["ATS", "Spirometry", "ERS/ATS Standardization of Spirometry", "https://erj.ersjournals.com/content/53/5/1801219", "2019"],
  ["ATS", "Malignant pleural effusion", "Management of Malignant Pleural Effusions. An Official ATS/STS/STR Clinical Practice Guideline", "https://www.atsjournals.org/doi/full/10.1164/rccm.201807-1415ST", "2018"],
  ["CHEST", "Lung cancer screening", "Screening for Lung Cancer: CHEST Guideline and Expert Panel Report", "https://journal.chestnet.org/article/S0012-3692(21)01323-4/fulltext", "2021"],
  ["CHEST", "VTE", "Antithrombotic Therapy for VTE Disease: CHEST Guideline and Expert Panel Report", "https://journal.chestnet.org/article/S0012-3692(21)01506-3/fulltext", "2021"],
  ["CHEST", "Chronic cough", "Treatment of Unexplained Chronic Cough: CHEST Guideline and Expert Panel Report", "https://journal.chestnet.org/article/S0012-3692(15)00336-0/fulltext", "2016"],
  ["CHEST", "Cough", "Classification of Cough as a Symptom in Adults and Management Algorithms", "https://journal.chestnet.org/article/S0012-3692(17)32918-7/fulltext", "2018"],
  ["CHEST", "Pulmonary arterial hypertension", "Pharmacologic Therapy for Pulmonary Arterial Hypertension in Adults", "https://journal.chestnet.org/article/S0012-3692(14)32780-9/fulltext", "2014"],
  ["CHEST", "Perioperative antithrombotics", "Perioperative Management of Antithrombotic Therapy: CHEST Guideline", "https://journal.chestnet.org/article/S0012-3692(22)01359-9/fulltext", "2022"],
  ["ERS", "Severe asthma", "Management of Severe Asthma: ERS/ATS Guideline Update", "https://erj.ersjournals.com/content/55/1/1900588", "2019"],
  ["ERS", "Chronic cough", "ERS Guidelines on the Diagnosis and Treatment of Chronic Cough in Adults and Children", "https://erj.ersjournals.com/content/55/1/1901136", "2020"],
  ["ERS", "Bronchiectasis", "European Respiratory Society Guidelines for the Management of Adult Bronchiectasis", "https://erj.ersjournals.com/content/50/3/1700629", "2017"],
  ["ERS", "COPD exacerbations", "ERS/ATS Guideline for Management of COPD Exacerbations", "https://erj.ersjournals.com/content/49/3/1600791", "2017"],
  ["ERS", "Pulmonary rehabilitation", "ERS/ATS Policy Statement on Pulmonary Rehabilitation", "https://erj.ersjournals.com/content/38/1/55", "2011"],
  ["ERS", "Pulmonary function testing", "ERS/ATS Interpretive Strategies for Routine Lung Function Tests", "https://erj.ersjournals.com/content/60/1/2101499", "2022"],
  ["ERS", "Spirometry", "ERS/ATS Standardization of Spirometry", "https://erj.ersjournals.com/content/53/5/1801219", "2019"],
  ["SCCM", "Sepsis", "Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock", "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines/Adult-Patients", "2021"],
  ["SCCM", "COVID-19 ICU care", "Surviving Sepsis Campaign Guidelines on the Management of Critically Ill Adults with COVID-19", "https://www.sccm.org/SurvivingSepsisCampaign/Guidelines/COVID-19", "2020"],
  ["SCCM", "Pain, agitation, delirium", "Clinical Practice Guidelines for Pain, Agitation/Sedation, Delirium, Immobility, and Sleep Disruption in Adult ICU Patients", "https://journals.lww.com/ccmjournal/fulltext/2018/09000/clinical_practice_guidelines_for_the_prevention.29.aspx", "2018"],
  ["SCCM", "Liberation from mechanical ventilation", "SCCM ICU Liberation Bundle Resources", "https://www.sccm.org/Clinical-Resources/ICULiberation-Home", "SCCM collection"],
  ["SCCM", "Nutrition in critical illness", "Guidelines for the Provision and Assessment of Nutrition Support Therapy in the Adult Critically Ill Patient", "https://www.sccm.org/Clinical-Resources/Guidelines/Guidelines/Guidelines-for-the-Provision-and-Assessment-of-Nutrition", "2016"],
  ["SCCM", "ICU admission and discharge", "Guidelines for ICU Admission, Discharge, and Triage", "https://journals.lww.com/ccmjournal/fulltext/2016/08000/guidelines_for_icu_admission,_discharge,_and.25.aspx", "2016"],
  ["SCCM", "Family-centered ICU care", "Guidelines for Family-Centered Care in the Neonatal, Pediatric, and Adult ICU", "https://journals.lww.com/ccmjournal/fulltext/2017/01000/guidelines_for_family_centered_care_in_the.16.aspx", "2017"],
  ["SCCM", "Palliative care in ICU", "Clinical Practice Guidelines for Quality Palliative Care in the ICU", "https://www.sccm.org/Clinical-Resources/Guidelines", "SCCM collection"],
  ["ELSO", "ECMO", "ELSO Guidelines for ECMO and ECLS", "https://www.elso.org/ecmo-resources/elso-ecmo-guidelines.aspx", "Official ELSO guideline hub"],
  ["CMS", "Home NIV and home ventilation", "CMS LCD: Respiratory Assist Devices (L33800)", "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=33800", "Revision effective Jun 9, 2025"],
].map(([organization, topic, title, link, date]) => ({ organization, topic, title, link, date, source: "Built-in society guideline index" }));

const guidelineHubLinks = [
  {
    organization: "BTS",
    topic: "Guideline hub",
    title: "British Thoracic Society Guidelines",
    link: "https://www.brit-thoracic.org.uk/clinical-resources/guidelines/",
    date: "Official hub",
    source: "BTS",
  },
  {
    organization: "ATS",
    topic: "Guideline hub",
    title: "ATS Clinical Practice Guidelines, Statements & Reports",
    link: "https://site.thoracic.org/clinicians-researchers/clinical-practice-guidelines-statements-and-reports",
    date: "Official hub",
    source: "ATS",
  },
  {
    organization: "CHEST",
    topic: "Guideline hub",
    title: "CHEST Guidelines and Topic Collections",
    link: "https://www.chestnet.org/Guidelines-and-Topic-Collections",
    date: "Official hub",
    source: "CHEST",
  },
  {
    organization: "ERS",
    topic: "Guideline hub",
    title: "European Respiratory Society Guidelines",
    link: "https://www.ersnet.org/science-and-research/guidelines/",
    date: "Official hub",
    source: "ERS",
  },
  {
    organization: "SCCM",
    topic: "Guideline hub",
    title: "Society of Critical Care Medicine Guidelines",
    link: "https://www.sccm.org/Clinical-Resources/Guidelines",
    date: "Official hub",
    source: "SCCM",
  },
];

const guidelineQueries = [
  {
    organization: "ATS",
    term: '("American Thoracic Society"[Title] OR "American Thoracic Society"[Corporate Author]) AND (guideline[Title] OR "clinical practice guideline"[Title] OR statement[Title])',
  },
  {
    organization: "CHEST",
    term: '("Chest"[Journal] OR "American College of Chest Physicians"[Title] OR CHEST[Title]) AND (guideline[Title] OR "expert panel report"[Title] OR "clinical practice guideline"[Title])',
  },
  {
    organization: "ERS",
    term: '("European Respiratory Society"[Title] OR "European Respiratory Society"[Corporate Author]) AND (guideline[Title] OR statement[Title] OR "task force"[Title])',
  },
  {
    organization: "SCCM",
    term: '("Society of Critical Care Medicine"[Title] OR "Surviving Sepsis Campaign"[Title] OR "American College of Critical Care Medicine"[Title] OR "Critical Care Medicine"[Journal]) AND (guideline[Title] OR guidelines[Title] OR "clinical practice guideline"[Title] OR statement[Title])',
  },
];

let articleState = readArticleCache();
let guidelineState = readGuidelineCache();
let refreshPromise = null;
let guidelineRefreshPromise = null;
let pubMedQueue = Promise.resolve();

function getAdminKey() {
  if (process.env.PULMCRIT_ADMIN_KEY) return process.env.PULMCRIT_ADMIN_KEY;
  if (isVercel) return "05062407med";
  try {
    return fs.readFileSync(adminKeyPath, "utf8").trim();
  } catch {
    const key = `PulmCritIQ-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    fs.writeFileSync(adminKeyPath, key);
    return key;
  }
}

function hasAdminAccess(request) {
  return request.headers["x-admin-key"] === getAdminKey();
}

function readContentLibrary() {
  try {
    const library = JSON.parse(fs.readFileSync(contentLibraryPath, "utf8"));
    return {
      articles: library.articles || [],
      uploads: library.uploads || [],
      subtopics: library.subtopics || [],
      settings: {
        ...defaultHomeSettings,
        ...(library.settings || {}),
        tileOrder: normalizeTileOrder(library.settings?.tileOrder),
        tileHeight: normalizeTileHeight(library.settings?.tileHeight),
      },
    };
  } catch {
    try {
      const library = JSON.parse(fs.readFileSync(bundledContentLibraryPath, "utf8"));
      return {
        articles: library.articles || [],
        uploads: library.uploads || [],
        subtopics: library.subtopics || [],
        settings: {
          ...defaultHomeSettings,
          ...(library.settings || {}),
          tileOrder: normalizeTileOrder(library.settings?.tileOrder),
          tileHeight: normalizeTileHeight(library.settings?.tileHeight),
        },
      };
    } catch {
      return {
        articles: [],
        uploads: [],
        subtopics: [],
        settings: defaultHomeSettings,
      };
    }
  }
}

function writeContentLibrary(library) {
  fs.writeFileSync(contentLibraryPath, JSON.stringify(library, null, 2));
}

function normalizeTileOrder(tileOrder) {
  const valid = new Set(defaultTileOrder);
  const requested = Array.isArray(tileOrder) ? tileOrder.map(String).filter((tile) => valid.has(tile)) : [];
  return [...requested, ...defaultTileOrder.filter((tile) => !requested.includes(tile))];
}

function normalizeTileHeight(tileHeight) {
  const height = Number(tileHeight);
  if (!Number.isFinite(height)) return defaultHomeSettings.tileHeight;
  return Math.max(320, Math.min(500, Math.round(height / 10) * 10));
}

function readArticleCache() {
  try {
    return JSON.parse(fs.readFileSync(articleCachePath, "utf8"));
  } catch {
    try {
      return JSON.parse(fs.readFileSync(bundledArticleCachePath, "utf8"));
    } catch {
      return {
        articles: fallbackArticles,
        updatedAt: null,
        nextRefreshAt: null,
        status: "Waiting for first journal refresh",
        sourceStatus: [],
      };
    }
  }
}

function writeArticleCache() {
  fs.writeFileSync(articleCachePath, JSON.stringify(articleState, null, 2));
}

function readGuidelineCache() {
  try {
    const cached = JSON.parse(fs.readFileSync(guidelineCachePath, "utf8"));
    const guidelines = [...guidelineHubLinks, ...btsGuidelines, ...societyGuidelineSeeds, ...(cached.guidelines || [])]
      .map(withGuidelineBucket)
      .filter(keepGuidelineInBucket)
      .filter((guideline, index, all) => all.findIndex((candidate) => `${candidate.organization}:${candidate.title}` === `${guideline.organization}:${guideline.title}`) === index);
    return {
      ...cached,
      guidelines,
      buckets: summarizeGuidelineBuckets(guidelines),
    };
  } catch {
    try {
      const cached = JSON.parse(fs.readFileSync(bundledGuidelineCachePath, "utf8"));
      const guidelines = [...guidelineHubLinks, ...btsGuidelines, ...societyGuidelineSeeds, ...(cached.guidelines || [])]
        .map(withGuidelineBucket)
        .filter(keepGuidelineInBucket)
        .filter((guideline, index, all) => all.findIndex((candidate) => `${candidate.organization}:${candidate.title}` === `${guideline.organization}:${guideline.title}`) === index);
      return {
        ...cached,
        guidelines,
        buckets: summarizeGuidelineBuckets(guidelines),
      };
    } catch {
      const guidelines = [...guidelineHubLinks, ...btsGuidelines, ...societyGuidelineSeeds].map(withGuidelineBucket).filter(keepGuidelineInBucket);
      return {
        guidelines,
        buckets: summarizeGuidelineBuckets(guidelines),
        updatedAt: null,
        nextRefreshAt: null,
        status: "Waiting for first guideline refresh",
        sourceStatus: [],
      };
    }
  }
}

function writeGuidelineCache() {
  fs.writeFileSync(guidelineCachePath, JSON.stringify(guidelineState, null, 2));
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function stripTags(value) {
  return decodeXml(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function getLink(block) {
  const href = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (href) return decodeXml(href[1]);
  return stripTags(getTag(block, "link"));
}

function isPccmArticle(article) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return pccmKeywords.some((keyword) => text.includes(keyword));
}

function assignGuidelineBucket(guideline) {
  const text = `${guideline.topic || ""} ${guideline.title || ""} ${guideline.source || ""}`.toLowerCase();
  const match = guidelineBuckets.find((bucket) => bucket.keywords.some((keyword) => text.includes(keyword)));
  return match?.name || "";
}

function withGuidelineBucket(guideline) {
  return {
    ...guideline,
    bucket: guideline.bucket || assignGuidelineBucket(guideline),
  };
}

function keepGuidelineInBucket(guideline) {
  if (!guideline.bucket || guideline.bucket === "Quality, Safety & ICU Systems") return false;
  if (guideline.bucket === "Procedures & Interventional Pulm" && /chest pain/i.test(guideline.title || "")) return false;
  if (guideline.bucket !== "ECMO & Transplant") return true;
  return guideline.organization === "ELSO";
}

function summarizeGuidelineBuckets(guidelines) {
  return guidelineBuckets.map((bucket) => ({
    name: bucket.name,
    count: guidelines.filter((guideline) => guideline.bucket === bucket.name).length,
  }));
}

function parseFeed(xmlText, source) {
  const blocks = xmlText.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];

  return blocks.map((block) => {
    const title = stripTags(getTag(block, "title")) || "Untitled article";
    const summary = stripTags(getTag(block, "description") || getTag(block, "summary") || getTag(block, "content"));
    const dateText = stripTags(getTag(block, "pubDate") || getTag(block, "published") || getTag(block, "updated"));
    const timestamp = Date.parse(dateText) || 0;
    const date = timestamp
      ? new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "New";

    return {
      title,
      source: source.name,
      link: getLink(block) || source.url,
      date,
      timestamp,
      summary,
    };
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": "PulmCritIQ/1.0 article feed updater",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSource(source) {
  const xmlText = await fetchWithTimeout(source.url);
  const articles = parseFeed(xmlText, source);
  return source.filterForPccm ? articles.filter(isPccmArticle) : articles;
}

function normalizePubMedSource(summary) {
  const source = summary.fulljournalname || summary.source || "Journal article";
  const sourceMap = [
    ["new england journal", "NEJM"],
    ["jama", "JAMA"],
    ["american journal of respiratory and critical care medicine", "AJRCCM"],
    ["lancet respiratory medicine", "The Lancet Respiratory Medicine"],
    ["european respiratory journal", "European Respiratory Journal"],
    ["critical care", "Critical Care"],
    ["thorax", "Thorax"],
  ];
  const lowerSource = source.toLowerCase();
  return sourceMap.find(([needle]) => lowerSource.includes(needle))?.[1] || source;
}

function formatDateFromTimestamp(timestamp, fallback = "New") {
  return timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : fallback;
}

function formatDateForPubMed(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

async function fetchJsonWithTimeout(url) {
  const text = await fetchWithTimeout(url);
  return JSON.parse(text);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPubMedJsonWithTimeout(url) {
  const run = async () => {
    await wait(450);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await fetchJsonWithTimeout(url);
      } catch (error) {
        if (!String(error.message).includes("HTTP 429") || attempt === 2) throw error;
        await wait(2000 * (attempt + 1));
      }
    }
    throw new Error("PubMed request failed");
  };

  const next = pubMedQueue.then(run, run);
  pubMedQueue = next.catch(() => {});
  return next;
}

async function fetchPubMedJournalArticles() {
  const query = `(${pubMedJournalQuery}) AND (${pubMedTopicQuery})`;
  const maxDate = new Date();
  const minDate = new Date(maxDate.getTime() - ARTICLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("sort", "pub date");
  searchUrl.searchParams.set("retmax", String(ARTICLE_LIMIT));
  searchUrl.searchParams.set("datetype", "pdat");
  searchUrl.searchParams.set("mindate", formatDateForPubMed(minDate));
  searchUrl.searchParams.set("maxdate", formatDateForPubMed(maxDate));
  searchUrl.searchParams.set("term", query);

  const searchData = await fetchPubMedJsonWithTimeout(searchUrl);
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summaryUrl.searchParams.set("db", "pubmed");
  summaryUrl.searchParams.set("retmode", "json");
  summaryUrl.searchParams.set("id", ids.join(","));

  const summaryData = await fetchPubMedJsonWithTimeout(summaryUrl);
  return ids
    .map((id) => summaryData.result?.[id])
    .filter(Boolean)
    .map((summary) => {
      const timestamp = Date.parse(summary.pubdate) || 0;
      return {
        title: summary.title || "Untitled article",
        source: normalizePubMedSource(summary),
        link: `https://pubmed.ncbi.nlm.nih.gov/${summary.uid}/`,
        date: formatDateFromTimestamp(timestamp, summary.pubdate || "New"),
        timestamp,
        summary: summary.sorttitle || "",
      };
    })
    .filter((article) => {
      const respiratoryJournals = ["AJRCCM", "The Lancet Respiratory Medicine", "European Respiratory Journal", "Critical Care", "Thorax"];
      return respiratoryJournals.includes(article.source) || isPccmArticle(article);
    })
    .filter((article) => !article.timestamp || article.timestamp <= Date.now());
}

async function fetchPubMedArticlesForJournal(journalTerm, sourceLabel) {
  const maxDate = new Date();
  const minDate = new Date(maxDate.getTime() - ARTICLE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("sort", "pub date");
  searchUrl.searchParams.set("retmax", "25");
  searchUrl.searchParams.set("datetype", "pdat");
  searchUrl.searchParams.set("mindate", formatDateForPubMed(minDate));
  searchUrl.searchParams.set("maxdate", formatDateForPubMed(maxDate));
  searchUrl.searchParams.set("term", journalTerm);

  const searchData = await fetchPubMedJsonWithTimeout(searchUrl);
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summaryUrl.searchParams.set("db", "pubmed");
  summaryUrl.searchParams.set("retmode", "json");
  summaryUrl.searchParams.set("id", ids.join(","));

  const summaryData = await fetchPubMedJsonWithTimeout(summaryUrl);
  return ids
    .map((id) => summaryData.result?.[id])
    .filter(Boolean)
    .map((summary) => {
      const timestamp = Date.parse(summary.pubdate) || 0;
      return {
        title: summary.title || "Untitled article",
        source: sourceLabel,
        link: `https://pubmed.ncbi.nlm.nih.gov/${summary.uid}/`,
        date: formatDateFromTimestamp(timestamp, summary.pubdate || "New"),
        timestamp,
        summary: summary.sorttitle || "",
      };
    })
    .filter((article) => !article.timestamp || article.timestamp <= Date.now());
}

async function fetchPubMedGuidelines(queryConfig) {
  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("sort", "pub date");
  searchUrl.searchParams.set("retmax", String(GUIDELINE_LIMIT));
  searchUrl.searchParams.set("term", queryConfig.term);

  const searchData = await fetchPubMedJsonWithTimeout(searchUrl);
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
  summaryUrl.searchParams.set("db", "pubmed");
  summaryUrl.searchParams.set("retmode", "json");
  summaryUrl.searchParams.set("id", ids.join(","));

  const summaryData = await fetchPubMedJsonWithTimeout(summaryUrl);
  return ids
    .map((id) => summaryData.result?.[id])
    .filter(Boolean)
    .map((summary) => {
      const timestamp = Date.parse(summary.pubdate) || 0;
      return {
        organization: queryConfig.organization,
        topic: summary.source || "Guideline",
        title: summary.title || "Untitled guideline",
        link: `https://pubmed.ncbi.nlm.nih.gov/${summary.uid}/`,
        date: formatDateFromTimestamp(timestamp, summary.pubdate || "New"),
        timestamp,
        source: "PubMed guideline index",
      };
    })
    .filter((guideline) => !guideline.timestamp || guideline.timestamp <= Date.now());
}

function getXmlBlocks(xmlText, tagName) {
  return [...xmlText.matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"))].map((match) => match[1]);
}

function parsePubMedArticleXml(xmlText, fallback) {
  const title = stripTags(getTag(xmlText, "ArticleTitle")) || fallback.name;
  const journal = stripTags(getTag(xmlText, "Title")) || "PubMed";
  const abstractBlocks = getXmlBlocks(xmlText, "AbstractText").map(stripTags).filter(Boolean);
  const abstract = abstractBlocks.join("\n\n");
  const pmid = stripTags(getTag(xmlText, "PMID"));
  const doi = xmlText.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/i)?.[1];
  const link = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(fallback.searchTerm)}`;

  return {
    name: fallback.name,
    title,
    journal,
    abstract: abstract || "Abstract not available from PubMed for this trial. Use the article link below.",
    link,
    doi: doi ? stripTags(doi) : "",
  };
}

async function fetchTrialAbstract({ name, description, bucket }) {
  const searchTerm = `${name} ${description || ""} ${bucket || ""}`.trim();
  const cacheKey = searchTerm.toLowerCase();
  if (trialAbstractCache.has(cacheKey)) return trialAbstractCache.get(cacheKey);

  const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("retmax", "1");
  searchUrl.searchParams.set("sort", "relevance");
  searchUrl.searchParams.set("term", `${searchTerm} clinical trial`);

  const fallback = {
    name,
    searchTerm,
    title: name,
    journal: "PubMed",
    abstract: "Abstract not available from PubMed for this trial. Use the article link below.",
    link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(searchTerm)}`,
    doi: "",
  };

  try {
    const searchData = await fetchPubMedJsonWithTimeout(searchUrl);
    const id = searchData.esearchresult?.idlist?.[0];
    if (!id) {
      trialAbstractCache.set(cacheKey, fallback);
      return fallback;
    }

    const fetchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi");
    fetchUrl.searchParams.set("db", "pubmed");
    fetchUrl.searchParams.set("retmode", "xml");
    fetchUrl.searchParams.set("id", id);
    const xmlText = await fetchWithTimeout(fetchUrl);
    const detail = parsePubMedArticleXml(xmlText, fallback);
    trialAbstractCache.set(cacheKey, detail);
    return detail;
  } catch {
    trialAbstractCache.set(cacheKey, fallback);
    return fallback;
  }
}

async function refreshGuidelines(force = false) {
  if (guidelineRefreshPromise) return guidelineRefreshPromise;

  const cacheFresh = guidelineState.updatedAt && Date.now() - new Date(guidelineState.updatedAt).getTime() < REFRESH_INTERVAL_MS;
  if (!force && cacheFresh) return guidelineState;

  guidelineRefreshPromise = (async () => {
    const results = await Promise.allSettled(guidelineQueries.map(fetchPubMedGuidelines));
    const indexedGuidelines = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value);
    const sourceStatus = results.map((result, index) => ({
      source: guidelineQueries[index].organization,
      ok: result.status === "fulfilled",
      count: result.status === "fulfilled" ? result.value.length : 0,
      error: result.status === "rejected" ? String(result.reason.message || result.reason) : null,
    }));
    const guidelines = [...guidelineHubLinks, ...btsGuidelines, ...societyGuidelineSeeds, ...indexedGuidelines]
      .map(withGuidelineBucket)
      .filter(keepGuidelineInBucket)
      .filter((guideline, index, all) => all.findIndex((candidate) => `${candidate.organization}:${candidate.title}` === `${guideline.organization}:${guideline.title}`) === index)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const now = new Date();
    guidelineState = {
      guidelines,
      buckets: summarizeGuidelineBuckets(guidelines),
      updatedAt: now.toISOString(),
      nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString(),
      status: "Guidelines updated from official hubs and indexed society documents",
      sourceStatus,
    };
    writeGuidelineCache();
    return guidelineState;
  })().finally(() => {
    guidelineRefreshPromise = null;
  });

  return guidelineRefreshPromise;
}

async function refreshArticles(force = false) {
  if (refreshPromise) return refreshPromise;

  const cacheFresh = articleState.updatedAt && Date.now() - new Date(articleState.updatedAt).getTime() < REFRESH_INTERVAL_MS;
  if (!force && cacheFresh) return articleState;

  refreshPromise = (async () => {
    const articleSources = [
      ...feedSources.map((source) => ({ name: source.name, run: () => fetchSource(source) })),
      { name: "PubMed journal index", run: fetchPubMedJournalArticles },
      { name: "Critical Care PubMed", run: () => fetchPubMedArticlesForJournal('"Crit Care"[ta]', "Critical Care") },
      { name: "Thorax PubMed", run: () => fetchPubMedArticlesForJournal('"Thorax"[ta]', "Thorax") },
    ];
    const results = await Promise.allSettled(articleSources.map((source) => source.run()));
    const sourceStatus = results.map((result, index) => ({
      source: articleSources[index].name,
      ok: result.status === "fulfilled",
      count: result.status === "fulfilled" ? result.value.length : 0,
      error: result.status === "rejected" ? String(result.reason.message || result.reason) : null,
    }));

    const articles = results
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value)
      .filter((article, index, all) => all.findIndex((candidate) => candidate.title === article.title) === index)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, ARTICLE_LIMIT);

    const now = new Date();
    articleState = {
      articles: articles.length ? articles : articleState.articles || fallbackArticles,
      updatedAt: now.toISOString(),
      nextRefreshAt: new Date(now.getTime() + REFRESH_INTERVAL_MS).toISOString(),
      status: articles.length ? "Live journal feeds updated" : "Journal feeds unavailable; showing cached articles",
      sourceStatus,
    };
    writeArticleCache();
    return articleState;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function sendJson(response, data) {
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(data));
}

function sanitizeName(value) {
  return String(value || "upload")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

function parseMultipartUpload(request, body) {
  const contentType = request.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) return [];

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const files = [];
  let cursor = body.indexOf(boundaryBuffer);

  while (cursor !== -1) {
    const next = body.indexOf(boundaryBuffer, cursor + boundaryBuffer.length);
    if (next === -1) break;

    const part = body.subarray(cursor + boundaryBuffer.length + 2, next - 2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString("utf8");
      const filename = headers.match(/filename="([^"]+)"/)?.[1];
      if (filename) {
        files.push({
          filename: sanitizeName(filename),
          content: part.subarray(headerEnd + 4),
        });
      }
    }

    cursor = next;
  }

  return files;
}

function receiveBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function isImageFilename(filename) {
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(String(filename || ""));
}

function isVideoFilename(filename) {
  return /\.(mp4|m4v|mov|webm|ogv|ogg)$/i.test(String(filename || ""));
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function handleUpload(request, response, section) {
  if (section === "latest-articles") {
    sendJson(response, { ok: false, error: "Latest PCCM Articles is an automatic feed and does not accept admin uploads." });
    return;
  }
  const body = await receiveBody(request);
  const files = parseMultipartUpload(request, body);
  const sectionDir = path.join(uploadRoot, sanitizeName(section));
  fs.mkdirSync(sectionDir, { recursive: true });
  const url = new URL(request.url, `http://${request.headers.host}`);
  const subtopicId = String(url.searchParams.get("subtopicId") || "").trim();
  const subtopicTitle = String(url.searchParams.get("subtopicTitle") || "").trim();
  const uploadTitle = String(url.searchParams.get("title") || "").trim();
  const note = String(url.searchParams.get("note") || "").trim();
  const mediaBucket = String(url.searchParams.get("mediaBucket") || "").trim();
  const fileMeta = safeJsonParse(String(url.searchParams.get("fileMeta") || "[]"), []);
  const requestedSlot = String(url.searchParams.get("featuredSlot") || "").trim();
  const featuredSlot = ["1", "2", "3"].includes(requestedSlot) ? requestedSlot : "";

  let featuredSlotUsed = false;
  const saved = files.map((file, index) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${timestamp}-${file.filename}`;
    const filePath = path.join(sectionDir, filename);
    fs.writeFileSync(filePath, file.content);
    const isImage = isImageFilename(filename);
    const isVideo = isVideoFilename(filename);
    const meta = Array.isArray(fileMeta) ? fileMeta[index] || {} : {};
    const title = String(meta.title || uploadTitle || file.filename).trim();
    const description = String(meta.description || note || "").trim();
    const fileFeaturedSlot = isImage && featuredSlot && !featuredSlotUsed ? featuredSlot : "";
    if (fileFeaturedSlot) featuredSlotUsed = true;
    return {
      filename,
      title,
      path: `/uploads/${sanitizeName(section)}/${filename}`,
      bytes: file.content.length,
      uploadedAt: new Date().toISOString(),
      subtopicId,
      subtopicTitle,
      note: description,
      description,
      mediaBucket,
      isImage,
      isVideo,
      featuredSlot: fileFeaturedSlot,
    };
  });

  const library = readContentLibrary();
  const savedWithSection = saved.map((file) => ({ ...file, section }));
  let existingUploads = library.uploads || [];
  savedWithSection.forEach((file) => {
    if (file.featuredSlot) {
      existingUploads = existingUploads.filter((item) => !(item.section === section && item.featuredSlot === file.featuredSlot));
    }
  });
  library.uploads = [...savedWithSection, ...existingUploads];
  writeContentLibrary(library);

  sendJson(response, { ok: true, section, saved });
}

async function handleSubtopic(request, response) {
  const body = await receiveBody(request);
  const payload = JSON.parse(body.toString("utf8") || "{}");
  const now = new Date().toISOString();
  const title = String(payload.title || "").trim();
  const section = String(payload.section || "general").trim();
  const existingId = String(payload.id || "").trim();
  const subtopic = {
    id: existingId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    section,
    body: String(payload.body || "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  if (!subtopic.title) {
    sendJson(response, { ok: false, error: "Subtopic title is required" });
    return;
  }

  const library = readContentLibrary();
  const index = library.subtopics.findIndex((item) => item.id === subtopic.id);
  if (index >= 0) {
    library.subtopics[index] = {
      ...library.subtopics[index],
      ...subtopic,
      createdAt: library.subtopics[index].createdAt || now,
    };
  } else {
    library.subtopics = [subtopic, ...library.subtopics];
  }
  writeContentLibrary(library);
  sendJson(response, { ok: true, subtopic });
}

const trialBucketLookup = [
  ["Mechanical Ventilation", ["ARMA", "ARDSNet", "PROSEVA", "FACCT", "ALVEOLI", "ACURASYS", "ROSE", "DEXA-ARDS", "EOLIA", "CESAR", "Esteban"]],
  ["Sepsis & Septic Shock", ["Rivers", "EGDT", "ProCESS", "ARISE", "ProMISe", "SAFE", "SMART", "CLASSIC", "CLOVERS", "ADRENAL", "APROCCHSS"]],
  ["Shock & Hemodynamics", ["VASST", "ATHOS-3", "IABP-SHOCK", "CULPRIT-SHOCK"]],
  ["Transfusion & Fluids", ["TRICC", "BaSICS", "PLUS"]],
  ["Acute Kidney Injury", ["AKIKI", "ELAIN", "STARRT-AKI", "RENAL"]],
  ["ICU Nutrition", ["EDEN", "EPaNIC", "NUTRIREA-2"]],
  ["Pulmonary Embolism", ["PEITHO", "ULTIMA", "MOPETT"]],
  ["COPD", ["TORCH", "UPLIFT", "FLAME", "IMPACT", "ETHOS", "BOREAS", "NOTUS", "dupilumab"]],
  ["Asthma", ["SYGMA", "Novel START", "NAVIGATOR", "LIBERTY ASTHMA QUEST"]],
  ["Interstitial Lung Disease", ["ASCEND", "INPULSIS", "INBUILD", "SENSCIS"]],
  ["Pulmonary Hypertension", ["SERAPHIN", "AMBITION", "GRIPHON", "INCREASE"]],
  ["Pleural Disease", ["MIST-2", "AMPLE"]],
  ["Sleep Medicine", ["SAVE", "SERVE-HF"]],
  ["Lung Cancer", ["NLST", "NELSON", "PACIFIC"]],
  ["Critical Care Infectious Diseases", ["RECOVERY", "ACTT-1"]],
  ["Neurocritical Care", ["TTM", "TTM2", "HYPERION", "INTERACT", "INTERACT2", "ATACH", "ATACH-II", "CLEAR III", "MISTIE III"]],
  ["ECMO & Cardiac Arrest", ["ARREST"]],
];

function detectTrialName(text) {
  const cleanText = stripTags(text || "");
  const knownTrials = trialBucketLookup.flatMap(([, trials]) => trials).filter((trial) => trial !== "dupilumab");
  const knownMatch = knownTrials.find((trial) => new RegExp(`\\b${trial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(cleanText));
  if (knownMatch) return knownMatch;
  const candidates = [...cleanText.matchAll(/\b([A-Z][A-Z0-9-]{2,})\b(?=[^.!?]{0,80}\btrial\b)|\btrial\b[^.!?]{0,80}\b([A-Z][A-Z0-9-]{2,})\b/g)]
    .map((match) => match[1] || match[2])
    .filter((value) => !["COPD", "NEJM", "JAMA", "ATS", "ERS", "CHEST", "PCCM", "HTML", "PDF"].includes(value));
  return candidates[0] || "";
}

async function fetchArticleMetadata(link) {
  if (!/^https?:\/\//i.test(link)) return { title: "", trialName: "" };
  try {
    const html = await fetchWithTimeout(link);
    const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const cleanedTitle = title.replace(/\s*[-|]\s*(PubMed|NEJM|JAMA|The Lancet|ScienceDirect|Wiley|BMJ|ATS Journals).*$/i, "").trim();
    return {
      title: cleanedTitle,
      trialName: detectTrialName(`${cleanedTitle} ${html.slice(0, 80000)}`),
    };
  } catch {
    return { title: "", trialName: "" };
  }
}

function inferTrialBucket(title, link, fallback = "") {
  if (fallback) return fallback;
  const text = `${title || ""} ${link || ""}`.toLowerCase();
  const match = trialBucketLookup.find(([, trials]) => trials.some((trial) => text.includes(trial.toLowerCase())));
  if (match) return match[0];
  return "Mechanical Ventilation";
}

async function handleManualArticle(request, response) {
  const body = await receiveBody(request);
  const payload = JSON.parse(body.toString("utf8") || "{}");
  const now = new Date().toISOString();
  const link = String(payload.link || "#").trim();
  const manualTitle = String(payload.manualTitle || payload.title || "").trim();
  const payloadTitle = manualTitle;
  const tile = String(payload.tile || "Latest PCCM Articles").trim();
  if (tile === "Latest PCCM Articles") {
    sendJson(response, { ok: false, error: "Latest PCCM Articles is an automatic feed and does not accept admin uploads." });
    return;
  }
  const metadata = !payloadTitle || payloadTitle === link || tile === "Landmark Trials" ? await fetchArticleMetadata(link) : { title: "", trialName: "" };
  const title = payloadTitle && payloadTitle !== link
    ? payloadTitle
    : tile === "Landmark Trials" && metadata.trialName
      ? metadata.trialName
      : metadata.title || link;
  const article = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    source: String(payload.source || (tile === "Landmark Trials" ? "Landmark Trial" : "PulmCrit IQ Admin")).trim(),
    link,
    tile,
    guidelineBucket: String(payload.guidelineBucket || "").trim(),
    trialBucket: tile === "Landmark Trials"
      ? String(payload.trialBucketLocked || false) === "true"
        ? String(payload.trialBucket || "").trim()
        : inferTrialBucket(title, link, "")
      : "",
    subtopicId: String(payload.subtopicId || "").trim(),
    subtopicTitle: String(payload.subtopicTitle || "").trim(),
    summary: String(payload.summary || "").trim(),
    date: payload.date || new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    timestamp: Date.now(),
    createdAt: now,
  };

  if (!article.title) {
    sendJson(response, { ok: false, error: "Title is required" });
    return;
  }

  const library = readContentLibrary();
  library.articles = [article, ...(library.articles || [])];
  writeContentLibrary(library);
  sendJson(response, { ok: true, article });
}

async function handleAdminSettings(request, response) {
  const body = await receiveBody(request);
  const payload = JSON.parse(body.toString("utf8") || "{}");
  const library = readContentLibrary();
  library.settings = {
    ...library.settings,
    tileOrder: normalizeTileOrder(payload.tileOrder),
    tileHeight: normalizeTileHeight(payload.tileHeight),
  };
  writeContentLibrary(library);
  sendJson(response, { ok: true, settings: library.settings });
}

async function handleDeleteContent(request, response) {
  const body = await receiveBody(request);
  const payload = JSON.parse(body.toString("utf8") || "{}");
  const type = String(payload.type || "").trim();
  const id = String(payload.id || "").trim();
  const library = readContentLibrary();

  if (type === "article") {
    const before = (library.articles || []).length;
    library.articles = (library.articles || []).filter((article) => article.id !== id);
    const deleted = before - library.articles.length;
    if (!deleted) {
      sendJson(response, { ok: false, error: "Article not found in the content library.", deleted: 0 });
      return;
    }
    writeContentLibrary(library);
    sendJson(response, { ok: true, deleted });
    return;
  }

  if (type === "upload") {
    const upload = (library.uploads || []).find((item) => item.path === id || item.filename === id);
    if (!upload) {
      sendJson(response, { ok: false, error: "Upload not found in the content library.", deleted: 0 });
      return;
    }
    library.uploads = (library.uploads || []).filter((item) => item.path !== id && item.filename !== id);
    if (upload?.path) {
      const relativeUploadPath = path.normalize(upload.path).replace(/^[/\\]+/, "").replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(publicDir, relativeUploadPath);
      if (filePath.startsWith(publicDir)) {
        fs.rm(filePath, { force: true }, () => {});
      }
    }
    writeContentLibrary(library);
    sendJson(response, { ok: true, deleted: 1 });
    return;
  }

  sendJson(response, { ok: false, error: "Unknown content type" });
}

function landmarkTrialSearchItems() {
  const buckets = [
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
  ];

  return buckets.flatMap(([bucket, trials]) => trials.map((trial) => {
    const [name, description] = trial.split(" - ");
    return {
      bucket,
      title: name,
      summary: description || "",
      link: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`${name} ${description || ""} ${bucket}`)}`,
    };
  }));
}

function matchesQuery(item, query) {
  return `${item.title || ""} ${item.summary || ""} ${item.source || ""} ${item.bucket || ""} ${item.topic || ""}`.toLowerCase().includes(query);
}

async function handleSearch(url, response) {
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const library = readContentLibrary();
  const guidelineStateForSearch = await refreshGuidelines(false).catch(() => guidelineState);
  const articleStateForSearch = await refreshArticles(false).catch(() => articleState);
  const manualArticles = library.articles || [];
  const allArticles = [...manualArticles.filter((item) => item.tile === "Latest PCCM Articles"), ...(articleStateForSearch.articles || [])];
  const manualGuidelines = manualArticles
    .filter((item) => item.tile === "Guidelines")
    .map((item) => ({
      title: item.title,
      summary: item.summary,
      source: item.source,
      bucket: item.guidelineBucket || "Guidelines",
      link: item.link,
    }));
  const adminItems = [
    ...(library.subtopics || []).map((item) => ({
      title: item.title,
      summary: item.body,
      source: "Subtopic",
      bucket: item.section,
      link: `/?subtopic=${encodeURIComponent(item.id)}`,
    })),
    ...(library.uploads || []).map((item) => ({
      title: item.filename,
      summary: item.note || item.subtopicTitle || "",
      source: "Upload",
      bucket: item.section,
      link: item.path,
    })),
    ...manualArticles.filter((item) => item.tile !== "Latest PCCM Articles" && item.tile !== "Guidelines").map((item) => ({
      title: item.title,
      summary: item.summary,
      source: item.source,
      bucket: item.tile,
      link: item.link,
    })),
  ];

  const buckets = [
    ["Latest PCCM Articles", allArticles.map((item) => ({ title: item.title, summary: item.summary || "", source: item.source, link: item.link }))],
    ["Guidelines", [...manualGuidelines, ...(guidelineStateForSearch.guidelines || []).map((item) => ({ title: item.title, summary: item.topic, source: item.organization, bucket: item.bucket, link: item.link }))]],
    ["Landmark Trials", landmarkTrialSearchItems()],
    ["Admin Subtopics & Uploads", adminItems],
  ].map(([bucket, items]) => ({
    bucket,
    items: query ? items.filter((item) => matchesQuery(item, query)).slice(0, 40) : [],
  }));

  sendJson(response, { query, buckets });
}

function sendFile(response, requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(publicDir, path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, ""));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath);
    const contentTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml; charset=utf-8",
      ".mp4": "video/mp4",
      ".m4v": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".ogv": "video/ogg",
      ".ogg": "video/ogg",
    };

    response.writeHead(200, { "Content-Type": contentTypes[extension] || "application/octet-stream" });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    });
    response.end();
    return;
  }

  if (url.pathname === "/api/articles") {
    try {
      const state = await refreshArticles(url.searchParams.get("refresh") === "1");
      const library = readContentLibrary();
      const manualLatestArticles = (library.articles || []).filter((article) => article.tile === "Latest PCCM Articles");
      sendJson(response, {
        ...state,
        articles: [...manualLatestArticles, ...(state.articles || [])],
      });
    } catch (error) {
      sendJson(response, {
        ...articleState,
        status: `Journal refresh failed: ${error.message}`,
      });
    }
    return;
  }

  if (url.pathname === "/api/guidelines") {
    try {
      const state = await refreshGuidelines(url.searchParams.get("refresh") === "1");
      const library = readContentLibrary();
      const manualGuidelines = (library.articles || [])
        .filter((article) => article.tile === "Guidelines")
        .map((article) => ({
          organization: article.source || "PulmCrit IQ Admin",
          topic: article.subtopicTitle || article.guidelineBucket || "Guideline",
          title: article.title,
          link: article.link || "#",
          date: article.date || "Saved",
          bucket: article.guidelineBucket || withGuidelineBucket({ title: article.title, topic: article.summary || "" }).bucket,
          source: "PulmCrit IQ Admin",
        }));
      sendJson(response, {
        ...state,
        guidelines: [...manualGuidelines, ...(state.guidelines || [])],
      });
    } catch (error) {
      sendJson(response, {
        ...guidelineState,
        status: `Guideline refresh failed: ${error.message}`,
      });
    }
    return;
  }

  if (url.pathname === "/api/trial") {
    const detail = await fetchTrialAbstract({
      name: url.searchParams.get("name") || "Trial",
      description: url.searchParams.get("description") || "",
      bucket: url.searchParams.get("bucket") || "",
    });
    sendJson(response, detail);
    return;
  }

  if (url.pathname === "/api/search") {
    try {
      await handleSearch(url, response);
    } catch (error) {
      sendJson(response, { query: url.searchParams.get("q") || "", buckets: [], error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/upload" && request.method === "POST") {
    if (!hasAdminAccess(request)) {
      response.writeHead(403, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: "Admin key required" }));
      return;
    }
    try {
      await handleUpload(request, response, url.searchParams.get("section") || "general");
    } catch (error) {
      response.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (url.pathname === "/api/admin/content") {
    sendJson(response, readContentLibrary());
    return;
  }

  if (url.pathname === "/api/admin/verify") {
    if (!hasAdminAccess(request)) {
      response.writeHead(403, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: "Admin key required" }));
      return;
    }
    sendJson(response, { ok: true });
    return;
  }

  if (url.pathname === "/api/admin/article" && request.method === "POST") {
    if (!hasAdminAccess(request)) {
      response.writeHead(403, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: "Admin key required" }));
      return;
    }
    try {
      await handleManualArticle(request, response);
    } catch (error) {
      sendJson(response, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/admin/subtopic" && request.method === "POST") {
    if (!hasAdminAccess(request)) {
      response.writeHead(403, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: "Admin key required" }));
      return;
    }
    try {
      await handleSubtopic(request, response);
    } catch (error) {
      sendJson(response, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/admin/settings" && request.method === "POST") {
    if (!hasAdminAccess(request)) {
      response.writeHead(403, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: "Admin key required" }));
      return;
    }
    try {
      await handleAdminSettings(request, response);
    } catch (error) {
      sendJson(response, { ok: false, error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/admin/delete" && request.method === "POST") {
    if (!hasAdminAccess(request)) {
      response.writeHead(403, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      response.end(JSON.stringify({ ok: false, error: "Admin key required" }));
      return;
    }
    try {
      await handleDeleteContent(request, response);
    } catch (error) {
      sendJson(response, { ok: false, error: error.message });
    }
    return;
  }

  sendFile(response, url.pathname);
});

server.listen(PORT, () => {
  console.log(`PulmCrit IQ is running at http://127.0.0.1:${PORT}/`);
});

refreshArticles(true).catch((error) => {
  articleState.status = `Initial journal refresh failed: ${error.message}`;
});

refreshGuidelines(true).catch((error) => {
  guidelineState.status = `Initial guideline refresh failed: ${error.message}`;
});

setInterval(() => {
  refreshArticles(true).catch((error) => {
    articleState.status = `Scheduled journal refresh failed: ${error.message}`;
  });
  refreshGuidelines(true).catch((error) => {
    guidelineState.status = `Scheduled guideline refresh failed: ${error.message}`;
  });
}, REFRESH_INTERVAL_MS);
