// 測試輔助：從 index.html 抽出主 <script>，在 node:vm 沙箱以最小 DOM／localStorage／window 假物件載入。
// 原則：
//  - 不修改 index.html；只讀取。
//  - 沙箱內 fetch 一律為 stub：被呼叫就記錄並丟錯，絕不發出真實網路請求。
//  - localStorage 為記憶體版，每次 loadApp() 都是全新的，不會讀到任何真實資料。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const INDEX_PATH = path.join(ROOT, 'index.html');

export function readIndex() {
  return fs.readFileSync(INDEX_PATH, 'utf8');
}

/** 回傳 index.html 中所有 <script> 區塊：{ attrs, code, line }（line 為 1 起算的開始行）。 */
export function extractScripts(html = readIndex()) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const line = html.slice(0, m.index).split('\n').length;
    out.push({ attrs: m[1].trim(), code: m[2], line });
  }
  return out;
}

/** 主程式 = 最長的 inline <script>（無 src、含 "use strict" 與 hydrateAll）。 */
export function extractMainScript(html = readIndex()) {
  const main = extractScripts(html)
    .filter(s => !/\bsrc=/.test(s.attrs) && /hydrateAll/.test(s.code))
    .sort((a, b) => b.code.length - a.code.length)[0];
  if (!main) throw new Error('找不到主 <script>');
  return main.code;
}

/**
 * 以字串方式抽出一個頂層宣告（function NAME(...) {...} 或 const NAME = {...};），
 * 用於綁 DOM 太緊或只想單獨測的函式。以括號配對（略過字串與樣板字面值）找結尾。
 */
export function extractDeclaration(src, name) {
  const re = new RegExp(`^(?:function\\s+${name}\\s*\\(|const\\s+${name}\\s*=)`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`找不到宣告 ${name}`);
  let i = src.indexOf('{', m.index + m[0].length - 1);
  // function 宣告的 { 在參數列之後；先跳過參數列
  if (m[0].startsWith('function')) {
    let depth = 0, j = m.index + m[0].length - 1;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') { depth--; if (depth === 0) break; }
    }
    i = src.indexOf('{', j);
  }
  const end = matchBrace(src, i);
  let stop = end + 1;
  if (src[stop] === ';') stop++;
  return src.slice(m.index, stop);
}

function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'") { i = skipString(src, i, c); continue; }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '/' && isRegexStart(src, i)) { i = skipRegex(src, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  throw new Error('括號不配對');
}
// 判斷 / 是否為正規表示式字面值的開頭：前一個非空白字元是運算子或開括號
function isRegexStart(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  return j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[j]);
}
function skipRegex(src, i) {
  let inClass = false;
  for (i++; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '[') inClass = true;
    else if (src[i] === ']') inClass = false;
    else if (src[i] === '/' && !inClass) return i;
    else if (src[i] === '\n') return i; // 保險：正規式不跨行
  }
  return i;
}
function skipString(src, i, q) {
  for (i++; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === q) return i;
  }
  return i;
}
function skipTemplate(src, i) {
  for (i++; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '`') return i;
    if (src[i] === '$' && src[i + 1] === '{') { i = matchBrace(src, i + 1); }
  }
  return i;
}

/** 把若干個抽出的宣告組合後用 new Function 取回，例如 pickFunctions(['fmt','pctf']). */
export function pickFunctions(names, src = extractMainScript()) {
  const body = names.map(n => extractDeclaration(src, n)).join('\n') + `\nreturn { ${names.join(', ')} };`;
  return new Function('"use strict";\n' + body)();
}

/* ------------------------------------------------------------------
   最小 DOM 假物件
   ------------------------------------------------------------------ */

// 萬用 stub：任何屬性都可讀、可寫、可呼叫，用來吸收頂層初始化對 DOM 的操作。
function universalStub() {
  const store = {};
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get(_t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'then') return undefined; // 不要被當成 thenable
      if (k in store) return store[k];
      if (k === 'dataset' || k === 'style') return (store[k] = {});
      if (k === 'classList') return (store[k] = { add() {}, remove() {}, toggle() {}, contains() { return false; } });
      if (k === 'querySelectorAll') return () => [];
      if (k === 'querySelector' || k === 'closest' || k === 'getAttribute') return () => null;
      return proxy;
    },
    set(_t, k, v) { store[k] = v; return true; },
    apply() { return proxy; }
  });
  return proxy;
}

/**
 * 「widget body」假元素：記錄 innerHTML，並從 HTML 字串中解析出 .ctrl-num 輸入框與
 * [data-preset] 按鈕，讓測試可以模擬使用者輸入（設定 value 後觸發 input 事件）。
 */
export function createBody() {
  let html = '';
  let nodes = { inputs: [], presets: [] };
  const body = {
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); nodes = parseNodes(html); },
    querySelectorAll(sel) {
      if (sel === '.ctrl-num') return nodes.inputs;
      if (sel === '[data-preset]') return nodes.presets;
      return [];
    },
    querySelector(sel) {
      const m = /^\.ctrl-num\[data-k="([^"]+)"\]$/.exec(sel);
      if (m) return nodes.inputs.find(n => n.dataset.k === m[1]) || null;
      return null;
    },
    /** 測試用：模擬在 data-k=key 的輸入框輸入 value */
    type(key, value) {
      const inp = nodes.inputs.find(n => n.dataset.k === key);
      if (!inp) throw new Error('沒有輸入框 ' + key);
      inp.value = value;
      inp._fire('input');
    },
    clickPreset(name) {
      const b = nodes.presets.find(n => n.dataset.preset === name);
      if (!b) throw new Error('沒有預設 ' + name);
      b._fire('click');
    }
  };
  return body;
}

