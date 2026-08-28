# for 與 range

> 走過一串東西，而不用自己數。 · ⏱ 約 25 分鐘

## 你會學到三件事

1. `for ... in` 走過一串東西
2. `range()` 產生一串數字
3. **`for` 和 `while` 各自什麼時候用**

## 開始之前

上一課的迴圈，三樣東西散在三個地方，而第三樣很容易忘。

`for` 把它們包起來——**你不可能漏掉前進**。

## 一、`range`

```python
for i in range(1, 6):
    print(i)
```

印出 `1 2 3 4 5`。

⚠️ **`range(1, 6)` 不含 6。**「含頭不含尾」——這個約定整個 Python 都通用。

| 寫法 | 產生 |
|---|---|
| `range(5)` | 0, 1, 2, 3, 4 |
| `range(1, 6)` | 1, 2, 3, 4, 5 |
| `range(0, 10, 2)` | 0, 2, 4, 6, 8 |
| `range(5, 0, -1)` | 5, 4, 3, 2, 1 |

**只給一個數字的話從 0 開始**——`range(5)` 是 0 到 4，剛好 5 個。

## 二、累加

```python
total = 0
for i in range(1, 11):
    total = total + i
print(total)      # 55
```

和上一課的 `while` 版本做同一件事，而**少了一行**（不用自己 `n = n + 1`），
也**少了一個出錯的地方**。

## 三、`for` vs `while`

| | 什麼時候用 |
|---|---|
| **`for`** | **知道要跑幾次**、或要走過一串現成的東西 |
| **`while`** | **不知道要跑幾次**——跑到某件事發生為止 |

```python
for i in range(10):        # 就是十次
while user_says_yes():     # 幾次不知道
```

> **能用 `for` 就用 `for`。**
> 它把「前進」寫死了，所以你不會忘記，也不會寫錯。

## 四、`for` 也可以走別的東西

```python
for c in "Python":
    print(c)
```

一個字一個字印出來——**文字本身就是一串東西**。

下一課的清單也是。**`for ... in` 走的是「任何一串東西」**，
不是只有數字。

⚠️ **不要為了拿位置而寫 `range(len(x))`**：

```python
names = ["a", "b", "c"]
for n in names:              # ✅
for i in range(len(names)):  # ⚠️ 除非你真的需要 i
```

## 五、`break` / `continue` 一樣能用

```python
for i in range(1, 11):
    if i == 5:
        break
    print(i)
```

印 `1 2 3 4` 就停。和 `while` 完全一樣。

## 完成的樣子

```python
for i in range(1, 6):
    print(i)

total = 0
for i in range(1, 11):
    total = total + i
print(total)
```

## 換你了

用巢狀 `for` 印出九九乘法表的前三列。

⚠️ 提示：外圈走列、內圈走行；`print(i * j, end=" ")` 不換行，
一列跑完再 `print()` 換一行。

## 這一課你做了什麼

- 你用 `for ... in range(...)` 跑了固定次數
- 你知道 `range` 含頭不含尾
- 你分得出什麼時候該用 `for`、什麼時候該用 `while`

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 少印一個數字 | `range(n)` 不含 `n`。要含就 `range(n + 1)` |
| `range` 印出 `range(0, 5)` | 它是一個產生器。要看內容用 `list(range(5))` |
| 巢狀迴圈全擠一行 | `print()` 換行那一行位置不對 |
| 迴圈變數在外面用不到 | `for` 的變數在迴圈結束後還在，而值是最後一次的 |
