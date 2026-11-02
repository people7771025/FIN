// 保護：RatioCalculator／DuPontDecomposer／MarginWaterfall／PEBands／EarningsQuality 顯示的比率
// 與手算答案一致，口徑＝頁面 pctf()（toFixed(1) + '%'）與 toFixed(2)。
// 注意：頁面 RatioCalculator 實際只提供 8 項比率（毛利率、營益率、淨利率、ROE、ROA、負債比、流動比、速動比）；
// 利息保障倍數、存貨週轉、應收天數、FCF、EPS 並未在計算器中提供，因此不測（見 PR「未完成項目」）。
// 所有輸入皆為虛構數字。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, createBody, readStats, readStatClasses, pct, rng } from './helpers/load-script.mjs';

const { api } = loadApp();
const { RatioCalculator, DuPontDecomposer, MarginWaterfall, PEBands, EarningsQuality } = api;

function ratio(over = {}) {
  const body = createBody();
  RatioCalculator.render(body, { ...RatioCalculator.defaults, ...over });
  return { body, stats: readStats(body.innerHTML), cls: readStatClasses(body.innerHTML) };
}
function dupont(s) {
  const body = createBody();
  DuPontDecomposer.render(body, s);
  const out = {};
  for (const m of body.innerHTML.matchAll(/<div class="dn-label">([^<]+)<\/div><div class="dn-val"[^>]*>([^<]+)<\/div>/g)) out[m[1]] = m[2];
  return { body, vals: out };
}
const noBadTokens = html => assert.doesNotMatch(html, /NaN|undefined|Infinity/, '輸出不得出現 NaN／undefined／Infinity');

describe('RatioCalculator：預設值手算', () => {
  // 預設：營收1000、毛利450、營業利益280、淨利230、總資產1800、總負債700、權益1100、流動資產600、流動負債350、存貨180
  const { stats } = ratio();
  const cases = [
    ['毛利率', '45.0%', '450/1000'],
    ['營業利益率', '28.0%', '280/1000'],
    ['淨利率', '23.0%', '230/1000'],
    ['ROE', '20.9%', '230/1100 = 20.909…%'],
    ['ROA', '12.8%', '230/1800 = 12.777…%'],
    ['負債比', '38.9%', '700/1800 = 38.888…%'],
    ['流動比', '1.71', '600/350 = 1.714…'],
    ['速動比', '1.20', '(600-180)/350 = 1.2']
  ];
  for (const [label, expected, why] of cases) {
    test(`${label} = ${expected}（${why}）`, () => assert.equal(stats[label], expected));
  }
  test('只輸出這 8 項比率（頁面若新增比率，此測試提醒補手算案例）', () => {
    assert.deepEqual(Object.keys(stats), cases.map(c => c[0]));
  });
});

describe('RatioCalculator：其他手算組合', () => {
  test('虧損公司：淨利 -50 → 淨利率、ROE、ROA 為負數百分比', () => {
    const { stats, cls } = ratio({ rev: 800, gross: 120, opInc: -30, ni: -50, assets: 2000, equity: 500 });
    assert.equal(stats['毛利率'], '15.0%');
    assert.equal(stats['營業利益率'], '-3.8%'); // -30/800*100 = -3.75（浮點結果恰為 -3.75）→ toFixed(1) 遠離零進位 → -3.8
    assert.equal(stats['淨利率'], '-6.3%'); // -6.25 → -6.3
    assert.equal(stats['ROE'], '-10.0%');
    assert.equal(stats['ROA'], '-2.5%');
    assert.equal(cls['淨利率'], '');
    assert.equal(cls['ROE'], '');
  });
  test('高槓桿：總負債 > 60% 總資產標紅', () => {
    const { stats, cls } = ratio({ assets: 1000, debt: 650 });
    assert.equal(stats['負債比'], '65.0%');
    assert.equal(cls['負債比'], 'neg');
  });
  test('流動比 < 1 標紅、速動比 < 0.7 標紅', () => {
    const { stats, cls } = ratio({ curAsset: 300, curLiab: 400, inv: 100 });
    assert.equal(stats['流動比'], '0.75');
    assert.equal(stats['速動比'], '0.50');
    assert.equal(cls['流動比'], 'neg');
    assert.equal(cls['速動比'], 'neg');
  });
  test('小數輸入：營收 123.4、毛利 56.7 → 45.9%（56.7/123.4 = 45.948…）', () => {
    assert.equal(ratio({ rev: 123.4, gross: 56.7 }).stats['毛利率'], '45.9%');
  });
  test('與獨立手算公式在 200 組固定 seed 隨機輸入下逐字一致', () => {
    const r = rng(42);
    const n = () => Math.round((r() * 2000 - 200) * 10) / 10;
    for (let i = 0; i < 200; i++) {
      const s = { rev: Math.abs(n()) + 1, gross: n(), opInc: n(), ni: n(), assets: Math.abs(n()) + 1, debt: Math.abs(n()), equity: n() || 1, curAsset: Math.abs(n()), curLiab: Math.abs(n()) + 1, inv: Math.abs(n()) };
      const { stats } = ratio(s);
      assert.equal(stats['毛利率'], pct(s.gross / s.rev * 100));
      assert.equal(stats['營業利益率'], pct(s.opInc / s.rev * 100));
      assert.equal(stats['淨利率'], pct(s.ni / s.rev * 100));
      assert.equal(stats['ROE'], pct(s.ni / s.equity * 100));
      assert.equal(stats['ROA'], pct(s.ni / s.assets * 100));
      assert.equal(stats['負債比'], pct(s.debt / s.assets * 100));
      assert.equal(stats['流動比'], (s.curAsset / s.curLiab).toFixed(2));
      assert.equal(stats['速動比'], ((s.curAsset - s.inv) / s.curLiab).toFixed(2));
    }
  });
});

