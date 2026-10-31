# Implementation Plan: 元件動詞改名——每個視圖一對 render／lift

**Branch**: `181-view-paths` | **Date**: 2026-10-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/181-view-paths/spec.md`

## Summary

把 349 顆元件的 `paths` 從四個平鋪的動詞（`render`／`extract`／`generate`／`lift`）改成「視圖優先，包一層 `views`」：
`views.blocks.{render,lift}`、`views.code.{render,lift,liftStrategy}`，`formalize`／`execute` 留在外面。
做法：核心新增一張視圖表與「格子」（一顆元件的一路）的統一查詢；登錄表的契約檢查、實作檔掃描、判定者對照、護欄與測試改用格子；
一次性腳本改寫 349 個宣告；同一刀改 P2、五槽與完備性 ⑤，並留一筆 history。行為零改變。

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: Vite（`import.meta.glob` 掃膠囊）、Vitest、Playwright（e2e）

**Storage**: N/A（元件宣告是 repo 裡的 JSON；不影響使用者存檔）

**Testing**: Vitest（單元、護欄）＋ Playwright（e2e）

**Target Platform**: 瀏覽器（網頁版）與 VSCode webview

**Project Type**: 單一前端專案

**Performance Goals**: 載入時間不變（掃描與驗證的次數相同）

**Constraints**: P8 不做向後相容——不留轉接層；檔名不改；componentId 不變

**Scale/Scope**: 349 個 `component.json`、約 20 個讀取者（核心 4、測試與護欄約 15）、3 份概念文件、1 份原則

## Constitution Check

| 原則 | 判定 |
|---|---|
| I. 簡約優先 | ✅ 視圖表只有今天兩筆，不預留機制；「格子」取代三處各自拼路徑名的程式碼（減少重複，不是新抽象） |
| II. TDD | ✅ 先寫契約檢查的測試（新形狀接受、舊鍵擋下、單向視圖、未知視圖、null 無理由），紅了再改登錄表 |
| III. Git 紀律 | ✅ 依 tasks 分段 commit：核心型別與契約 → 宣告改寫 → 讀取者 → 知識庫 |
| IV. 規格文件保護 | ✅ 不動 spec／plan／tasks／constitution |
| V. 繁體中文優先 | ✅ |

專案原則（`knowledge/principles.md`）：P2 本身是這一刀要改的對象（使用者 2026-10-31 定案的文字）；P8 ✅（不留轉接層）；P6 ✅（顯式的空保留、違約擲錯不安靜）。

設計後重檢：無違反。

## Project Structure

### Documentation (this feature)

```text
specs/181-view-paths/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/component-paths.md
└── tasks.md            # /speckit-tasks 產生
```

### Source Code (repository root)

```text
src/core/component/
├── types.ts        # 視圖表、格子、paths 的新型別；FivePath／FIVE_PATHS 退場
├── registry.ts     # C3 換成視圖化的契約檢查
├── paths.ts        # 實作檔掃描改用格子
└── judges.ts       # PATH_JUDGE 鍵改成格子名；SIX_PATHS 退場
src/components/*/*/component.json   # 349 個，一次性改寫
tests/helpers/component-paths.ts    # 覆蓋表改用格子
tests/integration/…                 # 讀 paths 的護欄（research R2）
tests/baselines/judge-coverage.json # byPath 鍵改名
knowledge/principles.md · concepts/元件.md · concepts/元件代數.md · history/<新>
```

**Structure Decision**: 沿用既有結構；只改上列檔案，不新增目錄。

## 風險與處置

| 風險 | 處置 |
|---|---|
| 改寫腳本漏搬某個附屬鍵 | 改寫前後逐格計數比對（SC-003），不一致就不寫回 |
| 某個讀取者沒被找到，安靜地讀到 `undefined` | 舊鍵在宣告裡消失後，`grep` 舊鍵的讀取 = 0；契約檢查擋下任何平鋪舊鍵 |
| 判定者覆蓋數字悄悄變了 | 基線只改鍵名；數字變動會紅 |
| 進行中的分支用舊鍵 | 目前沒有進行中的分支（381–393 已合進 main）；之後的分支從這一刀之後開 |

## Complexity Tracking

無違反，不需記錄。
