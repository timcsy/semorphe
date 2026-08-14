# Data Model：診斷的三個實體

**Date**: 2026-08-14

---

## 實體一：Diagnostic（一則診斷）

一次規則觸發的紀錄。**它是真實那一側的東西，所以不含任何給人看的字串。**

| 欄位 | 意義 | 變動 |
|---|---|---|
| `nodeId` | 錨在哪個語義節點 | ⚪ 不變（2026-08-14 已從 `blockId` 換過來） |
| `severity` | `warning` \| `error` | ⚪ 不變 |
| ~~`message`~~ | ~~一個 i18n key~~ | 🔴 **刪除**——不留相容欄位，讓 tsc 找出所有引用處 |
| `rule` | **是哪一條規則**（規則的身分） | 🆕 |
| `params` | 這次觸發的相關資訊 | 🆕 |

### `params` 的形狀與規則

```
型別      Record<string, string | number>
可以是空  ✅ 是（一條規則不需要參數時就是 {}）
誰決定    產出端（規則的 check 分支知道什麼，就放什麼）
誰使用    各面板自己決定用不用、用哪幾個
```

> ⚠️ **一個參數被某個面板忽略是正常的，不是浪費**——
> 那正是「兩個面板組出不同訊息」的機制本身。

### 驗證規則

- `rule` 不得為空字串
- `params` 的值只能是字串或數字（**不可巢狀**——巢狀等於把組裝邏輯偷渡進資料）
- 同一個 `(nodeId, rule, params)` 可以出現多次嗎？
  ✅ **可以，但今天不該發生**——見下方「既有缺陷」

---

## 實體二：DiagnosticRule（診斷規則）

什麼情況算問題的宣告。住在 `src/languages/cpp/diagnostics.ts`，今天有 **4 條**。

| 欄位 | 意義 | 變動 |
|---|---|---|
| `blockTypes` | 這條規則看哪些積木 | ⚪ 不變 |
| `check` | `hasInput` \| `varDeclareNames` | ⚪ 不變 |
| `inputName` | `hasInput` 要看哪個插槽 | ⚪ 不變（但**現在會被帶進 params**） |
| `severity` | 觸發時的嚴重程度 | ⚪ 不變 |
| ~~`message`~~ | ~~i18n key~~ | 🔴 **改名為 `rule`**——它本來就是身分，不是訊息 |

### 四條規則與它們的參數

| 規則身分 | 觸發條件 | `params` |
|---|---|---|
| `MISSING_CONDITION` | `cpp_if`／`cpp_if_else`／`cpp_loop_while` 的 `CONDITION` 空 | `{ inputName: 'CONDITION' }` |
| `MISSING_VALUE`（print） | `cpp_print` 的 `EXPR0` 空 | `{ inputName: 'EXPR0' }` |
| `MISSING_VAR_NAME` | `cpp_var_declare` 第 i 個名字是空的 | `{ index: i }` |

⚠️ **`MISSING_VALUE` 今天被兩條規則共用**（`cpp_print` 與 `cpp_var_declare`），
而它們是**不同的問題**。本功能把後者分出來叫 `MISSING_VAR_NAME`
——因為只有分開，兩個面板才能對它們說不同的話。

> **一個身分被兩個不同的問題共用，等於承諾了它們永遠要用同一句話。**

---

## 實體三：面板文案（Panel Label）

每個面板持有自己的一套文案。住在既有的 `src/i18n/{lang}/blocks.json`。

### key 的形式

```
DIAG_<RULE>_<PANEL>          PANEL ∈ { BLOCK, CODE }
```

| | 規則 | 面板 | 語言 | 合計 |
|---|---|---|---|---|
| 今天 | 2 個 key | — | 2 | **4 份** |
| 之後 | 3 條規則 | 2 | 2 | **12 份** |

⚠️ 數字從 spec 的「16 份」修正為 **12 份**：spec 寫的是「4 條規則」，
而那是**規則條目**數（`cpp_if` 與 `cpp_loop_while` 各算一條）；
**規則身分**只有 3 個。完備性檢查要照**身分**列舉，不是照條目。

### 兩個面板的措辭方向

| 規則身分 | 積木側（教學） | 程式碼側（像編譯器） |
|---|---|---|
| `MISSING_CONDITION` | 「缺少條件」 | 「expected expression for CONDITION」 |
| `MISSING_VALUE` | 「缺少要輸出的內容」 | 「expected expression for EXPR0」 |
| `MISSING_VAR_NAME` | 「第 N 個變數還沒有名字」 | 「declarator N has no name」 |

⚠️ **`MISSING_VAR_NAME` 兩側都用得上 `index`**，而 `MISSING_CONDITION`
只有程式碼側用得上 `inputName`——**這個不對稱本身就是設計的目的**。

---

## 🔴 既有缺陷：三則無法區分的診斷

`src/core/diagnostics.ts:76-94` 對 `int , , ;` 產出**三則 `nodeId` 與 `message`
完全相同**的診斷。

```
今天    { nodeId: 'n1', severity: 'warning', message: 'DIAG_MISSING_VALUE' } × 3
之後    { nodeId: 'n1', rule: 'MISSING_VAR_NAME', params: { index: 0 } }
        { nodeId: 'n1', rule: 'MISSING_VAR_NAME', params: { index: 1 } }
        { nodeId: 'n1', rule: 'MISSING_VAR_NAME', params: { index: 2 } }
```

⚠️ **則數不變（3 → 3）**——本功能不改變診斷的觸發，只讓它們可以互相區分。
SC-005「護欄基線一個都不動」因此成立。

⚠️ 而積木面板今天用 `setWarningText` **後蓋前**，所以三則只看得到一則。
本功能之後積木側要把同一顆積木的多則**合併成一段文字**，
否則資料修好了而畫面照樣只顯示一則。**這是 tasks 要涵蓋的一步。**
