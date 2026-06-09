# 台股美股財報自學系統（FIN）

一份**離線可開、單檔 HTML**的財報判讀自學手冊，覆蓋台股與美股、橫跨不同產業與個股。
目標：把「看財報時該關注哪些數據、以及這些數據的**變化**代表什麼」講清楚，從三大報表一路帶到產業差異與個股實戰。

> 結構與互動引擎沿用姊妹專案 [OPT](https://github.com/people7771025/OPT)（美股期權＋台股期貨自學系統）。

## 線上版

🔗 **<https://people7771025.github.io/FIN/>**（GitHub Pages；首次部署需幾分鐘生效）

## 怎麼用

### 線上閱讀
直接打開 Pages 連結即可。

### 離線閱讀
1. 下載 `index.html` 一個檔案
2. 雙擊開啟瀏覽器
3. 進度、書籤、錯題與設定自動保存在瀏覽器 localStorage

### 學習路徑（依需求選一條）

| 路徑 | 適合誰 | 時長 | 內容 |
|---|---|---|---|
| **快速看懂** | 想看懂一張財報不踩雷 | 4–6h | Part Ⅰ + Part Ⅲ + 決策 checklist |
| **存股 / 價值** | 長期持有想體檢公司 | ~15h | + Part Ⅱ 比率 + Part Ⅴ 對應產業 + 案例 |
| **完整路徑** | 系統性學財報分析 | ~40h | 全章 + 全案例 + Quiz |

## 內容範圍

- **Part Ⅰ 財報基礎**：三大報表（損益表 / 資產負債表 / 現金流量表）+ 三表串聯；台股 MOPS、美股 SEC EDGAR 從哪抓
- **Part Ⅱ 關鍵財務比率**：獲利能力 / 成長性 / 安全性 / 經營效率 / 評價（P/E·P/B·PEG·殖利率）
- **Part Ⅲ 看「變化」的訊號** ⭐：趨勢判讀、毛利率與成本變化、存貨/應收暴增警訊、現金流 vs 淨利（盈餘品質）、一次性 vs 經常性、財報地雷
- **Part Ⅳ 台股 vs 美股**：月營收 / 法說會 / IFRS vs 10-K · 10-Q · 8-K / GAAP·Non-GAAP / guidance
- **Part Ⅴ 不同產業重點**：半導體 / 金融 / 零售消費 / 製造傳產 / 軟體 SaaS / 生技 / 景氣循環
- **Part Ⅵ 個股實戰案例**：台積電、鴻海、金融股、AAPL、NVDA、SaaS、地雷案例
- **Part Ⅶ 決策框架**：看財報 SOP、不同投資風格視角、財報＋估值結合
- **Part Ⅷ 從框架到實戰** 🎯：完整端到端走查一家公司（六步 SOP 跑完）、地雷反例排雷、估值落地（DCF／PEG／本益比區間／殖利率法算出一個數）、去哪抓與怎麼讀真實財報（MOPS／SEC EDGAR 操作、中英科目對照、同業與多期資料工序）

## 互動元件

- **DuPontDecomposer** — ROE 杜邦拆解（淨利率 × 週轉 × 權益乘數）
- **RatioCalculator** — 輸入財報數字即時算各項比率
- **MarginWaterfall** — 營收 → 各層獲利瀑布圖
- **TrendVisualizer** — 多季數據趨勢（毛利率 / 營收 YoY）
- **EarningsQuality** — 盈餘品質檢查（營業現金流 vs 淨利背離）
- **PEBands** — 本益比河流圖
- **DividendSimulator** — 殖利率 / 填息試算
- **IndustryMetricPicker** — 選產業 → 顯示該盯的指標
- **RedFlagScanner** — 財報地雷訊號 checklist
- **CompanyCompare** — 兩家公司比一比
- **看財報工作底稿（Worksheet）** — 六步體檢可填、可標紅旗、自動存、即時自我檢核、可匯出文字
- **Quiz + 錯題重練** — 答錯題自動收入進度頁，答對或標為已掌握後移出
- **LLM 助教** — 自帶 Gemini key，會自動帶入當前章節作為 context

## ⚠️ 重要聲明

- 本系統純為**學習用途**，不構成任何投資建議
- 財報數字、會計準則、申報時程會隨主管機關規定變動，實際以 MOPS / SEC 公告為準
- 範例中的公司財務數字多為示意，幫助理解概念，不代表任何時點的真實申報數據；引用真實公司僅作教學案例

## 開發

單檔 HTML，無 build step。直接編輯 `index.html`。
新增章節：複製 `<section data-chapter="...">` 模板。
新增互動：放 `<div class="widget" data-component="...">` 佔位，於檔尾 `hydrateAll()` 註冊。

詳見 `HANDOFF.md`。

## License

MIT
