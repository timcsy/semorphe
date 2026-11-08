/**
 * Fuzz Test Regression: C++ OOP Components
 * Generated from fuzz testing (2026-03-12)
 *
 * Tests lift -> generate -> execution roundtrip for OOP programs:
 * classes, constructors, destructors, operator overloading.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import { expectCellaOut } from '../helpers/cella-run'
import type { StylePreset } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function roundTrip(code: string): string {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  expect(sem).not.toBeNull()
  return generateCode(sem!, 'cpp', style)
}

// --- oop_001: class with default constructor, destructor, public field ---

describe('fuzz: class with default constructor, destructor, public field', () => {
  const code = `#include <iostream>
using namespace std;
class Counter {
public:
    int count;
    Counter() {
        count = 0;
        cout << "Counter created" << endl;
    }
    ~Counter() {
        cout << "Counter destroyed" << endl;
    }
};
int main() {
    Counter c;
    cout << c.count << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Counter')
    expect(gen).toContain('Counter()')
    expect(gen).toContain('~Counter()')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_002: class with two public fields, constructor init, destructor ---

describe('fuzz: class with two public fields, constructor init, destructor', () => {
  const code = `#include <iostream>
using namespace std;
class Box {
public:
    int width;
    int height;
    Box() {
        width = 10;
        height = 20;
        cout << "Box default" << endl;
    }
    ~Box() {
        cout << "Box gone" << endl;
    }
};
int main() {
    Box b;
    cout << b.width << endl;
    cout << b.height << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Box')
    expect(gen).toContain('int width')
    expect(gen).toContain('int height')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_003: constructor/destructor ordering with cout ---

describe('fuzz: constructor/destructor ordering with cout', () => {
  const code = `#include <iostream>
using namespace std;
class Logger {
public:
    Logger() {
        cout << "Logger start" << endl;
    }
    ~Logger() {
        cout << "Logger end" << endl;
    }
};
int main() {
    cout << "before" << endl;
    Logger l;
    cout << "during" << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Logger')
    expect(gen).toContain('Logger()')
    expect(gen).toContain('~Logger()')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_004: operator+ overload on class with two fields ---

describe('fuzz: operator+ overload on class with two fields', () => {
  const code = `#include <iostream>
using namespace std;
class Point {
public:
    int x;
    int y;
    Point() {
        x = 0;
        y = 0;
    }
    Point operator+(Point other) {
        Point result;
        result.x = x + other.x;
        result.y = y + other.y;
        return result;
    }
};
int main() {
    Point a;
    a.x = 3;
    a.y = 4;
    Point b;
    b.x = 1;
    b.y = 2;
    Point c = a + b;
    cout << c.x << endl;
    cout << c.y << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Point')
    expect(gen).toContain('operator+')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_005: class with private field, cout in constructor/destructor ---

describe('fuzz: class with private field, cout in constructor/destructor', () => {
  const code = `#include <iostream>
using namespace std;
class Tracker {
private:
    int value;
public:
    Tracker() {
        value = 42;
        cout << "Tracker init " << value << endl;
    }
    ~Tracker() {
        cout << "Tracker done " << value << endl;
    }
};
int main() {
    Tracker t;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Tracker')
    expect(gen).toContain('private:')
    expect(gen).toContain('int value')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_006: operator== overload with if/else ---

describe('fuzz: operator== overload with if/else', () => {
  const code = `#include <iostream>
using namespace std;
class NumberHolder {
public:
    int num;
    NumberHolder() {
        num = 0;
    }
    bool operator==(NumberHolder other) {
        return num == other.num;
    }
};
int main() {
    NumberHolder a;
    a.num = 5;
    NumberHolder b;
    b.num = 5;
    NumberHolder c;
    c.num = 10;
    if (a == b) {
        cout << "equal" << endl;
    }
    if (a == c) {
        cout << "also equal" << endl;
    } else {
        cout << "not equal" << endl;
    }
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class NumberHolder')
    expect(gen).toContain('operator==')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_007: scoped destructor call in inner block (SEMANTIC_DIFF) ---

/**
 * ⚠️ **這一組曾經是 `describe.skip` ＋ 一支 `it.todo`**，理由逐字：
 * 「Inner block scope `{ Scope s; }` is flattened during lift, causing destructor
 * to fire at end of main instead of end of block.」
 *
 * 2026-08-13 修掉了（`cpp:block` 膠囊 ＋ `lifter.ts` 只展平「結構的 body」）。
 *
 * 🔴 **而那筆 `it.todo` 一聲都沒出**——它沒有測試本體，所以缺陷被修好時
 * 什麼都不會發生。是人去梳理「還有什麼沒做」時才發現它已經不是問題。
 *
 * > **`it.todo` 本身就是一種殼：它宣告了一個缺陷，
 * > 而沒有任何機構在看那個缺陷還在不在。**
 *
 * 見 `experience.md` 的「量測工具自己量錯」那條（第三個實例的另一半）。
 */