function makeNode(attrs) {
  const handlers = {};
  return {
    dataset: attrs.dataset,
    value: attrs.value,
    attrs: attrs.all,
    selectionStart: 0,
    focus() {}, setSelectionRange() {},
    addEventListener(t, f) { (handlers[t] ||= []).push(f); },
    _fire(t) { (handlers[t] || []).forEach(f => f({ target: this })); }
  };
}

function parseAttrs(tag) {
  const all = {}, dataset = {};
  for (const m of tag.matchAll(/([\w-]+)="([^"]*)"/g)) {
    all[m[1]] = m[2];
    if (m[1].startsWith('data-')) dataset[m[1].slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = m[2];
  }
  return { all, dataset, value: all.value };
}

function parseNodes(html) {
  const inputs = [...html.matchAll(/<input\b[^>]*class="ctrl-num"[^>]*>/g)].map(m => makeNode(parseAttrs(m[0])));
  const presets = [...html.matchAll(/<button\b[^>]*data-preset="[^"]*"[^>]*>/g)].map(m => makeNode(parseAttrs(m[0])));
  return { inputs, presets };
}

/** 記憶體版 localStorage */
export function createLocalStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    _dump: () => Object.fromEntries(m)
  };
}

const EXPORT_NAMES = [
  'fmt', 'pctf', 'clamp', 'esc', 'scaleY', 'svgChart', 'linePath',
  'RatioCalculator', 'DividendSimulator', 'DuPontDecomposer', 'MarginWaterfall',
  'TrendVisualizer', 'PEBands', 'EarningsQuality', 'RedFlagScanner', 'CompanyCompare',
  'LearningPathBuilder', 'QuizReview', 'Quiz', 'LLMAssistant', 'chapterLabel', 'hydrateAll',
  'STORAGE_KEY', 'VISITED_KEY', 'BOOKMARK_KEY', 'COMPLETED_KEY', 'COMPLETED_TS_KEY', 'QUIZ_REVIEW_KEY', 'SKIP_CHAPTERS'
];

/**
 * 在 vm 沙箱中載入主 script，回傳 { api, ctx, localStorage, fetchCalls, consoleErrors, listeners }。
 * api 內含 EXPORT_NAMES 中的頂層宣告。
 */
export function loadApp({ storage = {} } = {}) {
  const code = extractMainScript();
  const localStorage = createLocalStorage(storage);
  const fetchCalls = [];
  const consoleErrors = [];
  const listeners = {};
  const doc = {
    documentElement: { dataset: {}, scrollHeight: 0, clientHeight: 0 },
    body: universalStub(),
    getElementById: () => universalStub(),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => universalStub(),
    addEventListener() {}
  };
  const win = {
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    scrollY: 0, innerHeight: 800, scrollTo() {}
  };
  const sandbox = {
    window: win,
    document: doc,
    localStorage,
    console: { log() {}, warn() {}, info() {}, error: (...a) => consoleErrors.push(a) },
    fetch: async (...args) => { fetchCalls.push(args); throw new Error('測試環境禁止網路請求（fetch 已 stub）'); },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0, clearTimeout() {},
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    confirm: () => false, alert() {},
    location: { reload() {}, hash: '' },
    navigator: {},
    Date, Math, JSON, Number, String, Array, Object, Set, Map, Error, isFinite, parseFloat, parseInt, encodeURIComponent, Intl, Promise
  };
  win.localStorage = localStorage;
  const ctx = vm.createContext(sandbox);
  const tail = `\n;globalThis.__api = { ${EXPORT_NAMES.join(', ')} };`;
  vm.runInContext(code + tail, ctx, { filename: 'index.html#main-script' });
  return { api: ctx.__api, ctx, localStorage, fetchCalls, consoleErrors, listeners };
}

/* ------------------------------------------------------------------
   從渲染結果讀數字
   ------------------------------------------------------------------ */

/** 解析 stat-grid：回傳 { 標籤: 顯示字串 } */
export function readStats(html) {
  const out = {};
  for (const m of html.matchAll(/<div class="stat"><div class="label">([\s\S]*?)<\/div><div class="value([^"]*)">([\s\S]*?)<\/div>/g)) {
    out[m[1]] = m[3];
  }
  return out;
}
/** 解析 stat 的 class（pos/neg/空） */
export function readStatClasses(html) {
  const out = {};
  for (const m of html.matchAll(/<div class="stat"><div class="label">([\s\S]*?)<\/div><div class="value ?([^"]*)">/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/** 以頁面相同口徑格式化（toFixed）做手算答案比對 */
export const pct = (x, d = 1) => (x == null || !isFinite(x)) ? '—' : x.toFixed(d) + '%';

/** 固定 seed 的偽亂數（mulberry32），給性質測試用 */
export function rng(seed = 20261102) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
