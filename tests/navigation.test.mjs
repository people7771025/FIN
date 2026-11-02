// 保護：章節連結（側欄目錄、上一章／下一章、內文 <a href="#chN">、LLM 回覆中的 [ChN]）能把頁面捲到對應章節。
// 章節是 <section data-chapter="chN">，沒有 id="chN"，因此瀏覽器原生錨點跳轉不會生效，
// 必須由 script 攔截點擊並捲動。這裡在 vm 沙箱中模擬一次點擊。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readIndex } from './helpers/load-script.mjs';

function setup() {
  const app = loadApp();
  const sec = { dataset: { chapter: 'ch10' }, getBoundingClientRect: () => ({ top: 5000 }) };
  app.ctx.document.querySelector = sel => (sel === 'section[data-chapter="ch10"]' ? sec : null);
  app.ctx.document.getElementById = () => null;
  app.ctx.history = { replaceState() {} };
  const anchor = href => ({ getAttribute: k => (k === 'href' ? href : null) });
  const click = href => {
    const ev = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, target: { closest: sel => (/a\[href/.test(sel) ? anchor(href) : null) } };
    (app.docListeners.click || []).forEach(f => f(ev));
    app.listeners.DOMContentLoaded?.forEach(() => {});
    return ev;
  };
  return { app, click };
}

test('前提：章節 section 沒有 id，所以需要 script 處理 #chN 連結', () => {
  const html = readIndex();
  assert.doesNotMatch(html, /<section\b[^>]*\sid="ch\d+"/);
  assert.match(html, /<a class="nav-item" href="#ch10">/);
});

test.todo('疑似 bug：點擊 href="#ch10" 應捲到 ch10 章節（目前沒有任何處理，點了不會跳）', () => {
  const { app, click } = setup();
  const ev = click('#ch10');
  assert.equal(ev.defaultPrevented, true);
  assert.equal(app.scrollCalls.length, 1);
});
