import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset, SemanticNode } from '../../src/core/types'

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

function liftAndGenerate(code: string): { sem: SemanticNode | null; generated: string } {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  if (!sem) return { sem: null, generated: '' }
  const generated = generateCode(sem, 'cpp', style)
  return { sem, generated }
}

function assertStableRoundtrip(code: string) {
  const { sem, generated } = liftAndGenerate(code)
  expect(sem).not.toBeNull()

  // Second roundtrip
  const { generated: generated2 } = liftAndGenerate(generated)
  expect(generated2).toBe(generated)
  return { sem: sem!, generated }
}

function hasNoConcept(node: SemanticNode, forbidden: string[]): boolean {
  if (forbidden.includes(node.conceptId)) return false
  for (const children of Object.values(node.children || {})) {
    for (const child of children) {
      if (!hasNoConcept(child, forbidden)) return false
    }
  }
  return true
}

describe('Round-trip: Phase 5 - Type System & Advanced Ops', () => {
  it('t01: const declare', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    const int MAX = 100;
    cout << MAX << endl;
    return 0;
}`)
    expect(generated).toContain('const int MAX = 100;')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t02: auto declare', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    auto x = 42;
    auto y = 3.14;
    cout << x << endl;
    return 0;
}`)
    expect(generated).toContain('auto x = 42;')
    expect(generated).toContain('auto y = 3.14;')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t03: typedef', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
typedef long long ll;
int main() {
    ll x = 1000000000;
    cout << x << endl;
    return 0;
}`)
    expect(generated).toContain('typedef long long ll;')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t04: sizeof', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    cout << sizeof(int) << endl;
    cout << sizeof(double) << endl;
    return 0;
}`)
    expect(generated).toContain('sizeof(int)')
    expect(generated).toContain('sizeof(double)')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t05: ternary', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int x = 5;
    int y = x > 3 ? 10 : 20;
    cout << y << endl;
    return 0;
}`)
    expect(generated).toContain('?')
    expect(generated).toContain(':')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t06: cast', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    double d = 3.14;
    int n = (int)d;
    cout << n << endl;
    return 0;
}`)
    expect(generated).toContain('(int)')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t07: increment/decrement', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int x = 5;
    x++;
    cout << x << endl;
    int y = 10;
    y--;
    cout << y << endl;
    return 0;
}`)
    expect(generated).toContain('x++')
    expect(generated).toContain('y--')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t08: compound assign', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int x = 10;
    x += 5;
    x -= 3;
    x *= 2;
    cout << x << endl;
    return 0;
}`)
    expect(generated).toContain('x += 5;')
    expect(generated).toContain('x -= 3;')
    expect(generated).toContain('x *= 2;')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t09: enum', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
enum Color { RED, GREEN, BLUE };
int main() {
    Color c = GREEN;
    cout << c << endl;
    return 0;
}`)
    expect(generated).toContain('enum Color')
    expect(generated).toContain('RED')
    expect(generated).toContain('GREEN')
    expect(generated).toContain('BLUE')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t10: constexpr', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    constexpr int SIZE = 10;
    int arr[SIZE];
    arr[0] = 42;
    cout << arr[0] << endl;
    return 0;
}`)
    expect(generated).toContain('constexpr int SIZE = 10;')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t11: using alias', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
using ll = long long;
int main() {
    ll x = 2000000000;
    cout << x << endl;
    return 0;
}`)
    expect(generated).toContain('using ll = long long;')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t12: static_cast', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    double d = 9.99;
    int n = static_cast<int>(d);
    cout << n << endl;
    return 0;
}`)
    expect(generated).toContain('static_cast<int>')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t13: const_cast with pointer', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    const int x = 42;
    const int* cp = &x;
    int* mp = const_cast<int*>(cp);
    cout << *mp << endl;
    return 0;
}`)
    expect(generated).toContain('const_cast<int*>')
    expect(generated).toContain('const int* cp')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t14: bitwise_not', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int x = 5;
    cout << ~x << endl;
    return 0;
}`)
    expect(generated).toContain('~x')
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t15: bitwise binary ops', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int a = 12, b = 10;
    cout << (a & b) << endl;
    cout << (a | b) << endl;
    cout << (a ^ b) << endl;
    int c = a << 2;
    int d = a >> 1;
    cout << c << endl;
    cout << d << endl;
    return 0;
}`)
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t16: increment expression in cout', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int x = 5;
    cout << x++ << endl;
    cout << x << endl;
    int y = 10;
    cout << ++y << endl;
    return 0;
}`)
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t17: compound assign bitwise', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int x = 15;
    x &= 6;
    cout << x << endl;
    x |= 8;
    cout << x << endl;
    x ^= 3;
    cout << x << endl;
    return 0;
}`)
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })

  it('t18: mixed — ternary in cout + for loop', () => {
    const { sem, generated } = assertStableRoundtrip(`#include <iostream>
using namespace std;
int main() {
    int sum = 0;
    for (int i = 0; i < 5; i++) {
        sum += i;
    }
    cout << (sum > 5 ? "big" : "small") << endl;
    return 0;
}`)
    expect(hasNoConcept(sem!, ['cpp:raw_code', 'cpp:raw_expression', 'unresolved'])).toBe(true)
  })
})
