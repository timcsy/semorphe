# Phase 1 資料模型：護欄、基線、分類

**Feature**: 049-audit-guardrails ｜ **Date**: 2026-08-06

本功能不動任何既有型別。以下是**新增**的資料形，全部只存在於 `tests/` 之下——除了一個例外（`skipPaths`，見末節）。

---

## 1. Guardrail（護欄）

一項可重複執行的檢查。**不是一個型別，是四個測試檔共用的形狀**：

```
量測（Measure）  →  報表（Report）  →  與基線比對（Ratchet）
```

| 欄位 | 意義 |
|---|---|
| `name` | 護欄名稱（`neutrality` / `completeness` / `defect-ledger` / `locality`） |
| `measure()` | 產生當前結果 |
| `report(result)` | 產生人類可讀報表（FR-002） |
| `baseline` | 從 `tests/baselines/<name>.json` 載入 |
| `compare(result, baseline)` | 回傳「新增了什麼」——空陣列才通過（FR-003, FR-005） |

**不變式**：`compare` 回傳的是**新增項的清單**，不是布林。FR-005 要求失敗時指出是哪一項，所以比對的粒度必須是項目而非總數。

---

## 2. NeutralityResult（中立性）

```
NeutralityResult
├── total: number                     # 程式碼引用的違規檔案數（計入基線）
├── files: Map<檔案路徑, ViolationDetail>
└── commentOnly: Map<檔案路徑, string[]>   # 僅出現在註解（列報表、不計基線）

ViolationDetail
├── componentIds: string[]            # 該檔提到的元件身分
└── lines: number[]                   # 出現的行號
```

**掃描範圍**：`src/core/`、`src/ui/`、`src/interpreter/`、`src/views/`
**判定**：D1 的字邊界規則，先剝註解
**基線檔**：`tests/baselines/neutrality.json` — `{ total, files: { path: componentIds[] } }`

**驗證規則**：
- 出現在基線 `files` 之外的檔案 → 新違規 → 失敗
- 基線內的檔案出現**新的 componentId** → 新違規 → 失敗
- 基線內的檔案少了某個 componentId → 通過（可下調基線）

---

## 3. CompletenessResult（完備性）

```
CompletenessResult
├── byComponent: Map<componentId, PathClassification>
├── totals: { implemented, shell, missing }   # 以「路徑數」計，非元件數
└── configDelta: ConfigDelta[]                # 兩組態的分類差異（FR-023）

PathClassification            # 一個元件 × 五條路徑
├── lift:     Verdict
├── render:   Verdict
├── extract:  Verdict
├── generate: Verdict
└── execute:  Verdict

Verdict = 'implemented' | 'shell' | 'missing'
        + reason?: string      # 判為 shell 時必填，說明退化形式

ConfigDelta
├── componentId
├── path
├── actual:   Verdict          # 現行組態
└── declared: Verdict          # 宣告組態
```

**Verdict 判定**（D6 定義的殼條件）：

| 路徑 | missing | shell | implemented |
|---|---|---|---|
| generate | 無 generator 且無 codeTemplate | 輸出空／佔位／擲例外 | 產出非空且非佔位 |
| lift | 無 pattern 也無 strategy | round-trip 回來的 componentId 不符，或 confidence 為 `raw_code` | componentId 相符 |
| render | 無 blockDef | 產不出積木或退回泛用積木 | 產出對應積木 |
| extract | 無 extractor 路徑 | 取回的 componentId 不符 | 相符 |
| execute | 無 executor 且未宣告 `skipPaths` 含 execute | executor 存在但為空操作且未宣告 | 有實質 executor，或已宣告刻意不執行 |

**基線檔**：`tests/baselines/completeness.json` — `{ totals, shells: [{componentId, path}], missing: [{componentId, path}] }`

**驗證規則**：`shells` 或 `missing` 出現基線之外的項目 → 失敗。

**補完地圖**（FR-024）：`byComponent` 直接輸出成 markdown 表格到 `tests/reports/completeness-map.md`。

---

## 4. DefectLedgerResult（缺陷帳）

```
DefectLedgerResult
├── entries: DefectEntry[]
├── unclassified: DefectEntry[]        # 沒有標記的 → 直接失敗（FR-033）
├── byBlocker: Map<componentId, number>   # 「修這個解鎖幾個」（FR-034）
└── total: number

DefectEntry
├── file: string
├── line: number
├── kind: 'todo' | 'skip'
├── scope: 'test' | 'describe'         # 區塊停用會覆蓋多個測試（FR-035）
├── title: string
└── tag: Tag | null

Tag
├── type: 'BLOCKED' | 'TOMBSTONE' | 'DEADSKIP'
├── blocker?: componentId              # type=BLOCKED 必填（FR-031）
└── tombstoneRef?: string              # type=TOMBSTONE 必填（FR-032）
```

**標記語法**（D4）：測試標題以 `[TYPE:VALUE]` 或 `[TYPE]` 開頭。

**基線檔**：`tests/baselines/defect-ledger.json` — `{ total, byBlocker }`

**驗證規則**：
- `unclassified` 非空 → 失敗（FR-033）
- `BLOCKED` 缺 blocker、`TOMBSTONE` 缺 ref、或 ref 指向不存在的檔案／錨點 → 失敗
- `total` 上升 → 失敗

---

## 5. LocalityResult（就近性）

```
LocalityResult
└── byComponent: Map<componentId, { files: number, dirs: number, paths: string[] }>
```

**掃描範圍**：`src/` 全部（就近性關心的是實作擴散，不限核心層）
**判定**：與 D1 同一套字邊界規則
**基線檔**：`tests/baselines/locality.json` — `{ limits: { componentId: { files, dirs } } }`

**驗證規則**：任一元件的 `files` 或 `dirs` 超過其上限 → 失敗，並指出是哪個元件。
基線只記**上限**不記路徑清單——路徑會頻繁變動，記上限即可，且讓 diff 保持可讀。

---

## 6. Baseline（基線，共用形狀）

```
tests/baselines/<guardName>.json
{
  "_meta": {
    "guard": "neutrality",
    "measuredAt": "2026-08-06",
    "rule": "字邊界比對，先剝註解；註解引用另計不入基線",
    "note": "數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。"
  },
  ...guard-specific fields
}
```

`_meta.rule` 滿足 FR-012／FR-042「定義並記錄判定方式」；`_meta.note` 讓任何看到這個 diff 的人知道規則。

---

## 7. 唯一動到 `src/` 的東西：`skipPaths`

FR-022 要求「本來就不需要某條路徑」必須**顯式宣告**。這是本功能唯一需要在 `src/` 新增的欄位：

```
ConceptDefJSON
└── skipPaths?: PathName[]        # 新增，可選
                                   # 例：['execute'] 表示本元件刻意不執行
```

- **可選欄位**，不填等同 `[]`，既有 149 個元件**零改動**
- 純資料、不改變任何執行期行為 —— 只有完備性護欄讀它
- 本功能**不為既有元件填寫它**（spec Assumptions 已載明）：填了就會把「缺」變成「實作」，那是修，不是量

> 這是「讓沉默的正確出聲」（`concepts/執行機構.md`）的落地：正確的空必須宣告，缺失的空才變得可偵測。
