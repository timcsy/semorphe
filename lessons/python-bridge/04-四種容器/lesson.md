# 四種容器

> 一個語言內建四種裝東西的方式。 · ⏱ 約 35 分鐘

## 你會學到三件事

1. `list` / `dict` / `set` / `tuple` 各裝什麼、各長什麼樣
2. 四種括號：`[]` `{}` `{}` `()`
3. **可變**和**不可變**的差別

## 開始之前

C++ 的 `vector` / `map` / `set` 要 `#include`、要寫型別參數。

Python 這四種是**內建的、有專屬語法的**——所以它們是這個語言的日常，
不是「進階題材」。

## 一、四種，一眼看完

```python
nums  = [3, 1, 4]                    # list  ——有順序、可以重複、可以改
ages  = {"ming": 16, "hua": 17}      # dict  ——鍵 → 值
tags  = {"a", "b"}                   # set   ——不重複、沒順序
point = (1, 2)                       # tuple ——像 list，而【不能改】
```

| | C++ 的對應 | 括號 |
|---|---|---|
| `list` | `vector` | `[ ]` |
| `dict` | `map` | `{ 鍵: 值 }` |
| `set` | `set` | `{ 值 }` |
| `tuple` | `pair` / `tuple` | `( )` |

⚠️ **`dict` 和 `set` 都用大括號。** 分辨的方式是**裡面有沒有冒號**。

⚠️ **`{}` 是空的 dict，不是空的 set。** 空的 set 要寫 `set()`。

## 二、拿東西

```python
print(nums[0])            # 3
print(ages["ming"])       # 16
print(point[1])           # 2
```

`list` 和 `tuple` 用**位置**、`dict` 用**鍵**——而寫法一樣是方括號。

⚠️ `set` **不能用方括號拿**，因為它沒有順序。它只回答「在不在裡面」：

```python
print("a" in tags)        # True
```

## 三、加東西

```python
nums.append(5)            # list  →  [3, 1, 4, 5]
ages["new"] = 18          # dict  →  多一個鍵
tags.add("c")             # set   →  已經有的話不會變多
```

⚠️ 三個名字都不一樣（`append` / `[]=` / `add`）——這是要背的。

`len(x)` 對四種都通：

```python
print(len(nums))          # 4
```

## 四、⚠️ `tuple` 不能改

```python
point[0] = 9              # 💥 TypeError
```

這不是限制，是**保證**。

「不會被改」讓它可以當 `dict` 的鍵、可以安心傳來傳去。
座標、日期、一組回傳值——這些東西本來就不該中途變。

> **可變是能力，不可變是承諾。**
> 需要承諾的地方用 `tuple`，需要能力的地方用 `list`。

## 完成的樣子

```python
nums = [3, 1, 4]
ages = {"ming": 16, "hua": 17}
tags = {"a", "b"}
point = (1, 2)
print(nums[0])
print(ages["ming"])
nums.append(5)
print(len(nums))
print(len(tags))
print(point[1])
```

## 換你了

用一個 `dict` 記三個人的分數，然後印出**分數最高的那個人的名字**。

提示：`for name in scores:` 走過的是**鍵**。

## 這一課你做了什麼

- 你做出了四種容器，各用各的括號
- 你用位置、用鍵、用 `in` 分別取到了東西
- 你知道 `tuple` 不能改，而那是它的用處

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `{}` 拿到的是 dict 不是 set | 空的 set 要寫 `set()` |
| `KeyError` | dict 裡沒有那個鍵。先用 `in` 問一下 |
| `TypeError: 'tuple' object does not support...` | tuple 不能改 |
| set 裡的東西順序每次不一樣 | set 本來就沒有順序 |
| `nums.add(5)` 出錯 | list 用 `append`，set 才用 `add` |
