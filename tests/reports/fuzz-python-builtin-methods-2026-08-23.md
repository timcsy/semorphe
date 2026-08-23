# 模糊測試報告 — Python — 2026-08-23

## 摘要

- 語言：Python（3.13.7，`python3`）
- 範疇：`builtin-methods`｜難度：medium｜程式數：**10**
- 出題者：**資訊隔離的代理**（worktree，只知道「Python 老師出中級練習題」）
- 成功執行（參照實作）：10／10
- **第一次跑**：PASS 2、SEMANTIC_DIFF 2、執行失敗 6
- **修完之後**：PASS **10**、降級節點 **0**、`it.todo` **0**

## 發現的 Bug（九個，全部當場修）

| # | 症狀 | 根因 | 修在哪 |
|---|---|---|---|
| 1 | `"-7".zfill(5)` → `000-7`（真的是 `-0007`） | 補零沒有把符號留在最前面 | `builtins.ts` `zfill` |
| 2 | `round(10.0, 2)` → `10`（真的是 `10.0`） | 給了位數還回整數型別 | `builtins.ts` `round` |
| 3 | `map(f, "abcd", [1,2,3])` 每一格第二個參數都是 `None` | `map` 只讀 `a[1]`，不吃多串 | `builtins.ts` `map` |
| 4 | `filter(None, xs)` → 「這個東西叫不動」 | 沒有處理「判斷式是 `None`」這個慣用寫法 | `builtins.ts` `filter` |
| 5 | `" ".join(str(c).rjust(2) for c in row)` → `c` 沒宣告 | **裸的產生器被當成兩個引數**（`arguments` 欄位就是產生器本身） | 26 顆膠囊改用 `pythonCallArgs` |
| 6 | `d.pop("k")` → `xs.splice is not a function` | `pop` 只當串列處理（而字典也有 `.pop`） | `builtins.ts` `pop` |
| 7 | `repr(x)`／`.setdefault(k, v)`／`.add(x)` 不存在 | 內建表的缺口 | `builtins.ts` |
| 8 | `{1,2,3} & {2}` 整段降級 | 集合的四個運算（`&｜-｜^`）沒有路由也沒有語義 | `arithmetic` 的樣式 ＋ `apply.ts` |
| 9 | `def make_change(amount, coins=(25,10,5,1))` 跑不動 | 預設值只認純量字面 | `func_def/call.ts` |

⚠️ **第 6 個是這一輪自己造成的**（當天早些時候修 `xs.pop(0)` 忽略位置時只想到串列）
——**模糊測試在同一輪內抓到同一輪的迴歸**。

🔴 **第 9 個修完之後要對得上 Python 那個有名的陷阱**：
`def collect(item, bucket=[])` 的串列**在每次呼叫之間共用**
（`collect("a")` → `['a']`、`collect("b")` → `['a', 'b']`）。
每次給一份新的會印出一個真的 Python 不會印的答案——**那比不支援更糟**。

## 覆蓋缺口（沒有修，而它們現在是誠實降級）

| 寫法 | 狀態 |
|---|---|
| `def f(x=g())`（預設值是一個呼叫） | 執行期出聲：「預設值 g()（只認得字面）」 |
| `~x`（位元反相） | 沒有路由 → 灰色方塊 |

## 產生的回歸測試

- `tests/integration/fuzz-python-builtin-methods.test.ts`——**十段全部**（不是只有 PASS 的那些），
  每一段三項斷言：不降級／來回之後身分集合相同／輸出與真 `python3` 逐字相同
- `it.todo`：**0**

## 建議後續

1. 位元反相 `~` 與 `<<`／`>>`——同一族還缺的三個運算子
2. 預設值改成**接點**而不是字串（`knowledge` 的既有教訓：需要 parse 回結構才能用的字串，就不該是字串）
