/**
 * Round-trip tests for C++ OOP concepts:
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

function findConcept(node: any, concept: string): boolean {
  if (node.concept === concept) return true
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as any[]) {
      if (findConcept(child, concept)) return true
    }
  }
  return false
}

describe('Round-trip: C++ OOP concepts', () => {
  // ---- 1. simple_struct: struct with data members ----
  describe('cpp_struct_declare (simple_struct)', () => {
    it('struct lifts to cpp_struct_declare', () => {
      const code = `struct Point {
    int x;
    int y;
};`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree!, 'cpp_struct_declare')).toBe(true)
    })

    // Known issue: cpp_struct_declare generates as /* unknown concept */
    it.fails('struct generates back (known issue: no generator)', () => {
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
      expect(findConcept(tree!, 'cpp_struct_declare')).toBe(true)
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
      expect(findConcept(tree1!, 'cpp_class_def')).toBe(true)
      expect(findConcept(tree2!, 'cpp_class_def')).toBe(true)
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
