# 396 · nonlocal 與 del 有了自己的元件

> 日期：2026-11-12（423）
> 轉變：`nonlocal count` 與 `del x`／`del o.attr`／`del a, xs[0], o.y` 從「整段誠實降級」變成兩顆新元件 `python:nonlocal`、`python:delete`。
> 來源：盲測第二批（`tests/integration/fuzz-python-student-2.test.ts`）——fuzz_7 的 `make_counter` 因 `nonlocal` 整段照實保留，fuzz_3 的 class 有一半是因為 `del b.rate`。

| 寫法 | 422 之前 | 423 |
|---|---|---|
| `nonlocal count`（單一名字） | 所在函式整段降級 | `python:nonlocal`，形狀照 `python:global` |
| `nonlocal a, b` | 降級 | 仍降級（`global` 也只收單名，兩顆一致） |
| `del x`、`del o.attr`、`del a, xs[0], o.y` | 降級 | `python:delete`，目標可增減（variadic） |
| 單一 `del d[k]` | `python:container_erase` | 不變——`container_erase` 的樣式優先權較高，`delete` 遇到單一下標時讓位 |
| `del (a)`、`del [a, b]` | 降級 | 仍降級 |

## 兩個不在膠囊裡的改動

- **`STATEMENT_ROLE` 要加這兩顆**（`src/providers/cella/formalize/python.ts`）：沒有它，`sNonlocal` 被包進 `sExpr`，Cella 回「unknown constructor sNonlocal of type Expr」。新增一顆 Python 敘述元件時這一張表要記得——目前沒有護欄量它，症狀是 Cella 判 invalid，膠囊自己的 `spec.test.ts`（`expectCellaOut`）會紅。
- **走真積木那支測試不再替型別下拉選單打樁**（`python-loop-names-through-blocks.test.ts`）：打樁的下拉選單讓 `def f():` 回來變成 `-> __custom__`；改成載入真的語言套件。

## Cella 那一側

兩者 Cella 都判 accept、輸出與 CPython 相同；`del` 掉的名字再讀，Cella 給 NameError（`spec.test.ts` 釘著）。
Cella 的對照表（`packages/python/docs/components.json`）還沒有這兩顆的條目，模板 `formalize.json` 是照 Cella AST 的建構子手寫的。
