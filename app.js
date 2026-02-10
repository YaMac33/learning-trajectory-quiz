/* app.js
 * ユーザーインターフェース制御ロジック
 * - api.js から問題を取得
 * - HTMLテンプレートを使用したレンダリング
 * - 正誤判定とクラス操作による視覚フィードバック
 * - 解説の3段階トグル制御
 */

import { loadQuestions } from "./api.js";

// --- State ---
let QUESTIONS = [];
let currentQuestion = null;
let answeredQuestions = new Set(); // セッション内での重複出題防止用

// --- Utils ---
const $ = (id) => document.getElementById(id);

/**
 * HTML文字列のエスケープ（XSS対策）
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 配列の比較（内容が一致するか）
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  for (let i = 0; i < sortedA.length; i++) {
    if (sortedA[i] !== sortedB[i]) return false;
  }
  return true;
}

/**
 * ランダムに1問選択（まだ出題していないものを優先）
 */
function pickRandomQuestion() {
  if (!QUESTIONS.length) return null;

  // 未出題のプールを作成
  const pool = QUESTIONS.filter((q) => q && q.id && !answeredQuestions.has(q.id));
  
  // 全て出題済みの場合はリセットするか、そのまま全問から選ぶ（今回は全問から再選択）
  const src = pool.length > 0 ? pool : QUESTIONS;
  
  if (pool.length === 0 && QUESTIONS.length > 0) {
    // オプション: 一巡したらリセットする場合
    // answeredQuestions.clear();
  }

  const idx = Math.floor(Math.random() * src.length);
  return src[idx] || null;
}

// --- Rendering ---

/**
 * 結果表示エリアのクリア
 */
function clearResult() {
  const el = $("result");
  el.textContent = "";
  el.className = "result"; // クラスをリセット
}

/**
 * 問題の表示
 */
function renderQuestion(q) {
  currentQuestion = q;

  // テキスト設定
  $("qid").textContent = q.id || "Q-???";
  $("question").textContent = q.question || "問題読み込みエラー";

  // 状態リセット
  clearResult();
  $("submitBtn").disabled = false;
  $("nextBtn").disabled = true; // 次へボタンは回答後に有効化
  
  // 選択肢のレンダリング
  renderChoices(q);
}

/**
 * 選択肢の生成
 */
function renderChoices(q) {
  const container = $("choices");
  container.innerHTML = ""; // クリア

  const template = $("choice-template");
  const choices = Array.isArray(q.choices) ? q.choices : [];

  choices.forEach((c, index) => {
    const clone = template.content.cloneNode(true);
    
    // 要素の取得
    const root = clone.querySelector(".choice");
    const input = clone.querySelector(".choice-input");
    const textSpan = clone.querySelector(".choice-text");
    const overviewEl = clone.querySelector(".choice-overview");
    const toggleBtn = clone.querySelector(".choice-toggle-detail");
    const detailWrap = clone.querySelector(".choice-detail");
    const detailContent = clone.querySelector(".choice-detail-content");
    const linkEl = clone.querySelector(".choice-link");

    // データ設定
    input.dataset.index = index;
    input.name = "current-choice"; // ラジオボタン的な挙動を防ぐためnameはあえて統一しない、またはcheckboxなので自由
    
    textSpan.textContent = c.text || "";
    overviewEl.textContent = c.overview || "";
    detailContent.textContent = c.detail || "";

    // リンクの有無
    if (c.link) {
      linkEl.href = c.link;
    } else {
      linkEl.style.display = "none";
    }

    // 初期状態: overviewは表示、detailは非表示(hidden)
    // 要件に合わせて overviewは常に表示、detailはhidden属性で制御
    // template内ですでに hidden になっている想定だが、念のためJSでも制御ロジックを入れる
    
    // トグルボタンのイベント設定（3段階トグル）
    // 状態1: Overviewのみ表示（初期） -> ボタン「解説を表示」
    // 状態2: Overview + Detail表示   -> ボタン「解説を隠す」
    // 状態3: Overview + Detail非表示（閉じる） -> ボタン「概要を表示」... 
    // ※ 要件定義書には「overview→常に表示」とあるので、detailの開閉のみを行うシンプルなトグルにします
    
    // 【要件再確認】
    // overview -> 常に表示
    // detail -> 初期は非表示、トグルで表示
    
    toggleBtn.textContent = "解説・詳細を見る";
    
    toggleBtn.addEventListener("click", () => {
        const isHidden = detailWrap.hasAttribute("hidden");
        if (isHidden) {
            detailWrap.removeAttribute("hidden");
            toggleBtn.textContent = "解説を閉じる";
        } else {
            detailWrap.setAttribute("hidden", "");
            toggleBtn.textContent = "解説・詳細を見る";
        }
    });

    container.appendChild(clone);
  });
}

