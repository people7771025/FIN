// 保護：DividendSimulator（Ch10 殖利率／填息試算）顯示數字與手算一致。
// 頁面實際提供：現金殖利率、股利發放率、股利回本年數、填息需漲、持有 N 年領息、除息參考價。
// 頁面「沒有」：股利所得稅、二代健保補充保費、填息天數、台美股口徑切換 → 不測（見 PR「未完成項目」）。
// 所有輸入皆為虛構數字。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, createBody, readStats, readStatClasses, pct, rng } from './helpers/load-script.mjs';

const { api } = loadApp();
const { DividendSimulator, fmt } = api;

function sim(over = {}) {
  const body = createBody();
  DividendSimulator.render(body, { ...DividendSimulator.defaults, ...over });
  const stats = readStats(body.innerHTML);
  const years = (over.years ?? DividendSimulator.defaults.years);
  return {
    body,
    cls: readStatClasses(body.innerHTML),
    yld: stats['現金殖利率'],
    payout: stats['股利發放率'],
    recover: stats['股利回本年數（不計填息）'],
    fill: stats['填息需漲'],
    total: stats[`持有 ${years} 年領息`],
    ex: stats['除息參考價'],
    stats
  };
}
const noBadTokens = html => assert.doesNotMatch(html, /NaN|undefined|Infinity/);

describe('DividendSimulator：預設值手算（股價100、股利5、EPS 8、10 年）', () => {
  const r = sim();
  test('現金殖利率 = 5/100 = 5.0%，且 ≥5% 標綠', () => { assert.equal(r.yld, '5.0%'); assert.equal(r.cls['現金殖利率'], 'pos'); });
  test('股利發放率 = 5/8 = 62.5%，落在 40–80% 標綠', () => { assert.equal(r.payout, '62.5%'); assert.equal(r.cls['股利發放率'], 'pos'); });
  test('股利回本年數 = 100/5 = 20.0 年', () => assert.equal(r.recover, '20.0 年'));
  test('除息參考價 = 100 − 5 = 95.0', () => assert.equal(r.ex, '95.0'));
  test('填息需漲 = 5/95 = 5.263…% → 5.3%（以除息價為基期，不是原價）', () => {
    assert.equal(r.fill, '5.3%');
    assert.notEqual(r.fill, '5.0%', '若誤以原價為基期會是 5.0%');
  });
  test('持有 10 年領息 = 5×10 = 50.0', () => assert.equal(r.total, '50.0'));
  test('六個統計格都存在', () => assert.equal(Object.keys(r.stats).length, 6));
});

describe('DividendSimulator：其他手算組合', () => {
  test('高價低息：股價 600、股利 15、EPS 40 → 殖利率 2.5%、發放率 37.5%（<40 不標色）、回本 40.0 年、填息 2.6%', () => {
    const r = sim({ price: 600, dps: 15, eps: 40 });
    assert.deepEqual([r.yld, r.payout, r.recover, r.fill, r.ex], ['2.5%', '37.5%', '40.0 年', '2.6%', '585.0']);
    assert.equal(r.cls['現金殖利率'], '');
    assert.equal(r.cls['股利發放率'], '');
  });
  test('小數股利：股價 35.5、股利 1.8 → 殖利率 5.07…% → 5.1%、除息價 33.7', () => {
    const r = sim({ price: 35.5, dps: 1.8 });
    assert.equal(r.yld, '5.1%');
    assert.equal(r.ex, '33.7');
    assert.equal(r.fill, pct(1.8 / 33.7 * 100));
  });
  test('持有年數 3 → 標籤與金額同步改為「持有 3 年領息」15.0', () => {
    const r = sim({ years: 3 });
    assert.equal(r.total, '15.0');
  });
  test('大額股利與千分位：股利 1234.5 × 10 年 = 12,345.0', () => {
    const r = sim({ price: 50000, dps: 1234.5, years: 10 });
    assert.equal(r.total, '12,345.0');
    assert.equal(r.ex, '48,765.5');
  });
  test('性質測試（seed=99, 300 組）：殖利率 × 回本年數 ≈ 100%、填息幅度使除息價回到原價', () => {
    const r = rng(99);
    for (let i = 0; i < 300; i++) {
      const price = Math.round(r() * 1000 * 10) / 10 + 1;
      const dps = Math.round(r() * price * 0.5 * 100) / 100 + 0.01;
      const out = sim({ price, dps, eps: 1 });
      assert.equal(out.yld, pct(dps / price * 100));
      assert.equal(out.recover, (price / dps).toFixed(1) + ' 年');
      const ex = price - dps, need = dps / ex;
      assert.ok(Math.abs(ex * (1 + need) - price) < 1e-9, '除息價 × (1+填息需漲) 應回到原價');
      assert.equal(out.fill, pct(need * 100));
    }
  });
});

