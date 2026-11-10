# 概念探索：C++ — 帶本體的 friend 函式

## 摘要
- 語言：C++
- 目標：類別本體裡直接寫完本體的 friend 函式（`[class.friend]`：它是外層命名空間的函式，本體在類別的語彙範圍裡，可讀私有成員）
- 發現概念總數：1；語言特定：1
- 課程位置：與 `cpp:friend_function` 同一格（cpp-beginner、cpp-advanced、arduino）
- 來源：盲測 `fuzz-cpp-ostream-operator` 的 fuzz_3；學生語料 StudyCpp 0 支（`friend` 零命中），依據是教科書寫法

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `cpp:friend_def` | `friend R f(params) { body }` | 在類別裡定義一個朋友函式：不是方法，讀得到私有成員 | 回傳型別、名字、參數、本體 | C++ 特定 | `raw_code` | 與原型那顆是不同身分，同 `method_declare`／`method_def` 的分法 |

## 為什麼不是 `cpp:friend_function` 的一個形態
原型與定義的差別不是位置，是有沒有本體這個接點。專案裡同樣的切分是 `cpp:method_declare` 與 `cpp:method_def`。

## 依賴關係
`cpp:param_decl`（參數）、`cpp:stream_write`（`os << …`，392）、類別成員的 lift（`liftClassMember`）。

## Cella 對應
`mbFriend { f, ret, params }` 只有簽章，`cella/tools/cfamily/cpp_to_tree.py:1384` 的 FriendDecl 也不帶本體。
送法已問 Cella（類別裡 `mbFriend` 加類別後的頂層函式），回覆前 formalize 照實 `f.miss`。

## 需注意的邊界案例
- `friend ostream& operator<<(…)`：名字是 `operator_name`，回傳型別帶參考（`reference_declarator`）。
- 回傳指標或 `const` 回傳型別：沿用原型那條的拆法。
- 限定名（`friend void A::f() {…}` 不合法但會被 tree-sitter 接受）、帶預設值、樣板：維持降級。
- 大括號風格：K&R／Allman 兩種都要走 `openBraceFor`。
- 名字只有 ADL 找得到：`f()` 無類別型別引數時真編譯器拒絕，攤平翻譯要請 Cella 確認。
