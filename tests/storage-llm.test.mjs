// 保護：
//  (1) 錯題重練 QuizReview 寫入 localStorage 'fin/quiz-review' 的資料格式與增刪規則（格式變了舊資料會讀不回來）
//  (2) LLM 助教（使用者自備 Gemini key）的請求組裝與錯誤處理——fetch 一律以假物件 stub，
//      key 用明顯的假字串，絕不發出真實網路請求、不讀任何真實 key。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './helpers/load-script.mjs';

const FAKE_KEY = 'fake-test-key/not real&x=1';

describe('QuizReview（fin/quiz-review）', () => {
  const q = { q: '虛構題：毛利率的分母是？', opts: ['營收', '成本', '資產', '權益'], correct: 0, explain: '毛利 ÷ 營收' };
  test('答錯：以 章節:題號:題幹雜湊 為 id 寫入完整紀錄', () => {
    const { api, localStorage } = loadApp();
    api.QuizReview.record('ch2', '損益表', 3, q, 2);
    const bank = JSON.parse(localStorage.getItem('fin/quiz-review'));
    const [id] = Object.keys(bank);
    assert.match(id, /^ch2:3:\d+$/);
    assert.equal(id, api.QuizReview.id('ch2', 3, q), 'id 需可重現（同題同 id）');
    const r = bank[id];
    assert.deepEqual(Object.keys(r).sort(), ['chapterId', 'chapterTitle', 'correct', 'explain', 'firstMissedAt', 'id', 'idx', 'lastAnswer', 'lastMissedAt', 'misses', 'opts', 'q'].sort());
    assert.equal(r.misses, 1);
    assert.equal(r.lastAnswer, 2);
  });
  test('同題再答錯：misses 累加、firstMissedAt 保留、lastAnswer 更新', () => {
    const { api, localStorage } = loadApp();
    const id = api.QuizReview.id('ch2', 3, q);
    localStorage.setItem('fin/quiz-review', JSON.stringify({ [id]: { misses: 4, firstMissedAt: 1000 } }));
    api.QuizReview.record('ch2', '損益表', 3, q, 1);
    const r = JSON.parse(localStorage.getItem('fin/quiz-review'))[id];
    assert.equal(r.misses, 5);
    assert.equal(r.firstMissedAt, 1000);
    assert.equal(r.lastAnswer, 1);
    assert.ok(r.lastMissedAt >= r.firstMissedAt);
  });
  test('答對：從錯題庫移除；本來就不在錯題庫則不寫入任何東西', () => {
    const { api, localStorage } = loadApp();
    api.QuizReview.record('ch2', '損益表', 3, q, 1);
    api.QuizReview.record('ch2', '損益表', 3, q, 0);
    assert.deepEqual(JSON.parse(localStorage.getItem('fin/quiz-review')), {});
    const fresh = loadApp();
    fresh.api.QuizReview.record('ch2', '損益表', 3, q, 0);
    assert.equal(fresh.localStorage.getItem('fin/quiz-review'), null);
  });
  test('題幹不同 → id 不同；同題幹不同題號 → id 不同', () => {
    const { api } = loadApp();
    assert.notEqual(api.QuizReview.id('ch2', 3, q), api.QuizReview.id('ch2', 3, { ...q, q: q.q + '？' }));
    assert.notEqual(api.QuizReview.id('ch2', 3, q), api.QuizReview.id('ch2', 4, q));
    assert.match(api.QuizReview.id('', 0, {}), /^quiz:0:0$/, '缺章節與題幹時有預設值');
  });
  test('items() 依最近答錯時間由新到舊排序；clear(id) 刪單題、clear() 全刪', () => {
    const { api, localStorage } = loadApp();
    localStorage.setItem('fin/quiz-review', JSON.stringify({ a: { id: 'a', lastMissedAt: 1 }, b: { id: 'b', lastMissedAt: 3 }, c: { id: 'c', lastMissedAt: 2 } }));
    assert.deepEqual(api.QuizReview.items().map(x => x.id), ['b', 'c', 'a']);
    api.QuizReview.clear('c');
    assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem('fin/quiz-review'))).sort(), ['a', 'b']);
    api.QuizReview.clear();
    assert.deepEqual(JSON.parse(localStorage.getItem('fin/quiz-review')), {});
  });
  test('錯題庫資料損毀時 load() 回傳空物件，不丟例外', () => {
    const { api } = loadApp({ storage: { 'fin/quiz-review': 'not json' } });
    assert.deepEqual({ ...api.QuizReview.load() }, {});
    assert.deepEqual([...api.QuizReview.items()], []);
  });
  test('localStorage key 名稱維持不變（改名會讓既有使用者的資料遺失）', () => {
    const { api } = loadApp();
    assert.deepEqual([api.STORAGE_KEY, api.VISITED_KEY, api.BOOKMARK_KEY, api.COMPLETED_KEY, api.COMPLETED_TS_KEY, api.QUIZ_REVIEW_KEY],
      ['fin/state', 'fin/visited', 'fin/bookmark', 'fin/completed', 'fin/completed-ts', 'fin/quiz-review']);
    assert.equal(api.LLMAssistant.KEY_STORE, 'fin/gemini-key');
    assert.equal(api.LLMAssistant.HISTORY_STORE, 'fin/chat-history');
    assert.equal(api.LearningPathBuilder.PLAN_KEY, 'fin/learning-plan');
  });
});