describe('DividendSimulator：發放率著色邊界', () => {
  test('剛好 40% 與 80% → 綠；80.1% → 無色；90% → 無色；90.1% → 紅', () => {
    assert.equal(sim({ dps: 4, eps: 10 }).cls['股利發放率'], 'pos');
    assert.equal(sim({ dps: 8, eps: 10 }).cls['股利發放率'], 'pos');
    assert.equal(sim({ dps: 8.01, eps: 10 }).cls['股利發放率'], '');
    assert.equal(sim({ dps: 9, eps: 10 }).cls['股利發放率'], '');
    assert.equal(sim({ dps: 9.01, eps: 10 }).cls['股利發放率'], 'neg');
  });
  test('配得比賺得多（發放率 > 100%）標紅', () => {
    const r = sim({ dps: 12, eps: 8 });
    assert.equal(r.payout, '150.0%');
    assert.equal(r.cls['股利發放率'], 'neg');
  });
  test('殖利率剛好 5% → 綠；4.99% → 無色', () => {
    assert.equal(sim({ price: 100, dps: 5 }).cls['現金殖利率'], 'pos');
    assert.equal(sim({ price: 100, dps: 4.99 }).cls['現金殖利率'], '');
  });
});

describe('DividendSimulator：零股利、零／負價格、極端值', () => {
  test('零股利：殖利率 0.0%、發放率 0.0%、填息 0.0%、除息價 = 股價、不出現 NaN', () => {
    const r = sim({ dps: 0 });
    assert.deepEqual([r.yld, r.payout, r.fill, r.ex, r.total], ['0.0%', '0.0%', '0.0%', '100.0', '0.0']);
    noBadTokens(r.body.innerHTML);
  });
  test.todo('疑似 bug：零股利時「股利回本年數」顯示 0.0 年（應為「—」或「永不回本」）', () => {
    assert.notEqual(sim({ dps: 0 }).recover, '0.0 年');
  });
  test('股價 0：殖利率以 0 代替（現行行為），除息價為負，不出現 NaN', () => {
    const r = sim({ price: 0 });
    assert.equal(r.yld, '0.0%');
    assert.equal(r.ex, '-5.0');
    assert.equal(r.fill, '0.0%');
    noBadTokens(r.body.innerHTML);
  });
  test('股利 ≥ 股價（極端殖利率 100%+）：填息顯示 0.0%（現行行為），除息價 ≤ 0', () => {
    const r = sim({ price: 10, dps: 10 });
    assert.equal(r.yld, '100.0%');
    assert.equal(r.ex, '0.0');
    assert.equal(r.fill, '0.0%');
  });
  test.todo('疑似 bug：除息參考價 ≤ 0 時，「填息需漲」顯示 0.0%（會被誤讀為不需上漲），應顯示「—」', () => {
    assert.equal(sim({ price: 10, dps: 12 }).fill, '—');
  });
  test('負股價（不合理輸入）：不丟例外、不出現 NaN', () => {
    const r = sim({ price: -50 });
    assert.equal(r.yld, '-10.0%');
    noBadTokens(r.body.innerHTML);
  });
  test('EPS 為 0：發放率以 0 代替；EPS 為負：發放率為負數且不標色（現行行為，見「待使用者決定」）', () => {
    assert.equal(sim({ eps: 0 }).payout, '0.0%');
    const neg = sim({ eps: -2 });
    assert.equal(neg.payout, '-250.0%');
    assert.equal(neg.cls['股利發放率'], '');
  });
  test('極小股價 1e-300 與極大股利 1e300：殖利率溢位以「—」顯示而非 Infinity', () => {
    const r = sim({ price: 1e-300, dps: 1e300 });
    assert.equal(r.yld, '—');
    noBadTokens(r.body.innerHTML);
  });
  test('持有年數 0 → 領息 0.0；小數年數 2.5 → 12.5', () => {
    assert.equal(sim({ years: 0 }).total, '0.0');
    assert.equal(sim({ years: 2.5 }).total, '12.5');
  });
  test('清空股利欄位（空字串）→ 以 0 計算，標籤不出現 NaN', () => {
    const r = sim();
    r.body.type('dps', '');
    const s = readStats(r.body.innerHTML);
    assert.equal(s['現金殖利率'], '0.0%');
    noBadTokens(r.body.innerHTML);
  });
  test('清空年數欄位 → 標籤變「持有 0 年領息」', () => {
    const r = sim();
    r.body.type('years', '');
    assert.equal(readStats(r.body.innerHTML)['持有 0 年領息'], '0.0');
  });
  test('連續輸入：改股價後再改股利，兩者都生效', () => {
    const r = sim();
    r.body.type('price', '200');
    r.body.type('dps', '10');
    const s = readStats(r.body.innerHTML);
    assert.equal(s['現金殖利率'], '5.0%');
    assert.equal(s['除息參考價'], '190.0');
    assert.equal(DividendSimulator.defaults.price, 100, 'defaults 不得被改寫');
  });
});

describe('除息日前後價格關係', () => {
  test('除息參考價 = 前一日收盤 − 現金股利；填息 = 股價回到除息前收盤', () => {
    // 虛構：除息前收盤 80、股利 3.2 → 參考價 76.8；需漲 3.2/76.8 = 4.1666…% → 4.2%
    const r = sim({ price: 80, dps: 3.2 });
    assert.equal(r.ex, '76.8');
    assert.equal(r.fill, '4.2%');
    assert.equal(fmt(76.8 * (1 + 3.2 / 76.8), 1), '80.0');
  });
  test('提示文字說明公式口徑（股利 ÷ 股價、股利 ÷ EPS、股價 − 股利）', () => {
    const html = sim().body.innerHTML;
    for (const t of ['股利 ÷ 股價', '股利 ÷ EPS', '股價 − 股利', '除息後回到原價']) assert.ok(html.includes(t), t);
  });
});
