/* app.js
 * モダンUIに対応した拡張ロジック
 * - HTML構造の変更に伴うセレクタの修正
 * - アコーディオンUIの制御
 * - クラス名によるデザイン制御
 */

import { loadQuestions } from "./api.js";

let QUESTIONS = [];
let current = null;

const viewList = document.getElementById("view-list");
const viewQuiz = document.getElementById("view-quiz");
const listEl = document.getElementById("list");

// --- Utils ---
function $(id) {
  return document.getElementById(id);
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// --- Routing & View Control ---
function showList() {
  viewList.hidden = false;
  viewQuiz.hidden = true;
  history.pushState({}, "", "./");
  // スクロール位置をリセット
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showQuiz(id) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) return;

  current = q;

  viewList.hidden = true;
  viewQuiz.hidden = false;
  history.pushState({}, "", `?id=${encodeURIComponent(id)}`);
  
  window.scrollTo({ top: 0, behavior: 'smooth' });

  renderQuestion(q);
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

// --- Render Logic ---

function renderList() {
  listEl.innerHTML = "";

  QUESTIONS.forEach(q => {
    const div = document.createElement("div");
    div.className = "card";
    // デザインに合わせてボタンのテキストを英語に、アイコン追加なども可能
    div.innerHTML = `
      <div>${q.question}</div>
      <button data-id="${q.id}">Start Quiz</button>
    `;
    div.querySelector("button").onclick = () => showQuiz(q.id);
    listEl.appendChild(div);
  });
}

function renderQuestion(q) {
  $("qid").textContent = q.id;
  $("question").textContent = q.question;
  
  const resultEl = $("result");
  resultEl.textContent = "";
  resultEl.className = "result-box"; // クラスリセット

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  const tpl = $("choice-template");

  q.choices.forEach((c, idx) => {
    const frag = tpl.content.cloneNode(true);
    
    // 要素取得 (新しいHTML構造に合わせてクラス名などで取得)
    const choiceItem = frag.querySelector(".choice-item");
    const input = frag.querySelector(".choice-input");
    const text = frag.querySelector(".choice-text");
    const overview = frag.querySelector(".choice-overview");
    const detailWrap = frag.querySelector(".choice-detail");
    const detailContent = frag.querySelector(".choice-detail-content");
    const linkEl = frag.querySelector(".choice-link");
    const toggleBtn = frag.querySelector(".choice-toggle-detail");
    const toggleText = toggleBtn.querySelector("span");
    const toggleIcon = toggleBtn.querySelector(".icon-chevron");

    input.dataset.index = idx;
    text.textContent = c.text;
    overview.textContent = c.overview;
    detailContent.textContent = c.detail;

    // リンク判定
    if (c.link) {
      linkEl.href = c.link;
    } else {
      linkEl.style.display = "none";
    }

    // 初期状態: overview, detail ともに非表示
    overview.hidden = true;
    detailWrap.hidden = true;
    
    // Feedbackコンテナ自体の表示制御（中身がなければ隠すなどのCSS制御はあるが、初期はボタンだけ見えてる状態にしたい）
    // 今回のUI設計では「解説を表示」ボタンだけが見えていて、クリックでOverview/Detailが開閉する
    
    toggleBtn.onclick = () => {
      // 3段階トグルロジック
      // 1. 初期(全部閉じ) -> Overviewオープン
      // 2. Overviewオープン -> Detailオープン
      // 3. Detailオープン -> 全部閉じ
      
      const isOverviewHidden = overview.hidden;
      const isDetailHidden = detailWrap.hidden;

      if (isOverviewHidden) {
        // Step 1: Show Overview
        overview.hidden = false;
        toggleText.textContent = "詳細を見る";
        if(toggleIcon) toggleIcon.style.transform = "rotate(0deg)";
      } else if (isDetailHidden) {
        // Step 2: Show Detail
        detailWrap.hidden = false;
        toggleText.textContent = "解説を閉じる";
        if(toggleIcon) toggleIcon.style.transform = "rotate(180deg)";
      } else {
        // Step 3: Hide All
        overview.hidden = true;
        detailWrap.hidden = true;
        toggleText.textContent = "解説を表示";
        if(toggleIcon) toggleIcon.style.transform = "rotate(0deg)";
      }
    };

    choicesEl.appendChild(frag);
  });

  // 回答ボタン
  const submitBtn = $("submitBtn");
  submitBtn.disabled = false;
  submitBtn.onclick = () => {
    // 選択取得
    const inputs = Array.from(document.querySelectorAll(".choice-input"));
    const selected = uniqSorted(
      inputs.filter(b => b.checked).map(b => Number(b.dataset.index))
    );

    if (selected.length === 0) return; // 未選択ガード

    const correct = uniqSorted(q.correct_indices);
    const isCorrect = arraysEqual(selected, correct);

    // 結果表示
    resultEl.textContent = isCorrect ? "Excellent! 正解です 🎉" : "Incorrect... 残念 😢";
    resultEl.classList.remove("ok", "ng");
    resultEl.classList.add(isCorrect ? "ok" : "ng");

    // 選択肢ごとのクラス付与
    const choiceItems = document.querySelectorAll(".choice-item");
    choiceItems.forEach((item, index) => {
      const isSel = selected.includes(index);
      const isAns = correct.includes(index);
      const input = item.querySelector(".choice-input");

      item.classList.remove("correct", "wrong", "unselected");

      if (isAns) {
        item.classList.add("correct");
        if (!isSel) item.classList.add("unselected");
      } else if (isSel) {
        item.classList.add("wrong");
      }
      
      // 入力ロック
      input.disabled = true;
      
      // 解説（Overview）を自動オープン
      const ov = item.querySelector(".choice-overview");
      if (ov) ov.hidden = false;
      
      // トグルボタンの状態更新
      const btn = item.querySelector(".choice-toggle-detail");
      const span = btn.querySelector("span");
      if(span) span.textContent = "詳細を見る";
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
