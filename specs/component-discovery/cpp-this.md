# 概念探索：C++ — `this`

## 摘要
- 語言：C++
- 目標：`this` 運算式（以及它出現的三個位置：`this->成員`、`this->方法()`、`*this`）
- 發現概念總數：**1**（`cpp:this`）——其餘三種寫法由既有元件組合出來，不另立身分
- 通用概念 0、語言特定概念 1（Python 的 `self` 是一個普通的參數名，已經是 `var_ref`，不是同一個概念）
- 歸屬：`cpp-beginner`、`cpp-advanced` 的元件清單（與 `class_def`、`method_def` 同處；主題檔已是平坦清單，沒有層級樹）

## 量到的缺口（為什麼要做）
2026-11-05 量到：`struct P { int x; int get() { return this->x; } };`——`this->x` 整段降級成 `raw_code`，程式「翻不出」、Cella 不判。
原因：`cpp:struct_at_ptr` 的 lift 先 lift 接收者，而接收者 `this` 沒有任何元件認得 ⟹ null ⟹ 整段降級。隱含的成員 `x` 已支援（formalize 送 `eSelf`）。

## Cella 的對應（權威：cella `tools/cfamily/cpp_to_tree.py`）

| 寫法 | Cella 的程式 JSON |
|---|---|
| `this` | `eThis {n}` |
| `this->x`（明寫） | `eArrow {a: eThis, f: "x"}` ——**不是** `eSelf`（`eSelf` 只給隱含的成員） |
| 隱含的 `x` | `eSelf {x: "x"}`（已支援） |
| `this->f(args)` | `eMCall {obj: eThis, arrow: true, f, args}` |
| `*this` | `eDeref(eThis)` |

⟹ 只要 `cpp:this` 的 formalize 送 `eThis`，`struct_at_ptr`（`eArrow`）、方法呼叫、`pointer_deref` 都經由 `exprOf(obj)` 自動接上。

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp:this` | `this` | 「這個物件自己」——成員函式裡指向呼叫它的那個物件 | 0（一個運算式積木，標籤「這個物件」） | lang-core | C++ 特定 | `raw_code` | 只在成員函式裡合法；在成員函式外是編譯錯誤（Cella 判） |

## 依賴關係
- 依賴：`cpp:class_def`／`cpp:struct_declare`＋`cpp:method_def`（寫 `this` 的地方）
- 被組合：`cpp:struct_at_ptr`（`this->x`）、`cpp:method_call` 的 `->` 形態（`this->f()`）、`cpp:pointer_deref`（`*this`）

## 建議實作順序
1. `cpp:this`（膠囊：宣告、形態、標籤、lift／generate／render／extract、formalize `eThis`、測試）

## 跨語言對應
- Python：`self` 是第一個參數的名字，語意樹裡就是 `var_ref`——不對應到 `cpp:this`（不同的概念：一個是語言關鍵字、一個是慣例的名字）。

## 需注意的邊界案例
- `this->x` 與隱含的 `x` 要**各自保留**：產碼一字不差（學生寫了 `this->`，就產 `this->`）；交給 Cella 的形狀也不同（`eArrow(eThis)` vs `eSelf`）。
- 建構子裡常見的 `this->x = x;`（參數遮蔽成員）——`this->` 是必要的，不能被正規化掉。
- `return *this;`（串接呼叫）。
- 成員函式外的 `this` 是編譯錯誤——不在 semorphe 擋，由 Cella 判。
- 積木上的標籤用意思（「這個物件」），不用關鍵字當標籤（i18n 審計：語言關鍵字不當標籤）。
