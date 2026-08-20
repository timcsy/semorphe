# 157 — 一筆讀不懂的樣式被靜靜忽略，而等價還只是宣告

**日期**：2026-08-20 · **路線圖**：階段 7 第二刀 · **前一刀**：`156`

## 出發點：spec 156 留下一筆沒有人查的宣告

```
合法值   simple | operatorDispatch | chain | composite | unwrap | contextTransform | multiResult
我寫的   named-call                                       ← 不在裡面
而它     已經被 componentLiftPatterns() glob 進生產路徑（61 筆裡有它）
實測     出現過的 patternType：chain, composite, named-call, operatorDispatch
```

> **一筆型別不合法的宣告，被 glob 收進了生產路徑，而沒有任何東西說話。**

⚠️ 這是這個專案「宣告了而沒有人查它」的第**六**次，而**它比前五次更難發現**：
前幾次是「**沒有人讀**」，這次是「**讀了，而讀的人不驗**」。

🔴 而 `lift-patterns.ts` 的檔頭**早就寫著這一課**：

> 「⚠️ 它同時是『**照抄已驗證的形狀**』的反例——前兩種的形狀是對的，
> 而**這一顆不是同一類東西**。**照抄之前要先問「它是不是同一類」。**」

**而我昨天正是照著 cpp 的樣式檔抄了一個不同類的東西。**

## 🔄 而上一則簡報有一句承諾要收回

我說這一刀可以讓 wasm「重新出貨」。**做不到**：
`shipped-assets` 要求「**有人真的去要它**」，而瀏覽器只有在**有 Python target**
時才會去解析 Python——**而 target／工具箱／課程是 spec 156 明確排除的**。

🟢 所以這一刀的行為證據**在測試側**，wasm **仍然不出貨**。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 🔴 讀不懂的樣式要當場出聲 (Priority: P1)

**驗收**：任何一筆 `lift-pattern.json` 的 `patternType` 不在合法集合裡 → **護欄紅**，
而**我那筆 `named-call` 是第一個被它抓到的**。

### User Story 2 - 🔴 等價從【宣告】升級成【行為】 (Priority: P1)

spec 156 的護欄自己寫著它量不到什麼：

> 「量不到　它們是不是**真的**做同一件事——那要行為證據」

**驗收**：一段**真的 Python 原始碼** `print("hi")` → lift 出 `python:print`
→ generate 回**一字不差**。

### User Story 3 - 🔴 C++ 一個字都不能變 (Priority: P1)

⚠️ Python 的樣式接上之後會**真的參與比對**，而 `call` 這種 AST 節點名
**兩個語言都有**。
**驗收**：C++ 的 4736 支一支不變；三個中立性維度 `0 / 33 / 0` 不上升。

### Edge Cases

- **`astNodeType` 撞名**（`call` 在兩個語言都存在）→ ⚠️ 若污染 C++ 的 lift，
  **那是這一刀的第二個發現**，要記下來而不是繞過
- **wasm 仍不出貨** → 行為證據在測試側；重開條件是「Python 有了 target」

## Requirements *(mandatory)*

- **FR-001**：MUST 有一條護欄驗 `patternType`（合法集合來自型別定義，**不是另抄一份**）
- **FR-002**：`python:print` 的樣式 MUST 改成合法形狀
- **FR-003**：MUST 有一支測試，從**真的 Python 原始碼**走到語義樹再走回程式碼
- **FR-004**：🔴 C++ 既有行為 MUST 零變更

## Success Criteria

- **SC-001**：不合法的 `patternType` 會紅（注入驗過）
- **SC-002**：`print("hi")` roundtrip 一字不差
- **SC-003**：全套綠；三維不上升

## 明確排除

- **Python 的積木**——⚠️ 那才會逼到 `block-registrar` 的 33 筆，**一次只解一個**
- **Python 的執行期／target／工具箱／課程**
- **wasm 出貨**（見上）

## 已知的坑

1. 🔴 **合法值要從型別來源取**，不要在測試裡再抄一份——**兩份判準遲早會漂**
2. **照抄之前要先問「它是不是同一類」**（`lift-patterns.ts` 檔頭，而我昨天沒問）
3. ⚠️ **注入要編得過**，且要分辨「真的綠／真的紅／沒跑起來」
4. 🔴 **檢查測試結果要抓 `failed`，不要看尾巴**（昨天在 e2e 紅著時說了「已推送」）
