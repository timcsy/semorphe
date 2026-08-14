# Research：診斷訊息由「一個字串」改為「規則 ＋ 參數」

**Date**: 2026-08-14

本檔只記**查證過的地面真相**與**它推翻了什麼**。所有行號都可 grep。

---

## 一、起點比 spec 假設的好一半，也比它假設的糟一半

### 好的那一半：`message` 已經是 i18n key，不是字面字串

```
src/languages/cpp/diagnostics.ts:10   message: 'DIAG_MISSING_CONDITION'
src/i18n/zh-TW/blocks.json:170        "DIAG_MISSING_CONDITION": "缺少條件"
src/i18n/en/blocks.json:170           "DIAG_MISSING_CONDITION": "Missing condition"
```

**所以「訊息不存字串」這一半早就做到了。** 缺的只有「每個面板一份」。

### 糟的那一半：兩個面板查同一張表，所以拿到同一個字串

```
src/ui/panels/monaco-panel.ts:231     Blockly?.Msg?.[key] ?? key
src/ui/panels/blockly-panel.ts:477    Blockly.Msg[d.message] || d.message
```

⚠️ 兩處都用 `?? key` ／ `|| d.message` 做**靜默降級**——文案漏了就把原始代號
（`DIAG_MISSING_CONDITION`）直接顯示給使用者，而沒有任何抱怨。
**這正是 FR-005 要禁止的行為，而它今天存在於兩個地方。**

---

## 二、🔴 決定性發現：參數管道**今天就有消費者**，而它蓋著一個既有缺陷

### Constitution I（簡約優先／YAGNI）的疑問

spec 的檢查清單第三輪留下一個問題：

> 現有 4 條規則都不需要參數，那參數管道是不是「為假設性未來需求預留擴充」？

**答案是否定的，而證據在 `src/core/diagnostics.ts:76-94`：**

```typescript
case 'varDeclareNames': {
  let i = 0
  while (true) {
    const name = block.getFieldValue(`NAME_${i}`)
    if (name === null) break
    if (!name || name.trim() === '') {
      diagnostics.push({ nodeId: block.nodeId, severity: rule.severity, message: rule.message })
    }
    i++
  }
  ...
```

**它逐個掃 `NAME_0`／`NAME_1`／…，每個空名字各推一則診斷
——而每一則的 `nodeId` 與 `message` 完全相同。**

```
int a, , c;    →  1 則
int , , ;      →  🔴 3 則【一模一樣】的診斷
```

### 那三則今天長什麼樣

| 面板 | 行為 | 後果 |
|---|---|---|
| 積木 | `setWarningText` 對同一顆積木呼叫三次 | **後蓋前**，只剩一則，而使用者不知道有三個空的 |
| 程式碼 | 三個 marker 疊在同一個行區間 | 波浪重疊，滑鼠移上去看到三句一樣的話 |

> **N 個不同的問題產出 N 則無法區分的診斷——那不是「還沒做參數」，
> 那是「資訊在產出的當下就被丟掉了」。**

### 所以 Constitution Check 的判定

| | |
|---|---|
| 是不是為未來預留？ | ❌ **不是**——今天就有一筆資訊（第幾個名字）在產出時被丟掉 |
| 三行相似程式碼能不能取代？ | ❌ **不能**——問題不在抽象不足，在**資料遺失** |
| 最小可行的參數是什麼？ | `varDeclareNames` 的 `index`；`hasInput` 的 `inputName` |

⚠️ **而本功能不改變診斷的則數**（`int , , ;` 之後仍然是 3 則）。
改變的是**那 3 則從此可以互相區分**。SC-005「護欄基線一個都不動」因此仍然成立。

---

## 三、`hasInput` 也有一個現成的參數，而它今天也被丟掉

```
src/languages/cpp/diagnostics.ts:8    inputName: 'CONDITION'
src/languages/cpp/diagnostics.ts:22   inputName: 'EXPR0'
```