describe('RatioCalculator：門檻著色邊界（>= 與 > 的口徑）', () => {
  test('毛利率剛好 40% → pos；39.9% → 無色', () => {
    assert.equal(ratio({ rev: 1000, gross: 400 }).cls['毛利率'], 'pos');
    assert.equal(ratio({ rev: 1000, gross: 399 }).cls['毛利率'], '');
  });
  test('營益率 15%、淨利率 10%、ROE 15%、ROA 8% 剛好達標 → pos', () => {
    const { cls } = ratio({ rev: 1000, opInc: 150, ni: 100, equity: 100 / 0.15, assets: 1250 });
    assert.equal(cls['營業利益率'], 'pos');
    assert.equal(cls['淨利率'], 'pos');
    assert.equal(cls['ROA'], 'pos');
  });
  test('負債比剛好 60% 不標紅（條件是 > 60）', () => {
    assert.equal(ratio({ assets: 1000, debt: 600 }).cls['負債比'], '');
    assert.equal(ratio({ assets: 1000, debt: 601 }).cls['負債比'], 'neg');
  });
  test('流動比剛好 1.5 → pos；剛好 1 → 無色；速動比剛好 1 → pos、0.7 → 無色', () => {
    assert.equal(ratio({ curAsset: 150, curLiab: 100, inv: 50 }).cls['流動比'], 'pos');
    assert.equal(ratio({ curAsset: 100, curLiab: 100, inv: 0 }).cls['流動比'], '');
    assert.equal(ratio({ curAsset: 100, curLiab: 100, inv: 0 }).cls['速動比'], 'pos');
    assert.equal(ratio({ curAsset: 100, curLiab: 100, inv: 30 }).cls['速動比'], '');
  });
});

