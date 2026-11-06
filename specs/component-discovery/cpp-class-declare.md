# 概念探索：C++ — 類別的前置宣告

## 摘要
- 語言：C++（C 的 `struct Node;` 同形，這一刀只接 C++ 的判決；見〈邊界案例〉）
- 目標：`class C;`／`struct C;`——只宣告名字、之後（或永遠不）定義
- 發現概念總數：1（語言特定）
- 建議歸屬：`cpp-beginner`、`cpp-advanced`、`arduino` 三份課程清單裡 `cpp:class_def` 的旁邊
- 量到的缺口：今天 class_def／struct_declare 的 lift 遇到沒有本體的就降級成 raw_code（元件管線 311 修的 A）——誠實，但 projection-residual 的比率因此 0.32 → 0.34

## 為什麼要有它（學生在哪裡寫到）
1. **互相指到的兩個類別**：`class B; class A { B* b; }; class B { A* a; };`——宣告順序的經典題。
2. **只拿來宣告指標**：Arduino 的 `class __FlashStringHelper;`（`F("...")` 巨集背後）——從未定義。
3. 鏈結串列、樹的教材常先寫 `struct Node;`。

## 概念目錄

### 結構與類別（oop） — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp:class_declare` | `class C;`／`struct C;` | 先告訴編譯器「有一個叫 C 的類別」，定義在後面（或在別處） | 種類（類別／結構，下拉）＋ 名字 | lang-core | C++ 特定 | raw_code | 種類送 Cella（`isClass`），所以是**意思**、要一格下拉，不是排版提示 |

## 交給 Cella 的形狀（照 cella `tools/cfamily/cpp_to_tree.py:1185–1192`）

```
程式裡之後有同名的定義   → 不送任何項目（「the definition is the item」）
從未定義                 → iClassDecl { n, name, isClass }   isClass = 寫的是 class
```

我們這側判斷「有沒有定義」用既有的 `f.isStructName(name)`（由 `definesType` 收集的類別名）。
只接頂層項目（`r.item`）；寫在函式裡的區域前置宣告照實回 unknown（`f.miss`）。

## 依賴關係
- 依賴：無（獨立的頂層項目）
- 被依賴：`class_def`／`struct_declare` 的 lift 不再自己降級，改成讓給這一顆

## 建議實作順序
只有一顆。lift 走具名策略（要看 `class_specifier`／`struct_specifier` 有沒有 `body`），掛在 class_def 與 struct_declare 讓開的那個點上。

## 跨語言對應
- C：`struct Node;` 同形（`struct_declare` 在 c-beginner 裡）。C 的判決這一刀不接——C 的程式之後有定義時照樣不送，從未定義時照實 `f.miss`（不猜 C 的建構子）。
- Python：沒有對應（動態型別，不需要前置宣告）。

## 需注意的邊界案例
1. **宣告了又定義**：最常見——Cella 那側不送任何東西，判決由定義那一顆負責。
2. **宣告兩次**：`class A; class A;` 合法；兩顆都照樣保留在積木與程式碼裡。
3. **樣板的前置宣告** `template <class T> class X;`——tree-sitter 是 `template_declaration` 包著；這一刀不接，照舊降級。
4. **`friend class B;`**——在類別本體裡，tree-sitter 是 `friend_declaration`，不是這一顆；不能被搶走（優先序要檢查）。
5. **`struct Node* next;`** 這種「把 struct 寫在型別裡」的寫法——是欄位宣告，不是前置宣告；lift 只認**獨立成一句**、沒有宣告子的 `class_specifier`／`struct_specifier`。
6. **`enum class E;`**——不在範圍。
