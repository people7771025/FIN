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

test('修正：點擊 href="#ch10" 會阻止預設行為並捲到 ch10 章節（scrollY + top − 50）', () => {
  const { app, click } = setup();
  const ev = click('#ch10');
  assert.equal(ev.defaultPrevented, true);
  assert.equal(app.scrollCalls.length, 1);
  assert.equal(app.scrollCalls[0].top, 4950);
});

test('不是章節的錨點（例如 #glossary-search 這類真正的 id）不攔截，交給瀏覽器原生處理', () => {
  const { app, click } = setup();
  app.ctx.document.getElementById = id => (id === 'ch10' ? {} : null);
  assert.equal(click('#ch10').defaultPrevented, false, '目標若已有 id，交給原生錨點');
  assert.equal(click('#no-such-chapter').defaultPrevented, false);
  assert.equal(app.scrollCalls.length, 0);
});

test('外部連結與非錨點點擊不受影響', () => {
  const { app } = setup();
  const ev = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, target: { closest: () => null } };
  app.docListeners.click.forEach(f => f(ev));
  assert.equal(ev.defaultPrevented, false);
  assert.equal(app.scrollCalls.length, 0);
});

test('Ctrl／Cmd／Shift + 點擊保留瀏覽器原生行為（開新分頁）', () => {
  const { app } = setup();
  for (const mod of ['ctrlKey', 'metaKey', 'shiftKey']) {
    const ev = { [mod]: true, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, target: { closest: () => ({ getAttribute: () => '#ch10' }) } };
    app.docListeners.click.forEach(f => f(ev));
    assert.equal(ev.defaultPrevented, false, mod);
  }
  assert.equal(app.scrollCalls.length, 0);
});

test('只註冊一個 document click 處理器（重複載入不會疊加）', () => {
  const { app } = setup();
  assert.equal(app.docListeners.click.length, 1);
});
