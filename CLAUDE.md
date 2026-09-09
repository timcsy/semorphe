# Semorphe Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-02

## Active Technologies
- localStorage（瀏覽器本地） (002-concept-blocks-redesign)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2 (003-polish-block-ux)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2, Vite (006-arch-four-dimensions)
- localStorage（瀏覽器） (006-arch-four-dimensions)
- TypeScript 5.x + Blockly 12.x, Monaco Editor (最新穩定版), web-tree-sitter 0.26.x, Vite 7.x (008-semantic-tree-restructure)
- localStorage（自動儲存）+ JSON 檔案匯出匯入 (008-semantic-tree-restructure)
- TypeScript 5.x + Blockly 12.4.1, Monaco Editor, web-tree-sitter 0.26.6, Vite (009-restore-legacy-features)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite (011-unified-pattern-engine)
- N/A（Registry 為記憶體中的 Map） (011-unified-pattern-engine)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor 0.52.2, Vite 7.3.1 (012-first-principles-compliance)
- localStorage（瀏覽器自動儲存） (012-first-principles-compliance)
- localStorage (browser) (013-ux-first-principles)
- TypeScript 5.x + 無新增外部依賴（純 TypeScript 型別 + EventEmitter 實作） (014-decoupling-infra)
- N/A（記憶體中） (014-decoupling-infra)
- TypeScript 5.x + 無新增（使用 Phase 0 建立的 SemanticBus + ViewHost） (015-sync-decouple)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite (016-app-split)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite 7.x (017-concept-blockdef-split)
- localStorage（瀏覽器自動儲存）+ JSON 檔案匯出匯入 (017-concept-blockdef-split)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite + Blockly, web-tree-sitter, Monaco Editor (VSCode) (019-cpp-std-modules)
- N/A（記憶體中的 Registry） (019-cpp-std-modules)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite + Blockly（積木渲染）, tree-sitter-cpp（AST 解析）, Vitest（測試） (047-pointer-ref-ux)
- TypeScript 5.x + Blockly 12.4.1 + Blockly（積木渲染/序列化）, Vitest（測試） (048-unify-extractor)

- TypeScript 5.x + Blockly 12.x, web-tree-sitter 0.26.x, CodeMirror 6.x (001-code-blockly-converter)

## Project Structure

```text
src/
tests/
```

## Commands

### 什麼時候跑什麼（2026-08-21 量測之後定的）

全套 412 個檔約需兩分鐘，而**成本是 per-file 的模組載入**——每個測試檔各自
載入一次 Blockly ＋ tree-sitter wasm ＋ 177 顆膠囊的 glob。所以：

| 你在做什麼 | 跑什麼 | 量級 |
|---|---|---|
| 改一顆元件、改一段邏輯 | `npx vitest run <那個檔或目錄>` | **秒** |
| 改核心／投影／解譯器 | `npm run test:unit` ＋ `npm run test:capsule` | 十幾秒 |
| 🔴 **改宣告、身分、基線、工具箱、課程清單** | `npm run test:guard`（54 條護欄） | 分鐘 |
| 🔴 **改了「使用者按得到的東西」**（按鈕、選單、面板結構） | **`npm run test:e2e`** | 十分鐘 |
| 🔴 **改了積木的畫法**（膠囊定義、`block-registrar`、renderer） | **重產課文的對照圖**（見下） | 六分鐘 |
| 🔴 **改 lift／產生器**（`lifters/strategies.ts`、`code-generator.ts`、膠囊的 `lift`／`generate`） | **拿真實語料重量一次**（見下） | 十秒 |
| commit 前 | `npm test`（全套） | 兩分鐘 |
| PR | CI 跑全套 ＋ `npm run test:e2e` | — |

🔴 **e2e 那一列是 2026-08-25 加的，而它是那天最貴的教訓**：一天改了六刀 UI，
每一刀都跑了全套（5600+ 綠）＋ 開瀏覽器實測，**而 e2e 一次都沒跑**
——CI 從那天 00:20 起紅，**19 支**，是使用者發現的。

> **`npm test` 驗的是「這些函式做對了嗎」；
> e2e 驗的是「使用者按得到的東西還在不在」。**

