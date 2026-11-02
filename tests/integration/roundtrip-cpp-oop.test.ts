/**
 * Round-trip tests for C++ OOP components:
 * cpp_struct_declare, cpp_class_def, cpp_constructor, cpp_destructor,
 * cpp_virtual_method, cpp_pure_virtual, cpp_override_method, cpp_operator_overload
 *
 * Verifies: code -> lift -> SemanticTree -> generate -> code
 *
 * Based on roundtrip-cpp-oop-20260312 report.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
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

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

function findComponent(node: any, component: string): boolean {
  if (node.componentId === component) return true
  for (const slots of Object.values(node.slots ?? {})) {
    for (const child of slots as any[]) {
      if (findComponent(child, component)) return true
    }
  }
  return false
}

describe('Round-trip: C++ OOP components', () => {
  // ---- 1. simple_struct: struct with data members ----
  describe('cpp_struct_declare (simple_struct)', () => {
    it('struct lifts to cpp_struct_declare', () => {
      const code = `struct Point {
    int x;
    int y;
};`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findComponent(tree!, 'cpp:struct_declare')).toBe(true)
    })

    it('struct generates back', () => {
      const code = `struct Point {
    int x;
    int y;
};`
      const result = roundTripCode(code)
      expect(result).toContain('struct Point')
    })
  })

  // ---- 2. class_basic: class with public/private ----
  describe('cpp_class_def (class_basic)', () => {
    it('class with public and private members', () => {
      const code = `class Box {
public:
    int width;
    int height;
private:
    int id;
};`
      const result = roundTripCode(code)
      expect(result).toContain('class Box')
      expect(result).toContain('public:')
      expect(result).toContain('private:')
      expect(result).toContain('int width;')
      expect(result).toContain('int height;')
      expect(result).toContain('int id;')
    })
  })

  // ---- 3. constructor: class with constructor ----
  describe('cpp_constructor (constructor)', () => {
    it('constructor definition inside class', () => {
      const code = `class Counter {
public:
    Counter(int start) {
        val = start;
    }
    int val;
};`
      const result = roundTripCode(code)
      expect(result).toContain('Counter(int start)')
      expect(result).toContain('val = start;')
    })

    it('constructor with initializer list', () => {
      const code = `class Foo {
public:
    Foo(int x) : val(x) {
    }
private:
    int val;
};`
      const result = roundTripCode(code)
      expect(result).toContain('Foo(int x)')
      expect(result).toContain('val(x)')
    })

    it('constructor with multiple parameters', () => {
      const code = `class Point {
public:
    Point(int a, int b) {
        x = a;
        y = b;
    }
private:
    int x;
    int y;
};`
      const result = roundTripCode(code)
      expect(result).toContain('Point(int a, int b)')
    })
  })

  // ---- 4. destructor: constructor + destructor ----
  describe('cpp_destructor (destructor)', () => {
    it('class with constructor and destructor', () => {
      const code = `class Resource {
public:
    Resource(int v) {
        val = v;
    }
    ~Resource() {
        int x = 0;
    }
    int val;
};`
      const result = roundTripCode(code)
      expect(result).toContain('Resource(int v)')
      expect(result).toContain('~Resource()')
    })

    it('destructor with cout inside class', () => {
      const code = `class Res {
public:
    Res(int v) {
        val = v;
        cout << "create" << endl;
    }
    ~Res() {
        cout << "destroy" << endl;
    }
    int val;
};`
      const result = roundTripCode(code)
      expect(result).toContain('~Res()')
      expect(result).toContain('"create"')
      expect(result).toContain('"destroy"')
    })
  })

  // ---- 5. virtual_method: class with virtual method ----
  describe('cpp_virtual_method (virtual_method)', () => {
    it('virtual method with body', () => {
      const code = `class Animal {
public:
    virtual void speak() {
        int x = 0;
    }
};`
      const result = roundTripCode(code)
      expect(result).toContain('virtual void speak()')
    })

    it('virtual method with cout body', () => {
      const code = `class Animal {
public:
    virtual void speak() {
        cout << "..." << endl;
    }
};`
      const result = roundTripCode(code)
      expect(result).toContain('virtual void speak()')
      expect(result).toContain('"..."')
    })
  })

  // ---- 6. operator_overload: operator+ ----
  describe('cpp_operator_overload (operator_overload)', () => {
    it('operator+ overload with struct member access', () => {
      const code = `class Vec {
public:
    int x;
    int y;
    Vec operator+(Vec other) {
        Vec result;
        result.x = x + other.x;
        result.y = y + other.y;
        return result;
    }
};`
      const result = roundTripCode(code)
      expect(result).toContain('operator+')
      expect(result).toContain('Vec other')
      expect(result).toContain('result.x')
      expect(result).toContain('result.y')
    })

    it('🔴 尾端的 const 來回一趟還在（spec 201）——掉了的話 sort／priority_queue 拿 const 物件比較時編不過', () => {
      const code = `struct Node {
    int x;
    bool operator<(const Node& o) const {
        return x < o.x;
    }
};`
      expect(roundTripCode(code)).toMatch(/bool operator<\(const Node& o\) const\s*\{/)
      // 沒寫 const 的不得被加上
      expect(roundTripCode(code.replace(') const {', ') {'))).toMatch(/bool operator<\(const Node& o\)\s*\{/)
    })
  })

  // ---- 第 218 刀：cpp:method_def（類別裡的一般成員函式，帶尾端 const）----
  // 五支程式在 roundtrip 階段以本機編譯器跑過：原始與產回來的 stdout 相同（t4 除外，見下面的 todo）
  describe('cpp:method_def（第 218 刀）', () => {
    const SRC: Record<string, string> = {
      t1_const_getter: `#include <iostream>
using namespace std;
struct Rect {
    int w;
    int h;
    int area() const {
        return w * h;
    }
    void scale(int k) {
        w *= k;
        h *= k;
    }
};
int total(const Rect& a, const Rect& b) {
    return a.area() + b.area();
}
int main() {
    Rect a;
    a.w = 2;
    a.h = 3;
    Rect b;
    b.w = 1;
    b.h = 4;
    b.scale(2);
    cout << total(a, b) << endl;
    return 0;
}
`,
      t2_method_calls_method: `#include <iostream>
using namespace std;
class Counter {
private:
    int n;
public:
    Counter() {
        n = 0;
    }
    void add(int k) {
        n += k;
    }
    int get() const {
        return n;
    }
    bool big() const {
        return get() > 10;
    }
};
int main() {
    Counter c;
    c.add(7);
    c.add(5);
    cout << c.get() << " " << c.big() << endl;
    return 0;
}
`,
      t3_const_in_lambda: `#include <bits/stdc++.h>
using namespace std;
struct Item {
    string name;
    int price;
    int cost(int qty) const {
        return price * qty;
    }
};
int main() {
    vector<Item> v = {{"pen", 3}, {"book", 12}, {"cup", 5}};
    sort(v.begin(), v.end(), [](const Item& a, const Item& b) {
        return a.cost(2) < b.cost(2);
    });
    for (const Item& it : v) {
        cout << it.name << " " << it.cost(2) << endl;
    }
    return 0;
}
`,
      t5_string_and_two_params: `#include <iostream>
#include <string>
using namespace std;
struct Student {
    string name;
    int score;
    string grade() const {
        if (score >= 90) {
            return "A";
        }
        return "B";
    }
    void bonus(int pts, int cap) {
        score += pts;
        if (score > cap) {
            score = cap;
        }
    }
};
int main() {
    Student s;
    s.name = "Amy";
    s.score = 85;
    cout << s.grade() << endl;
    s.bonus(10, 100);
    cout << s.name << " " << s.score << " " << s.grade() << endl;
    return 0;
}
`,
    }
    const all = (n: any, id: string, out: any[] = []): any[] => {
      if (n.componentId === id) out.push(n)
      for (const kids of Object.values(n.slots ?? {})) for (const k of kids as any[]) all(k, id, out)
      return out
    }
    const shape = (n: any): unknown => ({ c: n.componentId, p: n.properties, s: Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, (v as any[]).map(shape)])) })

    it.each(Object.entries(SRC))('★ 身分：%s 的成員函式都是 method_def，沒有降級', (_name, code) => {
      const t = liftCode(code)!
      expect(all(t, 'cpp:method_def').length).toBeGreaterThan(0)
      expect(findComponent(t, 'raw_code')).toBe(false)
      expect(findComponent(t, 'unresolved')).toBe(false)
    })

    it.each(Object.entries(SRC))('🔴 const 保留、產碼是不動點、再 lift 是同一棵樹：%s', (_name, code) => {
      const t = liftCode(code)!
      const out = generateCode(t, 'cpp', style)
      for (const m of all(t, 'cpp:method_def')) {
        const head = `${m.properties.name}(`
        expect(out, head).toContain(head)
        if (m.properties.is_const === 'true') expect(out).toMatch(new RegExp(`\\b${m.properties.name}\\([^)]*\\) const \\{`))
      }
      const t2 = liftCode(out)!
      expect(generateCode(t2, 'cpp', style)).toBe(out)
      expect(JSON.stringify(shape(t2))).toBe(JSON.stringify(shape(t)))
    })

    // 🔴 既有缺陷（main 上就有，不是 218 帶進來的）：類別裡的 `static int zero()` 走頂層函式那顆，`static` 掉了，
    //    產回去在 `P::zero()` 編不過；JS 直譯器也不認 `P::zero()`。
    //    為什麼不現在修：探索報告把 static 列為範圍外（method_def 沒有地方放它；加進來是 const／static 互斥的修飾，要改積木的設計）。
    //    何時修：補「類別成員的 static」那一刀時（draft〈成員函式的尾端 const〉已記這一筆）——修好把它改成 it。
    // ⚠️ 不用 it.todo（todo 修好時不出聲）——斷言缺陷還在；修好的那天這條會紅，換成正向的「保留 static」
    it('🟡 已知缺陷還在（修好時這條會紅）：類別裡的 static 成員函式產回去丟了 static', () => {
      const code = `struct P {\n    static int zero() {\n        return 0;\n    }\n};\nint main() {\n    return P::zero();\n}\n`
      const out = roundTripCode(code)
      expect(out).toContain('int zero() {')
      expect(out).not.toContain('static int zero()')
    })
  })

  // ---- 7. struct_func: struct with member functions ----
  describe('cpp_struct_declare with methods (struct_func)', () => {
    it('struct with methods lifts correctly', () => {
      const code = `struct Rect {
    int w;
    int h;
    int area() {
        return w * h;
    }
};`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findComponent(tree!, 'cpp:struct_declare')).toBe(true)
    })
  })

  // ---- 8. class_methods: class with multiple methods ----
  describe('cpp_class_def with methods (class_methods)', () => {
    it('class with constructor and methods preserves structure', () => {
      const code = `class Account {
public:
    Account(int initial) {
        balance = initial;
    }
    int getBalance() {
        return balance;
    }
    void deposit(int amount) {
        balance = balance + amount;
    }
private:
    int balance;
};`
      const result = roundTripCode(code)
      expect(result).toContain('class Account')
      expect(result).toContain('Account(int initial)')
      expect(result).toContain('int getBalance()')
      expect(result).toContain('void deposit(int amount)')
      expect(result).toContain('private:')
      expect(result).toContain('int balance;')
    })
  })

  // ---- 9. pure_virtual: abstract class ----
  describe('cpp_pure_virtual (pure_virtual)', () => {
    it('pure virtual method', () => {
      const code = `class Shape {
public:
    virtual double area() = 0;
};`
      const result = roundTripCode(code)
      expect(result).toContain('virtual double area() = 0;')
    })

    it('multiple pure virtual methods', () => {
      const code = `class Shape {
public:
    virtual double area() = 0;
    virtual double perimeter() = 0;
};`
      const result = roundTripCode(code)
      expect(result).toContain('virtual double area() = 0;')
      expect(result).toContain('virtual double perimeter() = 0;')
    })
  })

  // ---- 10. combined_oop: struct + class + constructor + destructor ----
  describe('combined OOP (combined_oop)', () => {
    it('class with constructor and destructor generates correctly', () => {
      const code = `class Container {
public:
    Container(int size) {
        capacity = size;
        count = 0;
    }
    ~Container() {
        count = 0;
    }
    int capacity;
    int count;
private:
    int id;
};`
      const result = roundTripCode(code)
      expect(result).toContain('class Container')
      expect(result).toContain('Container(int size)')
      expect(result).toContain('~Container()')
      expect(result).toContain('private:')
    })
  })

  // ---- 11. inheritance: class with base class ----
  describe('cpp_class_def with inheritance', () => {
    it('class inheriting from base class', () => {
      const code = `class Animal {
public:
    virtual void speak() {
        int x = 0;
    }
};`
      const result = roundTripCode(code)
      expect(result).toContain('class Animal')
    })

    it('class with public inheritance', () => {
      const code = `class Dog : public Animal {
public:
    void speak() override {
        int x = 1;
    }
};`
      const result = roundTripCode(code)
      expect(result).toContain('class Dog : public Animal')
      expect(result).toContain('override')
    })
  })

  // ---- 12. struct member access ----
  describe('cpp_struct_member_access and cpp_struct_pointer_access', () => {
    it('struct declaration generates back', () => {
      const code = `struct Point {
    int x;
    int y;
};`
      const result = roundTripCode(code)
      expect(result).toContain('struct Point')
      expect(result).toContain('int x;')
      expect(result).toContain('int y;')
    })
  })

  // ---- 13. reference declare ----
  describe('cpp:var_declare_ref', () => {
    it('reference declaration generates back', () => {
      const code = `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    int& ref = x;
    cout << ref << endl;
    return 0;
}`
      const result = roundTripCode(code)
      expect(result).toContain('int& ref')
    })
  })

  // ---- 14. constructor-style initialization ----
  describe('constructor-style initialization', () => {
    it('Type name(args) generates with constructor syntax', () => {
      const code = `Counter c(10);`
      const result = roundTripCode(code)
      expect(result).toContain('Counter c(10);')
    })

    it('constructor call with float arg', () => {
      const code = `Circle c(5.0);`
      const result = roundTripCode(code)
      expect(result).toContain('Circle c(5.0);')
    })

    it('constructor call with multiple args', () => {
      const code = `Point p(3, 4);`
      const result = roundTripCode(code)
      expect(result).toContain('Point p(3, 4);')
    })

    it('constructor call is P1 stable', () => {
      const code = `Circle c(5.0);`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const gen1 = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(gen1)
      expect(tree2).not.toBeNull()
      const gen2 = generateCode(tree2!, 'cpp', style)
      expect(gen1).toBe(gen2)
    })
  })

  // ---- 15. method call as statement ----
  describe('method call statement', () => {
    it('obj.method() generates with indent and semicolons', () => {
      const code = `c.inc();`
      const result = roundTripCode(code)
      expect(result).toContain('c.inc();')
    })

    it('obj.method(arg) generates correctly', () => {
      const code = `v.push_back(10);`
      const result = roundTripCode(code)
      expect(result).toContain('push_back')
    })
  })

  // ---- P1 stability checks ----
  describe('P1 round-trip drift check', () => {
    it('class_def lifts consistently across two round-trips', () => {
      const code = `class Simple {
public:
    int x;
};`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const gen1 = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(gen1)
      expect(tree2).not.toBeNull()
      expect(findComponent(tree1!, 'cpp:class_def')).toBe(true)
      expect(findComponent(tree2!, 'cpp:class_def')).toBe(true)
    })

    it('virtual method class is P1 stable', () => {
      const code = `class Animal {
public:
    virtual void speak() {
        int x = 0;
    }
};`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const gen1 = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(gen1)
      expect(tree2).not.toBeNull()
      const gen2 = generateCode(tree2!, 'cpp', style)
      expect(gen1).toBe(gen2)
    })

    it('operator overload class is P1 stable', () => {
      const code = `class Vec {
public:
    int x;
    int y;
    Vec operator+(Vec other) {
        Vec result;
        result.x = x + other.x;
        result.y = y + other.y;
        return result;
    }
};`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const gen1 = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(gen1)
      expect(tree2).not.toBeNull()
      const gen2 = generateCode(tree2!, 'cpp', style)
      expect(gen1).toBe(gen2)
    })

    it('pure virtual class is P1 stable', () => {
      const code = `class Shape {
public:
    virtual double area() = 0;
    virtual double perimeter() = 0;
};`
      const tree1 = liftCode(code)
      expect(tree1).not.toBeNull()
      const gen1 = generateCode(tree1!, 'cpp', style)
      const tree2 = liftCode(gen1)
      expect(tree2).not.toBeNull()
      const gen2 = generateCode(tree2!, 'cpp', style)
      expect(gen1).toBe(gen2)
    })
  })
})
