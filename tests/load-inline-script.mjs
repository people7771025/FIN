// 測試輔助：把 index.html 的主 <script> 放進 node:vm 沙盒執行，取出頂層純函式供單元測試使用。
// 不改動 index.html；DOM / localStorage 以「吞掉一切呼叫」的替身頂替，只讓頂層初始化程式能跑完。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HTML_PATH = fileURLToPath(new URL('../index.html', import.meta.url));

// 任意屬性讀取、任意呼叫都回傳自己；可被迭代（空）、轉數字為 0。
function makeStub() {
  const target = function () {};
  const handler = {
    get(_t, prop) {
      if (prop === Symbol.iterator) return function* () {};
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'length') return 0;
      if (prop === 'then') return undefined; // 避免被當成 thenable
      return proxy;
    },
    set() { return true; },
    apply() { return proxy; },
    construct() { return proxy; },
  };
  const proxy = new Proxy(target, handler);
  return proxy;
}

function makeLocalStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
  };
}

// 抓 index.html 中第一段「非資料」主程式（以 "use strict" 開頭那段）。
export function extractMainScript(html = readFileSync(HTML_PATH, 'utf8')) {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].trimStart().startsWith('"use strict"')) return m[1];
  }
  throw new Error('index.html 找不到主 <script>（"use strict" 開頭）');
}

const EXPORT_NAMES = [
  'fmt', 'pctf', 'clamp', 'esc', 'scaleY', 'svgChart', 'linePath',
  'LearningPathBuilder', 'QuizReview', 'CompanyCompare', 'WorksheetTool', 'LLMAssistant',
];

export function loadInlineScript() {
  const stub = makeStub();
  const ctx = {
    document: stub,
    navigator: stub,
    location: stub,
    history: stub,
    IntersectionObserver: stub,
    MutationObserver: stub,
    matchMedia: stub,
    requestAnimationFrame: stub,
    getComputedStyle: stub,
    fetch: stub,
    alert: stub,
    confirm: () => false,
    localStorage: makeLocalStorage(),
    sessionStorage: makeLocalStorage(),
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    console,
    scrollY: 0,
    innerHeight: 800,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = extractMainScript() + `\n;globalThis.__finTest = { ${EXPORT_NAMES.join(', ')} };`;
  vm.runInContext(src, ctx, { filename: 'index.html#main-script' });
  return ctx.__finTest;
}