describe('RatioCalculator：除以零、缺欄位、極端值', () => {
  test('營收 0：三個利潤率顯示 0.0%（現行行為：以 0 代替無定義）且不出現 NaN', () => {
    const { stats, body } = ratio({ rev: 0 });
    assert.equal(stats['毛利率'], '0.0%');
    assert.equal(stats['營業利益率'], '0.0%');
    assert.equal(stats['淨利率'], '0.0%');
    noBadTokens(body.innerHTML);
  });
  test('權益、總資產、流動負債為 0：對應比率為 0 且不出現 NaN/Infinity', () => {
    const { stats, body } = ratio({ equity: 0, assets: 0, curLiab: 0 });
    assert.equal(stats['ROE'], '0.0%');
    assert.equal(stats['ROA'], '0.0%');
    assert.equal(stats['負債比'], '0.0%');
    assert.equal(stats['流動比'], '0.00');
    assert.equal(stats['速動比'], '0.00');
    noBadTokens(body.innerHTML);
  });
  test.todo('疑似 bug：分母為 0 時應顯示「—」而非 0.0%（0.0% 會被誤讀為「毛利率為零」）', () => {
    assert.equal(ratio({ rev: 0 }).stats['毛利率'], '—');
  });
  test('負權益（資不抵債）：ROE 依公式計算為 230/-100 = -230.0%（現行行為，見「待使用者決定」）', () => {
    assert.equal(ratio({ equity: -100 }).stats['ROE'], '-230.0%');
  });
  test('存貨大於流動資產：速動比為負數（現行不檢查輸入一致性）', () => {
    assert.equal(ratio({ curAsset: 100, inv: 170, curLiab: 350 }).stats['速動比'], '-0.20');
  });
  test('使用者清空欄位（空字串）→ 以 0 計算，不出現 NaN', () => {
    const { body } = ratio();
    body.type('gross', '');
    const s = readStats(body.innerHTML);
    assert.equal(s['毛利率'], '0.0%');
    assert.equal(body.querySelector('.ctrl-num[data-k="gross"]').value, '0');
    noBadTokens(body.innerHTML);
  });
  test('使用者只打了負號「-」或非數字 → 以 0 計算', () => {
    const { body } = ratio();
    body.type('ni', '-');
    assert.equal(readStats(body.innerHTML)['淨利率'], '0.0%');
    body.type('ni', 'abc');
    assert.equal(readStats(body.innerHTML)['ROE'], '0.0%');
  });
  test('輸入 "1e3" 科學記號與 "  250 " 前後空白可被 parseFloat 正確解析', () => {
    const { body } = ratio();
    body.type('rev', '1e3');
    body.type('gross', '  250 ');
    assert.equal(readStats(body.innerHTML)['毛利率'], '25.0%');
  });
  test('連續輸入只改變被改的欄位，其他欄位保持（不可變更新）', () => {
    const { body } = ratio();
    body.type('rev', '2000');
    body.type('ni', '400');
    const s = readStats(body.innerHTML);
    assert.equal(s['毛利率'], '22.5%'); // gross 450 仍保留
    assert.equal(s['淨利率'], '20.0%');
    assert.equal(RatioCalculator.defaults.rev, 1000, 'defaults 物件不得被改寫');
  });
  test('欄位為 null：以 0 處理，不丟例外', () => {
    const { stats, body } = ratio({ gross: null, ni: null });
    assert.equal(stats['毛利率'], '0.0%');
    assert.equal(stats['ROE'], '0.0%');
    noBadTokens(body.innerHTML);
  });
  test('極大值：1e300 / 1e-300 溢位 → 顯示「—」而不是 Infinity', () => {
    const { stats, body } = ratio({ gross: 1e300, rev: 1e-300 });
    assert.equal(stats['毛利率'], '—');
    noBadTokens(body.innerHTML);
  });
  test('兆級數字（1e12）比率仍正確', () => {
    assert.equal(ratio({ rev: 3e12, gross: 1.65e12 }).stats['毛利率'], '55.0%');
  });
  test('重複 render 同一組輸入是冪等的', () => {
    const a = ratio().body.innerHTML, b = ratio().body.innerHTML;
    assert.equal(a, b);
  });
});

describe('四捨五入口徑（toFixed：以二進位值為準，非「銀行家」也非字串四捨五入）', () => {
  test('12.25% 顯示 12.3%（12.25 可精確表示 → 進位）', () => {
    assert.equal(ratio({ rev: 400, gross: 49 }).stats['毛利率'], '12.3%');
  });
  test('ROE 0.05% 這種極小值顯示 0.1%（0.05*100/100 浮點略大於 0.05）——記錄現行口徑', () => {
    assert.equal(ratio({ ni: 0.5, equity: 1000 }).stats['ROE'], '0.1%');
  });
  test('顯示值與註解公式一致：毛利率 = 毛利 ÷ 營收（不是 (營收-成本)/成本）', () => {
    // 若有人誤改成除以成本，450/(1000-450) = 81.8%
    assert.notEqual(ratio().stats['毛利率'], '81.8%');
    assert.match(ratio().body.innerHTML, /定價力 \/ 成本/);
  });
});

