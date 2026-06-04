# WIP — FIN 台股美股財報自學系統

最後更新：2026-06-05（台北時間）/ Claude

## 現在狀態

- **v1.1 完成、可運作、已上線**。單檔 `index.html`（~253 KB）。線上：<https://people7771025.github.io/FIN/>
- 內容：intro + **31 章（ch1–31）** + 案例庫 + 名詞表 + 學習進度，分 **8 個 Part**（章節對照見 HANDOFF §2）。
- 互動元件 **11 種** + Quiz（10 組）+ 學習路徑：dupont / ratio / waterfall / trend / pebands / dividend / quality / redflag / industry / compare / **worksheet（六步工作底稿，可填可存可匯出）**。
- v1.1 重點：做了「能否養成獨立分析能力」的 5 視角審查，據此**補上實戰閉環**——
  - 新增 **Part Ⅷ ch29-31**：端到端走完一家公司 / 估值落地（DCF·PEG·PE 區間·殖利率）/ 實戰導覽（MOPS·EDGAR·中英科目對照）。
  - 新增 worksheet 工作底稿元件。
  - **11 處財務正確性補正**（SBC 對 CFO、P/B<1 語境、利息保障、FCF/股息、ROIC、杜邦口徑、PEG 代入、申報期限、商譽準則、銀行 ECL、ch5 折舊）。詳見 HANDOFF §7。
- 驗證（瀏覽器實跑）：**0 console error/warning**；35 section、29 widget 全 hydrate；杜邦/瀑布/比率/worksheet 計算與互動正確；10 組 quiz JSON 合法。

## 下一步（未做，皆非必要）

1. 內容續深化：產業樣本可加化工/航運/REITs；端到端範例可再加一個「地雷版」反例走查。
2. Cloudflare sync-worker（跨裝置同步進度）：目前 `CloudSync` 是停用 stub。
3. 練習可再加：錯題重練、間隔複習、capstone 綜合測驗。
4. 找人覆核：算式、台股/美股申報時程、MOPS/EDGAR 操作細節（會隨網站改版變動）。

## 卡點 / 注意

- 內容財務數字皆為**示意**，引用真實公司只作教學；正式對外引用前可再人工覆核。
- 不在 GDrive 路徑跑 build；單檔 HTML 無 node_modules。
- localStorage 前綴一律 `fin/`，與 OPT 隔離（同 origin 部署不會互相污染）。

## 參考

- 範本：`$HOME/Dev/OPT/index.html`
- 規格 + 補強記錄：本 repo `HANDOFF.md`
