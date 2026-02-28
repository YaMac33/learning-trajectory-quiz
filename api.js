const BASE_PATH = "/learning-trajectory-quiz";

export async function loadQuestions() {
  const url = `${BASE_PATH}/questions.json`;

  const response = await fetch(url, {
    cache: "no-cache",
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid JSON structure.");
  }

  return data;
}
