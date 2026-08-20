# 158 — 程式碼追上名詞表：`概念` 退場、`元件` 統一

**日期**：2026-08-20 · **人拍板**：使用者
**決定記錄**：[history/109](../../knowledge/history/109-程式碼追上名詞表而那張表早就定案了.md)

## 出發點

`concepts/元件.md:438`「名詞表（跨域唯一）」**早就定案**：

| 角色 | 程式 | 取代 |
|---|---|---|
| 身分鍵 | **`componentId`** | `conceptId`、`typeId`、`SemanticNode.concept` |
| 登錄表 | **`ComponentRegistry`** | `BlockSpecRegistry` |

**而程式碼只跟上了一半**：函式名改了（`isValidComponentId`／`allComponentIds`），
**資料欄位沒改**。

判準是使用者給的：

> **硬體要加進來，而「概念」對硬體讀不通**——「電阻是一顆元件」讀得通，
> 「電阻是一個概念」讀不通。

## 🔴 而【值】不變——這一點決定了這一刀的風險等級

```
變     "conceptId": …      →  "componentId": …
       ConceptRegistry     →  ComponentRegistry
       SemanticNode.conceptId → componentId
不變   "cpp:print"         →  "cpp:print"
```

於是：**使用者存檔不必轉換**（`id-migrations` 不動），
而所有**用值當鍵**的基線——`locality.json`、`component-move-parity` 的凍結身分集、
`declared-slots-decisions.json`——**全部不受影響**。

🔴 **而這必須被驗**，因為有過相反的病歷（spec `140`）：
`monacoPanel` 改名成 `codeView` 讓護欄報「改善了 73 → 51」——**而那是假的**。

> **抽介面讓一個相依【可抽換】，不是讓它【消失】
> ——而一條用名字認耦合的檢查，會把前者報成後者。**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 🔴 名詞統一 (Priority: P1)

**驗收**：`conceptId` 在 `src/`／`tests/`／`component.json` 歸零；
`ConceptRegistry` 歸零；`SemanticNode` 的那一格是 `componentId`。

### User Story 2 - 🔴 每一條護欄的數字一個都不准動 (Priority: P1)

**驗收**：改名前後，**所有基線數字完全相同**。
⚠️ 任何一個動了 → **那是發現，不是雜訊**：它代表那條檢查在用名字認東西。

### User Story 3 - 🔴 行為零變更 (Priority: P1)

**驗收**：全套測試綠、e2e 綠、瀏覽器雙向實測；**存檔不必轉換**。

### Edge Cases

- **`概念` 在知識庫出現 1005 次／125 檔**，而很多是**日常語義**
  → 🔴 **只改術語**（`概念代數`→`元件代數`、`概念身分`→`元件身分`、`conceptId`→`componentId`），
  **不做全域取代**
- **`ConceptDef`／`ConceptDefJSON`／`ConceptLayer`(已刪)／`conceptsDeclaringVariableType`
  等衍生名** → 一起改，而**逐一列出**
- **`concepts.json`／`universal-concepts.json` 檔名** → ⚠️ 檔名改動會動到 import，
  **這一刀不改檔名**，記為下一刀

## Requirements *(mandatory)*

- **FR-001**：`conceptId` → `componentId`（欄位、型別、變數、註解裡的術語）
- **FR-002**：`ConceptRegistry` → `ComponentRegistry`
      ⚠️ 而**不合併** `BlockSpecRegistry`——名詞表要的合併是**另一刀**
- **FR-003**：`SemanticNode` 的身分欄位 → `componentId`（人已拍板）
- **FR-004**：知識庫**只改術語**，不做 `概念` 的全域取代
- **FR-005**：🔴 一條護欄擋 `conceptId` 回來
- **FR-006**：🔴 **所有基線數字不得改變**
- **FR-007**：🔄 **根公理的措辭一起改**——使用者 2026-08-20 **拍板**
      （原文：「我拍板，可以動根公理」）。
      「概念節點／概念類型」→「元件節點／元件身分」。
      🔴 **而變更要留下理由**（knowie：根公理的 churn 應趨近零，變更走特別路徑）
      ——理由寫在 `principles.md` 的根公理下方，並指向 `history/109`。
      ⚠️ **變的是措辭，不是公理**：節點仍然是（身分, 屬性, 子節點）。

## Success Criteria

- **SC-001**：`grep -r conceptId src tests` ＝ 0（除了護欄自己的字串）
- **SC-002**：基線 diff ＝ 空
- **SC-003**：全套綠 ＋ e2e 綠 ＋ 瀏覽器雙向

## 明確排除

- **三個登錄表的合併** · **檔名**（`concepts.json` 等）
- **`Instance` 取代 `SemanticNode`**（名詞表的下一格，動的是型別的意義不只名字）
- **`params`／`ParamSpec`／`attachments`／`forms`**——名詞表的其餘各列，各自是一刀

## 已知的坑

1. 🔴 **改名讓護欄數字動 ＝ 那條檢查在用名字認東西**（spec 140 的病歷）
2. **知識庫不可全域取代**——`概念` 有日常語義
3. ⚠️ **`conceptId` 也出現在 `specs/` 78 檔**——那是**歷史文件**，
   🔴 **不改**：規格是當時的記錄，改它等於竄改病歷
4. ⚠️ **注入要編得過**，且要分辨「真的綠／真的紅／沒跑起來」
5. 🔴 **檢查測試結果要抓 `failed`**，不要看尾巴
