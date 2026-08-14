# Implementation Plan: 語法錯誤走診斷通道 ＋ 診斷帶來源

**Branch**: `119-syntax-error-diagnostic` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/119-syntax-error-diagnostic/spec.md`

## Summary

少一個分號今天顯示成**最低等級的灰色提示**，而且**不走診斷通道**
——上一輪剛做好的 `rule`＋`params`、兩面板不同措辭、文案完備性護欄，
一點都沒套到**第一週最常見的那個錯誤**上。

本功能把它搬進診斷通道（錯誤級、`semorphe` owner、走 `onDiagnostics`），
並同時為 `Diagnostic` 加上**來源**——因為搬進去的東西當下就要說得出
「這是誰的問題」，分兩次做等於把同一個型別改兩遍。

🔴 **而 research 找出兩條路今天根本不可能會合**：診斷吃積木、殘差吃樹。
會合點要新開，而那順帶補上一個既有缺口（診斷只在**積木**變動時跑）。

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: Blockly 12.4.1、Monaco Editor、web-tree-sitter 0.26.6

**Storage**: N/A（診斷每次重算，不持久化）

**Testing**: Vitest（單元／整合／護欄）、Playwright（e2e）

**Target Platform**: 瀏覽器

**Project Type**: 單一前端專案

**Performance Goals**: 無新增要求。⚠️ 新增一次**全樹走訪**，
而樹的規模與現有的 `renderResidual` 相同（它已經每次 `semantic:update` 走一遍）

**Constraints**: 離線可用；42 條護欄基線**一個都不動**；
🔴 `tests/baselines/projection-residual.json` **一個字元都不變**

**Scale/Scope**: 3 個既有規則身分 ＋ 1 個新身分；來源 2 個值；
文案 4 條身分 × 2 面板 × 2 語言 = **16 份**（今天 12 份）

## Constitution Check

*GATE: 通過（Phase 0 前）。Phase 1 設計後複查——見末尾。*

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先／YAGNI** | ✅ **通過（兩個疑點都查證解除）** | ① **`params` 不是預留**：`monaco-panel.ts:132` 的 `residualMessage` **今天就把壞掉的原文接在訊息後面**，搬過去只是換載體。② **來源只放兩個值**（元件宣告／語法解析），`compiler`／`runtime` 沒有產出端就不加 |
| **II. TDD（非妥協）** | ✅ 通過 | 三支必須**先紅**：語法錯誤是錯誤級（今天是 Info）、`unsupported` 仍是 Info（今天綠，靠**注入**證明會紅）、兩面板不同字串 |
| **III. Git 紀律** | ✅ 通過 | 型別改動與通道搬移**分開 commit**——前者讓 tsc 整片紅，混在一起無法二分 |
| **IV. 規格文件保護** | ✅ 通過 | 不碰 `specs/`／`.specify/` |
| **V. 繁體中文優先** | ✅ 通過 | 規格文件中文；識別字英文 |

⚠️ **一個要正面說的**：本功能**新增一個 core 純函式**（走樹產出診斷）。
Constitution I 說「三行相似程式碼優於一個過早的抽象」——
而這裡不是抽象，是**第二個產出端**：診斷從此有兩個來源，
而它們必須合併成一次廣播（`setModelMarkers` 是全集取代）。**不合併就會互相清掉。**

## Project Structure

### Documentation (this feature)

```text
specs/119-syntax-error-diagnostic/
├── spec.md              # 已完成
├── plan.md              # 本檔
├── research.md          # 已完成（Phase 0）——兩個 Constitution 疑點在這裡解除
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── diagnostic-source.md
├── checklists/
│   └── requirements.md  # 已完成
└── tasks.md             # /speckit-tasks 產出
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── diagnostics.ts          🔴 Diagnostic 加 source；🆕 樹→診斷的純函式
│   ├── view-host.ts            🟡 DiagnosticsEvent 內嵌型別跟著改
│   └── types.ts                ⚪ DegradationCause 不動（本輪不改樹）
├── languages/cpp/
│   └── diagnostics.ts          🟡 3 條規則帶 source
├── ui/
│   ├── app.ts                  🔴 會合點：訂閱 semantic:update ＋ 合併兩個來源
│   └── panels/
│       ├── blockly-panel.ts    🟡 SYNTAX_ERROR 的積木側文案
│       └── monaco-panel.ts     🔴 renderResidual 濾掉 syntax_error
└── i18n/{zh-TW,en}/blocks.json 🟡 12 份 → 16 份

tests/
├── unit/core/
│   └── diagnostics-from-tree.test.ts     🆕 樹→診斷；含「另外兩種不得被搬」
├── unit/ui/
│   └── diagnostic-message.test.ts        🟡 既有——加 SYNTAX_ERROR
├── integration/
│   └── audit-diagnostic-labels.test.ts   🟡 既有——身分從 3 變 4，自動涵蓋
└── ...

e2e/
└── diagnostics.spec.ts         🟡 既有——加「少分號 → Error 級」與「unsupported 仍是 Info」
```

**Structure Decision**: 沿用既有結構。⚠️ **不新增目錄、不搬檔案**
——本功能是改通道，任何搬移都會讓 diff 無法二分。

## Phase 1：設計產出

- [contracts/diagnostic-source.md](contracts/diagnostic-source.md)——來源的契約與「誰該修／能不能收零」
- [data-model.md](data-model.md)——四個實體
- [quickstart.md](quickstart.md)——可跑的驗證步驟

## Complexity Tracking

> 無違反。Constitution I 的兩個疑點在 research §一、§二 以量測解除。

## Constitution Re-check（Phase 1 設計後）

| 原則 | 複查 |
|---|---|
| **I. 簡約優先** | ✅ 仍通過。新增的是**一個函式 ＋ 一個欄位**，沒有新類別、沒有註冊表、沒有策略模式。⚠️ 而來源是**字面聯集**不是列舉物件——加一個值就是改一行 |
| **II. TDD** | ✅ `quickstart.md` 步驟一～三都先紅，且**每一支都要人工確認紅的理由** |
| **III. Git 紀律** | ✅ tasks 依 Phase 切 |
| **IV. 規格保護** | ✅ |
| **V. 繁中優先** | ✅ |

⚠️ **一個刻意的不對稱**（與上一輪同形）：`params.snippet` 在**積木側用得到**
（積木上看不出對應哪一段原始碼）、**程式碼側用不到**（波浪已經指在那一行）。
**那不是浪費，它是兩面板分開組裝的又一個證據。**
