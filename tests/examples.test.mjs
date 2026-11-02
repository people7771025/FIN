// 保護：各章「可計算的財報範例」文字數字與重算一致（差距需在顯示位數的四捨五入內）。
// 只讀 index.html，不執行頁面。範例公司（宏曜電子、同業 A／B 等）皆為頁面上的虛構示意數字。
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readIndex } from './helpers/load-script.mjs';

const html = readIndex();
const page = html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
const section = id => {
  const start = page.indexOf(`<section data-chapter="${id}">`);
  assert.ok(start >= 0, `找不到章節 ${id}`);
  return page.slice(start, page.indexOf('</section>', start));
};
const num = s => Number(String(s).replace(/<[^>]+>/g, '').replace(/[,%+\s]/g, '').replace('−', '-'));
/** 解析章節中「表頭包含 headerText」的表格 → { 列名: [數字...] } */
function table(chapterHtml, headerText) {
  const t = [...chapterHtml.matchAll(/<table\b[\s\S]*?<\/table>/g)].map(m => m[0]).find(x => x.includes(headerText));
  assert.ok(t, `找不到表頭含「${headerText}」的表格`);
  const rows = {};
  for (const r of t.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>([\s\S]*?)<\/tr>/g)) {
    rows[r[1].replace(/<[^>]+>/g, '').trim()] = [...r[2].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(c => num(c[1]));
  }
  return rows;
}
/** 顯示字串的小數位數 */
const decimals = s => { const m = /\.(\d+)/.exec(String(s)); return m ? m[1].length : 0; };
/** 「顯示值」是否為「真值」四捨五入到顯示位數的結果（容許 1e-9 浮點誤差） */
const roundsTo = (truth, shown, d) => Math.abs(truth - shown) <= 0.5 * 10 ** -d + 1e-9;

// 已知的內容錯誤（以 test.todo 記錄；修正 index.html 後即移除對應項目）
const KNOWN = {
  '營業利益 ÷ 利息費用 = 35.3 ÷ 1.5 ≈ 23 倍': '35.3 ÷ 1.5 = 23.53，四捨五入應為 24 倍或寫 23.5 倍'
};

describe('全頁 <code> 算式：等號兩側可計算者，結果需在四捨五入範圍內', () => {
  const UNIT = /億股|億|元／股|元|倍|次|天|年|股/g;
  const toJs = s => s.replace(UNIT, '').replace(/,/g, '').replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');
  const isNumericExpr = s => /\d/.test(s) && /^[\s\d.,%()+\-*/÷×−]+$/.test(s.replace(UNIT, ''));
  const checks = [];
  for (const m of page.matchAll(/<code>([^<]*)<\/code>/g)) {
    const parts = m[1].split(/[=≈＝]/).map(s => s.trim());
    for (let i = 0; i + 1 < parts.length; i++) {
      const lhs = parts[i], rhs = parts[i + 1];
      if (!isNumericExpr(lhs) || !/[÷×−+*/]/.test(lhs.replace(/^[+−-]/, ''))) continue;
      const line = html.slice(0, html.indexOf(m[0])).split('\n').length;
      const rhsClean = rhs.replace(UNIT, '').trim();
      if (isNumericExpr(rhs) && /[÷×*/]|\d\s*[−+-]\s*\d/.test(rhsClean)) { checks.push({ text: m[1], lhs, rhsExpr: rhs, line }); continue; }
      const rhsNum = /^[+−-]?[\d,]+(?:\.\d+)?%?$/.exec(rhsClean);
      if (!rhsNum) continue;
      checks.push({ text: m[1], lhs, rhs: rhsNum[0], line });
    }
  }
  test('至少找到 25 個可驗算的算式（防止正規式失效而空轉）', () => assert.ok(checks.length >= 25, String(checks.length)));
  for (const c of checks) {
    const t = KNOWN[c.text] ? test.todo : test;
    t(`第 ${c.line} 行：${c.text}${KNOWN[c.text] ? '（' + KNOWN[c.text] + '）' : ''}`, () => {
      if (c.rhsExpr) {
        const a = Function(`return (${toJs(c.lhs)})`)(), b = Function(`return (${toJs(c.rhsExpr)})`)();
        assert.ok(Math.abs(a - b) <= Math.abs(b) * 1e-9 + 1e-12, `${a} vs ${b}`);
        return;
      }
      const truth = Function(`return (${toJs(c.lhs)})`)();
      const shownIsPct = c.rhs.endsWith('%');
      const shown = num(c.rhs.replace('−', '-')) / (shownIsPct ? 100 : 1);
      // 輸入本身可能已四捨五入：容許「顯示位數半個單位」或 0.3% 相對誤差，取大者
      const d = decimals(c.rhs) + (shownIsPct ? 2 : 0);
      const tol = Math.max(0.5 * 10 ** -d, Math.abs(shown) * 0.003) + 1e-9;
      assert.ok(Math.abs(truth - shown) <= tol, `重算 ${truth} vs 文字 ${c.rhs}`);
    });
  }
});

