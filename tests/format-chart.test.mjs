// 保護：格式化（fmt／pctf／clamp／esc）與 SVG 繪圖 helper（scaleY／linePath／svgChart）
// 在負數、0、NaN、巨大數、小數位、單點、全相同值、空陣列下的行為；
// 以及實際使用這些 helper 的 TrendVisualizer／PEBands／EarningsQuality 輸出合法 SVG。
// 這裡用「字串抽出 + new Function」版本測純函式，與 DOM 完全解耦。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFunctions, loadApp, createBody } from './helpers/load-script.mjs';

const { fmt, pctf, clamp, esc, scaleY, linePath, svgChart } = pickFunctions(['fmt', 'pctf', 'clamp', 'esc', 'scaleY', 'linePath', 'svgChart']);
const PATH_RE = /^M-?\d+(\.\d)? -?\d+(\.\d)?( L-?\d+(\.\d)? -?\d+(\.\d)?)*$/;

describe('fmt(n, d)：千分位、小數位', () => {
  test('整數加千分位、預設 0 位小數', () => {
    assert.equal(fmt(1234567), '1,234,567');
    assert.equal(fmt(0), '0');
    assert.equal(fmt(999), '999');
  });
  test('指定小數位會補零', () => {
    assert.equal(fmt(5, 1), '5.0');
    assert.equal(fmt(1234.5, 2), '1,234.50');
  });
  test('負數保留負號與千分位', () => {
    assert.equal(fmt(-1234567.8, 1), '-1,234,567.8');
    assert.equal(fmt(-5), '-5');
  });
  test('null／undefined／NaN／±Infinity → 「—」', () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(fmt(v), '—', String(v));
  });
  test('巨大數完整展開（不轉科學記號）', () => {
    assert.equal(fmt(1e15), '1,000,000,000,000,000');
    assert.equal(fmt(1e21), '1,000,000,000,000,000,000,000');
  });
  test('四捨五入：Intl 以十進位最短表示「四捨五入（half-expand）」', () => {
    assert.equal(fmt(0.5), '1');
    assert.equal(fmt(1.5), '2');
    assert.equal(fmt(2.5), '3');
    assert.equal(fmt(2.675, 2), '2.68');
  });
  test('非數字字串 → 「—」；數字字串會被轉成數字', () => {
    assert.equal(fmt('abc'), '—');
    assert.equal(fmt('1234.5', 1), '1,234.5');
  });
  test.todo('疑似瑕疵：-0.4 取整顯示「-0」（應為「0」）', () => assert.equal(fmt(-0.4), '0'));
  test.todo('疑似瑕疵：空字串會顯示「0」（isFinite("") 為 true），應視為缺值顯示「—」', () => assert.equal(fmt(''), '—'));
});

describe('pctf(n, d)：百分比字串', () => {
  test('預設 1 位小數＋%', () => {
    assert.equal(pctf(12.345), '12.3%');
    assert.equal(pctf(0), '0.0%');
    assert.equal(pctf(100), '100.0%');
  });
  test('自訂小數位', () => {
    assert.equal(pctf(12.345, 0), '12%');
    assert.equal(pctf(12.3456, 2), '12.35%');
  });
  test('負數', () => assert.equal(pctf(-7.25), '-7.3%'));
  test('null／undefined／NaN／±Infinity → 「—」', () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(pctf(v), '—', String(v));
  });
  test('四捨五入口徑：toFixed 以二進位實值為準（2.675 實際略小於 2.675 → 2.67）', () => {
    assert.equal(pctf(2.675, 2), '2.67%');
    assert.equal(pctf(1.005, 2), '1.00%');
    assert.equal(pctf(0.125, 2), '0.13%'); // 0.125 可精確表示 → 進位
  });
  test('巨大數：1e21 以上 toFixed 轉科學記號（現行行為，記錄口徑）', () => {
    assert.equal(pctf(1e20, 0), '100000000000000000000%');
    assert.equal(pctf(1e21), '1e+21%');
  });
  test.todo('疑似瑕疵：-0.04 顯示「-0.0%」（應為「0.0%」）', () => assert.equal(pctf(-0.04), '0.0%'));
  test.todo('疑似瑕疵：fmt 與 pctf 半位數進位口徑不一致（fmt(2.675,2)=2.68，pctf(2.675,2)=2.67%）', () => {
    assert.equal(pctf(2.675, 2), fmt(2.675, 2) + '%');
  });
  test('pctf 傳入數字字串會丟例外（呼叫端都傳 number；此測試確保呼叫端維持這個前提）', () => {
    assert.throws(() => pctf('12'), TypeError);
  });
});

