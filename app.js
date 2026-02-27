// app.js
import { loadQuestions } from "./api.js";

// id取得ヘルパ
const $ = (id) => document.getElementById(id);

let QUESTIONS = [];
let CURRENT_ID = null;

// GitHub Pages 配下のベースパス
const BASE_PATH = "/learning-trajectory-quiz/";

// localStorage key（あなたの以前の方針に合わせる）
const LOG_KEY = "ltQuizLogs";

/**
 * logs: Array<{
 *   t: number,              // epoch ms
 *   id: string,
 *   category: string,
 *   selected: number[],
 *   correct: number[],
 *   isCorrect: boolean
 * }>
 */
function loadLogs() {
  try {
    const s = localStorage.getItem(LOG_KEY);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveLogs(logs) {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}
function addLog(entry) {
  const logs = loadLogs();
  logs.push(entry);
  // 無限に増えすぎないように上限（必要なら調整）
  const MAX = 3000;
  if (logs.length > MAX) logs.splice(0, logs.length - MAX);
  saveLogs(logs);
}
function fmtDateTime(ms) {
  const d = new Date(ms);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}/${mm}/${dd} ${hh}:${mi}`;
}

// --- Views ---
function showList() {
  $("view-list").hidden = false;
  $("view-quiz").hidden = true;
  $("backBtn").hidden = true;
}

function showQuiz() {
  $("view-list").hidden = true;
  $("view-quiz").hidden = false;
  $("backBtn").hidden = false;
}

// --- Routing ---
function setRoute(path) {
  history.pushState({}, "", path);
  handleRouting();
}

function handleRouting() {
  const path = location.pathname;
  const isQuiz = path.endsWith("/quiz");

  if (!isQuiz) {
    showList();
    return;
  }

  const url = new URL(location.href);
  const id = url.searchParams.get("id");
  if (!id) {
    showList();
    return;
  }

  CURRENT_ID = id;
  showQuiz();

  const q = QUESTIONS.find((x) => x.id === CURRENT_ID);
  if (q) renderQuestion(q);
}

// --- Category helpers ---
function normalizeCategoryValue(v) {
  const s = String(v ?? "").trim();
  return s ? s : "未分類 / 未分類";
}
function splitCategory(cat) {
  const s = normalizeCategoryValue(cat);
  const parts = s.split("/").map((x) => x.trim()).filter(Boolean);
  const parent = parts[0] || "未分類";
  const sub = parts[1] || "未分類";
  return { parent, sub, full: `${parent} / ${sub}` };
}
function qCategoryFull(q) {
  // questions.json 側が "テクノロジ系 / データベース" の文字列想定
  const { full } = splitCategory(q.category);
  return full;
}
function qCategoryParent(q) {
  return splitCategory(q.category).parent;
}
function qCategorySub(q) {
  return splitCategory(q.category).sub;
}

function getParents(questions) {
  const set = new Set(questions.map(qCategoryParent));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}
function getSubsForParent(questions, parent) {
  const set = new Set(
    questions.filter((q) => qCategoryParent(q) === parent).map(qCategorySub)
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

function groupByParentSub(questions) {
  // Map<parent, Map<sub, question[]>>
  const top = new Map();
  for (const q of questions) {
    const { parent, sub } = splitCategory(q.category);
    if (!top.has(parent)) top.set(parent, new Map());
    const subMap = top.get(parent);
    if (!subMap.has(sub)) subMap.set(sub, []);
    subMap.get(sub).push(q);
  }
  // sort inside each sub by id for stability
  for (const subMap of top.values()) {
    for (const arr of subMap.values()) {
      arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
  }
  return top;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

// --- Status from logs ---
function latestResultById(logs) {
  // Map<id, {t,isCorrect,category}>
  const map = new Map();
  for (const e of logs) {
    if (!e || !e.id) continue;
    const prev = map.get(e.id);
    if (!prev || Number(e.t) > Number(prev.t)) {
      map.set(e.id, { t: Number(e.t) || 0, isCorrect: !!e.isCorrect, category: String(e.category || "") });
    }
  }
  return map;
}

function buildDashboard(logs) {
  const latest = latestResultById(logs);

  const total = QUESTIONS.length;
  const answered = latest.size;

  // latest accuracy (per question latest)
  let latestCorrect = 0;
  for (const v of latest.values()) if (v.isCorrect) latestCorrect++;
  const latestAcc = answered ? (latestCorrect / answered) : 0;

  // all accuracy (per attempt)
  const allAnswered = logs.length;
  const allCorrect = logs.filter((x) => x && x.isCorrect).length;
  const allAcc = allAnswered ? (allCorrect / allAnswered) : 0;

  $("dashTotal").textContent = String(total);
  $("dashAnswered").textContent = String(answered);
  $("dashAccuracyLatest").textContent = answered ? `${Math.round(latestAcc * 100)}%` : "-";
  $("dashAccuracyAll").textContent = allAnswered ? `${Math.round(allAcc * 100)}%` : "-";

  // category table (latest)
  const catAgg = new Map(); // full -> {answered, correct}
  for (const q of QUESTIONS) {
    const full = qCategoryFull(q);
    if (!catAgg.has(full)) catAgg.set(full, { answered: 0, correct: 0 });
    const r = latest.get(q.id);
    if (r) {
      const a = catAgg.get(full);
      a.answered++;
      if (r.isCorrect) a.correct++;
    }
  }

  const catRows = Array.from(catAgg.entries())
    .filter(([, v]) => v.answered > 0)
    .map(([k, v]) => ({
      cat: k,
      answered: v.answered,
      correct: v.correct,
      rate: v.answered ? (v.correct / v.answered) : 0
    }))
    .sort((a, b) => b.rate - a.rate);

  const tbody = $("dashCatTable").querySelector("tbody");
  tbody.innerHTML = "";
  if (catRows.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="muted">まだ回答がありません</td>`;
    tbody.appendChild(tr);
  } else {
    for (const r of catRows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.cat)}</td>
        <td>${r.answered}</td>
        <td>${r.correct}</td>
        <td>${Math.round(r.rate * 100)}%</td>
      `;
      tbody.appendChild(tr);
    }
  }

  // recent table
  const recent = [...logs].slice(-10).reverse();
  const rbody = $("dashRecentTable").querySelector("tbody");
  rbody.innerHTML = "";
  if (recent.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" class="muted">まだ回答がありません</td>`;
    rbody.appendChild(tr);
  } else {
    for (const e of recent) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(fmtDateTime(e.t))}</td>
        <td>${escapeHtml(e.id)}</td>
        <td>${e.isCorrect ? "✅" : "❌"}</td>
      `;
      rbody.appendChild(tr);
    }
  }
}

// --- Filters UI ---
function setupFilters() {
  // parent
  const parentSel = $("parentFilter");
  const subSel = $("subFilter");
  const parents = getParents(QUESTIONS);
  parentSel.innerHTML =
    `<option value="">すべて</option>` +
    parents.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

  const refreshSubs = () => {
    const p = String(parentSel.value || "");
    if (!p) {
      subSel.disabled = true;
      subSel.innerHTML = `<option value="">すべて</option>`;
      return;
    }
    const subs = getSubsForParent(QUESTIONS, p);
    subSel.disabled = false;
    subSel.innerHTML =
      `<option value="">すべて</option>` +
      subs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  };

  parentSel.onchange = () => {
    refreshSubs();
    renderList();
  };
  subSel.onchange = () => renderList();

  // search
  $("searchInput").addEventListener("input", () => renderList());

  // chips
  $("onlyUnanswered").addEventListener("change", () => renderList());
  $("onlyIncorrect").addEventListener("change", () => renderList());

  refreshSubs();
}

function getFilteredQuestions() {
  const logs = loadLogs();
  const latest = latestResultById(logs);

  const qSearch = String($("searchInput").value || "").trim().toLowerCase();
  const parent = String($("parentFilter").value || "").trim();
  const sub = String($("subFilter").value || "").trim();
  const onlyUnanswered = !!$("onlyUnanswered").checked;
  const onlyIncorrect = !!$("onlyIncorrect").checked;

  return QUESTIONS.filter((q) => {
    // parent/sub
    if (parent && qCategoryParent(q) !== parent) return false;
    if (sub && qCategorySub(q) !== sub) return false;

    // search
    if (qSearch) {
      const hay = `${q.id} ${q.question}`.toLowerCase();
      if (!hay.includes(qSearch)) return false;
    }

    const r = latest.get(q.id);
    const isAnswered = !!r;
    const isCorrect = r ? r.isCorrect : false;

    if (onlyUnanswered && isAnswered) return false;
    if (onlyIncorrect && (!isAnswered || isCorrect)) return false;

    return true;
  });
}

// --- List ---
function renderList() {
  const logs = loadLogs();
  const latest = latestResultById(logs);

  // dashboard refresh
  buildDashboard(logs);

  const listEl = $("quizList");
  listEl.innerHTML = "";

  const filtered = getFilteredQuestions();
  const grouped = groupByParentSub(filtered);

  const parents = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "ja"));

  let globalIndex = 0;

  for (const p of parents) {
    const pSec = document.createElement("section");
    pSec.className = "parent-section";

    const pTitle = document.createElement("h3");
    pTitle.className = "parent-title";
    pTitle.textContent = p;
    pSec.appendChild(pTitle);

    const subMap = grouped.get(p);
    const subs = Array.from(subMap.keys()).sort((a, b) => a.localeCompare(b, "ja"));

    for (const s of subs) {
      const arr = subMap.get(s) || [];

      const sSec = document.createElement("section");
      sSec.className = "category-section";

      const sTitle = document.createElement("h4");
      sTitle.className = "category-title";
      sTitle.textContent = `${p} / ${s}（${arr.length}）`;
      sSec.appendChild(sTitle);

      for (const q of arr) {
        globalIndex++;

        const card = document.createElement("button");
        card.type = "button";
        card.className = "quiz-card";

        const title = document.createElement("div");
        title.className = "quiz-card-title";
        title.textContent = `${globalIndex}. ${q.question}`;

        const meta = document.createElement("div");
        meta.className = "quiz-card-meta";

        const r = latest.get(q.id);
        let badge = `<span class="badge badge-gray">未回答</span>`;
        if (r) badge = r.isCorrect
          ? `<span class="badge badge-green">正解</span>`
          : `<span class="badge badge-red">不正解</span>`;

        meta.innerHTML = `${badge}<span class="meta-id">ID: ${escapeHtml(q.id)}</span>`;

        card.appendChild(title);
        card.appendChild(meta);

        card.onclick = () => {
          setRoute(`${BASE_PATH}quiz?id=${encodeURIComponent(q.id)}`);
        };

        sSec.appendChild(card);
      }

      pSec.appendChild(sSec);
    }

    listEl.appendChild(pSec);
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "条件に一致する問題がありません。";
    listEl.appendChild(empty);
  }
}

// --- Quiz ---
function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function renderQuestion(q) {
  $("qid").textContent = q.id;
  $("question").textContent = q.question;

  // meta（カテゴリ・直近結果）
  const logs = loadLogs();
  const latest = latestResultById(logs);
  const r = latest.get(q.id);
  const cat = qCategoryFull(q);
  $("qmeta").innerHTML = `
    <span class="meta-pill">${escapeHtml(cat)}</span>
    ${r ? (r.isCorrect
      ? `<span class="meta-pill ok">最新：正解</span>`
      : `<span class="meta-pill ng">最新：不正解</span>`) : `<span class="meta-pill">未回答</span>`}
  `;

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  // 前へ / 次へ ナビゲーション
  const currentIndex = QUESTIONS.findIndex((x) => x.id === q.id);
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");

  if (prevBtn) {
    prevBtn.disabled = currentIndex <= 0;
    prevBtn.onclick = () => {
      if (currentIndex <= 0) return;
      const prev = QUESTIONS[currentIndex - 1];
      setRoute(`${BASE_PATH}quiz?id=${encodeURIComponent(prev.id)}`);
    };
  }

  if (nextBtn) {
    nextBtn.disabled = currentIndex >= QUESTIONS.length - 1;
    nextBtn.onclick = () => {
      if (currentIndex >= QUESTIONS.length - 1) return;
      const next = QUESTIONS[currentIndex + 1];
      setRoute(`${BASE_PATH}quiz?id=${encodeURIComponent(next.id)}`);
    };
  }

  // 初期化
  const submitBtn = $("submitBtn");
  submitBtn.disabled = false;
  $("result").textContent = "";

  const tpl = $("choice-template");
  let answered = false;

  q.choices.forEach((choice, i) => {
    const node = tpl.content.cloneNode(true);

    const input = node.querySelector(".choice-input");
    const text = node.querySelector(".choice-text");
    const overview = node.querySelector(".choice-overview");
    const toggleBtn = node.querySelector(".choice-toggle-detail");
    const toggleText = toggleBtn.querySelector("span");
    const toggleIcon = toggleBtn.querySelector("svg");
    const detailWrap = node.querySelector(".choice-detail");
    const detailContent = node.querySelector(".choice-detail-content");
    const link = node.querySelector(".choice-link");

    input.dataset.index = String(i);
    text.textContent = choice.text;

    overview.textContent = choice.overview ?? "";
    detailContent.textContent = choice.detail ?? "";

    // link
    const href = (choice.link ?? "").trim();
    if (href) {
      link.href = href;
      link.hidden = false;
    } else {
      link.href = "";
      link.hidden = true;
    }

    // 初期状態
    overview.hidden = true;
    detailWrap.hidden = true;
    toggleBtn.disabled = true;
    if (toggleText) toggleText.textContent = "解説（回答後）";

    // 解説トグル
    toggleBtn.onclick = () => {
      if (!answered) return;

      const opening = overview.hidden && detailWrap.hidden;

      overview.hidden = !opening;
      detailWrap.hidden = !opening;

      if (toggleText) toggleText.textContent = opening ? "解説を隠す" : "解説を表示";
      toggleBtn.classList.toggle("active", opening);
      if (toggleIcon) toggleIcon.style.transform = opening ? "rotate(180deg)" : "rotate(0deg)";
    };

    choicesEl.appendChild(node);
  });

  submitBtn.onclick = () => {
    // 選択取得
    const selected = uniqSorted(
      Array.from(document.querySelectorAll(".choice-input"))
        .filter((x) => x.checked)
        .map((x) => Number(x.dataset.index))
    );

    const correct = uniqSorted(q.correct_indices);
    const isCorrect = arraysEqual(selected, correct);

    answered = true;

    // 履歴保存
    addLog({
      t: Date.now(),
      id: q.id,
      category: qCategoryFull(q),
      selected,
      correct,
      isCorrect
    });

    // 結果表示
    const resultEl = $("result");
    resultEl.textContent = isCorrect ? "✅ 正解" : "❌ 不正解";

    // UIフィードバック
    document.querySelectorAll(".choice").forEach((item, idx) => {
      const input = item.querySelector(".choice-input");

      // 色分け
      const isSel = selected.includes(idx);
      const isAns = correct.includes(idx);

      item.classList.remove("is-correct", "is-wrong", "is-missed");

      if (isAns && isSel) item.classList.add("is-correct");
      if (!isAns && isSel) item.classList.add("is-wrong");
      if (isAns && !isSel) item.classList.add("is-missed");

      input.disabled = true;

      // 解説はトグルで開く
      const ov = item.querySelector(".choice-overview");
      const dt = item.querySelector(".choice-detail");
      if (ov) ov.hidden = true;
      if (dt) dt.hidden = true;

      const btn = item.querySelector(".choice-toggle-detail");
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("active");
        const span = btn.querySelector("span");
        if (span) span.textContent = "解説を表示";
        const icon = btn.querySelector("svg");
        if (icon) icon.style.transform = "rotate(0deg)";
      }
    });

    submitBtn.disabled = true;

    // ダッシュボード/一覧表示にも反映されるように、メタ更新
    const logs = loadLogs();
    const latest = latestResultById(logs);
    const r2 = latest.get(q.id);
    const cat = qCategoryFull(q);
    $("qmeta").innerHTML = `
      <span class="meta-pill">${escapeHtml(cat)}</span>
      ${r2 ? (r2.isCorrect
        ? `<span class="meta-pill ok">最新：正解</span>`
        : `<span class="meta-pill ng">最新：不正解</span>`) : `<span class="meta-pill">未回答</span>`}
    `;
  };
}

// --- Init ---
async function init() {
  const statusEl = $("status");
  statusEl.textContent = "Loading...";

  try {
    QUESTIONS = await loadQuestions();
    statusEl.textContent = "";

    setupFilters();
    renderList();
    handleRouting();

    $("backBtn").onclick = () => setRoute(`${BASE_PATH}`);
    window.onpopstate = handleRouting;

  } catch (err) {
    console.error(err);
    statusEl.textContent = "Failed to load data.";
    statusEl.style.color = "red";
  }
}

init();
