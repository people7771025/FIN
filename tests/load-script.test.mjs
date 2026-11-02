// 保護：測試基礎建設本身可靠——主 script 能在沙箱載入、不會發網路請求、抽出函式與 vm 版本一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadApp, extractScripts, extractMainScript, extractDeclaration, pickFunctions, createBody, readStats } from './helpers/load-script.mjs';

test('index.html 所有 inline <script> 都能被 JS parser 接受（語法檢查）', () => {
  const scripts = extractScripts().filter(s => !/\bsrc=/.test(s.attrs) && !/type="application\/(ld\+)?json"/.test(s.attrs));
  assert.ok(scripts.length >= 2, '至少有主程式與 V2 題庫兩段 inline script');
  for (const s of scripts) {
    assert.doesNotThrow(() => new vm.Script(s.code, { filename: `index.html:${s.line}` }), `第 ${s.line} 行的 <script> 語法錯誤`);
  }
});

test('主 script 可在 vm 沙箱載入，頂層初始化不丟例外、不寫 console.error、不呼叫 fetch', () => {
  const app = loadApp();
  for (const name of ['fmt', 'pctf', 'clamp', 'scaleY', 'svgChart', 'linePath', 'RatioCalculator', 'DividendSimulator', 'DuPontDecomposer', 'MarginWaterfall', 'TrendVisualizer', 'PEBands']) {
    assert.ok(app.api[name] != null, `${name} 應可取得`);
  }
  assert.deepEqual(app.consoleErrors, []);
  assert.equal(app.fetchCalls.length, 0);
});

test('載入時在 window 只註冊 DOMContentLoaded 與 scroll 事件，觸發 DOMContentLoaded 後 hydrate 不丟例外', () => {
  const app = loadApp();
  assert.equal(app.listeners.DOMContentLoaded?.length, 1);
  assert.equal(app.listeners.scroll?.length, 1);
  assert.deepEqual(Object.keys(app.listeners).sort(), ['DOMContentLoaded', 'scroll']);
  assert.doesNotThrow(() => app.listeners.DOMContentLoaded[0]());
  assert.deepEqual(app.consoleErrors, []);
  assert.equal(app.fetchCalls.length, 0, 'DOMContentLoaded 流程不應有任何網路請求');
});

test('每次 loadApp() 的 localStorage 互相隔離，且預設為空（不會讀到任何真實資料）', () => {
  const a = loadApp(), b = loadApp();
  a.localStorage.setItem('fin/state', '{"theme":"dark"}');
  assert.equal(b.localStorage.getItem('fin/state'), null);
  // 載入流程本身（initTheme 等）不應寫入任何 key
  assert.equal(loadApp().localStorage.length, 0);
});

test('extractDeclaration 以括號配對抽出完整宣告（含樣板字面值中的 ${}）', () => {
  const src = extractMainScript();
  const code = extractDeclaration(src, 'svgChart');
  assert.match(code, /^function svgChart\(w, h, inner\) \{/);
  assert.match(code, /\}$/);
  const obj = extractDeclaration(src, 'RatioCalculator');
  assert.match(obj, /^const RatioCalculator = \{/);
  assert.match(obj, /\};$/);
  assert.throws(() => extractDeclaration(src, 'NoSuchFunction__'), /找不到宣告/);
});

test('字串抽出版（new Function）與 vm 載入版的格式化函式行為一致', () => {
  const { api } = loadApp();
  const f = pickFunctions(['fmt', 'pctf', 'clamp', 'scaleY']);
  const samples = [0, 1, -1, 3.14159, 1234567.891, -0.5, 1e9, NaN, Infinity, null, undefined];
  for (const v of samples) {
    assert.equal(f.fmt(v, 2), api.fmt(v, 2), `fmt(${v})`);
    if (v != null) assert.equal(f.pctf(v), api.pctf(v), `pctf(${v})`);
  }
  assert.equal(f.scaleY(5, 0, 10, 0, 100), api.scaleY(5, 0, 10, 0, 100));
});

test('createBody 假元素：輸入事件會觸發重新渲染', () => {
  const { api } = loadApp();
  const body = createBody();
  api.RatioCalculator.render(body, { ...api.RatioCalculator.defaults });
  assert.equal(body.querySelectorAll('.ctrl-num').length, 10);
  body.type('rev', '2000');
  assert.equal(readStats(body.innerHTML)['毛利率'], '22.5%');
  assert.equal(body.querySelector('.ctrl-num[data-k="rev"]').value, '2000');
});

test('extractDeclaration 可正確抽出含正規式、樣板字面值的大型宣告，且每段都能獨立通過語法檢查', () => {
  const src = extractMainScript();
  const names = ['fmt', 'pctf', 'clamp', 'esc', 'scaleY', 'svgChart', 'linePath', 'chapterLabel', 'hydrateAll',
    'LearningPathBuilder', 'QuizReview', 'Quiz', 'DuPontDecomposer', 'RatioCalculator', 'MarginWaterfall', 'TrendVisualizer',
    'PEBands', 'DividendSimulator', 'EarningsQuality', 'RedFlagScanner', 'IndustryMetricPicker', 'CompanyCompare', 'WorksheetTool', 'LLMAssistant'];
  for (const n of names) {
    const code = extractDeclaration(src, n);
    assert.doesNotThrow(() => new vm.Script(code), n);
  }
  // esc 內含 /'/g 正規式：不得被誤當成字串開頭
  assert.match(extractDeclaration(src, 'esc'), /&#39;'\); \}$/);
});