describe('DuPontDecomposer：三因子相乘 = ROE', () => {
  test('預設值：淨利率 45.5%、週轉 0.55、權益乘數 1.43、ROE 35.7%（1000/2800）', () => {
    const { vals } = dupont({ ...DuPontDecomposer.defaults });
    assert.equal(vals['淨利率'], '45.5%');
    assert.equal(vals['總資產週轉'], '0.55');
    assert.equal(vals['權益乘數'], '1.43');
    assert.equal(vals['ROE'], '35.7%');
  });
  const presetExpect = {
    '高毛利科技': { nm: '45.5%', t: '0.55', em: '1.43', roe: '35.7%' },
    '薄利多銷零售': { nm: '2.4%', t: '2.00', em: '2.78', roe: '13.3%' }, // 120/5000, 5000/2500, 2500/900, 120/900
    '高槓桿金融': { nm: '23.3%', t: '0.10', em: '12.00', roe: '28.0%' } // 280/1200, 1200/12000, 12000/1000, 280/1000
  };
  for (const [k, e] of Object.entries(presetExpect)) {
    test(`預設組「${k}」手算`, () => {
      const { vals } = dupont({ ...DuPontDecomposer.PRESETS[k] });
      assert.deepEqual([vals['淨利率'], vals['總資產週轉'], vals['權益乘數'], vals['ROE']], [e.nm, e.t, e.em, e.roe]);
    });
  }
  test('預設組的解讀文字對應正確驅動因子', () => {
    assert.match(dupont({ ...DuPontDecomposer.PRESETS['高毛利科技'] }).body.innerHTML, /高<strong>淨利率<\/strong>驅動/);
    assert.match(dupont({ ...DuPontDecomposer.PRESETS['薄利多銷零售'] }).body.innerHTML, /高<strong>週轉<\/strong>驅動/);
    assert.match(dupont({ ...DuPontDecomposer.PRESETS['高槓桿金融'] }).body.innerHTML, /高<strong>權益乘數<\/strong>驅動/);
  });
  test('性質測試（seed=7, 500 組）：淨利率 × 週轉 × 權益乘數 顯示的 ROE 等於 淨利 ÷ 權益', () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const s = {
        ni: Math.round((r() * 2000 - 500)),
        rev: Math.round(r() * 10000) + 1,
        assets: Math.round(r() * 20000) + 1,
        equity: Math.round(r() * 5000) + 1
      };
      const { vals } = dupont(s);
      assert.equal(vals['ROE'], pct(s.ni / s.equity * 100), JSON.stringify(s));
    }
  });
  test('與 RatioCalculator 的 ROE 口徑一致（同一組淨利／權益）', () => {
    const { vals } = dupont({ ni: 230, rev: 1000, assets: 1800, equity: 1100 });
    assert.equal(vals['ROE'], ratio().stats['ROE']);
  });
  test('負權益：權益乘數為負，ROE 仍等於 淨利 ÷ 權益（符號一致）', () => {
    const { vals } = dupont({ ni: 100, rev: 1000, assets: 2000, equity: -500 });
    assert.equal(vals['權益乘數'], '-4.00');
    assert.equal(vals['ROE'], '-20.0%');
  });
  test('權益 0 或總資產 0：不出現 NaN/Infinity', () => {
    noBadTokens(dupont({ ni: 100, rev: 1000, assets: 2000, equity: 0 }).body.innerHTML);
    noBadTokens(dupont({ ni: 100, rev: 1000, assets: 0, equity: 500 }).body.innerHTML);
  });
  test.todo('疑似 bug：營收為 0 但淨利 ≠ 0 時，ROE 節點（標示「淨利 ÷ 權益」）顯示 0.0%，應為 淨利/權益', () => {
    const { vals } = dupont({ ni: 100, rev: 0, assets: 2000, equity: 500 });
    assert.equal(vals['ROE'], '20.0%');
  });
  test('輸入框改值會重新計算並保留其他欄位', () => {
    const { body } = dupont({ ...DuPontDecomposer.defaults });
    body.type('equity', '1000');
    assert.match(body.innerHTML, /<div class="dn-val" style="font-size:24px;">100\.0%<\/div>/);
  });
  test('按預設組按鈕切換資料', () => {
    const { body } = dupont({ ...DuPontDecomposer.defaults });
    body.clickPreset('高槓桿金融');
    assert.match(body.innerHTML, />12\.00</);
  });
});

