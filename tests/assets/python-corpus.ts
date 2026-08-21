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
    print(n, s)`],
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
]