describe('fuzz: scoped destructor call in inner block', () => {
  const code = `#include <iostream>
using namespace std;
class Scope {
public:
    Scope() {
        cout << "enter" << endl;
    }
    ~Scope() {
        cout << "exit" << endl;
    }
};
int main() {
    cout << "main start" << endl;
    {
        Scope s;
        cout << "inner" << endl;
    }
    cout << "main end" << endl;
    return 0;
}`

  // spec 203（重構 6c-2e）：執行的判準從 JS 直譯器換成 Cella——同一段程式經 lift → formalize 之後，C++ 的解構時機還是那一個
  // （lift 把區塊展平的話，formalize 送出去的就是展平的程式，Cella 會照實印出 main 結束才 exit）
  it('★ 獨立區塊有自己的作用域——解構子在區塊結束時跑，不是 main 結束', async () => {
    // ⚠️ 順序是重點：`exit` 必須在 `main end` **之前**。
    // 展平之後兩者都會印，只是順序反了——**而「都印了」看起來像通過**。
    await expectCellaOut(code, 'main start\nenter\ninner\nexit\nmain end\n')
  })

  it('★ 反向：`if` 的 body 不得多一層作用域', async () => {
    // 沒有這一支的話，一個「所有 compound 都不展平」的實作也會通過上一支
    // ——而那會讓 `if (c) { int x=1; x++; }` 的 x 在每一輪重新宣告。
    const src = `#include <iostream>\nusing namespace std;\nint main(){ int n=0; for(int i=0;i<3;i++){ n+=i; } cout << n; return 0; }`
    await expectCellaOut(src, '3')
  })

  it('roundtrip is stable', () => {
    const g1 = roundTrip(code)
    expect(roundTrip(g1)).toBe(g1)
  })
})

// --- oop_008: class with standalone function using member access ---

