/**
 * Phase 2 Roundtrip: Control Flow
 *
 * Covers control flow concepts:
 * if, if-else, if-else-if, while, for (count), for (general),
 * do-while, switch-case, break, continue
 *
 * Each program is tested for:
 * 1. execution correctness (via SemanticInterpreter)
 * 2. roundtrip stability (lift → generate → lift → generate, gen1 === gen2)
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

// ─── Program 1: Simple if ───
describe('control flow: simple if', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    if (x > 5) {
        cout << "big" << endl;
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('big')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 2: If-else ───
describe('control flow: if-else', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int x = 3;
    if (x % 2 == 0) {
        cout << "even" << endl;
    } else {
        cout << "odd" << endl;
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('odd')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 3: If-else-if chain ───
describe('control flow: if-else-if chain', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int score = 75;
    if (score >= 90) {
        cout << "A" << endl;
    } else if (score >= 80) {
        cout << "B" << endl;
    } else if (score >= 70) {
        cout << "C" << endl;
    } else {
        cout << "F" << endl;
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('C')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 4: While loop ───
describe('control flow: while loop', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int i = 1;
    int sum = 0;
    while (i <= 10) {
        sum = sum + i;
        i = i + 1;
    }
    cout << sum << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('55')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 5: Count loop (for) ───
describe('control flow: count loop (for)', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    for (int i = 1; i <= 5; i++) {
        cout << i << endl;
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('1')
    expect(out).toContain('2')
    expect(out).toContain('3')
    expect(out).toContain('4')
    expect(out).toContain('5')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 6: General for loop ───
describe('control flow: general for loop', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int sum = 0;
    for (int i = 0; i < 10; i = i + 2) {
        sum = sum + i;
    }
    cout << sum << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('20')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 7: Do-while ───
describe('control flow: do-while', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int n = 1;
    do {
        cout << n << endl;
        n = n * 2;
    } while (n <= 16);
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('1')
    expect(out).toContain('2')
    expect(out).toContain('4')
    expect(out).toContain('8')
    expect(out).toContain('16')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 8: Switch-case ───
describe('control flow: switch-case', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int day = 3;
    switch (day) {
        case 1:
            cout << "Mon" << endl;
            break;
        case 2:
            cout << "Tue" << endl;
            break;
        case 3:
            cout << "Wed" << endl;
            break;
        default:
            cout << "Other" << endl;
            break;
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('Wed')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 9: Break in loop ───
describe('control flow: break in loop', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    for (int i = 1; i <= 100; i++) {
        if (i * i > 50) {
            cout << i << endl;
            break;
        }
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('8')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 10: Continue in loop ───
describe('control flow: continue in loop', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    for (int i = 1; i <= 10; i++) {
        if (i % 3 == 0) {
            continue;
        }
        cout << i << " ";
    }
    cout << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('1 2 4 5 7 8 10')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 11: Nested control flow ───
describe('control flow: nested control', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    for (int i = 1; i <= 3; i++) {
        for (int j = 1; j <= 3; j++) {
            if (i == j) {
                cout << "*" << " ";
            } else {
                cout << "." << " ";
            }
        }
        cout << endl;
    }
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('* . .')
    expect(out).toContain('. * .')
    expect(out).toContain('. . *')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})

// ─── Program 12: Complex control flow (all concepts) ───
describe('control flow: complex combined', () => {
  const code = `#include <iostream>
using namespace std;
int main() {
    int total = 0;
    for (int i = 1; i <= 20; i++) {
        if (i % 2 == 0) {
            continue;
        }
        int j = i;
        while (j > 0) {
            total = total + j;
            j = j - 2;
        }
        if (total > 100) {
            break;
        }
    }
    cout << total << endl;
    int grade = 85;
    switch (grade / 10) {
        case 10:
            cout << "perfect" << endl;
            break;
        case 9:
            cout << "excellent" << endl;
            break;
        case 8:
            cout << "good" << endl;
            break;
        default:
            cout << "ok" << endl;
            break;
    }
    int count = 0;
    do {
        count = count + 1;
    } while (count < 5);
    cout << count << endl;
    return 0;
}`

  it('executes correctly', async () => {
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('140')
    expect(out).toContain('good')
    expect(out).toContain('5')
  })

  it('roundtrip is stable', () => {
    const gen1 = roundTrip(code)
    const gen2 = roundTrip(gen1)
    expect(gen1).toBe(gen2)
  })
})
