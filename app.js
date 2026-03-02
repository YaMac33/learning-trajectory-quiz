// app.js
import { loadQuestions } from "./api.js";

// id取得ヘルパ
const $ = (id) => document.getElementById(id);

let QUESTIONS = [];
let CURRENT_ID = null;

// ★このページを開いている間だけの「回答結果」
// Map<id, { selected:number[], isCorrect:boolean }>
const SESSION_RESULTS = new Map();

// GitHub Pages 配下のベースパス
const BASE_PATH = "/learning-trajectory-quiz/";

// localStorage key
const LOG_KEY = "ltQuizLogs";

/**
 * logs: Array<{
 *   t: number,
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
  if (logs.length > 5000) logs.splice(0, logs.length - 5000);
  saveLogs(logs);
}

function latestResultById(logs) {
  const m = new Map();
  for (const e of logs) {
    const prev = m.get(e.id);
    if (!prev || (typeof e.t === "number" && e.t > prev.t)) {
      m.set(e.id, e);
    }
  }
  return m;
}

// --- Routing helpers ---
function setRoute(pathWithQuery) {
  history.pushState({}, "", pathWithQuery);
  syncViewFromUrl();
}

function getQueryParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

function syncViewFromUrl() {
  const id = getQueryParam("id");

  if (!id) {
    // list view
    $("view-list").hidden = false;
    $("view-quiz").hidden = true;
    $("backBtn").hidden = true;

    CURRENT_ID = null;

    // ★一覧に戻ったら、このセッション結果はクリア（好み）
    SESSION_RESULTS.clear();

    renderList();
    return;
  }

  // quiz view
  $("view-list").hidden = true;
  $("view-quiz").hidden = false;
  $("backBtn").hidden = false;

  CURRENT_ID = String(id);

  const q = QUESTIONS.find((x) => String(x.id) === String(id));
  if (!q) {
    $("status").textContent = `指定されたIDの問題が見つかりません: ${id}`;
    return;
  }
  renderQuestion(q);
}

window.addEventListener("popstate", () => {
  syncViewFromUrl();
});

$("backBtn").addEventListener("click", () => {
  setRoute(`${BASE_PATH}`);
});

// --- Category helpers ---
function splitCategory(category) {
  const raw = String(category || "").trim();
  if (!raw) return { parent: "未分類", sub: "未分類" };

  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { parent: parts[0], sub: parts.slice(1).join(" / ") };

  return { parent: parts[0], sub: "未分類" };
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
  for (const subMap of top.values()) {
    for (const arr of subMap.values()) {
      arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
  }
  return top;
}

function groupByParent(questions) {
  // Map<parent, question[]>
  const map = new Map();
  for (const q of questions) {
    const { parent } = splitCategory(q.category);
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent).push(q);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return map;
}

function extractSessionLabel(source) {
  const s = String(source || "").trim();
  if (!s) return "出典不明";

  const idx = s.indexOf("問");
  if (idx > 0) {
    const head = s.slice(0, idx).trim();
    return head || "出典不明";
  }
  return s;
}

function groupBySession(questions) {
  // Map<sessionLabel, question[]>
  const map = new Map();
  for (const q of questions) {
    const key = extractSessionLabel(q.source);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(q);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return map;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

// --- Filters UI ---
function setupFilters() {
  const parentSel = $("parentFilter");
  const subSel = $("subFilter");
  const groupSel = $("groupMode");

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

  const applyGroupModeUi = () => {
    const mode = String(groupSel?.value || "cat-parent-sub");

    if (mode === "session") {
      parentSel.value = "";
      subSel.value = "";
      parentSel.disabled = true;

      subSel.disabled = true;
      subSel.innerHTML = `<option value="">すべて</option>`;
      return;
    }

    parentSel.disabled = false;

    if (mode === "cat-parent") {
      subSel.value = "";
      subSel.disabled = true;
      subSel.innerHTML = `<option value="">すべて</option>`;
      return;
    }

    refreshSubs();
  };

  parentSel.onchange = () => {
    refreshSubs();
    renderList();
  };
  subSel.onchange = () => renderList();

  if (groupSel) {
    groupSel.addEventListener("change", () => {
      applyGroupModeUi();
      renderList();
    });
  }

  $("searchInput").addEventListener("input", () => renderList());
  $("onlyUnanswered").addEventListener("change", () => renderList());
  $("onlyIncorrect").addEventListener("change", () => renderList());

  refreshSubs();
  applyGroupModeUi();
}

function getFilteredQuestions() {
  const logs = loadLogs();
  const latest = latestResultById(logs);

  const qSearch = String($("searchInput").value || "").trim().toLowerCase();
  const mode = String($("groupMode")?.value || "cat-parent-sub");
  const parent = String($("parentFilter").value || "").trim();
  const sub = String($("subFilter").value || "").trim();
  const onlyUnanswered = !!$("onlyUnanswered").checked;
  const onlyIncorrect = !!$("onlyIncorrect").checked;

  return QUESTIONS.filter((q) => {
    if (mode !== "session") {
      if (parent && qCategoryParent(q) !== parent) return false;
      if (mode === "cat-parent-sub" && sub && qCategorySub(q) !== sub) return false;
    }

    if (qSearch) {
      const hay = `${q.id} ${q.question} ${q.source || ""}`.toLowerCase();
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

  const listEl = $("quizList");
  listEl.innerHTML = "";

  const filtered = getFilteredQuestions();
  const mode = String($("groupMode")?.value || "cat-parent-sub");

  let globalIndex = 0;

  const makeCard = (q) => {
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
    if (r) {
      badge = r.isCorrect
        ? `<span class="badge badge-green">正解</span>`
        : `<span class="badge badge-red">不正解</span>`;
    }
    meta.innerHTML = `${badge}<span class="meta-id">ID: ${escapeHtml(q.id)}</span>`;

    const source = document.createElement("div");
    source.className = "quiz-card-source";
    source.textContent = (q.source ?? "").trim() ? `出典: ${q.source.trim()}` : "";

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(source);

    card.onclick = () => {
      setRoute(`${BASE_PATH}quiz?id=${encodeURIComponent(q.id)}`);
    };

    return card;
  };

  if (mode === "cat-parent-sub") {
    const grouped = groupByParentSub(filtered);
    const parents = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "ja"));

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

        for (const q of arr) sSec.appendChild(makeCard(q));
        pSec.appendChild(sSec);
      }

      listEl.appendChild(pSec);
    }
  } else if (mode === "cat-parent") {
    const grouped = groupByParent(filtered);
    const parents = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "ja"));

    for (const p of parents) {
      const arr = grouped.get(p) || [];

      const pSec = document.createElement("section");
      pSec.className = "parent-section";

      const pTitle = document.createElement("h3");
      pTitle.className = "parent-title";
      pTitle.textContent = `${p}（${arr.length}）`;
      pSec.appendChild(pTitle);

      for (const q of arr) pSec.appendChild(makeCard(q));
      listEl.appendChild(pSec);
    }
  } else if (mode === "session") {
    const grouped = groupBySession(filtered);
    const sessions = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "ja"));

    for (const s of sessions) {
      const arr = grouped.get(s) || [];

      const sSec = document.createElement("section");
      sSec.className = "parent-section";

      const sTitle = document.createElement("h3");
      sTitle.className = "parent-title";
      sTitle.textContent = `${s}（${arr.length}）`;
      sSec.appendChild(sTitle);

      for (const q of arr) sSec.appendChild(makeCard(q));
      listEl.appendChild(sSec);
    }
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "条件に一致する問題がありません。";
    listEl.appendChild(empty);
  }
}

// --- Quiz helpers ---
function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// --- Quiz ---
function renderQuestion(q) {
  // ★毎回必ずクリア（残り続ける問題を物理的に潰す）
  const resultEl = $("result");
  resultEl.textContent = "";

  $("qid").textContent = `ID: ${q.id}`;
  $("qcategory").textContent = q.category ? `カテゴリ: ${q.category}` : "";
  $("qsource").textContent = q.source ? `出典: ${q.source}` : "";
  $("qmeta").textContent = "";

  $("question").textContent = q.question;

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  const tpl = $("choice-template");

  const sessionRes = SESSION_RESULTS.get(String(q.id)) || null;
  const isAnsweredThisSession = !!sessionRes;

  // 回答前の選択保持
  const selected = new Set();

  for (let i = 0; i < q.choices.length; i++) {
    const c = q.choices[i];
    const node = tpl.content.firstElementChild.cloneNode(true);

    const input = node.querySelector(".choice-input");
    const text = node.querySelector(".choice-text");
    const overview = node.querySelector(".choice-overview");
    const btn = node.querySelector(".choice-toggle-detail");
    const detail = node.querySelector(".choice-detail");
    const detailContent = node.querySelector(".choice-detail-content");
    const link = node.querySelector(".choice-link");

    // 回答後は固定
    input.disabled = isAnsweredThisSession;

    // ★回答前は必ず未チェック（過去ログは一切出さない）
    if (sessionRes) {
      input.checked = sessionRes.selected.includes(i);
    } else {
      input.checked = false;
    }

    text.textContent = c.text ?? "";

    // ★overview（例：「誤り。これは〜」）は回答後だけ表示
    if (c.overview && isAnsweredThisSession) {
      overview.hidden = false;
      overview.textContent = c.overview;
    } else {
      overview.hidden = true;
      overview.textContent = "";
    }

    detailContent.textContent = c.detail ?? "";
    if (c.link) {
      link.href = c.link;
      link.hidden = false;
    } else {
      link.href = "";
      link.hidden = true;
    }

    // 解説ボタンは回答後のみ
    btn.disabled = !isAnsweredThisSession;

    // ★安全のため：回答前は detail 自体も必ず閉じる
    detail.hidden = true;

    btn.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
    });

    // 回答前のみ選択追跡
    if (!isAnsweredThisSession) {
      input.addEventListener("change", () => {
        if (input.checked) selected.add(i);
        else selected.delete(i);
      });
    }

    choicesEl.appendChild(node);
  }

  // submit
  $("submitBtn").disabled = isAnsweredThisSession;

  $("submitBtn").onclick = () => {
    if (isAnsweredThisSession) return;

    const sel = uniqSorted(Array.from(selected));
    const correct = uniqSorted(Array.isArray(q.correct) ? q.correct : []);
    const isCorrect = arraysEqual(sel, correct);

    // 保存（履歴）
    addLog({
      t: Date.now(),
      id: String(q.id),
      category: String(q.category || ""),
      selected: sel,
      correct,
      isCorrect,
    });

    // ★表示用（このセッションで今解いた結果だけ）
    SESSION_RESULTS.set(String(q.id), { selected: sel, isCorrect });

    renderQuestion(q);
  };

  // prev/next
  const ids = QUESTIONS.map((x) => String(x.id));
  const idx = ids.indexOf(String(q.id));

  $("prevBtn").disabled = idx <= 0;
  $("nextBtn").disabled = idx < 0 || idx >= ids.length - 1;

  $("prevBtn").onclick = () => {
    if (idx > 0) setRoute(`${BASE_PATH}quiz?id=${encodeURIComponent(ids[idx - 1])}`);
  };
  $("nextBtn").onclick = () => {
    if (idx >= 0 && idx < ids.length - 1) setRoute(`${BASE_PATH}quiz?id=${encodeURIComponent(ids[idx + 1])}`);
  };

  // ★結果表示：このセッションで回答したものだけ
  if (sessionRes) {
    resultEl.innerHTML = sessionRes.isCorrect
      ? `<div class="result-ok">✅ 正解</div>`
      : `<div class="result-ng">❌ 不正解</div>`;

    // 解説ボタン解放（念のため）
    const toggleBtns = document.querySelectorAll(".choice-toggle-detail");
    toggleBtns.forEach((b) => (b.disabled = false));
  }
}

// --- Boot ---
async function main() {
  try {
    $("status").textContent = "読み込み中...";
    QUESTIONS = await loadQuestions();

    QUESTIONS = Array.isArray(QUESTIONS) ? QUESTIONS : [];
    QUESTIONS = QUESTIONS.map((q) => ({
      id: String(q.id ?? ""),
      category: String(q.category ?? ""),
      source: String(q.source ?? ""),
      question: String(q.question ?? ""),
      choices: Array.isArray(q.choices) ? q.choices : [],
      // ★重要：questions.json 側は correct_indices が正
      correct: Array.isArray(q.correct_indices)
        ? q.correct_indices
        : (Array.isArray(q.correct) ? q.correct : []),
    }));

    setupFilters();
    $("status").textContent = "";

    syncViewFromUrl();
  } catch (e) {
    console.error(e);
    $("status").textContent = "読み込みに失敗しました。";
  }
}

main();
