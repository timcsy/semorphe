# Implementation Plan: 診斷訊息由「一個字串」改為「規則 ＋ 參數」

**Branch**: `118-diag-rule-params` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/118-diag-rule-params/spec.md`

## Summary

一則診斷今天帶著一個組好的 i18n key，而**兩個面板查同一張表 → 拿到同一句話**。
本功能把 `Diagnostic` 從「帶訊息」改成「帶規則身分 ＋ 這次觸發的參數」，
由各面板自己組裝，於是積木側可以教學、程式碼側可以像編譯器。

🔴 **而 research §二 發現這不只是好看的問題**：`varDeclareNames` 對
`int , , ;` 產出**三則完全無法區分**的診斷——「第幾個名字是空的」這筆資訊
在產出的當下就被丟掉了。**參數管道因此有今天的消費者，不是預留擴充。**

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**: Blockly 12.4.1（積木面板）、Monaco Editor（程式碼面板）

**Storage**: N/A（診斷是每次同步重算的，不持久化）

**Testing**: Vitest（單元／整合／護欄）、Playwright（e2e）

**Target Platform**: 瀏覽器

**Project Type**: 單一前端專案（`src/` ＋ `tests/` ＋ `e2e/`）

**Performance Goals**: 無新增要求——診斷在每次工作區變更後跑一次，
現有 4 條規則 × 工作區積木數，改動不影響複雜度

**Constraints**: 離線可用（不得引入遠端服務）；41 條護欄基線**一個都不動**

**Scale/Scope**: 4 條診斷規則 × 2 個面板 × 2 種語言 = **16 份文案**；
異動檔案預估 6 個 src ＋ 3 個 tests

## Constitution Check

*GATE: 通過（Phase 0 前）。Phase 1 設計後複查——見末尾。*

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先／YAGNI** | ✅ **通過（而它一度是紅的）** | spec 檢查清單第三輪質疑「參數是不是預留擴充」。research §二 查證後**否定**：`diagnostics.ts:76-94` 今天就把「第幾個名字」丟掉，產出三則無法區分的診斷。**這是資料遺失，不是抽象不足**——三行相似程式碼救不了它 |
| **II. TDD（非妥協）** | ✅ 通過 | 每個 User Story 先寫測試。⚠️ **而其中兩支要先看到紅**：SC-004 的注入（兩側同組法 → e2e 紅）與 §決策3 的完備性護欄（拿掉一份文案 → 紅） |
| **III. Git 紀律** | ✅ 通過 | 每個 Phase 一個 commit；型別改動與面板改動**分開 commit**（型別那筆會讓 tsc 整片紅，混在一起無法二分） |
| **IV. 規格文件保護** | ✅ 通過 | 本功能不碰 `specs/`／`.specify/` |
| **V. 繁體中文優先** | ✅ 通過 | spec／plan／tasks 中文；識別字英文 |

**Phase 1 後複查**：見本檔末尾「Constitution Re-check」。

## Project Structure

### Documentation (this feature)

```text
specs/118-diag-rule-params/
├── spec.md              # 已完成
├── plan.md              # 本檔
├── research.md          # 已完成（Phase 0）
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── diagnostic.md    # Phase 1——Diagnostic 的介面契約
├── checklists/
│   └── requirements.md  # 已完成
└── tasks.md             # /speckit-tasks 產出，不由本指令建立
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── diagnostics.ts          🔴 Diagnostic 型別改形狀；runDiagnostics 改 push 的內容
│   └── view-host.ts            🟡 DiagnosticsEvent 的內嵌型別跟著改
├── languages/cpp/
│   └── diagnostics.ts          🟡 規則的 message 欄位改名為 rule
├── ui/
│   ├── app.ts                  ⚪ 只是傳遞，預期不用改
│   └── panels/
│       ├── blockly-panel.ts    🔴 自己組裝（積木側文案）
│       └── monaco-panel.ts     🔴 自己組裝（程式碼側文案）＋ FR-007 更正過期註解
└── i18n/
    ├── zh-TW/blocks.json       🟡 4 key → 8 key（每條規則 × 每個面板）
    └── en/blocks.json          🟡 同上

tests/
├── unit/core/
│   └── diagnostics.test.ts     🟡 既有——改成斷言 rule/params
├── integration/
│   └── audit-diagnostic-labels.test.ts   🆕 第四十二條護欄：文案完備性（硬性零）
└── unit/ui/
    └── diagnostic-message.test.ts        🆕 兩個面板的組裝結果必須不同

e2e/
└── diagnostics.spec.ts         🟡 既有——補「兩邊字串不同」的斷言
```

**Structure Decision**: 沿用專案既有的單一前端結構。
⚠️ **不新增目錄、不搬檔案**——本功能是改資料形狀，
任何搬移都會讓 diff 無法二分（`build-guardrail` 6.5：別為了修一筆而先做重構）。

## Phase 1：設計產出

- [contracts/diagnostic.md](contracts/diagnostic.md)——`Diagnostic` 的介面契約與兩個面板的組裝責任
- [data-model.md](data-model.md)——三個實體與它們的關係
- [quickstart.md](quickstart.md)——可跑的驗證步驟

## Complexity Tracking

> 無違反。Constitution I 的疑慮已在 research §二 以量測解除，不需要豁免。

## Constitution Re-check（Phase 1 設計後）

| 原則 | 複查 |
|---|---|
| **I. 簡約優先** | ✅ 設計後仍通過。`params` 的型別是 `Record<string, string \| number>`——**沒有為它建類別、沒有 builder、沒有註冊表**。⚠️ 而 `contracts/diagnostic.md` 明寫「參數集合可以是空的」，不強制每條規則都帶 |
| **II. TDD** | ✅ `quickstart.md` 的步驟一與步驟二**都是先紅**的 |
| **III. Git 紀律** | ✅ tasks 會依 Phase 切 commit |
| **IV. 規格保護** | ✅ |
| **V. 繁中優先** | ✅ |

⚠️ **一個刻意留下的不對稱**：`hasInput` 會帶 `inputName` 參數，
而積木側**用不到它**（學生看得到那個插槽是空的）。
**那不是浪費——它正是「兩個面板不同」的證據**，
而如果哪天積木側也要用，管道已經在了（research §三）。
