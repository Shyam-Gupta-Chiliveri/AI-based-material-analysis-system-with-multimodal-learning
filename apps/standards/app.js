const COPY = {
  en: {
    eyebrow: "Materials laboratory",
    name: "Standards desk",
    themeLight: "Light",
    themeDark: "Dark",
    themeLabel: "Appearance",
    langLabel: "Language",
    kicker: "ISO / DIN · metallography · hardness",
    title: "Ask the laboratory standards",
    lede: "Questions about ISO and DIN standards, metallographic preparation, hardness testing, and material properties. The answer is drawn from the textbook pages in this desk.",
    question: "Your question",
    placeholder: "What is the Vickers hardness test procedure?",
    sources: "Sources",
    search: "Search",
    samples: "Sample questions",
    samplesLabel: "Sample questions",
    note: "Laboratory note",
    answer: "Answer",
    sourcesHead: "Sources",
    time: "Response time",
    used: "Sources used",
    length: "Answer length",
    foot: "Local FAISS index · LangChain · Groq. The textbook pages stay on this desk. This is a study aid, not a controlled copy of the standard.",
    page: "p.",
    kindThesis: "Thesis",
    kindPaper: "Paper",
    empty: "Please enter a question.",
    searching: "Searching the standards…",
    failed: "The search did not complete.",
    offline: "The desk could not be reached. Try the question again.",
    nokey: "The answering key is not set on this desk yet.",
    loading: "The knowledge base is still loading.",
    docTitle: "Standards desk",
  },
  de: {
    eyebrow: "Werkstofflabor",
    name: "Normenauskunft",
    themeLight: "Hell",
    themeDark: "Dunkel",
    themeLabel: "Darstellung",
    langLabel: "Sprache",
    kicker: "ISO / DIN · Metallographie · Härte",
    title: "Fragen an die Laboratoriumsnormen",
    lede: "Fragen zu ISO- und DIN-Normen, zur metallographischen Präparation, zur Härteprüfung und zu Werkstoffeigenschaften. Die Antwort kommt aus den Lehrbuchseiten auf diesem Pult.",
    question: "Ihre Frage",
    placeholder: "Wie läuft die Härteprüfung nach Vickers?",
    sources: "Quellen",
    search: "Suchen",
    samples: "Beispielfragen",
    samplesLabel: "Beispielfragen",
    note: "Labornotiz",
    answer: "Antwort",
    sourcesHead: "Quellen",
    time: "Antwortzeit",
    used: "Verwendete Quellen",
    length: "Antwortlänge",
    foot: "Lokaler FAISS-Index · LangChain · Groq. Die Lehrbuchseiten bleiben auf diesem Pult. Dies ist eine Lernhilfe, keine kontrollierte Fassung der Norm.",
    page: "S.",
    kindThesis: "Arbeit",
    kindPaper: "Beitrag",
    empty: "Bitte eine Frage eingeben.",
    searching: "Die Normen werden durchsucht…",
    failed: "Die Suche wurde nicht abgeschlossen.",
    offline: "Das Pult ist nicht erreichbar. Bitte die Frage erneut stellen.",
    nokey: "Der Antwortschlüssel ist auf diesem Pult noch nicht gesetzt.",
    loading: "Die Wissensbasis wird noch geladen.",
    docTitle: "Normenauskunft",
  },
};

const SAMPLES = {
  en: [
    "What are differences between Brinell and Vickers hardness testing?",
    "How is grain size measured according to ISO 643?",
    "What are mechanical properties of EN-AC44300 aluminum alloy?",
    "What is austenitic grain size?",
    "Explain SEM imaging techniques",
  ],
  de: [
    "Worin unterscheiden sich die Härteprüfung nach Brinell und nach Vickers?",
    "Wie wird die Korngröße nach ISO 643 gemessen?",
    "Welche mechanischen Eigenschaften hat die Aluminiumlegierung EN-AC44300?",
    "Was ist die austenitische Korngröße?",
    "Erläutern Sie die bildgebenden Verfahren am REM.",
  ],
};

let LANG = localStorage.getItem("standards-lang") === "de" ? "de" : "en";
let statusKey = "";
let lastSources = [];

const question = document.getElementById("question");
const form = document.getElementById("ask");
const search = document.getElementById("search");
const topK = document.getElementById("top-k");
const topKValue = document.getElementById("top-k-value");
const status = document.getElementById("status");
const result = document.getElementById("result");
const answer = document.getElementById("answer");
const sources = document.getElementById("sources");