describe('MarginWaterfall：損益表各層', () => {
  function wf(s) {
    const body = createBody();
    MarginWaterfall.render(body, s);
    const m = /毛利率 ([^ ]+) · 營益率 ([^ ]+) · 淨利率 ([^。]+)。/.exec(body.innerHTML);
    const labels = [...body.innerHTML.matchAll(/class="label-marker">([^<]+)</g)].map(x => x[1]);
    return { body, gm: m[1], om: m[2], nm: m[3], labels };
  }
  test('預設：營收1000、成本450、費用200、業外+20、稅率12% → 毛利550、營益350、稅前370、稅44.4、淨利325.6', () => {
    const r = wf({ ...MarginWaterfall.defaults });
    assert.deepEqual([r.gm, r.om, r.nm], ['55.0%', '35.0%', '32.6%']);
    // 標籤順序：營收、成本、毛利、費用、營益、業外、稅前、稅、淨利（fmt 取整數）
    assert.deepEqual(r.labels, ['1,000', '450', '550', '200', '350', '20', '370', '44', '326']);
  });
  test('業外為負：稅前 = 營益 + 業外、標籤顯示「−業外」', () => {
    const r = wf({ ...MarginWaterfall.PRESETS['品牌消費'] }); // 1000-580-280=140, -10 → 130, 稅 26 → 104
    assert.deepEqual([r.gm, r.om, r.nm], ['42.0%', '14.0%', '10.4%']);
    assert.match(r.body.innerHTML, />−業外</);
    assert.deepEqual(r.labels.slice(4), ['140', '10', '130', '26', '104']);
  });
  test('稅前虧損時不課稅（稅 = 0，淨利 = 稅前）', () => {
    const r = wf({ rev: 1000, cogs: 900, opex: 150, nonOp: 0, taxRate: 0.2 });
    assert.equal(r.om, '-5.0%');
    assert.equal(r.nm, '-5.0%');
    assert.equal(r.labels[7], '0');
  });
  test('代工薄利預設：毛利率 7.0%、營益率 3.0%、淨利率 2.9%（35×0.82=28.7）', () => {
    const r = wf({ ...MarginWaterfall.PRESETS['代工薄利'] });
    assert.deepEqual([r.gm, r.om, r.nm], ['7.0%', '3.0%', '2.9%']);
  });
  test('營收 0：利潤率顯示「—」、SVG 不含 NaN', () => {
    const r = wf({ rev: 0, cogs: 0, opex: 0, nonOp: 0, taxRate: 0.2 });
    assert.deepEqual([r.gm, r.om, r.nm], ['—', '—', '—']);
    noBadTokens(r.body.innerHTML);
  });
  test('全部為 0（含業外）時圖表仍為合法數字座標', () => {
    const r = wf({ rev: 0, cogs: 0, opex: 0, nonOp: 0, taxRate: 0 });
    for (const m of r.body.innerHTML.matchAll(/ (?:x|y|width|height)="([^"]+)"/g)) assert.ok(Number.isFinite(Number(m[1])), m[0]);
  });
  test('瀑布圖各段高度相加一致：營收 − 成本 − 費用 + 業外 − 稅 = 淨利（性質測試 seed=11）', () => {
    const r = rng(11);
    for (let i = 0; i < 200; i++) {
      const s = { rev: Math.round(r() * 5000) + 100, cogs: Math.round(r() * 4000), opex: Math.round(r() * 1000), nonOp: Math.round(r() * 200 - 100), taxRate: Math.round(r() * 30) / 100 };
      const { nm } = wf(s);
      const pretax = s.rev - s.cogs - s.opex + s.nonOp;
      const net = pretax > 0 ? pretax * (1 - s.taxRate) : pretax;
      assert.equal(nm, pct(net / s.rev * 100), JSON.stringify(s));
    }
  });
});

describe('PEBands／EarningsQuality：圖下數字', () => {
  test('PEBands 最新 PE = 最新股價 ÷ 最新 EPS（三組預設）', () => {
    const expect = { '成長股': '22.0', '價值股': '12.7', '景氣循環': '25.0' };
    for (const [k, v] of Object.entries(expect)) {
      const body = createBody();
      PEBands.render(body, k);
      const d = PEBands.PRESETS[k];
      assert.equal((d.price.at(-1) / d.eps.at(-1)).toFixed(1), v);
      assert.match(body.innerHTML, new RegExp(`目前 PE 約 <strong>${v.replace('.', '\\.')}x</strong>`), k);
      noBadTokens(body.innerHTML);
    }
  });
  test('PEBands 各預設的價格與 EPS 期數一致（否則圖會錯位）', () => {
    for (const [k, d] of Object.entries(PEBands.PRESETS)) {
      assert.equal(d.price.length, d.eps.length, k);
      assert.ok(d.bands.every((b, i) => i === 0 || b > d.bands[i - 1]), `${k} 本益比帶需遞增`);
    }
  });
  test('EarningsQuality 最新一季 CFO ÷ 淨利（三組預設）', () => {
    const expect = { '健康（現金紮實）': '1.27', '品質下滑': '0.48', '地雷（現金背離）': '-0.33' };
    for (const [k, v] of Object.entries(expect)) {
      const body = createBody();
      EarningsQuality.render(body, k);
      assert.match(body.innerHTML, new RegExp(`CFO / 淨利 ≈ <strong>${v.replace('.', '\\.')}</strong>`), k);
    }
  });
});
