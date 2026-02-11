// app.js
import { loadQuestions } from "./api.js";

// id取得ヘルパ（このファイル内で $("id") を使っている前提）
const $ = (id) => document.getElementById(id);

let QUESTIONS = [];
let CURRENT_ID = null;

// --- Views ---
function showList() {
  $("view-list").hidden = false;
  $("view-quiz").hidden = true;
  $("backBtn").hidden = true;
}

function showQuiz() {
  $("view-list").hidden = true;
  $("view-quiz").hidden = false;
  $("backBtn").hidden = false;
}

// --- Routing ---
function setRoute(path) {
  history.pushState({}, "", path);
  handleRouting();
}

function handleRouting() {
  const path = location.pathname;
  const isQuiz = path.endsWith("/quiz");

  if (!isQuiz) {
    showList();
    return;
  }

  // quiz route
  const url = new URL(location.href);
  const id = url.searchParams.get("id");
  if (!id) {
    showList();
    return;
  }

  CURRENT_ID = id;
  showQuiz();

  const q = QUESTIONS.find((x) => x.id === CURRENT_ID);
  if (q) renderQuestion(q);
}

// --- List ---
function renderList() {
  const listEl = $("quizList");
  listEl.innerHTML = "";

  QUESTIONS.forEach((q, idx) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "quiz-card";

    const title = document.createElement("div");
    title.className = "quiz-card-title";
    title.textContent = `${idx + 1}. ${q.question}`;

    const meta = document.createElement("div");
    meta.className = "quiz-card-meta";
    meta.textContent = `ID: ${q.id}`;

    card.appendChild(title);
    card.appendChild(meta);

    card.onclick = () => {
      setRoute(`/learning-trajectory-quiz/quiz?id=${encodeURIComponent(q.id)}`);
    };

    listEl.appendChild(card);
  });
}

// --- Quiz ---
function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function renderQuestion(q) {
  $("qid").textContent = q.id;
  $("question").textContent = q.question;

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  // 前へ / 次へ ナビゲーション
  const currentIndex = QUESTIONS.findIndex((x) => x.id === q.id);
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  if (prevBtn) {
    prevBtn.disabled = currentIndex <= 0;
    prevBtn.onclick = () => {
      if (currentIndex <= 0) return;
      const prev = QUESTIONS[currentIndex - 1];
      setRoute(`/learning-trajectory-quiz/quiz?id=${encodeURIComponent(prev.id)}`);
    };
  }
  if (nextBtn) {
    nextBtn.disabled = currentIndex >= QUESTIONS.length - 1;
    nextBtn.onclick = () => {
      if (currentIndex >= QUESTIONS.length - 1) return;
      const next = QUESTIONS[currentIndex + 1];
      setRoute(`/learning-trajectory-quiz/quiz?id=${encodeURIComponent(next.id)}`);
    };
  }

  // 初期化
  const submitBtn = $("submitBtn");
  submitBtn.disabled = false;
  $("result").textContent = "";

  const tpl = $("choice-template");

  let answered = false;

  q.choices.forEach((choice, i) => {
    const node = tpl.content.cloneNode(true);

    const root = node.querySelector(".choice");
    const input = node.querySelector(".choice-input");
    const text = node.querySelector(".choice-text");
    const overview = node.querySelector(".choice-overview");
    const toggleBtn = node.querySelector(".choice-toggle-detail");
    const toggleText = toggleBtn.querySelector("span");
    const toggleIcon = toggleBtn.querySelector("svg");
    const detailWrap = node.querySelector(".choice-detail");
    const detailContent = node.querySelector(".choice-detail-content");
    const link = node.querySelector(".choice-link");

    input.dataset.index = String(i);
    text.textContent = choice.text;

    overview.textContent = choice.overview ?? "";
    detailContent.textContent = choice.detail ?? "";

    // link
    const href = (choice.link ?? "").trim();
    if (href) {
      link.href = href;
      link.hidden = false;
    } else {
      link.href = "";
      link.hidden = true;
    }

    // 初期状態: overview, detail ともに非表示（回答後に開ける）
    overview.hidden = true;
    detailWrap.hidden = true;
    toggleBtn.disabled = true;
    if (toggleText) toggleText.textContent = "解説（回答後）";

    // 解説トグル: 1回で overview + detail をまとめて開閉
    toggleBtn.onclick = () => {
      if (!answered) return;

      const opening = overview.hidden && detailWrap.hidden;

      overview.hidden = !opening;
      detailWrap.hidden = !opening;

      if (toggleText) toggleText.textContent = opening ? "解説を隠す" : "解説を表示";
      toggleBtn.classList.toggle("active", opening);
      if (toggleIcon) toggleIcon.style.transform = opening ? "rotate(180deg)" : "rotate(0deg)";
    };

    choicesEl.appendChild(node);
  });

  submitBtn.onclick = () => {
    // 選択取得
    const selected = uniqSorted(
      Array.from(document.querySelectorAll(".choice-input"))
        .filter((x) => x.checked)
        .map((x) => Number(x.dataset.index))
    );

    const correct = uniqSorted(q.correct_indices);
    const isCorrect = arraysEqual(selected, correct);

    answered = true;

    // 結果表示
    const resultEl = $("result");
    resultEl.textContent = isCorrect ? "✅ 正解" : "❌ 不正解";

    // UIフィードバック
    document.querySelectorAll(".choice").forEach((item, idx) => {
      const input = item.querySelector(".choice-input");

      // 色分け
      const isSel = selected.includes(idx);
      const isAns = correct.includes(idx);

      item.classList.remove("is-correct", "is-wrong", "is-missed");

      if (isAns && isSel) item.classList.add("is-correct");
      if (!isAns && isSel) item.classList.add("is-wrong");
      if (isAns && !isSel) item.classList.add("is-missed");

      // 入力ロック
      input.disabled = true;

      // 解説はトグルで一括オープン（Overview + Detail）
      const ov = item.querySelector(".choice-overview");
      const dt = item.querySelector(".choice-detail");
      if (ov) ov.hidden = true;
      if (dt) dt.hidden = true;

      const btn = item.querySelector(".choice-toggle-detail");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("active");
        const span = btn.querySelector("span");
        if (span) span.textContent = "解説を表示";
        const icon = btn.querySelector("svg");
        if (icon) icon.style.transform = "rotate(0deg)";
      }
    });

    submitBtn.disabled = true;
  };
}

// --- Init ---
async function init() {
  const statusEl = $("status");
  statusEl.textContent = "Loading...";

  try {
    QUESTIONS = await loadQuestions();
    statusEl.textContent = ""; // Clear loading

    renderList();
    handleRouting();

    $("backBtn").onclick = showList;
    window.onpopstate = handleRouting;

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Failed to load data.";
    statusEl.style.color = "red";
  }
}

init();
