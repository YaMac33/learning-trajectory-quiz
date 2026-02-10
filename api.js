// api.js
export async function loadQuestions() {
  const res = await fetch("./questions.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`questions.json fetch failed: ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("questions.json must be an array");
  }

  return data;
}
