# 契約：診斷的來源，與兩個產出端的合併

**Date**: 2026-08-14

---

## 契約一：`Diagnostic` 加一格

```typescript
export interface Diagnostic {
  nodeId: string
  severity: 'warning' | 'error'
  rule: string
  params: Record<string, string | number>
  /** 這則診斷是【誰】判定的。**不是給人看的標籤。** */
  source: 'component' | 'parser'
}
```

**為什麼它不是裝飾**——它決定三件事：

| 問題 | `component` | `parser` |
|---|---|---|
| **誰該修** | 學生的樹不合元件的宣告 | 學生打錯字 |
| **能不能要求歸零** | ✅ 可完備（宣告是有限的） | ✅ 由解析器決定，我們不猜 |
| **未來加值的門檻** | —— | 🔴 **要有真的產出端才准加**（`compiler`／`runtime` 今天沒有） |

⚠️ **來源是字面聯集，不是列舉物件**——加一個值就是改一行，
而 tsc 會把所有 `switch`／比對處指出來。

---

## 契約二：兩個產出端，一次廣播

```
產出端 A   runDiagnostics(blocks, rules)      → source: 'component'
產出端 B   diagnosticsFromTree(tree)（新）    → source: 'parser'

           ⚠️ 兩者【必須合併成一次】 onDiagnostics({ diagnostics: [...A, ...B] })
```

🔴 **不可以分兩次廣播**：`setModelMarkers` 與 `setWarningText(null)` 的語義
都是**全集取代**——第二次會把第一次清掉。

**合併點在 `app.ts`**，而它需要樹：

```
訂閱 semantic:update  →  快取 tree  →  重跑診斷（合併兩個來源）
```

⚠️ **順帶補一個既有缺口**：診斷今天只掛在 Blockly 的變更上
（`app.ts:534`），所以**程式碼改動不會直接觸發診斷**
——`e2e/diagnostics.spec.ts` 的檔頭記過「那是另一條線，今天沒有防線」。

---

## 契約三：產出端 B 的義務

```typescript
export function diagnosticsFromTree(tree: SemanticNode): Diagnostic[]
```

- MUST 只挑 `degradationCause === 'syntax_error'` 的節點
  ——🔴 **`unsupported` 與 `nonstandard_but_valid` 一個都不准帶**
- MUST 產出 `severity: 'error'`、`source: 'parser'`、`rule: 'SYNTAX_ERROR'`
- MUST 把節點上的壞掉原文放進 `params.snippet`
- MUST NOT 讀取或修改樹（純函式）
- MUST NOT 產出訊息字串（那是面板的事）

---

## 契約四：殘差通道剩下什麼

```
搬走   syntax_error            → 診斷通道，Error 級，owner 'semorphe'
留下   unsupported             → 殘差通道，Info 級，owner 'semorphe-residual'
留下   nonstandard_but_valid   → 同上
```

**`renderResidual` MUST 濾掉 `syntax_error`**——否則同一件事顯示兩次
（一條紅波浪 ＋ 一條灰提示疊在同一行）。

> 🔴 **這是本功能最大的風險點**：三種降級原因今天共用同一個 `if (cause)`。
> **一起搬走的話，學生會看到「你的程式有 12 個錯誤」，而其中 11 個是我們的問題。**

⚠️ 而**測試要同時驗證兩件事**：搬走的搬走了、**留下的留下了**。
只驗前者的話，「全部改成 Error」也會通過。

---

## 契約五：文案

規則身分從 **3 → 4**（加 `SYNTAX_ERROR`），所以文案從 12 → **16 份**
（4 身分 × 2 面板 × 2 語言）。

**第四十二條護欄自動涵蓋**——它從**規則定義**列舉身分，
⚠️ 而 `SYNTAX_ERROR` 不在 `cppDiagnosticRules` 裡（它不是一條規則）。
**所以那條護欄的身分來源要擴**：規則表的身分 ＋ 樹產出端的身分。

> **一條護欄如果只看得到一個產出端，第二個產出端的文案缺漏它就看不到。**

### 兩個面板的措辭方向

| | 積木側（教學） | 程式碼側（像編譯器） |
|---|---|---|
| `SYNTAX_ERROR` | 「這一段程式我看不懂，積木上這塊是照抄的：{snippet}」 | 「這一行的語法不完整」 |

⚠️ **積木側用得到 `snippet`、程式碼側用不到**（波浪已經指在那一行上）
——**那個不對稱正是兩面板分開組裝的目的**。

---

## 破壞性變更清單

| 變更 | 誰會壞 | 為什麼不留相容 |
|---|---|---|
| `Diagnostic` 加 **必要** 欄位 `source` | 所有產出端 | 🔴 選用欄位 ＝ 允許「不說是誰的問題」，而那正是本功能要治的 |
| `DiagnosticRule` 也要說得出來源 | 4 條規則定義 | 規則產出的診斷一律 `component`，可以在產出端統一填——**不必每條規則寫一次** |
| `renderResidual` 少畫一種 cause | 程式碼面板 | 它搬去診斷通道了；不濾就會顯示兩次 |

⚠️ **而 `tests/` 不在 `tsconfig` 的 `include` 裡**
（`experience` 那條剛學到的），所以「刪欄位讓 tsc 找出所有引用」
**只涵蓋 `src/`**——測試裡的引用要靠**跑測試**找出來。
