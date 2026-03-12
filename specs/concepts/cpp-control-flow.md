# 概念探索：C++ — 控制流

## 摘要
- 語言：C++
- 目標：if, while, for, do-while, switch-case, break, continue
- 發現概念總數：10
- 通用概念：6（if, if_else, while_loop, count_loop, break, continue）
- 語言特定概念：4（cpp_for_loop, cpp_do_while, cpp_switch/cpp_case/cpp_default）
- 建議歸屬的 Topic 層級樹節點：L0 基礎（3）、L1a 函式與迴圈（3）、L1b 控制流進階（4）

## 概念目錄

### L0: 基礎 — 根節點

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `if` | `if (cond) { body }` | 條件分支：條件為真時執行 body | condition(expr), then_body(stmts) | universal | 通用 | raw_code | L0 基礎控制流 |
| `if_else` | `if (cond) { ... } else { ... }` | 雙向分支：條件為真走 then，否則走 else | condition(expr), then(stmts), else(stmts) | universal | 通用 | if | 支援 else-if 鏈展平 |
| `while_loop` | `while (cond) { body }` | 條件迴圈：重複執行直到條件為假 | condition(expr), body(stmts) | universal | 通用 | raw_code | L0 基礎迴圈 |

### L1a: 函式與迴圈 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `count_loop` | `for (int i = from; i <= to; i++)` | 計數迴圈：從 from 到 to 逐一遞增 | var_name(field), from(expr), to(expr), body(stmts) | universal | 通用 | cpp_for_loop | 語義化的 for 迴圈；inclusive 屬性控制 < vs <= |
| `break` | `break;` | 跳出最近的迴圈或 switch | 無 | universal | 通用 | raw_code | 僅在迴圈/switch 內有效 |
| `continue` | `continue;` | 跳過目前迭代，進入下一次 | 無 | universal | 通用 | raw_code | 僅在迴圈內有效 |

### L1b: 控制流進階 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_for_loop` | `for (init; cond; update) { body }` | 一般 for 迴圈：三段式初始化/條件/更新 | init(expr), cond(expr), update(expr), body(stmts) | lang-core | C++ 特定 | raw_code | 不符合 count_loop 模式的 for 迴圈 |
| `cpp_do_while` | `do { body } while (cond);` | 後測迴圈：至少執行一次 body，再檢查條件 | body(stmts), cond(expr) | lang-core | C++ 特定 | while_loop | 與 while 差異在於先執行後判斷 |
| `cpp_switch` | `switch (expr) { cases }` | 多路分支：根據表達式的值跳到對應 case | expr(expr), cases(stmts) | lang-core | C++ 特定 | if_else 鏈 | 含 fall-through 語義 |
| `cpp_case` | `case val: body` | switch 的分支標籤 | value(expr), body(stmts) | lang-core | C++ 特定 | — | 必須在 cpp_switch 內 |
| `cpp_default` | `default: body` | switch 的預設分支 | body(stmts) | lang-core | C++ 特定 | — | 必須在 cpp_switch 內 |

## 依賴關係圖

```
if ← if_else（if_else 是 if 的擴展）
while_loop ← cpp_do_while（do_while 是 while 的變體）
count_loop ← cpp_for_loop（count_loop 是 for 的特化）
cpp_switch ← cpp_case, cpp_default（case/default 必須在 switch 內）
break, continue（獨立，但必須在迴圈或 switch 內使用）
```

## 建議實作順序

1. `if` — 最基礎的控制流
2. `if_else` — if 的延伸
3. `while_loop` — 基礎迴圈
4. `count_loop` — 語義化計數迴圈
5. `cpp_for_loop` — 一般 for 迴圈
6. `break` — 迴圈控制
7. `continue` — 迴圈控制
8. `cpp_do_while` — while 的變體
9. `cpp_switch` — 多路分支
10. `cpp_case` + `cpp_default` — switch 的子概念

## 跨語言對應

| C++ 概念 | Python | Java | JavaScript |
|----------|--------|------|------------|
| if / if_else | if / elif / else | if / else if / else | if / else if / else |
| while_loop | while | while | while |
| count_loop | for x in range() | for (int i=...) | for (let i=...) |
| cpp_for_loop | — | for (;;) | for (;;) |
| cpp_do_while | — | do-while | do-while |
| cpp_switch | match (3.10+) | switch | switch |
| break / continue | break / continue | break / continue | break / continue |

## 需注意的邊界案例

1. **else-if 鏈展平**：`if/else if/else` 在 tree-sitter 中是巢狀的 if_statement，但語義上應展平為平行的條件檢查鏈
2. **switch fall-through**：C++ 的 case 預設 fall-through（無 break 會繼續執行下一個 case），是初學者最常犯的錯誤
3. **switch 內的 case 共用作用域**：所有 case 共用同一個作用域，若要在 case 內宣告變數需加 `{}`
4. **for 迴圈的計數模式偵測**：lifter 需區分「計數 for」（→ count_loop）和「一般 for」（→ cpp_for_loop）
5. **break 在 switch vs 迴圈**：break 在 switch 中只跳出 switch，不跳出外層迴圈
6. **do-while 分號**：`do { } while (cond);` 最後有分號，與 while 不同
7. **web-tree-sitter 節點相等性**：`===` 比較 tree-sitter 節點包裝物件會失敗（已知 bug，需用 startPosition 比較）

Sources:
- [C++ Flow control - cppreference.com](https://en.cppreference.com/book/intro/control)
- [switch statement - cppreference.com](https://en.cppreference.com/w/cpp/language/switch.html)
- [while loop - cppreference.com](https://en.cppreference.com/w/cpp/language/while.html)
- [do-while loop - cppreference.com](https://en.cppreference.com/w/cpp/language/do.html)
- [break statement - cppreference.com](https://en.cppreference.com/w/cpp/language/break.html)
- [continue statement - cppreference.com](https://en.cppreference.com/w/cpp/language/continue.html)
- [Statements and flow control - cplusplus.com](https://cplusplus.com/doc/tutorial/control/)
