# 函式

> 給一段程式取個名字，之後就叫得動它。 · ⏱ 約 30 分鐘

## 你會學到三件事

1. `def` 定義一個函式
2. **參數**進去、**回傳值**出來
3. 函式裡面的變數**只活在裡面**

## 開始之前

第 2 課你給一個**值**取了名字。這一課要給一段**程式**取名字。

而你其實一直在用別人寫好的：`print`、`len`、`input`、`int` 都是函式。

## 一、`def`

```python
def add(a, b):
    return a + b

print(add(3, 4))      # 7
```

```
def add(a, b):
 ↑   ↑   ↑    ↑
關鍵字 名字 參數  冒號（和 if / for 一樣）
    return a + b
    └─ 縮排 ＝ 函式的身體
```

⚠️ **函式要先定義才能用**——定義寫在呼叫的後面會 `NameError`。

## 二、`return`

`return` 同時做兩件事：

1. 把值**交出去**
2. **立刻結束這個函式**——後面的行不會跑

```python
def f(n):
    return n
    print("印不出來")      # ← 永遠不會跑
```

**沒有 `return` 的函式回傳 `None`**：

```python
def greet(name):
    print("你好，" + name)

x = greet("小明")
print(x)              # None
```

⚠️ 這是一個常見的困惑：**「印出來」和「交出去」是兩件不同的事。**

| | 給誰 |
|---|---|
| `print(x)` | 給**人**看 |
| `return x` | 給**呼叫它的那段程式**用 |

## 三、參數可以有預設值

```python
def greet(name, greeting="你好"):
    print(greeting + "，" + name)

greet("小明")             # 你好，小明
greet("小明", "早安")      # 早安，小明
```

⚠️ **有預設值的參數要放後面。** `def f(a=1, b)` 是語法錯誤。

## 四、🔴 裡面的變數只活在裡面

```python
def f():
    x = 10
    print(x)

f()
print(x)          # 💥 NameError：外面沒有 x
```

函式裡宣告的變數叫**區域變數**——函式結束它就消失了。

好處是：**你在函式裡取什麼名字，都不會撞到外面的東西。**

⚠️ 反過來，函式**讀得到**外面的變數，而**改不到**：

```python
total = 0
def add():
    total = total + 1      # 💥 UnboundLocalError
```

要改外面的東西，正確的做法是**回傳它**：

```python
def add(total):
    return total + 1

total = add(total)
```

（有個 `global` 關鍵字可以強行改，而**幾乎永遠不該用它**。）

## 五、為什麼要寫函式

```
① 同一段程式要用好幾次      → 不用複製貼上
② 一段程式做的事需要一個名字 → 讀的人不必看細節
③ 可以單獨測試那一小段      → 出錯時範圍小
```

> **函式不是「進階語法」——它是你第一次覺得
> 「這幾行我不想再寫一遍」的時候，自然會想要的東西。**

## 完成的樣子

```python
def add(a, b):
    return a + b

def greet(name):
    print("你好，" + name)

print(add(3, 4))
greet("小明")
```

## 換你了

寫一個 `is_leap(year)`，回傳 `True` 或 `False`（第 5 課那個閏年規則）。

⚠️ **要 `return`，不要 `print`**——這樣它才用得進 `if is_leap(2000):`。

## 這一課你做了什麼

- 你用 `def` 定義了兩個函式
- 你分得出 `print`（給人看）和 `return`（交出去）
- 你知道函式裡的變數只活在裡面

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `NameError: add` | 函式定義寫在呼叫的後面了 |
| 函式回傳 `None` | 少了 `return` |
| `UnboundLocalError` | 在函式裡改了外面的變數。改成回傳它 |
| `TypeError: missing argument` | 呼叫時參數個數不對 |
| 函式印出來了卻不能拿來用 | `print` 不是 `return` |