describe('fuzz: class with standalone function using member access', () => {
  const code = `#include <iostream>
using namespace std;
class Pair {
public:
    int first;
    int second;
    Pair() {
        first = 0;
        second = 0;
    }
};
void printPair(int a, int b) {
    cout << a << " " << b << endl;
}
int main() {
    Pair p;
    p.first = 100;
    p.second = 200;
    printPair(p.first, p.second);
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Pair')
    expect(gen).toContain('void printPair')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_009: multiple operator overloads (-, *) on same class ---

describe('fuzz: multiple operator overloads (-, *) on same class', () => {
  const code = `#include <iostream>
using namespace std;
class Wrapper {
public:
    int data;
    Wrapper() {
        data = 0;
        cout << "Wrapper()" << endl;
    }
    Wrapper operator-(Wrapper other) {
        Wrapper result;
        result.data = data - other.data;
        return result;
    }
    Wrapper operator*(Wrapper other) {
        Wrapper result;
        result.data = data * other.data;
        return result;
    }
};
int main() {
    Wrapper a;
    a.data = 10;
    Wrapper b;
    b.data = 3;
    Wrapper c = a - b;
    cout << c.data << endl;
    Wrapper d = a * b;
    cout << d.data << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Wrapper')
    expect(gen).toContain('operator-')
    expect(gen).toContain('operator*')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_new1: struct with constructor and member functions (fuzz 2026-03-13) ---

describe('fuzz: struct with constructor and member functions', () => {
  const code = `#include <iostream>
#include <string>
using namespace std;
struct Student {
    string name;
    int score;
    Student(string n, int s) : name(n), score(s) {
    }
    void addBonus(int b) {
        score += b;
    }
    void print() {
        cout << name << ": " << score << endl;
    }
};
int main() {
    Student s("Alice", 85);
    s.print();
    return 0;
}`

  it('struct constructors preserve name and params', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('struct Student')
    expect(gen).toContain('Student(string n, int s)')
    expect(gen).toContain('void addBonus(int b)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_new2: class with operator+, multi-var fields (fuzz 2026-03-13) ---

describe('fuzz: class with operator+ and multi-var private fields', () => {
  const code = `#include <iostream>
using namespace std;
class Vec2 {
public:
    Vec2(double x, double y) : x(x), y(y) {
    }
    Vec2 operator+(Vec2 other) {
        return Vec2(x + other.x, y + other.y);
    }
    void print() {
        cout << "(" << x << ", " << y << ")" << endl;
    }
private:
    double x;
    double y;
};
int main() {
    Vec2 a(1.0, 2.0);
    Vec2 b(3.0, 4.0);
    Vec2 c = a + b;
    c.print();
    return 0;
}`

  it('operator+ and both private fields preserved', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Vec2')
    expect(gen).toContain('operator+')
    expect(gen).toContain('double x;')
    expect(gen).toContain('double y;')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_new3: inheritance with protected members (fuzz 2026-03-13) ---

describe('fuzz: inheritance with protected access specifier', () => {
  const code = `#include <iostream>
#include <string>
using namespace std;
class Entity {
public:
    Entity(string id) : id(id) {
    }
    virtual void info() {
        cout << "Entity: " << id << endl;
    }
    ~Entity() {
    }
protected:
    string id;
};
int main() {
    Entity e("test");
    e.info();
    return 0;
}`

  it('protected access section preserved', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Entity')
    expect(gen).toContain('protected:')
    expect(gen).toContain('string id;')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- oop_new4: struct with multiple constructors (fuzz 2026-03-13) ---

describe('fuzz: struct with multiple constructors', () => {
  const code = `#include <iostream>
using namespace std;
struct Point {
    int x;
    int y;
    Point() : x(0), y(0) {
    }
    Point(int x, int y) : x(x), y(y) {
    }
};
int main() {
    Point origin;
    Point a(3, 4);
    return 0;
}`

  it('both constructors preserved in struct', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('struct Point')
    expect(gen).toContain('Point()')
    expect(gen).toContain('Point(int x, int y)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Known limitations (EXPECTED_DEGRADATION, fuzz 2026-03-13) ---
// fuzz_3, fuzz_4: ptr->method() via pointer array generates as .method()——spec 209 修好（method_call 記下箭號）
describe('fuzz: 指標陣列的虛擬分派 `animals[i]->describe()`', () => {
  const code = `#include <iostream>
using namespace std;
class Animal {
public:
    virtual void describe() {
        cout << "animal ";
    }
    virtual ~Animal() {
    }
};
class Dog : public Animal {
public:
    void describe() override {
        cout << "dog ";
    }
};
int main() {
    Animal a;
    Dog d;
    Animal* animals[2] = {&a, &d};
    for (int i = 0; i < 2; i++) {
        animals[i]->describe();
    }
    return 0;
}`
  it('來回一趟保住箭號', () => {
    expect(roundTrip(code)).toContain('animals[i]->describe();')
  })
  it('執行：經基底的指標分派到各自的覆寫', async () => {
    await expectCellaOut(code, 'animal dog ')
  })
})
// fuzz_5: inner block { } scope flattened, destructor order wrong
// 080 實作了解構式與作用域結束的時機
describe('fuzz: 解構式的順序', () => {
  const code = `#include <iostream>
using namespace std;
class Tag {
public:
    int n;
    ~Tag() {
        cout << n;
    }
};
int main() {
    if (1) {
        Tag a;
        a.n = 1;
        Tag b;
        b.n = 2;
    }
    cout << "-";
    return 0;
}`

  it('來回轉換保住解構式', () => {
    expect(roundTrip(code)).toContain('~Tag()')
  })

  it('★ 反序，且在離開區塊時就跑完——不是程式結束才跑', async () => {
    // C++ 保證後宣告的先解構，且在離開區塊時就跑（[stmt.jump]p2、[class.dtor]）——g++ 印 `21-`（原本比對前去掉空白；程式不印空白，逐字比）
    await expectCellaOut(code, '21-')
  })
})
// fuzz_10: static int count; and int Widget::count = 0; not supported
// 073 實作了靜態成員——這支從 `it.todo`（只有名字）變成真的測試。
// **重新產生**而不是打勾：todo 沒有測試本體，把它改成 `it` 不會多驗到任何東西。
describe('fuzz: class with static member', () => {
  const code = `#include <iostream>
using namespace std;
class Counter {
public:
    static int total;
    int id;
    void reg() {
        total = total + 1;
        id = total;
    }
};
int main() {
    Counter a;
    Counter b;
    a.reg();
    b.reg();
    cout << b.id << endl;
    return 0;
}`

  it('來回轉換保住靜態成員的宣告', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('static int total')
  })

  // spec 203：期望值的依據換了。上面那段程式**沒有**類別外的定義（`int Counter::total = 0;`）——odr-use 的靜態成員必須有定義
  // （C++17 [basic.def.odr]p4，不需診斷），本機 clang 連結失敗（Undefined symbols: Counter::total）；原本「印出含 2」是 JS 直譯器的寬鬆。
  // ⟹ 執行的這一條改用補上定義的版本（g++ 實測印 `2\n`）；來回轉換那一條照舊用原程式。
  // 🟢 361：類別外的靜態成員定義的初值併進類別的 mbStatic（cella 的送法）——這根釘子轉紅「不在了」，轉成一般的測試
  it('★ 靜態成員由所有實例共用——執行結果證明它不是每個實例各一份', async () => {
    await expectCellaOut(code.replace('};\nint main', '};\nint Counter::total = 0;\nint main'), '2\n')
  })
})

// --- oop_010: two classes with constructors/destructors, destruction order ---

describe('fuzz: two classes with constructors/destructors, destruction order', () => {
  const code = `#include <iostream>
using namespace std;
class Resource {
private:
    int id;
public:
    Resource() {
        id = 1;
        cout << "Resource " << id << " acquired" << endl;
    }
    ~Resource() {
        cout << "Resource " << id << " released" << endl;
    }
};
class Manager {
public:
    int count;
    Manager() {
        count = 0;
        cout << "Manager created" << endl;
    }
    ~Manager() {
        cout << "Manager destroyed" << endl;
    }
};
int main() {
    Manager m;
    m.count = 5;
    cout << m.count << endl;
    Resource r;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('class Resource')
    expect(gen).toContain('class Manager')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

/**
 * 🔴 第 218 刀：類別裡的一般成員函式另立元件（cpp:method_def）——資訊隔離的模糊測試，10 支（出題者不知道實作）。
 *
 * 程式與編譯器的預期輸出在 `tests/fixtures/fuzz-cpp-method-def.json`。驗證時以本機編譯器跑過：
 * main（218 之前）10 支裡 9 支產回來編不過、1 支輸出不同；218 之後 6 支產回來的輸出與原始相同。
 * 剩下的四支（＋一支漂移）是建構子與宣告那一族的既有缺陷，不在這顆元件的範圍——登記成 todo，寫明原因與何時修。
 */
describe('fuzz（第 218 刀）：類別裡的一般成員函式與尾端 const', () => {
  type Row = { id: string; description: string; code: string; status: 'pass' | 'todo' | 'drift'; why: string; defect?: string }
  const rows: Row[] = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/fuzz-cpp-method-def.json`, 'utf8'))
  const lift = (code: string): any => lifter.lift(tsParser.parse(code)!.rootNode as any)
  const all = (n: any, id: string, out: any[] = []): any[] => {
    if (n.componentId === id) out.push(n)
    for (const kids of Object.values(n.slots ?? {})) for (const k of kids as any[]) all(k, id, out)
    return out
  }
  const shape = (n: any): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as any[]).map(shape)])) })

  it('★ 入口條件：fixture 有 10 支——pass 9、todo 1（fuzz_7 第 229 刀修好；fuzz_6、fuzz_10 的建構子預設引數在元件管線 311 修好；fuzz_1 的 const 物件建構引數在 331 修好）', () => {
    expect(rows).toHaveLength(10)
    expect(rows.filter((r) => r.status === 'pass')).toHaveLength(9)
    expect(rows.filter((r) => r.status === 'drift')).toHaveLength(0)
  })

  for (const r of rows.filter((x) => x.status !== 'todo')) {
    it(`★ ${r.id}：身分——類別裡的成員函式是 method_def，沒有降級；const 的標頭產回去還在`, () => {
      const t = lift(r.code)
      const ms = all(t, 'cpp:method_def')
      expect(ms.length).toBeGreaterThan(0)
      // 🟢 `this` 原本沒有元件認領（降級成原文）——元件管線 311 補了 cpp:this 之後，一律不准降級
      expect(all(t, 'raw_code').map((n) => n.metadata?.rawCode)).toEqual([])
      expect(all(t, 'unresolved')).toHaveLength(0)
      const out = generateCode(t, 'cpp', style)
      for (const m of ms.filter((x) => x.properties.is_const === 'true')) expect(out).toContain(`${m.properties.name}(`)
      expect(out.match(/\) const \{/g)?.length ?? 0).toBeGreaterThanOrEqual(ms.filter((x) => x.properties.is_const === 'true').length)
      expect(generateCode(lift(out), 'cpp', style)).toBe(out)
    })
  }

  for (const r of rows.filter((x) => x.status === 'pass')) {
    it(`🔴 ${r.id}：再 lift 是同一棵樹`, () => {
      const t = lift(r.code)
      expect(JSON.stringify(shape(lift(generateCode(t, 'cpp', style))))).toBe(JSON.stringify(shape(t)))
    })
  }

  // 為什麼不現在修：都是建構子／宣告那一族（不是 method_def 的範圍），main 上就是這樣。
  // 何時修：draft〈成員函式的尾端 const〉「做了之後量到的」那一段列了推薦——補建構子的預設引數、初始化列的多引數、
  //         const 物件的建構引數、類別成員的 static 那一刀；修好把對應的 todo 改成 it（並把 fixture 的 status 改成 pass）。
  // ⚠️ 不用 `it.todo`（這個檔上面記過：todo 是一種殼，缺陷修好時它一聲都不出）——斷言【缺陷還在】：
  //    產碼裡那段走樣的文字（fixture 的 `defect`）。修好的那天這條會紅 ⟹ 把 fixture 的 status 改成 pass、這條就換成上面的正向測試
  for (const r of rows.filter((x) => x.status !== 'pass')) {
    it(`🟡 已知缺陷還在（修好時這條會紅）：${r.id}——${r.why}`, () => {
      expect(r.defect, 'fixture 要寫缺陷的指紋').toBeTruthy()
      expect(generateCode(lift(r.code), 'cpp', style)).toContain(r.defect!)
    })
  }
})
