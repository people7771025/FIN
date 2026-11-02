// 保護：v2.js（段落內嵌練習 + 間隔複習，FIN 版）的行為：
// localStorage key 命名、Leitner 盒子升降與到期時間、到期題目的挑選與排序、題卡組成、作答回饋、
// 統計文字、HTML 跳脫、壞掉的儲存資料容錯。只測 FIN repo 內這份 v2.js；不改 v2.js。
// 題目全部是測試內的虛構假題，不使用頁面題庫。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT, createLocalStorage } from './helpers/load-script.mjs';

const V2_SRC = fs.readFileSync(path.join(ROOT, 'v2.js'), 'utf8');
const DAY = 864e5;

/* ---------- 極簡 DOM ---------- */
class El {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.dataset = { ...(attrs.dataset || {}) };
    this.className = attrs.className || '';
    this.children = [];
    this.parent = null;
    this.disabled = false;
    this.handlers = {};
    this._html = '';
    this.textContent = '';
    this.classList = {
      add: c => { if (!this.className.split(' ').includes(c)) this.className = (this.className + ' ' + c).trim(); },
      contains: c => this.className.split(' ').includes(c)
    };
  }
  get innerHTML() { return this._html + this.children.map(c => c.outerHTML).join(''); }
  set innerHTML(v) {
    this._html = String(v);
    this.children = [];
    // 解析 v2.js 會產生的兩種可互動按鈕
    for (const m of this._html.matchAll(/<button class="(v2-opt|v2-redo)"(?: data-k="([^"]*)")?>/g)) {
      const b = new El('button', { className: m[1], dataset: m[2] != null ? { k: m[2] } : {} });
      b.parent = this; b.virtual = true;
      this.children.push(b);
    }
  }
  get outerHTML() { return this.virtual ? '' : `<${this.tagName.toLowerCase()} class="${this.className}">${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  replaceWith(n) { const p = this.parent; const i = p.children.indexOf(this); n.parent = p; p.children[i] = n; }
  addEventListener(t, f) { (this.handlers[t] ||= []).push(f); }
  setAttribute(k, v) { this[k] = v; }
  matches(sel) { return sel.startsWith('.') && this.classList.contains(sel.slice(1)); }
  closest(sel) { let n = this; while (n) { if (n.matches(sel)) return n; n = n.parent; } return null; }
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelectorAll(sel) { return this.all().filter(n => n.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  click() {
    // 事件冒泡：從自己往上找 click handler
    let n = this; const ev = { target: this };
    while (n) { (n.handlers.click || []).forEach(f => f(ev)); n = n.parent; }
    if (this.onclick) this.onclick(ev);
  }
}

function run({ V2, slots = [], storage = {}, now = Date.UTC(2026, 10, 2, 4, 0, 0), withStats = true, withBookmark = true }) {
  const localStorage = createLocalStorage(storage);
  const slotEls = slots.map(s => new El('div', { className: 'v2-quiz', dataset: s }));
  const stats = new El('div');
  const bookmark = new El('button');
  let bookmarkClicks = 0; bookmark.click = () => { bookmarkClicks++; };
  const body = new El('body');
  const document = {
    querySelectorAll: sel => (sel === '.v2-quiz' ? slotEls : []),
    getElementById: id => (id === 'v2-stats' ? (withStats ? stats : null) : id === 'set-bookmark-btn' ? (withBookmark ? bookmark : null) : null),
    createElement: tag => new El(tag),
    body
  };
  class FakeDate extends Date { static now() { return clock.now; } }
  const clock = { now };
  const ctx = vm.createContext({ window: { V2 }, document, localStorage, JSON, Object, Math, Set, String, Date: FakeDate });
  vm.runInContext(V2_SRC, ctx, { filename: 'v2.js' });
  return { slotEls, stats, body, localStorage, clock, bookmarkClicks: () => bookmarkClicks };
}

// 疑似 bug：v2.js 把每段「自己的題目」也加進 used，而 dueReviews 會排除 used，
// 於是前面段落的題目永遠不會被穿插複習（Chromium 實測：6 題到期、側欄寫「待複習 6 題」，全頁 0 張複習卡）。
// 以下 5 個測試描述預期行為，修正前標為 todo。
const reviewTest = test.todo;

const Q = (id, chapter, extra = {}) => ({ id, chapter, question: `假題 ${id}？`, options: { A: '甲', B: '乙', C: '丙', D: '丁' }, answer: 'B', explanation: `解析 ${id}`, ...extra });
const bank = ids => Object.fromEntries(ids.map(([id, ch]) => [id, Q(id, ch)]));
const opts = card => card.querySelectorAll('.v2-opt');
const answer = (slot, qi, key) => opts(slot.children[0].querySelectorAll('.v2-q')[qi]).find(b => b.dataset.k === key).click();

describe('localStorage key 與載入容錯', () => {
  const V2 = { subj: 'fin', mode: 'public', q: bank([['x1', 'ch1']]) };
  test('公開版 key 為 fin/v2-srs，作答後寫入', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'B');
    assert.deepEqual(Object.keys(r.localStorage._dump()), ['fin/v2-srs']);
  });
  test('私人版（mode=private）key 為 fin/v2-srs-private，與公開版隔離', () => {
    const r = run({ V2: { ...V2, mode: 'private' }, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'B');
    assert.deepEqual(Object.keys(r.localStorage._dump()), ['fin/v2-srs-private']);
  });
  test('沒有 window.V2 時整支 script 不做任何事、不丟例外', () => {
    const r = run({ V2: undefined, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    assert.equal(r.slotEls[0].children.length, 0);
    assert.equal(r.localStorage.length, 0);
  });
  test('儲存資料損毀（非 JSON）時視為空紀錄，不丟例外', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }], storage: { 'fin/v2-srs': '{壞掉' } });
    assert.match(r.stats.innerHTML, /已做 <b>0<\/b>\/1 題/);
  });
  test('儲存值為 JSON null 時也視為空紀錄', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }], storage: { 'fin/v2-srs': 'null' } });
    assert.match(r.stats.innerHTML, /已做 <b>0<\/b>/);
  });
});

describe('Leitner 盒子：作答紀錄', () => {
  const V2 = { subj: 'fin', mode: 'public', q: bank([['x1', 'ch1']]) };
  const rec = r => JSON.parse(r.localStorage.getItem('fin/v2-srs')).x1;
  test('第一次答對：box 0→1，到期 = 現在 + 1 天，n=1、c=1', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'B');
    const x = rec(r);
    assert.deepEqual([x.box, x.n, x.c], [1, 1, 1]);
    assert.equal(x.due - x.last, 1 * DAY);
  });
  test('答錯：box 重設為 1，到期 = 現在 + 10 分鐘，n 增加、c 不增加', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }], storage: { 'fin/v2-srs': JSON.stringify({ x1: { box: 4, n: 4, c: 4, due: 0 } }) } });
    answer(r.slotEls[0], 0, 'A');
    const x = rec(r);
    assert.deepEqual([x.box, x.n, x.c], [1, 5, 4]);
    assert.equal(x.due - x.last, 10 * 60e3);
  });
  test('連續答對的間隔依序為 1、3、7、14、30、60 天，之後封頂 60 天（box 最多 6）', () => {
    const expected = [1, 3, 7, 14, 30, 60, 60, 60];
    let storage = {};
    expected.forEach((days, i) => {
      const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }], storage });
      answer(r.slotEls[0], 0, 'B');
      const x = rec(r);
      assert.equal((x.due - x.last) / DAY, days, `第 ${i + 1} 次答對`);
      assert.ok(x.box <= 6);
      storage = r.localStorage._dump();
    });
  });
  test('重做按鈕：換回未作答的新題卡，再答一次會再記一筆（n 累加）', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'A');
    r.slotEls[0].children[0].querySelector('.v2-redo').click();
    const q = r.slotEls[0].children[0].querySelectorAll('.v2-q')[0];
    assert.ok(opts(q).every(b => !b.disabled), '重做後選項應可再點');
    answer(r.slotEls[0], 0, 'B');
    assert.equal(rec(r).n, 2);
    assert.equal(rec(r).c, 1);
  });
  test('作答後選項全部停用；再點已停用的選項不會重複記錄（冪等）', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'B');
    const q = r.slotEls[0].children[0].querySelectorAll('.v2-q')[0];
    assert.ok(opts(q).every(b => b.disabled));
    opts(q)[0].click();
    assert.equal(rec(r).n, 1);
  });
});

describe('作答回饋', () => {
  const V2 = { subj: 'fin', mode: 'public', q: bank([['x1', 'ch1']]) };
  test('答對：正解按鈕加 ok、顯示「✔ 答對」與解析', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'B');
    const q = r.slotEls[0].children[0].querySelectorAll('.v2-q')[0];
    assert.ok(opts(q).find(b => b.dataset.k === 'B').classList.contains('ok'));
    assert.match(q.innerHTML, /✔ 答對<\/span>　解析 x1/);
  });
  test('答錯：所選按鈕加 bad、正解加 ok、顯示「✘ 答錯，正解 B」', () => {
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'D');
    const q = r.slotEls[0].children[0].querySelectorAll('.v2-q')[0];
    assert.ok(opts(q).find(b => b.dataset.k === 'D').classList.contains('bad'));
    assert.ok(opts(q).find(b => b.dataset.k === 'B').classList.contains('ok'));
    assert.match(q.innerHTML, /✘ 答錯，正解 B/);
  });
  test('題幹、選項、解析中的 HTML 會被跳脫（不會注入標籤）', () => {
    const evil = { x1: Q('x1', 'ch1', { question: '<img src=x onerror=alert(1)>', options: { A: '<b>甲</b>', B: '"乙"' }, explanation: '<script>x</script>' }) };
    const r = run({ V2: { subj: 'fin', mode: 'public', q: evil }, slots: [{ chapter: 'ch1', qids: 'x1' }] });
    answer(r.slotEls[0], 0, 'A');
    const html = r.slotEls[0].innerHTML;
    assert.doesNotMatch(html, /<img|<b>甲|<script>/);
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /&quot;乙&quot;/);
  });
});

describe('題卡組成與到期複習', () => {
  test('同章兩個段落：前段標「本段練習」、最後一段標「章末練習」；題目不存在於題庫者略過', () => {
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1'], ['b', 'ch1']]) };
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'a,ghost' }, { chapter: 'ch1', qids: 'b' }] });
    assert.match(r.slotEls[0].children[0]._html, /本段練習.*1 題本段/);
    assert.match(r.slotEls[1].children[0]._html, /章末練習.*1 題本段/);
  });
  test('沒有自己題目也沒到期複習的中段 → 不產生題卡', () => {
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1']]) };
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: '' }, { chapter: 'ch1', qids: 'a' }] });
    assert.equal(r.slotEls[0].children.length, 0);
  });
  reviewTest('只穿插「前面段落」且已到期的題目；未到期、未作答、後面段落的題目都不出現', () => {
    const now = Date.UTC(2026, 10, 2);
    const V2 = { subj: 'fin', mode: 'public', q: bank([['p1', 'ch1'], ['p2', 'ch1'], ['p3', 'ch1'], ['c1', 'ch2'], ['later', 'ch3']]) };
    const storage = { 'fin/v2-srs': JSON.stringify({
      p1: { box: 1, n: 1, c: 0, due: now - 1 },   // 到期
      p2: { box: 2, n: 2, c: 2, due: now + DAY }, // 未到期
      later: { box: 1, n: 1, c: 0, due: now - 1 } // 到期但在後面段落
    }) };
    const r = run({ V2, now, storage, slots: [{ chapter: 'ch1', qids: 'p1,p2,p3' }, { chapter: 'ch2', qids: 'c1' }, { chapter: 'ch3', qids: 'later' }] });
    const ids = r.slotEls[1].children[0].querySelectorAll('.v2-q').map(q => q.dataset.id);
    assert.deepEqual(ids, ['c1', 'p1']);
    assert.match(r.slotEls[1].children[0]._html, /1 題本段 · 1 題複習/);
    assert.match(r.slotEls[1].children[0].querySelectorAll('.v2-q')[1]._html, /<span class="v2-rv">複習<\/span>/);
  });
  reviewTest('複習排序：box 小的優先，同 box 依到期時間早者優先；數量上限 = min(2, ceil(本段題數/2))', () => {
    const now = Date.UTC(2026, 10, 2);
    const V2 = { subj: 'fin', mode: 'public', q: bank([['r1', 'ch1'], ['r2', 'ch1'], ['r3', 'ch1'], ['n1', 'ch2'], ['n2', 'ch2'], ['n3', 'ch2']]) };
    const storage = { 'fin/v2-srs': JSON.stringify({
      r1: { box: 3, n: 1, c: 1, due: now - 3 },
      r2: { box: 1, n: 1, c: 0, due: now - 1 },
      r3: { box: 1, n: 1, c: 0, due: now - 2 }
    }) };
    const r = run({ V2, now, storage, slots: [{ chapter: 'ch1', qids: 'r1,r2,r3' }, { chapter: 'ch2', qids: 'n1,n2,n3' }] });
    const ids = r.slotEls[1].children[0].querySelectorAll('.v2-q').map(q => q.dataset.id);
    assert.deepEqual(ids, ['n1', 'n2', 'n3', 'r3', 'r2']);
  });
  reviewTest('章末沒有自己題目時，最多穿插 3 題複習並標「章末複習」', () => {
    const now = Date.UTC(2026, 10, 2);
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1'], ['b', 'ch1'], ['c', 'ch1'], ['d', 'ch1']]) };
    const old = Object.fromEntries(['a', 'b', 'c', 'd'].map((k, i) => [k, { box: 1, n: 1, c: 0, due: now - 10 + i }]));
    const r = run({ V2, now, storage: { 'fin/v2-srs': JSON.stringify(old) }, slots: [{ chapter: 'ch1', qids: 'a,b,c,d' }, { chapter: 'ch2', qids: '' }] });
    const card = r.slotEls[1].children[0];
    assert.match(card._html, /章末複習/);
    assert.deepEqual(card.querySelectorAll('.v2-q').map(q => q.dataset.id), ['a', 'b', 'c']);
  });
  reviewTest('同一題在同一次載入中不會被重複穿插到兩個段落', () => {
    const now = Date.UTC(2026, 10, 2);
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1'], ['x', 'ch2'], ['y', 'ch3']]) };
    const r = run({ V2, now, storage: { 'fin/v2-srs': JSON.stringify({ a: { box: 1, n: 1, c: 0, due: 0 } }) }, slots: [{ chapter: 'ch1', qids: 'a' }, { chapter: 'ch2', qids: 'x' }, { chapter: 'ch3', qids: 'y' }] });
    const reviews = r.slotEls.flatMap(s => s.children[0]?.querySelectorAll('.v2-q').filter(q => /v2-rv/.test(q._html)).map(q => q.dataset.id) || []);
    assert.deepEqual(reviews, ['a'], '到期題只在後面第一個有空位的段落穿插一次');
  });
  reviewTest('到期判斷是「due ≤ 現在」：剛好到期算到期', () => {
    const now = Date.UTC(2026, 10, 2);
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1'], ['x', 'ch2']]) };
    const r = run({ V2, now, storage: { 'fin/v2-srs': JSON.stringify({ a: { box: 1, n: 1, c: 0, due: now } }) }, slots: [{ chapter: 'ch1', qids: 'a' }, { chapter: 'ch2', qids: 'x' }] });
    assert.deepEqual(r.slotEls[1].children[0].querySelectorAll('.v2-q').map(q => q.dataset.id), ['x', 'a']);
  });
});

describe('側欄統計與手機圖釘', () => {
  test('統計：已做題數／總題數、正確率（四捨五入）、待複習數', () => {
    const now = Date.UTC(2026, 10, 2);
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1'], ['b', 'ch1'], ['c', 'ch1']]) };
    const storage = { 'fin/v2-srs': JSON.stringify({ a: { box: 1, n: 3, c: 2, due: now - 1 }, b: { box: 2, n: 3, c: 3, due: now + DAY } }) };
    const r = run({ V2, now, storage, slots: [{ chapter: 'ch1', qids: 'a,b,c' }] });
    assert.match(r.stats.innerHTML, /已做 <b>2<\/b>\/3 題 · 正確率 <b>83%<\/b>/); // 5/6 = 83.3%
    assert.match(r.stats.innerHTML, /待複習 <b>1<\/b> 題/);
  });
  test('作答後統計即時更新', () => {
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1']]) };
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'a' }] });
    answer(r.slotEls[0], 0, 'C');
    assert.match(r.stats.innerHTML, /已做 <b>1<\/b>\/1 題 · 正確率 <b>0%<\/b>/);
  });
  test('題庫中已刪除的題目紀錄不計入統計分母', () => {
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1']]) };
    const r = run({ V2, slots: [{ chapter: 'ch1', qids: 'a' }], storage: { 'fin/v2-srs': JSON.stringify({ gone: { box: 1, n: 9, c: 0, due: 0 } }) } });
    assert.match(r.stats.innerHTML, /已做 <b>0<\/b>\/1 題 · 正確率 <b>0%<\/b>/);
  });
  test('沒有 #v2-stats 元素時不丟例外', () => {
    const V2 = { subj: 'fin', mode: 'public', q: bank([['a', 'ch1']]) };
    assert.doesNotThrow(() => run({ V2, withStats: false, slots: [{ chapter: 'ch1', qids: 'a' }] }));
  });
  test('有「標記」按鈕時建立 📍 浮動按鈕，點擊等同按原本的標記按鈕；沒有時不建立', () => {
    const V2 = { subj: 'fin', mode: 'public', q: {} };
    const r = run({ V2 });
    const fab = r.body.children.find(c => c.className === 'v2-fab');
    assert.ok(fab);
    assert.equal(fab.textContent, '📍');
    fab.onclick();
    assert.equal(r.bookmarkClicks(), 1);
    assert.equal(run({ V2, withBookmark: false }).body.children.length, 0);
  });
});

describe('與 index.html 的 window.V2 設定相容', () => {
  test('頁面 V2 設定 subj=fin、mode=public（決定 localStorage key 為 fin/v2-srs）', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.match(html, /<script>window\.V2=\{subj:"fin",mode:"public",/);
    assert.match(html, /<script src="\.\/v2\.js"><\/script>/);
    // v2.js 必須在 V2 設定之後載入
    assert.ok(html.indexOf('window.V2=') < html.indexOf('src="./v2.js"'));
  });
  test('v2.js 不發任何網路請求、不使用 eval', () => {
    assert.doesNotMatch(V2_SRC, /fetch\(|XMLHttpRequest|eval\(|new Function/);
  });
});
