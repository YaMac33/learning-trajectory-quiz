import { loadQuestions } from "./api.js";

function getQueryId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function $(id) {
  return document.getElementById(id);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function renderQuestion(q) {
  $("qid").textContent = q.id;
  $("question").textContent = q.question;

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  q.choices.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "choice";

    div.innerHTML = `
      <label>
        <input type="checkbox" data-index="${idx}" />
        ${c.text}
      </label>
      <div class="explain" hidden>
        <div>${c.overview}</div>
        <div>${c.detail}</div>
      </div>
    `;

    choicesEl.appendChild(div);
  });

  $("submitBtn").onclick = () => {
    const selected = uniqSorted(
      Array.from(document.querySelectorAll("input[type=checkbox]"))
        .filter(b => b.checked)
        .map(b => Number(b.dataset.index))
    );

    const correct = uniqSorted(q.correct_indices);

    const isCorrect = arraysEqual(selected, correct);

    $("result").textContent = isCorrect ? "✅ 正解" : "❌ 不正解";

    // 解説表示
    document.querySelectorAll(".explain").forEach(e => {
      e.removeAttribute("hidden");
    });
  };
}

async function init() {
  const id = getQueryId();
  const questions = await loadQuestions();

  const q = questions.find(x => x.id === id);

  if (!q) {
    $("status").textContent = "問題が見つかりません。";
    return;
  }

  renderQuestion(q);
}

init();
