import { loadQuestions } from "./api.js";

let QUESTIONS = [];
let current = null;

const viewList = document.getElementById("view-list");
const viewQuiz = document.getElementById("view-quiz");
const listEl = document.getElementById("list");

function $(id) {
  return document.getElementById(id);
}

function showList() {
  viewList.hidden = false;
  viewQuiz.hidden = true;
  history.pushState({}, "", "./");
}

function showQuiz(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) return;

  current = q;

  viewList.hidden = true;
  viewQuiz.hidden = false;
  history.pushState({}, "", `?id=${encodeURIComponent(id)}`);

  renderQuestion(q);
}

function renderList() {
  listEl.innerHTML = "";

  QUESTIONS.forEach(q => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <div>${q.question}</div>
      <button data-id="${q.id}">解く</button>
    `;
    div.querySelector("button").onclick = () => showQuiz(q.id);
    listEl.appendChild(div);
  });
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function renderQuestion(q) {
  $("qid").textContent = q.id;
  $("question").textContent = q.question;
  $("result").textContent = "";

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  const tpl = $("choice-template");

  q.choices.forEach((c, idx) => {
    const frag = tpl.content.cloneNode(true);

    const input = frag.querySelector(".choice-input");
    const text = frag.querySelector(".choice-text");
    const overview = frag.querySelector(".choice-overview");
    const detailWrap = frag.querySelector(".choice-detail");
    const detailContent = frag.querySelector(".choice-detail-content");
    const linkEl = frag.querySelector(".choice-link");
    const toggle = frag.querySelector(".choice-toggle-detail");

    input.dataset.index = idx;
    text.textContent = c.text;
    overview.textContent = c.overview;
    detailContent.textContent = c.detail;

    if (c.link) {
      linkEl.href = c.link;
    } else {
      linkEl.style.display = "none";
    }

    // 初期状態
    overview.hidden = true;
    detailWrap.hidden = true;

    toggle.onclick = () => {
      if (overview.hidden) {
        overview.hidden = false;
        toggle.textContent = "詳細を表示";
        return;
      }
      if (detailWrap.hidden) {
        detailWrap.hidden = false;
        toggle.textContent = "解説を隠す";
        return;
      }
      overview.hidden = true;
      detailWrap.hidden = true;
      toggle.textContent = "解説を表示";
    };

    choicesEl.appendChild(frag);
  });

  $("submitBtn").onclick = () => {
    const selected = uniqSorted(
      Array.from(document.querySelectorAll(".choice-input"))
        .filter(b => b.checked)
        .map(b => Number(b.dataset.index))
    );

    const correct = uniqSorted(q.correct_indices);

    const isCorrect = arraysEqual(selected, correct);

    $("result").textContent = isCorrect ? "✅ 正解" : "❌ 不正解";

    document.querySelectorAll(".choice-overview").forEach(e => e.hidden = false);
  };
}

function handleRouting() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (id) {
    showQuiz(id);
  } else {
    showList();
  }
}

async function init() {
  $("status").textContent = "Loading...";
  QUESTIONS = await loadQuestions();
  $("status").textContent = "";

  renderList();
  handleRouting();

  $("backBtn").onclick = showList;

  window.onpopstate = handleRouting;
}

init();
