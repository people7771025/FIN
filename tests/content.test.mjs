// 保護：index.html 的靜態內容一致性（不執行頁面，只解析 HTML 字串）。
// ① 錨點與「見 ChXX」引用都能對到目標、id 不重複
// ② 滑桿與配對數字框屬性一致、數字框 step 合法
// ③ Quiz（章末 data-questions 與 V2 段落題庫）可解析、答案合法、有解析、不重複
// ④ 標籤閉合、<details> 平衡
// ⑤ 章節數、Part 數、元件數與頁面文字宣稱一致
// ⑥ 沒有外部資源請求；唯一的網路呼叫是使用者自備 key 的 Gemini API（白名單）
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readIndex, extractScripts, extractMainScript } from './helpers/load-script.mjs';

const html = readIndex();
const scripts = extractScripts(html);
// 去掉 <script>／<style> 的「靜態 HTML」：JS 樣板裡的 ${...} 不算
const staticHtml = html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
const mainJs = extractMainScript(html);
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const sections = [...staticHtml.matchAll(/<section\b[^>]*data-chapter="([^"]+)"[^>]*>/g)].map(m => m[1]);
const sectionSet = new Set(sections);
const ids = [...staticHtml.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const V2 = (() => {
  const s = scripts.find(x => /^\s*window\.V2\s*=/.test(x.code));
  const ctx = {};
  new Function('window', s.code)(ctx);
  return ctx.V2;
})();
const lineOf = idx => html.slice(0, idx).split('\n').length;

describe('① 錨點與章節引用', () => {
  test('靜態 HTML 的 id 不重複', () => {
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    assert.deepEqual(dup, []);
  });
  test('section[data-chapter] 不重複', () => {
    assert.equal(sectionSet.size, sections.length);
  });
  test('每個 href="#..." 都對到既有 id 或章節（section[data-chapter]）', () => {
    const missing = [];
    for (const m of staticHtml.matchAll(/href="#([^"]*)"/g)) {
      if (!ids.includes(m[1]) && !sectionSet.has(m[1])) missing.push(m[1]);
    }
    assert.deepEqual([...new Set(missing)], []);
  });
  test('沒有空錨點 href="#"', () => assert.doesNotMatch(staticHtml, /href="#"/));
  test('側欄目錄涵蓋所有章節，且順序與 V2.order（由淺入深）一致', () => {
    const nav = [...staticHtml.matchAll(/<a class="nav-item" href="#([^"]+)"/g)].map(m => m[1]);
    for (const s of sections.filter(x => x !== 'intro')) assert.ok(nav.includes(s), `側欄缺 ${s}`); // intro 由頂部品牌連結進入
    const navChapters = nav.filter(x => V2.order.includes(x));
    assert.deepEqual(navChapters, V2.order);
  });
  test('內文「見 ChN／見 Part」等章節引用的 ChN 都存在', () => {
    const refs = [...staticHtml.matchAll(/見[^。<\n]{0,8}?[Cc]h\s*(\d+)/g)].map(m => 'ch' + m[1]);
    assert.ok(refs.length >= 1, '應找到章節引用（防止正規式失效而空轉）');
    for (const r of refs) assert.ok(sectionSet.has(r), `引用 ${r} 不存在`);
  });
  test('連結文字寫「ChN」的 <a href="#chM">，N 必須等於 M（文字與目標一致）', () => {
    let checked = 0;
    for (const m of staticHtml.matchAll(/<a\b[^>]*href="#(ch\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const t = /^\s*(?:<[^>]+>\s*)*[Cc]h\s*(\d+)\b/.exec(m[2]);
      if (!t) continue;
      checked++;
      assert.equal('ch' + t[1], m[1], `連結文字 ${m[2].slice(0, 30)} 指向 #${m[1]}`);
    }
    assert.ok(checked >= 10, `應檢查到多個章節連結（實際 ${checked}）`);
  });
  test('內文任何「ChN」字樣的 N 都在 1–32 範圍（不引用不存在的章）', () => {
    const nums = [...staticHtml.matchAll(/\b[Cc]h(\d+)\b/g)].map(m => Number(m[1]));
    for (const n of nums) assert.ok(sectionSet.has('ch' + n), `Ch${n} 不存在`);
  });
  test('LLM 助教把 [ChN] 轉成 #chN 連結；systemPrompt 提到的章節都存在', () => {
    const prompt = /systemPrompt\(\) \{\s*return `([\s\S]*?)`;/.exec(mainJs)[1];
    const refs = [...prompt.matchAll(/\b(Ch\d+|fin-x\d)\b/g)].map(m => m[1].toLowerCase());
    assert.ok(refs.length >= 30);
    for (const r of refs) assert.ok(sectionSet.has(r), `systemPrompt 提到不存在的 ${r}`);
  });
  test('v2 段落題卡 data-chapter 都對到章節', () => {
    for (const m of staticHtml.matchAll(/class="v2-quiz"[^>]*data-chapter="([^"]+)"/g)) assert.ok(sectionSet.has(m[1]), m[1]);
  });
});

describe('② 輸入元件屬性', () => {
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(m => m[0]);
  const attr = (tag, a) => (new RegExp(`\\s${a}="([^"]*)"`).exec(tag) || [])[1];
  test('滑桿（type=range）若有配對數字框，min／max／step 必須一致（目前頁面無滑桿 → 0 組）', () => {
    const ranges = inputs.filter(t => attr(t, 'type') === 'range');
    for (const r of ranges) {
      const k = attr(r, 'data-k');
      const num = inputs.find(t => attr(t, 'type') === 'number' && attr(t, 'data-k') === k);
      if (!num) continue;
      for (const a of ['min', 'max', 'step']) assert.equal(attr(num, a), attr(r, a), `${k} 的 ${a}`);
    }
    assert.equal(ranges.length, 0, '若新增滑桿，請確認上方配對檢查涵蓋它，再更新此數字');
  });
  test('所有 type=number 輸入框的 step 為正數或 any', () => {
    const nums = inputs.filter(t => attr(t, 'type') === 'number');
    assert.ok(nums.length >= 20);
    for (const t of nums) {
      const step = attr(t, 'step');
      if (step == null || step === 'any') continue;
      if (step.includes('${')) { assert.match(step, /^\$\{[^}]+\? ?[\d.]+ ?: ?[\d.]+\}$/, `動態 step 應為兩個正數之一：${step}`); continue; }
      assert.ok(Number(step) > 0, t);
    }
  });
  test('計算器數字框都有 data-k，且同一元件內 data-k 不重複', () => {
    for (const name of ['RatioCalculator', 'DividendSimulator', 'DuPontDecomposer', 'MarginWaterfall']) {
      const start = mainJs.indexOf(`const ${name} = {`);
      const end = mainJs.indexOf('\n};', start);
      const keys = [...mainJs.slice(start, end).matchAll(/class="ctrl-num" data-k="(\w+)"/g)].map(m => m[1]);
      assert.ok(keys.length >= 4, name);
      assert.equal(new Set(keys).size, keys.length, `${name} data-k 重複`);
    }
  });
});

describe('③ Quiz 資料', () => {
  const blocks = [...html.matchAll(/data-component="quiz" data-questions='([\s\S]*?)'/g)];
  const parsed = blocks.map(m => ({ line: lineOf(m.index), qs: JSON.parse(decode(m[1])) }));
  test('章末測驗共 12 組，全部可被 JSON.parse', () => {
    assert.equal(blocks.length, 12);
    assert.equal(parsed.length, 12);
  });
  test('每題：題幹非空、至少 2 個選項、答案索引為合法整數、解析非空', () => {
    for (const { line, qs } of parsed) {
      assert.ok(Array.isArray(qs) && qs.length > 0, `第 ${line} 行`);
      for (const q of qs) {
        assert.ok(typeof q.q === 'string' && q.q.trim(), `第 ${line} 行題幹`);
        assert.ok(Array.isArray(q.opts) && q.opts.length >= 2, `第 ${line} 行選項：${q.q}`);
        assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.opts.length, `第 ${line} 行答案索引：${q.q}`);
        assert.ok(typeof q.explain === 'string' && q.explain.trim().length >= 5, `第 ${line} 行解析：${q.q}`);
      }
    }
  });
  test('同題選項不重複、題目全站不重複', () => {
    const all = parsed.flatMap(p => p.qs);
    for (const q of all) assert.equal(new Set(q.opts).size, q.opts.length, q.q);
    const qs = all.map(q => q.q);
    assert.deepEqual(qs.filter((x, i) => qs.indexOf(x) !== i), []);
  });
  test('每個 quiz widget 都在某一章 section 之內（QuizReview 需要章節 id）', () => {
    for (const m of blocks) {
      const before = html.slice(0, m.index);
      const lastOpen = before.lastIndexOf('<section'), lastClose = before.lastIndexOf('</section>');
      assert.ok(lastOpen > lastClose, `第 ${lineOf(m.index)} 行的 quiz 不在 section 內`);
    }
  });
  test('V2 段落題庫：id 與 key 一致、答案在選項中、有解析、章節存在於 V2.order', () => {
    const qs = Object.entries(V2.q);
    assert.ok(qs.length >= 200);
    for (const [id, q] of qs) {
      assert.equal(q.id, id);
      assert.ok(Object.hasOwn(q.options, q.answer), `${id} 答案 ${q.answer}`);
      assert.ok(Object.keys(q.options).length >= 2, id);
      assert.ok(q.explanation && q.explanation.trim().length >= 5, `${id} 解析`);
      assert.ok(V2.order.includes(q.chapter), `${id} 章節 ${q.chapter}`);
      assert.ok(id.startsWith(`fin-${q.chapter.replace(/^fin-/, '')}-`), `${id} 前綴應含章節`);
    }
  });
  test('V2 題庫與段落題卡雙向對應：每個 data-qids 都存在、每題都有被放到某段', () => {
    const used = new Set([...html.matchAll(/data-qids="([^"]*)"/g)].flatMap(m => m[1].split(',').filter(Boolean)));
    for (const id of used) assert.ok(V2.q[id], `題卡引用不存在的 ${id}`);
    for (const id of Object.keys(V2.q)) assert.ok(used.has(id), `${id} 沒有被任何段落使用`);
  });
  test('V2 題卡的 qids 前綴章節與所在 data-chapter 一致', () => {
    for (const m of html.matchAll(/class="v2-quiz"[^>]*data-chapter="([^"]+)" data-qids="([^"]*)"/g)) {
      for (const id of m[2].split(',').filter(Boolean)) assert.equal(V2.q[id].chapter, m[1], id);
    }
  });
  test('V2 同題選項不重複', () => {
    for (const q of Object.values(V2.q)) {
      const v = Object.values(q.options);
      assert.equal(new Set(v).size, v.length, q.id);
    }
  });
  test.todo('待確認：V2 題庫題幹不重複（目前 fin-ch9-s1-g2 與 fin-ch22-s2-g2 同為「存貨週轉率的公式？」）', () => {
    const qs = Object.values(V2.q).map(q => q.question);
    assert.deepEqual(qs.filter((x, i) => qs.indexOf(x) !== i), []);
  });
});

describe('④ 標籤閉合', () => {
  const TAGS = ['section', 'details', 'summary', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'a', 'strong', 'code', 'span', 'em', 'b', 'button', 'nav', 'aside', 'main', 'header', 'label', 'blockquote', 'svg'];
  for (const t of TAGS) {
    test(`<${t}> 開關數量相等`, () => {
      const o = (staticHtml.match(new RegExp(`<${t}(?=[\\s>])`, 'g')) || []).length;
      const c = (staticHtml.match(new RegExp(`</${t}>`, 'g')) || []).length;
      assert.equal(o, c);
    });
  }
  test('<details> 依序巢狀平衡（不會先關後開），且每個 <details> 都有 <summary>', () => {
    let depth = 0;
    for (const m of staticHtml.matchAll(/<(\/?)details\b/g)) {
      depth += m[1] ? -1 : 1;
      assert.ok(depth >= 0);
    }
    assert.equal(depth, 0);
    const n = (staticHtml.match(/<details\b/g) || []).length;
    const withSummary = (staticHtml.match(/<details\b[^>]*>\s*<summary/g) || []).length;
    assert.equal(withSummary, n);
  });
  test('<section> 不巢狀（每章各自獨立）', () => {
    let depth = 0;
    for (const m of staticHtml.matchAll(/<(\/?)section\b/g)) {
      depth += m[1] ? -1 : 1;
      assert.ok(depth === 0 || depth === 1);
    }
  });
  test('table 的每列欄數一致（同一表格內，忽略 colspan 表）', () => {
    for (const t of staticHtml.matchAll(/<table\b[\s\S]*?<\/table>/g)) {
      if (/colspan|rowspan/.test(t[0])) continue;
      const rows = [...t[0].matchAll(/<tr\b[\s\S]*?<\/tr>/g)].map(r => (r[0].match(/<t[dh]\b/g) || []).length);
      assert.equal(new Set(rows).size, 1, `第 ${lineOf(html.indexOf(t[0]))} 行表格欄數不一：${rows.join(',')}`);
    }
  });
});

describe('⑤ 數量宣稱一致', () => {
  const v2Chapters = V2.order; // 由淺入深的章序（含 3 個擴充章與案例庫）
  test('V2.order 每一項都是存在的章節、不重複', () => {
    assert.equal(new Set(v2Chapters).size, v2Chapters.length);
    for (const c of v2Chapters) assert.ok(sectionSet.has(c), c);
  });
  test('V2.order 涵蓋所有內容章節（除 intro／glossary／progress）', () => {
    const content = sections.filter(s => !['intro', 'glossary', 'progress'].includes(s));
    assert.deepEqual([...content].sort(), [...v2Chapters].sort());
  });
  test('各章「全書第 N/M 章」：M 皆等於章數、N 為 1..M 連續且順序同 V2.order', () => {
    // 逐章切段，避免跨章匹配
    const got = [];
    for (const sec of staticHtml.split('<section ').slice(1)) {
      const id = /data-chapter="([^"]+)"/.exec(sec)[1];
      const m = /全書第 (\d+)\/(\d+) 章/.exec(sec.split('</section>')[0]);
      if (m) got.push([id, Number(m[1]), Number(m[2])]);
    }
    assert.equal(got.length, v2Chapters.length);
    got.forEach(([id, n, total], i) => {
      assert.equal(total, v2Chapters.length, id);
      assert.equal(n, i + 1, id);
      assert.equal(id, v2Chapters[i]);
    });
  });
  test('Part 數：側欄 Part 群組數 = 章首「Part N ·」最大值 = 首頁宣稱的「6 Part」', () => {
    const groups = [...staticHtml.matchAll(/nav-group-title">Part (\d+)/g)].map(m => Number(m[1]));
    const inChapters = Math.max(...[...staticHtml.matchAll(/class="v2-pos">Part (\d+)/g)].map(m => Number(m[1])));
    assert.deepEqual(groups, [1, 2, 3, 4, 5, 6]);
    assert.equal(inChapters, 6);
    assert.match(staticHtml, /36 章 · 6 Part/);
  });
  test('首頁宣稱「36 章」= V2.order 長度；LLM systemPrompt 宣稱「共 36 章，分 6 個 Part」一致', () => {
    assert.equal(v2Chapters.length, 36);
    assert.match(mainJs, /共 36 章，分 6 個 Part/);
  });
  test('「11 互動」= 互動元件種類數（不含學習路徑 path 與測驗 quiz）', () => {
    const kinds = new Set([...staticHtml.matchAll(/data-component="([a-z]+)"/g)].map(m => m[1]));
    kinds.delete('path'); kinds.delete('quiz');
    assert.equal(kinds.size, 11, [...kinds].join(','));
    const claims = [...staticHtml.matchAll(/(\d+) 互動/g)].map(m => Number(m[1]));
    assert.ok(claims.length >= 1);
    for (const c of claims) assert.equal(c, kinds.size);
  });
  test('hydrateAll 對照表涵蓋頁面上所有 data-component', () => {
    const map = /const map = \{([\s\S]*?)\};/.exec(mainJs)[1];
    const keys = [...map.matchAll(/(\w+):/g)].map(m => m[1]);
    for (const k of new Set([...staticHtml.matchAll(/data-component="([a-z]+)"/g)].map(m => m[1]))) assert.ok(keys.includes(k), k);
  });
  test('「產業選擇器 16 產業」= IndustryMetricPicker.DATA 產業數', () => {
    const start = mainJs.indexOf('const IndustryMetricPicker = {');
    const data = mainJs.slice(start, mainJs.indexOf('\n  },', start));
    const n = (data.match(/^    '[^']+': \[/gm) || []).length;
    assert.equal(n, 16);
    assert.match(staticHtml, /產業選擇器 16 產業/);
  });
  test.todo('疑似瑕疵：側欄頁尾仍寫「32 章 + 案例庫 + 11 互動」，與首頁「36 章 · 6 Part」口徑不一', () => {
    assert.doesNotMatch(staticHtml, /32 章 \+ 案例庫/);
  });
  test.todo('疑似瑕疵：頂欄完成計數靜態寫「/ 36」，但 JS 以可追蹤章節（排除案例庫）計為 35，載入後數字會跳動', () => {
    const trackable = sections.filter(s => !['intro', 'cases', 'glossary', 'progress'].includes(s)).length;
    assert.match(staticHtml, new RegExp(`<span class="count">0</span> / ${trackable}<`));
  });
});

describe('⑤-2 README 宣稱與頁面一致', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  test('README「6 個 Part、36 章」與頁面一致', () => {
    const m = /(\d+) 個 Part、(\d+) 章/.exec(readme);
    assert.ok(m, 'README 應寫明 Part 數與章數');
    assert.equal(Number(m[1]), new Set([...staticHtml.matchAll(/nav-group-title">Part (\d+)/g)].map(x => x[1])).size);
    assert.equal(Number(m[2]), V2.order.length);
  });
  test('README 段落練習題數、章末測驗組數與頁面一致', () => {
    assert.equal(Number(/段落練習[^\n]*?（(\d+) 題）/.exec(readme)[1]), Object.keys(V2.q).length);
    assert.equal(Number(/(\d+) 組章末測驗/.exec(readme)[1]), (html.match(/data-component="quiz"/g) || []).length);
  });
  test('README 互動元件清單涵蓋每一種 data-component（以元件英文名對照）', () => {
    const names = { dupont: 'DuPontDecomposer', ratio: 'RatioCalculator', waterfall: 'MarginWaterfall', trend: 'TrendVisualizer', quality: 'EarningsQuality', pebands: 'PEBands', dividend: 'DividendSimulator', industry: 'IndustryMetricPicker', redflag: 'RedFlagScanner', compare: 'CompanyCompare', worksheet: 'Worksheet' };
    const kinds = new Set([...staticHtml.matchAll(/data-component="([a-z]+)"/g)].map(m => m[1]));
    kinds.delete('path'); kinds.delete('quiz');
    for (const k of kinds) assert.ok(names[k] && readme.includes(names[k]), `README 未列出元件 ${k}`);
  });
  test('README 列出的每個測試檔都存在，且 tests/ 的每個測試檔都列在 README', () => {
    const listed = [...readme.matchAll(/`tests\/([\w-]+\.test\.mjs)`/g)].map(m => m[1]).sort();
    const actual = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).sort();
    assert.deepEqual(listed, actual);
  });
});

describe('⑥ 外部請求', () => {
  test('沒有外部 <script src>、<link href>、<img>/<iframe>/<video>/<audio>/<source>、CSS url()/@import', () => {
    for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) assert.match(m[1], /^\.\//, `外部 script：${m[1]}`);
    for (const m of html.matchAll(/<link\b[^>]*\bhref=(["'])([\s\S]*?)\1/g)) assert.match(m[2], /^(\.\/|data:)/, `外部 link：${m[2].slice(0, 60)}`);
    assert.doesNotMatch(html, /<(img|iframe|video|audio|source|embed|object)\b/);
    assert.doesNotMatch(html, /@import|url\(\s*['"]?https?:/);
  });
  test('只引用本地 v2.js／v2.css（維持單檔＋兩個同目錄檔案離線可開）', () => {
    const local = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m => m[1]).sort();
    assert.deepEqual(local, ['v2.css', 'v2.js']);
  });
  test('沒有 service worker、追蹤碼、外部字型', () => {
    assert.doesNotMatch(html, /serviceWorker|googletagmanager|google-analytics|gtag\(|fonts\.googleapis|fonts\.gstatic/);
  });
  test('網路呼叫白名單：全頁只有 1 處 fetch(，且目標為 Gemini generativelanguage API', () => {
    const calls = [...html.matchAll(/\bfetch\s*\(/g)];
    assert.equal(calls.length, 1);
    const ctx = html.slice(calls[0].index - 400, calls[0].index);
    assert.match(ctx, /const url = `https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/\$\{this\.MODEL\}:generateContent\?key=\$\{encodeURIComponent\(key\)\}`;/);
    assert.doesNotMatch(html, /XMLHttpRequest|navigator\.sendBeacon|new WebSocket|EventSource\(/);
  });
  test('Gemini key 只從 localStorage 讀取，原始碼沒有硬編碼疑似 key（AIza 開頭 35 字以上）', () => {
    assert.doesNotMatch(html, /AIza[0-9A-Za-z_-]{30,}/);
    assert.match(mainJs, /loadKey\(\) \{ return localStorage\.getItem\(this\.KEY_STORE\) \|\| ''; \}/);
  });
  test('頁面中出現的 http(s) 網址都只是純連結或 SVG 命名空間（白名單）', () => {
    const allowed = [/^http:\/\/www\.w3\.org\/2000\/svg$/, /^https:\/\/github\.com\/people7771025\/FIN$/, /^https:\/\/aistudio\.google\.com\/apikey$/, /^https:\/\/generativelanguage\.googleapis\.com\//];
    const urls = [...new Set([...html.matchAll(/https?:\/\/[^\s"'<>)`]+/g)].map(m => m[0]))];
    for (const u of urls) assert.ok(allowed.some(r => r.test(u)), `未列入白名單的網址：${u}`);
  });
});
