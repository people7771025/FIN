// `node --test tests/` 的進入點。
// Node 22 起 `--test` 的參數被當成檔案／glob，而非目錄；傳入目錄時會依 CommonJS 規則解析到本檔。
// 本檔依檔名排序載入同目錄所有 *.test.mjs，讓 node:test 在同一個行程內執行全部測試。
// （也可直接用 `node --test tests/*.test.mjs`；Node 20 的目錄模式只挑 *.test.* 檔，不會重複執行本檔。）
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.mjs')).sort();
(async () => {
  for (const f of files) await import(pathToFileURL(path.join(__dirname, f)).href);
})().catch(err => { console.error(err); process.exitCode = 1; });
