# 函式與例外

> 定義函式，以及讓錯誤變成一條可以走的路。 · ⏱ 約 35 分鐘

## 你會學到三件事

1. `def`：不用寫回傳型別，而可以有**預設值**
2. `lambda` 和 `*args`
3. `try / except`：錯誤不是當機，是一條分支

## 開始之前

C++ 的函式要寫回傳型別和每個參數的型別。
Python 兩個都不用——而換來的是**你要自己知道**。

## 一、`def`

```python
def add(a, b=1):
    return a + b

print(add(3))         # 4   ← b 用預設值
print(add(3, 4))      # 7
```

`b=1` 是**預設值**：呼叫時不給就用它。

⚠️ **有預設值的參數要放在後面。** `def f(a=1, b)` 是語法錯誤。

⚠️ **預設值不要用 list**（`def f(items=[])`）——那個 list 是**所有呼叫共用同一個**，
而不是每次新的。這是 Python 最有名的一個坑，先知道有這件事就好。

## 二、`*args`：數量不定

```python
def total(*args):
    return sum(args)

print(total(1, 2, 3))     # 6
```

`*args` 把「傳進來的所有東西」收成一個 tuple。

`sum()` 是內建的——**Python 有很多這種內建函式**（`len` `max` `min` `sorted` `sum`），
遇到「我想做某件很常見的事」時，先查一下有沒有。

## 三、`lambda`：一次性的小函式

```python
double = lambda x: x * 2
print(double(5))          # 10
```

它就是一個沒有名字的 `def`，而只能寫**一個運算式**。

它的用處在「**把一個函式當參數傳進去**」：

```python
sorted(names, key=lambda s: len(s))     # 依長度排序
```

⚠️ **不要用 `lambda` 取代 `def`。** 上面那個 `double = lambda x: ...`
其實應該寫成 `def double(x): return x * 2`——一樣長，而好讀又好除錯。

## 四、`try / except`

```python
try:
    n = int("abc")
except ValueError:
    print("轉換失敗")
```

`int("abc")` 轉不出來，於是它**丟出一個 `ValueError`**。

沒有 `try` 的話程式當場停掉；有的話，`except` 那一段接住它，程式繼續走。

| | 意思 |
|---|---|
| `try:` | 這一段可能會出事 |
| `except ValueError:` | 出的是這種事的話，做這個 |
| `else:` | 都沒出事的話（少用） |
| `finally:` | 不管有沒有出事都要做（關檔案之類） |

⚠️ **不要寫光禿禿的 `except:`。** 那會連你按 Ctrl+C 都接住，
而且會把**你自己的打字錯誤**一起吞掉——一個接住所有錯誤的程式，
與一個沒有錯誤的程式看起來一樣。

> **例外不是「錯誤處理」，是「另一條路」。**
> 檔案不存在、使用者打錯字、網路斷了——這些**本來就會發生**，
> 它們不是 bug，是你的程式該想過的情況。

## 完成的樣子

```python
def add(a, b=1):
    return a + b

def total(*args):
    return sum(args)

print(add(3))
print(add(3, 4))
print(total(1, 2, 3))

double = lambda x: x * 2
print(double(5))

try:
    n = int("abc")
except ValueError:
    print("轉換失敗")
```

## 換你了

寫一個函式，讀進使用者輸入並轉成整數——**打錯字的話要求他重打**，
而不是當掉。

提示：`while True:` ＋ `try` ＋ 成功就 `return`。

## 這一課你做了什麼

- 你定義了帶預設值和不定數量參數的函式
- 你寫了一個 `lambda`，並知道大部分時候該用 `def`
- 你用 `try / except` 把一個錯誤變成一條分支

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `SyntaxError: non-default argument follows default` | 有預設值的參數要放後面 |
| 例外沒被接住 | `except` 的型別不對。先寫 `except Exception as e: print(e)` 看看是什麼 |
| 函式回傳 `None` | 少了 `return`。Python 不寫 return 就回 `None` |
| 預設值 list 每次呼叫都變長 | 那個經典的坑。預設寫 `None`，進函式再建新的 |
