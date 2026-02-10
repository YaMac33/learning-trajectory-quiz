const QuizAPI = (() => {
  let questions = [];

  async function loadQuestions() {
    if (questions.length) return questions;

    const res = await fetch("./data/questions.json");
    questions = await res.json();
    return questions;
  }

  function getRandomQuestion() {
    if (!questions.length) return null;
    return questions[Math.floor(Math.random() * questions.length)];
  }

  return {
    loadQuestions,
    getRandomQuestion,
  };
})();
