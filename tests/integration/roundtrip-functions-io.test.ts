/**
 * Phase 3 Roundtrip: Functions & I/O
 *
 * Covers function concepts:
 * simple function, void function, function calling function,
 * recursive function, multiple print, multiple returns,
 * comments, multiple includes, no-arg function, nested calls
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

// --- Program 1: Simple function (add) ---
describe('functions & io: simple function (add)', () => {
  const code = `#include <iostream>
using namespace std;
int add(int a, int b) {
    return a + b;
}
int main() {
    cout << add(3, 4) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('7')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 2: Void function ---
describe('functions & io: void function', () => {
  const code = `#include <iostream>
using namespace std;
void greet() {
    cout << "hello" << endl;
}
int main() {
    greet();
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('hello')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 3: Function calling function ---
describe('functions & io: function calling function', () => {
  const code = `#include <iostream>
using namespace std;
int square(int x) {
    return x * x;
}
int sumOfSquares(int a, int b) {
    return square(a) + square(b);
}
int main() {
    cout << sumOfSquares(3, 4) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('25')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 4: Recursive function ---
describe('functions & io: recursive function', () => {
  const code = `#include <iostream>
using namespace std;
int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}
int main() {
    cout << factorial(5) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('120')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 5: Multiple print ---
describe('functions & io: multiple print', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    cout << "x = " << 42 << endl;
    cout << "y = " << 3.14 << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('x = ')
    expect(out).toContain('42')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 6: Multiple returns (abs_val) ---
describe('functions & io: multiple returns (abs_val)', () => {
  const code = `#include <iostream>
using namespace std;
int abs_val(int x) {
    if (x < 0) {
        return -x;
    }
    return x;
}
int main() {
    cout << abs_val(-5) << endl;
    cout << abs_val(3) << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('5')
    expect(out).toContain('3')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 7: Comment ---
describe('functions & io: comment', () => {
  const code = `#include <iostream>
using namespace std;
// This is a comment
int main() {
    // Another comment
    cout << "ok" << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('ok')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 8: Multiple includes ---
describe('functions & io: multiple includes', () => {
  const code = `#include <iostream>
#include <string>
using namespace std;
int main() {
    string s = "test";
    cout << s << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('test')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// --- Program 9: Function with no args ---
describe('functions & io: function with no args', () => {
  const code = `#include <iostream>
using namespace std;
int getAnswer() {
    return 42;
}
int main() {
    int x = getAnswer();
    cout << x << endl;
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

// --- Program 10: Nested function calls ---
describe('functions & io: nested function calls', () => {
  const code = `#include <iostream>
using namespace std;
int max2(int a, int b) {
    if (a > b) {
        return a;
    }
    return b;
}
int main() {
    int result = max2(max2(1, 5), max2(3, 2));
    cout << result << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('5')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})
