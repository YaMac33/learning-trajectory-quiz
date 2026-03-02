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
  // 無限に増えすぎない簡易ガード（必要なら調整）
  if (logs.length > 5000) logs.splice(0, logs.length - 5000);
  saveLogs(logs);
}

function latestResultById(logs) {
  // Map<id, log>
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
    renderList();
    return;
  }

  // quiz view
  $("view-list").hidden = true;
  $("view-quiz").hidden = false;
  $("backBtn").hidden = false;

  CURRENT_ID = id;
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

  // 例: "テクノロジ系 / セキュリティ"
  const parts = raw.split("/").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { parent: parts[0], sub: parts.slice(1).join(" / ") };

  // 例: "テクノロジ系"
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
  // sort inside each sub by id for stability
  for (const subMap of top.values()) {
    for (const arr of subMap.values()) {
      arr.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
  }
  return top;
}

// ★追加：親カテゴリだけでグルーピング
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

// ★追加：開催期（出典）抽出＆グルーピング
function extractSessionLabel(source) {
  const s = String(source || "").trim();
  if (!s) return "出典不明";

  // 「問」の前を開催期として採用（例：令和6年秋期　問43 → 令和6年秋期）
  const idx = s.indexOf("問");
  if (idx > 0) {
    const head = s.slice(0, idx).trim();
    return head || "出典不明";
  }
  return s; // 「問」が無い形式ならそのまま
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

// --- Dashboard (optional UI) ---
function buildDashboard(logs) {
  const latest = latestResultById(logs);
  const total = QUESTIONS.length;

  let answered = 0;
  let correctLatest = 0;

  for (const q of QUESTIONS) {
    const r = latest.get(q.id);
    if (r) {
      answered++;
      if (r.isCorrect) correctLatest++;
    }
  }

  // 全履歴ベース（重複含む）
  let correctAll = 0;
  for (const e of logs) if (e.isCorrect) correctAll++;

  $("dashTotal").textContent = String(total);
  $("dashAnswered").textContent = String(answered);

  const accLatest = answered ? Math.round((correctLatest / answered) * 1000) / 10 : 0;
  const accAll = logs.length ? Math.round((correctAll / logs.length) * 1000) / 10 : 0;

  $("dashAccuracyLatest").textContent = `${accLatest}%`;
  $("dashAccuracyAll").textContent = `${accAll}%`;

  // カテゴリ別（最新結果）
  const catAgg = new Map(); // parent -> { answered, correct }
  for (const q of QUESTIONS) {
    const parent = qCategoryParent(q);
    if (!catAgg.has(parent)) catAgg.set(parent, { answered: 0, correct: 0 });
    const r = latest.get(q.id);
    if (r) {
      const obj = catAgg.get(parent);
      obj.answered++;
      if (r.isCorrect) obj.correct++;
    }
  }

  const tbody = $("dashCatTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const [parent, v] of Array.from(catAgg.entries()).sort((a, b) => a[0].localeCompare(b[0], "ja"))) {
    const tr = document.createElement("tr");
    const acc = v.answered ? Math.round((v.correct / v.answered) * 1000) / 10 : 0;
    tr.innerHTML = `
      <td>${escapeHtml(parent)}</td>
      <td>${v.answered}</td>
      <td>${v.correct}</td>
      <td>${acc}%</td>
    `;
    tbody.appendChild(tr);
  }

  // 最近の履歴（末尾から）
  const recent = logs.slice().sort((a, b) => (b.t ?? 0) - (a.t ?? 0)).slice(0, 20);
  const rbody = $("dashRecentTable").querySelector("tbody");
  rbody.innerHTML = "";
  for (const e of recent) {
    const tr = document.createElement("tr");
    const dt = new Date(e.t);
    tr.innerHTML = `
      <td>${Number.isFinite(dt.getTime()) ? dt.toLocaleString() : ""}</td>
      <td>${escapeHtml(e.id)}</td>
      <td>${escapeHtml(e.category || "")}</td>
      <td>${e.isCorrect ? "✅" : "❌"}</td>
    `;
    rbody.appendChild(tr);
  }
}

// --- Filters UI ---
function setupFilters() {
  // parent
  const parentSel = $("parentFilter");
  const subSel = $("subFilter");
  const groupSel = $("groupMode"); // 表示モード

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

  // 表示モードに応じてフィルタUIの有効/無効を制御
  const applyGroupModeUi = () => {
    const mode = String(groupSel?.value || "cat-parent-sub");

    if (mode === "session") {
      // 開催期表示：親/子カテゴリは使わない
      parentSel.value = "";
      subSel.value = "";
      parentSel.disabled = true;

      subSel.disabled = true;
      subSel.innerHTML = `<option value="">すべて</option>`;
      return;
    }

    // それ以外は親カテゴリは使える
    parentSel.disabled = false;

    if (mode === "cat-parent") {
      // 親カテゴリのみ：子カテゴリは使わない
      subSel.value = "";
      subSel.disabled = true;
      subSel.innerHTML = `<option value="">すべて</option>`;
      return;
    }

    // cat-parent-sub：通常どおり
    refreshSubs();
  };

  parentSel.onchange = () => {
    refreshSubs();
    renderList();
  };
  subSel.onchange = () => renderList();

  // 表示モード変更
  if (groupSel) {
    groupSel.addEventListener("change", () => {
      applyGroupModeUi();
      renderList();
    });
  }

  // search
  $("searchInput").addEventListener("input", () => renderList());

  // chips
  $("onlyUnanswered").addEventListener("change", () => renderList());
  $("onlyIncorrect").addEventListener("change", () => renderList());

  // init
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
    // parent/sub（表示モードに応じて適用）
    if (mode !== "session") {
      if (parent && qCategoryParent(q) !== parent) return false;
      if (mode === "cat-parent-sub" && sub && qCategorySub(q) !== sub) return false;
    }

    // search（問題文 / ID / 出典でも引っかかるように）
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

  // dashboard refresh（HTML側にdash系が無い場合でも落ちないようにガード）
  try {
    if (
      $("dashTotal") && $("dashAnswered") && $("dashAccuracyLatest") && $("dashAccuracyAll")
      && $("dashCatTable") && $("dashRecentTable")
    ) {
      buildDashboard(logs);
    }
  } catch (e) {
    console.warn("buildDashboard skipped:", e);
  }

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

    // 出典表示
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

        for (const q of arr) {
          sSec.appendChild(makeCard(q));
        }

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

      for (const q of arr) {
        pSec.appendChild(makeCard(q));
      }

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

      for (const q of arr) {
        sSec.appendChild(makeCard(q));
      }

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

// --- Quiz ---
function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function renderQuestion(q) {
  $("qid").textContent = `ID: ${q.id}`;
  $("qcategory").textContent = q.category ? `カテゴリ: ${q.category}` : "";
  $("qsource").textContent = q.source ? `出典: ${q.source}` : "";
  $("qmeta").textContent = "";

  $("question").textContent = q.question;

  const choicesEl = $("choices");
  choicesEl.innerHTML = "";

  const tpl = $("choice-template");
  const selected = new Set();

  const logs = loadLogs();
  const latest = latestResultById(logs);
  const latestLog = latest.get(q.id);

  // 既に回答済みならチェック状態と解説展開の制御を反映
  const isAnswered = !!latestLog;

  // multi answer support
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

    input.checked = false;
    input.disabled = isAnswered;

    text.textContent = c.text ?? "";

    // optional quick overview (if you have it)
    if (c.overview) {
      overview.hidden = false;
      overview.textContent = c.overview;
    } else {
      overview.hidden = true;
      overview.textContent = "";
    }

    // detail (explanation)
    detailContent.textContent = c.detail ?? "";
    if (c.link) {
      link.href = c.link;
      link.hidden = false;
    } else {
      link.href = "";
      link.hidden = true;
    }

    // toggle button
    btn.disabled = !isAnswered;
    btn.addEventListener("click", () => {
      const willOpen = detail.hidden;
      detail.hidden = !willOpen;
    });

    input.addEventListener("change", () => {
      if (input.checked) selected.add(i);
      else selected.delete(i);
    });

    // restore answered state
    if (latestLog && Array.isArray(latestLog.selected)) {
      if (latestLog.selected.includes(i)) input.checked = true;
    }

    // if answered: open detail by default (optional)
    if (isAnswered) {
      // detail.hidden = false; // ←常時開きたいならコメント解除
    }

    choicesEl.appendChild(node);
  }

  // buttons
  $("submitBtn").disabled = isAnswered;

  $("submitBtn").onclick = () => {
    const sel = uniqSorted(Array.from(selected));
    const correct = uniqSorted(Array.isArray(q.correct) ? q.correct : []);

    const isCorrect = arraysEqual(sel, correct);

    addLog({
      t: Date.now(),
      id: String(q.id),
      category: String(q.category || ""),
      selected: sel,
      correct: correct,
      isCorrect,
    });

    // re-render to lock + enable details
    renderQuestion(q);
  };

  // prev/next navigation
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

  // result display
  const latest2 = latestResultById(loadLogs());
  const r = latest2.get(q.id);
  const resultEl = $("result");

  if (!r) {
    resultEl.textContent = "";
  } else {
    resultEl.innerHTML = r.isCorrect
      ? `<div class="result-ok">✅ 正解</div>`
      : `<div class="result-ng">❌ 不正解</div>`;

    // enable details toggle buttons after answered
    const toggleBtns = document.querySelectorAll(".choice-toggle-detail");
    toggleBtns.forEach((b) => (b.disabled = false));
  }
}

// --- Boot ---
async function main() {
  try {
    $("status").textContent = "読み込み中...";
    QUESTIONS = await loadQuestions();

    // normalize minimal shape
    QUESTIONS = Array.isArray(QUESTIONS) ? QUESTIONS : [];
    QUESTIONS = QUESTIONS.map((q) => ({
      id: String(q.id ?? ""),
      category: String(q.category ?? ""),
      source: String(q.source ?? ""),
      question: String(q.question ?? ""),
      choices: Array.isArray(q.choices) ? q.choices : [],
      correct: Array.isArray(q.correct) ? q.correct : [],
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
