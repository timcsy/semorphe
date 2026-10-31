# Research: Cella 判決與型別查詢——第一個看得見的消費者

量測日期：2026-10-31（`main` 77c6a36c 之後的 `182-cella-verdict-provider`）。

## R1. 標示走哪條路——既有的診斷系統

- **現況**：`src/core/diagnostics.ts` 的 `Diagnostic`（`nodeId`、`at?`、`severity: 'warning' | 'error'`、`rule`、`params`、`source`）。
  `src/ui/app.ts:4381` 把 `runDiagnostics(積木)` 與 `diagnosticsFromTree(樹)` 合併，交給每個視圖的 `onDiagnostics`；
  積木面板高亮那一塊、Monaco 面板以 `nodeId` 的對映畫波浪（`monaco-panel.ts:230–262`，對映不到就跳過，不退回第 1 行）。
- **Decision**：Cella 的判決與型別查詢 **轉成 `Diagnostic`，走同一條通道**。新增 `DiagnosticSource = 'cella'`。
- **Rationale**：`diagnostics.ts` 的檔頭逐字：「只放今天真的有產出端的值。`compiler`（委派編譯器）與 `runtime`（執行期觀察）都還沒有產出端」——
  Cella 正是那個產出端。兩個視圖的投影（nodeId → 積木、nodeId → 行）都已經有、而且守過「指錯地方比不指更糟」。
- **Alternatives**：另做一套「判決標示」圖層——兩個視圖各要重寫一次投影，而且會與既有的診斷疊在同一塊積木上卻互不知道。否決。

## R2. 「有錯」與「判不出來」怎麼分得開

- **Decision**：`severity` 多一個值 `'info'`（判不出來）；有錯（reject）用 `'error'`。兩個面板各自把 `'info'` 畫成非錯誤的樣子
  （Monaco 已有先例：`monaco-panel.ts:138` 對「我們還沒長到」的降級用 `MarkerSeverity.Info`）。
- **Rationale**：`diagnostics.ts` 的 `DIAGNOSTIC_CAUSES` 那段逐字：「只有 `syntax_error` 是使用者的問題。另外兩種是『我們還沒長到』，
  它們刻意不長得像錯誤」——同一個判準。
- **Alternatives**：用 `'warning'` 表示判不出來——學生會讀成「你的程式有問題」。否決。

## R3. problem 的節點 → 積木

- **Decision**：`at` 的標籤取 `<id>` 前段（`/<角色>`、`#<槽>` 都去掉，與 `tests/probes/c18-verdict.test.ts` 的 `owner()` 同一個規則）當 `nodeId`。
  對映不到（骨架、收合）時，沿樹往上找最近的有對映的祖先；仍找不到就只進狀態列的清單。
- **Rationale**：SC-003 已在語料上量過 100% 對得回語義樹；可見性是視圖的事，交給既有的對映。

## R4. 判決在哪裡跑——Web Worker

- **量到的**：載入 cella-lang ＋ c／cpp／arduino 約 3.6 秒、編譯判決模組約 12 秒、每支判決百毫秒到 1 秒（Arduino 要模擬五秒，更久）。
  wasm 5.9 MB、標準模組約 3 MB、cfamily 11 MB、cpp 14 MB（gzip 後 cpp 約 3.1 MB）。
- **Decision**：`providers/cella/worker.ts` 在 Web Worker 裡載入與判決；主執行緒的提供者只轉送請求、收結果。
- **Rationale**：FR-009 不阻塞編輯。十幾秒的同步編譯在主執行緒上就是十幾秒的凍結。
- **Alternatives**：主執行緒用 `requestIdleCallback` 分段——wasm 的編譯與判決本身不可分段。否決。

## R5. 套件檔案怎麼送到瀏覽器

- **Decision**：Vite 以 `import.meta.glob('/node_modules/@cella-lang/*/*.cell', { query: '?url', import: 'default', eager: true })` 把每個 `.cell`
  變成帶雜湊檔名的靜態資產；`index.json` 以 `?raw` 讀入；cella-lang 自己的資產沿用 `cella-lang/assets`（`new URL(…, import.meta.url)`，Vite 會處理）。
  `verdict.ts` 的 `read(pkg, file)` 在 worker 裡用 `fetch(url)` 實作。
- **Rationale**：不手抄檔案清單（套件升版時模組會變）；`index.json` 決定載入順序，與 Node 那一側同一份。
- **待量**：產物的總大小與首次載入時間（R7）。

## R6. 第二次打開要快——快取

- **Decision**：① 套件與 wasm 檔用 Cache Storage 保存（鍵：`checkerHash` ＋ 檔名）——GitHub Pages 的 `max-age=600` 讓 HTTP 快取十分鐘就失效（設計 draft 五之三）；
  ② 編好的判決模組位元組（`compile_wasm_library` 的輸出）存在 IndexedDB（鍵：`checkerHash` ＋ 模組原始碼的雜湊），下次直接 `loadLibrary`。
- **Rationale**：SC-004「第二次少一半」——十二秒的編譯是最大的一塊，重用它就過了。
- **Alternatives**：Service Worker 管整個快取——範圍比這一刀大（會影響整個網站的更新流程）。否決，留給之後。

## R7. 什麼時候開始載入

- **Decision**：`window.__appReady` 之後，在瀏覽器閒置時開始（`requestIdleCallback`，無則 `setTimeout`）；不等學生第一次停下編輯。
- **Rationale**：第一次判決要等十幾秒；等學生停下才開始的話，第一次看到結果要更久。init 之後開始，不與首屏搶頻寬（spec Assumptions）。

## R8. 要讀輸入的程式

- **Decision**：判決的輸入 ＝ 課文目前任務的 `check.stdin`（有的話）。沒有測資時，若程式含讀取輸入的節點（`isStreamInput` 一族的性狀＋`scanf`），
  過濾掉執行期的問題（`ub*`、`fuel`），保留靜態的（型別錯、尚未支援的構造），狀態說「給一份輸入才判得出執行時的問題」。
- **Rationale**：第 394 刀量到——空輸入時 21 支被判 `ubUninit`，全是假象；餵課文測資之後 0 支（SC-005）。

## R9. 型別查詢

- **Decision**：同一個 worker 呼叫 `<branch>.types src candidates`；`candidates` 是積木位置可能接受的型別（目前接上的值的型別＋該位置需要的）。
  不合的位置產生 `Diagnostic`（`rule: 'type_mismatch'`、`severity: 'error'`、`params` 帶需要／接上的型別）。
- **工具箱不藏**：型別結果**不回流**到工具箱過濾（FR-006）。
- **⚠️ 範圍**：程式裡有洞（空槽）時判決是 `unknown`／`hole`——那一則不顯示（空槽本來就是「還沒寫完」），只顯示型別不合。

## R10. 過期的結果

- **Decision**：每次送判決帶一個版本號（同步器每次 `semantic:update` 遞增）；回來時版本不是最新就丟。學生連續修改時，worker 只排隊最新的一筆。
