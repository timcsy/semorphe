# Phase 0 研究：互斥判定是可解的，但判別式不只在 constraints 裡

**Feature**: 051-lift-claim-arbitration ｜ **Date**: 2026-08-06

## F1：限定條件的語言很小，互斥可判定

```
AstConstraint = { field, text?, nodeType?, match?: 'exact' | 'startsWith' }
```

只有四個欄位、兩種比對方式。**兩條限定條件是否互斥，在這個語言上算得出來**：

| 情形 | 判定 |
|---|---|
| 同 `field`，兩邊都是 `text` exact 且值不同 | **互斥**——一個欄位不可能同時是兩個值 |
| 同 `field`，兩邊都是 `nodeType` 且值不同 | **互斥** |
| 同 `field`，一邊 exact `x`、一邊 startsWith `y`，而 `x` 不以 `y` 開頭 | **互斥** |
| 同 `field`，一邊 startsWith `a`、一邊 startsWith `b`，互不為前綴 | **互斥** |
| 不同 `field` | **判不出來**——兩者可能同時成立 |
| 任一邊沒有限定條件 | 那一邊匹配全部 → 只要另一邊也可能匹配就**會撞** |

這比預期樂觀——spec 的 Assumptions 說「交集不一定算得出來」是對的，但**算得出來的比例應該不低**。

## F2：判別式不只在 `constraints` 裡 —— 這是最容易漏的一點

`binary_expression @priority=105` 有兩條：`print` 與 `input`。若只看 `constraints[]`，兩者都是空的 → 會被判成「確定會撞」。

**但它們其實永遠不會撞**：

```
print:  chain { operator: '<<', rootMatch: { text: 'cout' } }
input:  chain { operator: '>>', rootMatch: { text: 'cin'  } }
```

判別式住在 **`chain.operator` 與 `chain.rootMatch.text`**，不在 `constraints`。

**若漏掉這一層，護欄會在專案最常用的兩條規則上誤報**——那足以讓維護者立刻學會忽略它（spec Risks 明列的頭號風險）。

各 patternType 的隱含判別式：

| patternType | 隱含判別式 |
|---|---|
| `chain` | `chain.operator` ＋ `chain.rootMatch.text` |
| `operatorDispatch` | `operatorDispatch.routes` 的鍵集合 |
| `composite` | `composite.checks`（每個是 field ＋ typeIs／operatorIn） |
| `simple` / `constrained` | 只有 `constraints` |

## F3：`declaration @priority=10` 的 8 條——確定會撞

實測列出：`cpp_pointer_declare`、`cpp_ref_declare`、`cpp_vector_declare`、`cpp_string_declare`、`cpp_map_declare`、`cpp_stack_declare`、`cpp_queue_declare`、`cpp_set_declare`。

它們全是 `simple` 型、priority 相同、且**沒有能證明互斥的限定條件**——所以勝負純粹是登記順序。050 撞到的 `string s[2]` 就在這裡。

**這一組是 FR-022 要釘住的那個已知案例**：護欄報不出它就是壞了。

## F4：`pointer_expression` 的重複登記

實測顯示 `cpp_address_of` 與 `cpp_pointer_deref` **這同一對概念在 priority=10 與 priority=20 各出現一次**。

同一對概念出現兩次，不是優先權設計，是**同一個概念從兩個來源被登記**（blockSpec 的 `astPattern` 一次、`lift-patterns.json` 一次）——`calcPriority` 對兩個來源給的基礎分不同（blockSpec 減 5），所以落在不同 priority。

FR-013 要求區分「重複登記」與「優先權設計」，判準就是：**同一個 conceptId 在同一 nodeType 上出現一次以上 = 重複登記**。

---

## 技術決策

### D1：三分類的判定程序（FR-010～FR-012）

對同一 nodeType 的每一對規則 (A, B)：

```
1. 蒐集雙方的「判別式集合」= constraints ∪ patternType 專屬判別式（F2）
2. 若存在一個判別維度，雙方在該維度上可證互斥（F1 的表）  → 不會撞
3. 否則若雙方的判別式集合皆為空                            → 確定會撞
4. 否則                                                    → 無法確定
```

**保守方向明確**：只有在**能證明**互斥時才判「不會撞」。判不出來一律「無法確定」，絕不因為「看起來不會撞」就歸入安全（FR-012）。

**否決**：實際跑樣本程式碼看兩者會不會同時匹配——那是動態抽樣，**抽不到不代表不會撞**，會給假的安全感。

### D2：護欄在哪裡取得載入後的規則集合（FR-001、FR-030）

**決定**：用測試專用的載入路徑（與其他四條護欄相同的 `createTestLifter`），讀取其內部的規則表。**不修改任何生產程式碼**。

**理由**：FR-030 要求零行為改動。開一個公開查詢介面（如 049 為 executor 做的）在這裡不必要——規則表已經可從測試建立的實例取得。

**代價與誠實標記**：測試載入路徑與 app 載入路徑若有差異，量測會偏。049 的完備性護欄已經在量兩種組態的差異，若那裡顯示無差異，這裡就可信。**報表要聲明這個依賴**。

### D3：「同優先權」與「會撞」兩個數字都要（US1 ＋ US2）

**決定**：兩個都量、都進基線，**並呈現兩者的差集**。

| 數字 | 是什麼 | 特性 |
|---|---|---|
| 同優先權組數 | 代理指標 | 算得準，但可能誤報（如 print/input） |
| 確定會撞 | 真問題的下界 | 保守，不會誤報 |
| 無法確定 | 判定能力的邊界 | 它變大代表判定程序需要加強 |

**差集本身是資訊**：「同優先權但不會撞」的那些，代表**優先權設定得沒有意義**（設了但沒有區分作用）；「不同優先權但會撞」的那些，代表**優先權在做隱形的仲裁**——後者更危險，因為它看起來像設計。

### D4：自我否證聲明的內容（FR-020）

報表開頭固定印出：

> **如果 `declaration` 那 8 條沒有出現在「確定會撞」裡，代表本護欄壞了。**
> 本護欄**不檢測**：跨語法節點的間接競爭、手寫辨識層、執行期才成立的條件。

第一句對應 FR-022（有測試釘住），第二句對應 FR-021。

### D5：三個數字的棘輪形式

與 049 四條護欄同形：`tests/baselines/lift-ambiguity.json`，三個數字各自只准下降。

**「無法確定」也是棘輪**——它變大代表判定程序退步或有人加了判不出來的規則，兩者都該擋。（與 050 的 `[UNVERIFIED]` 同一個處理。）