⚠️ 而「開瀏覽器實測」也擋不住：**實測的是剛做的那條路，
不是那些沒有人再去看的舊路**。

🔴 **對照圖那一列是 2026-09-05 加的**，而它也是使用者發現的：課文頁上
`1000000LL * 1000000LL` 的積木寫著 `0 × 0`——**而產品是對的**，
過期的是那 68 張圖（在 `field_number → field_input` 之前產的）。

```
npx playwright test --config=tools/demo/playwright.demo.config.ts record-blockmaps
```

> **一份產物的過期，有兩種來源：輸入變了，或者【產它的那台機器變了】。
> 只錨住前者的檢查，會在後者發生時保持全綠。**

🔴 **「拿真實語料重量一次」那一列是 2026-09-09 加的**，而它也是使用者給的：
他交來學生的練習 repo（218 個 `.cpp`、7327 行，AP325／TIOJ／zeroJudge／APCS）。

```bash
git clone https://github.com/core-keeper/StudyCpp /tmp/StudyCpp
STUDYCPP_DIR=/tmp/StudyCpp npx vitest run tests/probes/studycpp-
```

⚠️ **沒有 `STUDYCPP_DIR` 那兩支探針就跳過**——語料是別人的 repo，沒有收進來。
🟢 而**形狀收進來了**：第一百一十五條護欄 `declaration-shapes-roundtrip`
（53 條，`npm test` 會跑）。

第一次跑量到的東西：**殘差 0.0%，而 218 支裡 144 支轉一圈回來不是同一棵樹**。

> **殘差量的是「我沒認出來」，而它對「我認錯了」保持沉默
> ——而後者才會讓使用者的程式碼變成另一支程式。**

⚠️ 現在 `audit-lesson-blockmaps` 會替你紅（它比對 `engineHash`），
所以**不用記得**——但要知道紅的時候該跑什麼。

判準一句話：**你改的是「行為」，還是「這個 repo 的形狀」？** 後者才需要護欄。

🔴 **而「跑一塊固定的子集」在這個專案幾乎沒有用**（實測）：排掉最慢的五個檔
省下 **0 秒**（它們被並行 overlap 掉）；扣掉全部 54 條護欄跑全套**沒有變快**。
有效的子集是「**與這次改動相關的那幾個檔**」，不是「一塊比較小的固定範圍」。

⚠️ **測試環境預設是 `node`**，碰 DOM 的 20 個檔在檔頭寫
`@vitest-environment happy-dom`。加新測試時如果用到 `document`／`localStorage`／
面板，記得加上——不加的症狀是那個檔紅，不是靜默錯（`src/` 裡零個
「偵測 DOM 存在」的分支，已查證）。

⚠️ **沒有 `npm run lint`**（這一行本來寫著它，而那個 script 不存在）。
型別檢查走 `npx tsc --noEmit`。

## Code Style

TypeScript 5.x: Follow standard conventions

## Recent Changes
- 048-unify-extractor: Added TypeScript 5.x + Blockly 12.4.1 + Blockly（積木渲染/序列化）, Vitest（測試）
- 047-pointer-ref-ux: Added TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite + Blockly（積木渲染）, tree-sitter-cpp（AST 解析）, Vitest（測試）
- 022-topic-system: Added TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

<!-- Knowie: Project Knowledge -->
## Project Knowledge

This project maintains structured knowledge in `knowledge/`:

- **Principles** (`knowledge/principles.md`): Core axioms and derived development principles — the project's non-negotiable rules.
- **Vision** (`knowledge/vision.md`): Goals, current state, architecture decisions, and roadmap.
- **Experience** (`knowledge/experience.md`): Distilled lessons from past development — patterns, pitfalls, and takeaways.

Read these files at the start of any task to understand the project's *why* and constraints.
Additional context may be found in `knowledge/concepts/`, `knowledge/history/`, and `knowledge/draft/`.

Learned procedures live in `knowledge/skills/` (agentskills.io SKILL.md format). If your tool auto-loads skills, they may be projected into your skill directory; otherwise read the relevant `SKILL.md` there and follow it.
<!-- /Knowie -->
