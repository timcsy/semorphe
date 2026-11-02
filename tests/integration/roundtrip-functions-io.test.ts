/**
 * Phase 3 Roundtrip: Functions & I/O
 *
 * Covers components:
 * func_def, func_call, func_call_expr, return, print, endl,
 * cpp_include, cpp_using_namespace, cpp_define,
 * comment, block_comment, doc_comment
 *
 * Each program is tested for:
 * 1. execution correctness (via Cella — spec 202：判準從 JS 直譯器換成 Cella)
 * 2. roundtrip stability (lift -> generate -> lift -> generate, gen1 === gen2)
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import { runCella, describeCellaResult, expectCellaOut } from '../helpers/cella-run'
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

/**
 * 執行交給 Cella（spec 202，重構 6c-2d）：走產品同一條 lift → formalize → Cella 判決。
 * 不是 accept（reject／unknown／翻不出）就丟出說得出原因的錯；回傳印出的全文。
 */
async function runCode(code: string): Promise<string> {
  const r = await runCella(code)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
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
    const out = await runCode(code)
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
    const out = await runCode(code)
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
    const out = await runCode(code)
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
    const out = await runCode(code)
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
    const out = await runCode(code)
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
    const out = await runCode(code)
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

  /**
   * 🎯 **2026-09-20：這根釘子拔掉了，而它已經死了一年多。**
   *
   * 它寫著阻斷者是「`#define` 巨集展開（墓碑）」，而**那個歸因本身就是錯的**：
   * `#define MAX_SIZE 100` 要的不是巨集展開，是**把一個具名常數綁進 scope**
   * ——而那件事 2026-08-13 就做了（`cpp:define` 的執行器）。
   *
   * ⚠️ 它是 `it.skip`（有本體），所以**修好的那天它不會變紅**
   * ——這正是缺陷帳自己定義的 `DEADSKIP`：**已修好卻沒開回來，白白損失覆蓋。**
   *
   * > **一根釘子如果把「這件事做不到」寫成「那座墓碑擋著」，
   * > 那麼做到的那天，沒有人會想到回來看它。**
   */
  it('executes correctly', async () => {
    const out = await runCode(code)
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
    const out = await runCode(code)
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

  // 🟢 spec 202 開回來：原本是被 cpp:block_comment 擋住的停用測試（阻斷者是 JS 直譯器裡 block_comment 的執行）。
  // 換成 Cella 判之後註解不進執行，整段 accept；期望值 g++ -std=c++17 實測 "comments work\ndone\n"
  it('executes correctly', async () => {
    await expectCellaOut(code, 'comments work\ndone\n')
  })

  // SKIP: block_comment P1 instability - lifter does not strip `* ` prefixes
  // added by code generator, causing prefix duplication on re-lift.
  // Also doc_comment `///` rendered as `// /`.
  // 阻斷者是 block_comment 的 lifter 沒有剝掉 `* ` 前綴，不是 print
  it('roundtrip is stable（block_comment 的 `* ` 前綴——2026-10-31 驗過已修）', () => {
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
    const out = await runCode(code)
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

/**
 * 🔴 **一般函式的回傳型別要一字不少**（spec 204，2026-11-02；main 上就壞，6c-2e 的盲測抓到）。
 *
 *   學生寫  string& k(string& s)        轉一圈（修之前）  string k(string& s)() {   ← 參考那一層沒剝，名字吞掉參數，編不過
 *   學生寫  const char* nameOf(int m)   轉一圈（修之前）  char* nameOf(int m)       ← 回傳型別前的 const 不見
 *   學生寫  static const char* h()      轉一圈（修之前）  char* h()                 ← static 與 const 都不見
 *
 * 類別成員那一條（liftMethodDef）第 218 刀修過同一件事，一般函式這條路沒有跟著修。
 * 斷言三件事：原文一字不差、第二趟不動點、身分仍是 cpp:func_def（不是降級成原文）——最後那支程式還交給 Cella 跑。
 * ⚠️ 這段註解刻意不用反引號：語料護欄（第三十一、三十二、七十二條）把反引號之間的文字當成程式收進分母（2026-09-19 那次「自己造的雜訊」）。
 */
describe('functions & io: 回傳型別的修飾與參考（spec 204）', () => {
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
  const heads = [
    'string& k(string& s)',
    'const string& g(const string& s)',
    'const char* nameOf(int m)',
    'static const char* h()',
    'static int m()',
    'inline int il()',
    'unsigned long long u()',
    'int** pp(int** x)',
  ]
  for (const head of heads) {
    it(`\`${head}\` 轉一圈原文一字不差、仍是 cpp:func_def`, () => {
      const code = `${H}${head} { throw 0; }\nint main() { return 0; }\n`
      const gen1 = roundTrip(code)
      expect(gen1, '🔴 修之前回傳型別的修飾會消失，參考會讓名字吞掉參數').toContain(`${head} {`)
      expect(roundTrip(gen1)).toBe(gen1)
      const ids = JSON.stringify(liftCode(code))
      expect(ids).toContain('"cpp:func_def"')
      expect(ids).not.toContain('raw_code')
    })
  }

  it('回傳參考的函式真的回傳那個物件（Cella 判）', async () => {
    await expectCellaOut(`${H}string& k(string& s) { s += "!"; return s; }\nstatic const char* h() { return "b"; }\nconst int c() { return 3; }\nint main() { string t = "hi"; k(t) += "?"; cout << t << h() << c(); return 0; }\n`, 'hi!?b3')
  })
})
