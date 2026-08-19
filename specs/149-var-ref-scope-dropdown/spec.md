# 149 — `cpp:var_ref` 的下拉只投影了「範圍」的一半

**日期**：2026-08-19 · **上游**：`vision` 未清的債（spec `148` 掀出來的那條）

## 出發點：瀏覽器裡看到的

```
貼上   pinMode(D1, OUTPUT)          （目標：Wemos D1 mini）
點開   D1 的下拉
看到   x                             ← 工作區的變數，而工作區裡沒有 D1
```

## 🔄 而這條債原本的問法是錯的

昨天記成「`D1` 該不該 lift 成 `cpp:pin_constant`」。查了執行期那側之後：

`arduino-pins.ts:166` 逐字：
> 「**一個名字的意思由誰宣告它決定。**
> → 這張表由 `cpp:var_ref` 在**查不到宣告之後**才問。」

`var_ref/execute.ts:58` 逐字（為什麼不做成 lift 樣式）：
> 「第一版把 `HIGH`／`LOW`／`OUTPUT` 做成一個 lift 樣式（靠識別字的名字認），
> 而第三十二條護欄當場抓到：`enum Level { LOW = -1 };` 讓 `cout << LOW`
> 印成 **0** 而不是 **-1**——**樣式把使用者宣告的名字搶走了**。」

🟢 **所以身分是對的**：`cpp:var_ref` 是「一個名字的參照」，
而那個名字是變數還是環境常數，是**範圍**的問題，不是身分的問題。

```
執行期問的範圍   宣告的變數 ∪ 串流 ∪ 環境提供的具名常數    ← 三段
下拉投影的範圍   宣告的變數                              ← 一段
```

> **同一個「範圍」，執行期看得到三段，而積木上只畫得出一段。**

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 學生選得到他板子上的名字 (Priority: P1)

**驗收**：D1 mini 下，`var_ref` 的下拉含 `D0–D8`／`A0`／`HIGH`…，
**而工作區裡宣告過的變數仍然在**。

### User Story 2 - 🔴 使用者自己的宣告要贏 (Priority: P1)

學生寫 `int D1 = 3;`。
**驗收**：下拉裡 `D1` **只出現一次**（而不是「變數 D1」與「常數 D1」各一個）。
> 一個名字的意思由誰宣告它決定——而下拉不得讓同一個名字看起來有兩個意思。

### User Story 3 - 🔴 「寫入目標」那些欄位一個常數都不得多 (Priority: P1)

> 🔄 **實作時量到的數字改寫了這一條**：`getWorkspaceVarOptions()` 有
> **十個呼叫端**，而只有 `cpp_var_ref` 是**讀**。其餘九個是**寫入目標**：
> `cpp_var_assign`（把變數 X 設成…）、`cpp_increment`／`_expression`、
> `cpp_compound_assign`／`_expression`。
>
> **原本只想到 `cpp_input`／`scanf`——而真正的界線比那寬得多。**

**驗收**：那九個欄位的選項**與今天逐字相同**——否則學生選得到 `HIGH = 5`。

🔴 **這是這一刀最重要的界線**：**不得改共用的 `getWorkspaceVarOptions()`**。

### Edge Cases

- **沒有板子的目標**（`cpp`／`c`／競程）→ 下拉與今天逐字相同
- **順序**：變數在前（**它們是學生自己的**），板子常數在後
- **值不在選項裡**：既有機制會保留它（spec 148 已驗），這裡不得破壞

## Requirements *(mandatory)*

- **FR-001**：`cpp_var_ref` 的 `NAME` 下拉 MUST ＝ 工作區變數 ∪ 目前板子的常數
- **FR-002**：🔴 同名 MUST 只出現一次，且**變數那一份贏**
- **FR-003**：🔴 共用的 `getWorkspaceVarOptions()` MUST 不變（它有別的消費者）
- **FR-004**：沒有板子時 MUST 與今天逐字相同

## Success Criteria

- **SC-001**：D1 mini 下貼 `pinMode(D1, OUTPUT)`，下拉列得出 `D1`
- **SC-002**：`cpp_input` 的下拉選項數在四塊板子下都不變
- **SC-003**：全套測試綠

## 明確排除

- **套件常數**（`DHT11`／`WL_*`）——它們**不隨板子變**，而列進 `cpp` 目標
  會讓一個今天只有學生自己變數的下拉多出 20 個名字（P4：**過濾不是簡化**，
  但也不該反過來把無關的東西塞進來）。**它是另一條線。**
- **串流的名字**（`cout`／`cin`）——它們不是值，插在運算式位置沒有意義
- **改 lift 身分**——執行期規則已定案，改身分會與它牴觸
- **`pinConstantValue` 的 `/^A\d+$/` 判準**——⚠️ 它是一個看名字形狀的判準，
  今天是對的而 `D` 系進來後沒有對應規則。**這一刀不修它，也不在它上面疊新的形狀判斷。**

## 🔴 實作中掀出的第二個缺口（規格補記）

驗收 US2 的**錨點**（「先證明變數那一側真的也提供 `D1`」）當場紅了
——`cpp_var_assign` 的下拉只有 `(自訂)`。查下去：

```ts
} else if (isPlainDeclaration(abstractConceptOf(block.type) ?? '')) {
```

`abstractConceptOf` 的鍵是**概念身分**（`cpp:pin_attach`，冒號），
而 `block.type` 是**導出的積木型別**（`cpp_pin_attach`，底線）。

🔴 **那個分支永遠是 `false`——24 顆宣告元件一顆都沒進下拉**
（`vector`／`string`／`map`／`pin_attach`／`servo_declare`…）。

> **兩個字串都長得像識別字，而它們是兩個命名空間
> ——型別系統擋不住，因為兩邊都是 `string`。**

⚠️ 而它靜默了很久：查不到只會讓下拉**少幾個名字**，不會拋錯。

**FR-005**：🔴 積木型別 MUST 先轉成概念身分才問 `abstractConceptOf`
（同檔 `blockTypesDeclaringVariableType()` 早就是對的做法：走 spec registry）。

## 已知的坑

1. 🔴 **改到共用函式** → `cpp_input` 會長出常數（US3 就是它的偵測器）
2. **測試看不到「學生點開下拉看到什麼」** → **必須開瀏覽器**（`verify-in-browser`）
3. **驗收要走「貼程式碼」那條路**——`experience`：
   「一個修好的投影，可能不在使用者走的那條路上」
