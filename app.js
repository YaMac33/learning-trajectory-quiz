/* app.js (template-based minimal)
 * - Load questions via api.js
 * - Render 1 question using <template id="choice-template">
 * - Answer check (client-side)
 * - Explanation toggle (overview -> detail)
 *
 * Expected question schema:
 * {
 *   id: "string",
 *   question: "string",
 *   choices: [{ text, overview, detail, link }],
 *   correct_indices: [0,2]   // array of 0-based indices
 * }
 */

import { loadQuestions } from "./api.js";

let QUESTIONS = [];
let current = null;
let excludeIds = new Set(); // anti-repeat (session only)

// ---------- utils ----------
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

function parseCorrectIndices(q) {
  if (Array.isArray(q.correct_indices)) {
    return q.correct_indices
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }
  return [];
}

function pickRandomQuestion() {
  if (!QUESTIONS.length) return null;

  const pool = QUESTIONS.filter((q) => q && q.id && !excludeIds.has(q.id));
  const src = pool.length ? pool : QUESTIONS;

  return src[Math.floor(Math.random() * src.length)] || null;
}

// ---------- render ----------
function clearResult() {
  const el = $("result");
  el.textContent = "";
  el.classList.remove("ok", "ng");
}

function renderQuestion(q) {
  current = q;

  $("qid").textContent = q?.id ?? "";
  $("question").textContent = q?.question ?? "";

  clearResult();
  $("nextBtn").disabled = true;

  renderChoices(q);
}

function renderChoices(q) {
  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  const tpl = $("choice-template");
  const choices = Array.isArray(q?.choices) ? q.choices : [];

  choices.forEach((c, idx) => {
    const frag = tpl.content.cloneNode(true);

    const root = frag.querySelector(".choice");
    const input = frag.querySelector(".choice-input");
    const textEl = frag.querySelector(".choice-text");
    const overviewEl = frag.querySelector(".choice-overview");
    const toggleBtn = frag.querySelector(".choice-toggle-detail");
    const detailWrap = frag.querySelector(".choice-detail");
    const detailContent = frag.querySelector(".choice-detail-content");
    const linkEl = frag.querySelector(".choice-link");

    // dataset (selection)
    input.dataset.choiceIndex = String(idx);

    // text
    textEl.textContent = c?.text ?? "";
    overviewEl.textContent = c?.overview ?? "";
    detailContent.textContent = c?.detail ?? "";

    // link (only if exists)
    const link = String(c?.link ?? "").trim();
    if (link) {
      linkEl.href = link;
      linkEl.style.display = "";
    } else {
      linkEl.removeAttribute("href");
      linkEl.style.display = "none";
    }

    // toggle detail
    toggleBtn.addEventListener("click", () => {
      const hidden = detailWrap.hasAttribute("hidden");
      if (hidden) {
        detailWrap.removeAttribute("hidden");
        toggleBtn.textContent = "解説を隠す";
      } else {
        detailWrap.setAttribute("hidden", "");
        toggleBtn.textContent = "解説を表示";
      }
    });

    // remove any judgement classes (just in case)
    root.classList.remove("correct", "wrong", "unselected");

    choicesEl.appendChild(frag);
  });
}

// ---------- actions ----------
function getSelectedIndices() {
  const boxes = Array.from(
    document.querySelectorAll('.choice-input[data-choice-index]')
  );

  const selected = boxes
    .filter((b) => b.checked)
    .map((b) => Number(b.dataset.choiceIndex))
    .filter((n) => Number.isFinite(n));

  return uniqSorted(selected);
}

function applyJudgementClasses(selected, correct) {
  // .choice の並びは choices と同じ
  const choiceNodes = Array.from(document.querySelectorAll("#choices .choice"));

  choiceNodes.forEach((node, idx) => {
    node.classList.remove("correct", "wrong", "unselected");

    const isSel = selected.includes(idx);
    const isCor = correct.includes(idx);

    // class設計（CSSで見た目を付ける）
    if (isCor) node.classList.add("correct");
    if (isSel && !isCor) node.classList.add("wrong");
    if (!isSel && isCor) node.classList.add("unselected");
  });
}

function showResult(isCorrect, correct, selected) {
  const el = $("result");
  if (isCorrect) {
    el.textContent = "✅ 正解";
    el.classList.remove("ng");
    el.classList.add("ok");
  } else {
    el.textContent = `❌ 不正解（正解: ${correct.join(",")} / 選択: ${selected.join(",")}）`;
    el.classList.remove("ok");
    el.classList.add("ng");
  }
}

function onSubmit() {
  if (!current) return;

  const selected = getSelectedIndices();
  const correct = parseCorrectIndices(current);

  const isCorrect = correct.length ? arraysEqual(selected, correct) : false;

  applyJudgementClasses(selected, correct);
  showResult(isCorrect, correct, selected);

  if (current?.id) excludeIds.add(current.id);
  $("nextBtn").disabled = false;
}

function onNext() {
  const q = pickRandomQuestion();
  if (!q) return;
  renderQuestion(q);
}

// ---------- init ----------
async function init() {
  try {
    $("status").textContent = "Loading...";
    QUESTIONS = await loadQuestions();
    $("status").textContent = "";

    if (!Array.isArray(QUESTIONS) || !QUESTIONS.length) {
      $("status").textContent = "No questions found.";
      return;
    }

    const first = pickRandomQuestion();
    if (first) renderQuestion(first);

    $("submitBtn").addEventListener("click", onSubmit);
    $("nextBtn").addEventListener("click", onNext);
  } catch (err) {
    console.error(err);
    $("status").textContent = "Failed to load questions.";
  }
}

document.addEventListener("DOMContentLoaded", init);
