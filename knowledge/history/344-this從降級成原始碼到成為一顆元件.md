# 344 · `this` 從降級成原始碼到成為一顆元件

> 日期：2026-11-06
> 轉變：隱含成員 `x` 早就支援（formalize 送 `eSelf`），而寫成 `this->x`、`this->f()`、`*this`、`this == o` 時，整段降級成 raw_code——接收者 `this` 沒有元件認得。
> 改成：新元件 `cpp:this`（運算式，積木「這個物件」）；交給 Cella 的形狀照 Cella 的參照翻譯（`tools/cfamily/cpp_to_tree.py`）：顯式的 `this->x` 送 `eArrow(eThis)`，隱含的 `x` 照舊 `eSelf`——**兩種寫法是兩種形態，不硬併成一種**。
> 決定：AI 照推薦（vision 路線圖那一行，量到的覆蓋缺口）。
> 走的路：元件管線六階段（discover → generate → roundtrip → fuzz → integrate → verify-in-browser），worktree `semorphe-311`。

## fuzz 順手修掉的七個既有缺陷（都不是 `this` 帶來的，是 fuzz 第一次拿 OOP 程式去量）

| | 症狀 | 修在哪 |
|---|---|---|
| A | 類別的前置宣告 `class C;` 靜默不見 | class_def／struct_declare 的 lift：沒有本體 → 照實降級成原始碼 |
| B | 自訂的 `gcd` 被認成標準庫的 `__gcd` | math_gcd 的 lift 只認 `__gcd` |
| C | `P(1, 2)` 這種暫時物件送成函式呼叫 | func_call 的 formalize：名字是結構 → `eTemp` |
| D | 參數預設值在產碼與 formalize 都丟了 | `formatParams` 印 `= default`；constructor／method_def 送 `dflt` |
| E | `p->push(x)` 被當成容器的 push | io lifter：經由 `->` 不走容器路由 |
| F | `new vector<int>` 的樣板型別取不到 | new 的 lift 找 template_type／qualified_identifier |
| G | `new T()` 的空括號丟了（值初始化變預設初始化） | 屬性 `valueInit`，積木上由 `renderMapping.hints` 帶著——**第一版記在 layoutHints，長測試的 form-invariance (c) 抓到走一趟積木就丟**（課文 Linked List 兩支），改成屬性 |

修好之後，三個早就登記的「已知缺陷」標記變紅（它們斷言缺陷還在）：建構子預設引數（fuzz-cpp-oop fuzz_6、fuzz_10）、`T(3)` 暫時物件（container-kinds）——轉回正向測試。

StudyCpp 重量：218 支轉一圈同一棵樹、走樣 0，降級節點 1／20514。

## 量到、沒做的

- **printf 型別表不認類別成員**：競賽風格把 cout 換 printf 時，`x`、`this->x`、`p.get()` 都判不出型別，誠實保留 cout ＋ 註解。`this` 沒讓它變差（測試釘住兩種寫法同一種處置）。
- 類別裡的運算子多載、`string(...)` 暫時物件——fuzz 的覆蓋缺口，報告 `tests/reports/fuzz-cpp-oop-this-20261106.md`。
- 前置宣告目前是誠實降級（projection-residual 的比率 0.32 → 0.34 是這個造成的）；做成一顆元件要排進路線圖。
