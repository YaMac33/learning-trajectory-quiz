// api.js
export async function loadQuestions() {
  // この api.js 自体の場所を基準に questions.json を解決する（最も安全）
  const url = new URL("./questions.json", import.meta.url);

  const res = await fetch(url.toString(), {
    cache: "no-cache",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    // デバッグしやすいようにメッセージを濃くする
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch questions.json: ${res.status} ${res.statusText}\n${text.slice(0, 200)}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("Invalid questions.json: root is not an array");
  }

  return data;
}
