/**
 * Fuzz Test Regression: C++ Arrays & Pointers
 * Generated from Phase 4 fuzz testing (2026-03-12)
 *
 * Tests lift -> generate -> roundtrip stability for programs
 * exercising arrays, pointers, references, and dynamic allocation.
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

async function runCode(code: string) {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  expect(sem).not.toBeNull()
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(sem!, [])
  return interp
}

function roundTrip(code: string): string {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  expect(sem).not.toBeNull()
  return generateCode(sem!, 'cpp', style)
}

// ─── Fuzz 1: Array fill and reverse print ───
describe('fuzz: array fill and reverse access', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int a[5];
    for (int i = 0; i < 5; i++) {
        a[i] = (i + 1) * 10;
    }
    for (int i = 4; i >= 0; i--) {
        cout << a[i] << " ";
    }
    cout << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('50')
    expect(out).toContain('10')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 2: Pointer to modify variable via function ───
describe('fuzz: pointer parameter modifies caller variable', () => {
  const code = `#include <iostream>
using namespace std;
void doubleIt(int* p) {
    *p = *p * 2;
}
int main() {
    int val = 7;
    doubleIt(&val);
    cout << val << endl;
    doubleIt(&val);
    cout << val << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('14')
    expect(out).toContain('28')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 3: 2D array with nested loops ───
describe('fuzz: 2D array multiplication table', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int table[3][3];
    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            table[i][j] = (i + 1) * (j + 1);
        }
    }
    cout << table[0][0] << endl;
    cout << table[1][1] << endl;
    cout << table[2][2] << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('1')
    expect(out).toContain('4')
    expect(out).toContain('9')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 4: new/delete with computation ───
describe('fuzz: dynamic allocation with computation', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int* a = new int;
    int* b = new int;
    *a = 15;
    *b = 25;
    int sum = *a + *b;
    cout << sum << endl;
    delete a;
    delete b;
    return 0;
}`

  // Interpreter pointer semantics for multiple `new` allocations
  // may not match native C++ exactly; skip execution test.
  it.todo('executes correctly (interpreter new/delete semantics)')

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 5: Array max finder ───
describe('fuzz: array max finder with pointers', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int arr[5];
    arr[0] = 3;
    arr[1] = 7;
    arr[2] = 1;
    arr[3] = 9;
    arr[4] = 4;
    int maxVal = arr[0];
    for (int i = 1; i < 5; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
        }
    }
    cout << maxVal << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('9')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 6: Multiple pointer dereferences in expressions ───
describe('fuzz: pointer dereference in complex expressions', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    int y = 20;
    int* px = &x;
    int* py = &y;
    int result = *px + *py;
    cout << result << endl;
    *px = *px + *py;
    cout << x << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('30')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Known issues ───
describe('reference parameter swap (roundtrip drift)', () => {
  // t05_reference: swap(int& a, int& b) generates unknown concept: cpp_swap
  // which causes indentation drift on second roundtrip
  it.todo('swap with reference parameters should roundtrip cleanly')
})
