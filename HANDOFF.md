# HANDOFF — FIN 台股美股財報自學系統

最後更新：2026-06-04（台北時間）/ Claude

## 1. 專案定位

- 單檔 HTML（`index.html`）、離線可開、零 build step、localStorage 存進度。
- 主題：**財報判讀**——三大報表 → 關鍵比率 → 看「變化」的訊號 → 台股/美股差異 → 產業差異 → 個股案例 → 決策框架。
- 引擎（CSS 設計系統 + 進度/書籤/完成/複習/LLM 助教/PWA/快速鍵/雲端同步）整套沿用姊妹專案 `$HOME/Dev/OPT`，只換主題文字與互動元件。OPT 是修改基底與唯一參考實作。

## 2. 章節編號方案（sidebar 導覽順序）

| id | Part | 標題 | 互動元件 |
|---|---|---|---|
| `intro` | — | 首頁 + 學習路徑 | path（LearningPathBuilder） |
| `ch1` | Ⅰ 財報基礎 | 為什麼看財報 + 三表全景 + 從哪抓（MOPS / SEC EDGAR） | — |
| `ch2` | Ⅰ | 損益表 Income Statement | waterfall（MarginWaterfall） |
| `ch3` | Ⅰ | 資產負債表 Balance Sheet | — |
| `ch4` | Ⅰ | 現金流量表 Cash Flow | — |
| `ch5` | Ⅰ | 三表如何串聯 + Quiz | quiz |
| `ch6` | Ⅱ 關鍵比率 | 獲利能力（毛利率/營益率/淨利率/ROE/ROA） | dupont + ratio |
| `ch7` | Ⅱ | 成長性（YoY/QoQ/CAGR） | trend |
| `ch8` | Ⅱ | 安全性（負債比/流動·速動/利息保障） | — |
| `ch9` | Ⅱ | 經營效率（存貨/應收/總資產週轉、現金循環） | — |
| `ch10` | Ⅱ | 評價（P/E·P/B·PEG·EV/EBITDA·殖利率）+ Quiz | pebands + dividend + quiz |
| `ch11` | Ⅲ 看變化⭐ | 趨勢判讀：怎麼看連續幾季的方向 | trend |
| `ch12` | Ⅲ | 毛利率與成本結構的變化 | — |
| `ch13` | Ⅲ | 存貨 / 應收暴增的警訊 | — |
| `ch14` | Ⅲ | 現金流 vs 淨利：盈餘品質 | quality（EarningsQuality） |
| `ch15` | Ⅲ | 一次性 vs 經常性損益、業外佔比 | — |
| `ch16` | Ⅲ | 財報地雷訊號總整理 + Quiz | redflag + quiz |
| `ch17` | Ⅳ 台股vs美股 | 台股財報生態（月營收/MOPS/法說/IFRS） | — |
| `ch18` | Ⅳ | 美股財報生態（10-K/10-Q/8-K、GAAP vs Non-GAAP、guidance、earnings call） | — |
| `ch19` | Ⅳ | 會計準則與揭露差異對照 + Quiz | quiz |
| `ch20` | Ⅴ 產業 | 半導體 / 科技硬體 | industry |
| `ch21` | Ⅴ | 金融（銀行 / 保險：NIM、逾放、資本適足） | industry |
| `ch22` | Ⅴ | 零售 / 消費（SSSG、來客、存貨） | industry |
| `ch23` | Ⅴ | 製造 / 傳產 / 景氣循環（稼動率、運價、淨值） | industry |
| `ch24` | Ⅴ | 軟體 / SaaS（ARR、留存、Rule of 40、燒錢） | industry |
| `ch25` | Ⅴ | 生技 / 製藥（管線、現金跑道）+ Quiz | industry + quiz |
| `cases` | Ⅵ 案例 | 個股實戰案例庫（台積/鴻海/金融/AAPL/NVDA/SaaS/地雷） | compare |
| `ch26` | Ⅶ 決策 | 看財報 SOP + 快速體檢 checklist | — |
| `ch27` | Ⅶ | 不同投資風格的視角（價值/成長/存股） | — |
| `ch28` | Ⅶ | 財報 + 估值結合 + Quiz | quiz |
| `ch29` | Ⅷ 從框架到實戰 | 實戰演練：端到端走完一家公司（示意公司宏曜電子，六步 SOP 全跑）+ Quiz | worksheet + quiz |
| `ch30` | Ⅷ | 估值落地：DCF / PEG / 本益比區間 / 殖利率法算出一個數 + Quiz | quiz |
| `ch31` | Ⅷ | 實戰導覽：MOPS / SEC EDGAR 怎麼抓、中英科目對照、同業與多期資料 + Quiz | quiz |
| `glossary` | 附錄 | 名詞表（中英對照） | glossary-search |
| `progress` | 附錄 | 學習進度 dashboard | — |

