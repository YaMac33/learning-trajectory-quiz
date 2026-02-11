import { loadQuestions } from "./api.js";

const listEl = document.getElementById("list");

function createCard(q) {
  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <div class="card-question">${q.question}</div>
    <div class="card-actions">
      <a href="./quiz.html?id=${encodeURIComponent(q.id)}">
        <button>この問題を解く</button>
      </a>
    </div>
  `;

  return div;
}

async function init() {
  const questions = await loadQuestions();

  if (!Array.isArray(questions) || !questions.length) {
    listEl.textContent = "問題がありません。";
    return;
  }

  questions.forEach(q => {
    listEl.appendChild(createCard(q));
  });
}

init();
