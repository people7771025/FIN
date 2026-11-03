// index.html 主程式中純函式的單元測試。執行：node --test tests/
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadInlineScript } from './load-inline-script.mjs';

const fin = loadInlineScript();
// vm 沙盒的物件屬於另一個 realm，深比較前先轉成本 realm 的普通物件。
const plain = v => JSON.parse(JSON.stringify(v));
const scoreOf = html => Number(/(\d+) \/ 100/.exec(html)[1]);

describe('fmt：千分位數字格式', () => {
  test('預設 0 位小數並四捨五入', () => {
    assert.equal(fin.fmt(1234.5), '1,235');
    assert.equal(fin.fmt(0), '0');
  });
  test('指定小數位數', () => {
    assert.equal(fin.fmt(1234.567, 2), '1,234.57');
    assert.equal(fin.fmt(5, 1), '5.0');
  });
  test('負數保留千分位', () => {
    assert.equal(fin.fmt(-9876543), '-9,876,543');
  });
  test('數字字串會轉成數字', () => {
    assert.equal(fin.fmt('2500'), '2,500');
  });
  test('null / undefined / NaN / Infinity 顯示破折號', () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(fin.fmt(v), '—');
  });
});

describe('pctf：百分比格式', () => {
  test('預設 1 位小數', () => {
    assert.equal(fin.pctf(12.345), '12.3%');
    assert.equal(fin.pctf(0), '0.0%');
  });
  test('指定小數位數與負值', () => {
    assert.equal(fin.pctf(-3.456, 2), '-3.46%');
    assert.equal(fin.pctf(50, 0), '50%');
  });
  test('無效值顯示破折號', () => {
    for (const v of [null, undefined, NaN, Infinity]) assert.equal(fin.pctf(v), '—');
  });
});

describe('clamp', () => {
  test('區間內原值返回', () => assert.equal(fin.clamp(5, 0, 10), 5));
  test('低於下限取下限', () => assert.equal(fin.clamp(-1, 0, 10), 0));
  test('高於上限取上限', () => assert.equal(fin.clamp(11, 0, 10), 10));
  test('邊界值', () => {
    assert.equal(fin.clamp(0, 0, 10), 0);
    assert.equal(fin.clamp(10, 0, 10), 10);
  });
});