## 3. CSS class 規範（內容必須用這些既有 class，零自訂 CSS）

- 章節：`<section data-chapter="chN"><h1>標題</h1> ... </section>`
- 標題層級：`h2`（大段，會自動加上分隔線）、`h3`（小段）
- callout：`<div class="callout [warn|danger|success]"><div class="callout-title">標題</div><p>...</p></div>`
- badge（行內標記）：`<span class="badge core|op|adv">文字</span>`（core=核心觀念、op=實務操作、adv=進階）
- 摺疊：`<details><summary>標題</summary> 內文 </details>`
- 表格：標準 `<table><thead><tr><th>...</th></tr></thead><tbody>...</tbody></table>`
- 案例卡：`<div class="case"><div class="case-header"><span class="case-tag">標籤</span><span class="case-title">標題</span></div> ... </div>`
  - 情境列：`<div class="scenarios"><div class="scenario"><span class="when">情境</span><span>說明</span><span class="pnl pos|neg|neutral">結果</span></div></div>`

## 4. 互動元件（data-component 佔位 → 檔尾 hydrate）

放佔位即可，JS 由引擎統一 hydrate：
```html
<div class="widget" data-component="<key>" [data-* JSON]>
  <div class="widget-header">
    <div class="widget-title"><span class="icon">📊</span>元件名 · 一句說明</div>
    <div class="widget-meta">操作提示</div>
  </div>
  <div class="widget-body"></div>
</div>
```
key 對照：`path` `waterfall` `dupont` `ratio` `trend` `pebands` `dividend` `quality` `redflag` `industry` `compare` `worksheet` `quiz`。
（`worksheet` = 六步看財報工作底稿，可填／標紅旗／自動存 localStorage／匯出文字；只放在 ch29，ch30/ch31 改用連到 ch29 的導引。）

Quiz 用資料驅動：
```html
<div class="widget" data-component="quiz" data-questions='[
  {"q":"題幹","opts":["A","B","C","D"],"correct":1,"explain":"解析"}
]'>
  <div class="widget-header"><div class="widget-title"><span class="icon">📝</span>本章測驗</div></div>
  <div class="widget-body"></div>
</div>
```

## 5. localStorage keys（沿用 OPT 命名，前綴改 `fin/`）

`fin/state` `fin/visited` `fin/bookmark` `fin/completed` `fin/completed-ts` `fin/learning-plan` `fin/worksheet` `fin/gemini-key` `fin/chat-history` `fin/sync-code`

## 6. 內容寫作準則

- 一律繁體中文；對非工程/會計背景讀者用白話先講「這個數字看什麼、變化代表什麼」。
- 中英對照：第一次出現的術語給中文（English），如 毛利率（Gross Margin）。
- 每個比率都要有：定義 → 算式 → 看高還看低 → **變化方向的意義** → 常見陷阱。
- 數字案例標明為示意；引用真實公司（台積電/AAPL 等）僅作教學，不寫成投資建議。
- 台股慣例：月營收每月 10 日前公告、財報 Q1/Q2/Q3/年報申報期限、MOPS 公開資訊觀測站。
- 美股慣例：10-K（年報）/10-Q（季報）/8-K（重大事件）、GAAP vs Non-GAAP、guidance、earnings call。

## 7. 能力審查與補強（2026-06-05）

對「研讀後能否獨立分析台美股財報」做了 5 視角多代理審查（能力清單對照 / 新手實戰模擬 / 端到端流程 / 練習充分性 / 正確性抽查）。結論：**判讀力約 80 分、實戰閉環約 55 分**——對著攤開的財報能做扎實判讀與排雷，但「從零取得資料→整理多期/同業→收斂成具體合理價」有斷鏈。據此補強（能力導向、不灌水）：

- **新增 Part Ⅷ（ch29-31）**：ch29 端到端走完一家公司（示意公司宏曜電子，六步 SOP 全跑、杜邦、同業比、下結論）；ch30 估值落地（DCF / PEG / 本益比區間 / 殖利率法算出一個數）；ch31 實戰導覽（MOPS / SEC EDGAR 操作、中英科目對照、同業與多期資料工序、「換你做」作業）。
- **worksheet 工作底稿元件**：六步看財報可填可存可匯出，兌現「做一份固定模板」。
- **11 處正確性補正**：SBC 非現金費用會灌高 CFO/淨利（ch14）、P/B<1 語境要看景氣（ch10→ch23）、利息保障不含本金到期（ch8）、FCF 判股息要分維持/擴張 capex（ch27）、ROIC 定義（ch6）、杜邦口徑一致、PEG 取百分比數字、ch1 半年報期限對齊 ch17、商譽 IFRS/GAAP、銀行 IFRS 9 ECL、ch5 折舊假設。

審查報告原始輸出在 session transcript（workflow w8w19ppkn）；本檔僅留結論。

## 8. 待辦 / 下一步

見 `WIP.md`。
