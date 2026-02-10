/* api.js (minimal)
 * - Fetch questions.json from GitHub Pages
 *
 * Expected:
 * /data/questions.json  (same origin)
 * [
 *   {
 *     "id": "xxx",
 *     "question": "...",
 *     "choices": [{ "text": "...", "overview": "...", "detail": "...", "link": "" }],
 *     "correct_indices": [1]
 *   }
 * ]
 */

const QUESTIONS_URL = "./data/questions.json";

export async function loadQuestions() {
  const res = await fetch(QUESTIONS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch questions.json: ${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("questions.json must be an array");

  // 最低限の整形（壊れてる1件があっても全滅しないようにする）
  return data
    .map((q) => ({
      id: String(q?.id ?? "").trim(),
      question: String(q?.question ?? "").trim(),
      choices: Array.isArray(q?.choices) ? q.choices : [],
      correct_indices: Array.isArray(q?.correct_indices) ? q.correct_indices : undefined,
      correct_indices_csv: typeof q?.correct_indices_csv === "string" ? q.correct_indices_csv : undefined,
    }))
    .filter((q) => q.id && q.question && Array.isArray(q.choices) && q.choices.length >= 4);
}