// --- Actions ---

/**
 * 回答ボタン押下時
 */
function onSubmit() {
  if (!currentQuestion) return;

  // 選択されたインデックスを取得
  const inputs = document.querySelectorAll("#choices .choice-input");
  const selectedIndices = [];
  inputs.forEach((input) => {
    if (input.checked) {
      selectedIndices.push(parseInt(input.dataset.index, 10));
    }
  });

  if (selectedIndices.length === 0) {
    alert("選択肢を選んでください。");
    return;
  }

  // 正解データを取得
  const correctIndices = currentQuestion.correct_indices || [];

  // 正誤判定
  const isCorrect = arraysEqual(selectedIndices, correctIndices);

  // UI更新（クラス付け替え）
  updateChoiceStyles(selectedIndices, correctIndices);
  showResult(isCorrect);

  // ボタン制御
  $("submitBtn").disabled = true;
  $("nextBtn").disabled = false;
  
  // 履歴に追加
  if (currentQuestion.id) {
    answeredQuestions.add(currentQuestion.id);
  }
}

/**
 * 選択肢に判定クラス（.correct, .wrong, .unselected）を付与
 */
function updateChoiceStyles(selectedIndices, correctIndices) {
  const choiceElements = document.querySelectorAll("#choices .choice");
  
  choiceElements.forEach((el, index) => {
    // リセット
    el.classList.remove("correct", "wrong", "unselected");

    const isSelected = selectedIndices.includes(index);
    const isAnswerCorrect = correctIndices.includes(index);

    if (isAnswerCorrect) {
        // 正解の選択肢
        el.classList.add("correct");
        if (!isSelected) {
            // 正解だが選ばなかった
            el.classList.add("unselected");
        }
    } else if (isSelected) {
        // 不正解を選んでしまった
        el.classList.add("wrong");
    }
    
    // 回答後は入力を無効化
    const input = el.querySelector(".choice-input");
    if(input) input.disabled = true;
  });
}

/**
 * 結果メッセージの表示
 */
function showResult(isCorrect) {
  const resultEl = $("result");
  
  if (isCorrect) {
    resultEl.textContent = "Excellent! 正解です 🎉";
    resultEl.className = "result result-correct";
  } else {
    resultEl.textContent = "Keep trying... 不正解です";
    resultEl.className = "result result-wrong";
  }
}

/**
 * 次の問題へ
 */
function onNext() {
  const nextQ = pickRandomQuestion();
  if (nextQ) {
    renderQuestion(nextQ);
  } else {
    alert("全ての問題を回答しました！リロードして再開します。");
    answeredQuestions.clear();
    onNext();
  }
}

// --- Initialization ---

async function init() {
  try {
    const statusEl = $("status");
    statusEl.textContent = "Loading questions...";
    
    QUESTIONS = await loadQuestions();
    
    statusEl.textContent = ""; // 読み込み完了なら消す
    
    if (QUESTIONS.length === 0) {
      statusEl.textContent = "問題データがありません。";
      return;
    }

    // イベントリスナー
    $("submitBtn").addEventListener("click", onSubmit);
    $("nextBtn").addEventListener("click", onNext);

    // 初回レンダリング
    const firstQ = pickRandomQuestion();
    renderQuestion(firstQ);

  } catch (err) {
    console.error(err);
    $("status").textContent = "エラーが発生しました: " + err.message;
    $("status").style.color = "red";
  }
}

// DOMContentLoadedを待つ
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