describe('ch29 實戰演練：宏曜電子（示意）三年財報表', () => {
  const ch29 = section('ch29');
  const t = table(ch29, '營業收入');
  const years = [0, 1, 2];
  test('資產 ＝ 負債 ＋ 權益（每一年）', () => {
    for (const i of years) assert.equal(t['總資產'][i], t['總負債'][i] + t['股東權益'][i], `第 ${i + 1} 年`);
  });
  test('EPS ＝ 淨利 ÷ 5 億股（每一年；文中假設股數固定 5 億股）', () => {
    for (const i of years) assert.ok(roundsTo(t['稅後淨利'][i] / 5, t['EPS（元）'][i], 2));
  });
  test('三率表與財報表一致（毛利率、營益率、淨利率）', () => {
    const r = table(ch29, '毛利率');
    for (const i of years) {
      assert.ok(roundsTo(t['營業毛利'][i] / t['營業收入'][i] * 100, r['毛利率'][i], 1), `毛利率 ${i}`);
      assert.ok(roundsTo(t['營業利益'][i] / t['營業收入'][i] * 100, r['營業利益率'][i], 1), `營益率 ${i}`);
      assert.ok(roundsTo(t['稅後淨利'][i] / t['營業收入'][i] * 100, r['淨利率'][i], 1), `淨利率 ${i}`);
    }
  });
  test('股利發放率 ≤ 100%、FCF ≤ CFO（FCF＝CFO−資本支出，資本支出非負）', () => {
    for (const i of years) {
      assert.ok(t['每股現金股利（元）'][i] <= t['EPS（元）'][i]);
      assert.ok(t['自由現金流（FCF）'][i] <= t['營業活動現金流（CFO）'][i]);
    }
  });
  test('同業杜邦表：ROE ≈ 淨利率 × 總資產周轉率 × 權益乘數（每一家，容許輸入四捨五入）', () => {
    const p = table(ch29, '同業 A');
    for (const i of [0, 1, 2]) {
      const roe = p['淨利率'][i] * p['總資產周轉率'][i] * p['權益乘數'][i];
      // 三個輸入各自已四捨五入，誤差上界約 0.6pp
      assert.ok(Math.abs(roe - p['ROE'][i]) <= 0.6, `第 ${i + 1} 欄：重算 ${roe.toFixed(2)}% vs 表 ${p['ROE'][i]}%`);
    }
  });
  test('同業杜邦表：權益乘數 ≈ 1 ÷ (1 − 負債比)', () => {
    const p = table(ch29, '同業 A');
    for (const i of [0, 1, 2]) {
      const em = 1 / (1 - p['負債比'][i] / 100);
      assert.ok(Math.abs(em - p['權益乘數'][i]) <= 0.02, `第 ${i + 1} 欄：${em.toFixed(3)} vs ${p['權益乘數'][i]}`);
    }
  });
  test('同業杜邦表中宏曜那一欄與正文杜邦計算一致（18.0%、11.1%、0.95、1.71、41.5%）', () => {
    const p = table(ch29, '同業 A');
    assert.deepEqual([p['ROE'][0], p['淨利率'][0], p['總資產周轉率'][0], p['權益乘數'][0], p['負債比'][0]], [18, 11.1, 0.95, 1.71, 41.5]);
  });
  test('判讀文字「三家 ROE（16～19%）」與表格最小／最大 ROE 一致', () => {
    const p = table(ch29, '同業 A');
    const m = /三家 ROE 看起來差不多（(\d+)～(\d+)%）/.exec(ch29);
    assert.ok(m);
    assert.equal(Number(m[1]), Math.floor(Math.min(...p['ROE'])));
    assert.equal(Number(m[2]), Math.floor(Math.max(...p['ROE'])));
  });
  test.todo('第 3 步判讀：引用的應收／存貨區間與營收成長是同一期間，且確實低於營收成長', () => {
    const m = /營收成長 (\d+)%、但應收（(\d+)→(\d+)）與存貨（(\d+)→(\d+)）增幅低於營收增幅/.exec(ch29);
    assert.ok(m, '找不到判讀句');
    const [, g, ar0, ar1, inv0, inv1] = m.map(Number);
    const rev = t['營業收入'], ar = t['應收帳款'], inv = t['存貨'];
    assert.ok(roundsTo((rev[2] / rev[1] - 1) * 100, g, 0), '營收成長應為最近一年');
    assert.deepEqual([ar0, ar1], [ar[1], ar[2]], '應收應引用與營收相同的最近一年');
    assert.deepEqual([inv0, inv1], [inv[1], inv[2]], '存貨應引用與營收相同的最近一年');
    assert.ok(ar1 / ar0 - 1 < g / 100 && inv1 / inv0 - 1 < g / 100);
  });
});