describe('esc：HTML 跳脫', () => {
  test('跳脫五種特殊字元', () => {
    assert.equal(fin.esc(`<a href="x">Tom & 'Jerry'</a>`),
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  });
  test('& 先處理，不會二次跳脫', () => {
    assert.equal(fin.esc('&lt;'), '&amp;lt;');
  });
  test('非字串會先轉字串', () => {
    assert.equal(fin.esc(42), '42');
    assert.equal(fin.esc(null), 'null');
  });
});

describe('scaleY：資料值映射到 SVG y 座標', () => {
  test('最小值落在底部、最大值落在頂部', () => {
    assert.equal(fin.scaleY(0, 0, 100, 10, 110), 110);
    assert.equal(fin.scaleY(100, 0, 100, 10, 110), 10);
  });
  test('中間值線性內插', () => {
    assert.equal(fin.scaleY(25, 0, 100, 0, 200), 150);
  });
  test('max === min 時置中，避免除以 0', () => {
    assert.equal(fin.scaleY(7, 5, 5, 20, 80), 50);
  });
  test('超出範圍不裁切', () => {
    assert.equal(fin.scaleY(150, 0, 100, 0, 100), -50);
  });
});

describe('svgChart', () => {
  test('產生帶 viewBox 與 max-height 的 svg 外框', () => {
    assert.equal(fin.svgChart(300, 120, '<g/>'),
      '<svg class="chart" viewBox="0 0 300 120" preserveAspectRatio="xMidYMid meet" style="max-height:120px;"><g/></svg>');
  });
});

describe('linePath：折線 SVG path', () => {
  test('多點平均分布於 x0..x1，首點 M 其餘 L', () => {
    assert.equal(fin.linePath([0, 50, 100], 0, 100, 0, 100, 0, 100), 'M0.0 100.0 L50.0 50.0 L100.0 0.0');
  });
  test('單點置於水平中央', () => {
    assert.equal(fin.linePath([10], 20, 80, 0, 20, 0, 100), 'M50.0 50.0');
  });
  test('空陣列回傳空字串', () => {
    assert.equal(fin.linePath([], 0, 100, 0, 1, 0, 100), '');
  });
  test('座標四捨五入到 1 位小數', () => {
    assert.equal(fin.linePath([1, 2, 3], 0, 10, 0, 3, 0, 10), 'M0.0 6.7 L5.0 3.3 L10.0 0.0');
  });
});

describe('LearningPathBuilder：學習計畫', () => {
  const LPB = fin.LearningPathBuilder;
  test('看懂財報 × 輕度 × 新手：12 章、14.4 小時、5 週', () => {
    const p = plain(LPB.computePlan('read', 'light', 'newbie'));
    assert.equal(p.chapters.length, 12);
    assert.equal(p.totalHours, '14.4');
    assert.equal(p.weeks, 5);
    assert.equal(p.perWeek, 3);
    assert.equal(typeof p.created, 'number');
  });
  test('有基礎者跳過 Part Ⅰ（ch1–ch5）', () => {
    const p = plain(LPB.computePlan('read', 'light', 'experienced'));
    assert.deepEqual(p.chapters, ['ch11', 'ch12', 'ch13', 'ch14', 'ch15', 'ch16', 'ch26']);
    assert.equal(p.totalHours, '8.4');
    assert.equal(p.weeks, 3);
  });
  test('每週時數越多，週數越少', () => {
    const light = LPB.computePlan('value', 'light', 'newbie');
    const heavy = LPB.computePlan('value', 'heavy', 'newbie');
    assert.equal(light.weeks, Math.ceil(14 * 1.2 / 3));
    assert.equal(heavy.weeks, Math.ceil(14 * 1.2 / 10));
    assert.ok(heavy.weeks < light.weeks);
  });
  test('不修改 GOALS 內建章節陣列', () => {
    const before = plain(LPB.GOALS.read.chs);
    LPB.computePlan('read', 'medium', 'experienced');
    assert.deepEqual(plain(LPB.GOALS.read.chs), before);
  });
  test('chLabel：章節代號轉顯示文字', () => {
    assert.equal(LPB.chLabel('ch12'), 'Ch12');
    assert.equal(LPB.chLabel('cases'), '案例');
  });
});

describe('QuizReview.id：錯題識別碼', () => {
  const id = (...a) => fin.QuizReview.id(...a);
  test('格式為 章節:題號:題目雜湊', () => {
    assert.equal(id('ch5', 2, { q: 'a' }), 'ch5:2:97');
  });
  test('同題目同結果、不同題目不同結果', () => {
    const a = id('ch5', 0, { q: '什麼是 FCF？' });
    assert.equal(id('ch5', 0, { q: '什麼是 FCF？' }), a);
    assert.notEqual(id('ch5', 0, { q: '什麼是 ROE？' }), a);
  });
  test('無章節時使用 quiz 前綴，無題目時雜湊為 0', () => {
    assert.equal(id('', 3, {}), 'quiz:3:0');
  });
  test('雜湊取絕對值，不出現負號', () => {
    const s = id('ch1', 0, { q: '這是一題很長的中文題目，用來讓 32 位元雜湊溢位成負數再取絕對值'.repeat(3) });
    assert.match(s, /^ch1:0:\d+$/);
  });
});

describe('CompanyCompare.metrics：兩家公司比較指標', () => {
  const m = c => plain(fin.CompanyCompare.metrics(c));
  test('預設 A 公司', () => {
    const r = m(plain(fin.CompanyCompare.defaults.A));
    assert.equal(r.gm, 50);
    assert.equal(r.nm, 25);
    assert.ok(Math.abs(r.roe - 250 / 1200 * 100) < 1e-9);
    assert.equal(r.debtR, 25);
    assert.equal(r.pe, 24);
  });
  test('分母為 0 時回傳 0，不出現 Infinity / NaN', () => {
    assert.deepEqual(m({ rev: 0, gross: 10, ni: 5, equity: 0, debt: 0, price: 10, eps: 0 }),
      { gm: 0, nm: 0, roe: 0, debtR: 0, pe: 0 });
  });
  test('虧損時淨利率與 ROE 為負', () => {
    const r = m({ rev: 100, gross: 20, ni: -10, equity: 50, debt: 50, price: 10, eps: -1 });
    assert.equal(r.nm, -10);
    assert.equal(r.roe, -20);
    assert.equal(r.pe, -10);
  });
});

describe('WorksheetTool.checkHTML：工作底稿自我檢核', () => {
  const W = fin.WorksheetTool;
  const long = 'x'.repeat(18);
  const full = { co: '台積電 2330', s1: long, s2: long, s3: long, s4: long, s5: long, s6: long, conc: long, rating: '觀察' };

  test('空白底稿 0 分、尚未成形、待補只列前 5 項', () => {
    const html = W.checkHTML({});
    assert.equal(scoreOf(html), 0);
    assert.match(html, /尚未成形/);
    assert.match(html, /待補：公司名稱 \/ 代號、1\. 營收趨勢、2\. 獲利結構、3\. 現金流品質、4\. 資產負債安全\.\.\./);
    assert.match(html, /紅旗：無/);
  });
  test('全部填完 100 分、可匯出、沒有待補', () => {
    const html = W.checkHTML(full);
    assert.equal(scoreOf(html), 100);
    assert.match(html, /可匯出/);
    assert.match(html, /已填完整：6 \/ 6 步/);
    assert.doesNotMatch(html, /待補：/);
  });
  test('少於 18 字的步驟不算完成', () => {
    const html = W.checkHTML({ ...full, s3: 'x'.repeat(17) });
    assert.equal(scoreOf(html), 90);
    assert.match(html, /待補：3\. 現金流品質/);
  });
  test('只有空白字元不算填寫', () => {
    assert.equal(scoreOf(W.checkHTML({ ...full, co: '   ' })), 90);
  });
  test('評級「（未定）」不計分', () => {
    const html = W.checkHTML({ ...full, rating: '（未定）' });
    assert.equal(scoreOf(html), 90);
    assert.match(html, /待補：評級/);
  });
  test('60–84 分為可討論', () => {
    // 公司 10 + 4 步 40 + 結論 20 = 70
    const html = W.checkHTML({ co: 'A', s1: long, s2: long, s3: long, s4: long, conc: long });
    assert.equal(scoreOf(html), 70);
    assert.match(html, /可討論/);
  });
  test('紅旗列出步驟名稱（去掉編號）並出現提醒', () => {
    const html = W.checkHTML({ ...full, s3_f: true, s5_f: true });
    assert.match(html, /紅旗：現金流品質、比率與同業比/);
    assert.match(html, /提醒：有紅旗時/);
  });
});

describe('LLMAssistant.formatReply：AI 回覆轉 HTML', () => {
  const f = t => fin.LLMAssistant.formatReply(t);
  test('先跳脫 HTML，避免注入', () => {
    assert.equal(f('<script>x</script> & y'), '&lt;script&gt;x&lt;/script&gt; &amp; y');
  });
  test('[ChN] 轉成章節連結', () => {
    assert.match(f('見 [Ch12]'), /<a href="#ch12"[^>]*>Ch12<\/a>/);
  });
  test('**粗體** 與 `程式碼`', () => {
    assert.equal(f('**ROE** 用 `ni/equity`'), '<strong>ROE</strong> 用 <code>ni/equity</code>');
  });
  test('非字串輸入', () => {
    assert.equal(f(123), '123');
  });
});
