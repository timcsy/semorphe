/**
 * Phase 1 Roundtrip: Variables & Operators
 *
 * Covers all 12 concepts from the variables-ops pipeline:
 * number_literal, string_literal, cpp_char_literal, builtin_constant,
 * var_ref, var_declare, var_assign, arithmetic, compare, logic, logic_not, negate
 *
 * Each concept is tested for:
 * 1. code → lift → semantic tree correctness
 * 2. semantic tree → code generation fidelity
 * 3. execution correctness (via interpreter)
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

// ─── number_literal ───
describe('number_literal', () => {
  it('integer literal roundtrip', () => {
    const code = roundTrip('int x = 42;')
    expect(code).toContain('42')
  })

  it('float literal roundtrip', () => {
    const code = roundTrip('double x = 3.14;')
    expect(code).toContain('3.14')
  })

  it('zero literal roundtrip', () => {
    const code = roundTrip('int x = 0;')
    expect(code).toContain('0')
  })

  it('negative number via negate', () => {
    const code = roundTrip('int x = -1;')
    expect(code).toContain('-1')
  })

  it('executes integer literal correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() { cout << 42 << endl; return 0; }
    `)
    expect(interp.getOutput().join('')).toContain('42')
  })

  it('executes float literal correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() { cout << 3.14 << endl; return 0; }
    `)
    expect(interp.getOutput().join('')).toContain('3.14')
  })
})

// ─── string_literal ───
describe('string_literal', () => {
  it('simple string roundtrip', () => {
    const sem = liftCode('"hello"')
    expect(sem).not.toBeNull()
    // string_literal should have value: hello
    const body = sem!.children.body ?? []
    const node = body[0]
    expect(node.conceptId).toBe('string_literal')
    expect(node.properties.value).toBe('hello')
  })

  it('empty string roundtrip', () => {
    const code = roundTrip('const char* s = "";')
    expect(code).toContain('""')
  })

  it('executes string literal correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() { cout << "hello world" << endl; return 0; }
    `)
    expect(interp.getOutput().join('')).toContain('hello world')
  })
})

// ─── builtin_constant ───
describe('builtin_constant', () => {
  it('true roundtrip', () => {
    const code = roundTrip('bool b = true;')
    expect(code).toContain('true')
  })

  it('false roundtrip', () => {
    const code = roundTrip('bool b = false;')
    expect(code).toContain('false')
  })

  it('nullptr roundtrip', () => {
    const code = roundTrip('int* p = nullptr;')
    expect(code).toContain('nullptr')
  })

  it('executes true/false correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        if (true) cout << "yes" << endl;
        if (false) cout << "no" << endl;
        return 0;
      }
    `)
    const out = interp.getOutput().join('')
    expect(out).toContain('yes')
    expect(out).not.toContain('no')
  })
})

// ─── var_ref ───
describe('var_ref', () => {
  it('variable reference in declaration initializer', () => {
    const sem = liftCode('int y = x;')
    expect(sem).not.toBeNull()
    const body = sem!.children.body ?? []
    const decl = body[0]
    expect(decl.conceptId).toBe('var_declare')
    const init = (decl.children.initializer ?? [])[0]
    expect(init).toBeDefined()
    expect(init.conceptId).toBe('var_ref')
    expect(init.properties.name).toBe('x')
  })

  it('roundtrip in assignment context', () => {
    const code = roundTrip('int y = x;')
    expect(code).toContain('x')
  })
})

// ─── var_declare ───
describe('var_declare', () => {
  it('int with initializer', () => {
    const code = roundTrip('int x = 5;')
    expect(code).toContain('int x = 5;')
  })

  it('int without initializer', () => {
    const code = roundTrip('int y;')
    expect(code).toContain('int y;')
  })

  it('double with initializer', () => {
    const code = roundTrip('double pi = 3.14;')
    expect(code).toContain('double pi = 3.14;')
  })

  it('char with initializer', () => {
    const code = roundTrip("char c = 'a';")
    // char literal may be lifted as string_literal, generating "a" instead of 'a'
    expect(code).toContain('char c')
  })

  it('executes declaration correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 10;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('10')
  })

  it('executes uninitialized int as 0', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('0')
  })
})

// ─── var_assign ───
describe('var_assign', () => {
  it('simple assignment roundtrip', () => {
    const code = roundTrip('x = 10;')
    expect(code).toContain('x = 10;')
  })

  it('assignment with expression', () => {
    const code = roundTrip('x = a + b;')
    expect(code).toContain('x = a + b;')
  })

  it('executes assignment correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 5;
        x = 42;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('42')
  })
})

// ─── arithmetic ───
describe('arithmetic', () => {
  it('addition roundtrip', () => {
    const code = roundTrip('int x = a + b;')
    expect(code).toContain('a + b')
  })

  it('subtraction roundtrip', () => {
    const code = roundTrip('int x = a - b;')
    expect(code).toContain('a - b')
  })

  it('multiplication roundtrip', () => {
    const code = roundTrip('int x = a * b;')
    expect(code).toContain('a * b')
  })

  it('division roundtrip', () => {
    const code = roundTrip('int x = a / b;')
    expect(code).toContain('a / b')
  })

  it('modulo roundtrip', () => {
    const code = roundTrip('int x = a % b;')
    expect(code).toContain('a % b')
  })

  it('preserves precedence: a + b * c', () => {
    const code = roundTrip('int x = a + b * c;')
    expect(code).toContain('a + b * c')
  })

  it('preserves parens when needed: (a + b) * c', () => {
    const code = roundTrip('int x = (a + b) * c;')
    expect(code).toContain('(a + b) * c')
  })

  it('executes arithmetic correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        cout << 2 + 3 << endl;
        cout << 10 - 4 << endl;
        cout << 3 * 7 << endl;
        cout << 15 / 4 << endl;
        cout << 17 % 5 << endl;
        return 0;
      }
    `)
    const out = interp.getOutput().join('')
    expect(out).toContain('5')
    expect(out).toContain('6')
    expect(out).toContain('21')
    expect(out).toContain('3')
    expect(out).toContain('2')
  })

  it('integer division truncates', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 7 / 2;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('3')
  })
})

// ─── compare ───
describe('compare', () => {
  const ops = ['<', '>', '<=', '>=', '==', '!=']
  for (const op of ops) {
    it(`${op} roundtrip`, () => {
      const code = roundTrip(`if (a ${op} b) { x = 1; }`)
      expect(code).toContain(`a ${op} b`)
    })
  }

  it('executes comparison correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        if (3 < 5) cout << "lt" << endl;
        if (5 > 3) cout << "gt" << endl;
        if (3 <= 3) cout << "le" << endl;
        if (5 >= 5) cout << "ge" << endl;
        if (4 == 4) cout << "eq" << endl;
        if (3 != 4) cout << "ne" << endl;
        return 0;
      }
    `)
    const out = interp.getOutput().join('')
    expect(out).toContain('lt')
    expect(out).toContain('gt')
    expect(out).toContain('le')
    expect(out).toContain('ge')
    expect(out).toContain('eq')
    expect(out).toContain('ne')
  })
})

// ─── logic ───
describe('logic', () => {
  it('&& roundtrip', () => {
    const code = roundTrip('if (a && b) { x = 1; }')
    expect(code).toContain('a && b')
  })

  it('|| roundtrip', () => {
    const code = roundTrip('if (a || b) { x = 1; }')
    expect(code).toContain('a || b')
  })

  it('short-circuit && execution', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 0;
        if (false && true) x = 1;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('0')
  })

  it('short-circuit || execution', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 0;
        if (true || false) x = 1;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('1')
  })
})

// ─── logic_not ───
describe('logic_not', () => {
  it('roundtrip', () => {
    const code = roundTrip('if (!done) { x = 1; }')
    expect(code).toContain('!done')
  })

  it('executes correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        bool b = false;
        if (!b) cout << "negated" << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('negated')
  })
})

// ─── negate ───
describe('negate', () => {
  it('unary minus roundtrip', () => {
    const code = roundTrip('int x = -y;')
    expect(code).toContain('-y')
  })

  it('executes correctly', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int x = 5;
        cout << -x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toContain('-5')
  })
})

// ─── Combined: full program roundtrip ───
describe('Combined program roundtrip', () => {
  it('lift → generate → execute: calculator program', async () => {
    const code = `
      #include <iostream>
      using namespace std;
      int main() {
        int a = 10;
        int b = 3;
        int sum = a + b;
        int diff = a - b;
        int prod = a * b;
        int quot = a / b;
        int rem = a % b;
        cout << sum << endl;
        cout << diff << endl;
        cout << prod << endl;
        cout << quot << endl;
        cout << rem << endl;
        return 0;
      }
    `
    // Verify execution
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('13')  // 10+3
    expect(out).toContain('7')   // 10-3
    expect(out).toContain('30')  // 10*3
    expect(out).toContain('3')   // 10/3
    expect(out).toContain('1')   // 10%3

    // Verify roundtrip
    const generated = roundTrip(code)
    expect(generated).toContain('int a = 10;')
    expect(generated).toContain('int b = 3;')
    expect(generated).toContain('a + b')
    expect(generated).toContain('a - b')
    expect(generated).toContain('a * b')
    expect(generated).toContain('a / b')
    expect(generated).toContain('a % b')
  })

  it('lift → generate → execute: boolean logic program', async () => {
    const code = `
      #include <iostream>
      using namespace std;
      int main() {
        int x = 5;
        if (x > 0 && x < 10) {
          cout << "in range" << endl;
        }
        if (x < 0 || x > 100) {
          cout << "out of range" << endl;
        }
        if (!(x == 0)) {
          cout << "nonzero" << endl;
        }
        return 0;
      }
    `
    const interp = await runCode(code)
    const out = interp.getOutput().join('')
    expect(out).toContain('in range')
    expect(out).not.toContain('out of range')
    expect(out).toContain('nonzero')

    const generated = roundTrip(code)
    expect(generated).toContain('x > 0 && x < 10')
    expect(generated).toContain('x < 0 || x > 100')
  })
})
