# Implementation Plan: 存檔層的無聲遺失——欄位守恆與版本閘門

**Branch**: `052-storage-integrity-gate` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/052-storage-integrity-gate/spec.md`

## Summary

存檔層有四個實測缺陷，其中一個**現在就在傷害使用者**（積木外觀與介面語言從未被保存），另外三個是**改核心型別那天會無聲毀掉存檔**。

技術路線分三段，每段的性質不同：

1. **消除**（不是偵測）——合併從逐欄位列舉改成展開，讓「漏欄位」在結構上不可能發生
2. **收窄**——`load()` 的回傳從「可能不是存檔的東西」收成「合法存檔或 null」，兩條讀取路徑共用同一個判定
3. **保護**——拒絕之前先備份，讓「拒絕載入」不會在四步之內變成「永久刪除」

外加一條護欄，形式與既有五條同形。

## Technical Context

**Language/Version**: TypeScript 5.9

**Primary Dependencies**: 無新增

**Storage**: 瀏覽器 localStorage（`semorphe-state`）+ JSON 檔案匯出匯入

**Testing**: Vitest

**Target Platform**: 瀏覽器（未來 VSCode webview）

**Project Type**: 單一前端專案

**Constraints**:

- **合法存檔、版本相同**這條主要路徑**零行為改動**——它涵蓋今天 100% 的真實存檔
- 既有 3069 測全數維持通過；`tests/unit/core/storage.test.ts` 四支**一支都不改**
- 五項量測數字皆未上升

**Scale/Scope**: 存檔格式 11 個欄位；三條讀取路徑；改動集中在 `src/core/storage.ts` + 一個新判定模組 + `src/ui/app.ts` 的兩處

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 條 | 評估 |
|---|---|
| **I. 簡約優先** | ⚠️ **需要辯護的一項**：升級路徑註冊表在 `CURRENT_VERSION=1` 時是空的，表面上就是「為假設性未來需求預留擴充」。**辯護**：FR-010～FR-013 要求版本判定分三種情況，`needs-upgrade` 這個判定**必然存在**；註冊表只是那個判定去查的表（約 3 行）。沒有它，「版本較低」只能落到拒絕，而當 `CURRENT_VERSION` 首次調成 2 的那天，那等於拒絕掉每一位既有使用者——**比現況更糟**。它完成的是當下的分支，不是預留未來。範圍已嚴格限縮：**不做**遷移框架、不做鏈式升級的通用機制、**不寫任何升級函式**。FR-016 的測試讓它非裝飾。 |
| **II. TDD 非妥協** | ✅ 全程紅→綠。**情境 0 是第一個任務**：先把「拒絕變成刪除」那條鏈跑出來，跑不出來就代表 US3 的設計建立在讀錯的程式碼上，要重來 |
| **III. Git 紀律** | ✅ 每個 User Story 一組 commit；基線檔獨立 commit |
| **IV. 規格文件保護** | ✅ 不覆蓋 specs/ 既有文件 |
| **V. 繁體中文優先** | ✅ 規格／計畫／任務皆繁中；識別字維持英文 |

**Post-Design 複查（Phase 1 後）**：設計未新增任何相依、未新增概念、未動語義樹。唯一的複雜度增量是 `LoadOutcome` 從二態變多態——那是**修病所必需**（二態正是 research F3 刪除鏈的起點），且 `load()` 的舊簽章保留為包裝，呼叫端零改動。✅ 通過。

## Project Structure

### Documentation (this feature)

```text
specs/052-storage-integrity-gate/
├── plan.md              # 本檔
├── spec.md
├── research.md          # Phase 0：八項實測與決策
├── data-model.md        # Phase 1：七個契約
├── quickstart.md        # Phase 1：九個驗收情境
├── contracts/
│   └── storage.md       # 存檔服務介面契約 + 護欄契約
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks 產出
```

### Source Code (repository root)

```text
src/core/
├── storage.ts                    # 改：展開合併、loadOutcome、備份
└── storage-version.ts            # 新：judge / CURRENT_VERSION / UPGRADES / SAVED_STATE_FIELDS

src/ui/
└── app.ts                        # 改：restoreState 依 LoadOutcome 分支 + showToast

tests/
├── unit/core/
│   ├── storage.test.ts           # 不改（回歸基準）
│   ├── storage-fields.test.ts    # 新：欄位守恆（US1）
│   └── storage-version.test.ts   # 新：版本判定三態 + 形狀驗證（US2）
├── integration/
│   ├── storage-refusal-safety.test.ts   # 新：拒絕不等於丟掉（US3）
│   └── audit-storage-integrity.test.ts  # 新：第六條護欄（US4）
└── baselines/
    └── storage-integrity.json    # 新：基線
```

**結構決策**：判定邏輯獨立成 `storage-version.ts` 而非塞進 `storage.ts`。理由是 contracts 的唯一性要求——`load` 與 `importFromJSON` **都必須**經由同一個 `judge`；放在獨立模組讓「有第二處判定」變得顯眼。（`storage.ts` 目前 98 行，不是為了拆大檔。）

## Phase 0 摘要

見 [research.md](./research.md)。八項發現，其中三項改變了設計：

- **F3**：`load()` 回 `null` → `save()` 拿不到 existing → 預設值蓋掉原存檔。**「拒絕載入」四步內變成「永久刪除」**。這讓 US3 從「防禦性補充」升格為必要條件，並決定了「先備份再拒絕」的做法
- **F4**：`satisfies Record<keyof Required<SavedState>, 1>` 實測會擋下漏欄位（`TS1360`）。這讓執行期的欄位清單有了不會漂移的來源
- **F5**：修法選「消除」（展開合併）而非「偵測」（保留列舉加測試）。**但偵測的測試仍然保留**——它守的是別的東西：有人日後把它改回列舉

**自我否證已寫進 research**：F3 的四步鏈是推理不是實測，所以它是實作的第一個任務。

## Phase 1 摘要

見 [data-model.md](./data-model.md)（七個契約）與 [contracts/storage.md](./contracts/storage.md)。

關鍵設計：

- **`LoadOutcome` 的 `refused` 分支型別上就帶 `backedUpTo`**——「拒絕了但沒備份」編不出來。FR-020 的執行機構在型別裡，不靠自律
- **`load()` 簽章不變**，實作為 `loadOutcome()` 的包裝。既有呼叫端與既有測試零改動
- **額外欄位不構成拒絕**（FR-017），且隨 `...existing` 展開被保留下去
- **護欄的自我驗證釘理由不只釘結果**——上一輪 051 的教訓

## Complexity Tracking

| 增加的複雜度 | 為什麼必要 | 若省略會怎樣 |
|---|---|---|
| `LoadOutcome` 多態 | 二態分不出「沒有存檔」與「被拒絕」 | research F3 的刪除鏈無法阻止 |
| 獨立的 `storage-version.ts` | 兩條讀取路徑必須共用判定 | 產生第三種鬆緊度——那正是現在的病 |
| 空的 `UPGRADES` 表 | 完成 `needs-upgrade` 分支 | 版本調高那天拒絕掉所有既有使用者 |
| 備份鍵 | 拒絕不得毀資料 | 這個功能會從防止資料遺失變成造成資料遺失 |

**沒有一項是為未來預留的。** 每一項都對應本功能自身的一條正確性要求。
