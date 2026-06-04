# WIP — FIN 台股美股財報自學系統

最後更新：2026-06-04（台北時間）/ Claude

## 現在狀態

- **v1 完成、可運作**。單檔 `index.html`（~217 KB），引擎沿用 OPT，主題換成財報判讀。
- 內容：intro + 28 章（ch1–28）+ 案例庫 + 名詞表 + 學習進度，分 7 個 Part（章節對照見 HANDOFF §2）。
- 互動元件 10 種 + Quiz + 學習路徑：dupont / ratio / waterfall / trend / pebands / dividend / quality / redflag / industry / compare。
- 引擎：深淺色、進度條、已讀偵測（IntersectionObserver）、章節完成 + 7/14/30 天複習提醒、書籤、快速鍵 J/K/G/B/M/T//?、PWA、LLM 助教（Gemini 2.5 Flash，自帶 key）。
- localStorage 前綴一律 `fin/`（與 OPT 隔離，避免同 origin 污染）。
- 驗證（瀏覽器實跑）：**0 console error/warning**；25 widget 全 hydrate；杜邦 ROE、瀑布各層、比率計算抽查正確；quiz 7 組 JSON 合法。

## 下一步（未做）

1. **建 GitHub repo + 部署**：`people7771025/FIN`（public/private 待定）→ GitHub Pages，再把線上連結填回 README。
2. **跨機路標**：在 `agent-config/PROJECTS.md` 加一列 FIN。
3. **Cloudflare sync-worker**（可選）：要跨裝置同步進度才需要；目前 `CloudSync` 是停用 stub，同步鈕隱藏。
4. 內容再深化：Part Ⅳ（ch17-19）由本機補寫，可再對齊其他 Part 的密度；產業章可加更多示意數字案例。

## 卡點 / 注意

- 內容財務數字皆為**示意**，引用真實公司只作教學；正式對外前可再請人覆核算式與台股/美股申報時程。
- 不在 GDrive 路徑跑 build；單檔 HTML 無 node_modules。
- 內容由 workflow 並行撰稿 + 財務校對產生（Part Ⅳ agent schema 失敗，已由本機補寫並通過完整性檢查）。

## 參考

- 範本：`$HOME/Dev/OPT/index.html`
- 規格：本 repo `HANDOFF.md`
