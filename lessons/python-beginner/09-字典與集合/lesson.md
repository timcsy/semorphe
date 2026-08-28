# 字典與集合

> 用名字找東西，和只管有沒有。 · ⏱ 約 30 分鐘

## 你會學到三件事

1. `dict` 用**鍵**找值，不是用位置
2. `set` 只管「有沒有」，而且自動去重複
3. 🔴 `d["不存在"]` 會出錯，`d.get(...)` 不會

## 開始之前

清單用**位置**找東西——而「小明的分數」不是第幾個，是一個**名字**。

## 一、`dict`：鍵 → 值

```python
ages = {"ming": 16, "hua": 17}
print(ages["ming"])      # 16
```

大括號、`鍵: 值`、逗號隔開。

| | |
|---|---|
| 鍵（key） | 拿來找的東西——多半是文字或數字 |
| 值（value） | 找到的東西——**什麼都可以** |

```python
ages["new"] = 18         # 沒有就新增，有就覆蓋
del ages["hua"]          # 刪掉
print(len(ages))         # 幾筆
```

## 二、走過去

```python
for k in ages:
    print(k, ages[k])
```

⚠️ **`for k in ages` 走的是【鍵】，不是值。**

想同時要鍵和值：

```python
for k, v in ages.items():
    print(k, v)
```

| | 走什麼 |
|---|---|
| `for k in d` | 鍵 |
| `for v in d.values()` | 值 |
| `for k, v in d.items()` | 兩個 |

## 三、🔴 不存在的鍵

```python
print(ages["nobody"])          # 💥 KeyError
```

三種處理方式：

```python
if "nobody" in ages:           # ① 先問
    print(ages["nobody"])

print(ages.get("nobody"))          # ② None
print(ages.get("nobody", 0))       # ③ 給預設值 0
```

⚠️ **`in` 對 dict 問的是「鍵在不在」**，不是值。

計數的時候 `get` 特別好用：

```python
counts = {}
for w in words:
    counts[w] = counts.get(w, 0) + 1
```

## 四、`set`：只管有沒有

```python
tags = {"a", "b", "a"}
print(len(tags))          # 2   ← 重複的自動變一個
```

⚠️ **`set` 也用大括號**，分辨的方式是**裡面有沒有冒號**。

⚠️ **`{}` 是空的 dict，不是空的 set。** 空的 set 要寫 `set()`。

```python
tags.add("c")             # 加（已經有就不變）
tags.remove("a")          # 拿掉
print("b" in tags)        # True
```

**它沒有順序，也不能用位置取。** 它只回答「在不在」。

### 什麼時候用 `set`

```python
nums = [3, 1, 4, 1, 5]
print(len(set(nums)))      # 4   ← 有幾個不同的數
print(list(set(nums)))     # 去重複
```

而**問「在不在」**時，`set` 比 `list` 快很多——
`list` 要一個一個比，`set` 幾乎是一步到位。

## 完成的樣子

```python
ages = {"ming": 16, "hua": 17}
print(ages["ming"])
ages["new"] = 18
for k in ages:
    print(k, ages[k])
tags = {"a", "b", "a"}
print(len(tags))
```

## 換你了

讀進一段英文，數出**每個字母出現幾次**，印出來。

⚠️ 提示：用 `counts.get(c, 0) + 1`——不用先判斷那個鍵在不在。

## 這一課你做了什麼

- 你用 `dict` 做了鍵到值的對應
- 你用 `set` 去掉了重複
- 你知道 `d[k]` 會 `KeyError` 而 `d.get(k)` 不會

## 如果卡住了

| 你看到 | 多半是因為 |
|---|---|
| `KeyError` | 那個鍵不存在。用 `in` 或 `.get()` |
| `{}` 拿到的是 dict | 空的 set 要寫 `set()` |
| 走 dict 只拿到鍵 | 那就是它的行為。要值用 `.items()` |
| set 的順序每次不一樣 | 它本來就沒有順序 |
| `TypeError: unhashable` | 拿 list 當鍵了。鍵要是不可變的東西 |
