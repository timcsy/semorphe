# 資料模型：修復提示

## 新增：缺口（gap）

一個**該有而沒有的 token**，以及它該出現的位置。

```ts
interface SyntaxGap {
  /** 缺的是什麼——直接用解析器給的節點型別（`;`／`)`／…）。
   *  🔴 **不預先列舉**：`experience.md`「列舉已知的，等於保證下一個會被漏掉」。 */
  missing: string
  /** 它該出現的地方。⚠️ 0-based，與 `startPosition` 一致，換算留給面板。 */
  line: number
  column: number
}
```

## 改動一：`AstNode` 多一格

```ts
isMissing?: boolean
```

⚠️ **選用，理由與 `hasError` 逐字相同**：測試裡的假樹省略它，
而它們描述的正是**沒有缺口**的樹——讀成 falsy 是語義正確的，不是靜默回退。

## 改動二：節點的 metadata 裝缺口**陣列**

```ts
metadata.syntaxGaps?: SyntaxGap[]
```

⚠️ **陣列不是單值**——規格的邊界案例：「一個檔案少很多分號 → 每一個都報，
**而不合併**：合併會讓『哪裡』消失」。

## 改動三：`Diagnostic` 多一格選用的錨點

```ts
at?: { line: number; column: number }
```

🔴 **為什麼不能用 `nodeId`**：一個 MISSING 的 token **不在語義樹裡**
——沒有節點，就沒有 id 指得到它。見 [research.md](research.md) R1。

> **一個「不存在的東西」的位置，只能用它【該出現的地方】來表達
> ——而在一棵樹裡，那不是一個節點，是一個【縫】。**

## 誰讀什麼

| | 讀 `rule` | 讀 `params.missing` | 讀 `at` |
|---|---|---|---|
| 程式碼側 | ✅ 決定訊息 | ✅ 說出缺什麼 | ✅ **把波浪縮到那一欄** |
| 積木側 | ✅ | ✅ | ⚠️ **只讀 `line`**——積木沒有「欄」 |

**那個不對稱是刻意的**（同 `Diagnostic.rule` 檔頭記的理由）。
