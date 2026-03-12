/**
 * Fuzz Test Regression: C++ Advanced Features
 * Generated from fuzz testing (2026-03-13)
 *
 * Tests lift -> generate roundtrip for advanced C++ features:
 * lambda, namespace, try-catch, throw, casts, range-for, template function
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
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

// --- Simple lambda with using namespace std ---

describe('fuzz: lambda with value capture and return type', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    auto add = [](int a, int b) -> int {
        return a + b;
    };
    cout << add(3, 4) << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('[](int a, int b) -> int')
    expect(gen).toContain('return a + b;')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Namespace with functions ---

describe('fuzz: namespace with multiple functions', () => {
  const code = `#include <iostream>
using namespace std;
namespace Math {
    int square(int x) {
        return x * x;
    }
}
int main() {
    cout << Math::square(5) << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('namespace Math')
    expect(gen).toContain('int square(int x)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Try-catch with throw ---

describe('fuzz: try-catch with throw in if condition', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    try {
        int x = 10;
        if (x > 5) {
            throw x;
        }
        cout << "not thrown" << endl;
    } catch (int e) {
        cout << "caught: " << e << endl;
    }
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('try {')
    expect(gen).toContain('throw x;')
    expect(gen).toContain('catch (int e)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Static cast in assignment ---

describe('fuzz: static_cast double to int', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    double pi = 3.14;
    int n = static_cast<int>(pi);
    cout << n << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('static_cast<int>(pi)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Template function ---

describe('fuzz: template function with two params', () => {
  const code = `#include <iostream>
using namespace std;
template <typename T>
T myMax(T a, T b) {
    if (a > b) {
        return a;
    }
    return b;
}
int main() {
    cout << myMax(3, 7) << endl;
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('template <typename T>')
    expect(gen).toContain('T myMax(T a, T b)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Forward declaration ---

describe('fuzz: forward declaration with function', () => {
  const code = `#include <iostream>
using namespace std;
int add(int a, int b);
int main() {
    cout << add(3, 4) << endl;
    return 0;
}
int add(int a, int b) {
    return a + b;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('int add(int a, int b);')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Throw in function with try-catch in caller ---

describe('fuzz: throw in function, catch in caller', () => {
  const code = `#include <iostream>
using namespace std;
void check(int val) {
    if (val < 0) {
        throw val;
    }
    cout << "ok: " << val << endl;
}
int main() {
    try {
        check(5);
        check(-1);
    } catch (int e) {
        cout << "error: " << e << endl;
    }
    return 0;
}`

  it('lifts and generates successfully', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('throw val;')
    expect(gen).toContain('try {')
    expect(gen).toContain('catch (int e)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Range-for with array ---

describe('fuzz: range-for over container', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int total = 0;
    for (auto x : data) {
        total = total + x;
    }
    cout << total << endl;
    return 0;
}`

  it('lifts and generates range-for', () => {
    const gen = roundTrip(code)
    expect(gen).toContain('for (auto x : data)')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Known limitations (EXPECTED_DEGRADATION, fuzz 2026-03-13) ---
// fuzz_1: mutable lambda keyword not preserved
it.todo('fuzz: mutable lambda with value capture (needs mutable keyword support)')
// fuzz_2: template specialization template<> not supported
it.todo('fuzz: template specialization with namespace (needs template specialization concept)')
// fuzz_7: multiple catch blocks only one catch supported
it.todo('fuzz: multiple catch blocks and rethrow (needs multi-catch support)')
// fuzz_8: variadic templates and fold expressions not supported
it.todo('fuzz: variadic templates with fold expressions (needs variadic template concept)')
