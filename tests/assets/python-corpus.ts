/**
 * **AI 會生的 Python**——這份語料的挑法是「初學課本與 AI 助理會寫出來的程式」，
 * **不是**「照著我們有哪些元件挑的」。
 *
 * > **一份照著實作挑的語料，量出來的永遠是滿分。**
 *
 * ⚠️ **加語料是好事**（`audit-python-coverage` 的語料棘輪只准上升），
 * 而加完之後降級數會上升——那是**揭露**，不是退步。上調基線時在
 * commit 訊息寫明是哪幾段新語料。
 */
export const PYTHON_CORPUS: readonly (readonly [string, string])[] = [
  ['串列基礎', `nums = [3, 1, 4, 1, 5]
nums.append(9)
print(len(nums))
print(nums[0])
nums[1] = 7
for n in nums:
    print(n)`],
  ['f-string 與格式化', `name = "小明"
score = 92.5
print(f"{name} 的分數是 {score:.1f}")
print("總分：" + str(score))`],
  ['字典', `ages = {"小明": 12, "小華": 13}
ages["小美"] = 14
for k, v in ages.items():
    print(k, v)
if "小明" in ages:
    print(ages["小明"])`],
  ['range 的三種形式', `for i in range(5):
    print(i)
for i in range(1, 10, 2):
    print(i)
total = 0
for i in range(1, 101):
    total += i
print(total)`],
  ['函式與預設參數', `def greet(name, greeting="你好"):
    return f"{greeting}, {name}!"

def add(a, b):
    return a + b

print(greet("小明"))
print(add(3, 5))`],
  ['字串方法', `s = "Hello World"
print(s.upper())
print(s.lower())
print(s.split(" "))
print(s.replace("World", "Python"))
print(len(s))`],
  ['串列生成式', `squares = [x * x for x in range(10)]
evens = [x for x in range(20) if x % 2 == 0]
print(squares)
print(evens)`],
  ['while 與累加', `n = 10
total = 0
i = 1
while i <= n:
    total += i
    i += 1
print(total)`],
  ['巢狀與 elif', `score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
else:
    grade = "C"
print(grade)`],
  ['try/except', `try:
    n = int(input("請輸入數字："))
    print(10 / n)
except ValueError:
    print("那不是數字")
except ZeroDivisionError:
    print("不能除以零")`],
  ['類別', `class Dog:
    def __init__(self, name):
        self.name = name

    def bark(self):
        print(f"{self.name} 汪汪叫")

d = Dog("小黑")
d.bark()`],
  ['內建函式群', `nums = [5, 2, 8, 1]
print(max(nums))
print(min(nums))
print(sum(nums))
print(sorted(nums))
print(abs(-3))
print(int("42"))
print(float("3.14"))`],
  ['enumerate 與 zip', `names = ["甲", "乙"]
scores = [90, 80]
for i, n in enumerate(names):
    print(i, n)
for n, s in zip(names, scores):
    print(n, s)
print(list(enumerate(scores)))`],
  ['tuple 與多重指派', `p = (3, 4)
x, y = p
a, b = 1, 2
a, b = b, a
print(x, y, a, b)`],
  ['import 與模組', `import math
print(math.sqrt(16))
print(math.pi)
import random
print(random.randint(1, 6))`],
  ['巢狀資料與排序', `students = [{"name": "小明", "score": 92}, {"name": "小華", "score": 78}]
for s in students:
    print(s["name"], s["score"])
names = [s["name"] for s in students if s["score"] >= 80]
print(names)`],
  ['while 與旗標', `found = False
i = 0
data = [4, 8, 15]
while i < len(data):
    if data[i] == 8:
        found = True
        break
    i += 1
print(found)`],
  ['字串處理', `line = "  name,age,city  "
parts = line.strip().split(",")
print(len(parts))
print("-".join(parts))
print(parts[0].upper())`],
  ['函式互相呼叫', `def is_even(n):
    return n % 2 == 0

def count_even(xs):
    total = 0
    for x in xs:
        if is_even(x):
            total += 1
    return total

print(count_even([1, 2, 3, 4]))`],
  ['類別與多個方法', `class Counter:
    def __init__(self):
        self.n = 0

    def add(self, k):
        self.n += k

    def show(self):
        print(self.n)

c = Counter()
c.add(3)
c.add(4)
c.show()`],
  ['三元與邏輯串接', `age = 20
status = "成年" if age >= 18 else "未成年"
ok = age > 0 and age < 150
bad = not ok or age == 0
print(status, ok, bad)`],
  ['切片', `xs = [1, 2, 3, 4, 5]
print(xs[1:3])
print(xs[:2])
print(xs[-2:])
print(xs[2:])
s = "abcdef"
print(s[2:4])
print(len(xs[1:3]))`],
  ['while True 與 break', `n = 0
while True:
    n += 1
    if n >= 3:
        break
print(n)
total = 0
for i in range(10):
    if i % 2 == 0:
        continue
    total += i
print(total)`],
  ['遞迴', `def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)

def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fact(5))
print(fib(7))`],
  ['主程式慣例', `def main():
    print("跑起來了")

if __name__ == "__main__":
    main()`],
  ['多重回傳與 elif', `def grade(score):
    if score >= 90:
        return "A", "很好"
    elif score >= 60:
        return "B", "還可以"
    else:
        return "C", "加油"

letter, comment = grade(75)
print(letter, comment)`],
  ['字典生成式與集合', `scores = {"a": 90, "b": 70}
passed = {k: v for k, v in scores.items() if v >= 80}
print(passed)
uniq = set([1, 2, 2, 3])
print(len(uniq))`],
  ['lambda 與排序鍵', `people = [("小明", 12), ("小華", 10)]
people.sort(key=lambda p: p[1])
print(people[0][0])`],
  ['巢狀函式與預設可變', `def outer(n):
    def inner(k):
        return k * 2
    return inner(n) + 1

print(outer(3))`],
  ['字串格式化的另外兩種', `name = "小明"
print("你好，{}".format(name))
print("%s 你好" % name)
print("a" + str(1) + "b")`],
  ['多層資料', `data = {"users": [{"name": "小明", "tags": ["a", "b"]}]}
u = data["users"][0]
print(u["name"], len(u["tags"]))
for t in u["tags"]:
    print(t)`],
  ['整數與布林的邊界', `print(7 // 2, 7 % 2, 2 ** 10)
print(True + True)
print(int(True), bool(0), bool(""))
print(10 / 4)`],
  ['數值的邊界', `print(-7 // 2, -7 % 2)
print(round(2.5), round(3.5), round(2.675, 2))
print(3 / 0 if False else "跳過")
print(abs(-2.5), max(1.5, 2), min(-1, -2))
print(int(3.9), int(-3.9))`],
  ['字串的邊界', `s = "Hello"
print(s * 2)
print(s[::1] if False else s[1:])
print(len(""), "" == None)
print("a" < "b", "abc".index("b"))
print(str(3.0), str(True), str([1, "a"]))`],
  ['巢狀迴圈與累加', `total = 0
grid = [[1, 2], [3, 4]]
for row in grid:
    for v in row:
        total += v
print(total)
flat = [v for row in grid for v in row] if False else []
print(len(grid), len(grid[0]))`],
  ['條件的組合', `xs = [1, 2, 3]
if len(xs) > 0 and xs[0] == 1:
    print("是")
elif not xs:
    print("空")
else:
    print("否")
print(bool(xs), bool([]), 0 or "預設", 1 and 2)`],
  ['函式的回傳與 None', `def f(x):
    if x > 0:
        return "正"

print(f(1))
print(f(-1))
print(f(-1) is None, f(-1) == None)`],
  ['參照與拷貝', `a = [1, 2]
b = a
b.append(3)
print(a)
c = a[:]
c.append(4)
print(len(a), len(c))`],
  ['作用域', `x = 10
def f():
    x = 20
    return x

print(f(), x)
def g(xs):
    xs.append(1)

ys = []
g(ys)
print(len(ys))`],
  ['迴圈的 else 與 continue', `total = 0
for i in range(5):
    if i % 2 == 0:
        continue
    total += i
print(total)
n = 0
while n < 3:
    n += 1
print(n)`],
  ['字典的走訪順序與更新', `d = {}
d["b"] = 2
d["a"] = 1
print(list(d.keys()))
d["b"] = 20
print(d)
print(len(d), "c" in d)`],
  ['巢狀呼叫與短路', `def side(xs):
    xs.append(1)
    return True

xs = []
r = False and side(xs)
print(len(xs), r)
r2 = True or side(xs)
print(len(xs), r2)`],
  ['集合去重', `xs = [3, 1, 3, 2, 1]
s = set(xs)
print(len(s))
print(sorted(s))
print(3 in s)`],
  ['排序的三種要求', `words = ["banana", "kiwi", "apple"]
print(sorted(words))
print(sorted(words, key=len))
print(sorted(words, reverse=True))
nums = [3, 1, 2]
nums.sort()
print(nums)`],
  ['字串方法串接', `line = "  小明,90,甲  "
parts = line.strip().split(",")
print(parts)
print(parts[0].upper())
print("-".join(parts))
print(line.strip().replace(",", " "))`],
  ['多回傳值與預設參數', `def stats(xs):
    return min(xs), max(xs), sum(xs)

def greet(name, greeting="你好"):
    return greeting + "，" + name

lo, hi, total = stats([4, 2, 9])
print(lo, hi, total)
print(greet("小明"))
print(greet("小華", "早安"))`],
  ['字典的 get 與計次', `text = "abracadabra"
count = {}
for ch in text:
    count[ch] = count.get(ch, 0) + 1
print(count["a"], count.get("z", 0))
best = max(count, key=lambda k: count[k])
print(best)`],
  ['二維串列', `grid = [[1, 2], [3, 4]]
for row in grid:
    for x in row:
        print(x, end=" ")
    print()
print(grid[1][0])
print(len(grid), len(grid[0]))`],
  ['巢狀字典', `students = {"小明": {"數學": 90, "國文": 80}}
students["小華"] = {"數學": 70, "國文": 85}
for name in students:
    total = students[name]["數學"] + students[name]["國文"]
    print(name, total)`],
  ['串列的其他方法', `xs = [3, 1, 4]
xs.insert(1, 9)
print(xs)
xs.remove(4)
print(xs)
print(xs.pop())
print(xs.index(9), xs.count(3))`],
  ['整數運算的三種除法', `a, b = 17, 5
print(a / b)
print(a // b)
print(a % b)
print(a ** 2)
print(divmod(a, b))
print(-7 // 2, -7 % 2)`],
  ['字串的判斷', `s = "Hello123"
print(s.find("l"), s.count("l"))
print(s.startswith("He"), s.endswith("3"))
print(s.lower(), s.upper())
print(len(s), s[0], s[-1])`],
  ['None 與預設', `def find(xs, target):
    for x in xs:
        if x == target:
            return x
    return None

r = find([1, 2], 5)
if r is None:
    print("沒找到")
else:
    print(r)
print(find([1, 2], 2))`],
  ['多層條件', `score = 85
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "D"
print(grade)
print("及格" if score >= 60 else "不及格")`],
  ['丟出例外', `def divide(a, b):
    if b == 0:
        raise ValueError("除數不能是零")
    return a / b

try:
    print(divide(6, 3))
    print(divide(1, 0))
except ValueError as e:
    print("錯誤：", e)`],
  ['字典的排序輸出', `scores = {"小華": 70, "小明": 90, "小美": 85}
for name in sorted(scores):
    print(name, scores[name])
pairs = sorted(scores.items(), key=lambda p: p[1], reverse=True)
for name, s in pairs:
    print(name, s)`],
  ['map 與 filter', `nums = [1, 2, 3, 4]
doubled = list(map(lambda x: x * 2, nums))
evens = list(filter(lambda x: x % 2 == 0, nums))
print(doubled)
print(evens)
print(list(map(str, nums)))`],
  ['串列相乘與相加', `zeros = [0] * 3
print(zeros)
print([1, 2] + [3])
grid = [[0] * 2 for _ in range(3)]
grid[1][1] = 9
print(grid)
print("ab" * 3)`],
  ['字典推導式', `nums = [1, 2, 3]
squares = {n: n * n for n in nums}
print(squares)
print({k: v for k, v in squares.items() if v > 2})`],
  ['巢狀函式與累加', `def make_counter():
    count = 0
    def step():
        return count + 1
    return step()

print(make_counter())

def total(xs):
    s = 0
    for x in xs:
        s += x
    return s

print(total([1, 2, 3]))`],
  ['字串格式化的三種寫法', `name = "小明"
score = 92.456
print(f"{name}：{score:.2f}")
print("{}：{}".format(name, 92))
print(name + " 得了 " + str(92) + " 分")`],
  ['讀輸入並計算', `n = int(input())
total = 0
for i in range(n):
    total += i
print("總和是", total)`],
  ['類別與方法', `class Dog:
    def __init__(self, name):
        self.name = name
        self.age = 0

    def bark(self):
        return self.name + " 汪汪"

    def birthday(self):
        self.age += 1
        return self.age

d = Dog("小黑")
print(d.bark())
print(d.birthday(), d.birthday())
print(d.name, d.age)`],
  ['交換與多重比較', `a, b = 3, 7
a, b = b, a
print(a, b)
x = 5
print(1 < x < 10)
print(x != 5, not x == 5)
print(a > b and x > 0, a > b or x > 0)`],
  ['質數與巢狀迴圈', `def is_prime(n):
    if n < 2:
        return False
    for i in range(2, n):
        if n % i == 0:
            return False
    return True

primes = []
for n in range(2, 20):
    if is_prime(n):
        primes.append(n)
print(primes)
print(len(primes), sum(primes))`],
  ['讀一行拆成數字', `parts = "3 1 4".split()
nums = list(map(int, parts))
print(nums)
print(sum(nums), max(nums))
a, b = "7 2".split()
print(int(a) + int(b))`],
  ['global', `count = 0

def bump():
    global count
    count += 1

bump()
bump()
print(count)`],
  ['巢狀推導式', `grid = [[1, 2], [3, 4]]
flat = [x for row in grid for x in row]
print(flat)
print([[x * 2 for x in row] for row in grid])`],
  ['多鍵排序', `people = [("小明", 12), ("小華", 12), ("小美", 10)]
print(sorted(people, key=lambda p: p[1]))
for name, age in sorted(people, key=lambda p: -p[1]):
    print(name, age)`],
  ['具名引數呼叫', `def area(w, h):
    return w * h

print(area(3, 4))
print(area(h=2, w=5))`],
  ['刪除與判斷成員', `d = {"a": 1, "b": 2}
del d["a"]
print(d)
xs = [1, 2, 3]
del xs[0]
print(xs)
print("a" in d, "b" in d)`],
  ['while 的倒數', `total = 0
n = 3
while n > 0:
    total += n
    n -= 1
print(total)`],
  ['字串反轉與迴文', `s = "level"
print(s[::-1])
print(s == s[::-1])
t = "abc"
print(t[::-1], t[::2])`],
  ['類別的繼承', `class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return "..."

class Dog(Animal):
    def speak(self):
        return self.name + " 汪汪"

d = Dog("小黑")
print(d.speak())
print(d.name)`],
  ['try 的三段', `def get(xs, i):
    try:
        return xs[i]
    except IndexError:
        return None
    finally:
        print("查完了")

print(get([1, 2], 0))
print(get([1, 2], 9))`],
  ['assert', `def half(n):
    assert n % 2 == 0
    return n // 2

print(half(4))`],
  ['f-string 的對齊與寬度', `name = "小明"
score = 92.456
print(f"{name:>6}|")
print(f"{score:.1f} {score:08.3f}")
print(f"{10:3d}|{10:<3d}|")
print(f"{name} 得了 {score:.0f} 分")`],
  ['format 的三種寫法', `print("{}-{}".format(1, 2))
print("{0}{1}{0}".format("a", "b"))
print("{n} 是 {v}".format(n="x", v=1))`],
  ['數學模組', `import math

print(math.sqrt(16))
print(math.floor(3.7), math.ceil(3.2))
print(round(math.pi, 4))
print(math.pow(2, 10))`],
  ['記憶化遞迴', `memo = {}

def fib(n):
    if n in memo:
        return memo[n]
    if n < 2:
        return n
    memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(20))
print(len(memo))`],
  ['星號參數', `def total(*nums):
    s = 0
    for n in nums:
        s += n
    return s

print(total(1, 2, 3))
print(total())`],
  ['呼叫父類別的建構式', `class Animal:
    def __init__(self, name):
        self.name = name

class Dog(Animal):
    def __init__(self, name, color):
        super().__init__(name)
        self.color = color

d = Dog("小黑", "黑")
print(d.name, d.color)`],
  ['型別判斷', `xs = [1, "a", 3.5, True]
for x in xs:
    if isinstance(x, str):
        print("文字", x)
    elif isinstance(x, bool):
        print("真假", x)
    elif isinstance(x, int):
        print("整數", x)
    else:
        print("其他", x)`],
  ['類別層級的屬性', `class Counter:
    total = 0

    def __init__(self):
        self.n = 0

    def bump(self):
        self.n += 1
        return self.n

c = Counter()
print(c.bump(), c.bump())
print(c.n)`],
  ['字典裡放串列', `groups = {}
words = ["ant", "bee", "ape", "bat"]
for w in words:
    k = w[0]
    if k not in groups:
        groups[k] = []
    groups[k].append(w)
for k in sorted(groups):
    print(k, groups[k])`],
  ['百分號格式化', `name = "小明"
score = 92.456
print("%s 得了 %d 分" % (name, score))
print("%.2f" % score)
print("%s|%s" % (name, "x"))`],
  ['計次並排序', `text = "banana"
count = {}
for ch in text:
    count[ch] = count.get(ch, 0) + 1
for ch, n in sorted(count.items(), key=lambda p: (-p[1], p[0])):
    print(ch, n)`],
  ['字串建表', `rows = ["小明,90", "小華,85"]
table = {}
for r in rows:
    name, score = r.split(",")
    table[name] = int(score)
print(table)
print(sum(table.values()) / len(table))`],
  ['多層函式呼叫', `def add(a, b):
    return a + b

def twice(f, x):
    return f(x, x)

print(twice(add, 5))
print(add(twice(add, 1), 3))`],
  ['any 與 all', `xs = [2, 4, 6]
print(all(x % 2 == 0 for x in xs))
print(any(x > 5 for x in xs))
print(all([]), any([]))`],
  ['enumerate 從 1 開始', `names = ["甲", "乙", "丙"]
for i, n in enumerate(names, 1):
    print(i, n)
print(list(enumerate(names, start=10)))`],
  ['串接方法呼叫', `s = "  Hello World  "
print(s.strip().lower().replace(" ", "-"))
parts = s.strip().split(" ")
print([p.upper() for p in parts])
print("-".join(sorted(parts)))`],
  ['not in 與巢狀條件', `seen = []
for w in ["a", "b", "a", "c"]:
    if w not in seen:
        seen.append(w)
print(seen)
d = {"x": 1}
print("y" not in d, "x" not in d)`],
  ['最大最小與預設', `xs = [3, 1, 4]
print(max(xs), min(xs))
print(max(xs) - min(xs))
words = ["bb", "a", "ccc"]
print(max(words, key=len), min(words, key=len))`],
  ['數字補齊', `n = 7
print(str(n).zfill(3))
print("abc".ljust(6, "*") + "|")
print("abc".rjust(6) + "|")
print(abs(-5), round(-2.5), round(2.675, 2))`],
  ['一元二次方程式', `a, b, c = 1, -5, 6
D = b**2 - 4*a*c
x1 = (-b + D)/(2 * a)
x2 = (-b - D)/(2 * a)
print(x1, x2)
print((a + b) * c, a + (b * c))`],
  ['公式與括號', `n = 10
print((n * (n + 1)) // 2)
c = 100
f = c * 9 / 5 + 32
print(f, (f - 32) * 5 / 9)
w, h = 3, 4
print(2 * (w + h), (w + h) / 2)`],
  ['條件裡的括號', `x, y = 5, 12
if (x > 0) and (y > 10):
    print("都符合")
if not (x > 100):
    print("沒超過")
print((x > 0) == (y > 0))`],
  ['註解與 pass', `# 這一段在算平均
def average(xs):
    if not xs:
        pass  # 空的就什麼都不做
    total = sum(xs)  # 先加總
    return total / len(xs)

print(average([1, 2, 3]))`],
  ['跳脫字元與長字串', `print("第一行\\n第二行")
print("用\\t分隔")
print("引號：\\"這樣\\"")
s = "abc" "def"
print(s, len(s))
t = "很長的一段" \\
    "接下去"
print(t)`],
  ['from import 與別名', `from math import sqrt, floor
import math as m

print(sqrt(16), floor(3.7))
print(m.pi > 3)`],
  ['型別註記', `def add(a: int, b: int) -> int:
    return a + b

def greet(name: str, greeting: str = "你好") -> str:
    return greeting + "，" + name

print(add(2, 3))
print(greet("小明"))`],
  ['集合', `xs = [3, 1, 3, 2]
s = {1, 2, 3}
print(len(s), 2 in s)
uniq = {x for x in xs}
print(len(uniq))`],
  ['星號展開', `def total(a, b, c):
    return a + b + c

nums = [1, 2, 3]
print(total(*nums))
d = {"a": 1}
e = {**d, "b": 2}
print(e)`],
  ['海象運算子', `xs = [1, 2, 3, 4]
if (n := len(xs)) > 3:
    print("有", n, "格")
total = 0
for x in xs:
    if (double := x * 2) > 4:
        total += double
print(total)`],
  ['with 與資源類別', `class Timer:
    def __enter__(self):
        print("開始")
        return 42
    def __exit__(self, a, b, c):
        print("收尾")
        return False

with Timer() as t:
    print("裡面", t)
print("外面")`],
  ['對齊與補零', `n = 7
print(str(n).zfill(3))
print("甲".ljust(4, "-") + "|")
print("乙".rjust(4) + "|")
print("{:>5}".format(n))`],
  ['取出與就地排序', `xs = [3, 1, 2]
xs.sort()
print(xs)
print(xs.pop(0), xs)
words = ["bbb", "a", "cc"]
words.sort(key=len, reverse=True)
print(words)`],
  ['位元運算', `x = 5
print(~x, x << 2, x >> 1)
print(x & 3, x | 3, x ^ 3)
flags = 0
for bit in [1, 4]:
    flags |= bit
print(flags, flags & 4 != 0)`],
]
