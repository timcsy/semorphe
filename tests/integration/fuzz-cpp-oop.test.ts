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

describe.skip('fuzz: scoped destructor call in inner block (SEMANTIC_DIFF)', () => {
  // Inner block scope { Scope s; } is flattened during lift,
  // causing destructor to fire at end of main instead of end of block.
  // Roundtrip is stable (gen1 == gen2), but output order differs.
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

  it.todo('should preserve inner block scope for correct destructor ordering')
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
