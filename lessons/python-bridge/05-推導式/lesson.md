# 推導式

> 把一個迴圈壓成一行。 · ⏱ 約 30 分鐘

## 你會學到三件事

1. `[... for ... in ...]` 一行做出一個新的 list
2. 加上 `if` 就是篩選
3. **什麼時候不該用它**

## 開始之前

這個形狀在 Python 裡到處都是：

```python
squares = []
for n in nums:
    squares.append(n * n)
```

四行，而它只做一件事：「**把每一個都換成別的**」。

## 一、換成別的

```python
squares = [n * n for n in nums]
```

從右邊往左邊讀：

```
[  n * n     for n in nums  ]
   ↑             ↑
 每一個變成    走過 nums 的每一個 n
```

`nums` 是 `[1,2,3,4,5]` 的話，`squares` 就是 `[1,4,9,16,25]`。

⚠️ **它做出一個新的 list，不會改到原來的。**

## 二、加上篩選

```python
evens = [n for n in nums if n % 2 == 0]
```

`if` 放在最後，意思是「**只留下符合的**」→ `[2, 4]`。

兩件事可以一起做：

```python
[n * n for n in nums if n % 2 == 0]     # [4, 16]
```

讀法：「走過每一個 `n`，**如果**是偶數，**就換成** `n * n`」。

## 三、dict 也可以

```python
table = {n: n * n for n in nums}
# {1: 1, 2: 4, 3: 9, 4: 16, 5: 25}
```

差別只在大括號和那個冒號——**和第 4 課分辨 dict / set 的方式一樣**。

## 四、⚠️ 什麼時候不該用

推導式讀起來像一句英文，而那只在**它短的時候**成立。

```python
# 🔴 不要這樣
r = [f(x) for row in grid for x in row if g(x) and h(x) or k(x)]
```

判準：

| 情況 | 用什麼 |
|---|---|
| 一個 for、最多一個 if | ✅ 推導式 |
| 兩層以上的 for | ⚠️ 想一下 |
| 裡面有 `if / else` 又有篩選 | 🔴 寫成迴圈 |
| 你要在裡面 `print` 或改東西 | 🔴 **那不是推導式該做的事** |

> **推導式是「把一串變成另一串」的寫法。
> 它不是「用比較少的字寫迴圈」的寫法。**

## 完成的樣子

```python
nums = [1, 2, 3, 4, 5]
squares = [n * n for n in nums]
print(squares)
evens = [n for n in nums if n % 2 == 0]
print(evens)
table = {n: n * n for n in nums}
print(table)
```

## 換你了

給一串名字，做出「**每個名字的長度**」的 list。

再做一個進階的：只留下長度大於 3 的名字。

## 這一課你做了什麼

- 你用一行做出了一個轉換過的 list
- 你用 `if` 在推導式裡篩選
- 你知道它什麼時候會變成不好讀

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `SyntaxError` | `for` 和 `if` 的順序錯了。`if` 在最後 |
| 拿到的是 `<generator ...>` | 用了小括號。list 要方括號 |
| 原來那串也被改了 | 不會——推導式一定做新的。改到的話是別處 |
| 想在裡面 `if/else` 換值 | 那要寫成 `[a if 條件 else b for ...]`——**位置不一樣** |
