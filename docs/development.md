# FIN 開發指南

給接手修改內容或互動的人（含 AI agent）。規範細節（章節對照表、CSS class、元件 key、寫作準則）在
[`HANDOFF.md`](../HANDOFF.md)，本檔只講「怎麼動手、怎麼驗、怎麼發布」。

## 檔案結構

```
index.html   主檔：<head> 設計系統 CSS → <body> 各章 <section> → 檔尾引擎 JS、window.V2 題庫、v2.js
v2.css       learn-v2 閱讀排版與練習卡樣式（只作用在 body[data-v2]）
v2.js        learn-v2 每段練習＋Leitner 間隔複習（讀 window.V2）
HANDOFF.md   規格與歷次補強紀錄
WIP.md       現在狀態、下一步、注意事項
```

沒有 `package.json`、沒有 build step，也不需要 `npm install`。引擎（進度、書籤、完成、複習、LLM 助教、PWA、
快速鍵、雲端同步 stub）沿用姊妹專案 OPT；改引擎前先對照 OPT 的同名實作。

## 本機預覽

直接雙擊 `index.html` 即可。要模擬線上環境（相對路徑、PWA manifest）可起一個靜態伺服器：

```bash
python3 -m http.server 8000
```

然後開 <http://localhost:8000/>。

## 常見修改

### 新增或修改章節

1. 複製既有的 `<section data-chapter="chN">…</section>`，沿用 HANDOFF §3 的 class（callout、badge、case、table），**不要加自訂 CSS**。
2. 在 `<aside class="sidebar">` 的對應 `nav-group` 加 `<a class="nav-item" href="#chN">`，並同步更新 HANDOFF §2 的章節對照表。
3. 把章節 id 依閱讀順序加進檔尾 `window.V2.order`。
4. learn-v2 的章首定位（`.v2-bridge`，含「全書第 N/36 章」）與章末上一章／下一章（`.v2-next`）是寫死在 HTML 的，
   插入新章時前後章與總章數都要一起改。

### 新增互動元件

1. 在章節內放佔位（格式見 HANDOFF §4）：`<div class="widget" data-component="<key>">…</div>`。
2. 在檔尾引擎實作元件，並於 `hydrateAll()` 註冊同一個 key。
3. 元件狀態要存 localStorage 時一律用 `fin/` 前綴，並把新 key 補進 HANDOFF §5。

### 章末 Quiz（舊版、資料寫在 HTML 屬性）

`data-questions` 是 JSON 陣列：`{"q","opts":[…],"correct":索引,"explain"}`。屬性外層用單引號，題目文字裡不能出現未跳脫的 `'`。

### 每段練習（learn-v2）

- 段落後放插槽：`<div class="v2-quiz" data-seg="ch1-s1" data-chapter="ch1" data-qids="fin-ch1-s1-g1,fin-ch1-s1-g2"></div>`
- 題目放在檔尾 `window.V2.q`，key 與 `id` 相同：
  `{"id","chapter","question","options":{"A":…,"B":…},"answer":"B","explanation","difficulty"}`
- 一章最後一個插槽會自動變成「章末練習／章末複習」；複習只抽**前面段落**已答過且到期的題。
- 練習紀錄存在 `fin/v2-srs`（`mode: "private"` 時為 `fin/v2-srs-private`）。

## 驗證

改完至少跑這兩項（不需安裝任何套件，只要 Node.js）：

```bash
node --check v2.js
```

```bash
node -e '
const h=require("fs").readFileSync("index.html","utf8");
const qs=[...h.matchAll(/data-questions='"'"'([\s\S]*?)'"'"'>/g)];
let bad=0; qs.forEach(m=>{try{JSON.parse(m[1])}catch(e){bad++}});
console.log("quiz blocks",qs.length,"bad",bad);
[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m,i)=>{try{new Function(m[1])}catch(e){console.log("script",i,e.message);process.exitCode=1}});
if(bad) process.exitCode=1;'
```

改到畫面或互動時，再用瀏覽器實際開啟，確認 console 沒有錯誤、各元件都有 hydrate、手機寬度可讀。

## 發布

- push 到 `main` 後由 GitHub Pages 自動發布到 <https://people7771025.github.io/FIN/>，沒有其他部署步驟。
- 改動走分支＋PR，由 owner 合併。
- 收工更新 `WIP.md`（現在狀態／下一步）；章節、元件、localStorage key 或流程有變時同步 `HANDOFF.md`。

## 內容紀律

- 一律繁體中文，術語第一次出現附英文。
- 財務數字標明為示意；引用真實公司只作教學，不寫成投資建議。
- 申報時程、會計準則、MOPS／EDGAR 操作會變動，改寫時以主管機關最新公告為準。