describe('LLM 助教（fetch 全程 stub）', () => {
  function withStub(response, storage = {}) {
    const app = loadApp({ storage: { 'fin/gemini-key': FAKE_KEY, ...storage } });
    const calls = [];
    app.ctx.fetch = async (url, init) => { calls.push({ url, init }); return response; };
    return { ...app, calls };
  }
  const okResponse = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }), text: async () => '' });

  test('沒有 key：ask() 直接丟「未設定 API key」，完全不呼叫 fetch', async () => {
    const app = loadApp();
    await assert.rejects(app.api.LLMAssistant.ask('問題', false), /未設定 API key/);
    assert.equal(app.fetchCalls.length, 0);
  });
  test('有 key：只呼叫一次 Gemini generateContent，key 經 encodeURIComponent，方法為 POST JSON', async () => {
    const app = withStub(okResponse('回答'));
    const reply = await app.api.LLMAssistant.ask('毛利率是什麼？', false);
    assert.equal(reply, '回答');
    assert.equal(app.calls.length, 1);
    const { url, init } = app.calls[0];
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(FAKE_KEY)}`);
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Type'], 'application/json');
    const body = JSON.parse(init.body);
    assert.equal(body.contents.at(-1).role, 'user');
    assert.equal(body.contents.at(-1).parts[0].text, '毛利率是什麼？');
    assert.match(body.systemInstruction.parts[0].text, /繁體中文/);
    assert.equal(body.generationConfig.maxOutputTokens, 1500);
  });
  test('歷史訊息：排除最後一組（剛送出的問題＋佔位），並濾掉「思考中」佔位；assistant 角色轉為 model', async () => {
    const history = [
      { role: 'user', content: '舊問' }, { role: 'assistant', content: '舊答' },
      { role: 'assistant', content: '⏳ 思考中...' },
      { role: 'user', content: '新問' }, { role: 'assistant', content: '⏳ 思考中...' }
    ];
    const app = withStub(okResponse('x'), { 'fin/chat-history': JSON.stringify(history) });
    await app.api.LLMAssistant.ask('新問', false);
    const body = JSON.parse(app.calls[0].init.body);
    assert.deepEqual(body.contents.map(c => [c.role, c.parts[0].text]), [['user', '舊問'], ['model', '舊答'], ['user', '新問']]);
  });
  test('API 錯誤：訊息含狀態碼與 error.message；非 JSON 錯誤內容截斷 200 字', async () => {
    const bad = withStub({ ok: false, status: 400, text: async () => JSON.stringify({ error: { message: 'API key not valid' } }) });
    await assert.rejects(bad.api.LLMAssistant.ask('q', false), /^Error: API 400: API key not valid$/);
    const raw = withStub({ ok: false, status: 503, text: async () => 'x'.repeat(500) });
    await assert.rejects(raw.api.LLMAssistant.ask('q', false), err => err.message === 'API 503: ' + 'x'.repeat(200));
  });
  test('回應沒有候選內容時回傳「（無回應）」', async () => {
    const app = withStub({ ok: true, status: 200, json: async () => ({}) });
    assert.equal(await app.api.LLMAssistant.ask('q', false), '（無回應）');
  });
  test('對話歷史只保留最後 30 則', () => {
    const app = loadApp();
    app.api.LLMAssistant.saveHistory(Array.from({ length: 45 }, (_, i) => ({ role: 'user', content: String(i) })));
    const h = JSON.parse(app.localStorage.getItem('fin/chat-history'));
    assert.equal(h.length, 30);
    assert.equal(h[0].content, '15');
  });
  test('formatReply：先跳脫 HTML，再把 [ChN] 轉成章節連結、**粗體**、`程式碼`', () => {
    const { api } = loadApp();
    const out = api.LLMAssistant.formatReply('<img src=x> 見 [Ch14]，**重點** 與 `ROE`');
    assert.ok(out.startsWith('&lt;img src=x&gt;'));
    assert.match(out, /<a href="#ch14"[^>]*>Ch14<\/a>/);
    assert.match(out, /<strong>重點<\/strong>/);
    assert.match(out, /<code>ROE<\/code>/);
  });
  test('原始碼不含任何硬編碼 key；loadKey 只讀 localStorage', () => {
    const { api } = loadApp({ storage: { 'fin/gemini-key': FAKE_KEY } });
    assert.equal(api.LLMAssistant.loadKey(), FAKE_KEY);
    assert.equal(loadApp().api.LLMAssistant.loadKey(), '');
  });
});
