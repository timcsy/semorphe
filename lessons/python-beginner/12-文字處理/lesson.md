# 文字處理

> 把前面十一課接起來，做一件真的事。 · ⏱ 約 30 分鐘

## 你會學到三件事

1. 字串常用的幾個方法
2. `split` 把一句話拆成一串字
3. **推導式**：把一串變成另一串

## 開始之前

這是入門的最後一課。它**沒有太多新概念**——
它是把清單、迴圈、函式接起來，做一件你真的可能會做的事。

## 一、字串的方法

```python
s = "Hello, World"
print(s.upper())       # HELLO, WORLD
print(s.lower())       # hello, world
print(len(s))          # 12
```

⚠️ **它們都回傳新的，不會改到 `s`**。

```python
s.upper()              # 算出來了，而沒有人接住它 → 白做
s = s.upper()          # ✅
```

**字串在 Python 裡是不可變的**——所有「改」字串的方法，
其實都是「做一個新的」。

常用的：

| | 做什麼 |
|---|---|
| `s.strip()` | 去掉頭尾的空白（**處理輸入時幾乎一定要**） |
| `s.replace(a, b)` | 把 a 換成 b |
| `s.startswith(x)` / `endswith(x)` | 開頭／結尾是不是 x |
| `s.find(x)` | x 在第幾個位置（找不到回 `-1`） |
| `x in s` | x 在不在裡面 |

## 二、`split`：拆成一串

```python
print(s.split(", "))      # ['Hello', 'World']
```

**一段文字 → 一個清單**。這是處理輸入最常用的一招：

```python
line = "3 1 4 1 5"
parts = line.split()              # ['3','1','4','1','5']
nums = [int(x) for x in parts]    # [3, 1, 4, 1, 5]
```

⚠️ `split()` **不給參數就是按空白拆**，而且連續的空白算一個。

反過來是 `join`：

```python
print(", ".join(["a", "b", "c"]))     # a, b, c
```

⚠️ **是「用什麼連」`.join(要連的東西)`**，順序很容易記反。

## 三、推導式

```python
words = ["a", "bb", "ccc"]
print([len(w) for w in words])        # [1, 2, 3]
```

它就是這四行壓成一行：

```python
result = []
for w in words:
    result.append(len(w))
```

從右邊往左邊讀：「**走過 `words` 的每一個 `w`，把它換成 `len(w)`**」。

加上篩選：

```python
[w for w in words if len(w) > 1]      # ['bb', 'ccc']
```

⚠️ **短的時候才用它。** 兩層迴圈、又有 `if/else` 的話，
寫成一般迴圈會好讀很多。

> **推導式是「把一串變成另一串」的寫法，
> 不是「用比較少的字寫迴圈」的寫法。**

## 四、串起來

```python
line = input()
words = line.strip().split()
lengths = [len(w) for w in words]
print(max(lengths))
```

四行裡面用到了：輸入（第 3 課）、方法鏈、清單（第 8 課）、
推導式、內建函式。**這就是一支小 Python 程式平常的樣子。**

## 完成的樣子

```python
s = "Hello, World"
print(s.upper())
print(s.lower())
print(len(s))
print(s.split(", "))
print(s.replace("World", "Python"))
words = ["a", "bb", "ccc"]
print([len(w) for w in words])
```

## 換你了

讀進一段英文，印出**出現最多次的那個字**。

⚠️ 用得到：`split()`（這一課）、`dict` 的 `get`（第 9 課）、
`max`（第 8 課）。**這一題把三課接起來了。**

## 這一課你做了什麼

- 你用了字串的幾個常用方法，並知道它們回傳新的
- 你用 `split` 把一句話拆成了一串字
- 你用推導式把一串變成了另一串

## 接下來

入門到這裡結束。你已經有了寫一支小程式需要的全部東西。

往下有兩條路：

- **Python 銜接**——如果你也想學 C++，那一軌講兩個語言的差別
- **C++ 進階**——排序、二分搜、圖、動態規劃

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `s.upper()` 之後 `s` 沒變 | 字串不可變。要 `s = s.upper()` |
| `split` 拆出空字串 | 前後有空白。先 `.strip()` |
| `join` 說型別錯 | 裡面要全是文字。數字要先 `str(...)` |
| 推導式看不懂 | 先拆成三行迴圈寫一次，再壓回去 |
