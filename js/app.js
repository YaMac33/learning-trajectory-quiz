/* app.js (minimal)
 * - Load questions via api.js
 * - Render 1 question
 * - Answer check (client-side)
 * - Explanation toggle (overview -> detail)
 *
 * Expected question schema:
 * {
 *   id: "string",
 *   question: "string",
 *   choices: [{ text, overview, detail, link }],
 *   correct_indices: [0,2],   // array of 0-based indices (recommended)
 *   // OR correct_indices_csv: "0,2"  // supported as fallback
 * }
 */

import { loadQuestions } from "./api.js";

let QUESTIONS = [];
let current = null;
let excludeIds = new Set(); // simple anti-repeat (session only)

// ---------- utils ----------
function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCorrectIndices(q) {
  // Prefer array
  if (Array.isArray(q.correct_indices)) {
    return q.correct_indices
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
  }

  // Fallback: CSV string
  const csv = String(q.correct_indices_csv ?? "").trim();
  if (!csv) return [];
  return csv
    .split(",")
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function pickRandomQuestion() {
  if (!QUESTIONS.length) return null;

  // avoid repeats until we run out
  const pool = QUESTIONS.filter((q) => !excludeIds.has(q.id));
  const src = pool.length ? pool : QUESTIONS;

  const q = src[Math.floor(Math.random() * src.length)];
  return q || null;
}

// ---------- render ----------
function renderQuestion(q) {
  current = q;

  $("qid").textContent = q.id ?? "";
  $("question").textContent = q.question ?? "";

  // clear feedback
  $("result").textContent = "";
  $("result").className = "";
  $("nextBtn").disabled = true;

  renderChoices(q);
}

function renderChoices(q) {
  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  (q.choices || []).forEach((c, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "choice";

    wrapper.innerHTML = `
      <label style="display:flex; gap:10px; align-items:flex-start;">
        <input type="checkbox" data-choice-index="${idx}" />
        <div style="flex:1;">
          <div class="choice-text">${escapeHtml(c.text)}</div>

          <div class="choice-explain">
            <div class="overview">${escapeHtml(c.overview || "")}</div>
            <div class="detail" hidden>${escapeHtml(c.detail || "")}</div>

            <div class="explain-actions">
              <button type="button" class="toggle-detail">詳細を表示</button>
              ${
                c.link
                  ? `<a class="link" href="${escapeHtml(
                      c.link
                    )}" target="_blank" rel="noopener">参考</a>`
                  : ""
              }
            </div>
          </div>
        </div>
      </label>
    `;

    // Toggle detail
    const btn = wrapper.querySelector(".toggle-detail");
    const detailEl = wrapper.querySelector(".detail");
    btn.addEventListener("click", () => {
      const isHidden = detailEl.hasAttribute("hidden");
      if (isHidden) {
        detailEl.removeAttribute("hidden");
        btn.textContent = "詳細を隠す";
      } else {
        detailEl.setAttribute("hidden", "");
        btn.textContent = "詳細を表示";
      }
    });

    choicesEl.appendChild(wrapper);
  });
}

// ---------- actions ----------
function getSelectedIndices() {
  const boxes = Array.from(document.querySelectorAll('input[type="checkbox"][data-choice-index]'));
  const selected = boxes
    .filter((b) => b.checked)
    .map((b) => Number(b.dataset.choiceIndex))
    .filter((n) => Number.isFinite(n));
  return uniqSorted(selected);
}

function showResult(isCorrect, correctIndices, selectedIndices) {
  const el = $("result");
  if (isCorrect) {
    el.textContent = "✅ 正解";
    el.className = "ok";
  } else {
    el.textContent = `❌ 不正解（正解: ${correctIndices.join(",")} / 選択: ${selectedIndices.join(",")}）`;
    el.className = "ng";
  }
}

function onSubmit() {
  if (!current) return;

  const selected = getSelectedIndices();
  const correct = parseCorrectIndices(current);

  // If no correct info, still allow
  const isCorrect = correct.length ? arraysEqual(selected, correct) : false;

  showResult(isCorrect, correct, selected);

  excludeIds.add(current.id);
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
