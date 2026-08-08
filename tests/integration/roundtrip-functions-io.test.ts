/**
 * Phase 3 Roundtrip: Functions & I/O
 *
 * Covers concepts:
 * func_def, func_call, func_call_expr, return, print, endl,
 * cpp_include, cpp_using_namespace, cpp_define,
 * comment, block_comment, doc_comment
 *
 * Each program is tested for:
 * 1. execution correctness (via SemanticInterpreter)
 * 2. roundtrip stability (lift -> generate -> lift -> generate, gen1 === gen2)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
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

function liftCode(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTrip(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

async function runCode(code: string, stdin: string[] = []) {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  expect(sem).not.toBeNull()
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  await interp.execute(sem!, stdin)
  return interp
}

// ─── Program 1: Hello World (basic cout with endl) ───
describe('functions & io: hello world', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('Hello, World!')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 2: Multi-print (cout chaining) ───
describe('functions & io: multi print', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    cout << "x = " << 10 << ", y = " << 20 << endl;
    cout << "sum = " << 10 + 20 << endl;
    cout << "done" << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('x = ')
    expect(out).toContain('10')
    expect(out).toContain('sum = ')
    expect(out).toContain('30')
    expect(out).toContain('done')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 3: Simple function (definition, call, return) ───
describe('functions & io: simple function', () => {
  const code = `#include <iostream>
using namespace std;
int multiply(int a, int b) {
    return a * b;
}
int main() {
    int result = multiply(6, 7);
    cout << result << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('42')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 4: Void function ───
describe('functions & io: void function', () => {
  const code = `#include <iostream>
using namespace std;
void printLine(int n) {
    cout << "Line " << n << endl;
}
int main() {
    printLine(1);
    printLine(2);
    printLine(3);
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('Line 1')
    expect(out).toContain('Line 2')
    expect(out).toContain('Line 3')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 5: Multi-parameter function ───
describe('functions & io: multi param function', () => {
  const code = `#include <iostream>
using namespace std;
int clamp(int val, int lo, int hi) {
    if (val < lo) {
        return lo;
    }
    if (val > hi) {
        return hi;
    }
    return val;
}
int main() {
    cout << clamp(5, 1, 10) << endl;
    cout << clamp(-3, 0, 100) << endl;
    cout << clamp(200, 0, 100) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('5')
    expect(out).toContain('0')
    expect(out).toContain('100')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 6: Functions calling functions ───
describe('functions & io: func calling func', () => {
  const code = `#include <iostream>
using namespace std;
int doubleVal(int x) {
    return x * 2;
}
int tripleVal(int x) {
    return x * 3;
}
int doublePlusTriple(int a, int b) {
    return doubleVal(a) + tripleVal(b);
}
int main() {
    cout << doublePlusTriple(5, 4) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('22')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 7: Include and define ───
describe('functions & io: include and define', () => {
  const code = `#include <iostream>
using namespace std;
#define MAX_SIZE 100
#define PI 3
int main() {
    cout << MAX_SIZE << endl;
    cout << PI << endl;
    return 0;
}`

  // 阻斷者是 `#define` 巨集展開（墓碑），不是 print——原本的 [BLOCKED:lang:print]
  // 標記是錯的。歸因見 knowledge/experience.md「宣稱『與我無關』之前先去量」。
  it.skip('[BLOCKED:cpp:define] executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('100')
    expect(out).toContain('3')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 8: Using namespace with cout ───
describe('functions & io: using namespace', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int a = 10;
    int b = 20;
    cout << a << " + " << b << " = " << a + b << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('10 + 20 = 30')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 9: Comments (single-line, block, doc) ───
describe('functions & io: comments', () => {
  const code = `#include <iostream>
using namespace std;
// This is a single-line comment
/* This is a
   block comment */
/// This is a doc comment
int main() {
    // Print a message
    cout << "comments work" << endl;
    /* Another block comment */
    cout << "done" << endl;
    return 0;
}`

  // 阻斷者是 block_comment 的執行，不是 print——原本的標記是錯的
  it.skip('[BLOCKED:lang:block_comment] executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('comments work')
    expect(out).toContain('done')
  })

  // SKIP: block_comment P1 instability - lifter does not strip `* ` prefixes
  // added by code generator, causing prefix duplication on re-lift.
  // Also doc_comment `///` rendered as `// /`.
  // 阻斷者是 block_comment 的 lifter 沒有剝掉 `* ` 前綴，不是 print
  it.skip('[BLOCKED:lang:block_comment] roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 10: Combined I/O and functions ───
describe('functions & io: combined io and func', () => {
  const code = `#include <iostream>
using namespace std;
int square(int x) {
    return x * x;
}
void printSquare(int x) {
    cout << "square(" << x << ") = " << square(x) << endl;
}
int sumRange(int start, int end) {
    int total = 0;
    for (int i = start; i <= end; i++) {
        total = total + i;
    }
    return total;
}
int main() {
    // Print squares
    printSquare(3);
    printSquare(5);
    // Print sum
    cout << "sum(1..10) = " << sumRange(1, 10) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('square(3) = 9')
    expect(out).toContain('square(5) = 25')
    expect(out).toContain('sum(1..10) = 55')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})