規則**知道**缺的是哪一個插槽，而診斷產出時沒有帶上。

這正好是「兩個面板不同說法」的最佳示範：

```
積木側    「缺少條件」                        ← 學生看得到那個插槽是空的，不需要名字
程式碼側  「expected expression for CONDITION」 ← 程式碼裡看不到插槽，名字才有用
```

> **同一筆參數，一個面板用得上、另一個用不上——這正是為什麼組裝要在面板側，
> 而不是在產出側。**

---

## 四、決策

### 決策 1：`Diagnostic` 帶 `rule` ＋ `params`，刪掉 `message`

- **Rationale**：P1 投影定理——訊息是投影，投影的結果不得被存起來當真實。
  而 §二 證明了「產出時就丟掉資訊」是今天真實發生的損失。
- **Alternatives considered**：
  - **保留 `message` 再加 `params`** ❌ 雙重真相（架構陷阱第一條），
    而且沒有任何東西逼人改用新的
  - **面板各查一張以 rule 為 key 的死表，不要參數** ❌ 解不掉 §二 的三則重複
    ——那三則的 `rule` 相同，死表給不出區別

### 決策 2：文案 key 的命名帶面板

- **Rationale**：完備性檢查（FR-004）要能機械地列舉「規則 × 面板 × 語言」。
  key 裡含面板 → 檢查就是字串組合，不需要另一份對照表。
- **形式**：`DIAG_<RULE>_<PANEL>`，例如 `DIAG_MISSING_CONDITION_BLOCK`／`..._CODE`
- **Alternatives considered**：
  - **兩個檔案分開放（`blocks.json` vs `code.json`）** ❌ 今天所有文案都在
    `i18n/{lang}/blocks.json`，新增一個檔要動載入流程，而收益只是分類

### 決策 3：`?? key` 的靜默降級改成**開發期報錯**，而不是執行期丟例外

- **Rationale**：`experience` 有一條專講這個——多層 fallback 用同一個預設值會掩蓋
  真正的資料遺失。而執行期丟例外會讓一份漏掉的文案**弄壞整個畫面**，
  代價與損害不成比例。
- **形式**：一支護欄測試列舉全部 `規則 × 面板 × 語言`，缺一則紅並**指名**。
  執行期保留一個看得出是壞掉的顯示（而非看起來像正常訊息的原始代號）。

### 決策 4：本輪**不動**規則的觸發條件

`src/core/diagnostics.ts:23` 逐字：「把規則搬到語義樹是下一步，**不在這一輪的範圍裡**」。
→ `runDiagnostics` 的 `switch` 分支邏輯一行不改，**只改 push 進去的東西**。

---

## 五、風險與對策

| 風險 | 出處 | 對策 |
|---|---|---|
| 🔴 兩個面板組出一樣的字串，測試照樣綠 | `experience.md:1155` | SC-004 的注入：改成同一個組法 → e2e 必須紅 |
| 漏掉一個面板的文案，顯示成原始代號 | 今天 `?? key` 就是這樣 | 決策 3 的護欄，**指名**缺的那一份 |
| 改型別時漏掉一個產出端 | —— | **刪掉 `message`** 而非留相容欄位，讓 tsc 當機械檢查 |
| 三則重複診斷「修好了」而護欄基線動了 | SC-005 | ⚠️ **則數不變**，只是變得可區分——先跑基線確認 |

---

## 六、⚠️ 一個必須一併更正的過期註解

`src/ui/panels/monaco-panel.ts:222` 逐字：

> 「訊息今天只有一種深度。⚠️ 而它該是兩條軸的函數（**學生程度** × 面板）
> ……那是驗收④，不在這一輪」

「學生程度」2026-08-14 已被否決（`knowledge/experience.md` 第 99 條）。
**FR-007 要求更正它**——`experience.md:1946`「路徑活著不代表做法還對
——一份指著存在檔案的過時說明書最難發現」。
