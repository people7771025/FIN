# WIP — FIN 台股美股財報自學系統

最後更新：2026-06-09（台北時間）/ Codex

## 現在狀態

- **v1.2 學習閉環補強完成**。單檔 `index.html`，線上仍為 <https://people7771025.github.io/FIN/>（push 後 Pages 自動部署）。
- 內容：intro + **32 章（ch1–32）** + 案例庫 + 名詞表 + 學習進度，分 **8 個 Part**（章節對照見 HANDOFF §2）。
- **2026-06-05 新增 ch32「當紅主流產業速查」**（版面排在 Part Ⅴ 產業末、ch25 之後）：依現今主流產業擴大教學——地緣政治線（軍工）、AI 算力供應鏈、光通訊/CPO/矽光子、循環與零組件（封測等）、能源轉型與防禦型；industry 選擇器預設顯示熱門產業。已過完整驗證（瀏覽器實跑、0 console error、quiz JSON 合法）。
- 互動元件 **11 種** + Quiz（12 組）+ 學習路徑：dupont / ratio / waterfall / trend / pebands / dividend / quality / redflag / industry / compare / **worksheet（六步工作底稿，可填可存、即時自我檢核、可匯出）**。
- 本輪補強：
  - Quiz 答錯會進 `fin/quiz-review`，進度頁顯示「錯題重練」，答對或標為已掌握後移出。
  - ch29 補「景峰通路」地雷反例走查 + 反例小測驗，訓練低 PE / 高成長表象下的 No-Go 判斷。
  - worksheet 新增完整度分數、待補欄位、紅旗提醒。
- v1.1 重點：做了「能否養成獨立分析能力」的 5 視角審查，據此**補上實戰閉環**——
  - 新增 **Part Ⅷ ch29-31**：端到端走完一家公司 / 估值落地（DCF·PEG·PE 區間·殖利率）/ 實戰導覽（MOPS·EDGAR·中英科目對照）。
  - 新增 worksheet 工作底稿元件。
  - **11 處財務正確性補正**（SBC 對 CFO、P/B<1 語境、利息保障、FCF/股息、ROIC、杜邦口徑、PEG 代入、申報期限、商譽準則、銀行 ECL、ch5 折舊）。詳見 HANDOFF §7。
- 驗證：`node` 解析 12 組 quiz JSON OK；抽出 `<script>` 後 `new Function()` JS parser OK；功能存在性檢查 OK。瀏覽器 localhost 實跑因本環境 Browser enterprise policy 擋 `127.0.0.1`，未做互動實跑。

## 下一步（未做，皆非必要）

1. 內容續深化：產業樣本可加化工/航運/REITs。
2. Cloudflare sync-worker（跨裝置同步進度）：目前 `CloudSync` 是停用 stub。
3. 練習可再加：間隔複習題庫、capstone 綜合測驗。
4. 找人覆核：算式、台股/美股申報時程、MOPS/EDGAR 操作細節（會隨網站改版變動）。

## 卡點 / 注意

- 內容財務數字皆為**示意**，引用真實公司只作教學；正式對外引用前可再人工覆核。
- 不在 GDrive 路徑跑 build；單檔 HTML 無 node_modules。
- localStorage 前綴一律 `fin/`，與 OPT 隔離（同 origin 部署不會互相污染）。

## 參考

- 範本：`$HOME/Dev/OPT/index.html`
- 規格 + 補強記錄：本 repo `HANDOFF.md`
