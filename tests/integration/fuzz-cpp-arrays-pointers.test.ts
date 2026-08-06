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

// ─── Fuzz 1: Array initialization with values ───
describe('fuzz: array initialization with values', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int a[5] = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int i = 0; i < 5; i++) {
        sum = sum + a[i];
    }
    cout << sum << endl;
    return 0;
}`

  // BUG: initializer list values are lost during lift
  it.todo('[BLOCKED:array_declare] executes correctly (initializer list values lost during lift)')

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 2: Array boundary access (no OOB) ───
describe('fuzz: array boundary access patterns', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int arr[10];
    for (int i = 0; i < 10; i++) {
        arr[i] = i * i;
    }
    cout << arr[0] << endl;
    cout << arr[4] << endl;
    cout << arr[9] << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('0')
    expect(out).toContain('16')
    expect(out).toContain('81')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 3: Pointer arithmetic with array base ───
describe('fuzz: pointer arithmetic with array base', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int arr[5] = {2, 4, 6, 8, 10};
    int* p = arr;
    cout << *p << endl;
    p = p + 2;
    cout << *p << endl;
    p = p + 2;
    cout << *p << endl;
    return 0;
}`

  // BUG: initializer list values lost, pointer arithmetic itself is correct
  it.todo('[BLOCKED:array_declare] executes correctly (initializer list values lost during lift)')

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 4: Pass array to function by pointer ───
describe('fuzz: pass array to function by pointer', () => {
  const code = `#include <iostream>
using namespace std;
void fillArray(int* arr, int n) {
    for (int i = 0; i < n; i++) {
        arr[i] = (i + 1) * 3;
    }
}
int main() {
    int data[4];
    fillArray(data, 4);
    for (int i = 0; i < 4; i++) {
        cout << data[i] << " ";
    }
    cout << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('3')
    expect(out).toContain('6')
    expect(out).toContain('9')
    expect(out).toContain('12')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 5: Multiple pointers to same data ───
describe('fuzz: multiple pointers to same data', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 42;
    int* p1 = &x;
    int* p2 = &x;
    *p1 = *p1 + 8;
    cout << *p2 << endl;
    *p2 = *p2 * 2;
    cout << *p1 << endl;
    cout << x << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('50')
    expect(out).toContain('100')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 6: new/delete patterns ───
describe('fuzz: new/delete with computation', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int* a = new int;
    int* b = new int;
    *a = 15;
    *b = 25;
    int sum = *a + *b;
    cout << sum << endl;
    *a = sum;
    cout << *a << endl;
    delete a;
    delete b;
    return 0;
}`

  it.todo('[BLOCKED:cpp_new] executes correctly (interpreter new/delete semantics)')

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 7: malloc/free patterns ───
describe('fuzz: malloc/free patterns', () => {
  const code = `#include <iostream>
#include <cstdlib>
using namespace std;
int main() {
    int* arr = (int*)malloc(3 * sizeof(int));
    arr[0] = 100;
    arr[1] = 200;
    arr[2] = 300;
    int total = arr[0] + arr[1] + arr[2];
    cout << total << endl;
    free(arr);
    return 0;
}`

  it.todo('[BLOCKED:cpp_malloc] executes correctly (interpreter malloc/free semantics)')

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 8: Address-of and dereference chains ───
describe('fuzz: address-of and dereference chains', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 99;
    int* p = &x;
    cout << *&x << endl;
    cout << *p << endl;
    cout << **&p << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('99')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Fuzz 9: Array of pointers ───
describe('fuzz: array of pointers', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int a = 1;
    int b = 2;
    int c = 3;
    int* ptrs[3];
    ptrs[0] = &a;
    ptrs[1] = &b;
    ptrs[2] = &c;
    int sum = 0;
    for (int i = 0; i < 3; i++) {
        sum = sum + *ptrs[i];
    }
    cout << sum << endl;
    return 0;
}`

    // 這個 `BUG:` 註解在 084 修好了——**兩個的根因是同一種**：
  // 語法樹的 `pointer_declarator` 包了一層，而辨識器沒有下鑽。
  it('★ 來回轉換保住指標陣列的名字與大小', () => {
    expect(roundTrip(code)).toContain('int* ptrs[3]')
  })

  it('★ 執行結果正確——期望值由 g++ 實際編譯執行決定，不心算', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 200000 })
    const sem = lifter.lift(tsParser.parse(code)!.rootNode as never)
    await interp.execute(sem!)
    expect(interp.getOutput().join('').replace(/\s/g, '')).toBe('6')
  })
})

// ─── Fuzz 10: Function returning pointer (to global) ───
describe('fuzz: function returning pointer to global', () => {
  const code = `#include <iostream>
using namespace std;
int globalVal = 777;
int* getGlobalPtr() {
    return &globalVal;
}
int main() {
    int* p = getGlobalPtr();
    cout << *p << endl;
    *p = 888;
    cout << globalVal << endl;
    return 0;
}`

    // 這個 `BUG:` 註解在 084 修好了——**兩個的根因是同一種**：
  // 語法樹的 `pointer_declarator` 包了一層，而辨識器沒有下鑽。
  it('★ 來回轉換保住回傳指標的型別', () => {
    expect(roundTrip(code)).toContain('int* getGlobalPtr(')
  })

  it('★ 執行結果正確——期望值由 g++ 實際編譯執行決定，不心算', async () => {
    const interp = new SemanticInterpreter({ maxSteps: 200000 })
    const sem = lifter.lift(tsParser.parse(code)!.rootNode as never)
    await interp.execute(sem!)
    expect(interp.getOutput().join('').replace(/\s/g, '')).toBe('777888')
  })
})

// ─── Known issues summary ───
describe('known issues: arrays & pointers', () => {
  it.todo('[BLOCKED:array_declare] array initializer list {val1, val2, ...} should be preserved during lift (BUG-1)')
})
