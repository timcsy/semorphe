# 概念探索：Python — 裝飾器（第 424 刀）

## 摘要
- 語言：Python
- 目標：`@裝飾器` 寫在 `def`／`class` 前面（tree-sitter `decorated_definition`）
- 發現概念總數：1（語言特定）
- 歸屬：`python-beginner.json`，與 `python:func_def`／`python:class_def` 同一層

## 來源
- 盲測第二批 fuzz_3：`@staticmethod def fmt(x)` 讓整個 `class Account` 照實保留成 `class_definition`。
- 盲測第二批 fuzz_7：`@lru_cache(maxsize=None) def fib_fast(n)` 照實保留成 `decorated_definition`。
- Cella 已實測：`@staticmethod`／`@classmethod`／`@property` accept，輸出與 CPython 一致；
  `functools`（`lru_cache`）Cella 不支援 → `knownCellaGap`。

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `python:decorated` | `@d1`<br>`@d2(x)`<br>`def f(): …` | 把一個定義交給一串函式包裝（由下往上套用） | 可增減的裝飾器（運算式插槽）＋ 一格定義（語句插槽） | python | 整段 `decorated_definition` 照實保留（`unresolved`） | 新元件 |

### 接點
- `decorators`：expression（一串；每一格是名字、屬性、呼叫——原始碼的順序就是 AST `decorator_list` 的順序）
- `definition`：statement（恰好一個：`python:func_def` 或 `python:class_def`）

### Cella 對應
Cella 的 AST 沒有「被裝飾的定義」這個節點：裝飾器是 `sFunctionDef`／`sClassDef` 的 `decoratorList`。
⟹ formalize 用具名轉換 `decorated`：翻譯子節點，再把裝飾器塞進它的 `decoratorList`。
今天 `func_def/formalize.json` 與 `classDef` 轉換一律送 `[]`——那是對的（沒有 `python:decorated` 包著時就是沒有裝飾器）。

## 設計決定
- (a) **新元件包住定義**（採用）：不動 `func_def`／`class_def` 的存檔格式、積木、對照圖；與 AST 的形狀一致（tree-sitter 本來就是一個外層節點）。
- (b) 在 func_def／class_def 上加 `decorators` 接點（不採用）：改兩顆既有積木的 extraState（存檔契約）、全部對照圖重產，而大部分學生程式用不到。
- 🔴 **不可以收一半**（experience「不可以收一半」）：任何一個裝飾器 lift 出來是照實保留的節點、或定義不是 func_def／class_def ⟹ 整個 `decorated_definition` 照實保留。
- 類別裡的方法：`class_def` 的 lift 目前只收 `function_definition`／`expression_statement`，要加收 `decorated_definition`（放進 `methods`）。

## 積木
- 顏色／分類照 `python:func_def`（`#FF6680`、functions）。
- 形狀：`套用裝飾器 ⟨d0⟩ ⟨d1⟩ … ＋ −` 一列，下面一格語句插槽放定義。
  可增減的插槽用 `builder: variadic`；它目前把 `TAIL`（± 那一列）接在靜態部分的**後面**——
  定義那一格要在裝飾器**下面**，所以要讓 variadic 建構子能宣告「這幾格留在最後」。

## 邊界案例
- 多個裝飾器：套用順序由下往上，產碼照原順序一行一個。
- 方法上的 `@property`／`@x.setter`（屬性運算式）。
- 呼叫形式的裝飾器 `@lru_cache(maxsize=None)`。
- 巢狀函式上的裝飾器（函式本體裡）。
