# 迴圈與可迭代

> Python 的 for 只有一種，而它是 C++ 的範圍 for。 · ⏱ 約 30 分鐘

## 你會學到三件事

1. Python **沒有 `for (int i = 0; i < n; i++)`**
2. `range()` 產生一串數字
3. `enumerate()` 在需要位置的時候用

## 開始之前

C++ 有兩種 `for`：計數的和範圍的。

**Python 只有範圍的那一種。** 而計數要用 `range()` 補回來。

## 一、`for ... in`

```python
for i in range(3):
    print(i)
```

印出 `0 1 2`。

`range(3)` 是「**0、1、2**」這三個數字——⚠️ **不含 3**。

| 寫法 | 產生 |
|---|---|
| `range(3)` | 0, 1, 2 |
| `range(1, 4)` | 1, 2, 3 |
| `range(0, 10, 2)` | 0, 2, 4, 6, 8 |
| `range(3, 0, -1)` | 3, 2, 1 |

「**含頭不含尾**」和 C++ 的 `i = 0; i < n` 是同一個約定，
只是這次它寫在名字裡而不是條件裡。

## 二、直接走過東西

```python
names = ["a", "b", "c"]
for n in names:
    print(n)
```

這和 C++ 的 `for (string n : names)` 一模一樣，
只是**不用寫型別**、不用 `auto`。

⚠️ 而 Python 裡這是**唯一**的走法——沒有「用位置走」的那種寫法。

## 三、需要位置的時候：`enumerate`

```python
for i, n in enumerate(names):
    print(i, n)
```

印出：

```
0 a
1 b
2 c
```

`enumerate` 一次給你**兩樣東西**：位置和值。

而 `for i, n in ...` 這個寫法叫**拆包**——右邊給一對，左邊拆成兩個名字。

> ⚠️ **不要為了拿位置而寫 `for i in range(len(names))`。**
> 那能跑，而 `enumerate` 是這個語言想要你寫的方式——
> 少一個地方會寫錯，就是少一個 bug（C++ 入門第 13 課那句話）。

## 四、`while` 一模一樣

```python
n = 3
while n > 0:
    print(n)
    n -= 1
```

⚠️ **沒有 `n--`。** Python 只有 `-=`。

（理由是 `--n` 在 Python 裡是合法的——它是「負的負的 n」，也就是 `n`。
所以那個寫法**不會報錯，而且什麼都不做**。刪掉它比留一個陷阱好。）

## 完成的樣子

```python
for i in range(3):
    print(i)

names = ["a", "b", "c"]
for i, n in enumerate(names):
    print(i, n)

n = 3
while n > 0:
    print(n)
    n -= 1
```

## 換你了

用 `range` 印出 1 到 10 之間的偶數，**不要用 `if`**。

提示：`range` 的第三個參數是步長。

## 這一課你做了什麼

- 你用 `for ... in` 走過了一串數字和一串文字
- 你用 `enumerate` 同時拿到了位置和值
- 你知道 Python 沒有 `++` 和 `--`

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| 少印一個數字 | `range(n)` 不含 `n`。要含就寫 `range(n + 1)` |
| `for i in names` 拿到的是值不是位置 | 那就是它的行為。要位置用 `enumerate` |
| `n--` 沒有反應 | 它是「負負得正」，什麼都沒做。要用 `n -= 1` |
| `range` 印出來是 `range(0, 3)` | `range` 是一個產生器，不是清單。要看內容用 `list(range(3))` |