describe('clamp／esc', () => {
  test('clamp 在區間內原值、超出取邊界', () => {
    assert.equal(clamp(5, 0, 10), 5);
    assert.equal(clamp(-1, 0, 10), 0);
    assert.equal(clamp(11, 0, 10), 10);
    assert.equal(clamp(0, 0, 0), 0);
  });
  test('clamp(NaN) 回傳 NaN（現行行為；目前頁面未使用 clamp）', () => assert.ok(Number.isNaN(clamp(NaN, 0, 1))));
  test('esc 跳脫 & < > " \'，避免 innerHTML 注入', () => {
    assert.equal(esc(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    assert.equal(esc(123), '123');
    assert.equal(esc(null), 'null');
  });
  test('esc 先跳脫 & 再跳脫其他（不會雙重跳脫成 &amp;lt;）', () => assert.equal(esc('<'), '&lt;'));
});

describe('scaleY：值域映射到 SVG 座標（top 在上、bottom 在下）', () => {
  test('最小值 → bottom、最大值 → top、中點 → 中間', () => {
    assert.equal(scaleY(0, 0, 100, 20, 220), 220);
    assert.equal(scaleY(100, 0, 100, 20, 220), 20);
    assert.equal(scaleY(50, 0, 100, 20, 220), 120);
  });
  test('min === max（全相同值）→ 垂直置中，不除以零', () => {
    assert.equal(scaleY(7, 7, 7, 20, 220), 120);
  });
  test('負值區間', () => assert.equal(scaleY(-5, -10, 10, 0, 100), 75));
  test('超出值域會外插（不截斷）', () => assert.equal(scaleY(200, 0, 100, 20, 220), -180));
  test('NaN 輸入 → NaN（由呼叫端負責過濾）', () => assert.ok(Number.isNaN(scaleY(NaN, 0, 1, 0, 100))));
});

describe('linePath：產生 SVG path d 字串', () => {
  test('多點：x 平均分布、y 依值域映射、格式為 M x y L x y …（1 位小數）', () => {
    assert.equal(linePath([0, 50, 100], 0, 100, 0, 100, 0, 100), 'M0.0 100.0 L50.0 50.0 L100.0 0.0');
  });
  test('單點：x 置中，輸出合法 path', () => {
    const d = linePath([5], 0, 100, 0, 10, 0, 100);
    assert.equal(d, 'M50.0 50.0');
    assert.match(d, PATH_RE);
  });
  test('全相同值：水平線置中，不含 NaN', () => {
    const d = linePath([3, 3, 3, 3], 10, 40, 3, 3, 0, 60);
    assert.equal(d, 'M10.0 30.0 L20.0 30.0 L30.0 30.0 L40.0 30.0');
  });
  test('空陣列：回傳空字串、不丟例外', () => assert.equal(linePath([], 0, 100, 0, 1, 0, 100), ''));
  test('負值與小數座標格式正確', () => {
    const d = linePath([-10, 10], 0.25, 99.75, -10, 10, 0, 50);
    assert.match(d, PATH_RE);
    assert.equal(d, 'M0.3 50.0 L99.8 0.0');
  });
  test('冪等：同一輸入重複呼叫結果相同、不改動輸入陣列', () => {
    const vals = [1, 2, 3];
    const a = linePath(vals, 0, 10, 1, 3, 0, 10), b = linePath(vals, 0, 10, 1, 3, 0, 10);
    assert.equal(a, b);
    assert.deepEqual(vals, [1, 2, 3]);
  });
  test.todo('疑似瑕疵：資料含 NaN 時 path 會出現「NaN」（瀏覽器會中斷整條線）；目前頁面資料為靜態預設，使用者無法觸發', () => {
    assert.doesNotMatch(linePath([1, NaN, 3], 0, 100, 1, 3, 0, 100), /NaN/);
  });
});

describe('svgChart：外框', () => {
  test('viewBox 與 max-height 帶入寬高、包住內容', () => {
    const s = svgChart(620, 300, '<path d="M0 0"/>');
    assert.equal(s, '<svg class="chart" viewBox="0 0 620 300" preserveAspectRatio="xMidYMid meet" style="max-height:300px;"><path d="M0 0"/></svg>');
  });
  test('空內容仍是合法閉合的 <svg>', () => {
    const s = svgChart(10, 10, '');
    assert.match(s, /^<svg[^>]*><\/svg>$/);
  });
});

describe('實際圖表元件輸出合法 SVG（每個預設組）', () => {
  const { api } = loadApp();
  const checkSvg = (html, label) => {
    assert.doesNotMatch(html, /NaN|undefined|Infinity/, label);
    const paths = [...html.matchAll(/<path d="([^"]*)"/g)].map(m => m[1]);
    assert.ok(paths.length > 0, `${label} 應至少有一條線`);
    for (const d of paths) assert.match(d, PATH_RE, `${label} path 格式`);
    assert.equal((html.match(/<svg/g) || []).length, (html.match(/<\/svg>/g) || []).length, `${label} svg 閉合`);
  };
  for (const [name, mod] of [['TrendVisualizer', api.TrendVisualizer], ['PEBands', api.PEBands], ['EarningsQuality', api.EarningsQuality]]) {
    for (const key of Object.keys(mod.PRESETS)) {
      test(`${name}「${key}」`, () => {
        const body = createBody();
        mod.render(body, key);
        if (name === 'EarningsQuality') {
          assert.doesNotMatch(body.innerHTML, /NaN|undefined|Infinity/);
          assert.match(body.innerHTML, /<svg[\s\S]*<\/svg>/);
        } else checkSvg(body.innerHTML, `${name}/${key}`);
      });
    }
  }
  test('TrendVisualizer 預設組的營收 YoY 與毛利率期數一致（8 季）', () => {
    for (const [k, d] of Object.entries(api.TrendVisualizer.PRESETS)) {
      assert.equal(d.revYoY.length, 8, k);
      assert.equal(d.gm.length, 8, k);
    }
  });
  test('TrendVisualizer 趨勢文字：最後一季減第一季的 pp 變化（穩定成長：營收 +4 pp、毛利 +4 pp）', () => {
    const body = createBody();
    api.TrendVisualizer.render(body, '穩定成長');
    assert.match(body.innerHTML, /營收成長 走揚（\+4 pp）、毛利率 改善（\+4 pp）/);
    api.TrendVisualizer.render(body, '衰退警訊');
    assert.match(body.innerHTML, /營收成長 走弱（-26 pp）、毛利率 惡化（-15 pp）/);
  });
  test('MarginWaterfall 所有預設組 SVG 座標皆為有限數', () => {
    for (const k of Object.keys(api.MarginWaterfall.PRESETS)) {
      const body = createBody();
      api.MarginWaterfall.render(body, { ...api.MarginWaterfall.PRESETS[k] });
      for (const m of body.innerHTML.matchAll(/ (?:x|y|x1|y1|x2|y2|width|height)="([^"]+)"/g)) assert.ok(Number.isFinite(Number(m[1])), `${k} ${m[0]}`);
    }
  });
});
