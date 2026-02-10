/* api.js
 * データフェッチレイヤー
 * - questions.json の取得を担当
 * - エラーハンドリングとデータ検証
 */

export async function loadQuestions() {
  try {
    // キャッシュを回避して最新の問題を取得
    const response = await fetch('./questions.json', {
      cache: 'no-cache',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Invalid Data Format: Root must be an array.');
    }

    return data;
  } catch (error) {
    console.error("Failed to load questions:", error);
    throw error; // 呼び出し元でハンドリングさせる
  }
}