describe('ch30 估值落地：DCF 敏感度文字', () => {
  const ch30 = section('ch30');
  // 頁面範例：第 5 年 FCF 136、折現率 10%、永續成長 3%
  const fcf5 = 136, r = 0.10, g = 0.03;
  const tv = (rr, gg) => fcf5 * (1 + gg) / (rr - gg);
  test('基準 TV ≈ 2,001（136 × 1.03 ÷ 0.07）', () => {
    assert.match(ch30, /140\.1 ÷ 0\.07 ≈ 2,001/);
    assert.equal(Math.floor(tv(r, g)), 2001);
  });
  test('「折現率 10%→9%，TV 暴增約 N%」的 N 等於重算四捨五入', () => {
    const m = /折現率從 10% 改成 9%[^<]*?TV 暴增約 (\d+)%/.exec(ch30);
    assert.ok(m);
    assert.equal(Number(m[1]), Math.round((tv(0.09, g) / tv(r, g) - 1) * 100));
  });
  test.todo('「永續成長率 3%→4%，TV 大漲約 N%」的 N 等於重算四捨五入（分子 FCF₆ 也會變大）', () => {
    const m = /永續成長率從 3% 改成 4%[^<]*?TV [^<]*?約 (\d+)%/.exec(ch30);
    assert.ok(m);
    assert.equal(Number(m[1]), Math.round((tv(r, 0.04) / tv(r, g) - 1) * 100));
  });
  test('終值佔企業價值約 74%（1,243 ÷ 1,681）', () => {
    assert.match(ch30, /1,243 億（約 74%）/);
    assert.equal(Math.round(1243 / 1681 * 100), 74);
  });
});

describe('ch5 三表串聯：小明公司範例', () => {
  test('CFO、FCF、保留盈餘變化與三表平衡', () => {
    const ch5 = section('ch5');
    // 只驗證頁面文字中的關鍵數字存在，並以同一組前提重算
    for (const s of ['90', '30', '60']) assert.ok(ch5.includes(s));
    const ni = 100, dep = 20, wc = -30, capex = 60, div = 40;
    const cfo = ni + dep + wc, fcf = cfo - capex;
    assert.equal(cfo, 90);
    assert.equal(fcf, 30);
    assert.equal(ni - div, 60); // 保留盈餘 +60
    assert.equal(div - fcf, 10); // 股利超過 FCF 的缺口
    // 資產變動：現金 (cfo − capex − div) + 營運資金 30 + PP&E (capex − dep) = 權益變動 60
    assert.equal((cfo - capex - div) + 30 + (capex - dep), ni - div);
  });
});
