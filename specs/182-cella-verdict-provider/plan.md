# Implementation Plan: Cella 判決與型別查詢——第一個看得見的消費者

**Branch**: `182-cella-verdict-provider` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/182-cella-verdict-provider/spec.md`

## Summary

Cella 提供者在 Web Worker 裡載入 cella-lang 與 c／cpp／arduino 套件、編好判決模組，宣告 `verdict` 與 `types` 兩項能力，排在 JS 直譯器前面。
消費者是**既有的診斷系統**：判決的 problem 與型別不合轉成 `Diagnostic`（新來源 `'cella'`、新嚴重度 `'info'` 給「判不出來」），
走 `app.ts` 原本的 `onDiagnostics` 通道，積木高亮與程式碼波浪各由視圖既有的 nodeId 投影畫出。
載入在 init 做完後於閒置時開始；套件檔用 Cache Storage、編好的模組用 IndexedDB，第二次打開不必重編。

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: `cella-lang` ＋ `@cella-lang/{cfamily,machine,c,cpp,arduino}` 0.1.202610310706（WasmGC）；Vite（`?url`／worker）；Blockly；Monaco

**Storage**: Cache Storage（套件檔）、IndexedDB（編好的判決模組）——皆以 `checkerHash` 為鍵；不進學生的存檔

**Testing**: Vitest（轉換、過濾、過期丟棄、快取鍵）＋ Node 端以 `tests/probes/c18-verdict` 的同一支入口驗語料 ＋ Playwright（積木與程式碼兩側的標示、載入期間不擋）

**Target Platform**: 瀏覽器（網頁版）；VSCode webview 照同一份程式（WasmGC 在 webview 的 Chromium 可用——要在 e2e／手動驗一次）

**Project Type**: 單一前端專案

**Performance Goals**: 載入期間編輯／執行的回應與今天相同；第二次打開到第一次出結果的時間比第一次少一半（SC-004）

**Constraints**: 首屏不搶頻寬；GitHub Pages 的 `max-age=600`（設計 draft 五之三）；不改判題的路（階段 6）

**Scale/Scope**: 新增 `providers/cella/{provider,worker,assets,cache}.ts` 約四個檔、`core/verdict-diagnostics.ts` 一個；改 `diagnostics.ts`（來源與嚴重度）、兩個面板的顯示、`app.ts` 的組裝與合併

## Constitution Check

| 原則 | 判定 |
|---|---|
| I. 簡約優先 | ✅ 不另做標示圖層，沿用診斷通道；不做 Service Worker（R6）；`'cella'`／`'info'` 都有當前的產出端 |
| II. TDD | ✅ 先寫轉換（判決 → 診斷）、過濾（要讀輸入）、過期丟棄的測試，紅了再寫 |
| III. Git 紀律 | ✅ 分段：診斷型別 → 轉換 → worker 與提供者 → 面板顯示 → 快取 → e2e |
| IV. 規格文件保護 | ✅ |
| V. 繁體中文優先 | ✅ 問題種類的中文說明表 |

專案原則：P6（`principles.md:158`）「必須區分原因（程式碼錯誤／系統能力不足）」→ `'error'` 與 `'info'` 分開；
分層護欄：核心不 import `providers/*`（`verdict-diagnostics.ts` 只認判決的形狀，不認 Cella）；P8 不留相容層。

設計後重檢：無違反。

## Project Structure

### Documentation (this feature)

```text
specs/182-cella-verdict-provider/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/verdict-diagnostics.md
└── tasks.md
```

### Source Code (repository root)

```text
src/core/
├── diagnostics.ts            # DiagnosticSource 加 'cella'；severity 加 'info'
├── verdict-diagnostics.ts    # 判決／型別結果 → Diagnostic[]（過濾、節點歸屬、中文說明表）
└── capabilities.ts           # （不改）verdict／types 的形狀已在
src/providers/cella/
├── verdict.ts                # （第 394 刀）載入與判決入口——worker 裡用
├── worker.ts                 # Web Worker：載入、編譯（或取快取）、判決、型別查詢
├── assets.ts                 # import.meta.glob 的 ?url 清單 → read(pkg, file)
├── cache.ts                  # Cache Storage／IndexedDB，鍵＝checkerHash
└── provider.ts               # 主執行緒：宣告 verdict／types，轉送給 worker，帶版本號
src/ui/
├── app.ts                    # 註冊提供者（JS 直譯器之前）；閒置時開始載入；判決結果併進診斷；狀態列
└── panels/{blockly,monaco}-panel.ts   # 'info' 的樣子
```

**Structure Decision**: 沿用既有結構；提供者全在 `providers/cella/`，核心只多一支形狀轉換。

## 風險與處置

| 風險 | 處置 |
|---|---|
| 首次載入很慢（35 MB，託管 35 KB/s 的那四成請求） | 閒置時背景載入、狀態可見；分開量「檔案大」與「託管慢」；壓縮後約 8–10 MB 的量記進 quickstart |
| `import.meta.glob` 掃 `node_modules` 在建置時的行為 | 第一個任務先量產物（檔數、總大小、雜湊檔名）；不行就退到建置時複製到 `public/` |
| WasmGC 在 VSCode webview | e2e 只跑網頁版——webview 那一側用 ship-extension 的手動驗收 |
| 判決過期而標錯地方 | 版本號（R10）；過期即丟 |
| 要讀輸入的程式出現假問題 | R8 的過濾；SC-005 有自動測試 |
| 本機比 CI 寬鬆（今天第四次） | CI 已是 Node 24；e2e 在 CI 的 Chromium 跑一次判決 |

## Complexity Tracking

無違反。
