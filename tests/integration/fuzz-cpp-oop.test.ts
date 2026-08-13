/**
 * Fuzz Test Regression: C++ OOP Concepts
 * Generated from fuzz testing (2026-03-12)
 *
 * Tests lift -> generate -> execution roundtrip for OOP programs:
 * classes, constructors, destructors, operator overloading.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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

  it('★ 獨立區塊有自己的作用域——解構子在區塊結束時跑，不是 main 結束', async () => {
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(lifter.lift(tsParser.parse(code).rootNode as never) as never)
    // ⚠️ 順序是重點：`exit` 必須在 `main end` **之前**。
    // 展平之後兩者都會印，只是順序反了——**而「都印了」看起來像通過**。
    expect(i.getOutput().join('')).toBe('main start\nenter\ninner\nexit\nmain end\n')
  })

  it('★ 反向：`if` 的 body 不得多一層作用域', async () => {
    // 沒有這一支的話，一個「所有 compound 都不展平」的實作也會通過上一支
    // ——而那會讓 `if (c) { int x=1; x++; }` 的 x 在每一輪重新宣告。
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    const src = `#include <iostream>\nusing namespace std;\nint main(){ int n=0; for(int i=0;i<3;i++){ n+=i; } cout << n; return 0; }`
    await i.execute(lifter.lift(tsParser.parse(src).rootNode as never) as never)
    expect(i.getOutput().join('')).toBe('3')
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
// fuzz_3, fuzz_4: ptr->method() via pointer array generates as .method()
it.todo('[BLOCKED:cpp:pointer_declare] fuzz: pointer array dispatch animals[i]->describe() (needs ptr->method support)')
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
    const tree = tsParser.parse(code)
    const sem = lifter.lift(tree.rootNode as any)
    const interp = new SemanticInterpreter({ maxSteps: 20000 })
    registerCppLanguage()
    await interp.execute(sem!)
    const out = interp.getOutput().join('')
    expect(out.replace(/\s/g, ''), 'C++ 保證後宣告的先解構，且在離開區塊時就跑').toBe('21-')
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

  it('靜態成員由所有實例共用——執行結果證明它不是每個實例各一份', async () => {
    const tree = tsParser.parse(code)
    const sem = lifter.lift(tree.rootNode as any)
    const interp = new SemanticInterpreter({ maxSteps: 20000 })
    registerCppLanguage()
    await interp.execute(sem!)
    expect(interp.getOutput().join('').trim(), '第二個實例拿到 1 → 靜態成員被當成實例欄位了').toContain('2')
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