function t(key) {
  return COPY[LANG][key];
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("standards-theme", theme);
  document.getElementById("theme-light").setAttribute("aria-pressed", theme !== "dark" ? "true" : "false");
  document.getElementById("theme-dark").setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

function sampleIndex(value) {
  const en = SAMPLES.en.indexOf(value);
  if (en >= 0) return en;
  return SAMPLES.de.indexOf(value);
}

function renderSamples() {
  const kept = result.hidden ? sampleIndex(question.value) : -1;
  document.getElementById("samples").innerHTML = SAMPLES[LANG].map((text, index) => (
    `<button type="button" class="sample" data-index="${index}"><span class="sample-no">${String(index + 1).padStart(2, "0")}</span><span>${escapeText(text)}</span></button>`
  )).join("");
  if (kept >= 0) question.value = SAMPLES[LANG][kept];
}

function applyLang() {
  document.documentElement.lang = LANG;
  localStorage.setItem("standards-lang", LANG);
  document.title = t("docTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  document.querySelectorAll("[data-lang]").forEach((button) => {
    const on = button.dataset.lang === LANG;
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  renderSamples();
  if (statusKey) showStatus(statusKey);
  if (lastSources.length) renderSources(lastSources);
}

function showStatus(key) {
  statusKey = key || "";
  status.hidden = !statusKey;
  status.textContent = statusKey ? t(statusKey) : "";
}

function escapeText(text) {
  return text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function renderAnswer(text) {
  const html = escapeText(text)
    .replace(/^#{1,3}\s+(.+)$/gm, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return html.split(/\n{2,}/).map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`).join("");
}

function classify(name) {
  const din = name.match(/DIN(?:[_\s.-]*EN)?(?:[_\s.-]*ISO)?[_\s.-]*(\d{3,5})/i);
  if (din) {
    const parts = ["DIN"];
    if (/EN/i.test(din[0])) parts.push("EN");
    if (/ISO/i.test(din[0])) parts.push("ISO");
    return { kind: "din", code: `${parts.join(" ")} ${din[1]}` };
  }
  const iso = name.match(/ISO[_\s.-]*(\d{3,5})/i);
  if (iso) return { kind: "iso", code: `ISO ${iso[1]}` };
  const readable = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/thesis|master|abschluss/i.test(name)) return { kind: "thesis", code: readable };
  return { kind: "paper", code: readable };
}

function renderSources(items) {
  sources.innerHTML = items.map((item) => {
    const pageMatch = String(item).match(/\(Page (\d+)\)/);
    const file = String(item).replace(/\s*\(Page \d+\)/, "");
    const cite = classify(file);
    const kindLabel = { iso: "ISO", din: "DIN", thesis: t("kindThesis"), paper: t("kindPaper") }[cite.kind];
    const page = pageMatch ? `${t("page")} ${pageMatch[1]}` : "";
    return `<li class="cite"><span class="cite-kind ${cite.kind}">${escapeText(kindLabel)}</span><span class="cite-code">${escapeText(cite.code)}</span><span class="cite-page">${escapeText(page)}</span><span class="cite-file">${escapeText(file)}</span></li>`;
  }).join("");
}

setTheme(localStorage.getItem("standards-theme") === "dark" ? "dark" : "light");
applyLang();

document.getElementById("theme-light").addEventListener("click", () => setTheme("light"));
document.getElementById("theme-dark").addEventListener("click", () => setTheme("dark"));
document.querySelectorAll("[data-lang]").forEach((button) => {
  button.addEventListener("click", () => {
    LANG = button.dataset.lang === "de" ? "de" : "en";
    applyLang();
  });
});

document.getElementById("samples").addEventListener("click", (event) => {
  const button = event.target.closest(".sample");
  if (!button) return;
  question.value = SAMPLES[LANG][Number(button.dataset.index)];
  question.focus();
});

topK.addEventListener("input", () => {
  topKValue.textContent = topK.value;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = question.value.trim();
  if (!text) {
    showStatus("empty");
    return;
  }
  search.disabled = true;
  result.hidden = true;
  showStatus("searching");
  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, top_k: Number(topK.value) }),
    });
    const data = await response.json();
    if (!response.ok) {
      showStatus("failed");
      return;
    }
    showStatus("");
    document.getElementById("asked").textContent = text;
    answer.innerHTML = renderAnswer(data.answer || "");
    lastSources = data.sources || [];
    renderSources(lastSources);
    document.getElementById("seconds").textContent = `${data.seconds}s`;
    document.getElementById("count").textContent = String(lastSources.length);
    document.getElementById("words").textContent = String(data.words);
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showStatus("offline");
  } finally {
    search.disabled = false;
  }
});

fetch("/health").then((response) => response.json()).then((data) => {
  if (!data.key) showStatus("nokey");
  else if (!data.index) showStatus("loading");
}).catch(() => {});
