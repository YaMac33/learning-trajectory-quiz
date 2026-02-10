const questionTextEl = document.getElementById("question-text");
const choicesAreaEl = document.getElementById("choices-area");
const resultAreaEl = document.getElementById("result-area");
const nextBtnEl = document.getElementById("next-btn");

let currentQuestion = null;

async function showQuestion() {
  resultAreaEl.classList.add("hidden");
  nextBtnEl.classList.add("hidden");
  choicesAreaEl.innerHTML = "";

  await QuizAPI.loadQuestions();
  currentQuestion = QuizAPI.getRandomQuestion();

  if (!currentQuestion) {
    questionTextEl.textContent = "問題がありません";
    return;
  }

  questionTextEl.textContent = currentQuestion.question;

  currentQuestion.choices.forEach((choice, index) => {
    const div = document.createElement("div");
    div.className = "choice";
    div.textContent = choice.text;

    div.onclick = () => handleAnswer(index, div);
    choicesAreaEl.appendChild(div);
  });
}

function handleAnswer(selectedIndex, selectedEl) {
  const correctSet = new Set(currentQuestion.correct_indices);

  document.querySelectorAll(".choice").forEach((el, idx) => {
    if (correctSet.has(idx)) el.classList.add("correct");
    if (idx === selectedIndex && !correctSet.has(idx)) {
      el.classList.add("wrong");
    }
    el.onclick = null;
  });

  resultAreaEl.textContent = correctSet.has(selectedIndex)
    ? "✅ 正解"
    : "❌ 不正解";

  resultAreaEl.classList.remove("hidden");
  nextBtnEl.classList.remove("hidden");
}

nextBtnEl.onclick = showQuestion;

// 初期表示
showQuestion();
