const SAMPLES = [
  "What are differences between Brinell and Vickers hardness testing?",
  "How is grain size measured according to ISO 643?",
  "What are mechanical properties of EN-AC44300 aluminum alloy?",
  "What is austenitic grain size?",
  "Explain SEM imaging techniques",
];

const question = document.getElementById("question");
const form = document.getElementById("ask");
const search = document.getElementById("search");
const topK = document.getElementById("top-k");
const topKValue = document.getElementById("top-k-value");
const status = document.getElementById("status");
const result = document.getElementById("result");
const answer = document.getElementById("answer");
const sources = document.getElementById("sources");

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("standards-theme", theme);
  document.getElementById("theme-light").classList.toggle("is-on", theme !== "dark");
  document.getElementById("theme-dark").classList.toggle("is-on", theme === "dark");
  document.getElementById("theme-light").setAttribute("aria-pressed", theme !== "dark");
  document.getElementById("theme-dark").setAttribute("aria-pressed", theme === "dark");
}

setTheme(localStorage.getItem("standards-theme") === "dark" ? "dark" : "light");
document.getElementById("theme-light").addEventListener("click", () => setTheme("light"));
document.getElementById("theme-dark").addEventListener("click", () => setTheme("dark"));

document.getElementById("samples").innerHTML = SAMPLES.map(
  (text) => `<button type="button" class="sample">${text}</button>`
).join("");
document.getElementById("samples").addEventListener("click", (event) => {
  const button = event.target.closest(".sample");
  if (!button) return;
  question.value = button.textContent;
  question.focus();
});

topK.addEventListener("input", () => {
  topKValue.textContent = topK.value;
});

function showStatus(text) {
  status.hidden = !text;
  status.textContent = text || "";
}

function escapeText(text) {
  return text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
}

function renderAnswer(text) {
  const html = escapeText(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return html.split(/\n{2,}/).map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`).join("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = question.value.trim();
  if (!text) {
    showStatus("Please enter a question.");
    return;
  }
  search.disabled = true;
  result.hidden = true;
  showStatus("Searching the standards…");
  try {
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, top_k: Number(topK.value) }),
    });
    const data = await response.json();
    if (!response.ok) {
      showStatus(data.error || "The search did not complete.");
      return;
    }
    showStatus("");
    answer.innerHTML = renderAnswer(data.answer || "");
    sources.innerHTML = (data.sources || []).map((item) => `<li>${escapeText(item)}</li>`).join("");
    document.getElementById("seconds").textContent = `${data.seconds}s`;
    document.getElementById("count").textContent = String((data.sources || []).length);
    document.getElementById("words").textContent = String(data.words);
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showStatus("The desk could not be reached. Try the question again.");
  } finally {
    search.disabled = false;
  }
});

fetch("/health").then((response) => response.json()).then((data) => {
  if (!data.key) showStatus("The answering key is not set on this desk yet.");
  else if (!data.index) showStatus(data.error || "The knowledge base is still loading.");
}).catch(() => {});
