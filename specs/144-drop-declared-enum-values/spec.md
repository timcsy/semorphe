# Feature Specification：刪掉 `properties[].values` —— 一個沒有人讀的宣告

**Feature Branch**: `144-drop-declared-enum-values`
**Created**: 2026-08-19
**Status**: Draft
**路線圖位置**: vision「屬性的候選值由目標提供」**第一步**（spec `142` 切出來的）

---

## 出發點：三個量出來的事實

```
① properties[].values 的生產消費者      0 個
   （唯一消費是 block-spec-registry.ts:43 的 paramNames——只取【名字】不取值）
② 40 個 enum 屬性裡 35 個兩邊各寫一份    1 個對不上、4 個下拉是動態的
③ 既有的雙重真相護欄【看不到它】
   檔頭逐字：「本護欄**不檢測**：input 名稱以外的分歧」
```

## 🔴 而第四個事實決定了方向

```
blockDef.args0[].options   [顯示文字, 值]   234 個選項，其中 182 個顯示文字是 i18n key
properties[].values        [值]             只有值
```

**它們不是重複——`blockDef` 是嚴格超集，`values` 是它的一個投影。**

於是「讓 `values` 成為唯一來源」要**額外發明一套標籤慣例**去補回那 182 個 i18n key；
而「刪掉 `values`」**不損失任何被讀取的東西**。

> **兩份宣告要合併時，先問哪一份是另一份的投影
> ——投影那一份沒有資格當唯一真相，不管它讀起來多像。**

⚠️ 而這與「第二步：候選值由目標提供」的關係要說清楚：
第二步要動的是 **`blockDef` 的 options**（那裡才有標籤），
**不是** `values`。所以刪掉它**不會擋住第二步，反而讓第二步只有一個地方要改**。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 加一顆有下拉的元件時，只寫一個地方 (Priority: P1)

一個開發者新增一顆有 enum 屬性的元件。今天他要在 `component.json` 的
`properties[].values` **和** `forms/blocks.json` 的 `args0[].options` **各寫一份**
——而**沒有任何東西在守它們一致**。

**Why this priority**: 這是這一刀存在的理由。⚠️ 而 35 筆「碰巧一致」是**假的安全**。

**Acceptance Scenarios**:

1. **Given** 一顆有下拉的元件，**When** 讀它的 `component.json`，
   **Then** 找不到 `values` 這一格
2. **Given** 有人在新元件裡寫了 `values`，**Then** 有一條檢查**變紅**並說出哪一顆

---

### User Story 2 - 🔴 積木的外觀一格都不能變 (Priority: P1)

學生打開工具箱，**每一顆積木的下拉選項與今天完全相同**。

**Why this priority**: 與 US1 同級。這一刀是**收斂宣告**，不是改行為
——⚠️ 而「順手改了一點」正是這種清理最常見的失敗。

**Acceptance Scenarios**:

1. **Given** 刪除完成，**When** 產生工具箱快照，**Then** 與刪除前**逐位元組相同**
2. **Given** 任一顆元件，**When** 渲染它的積木，**Then** 下拉選項數量與順序不變

---

### Edge Cases

- **那 1 個「對不上」的**：`cpp:var_declare` 的 `init_style` 宣告 `['constructor']`
  而積木上沒有對應下拉 → ⚠️ **刪它之前要先查它是不是真的死的**，
  不是「反正要刪」順手帶走
- **4 個動態下拉**：本來就沒有靜態 `values` → 不受影響
- **非 enum 的 `properties`**（`identifier`／`number`／`type`）→ **完全不動**

---

## Requirements *(mandatory)*

- **FR-001**：`component.json` 的 `properties[]` MUST NOT 再有 `values` 這一格。
- **FR-002**：系統 MUST 有一條檢查，在有人重新寫 `values` 時**變紅並指名**。硬性零。
- **FR-003**：🔴 工具箱快照 MUST **逐位元組不變**。
- **FR-004**：`properties[]` 的其餘欄位（`name`／`kind`／`default`／`required`）MUST 不動。
- **FR-005**：那 1 筆「對不上」的 MUST **先查證再處置**，且處置理由要留在紀錄裡。

## Key Entities

- **`properties[].values`**：一個 enum 屬性的候選值清單。**今天零消費者。**

---

## Success Criteria *(mandatory)*

- **SC-001**：宣告了 `values` 的元件 **40 → 0**。
- **SC-002**：工具箱快照 **逐位元組不變**。
- **SC-003**：`npm test` 綠、`npx tsc --noEmit` 過。
- **SC-004**：新增一顆有下拉的元件時，選項**只寫一個地方**
  ——判準是「第二步（目標提供候選值）只有一個地方要改」。

---

## 明確排除

- **第二步：候選值由目標提供**——這一刀只清地基。
- **4 個動態下拉的統一**——它們的來源是執行期的工作區狀態，是另一件事。
- **`blockDef.args0` 本身的收斂**——它是唯一來源，不動它。
- **非 enum 屬性**。

---

## Assumptions

- **零消費者的量測是完整的**：`grep` 過 `src/core`、`src/ui`、護欄。
  ⚠️ 而驗收要求 `npm test` 全綠——**若有隱藏消費者，它會紅**。

## 已知的坑

1. 🔴 **「反正要刪」會順手帶走不該帶的**——那 1 筆對不上的要單獨查證（FR-005）。
2. **收斂不得改變外觀**——快照逐位元組比對（FR-003）。
3. **護欄先蓋**（`build-guardrail` 6.5）：FR-002 的檢查要在刪除**之前**存在，
   ⚠️ 而它第一次跑會是**紅的**（40 筆），那是對的。
