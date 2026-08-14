# 契約：`Diagnostic` 與面板的組裝責任

**Date**: 2026-08-14

本檔定義**跨邊界**的形狀。實作細節（怎麼查 i18n、怎麼拼字串）不在這裡。

---

## 契約一：核心產出什麼

```typescript
export interface Diagnostic {
  /** 語義節點的 id——唯一真實那一側 */
  nodeId: string
  severity: 'warning' | 'error'
  /** 是哪一條規則。**身分，不是訊息。** */
  rule: string
  /** 這次觸發的相關資訊。可以是空的。 */
  params: Record<string, string | number>
}
```

**核心的義務**

- MUST NOT 產出任何給人看的字串
- MUST 把規則在判定時**已經知道**的資訊放進 `params`
  （`hasInput` 知道 `inputName`；`varDeclareNames` 知道 `index`）
- MUST NOT 判斷哪個面板用得到——**那是面板的事**

**核心的非義務**

- 不保證 `params` 非空
- 不保證同一個 `(nodeId, rule)` 只出現一次
  ——`int , , ;` 就會出現三次，靠 `params.index` 區分

---

## 契約二：面板消費什麼

```typescript
onDiagnostics?(event: DiagnosticsEvent): void
```

**每個面板的義務**

- MUST 自己把 `(rule, params)` 組成訊息
- MUST NOT 依賴其他面板的組裝結果
- 🔴 MUST NOT 把 `rule` 的原始值當訊息顯示給使用者
  （今天 `?? key` ／ `|| d.message` 就是這樣——**本功能要消滅它**）
- 對用不到的 `params` 鍵，MUST 直接忽略（不是錯誤）

**同一個節點的多則診斷**

| 面板 | 今天 | 之後 |
|---|---|---|
| 積木 | 🔴 `setWarningText` **後蓋前**，只看得到一則 | MUST 把同一顆積木的多則**合併成一段** |
| 程式碼 | 各自一個 marker（可疊） | ⚪ 不變——marker 本來就能多則 |

> ⚠️ **積木側的合併不是額外功能，是修正**：三個空變數今天只報一個，
> 而那讓使用者以為只有一個問題。

---

## 契約三：文案的完備性

**key 的形式**：`DIAG_<RULE>_<PANEL>`，`PANEL ∈ { BLOCK, CODE }`

**必須存在的集合** = `規則身分` × `面板` × `語言`

```
3 × 2 × 2 = 12 份
```

**護欄的義務**（第四十二條，硬性零）

- MUST 從**規則定義**列舉身分，不得手寫一份清單
  （手寫的清單會與規則漂移——`experience` 的雙重真相）
- MUST 在缺漏時**指名**是哪一條規則、哪一個面板、哪一種語言
- MUST 有一個**入口條件**錨在合成量上：
  掃到的規則身分數若為 0 → 這條護欄不算數，而不是「沒有缺漏」

⚠️ **入口條件不可錨在「缺漏數」上**——那正是這條要推向零的東西
（`build-guardrail` 第 2 步）。

---

## 契約四：什麼**不**在這個契約裡

- **可用詞彙集**——訊息按「讀的人碰過哪些概念」調整。今天沒有學生進度狀態，
  所以那個集合恆等於「全部」。觸發條件見
  `knowledge/draft/2026-08-13-Ln的n只是排序.md` §五之九
- **規則吃語義樹**——今天規則仍然吃積木（`src/core/diagnostics.ts:23` 逐字：
  「把規則搬到語義樹是下一步，不在這一輪的範圍裡」）
- **第三個面板**——契約允許它存在（`onDiagnostics?` 是可選方法，
  **沒有它 ＝ 明確地不接**），但本功能不建立它

---

## 破壞性變更清單

| 變更 | 誰會壞 | 為什麼不留相容 |
|---|---|---|
| `Diagnostic.message` **刪除** | 所有產出端與消費端 | 🔴 **這正是目的**——讓 tsc 當機械檢查，把「漏改一處」變成編譯錯誤而非執行期靜默 |
| `DiagnosticRule.message` → `rule` | 4 條規則定義 | 它本來就是身分，名字叫 `message` 誤導了每一個讀它的人 |
| `DIAG_MISSING_VALUE` 拆成兩個身分 | i18n 檔 | `cpp_print` 與 `cpp_var_declare` 是**不同的問題**，共用身分等於承諾它們永遠說同一句話 |

⚠️ 🔴 **而那個機械檢查有一個邊界，實作時才撞到**：`tsconfig.json` 的
`include: ['src']`——**測試不在型別檢查範圍內**。
`tests/integration/block-mutations.test.ts` 的兩處 `result[0].message`
tsc 一聲不吭，是**全套測試**抓到的。

> **一個「讓型別檢查去找」的策略，只涵蓋型別檢查看得到的地方
> ——而那個範圍寫在設定檔裡，不寫在策略裡。**
