/**
 * Quickstart 的八個場景——執行判準是 Cella（spec 202，重構 6c-2d）。
 *
 * 原本這支用手搭的語義樹（`cpp:program` 底下直接放敘述、沒有 main）餵 JS 直譯器；
 * Cella 判的是一支完整的程式，所以每個場景改寫成它對應的 C++ 原始碼，走產品同一條 lift → formalize → 判決。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella, describeCellaResult } from '../helpers/cella-run'

/** 把 main 的本體包成完整程式 */
const program = (body: string, before = ''): string =>
  `#include <iostream>\nusing namespace std;\n${before}int main() {\n${body}\n    return 0;\n}\n`

// Quickstart 場景 1: Hello World
describe('Integration - Scenario 1: Hello World', () => {
  it('should print Hello World', async () => {
    await expectCellaOut(program('    cout << "Hello World";'), 'Hello World')
  })
})

// Quickstart 場景 2: 變數 + 算術 + 輸出
describe('Integration - Scenario 2: Variable + Arithmetic', () => {
  it('should compute x + y = 7', async () => {
    await expectCellaOut(program('    int x = 3;\n    int y = 4;\n    cout << x + y;'), '7')
  })
})

// Quickstart 場景 3: Input 讀取
describe('Integration - Scenario 3: Input Read', () => {
  it('should read input and compute n * 2 = 10', async () => {
    await expectCellaOut(program('    int n;\n    cin >> n;\n    cout << n * 2;'), '10', { stdin: '5' })
  })
})

// Quickstart 場景 4: 迴圈
describe('Integration - Scenario 4: Loop', () => {
  it('should print 1 to 5 with newlines', async () => {
    await expectCellaOut(program('    for (int i = 1; i <= 5; i++) {\n        cout << i << endl;\n    }'), '1\n2\n3\n4\n5\n')
  })
})

// Quickstart 場景 5: 遞迴函式
describe('Integration - Scenario 5: Recursive Function', () => {
  it('should compute factorial(5) = 120', async () => {
    const fn = 'int factorial(int n) {\n    if (n <= 1) {\n        return 1;\n    }\n    return n * factorial(n - 1);\n}\n'
    await expectCellaOut(program('    cout << factorial(5);', fn), '120')
  })
})

// Quickstart 場景 6: 逐步執行
// spec 202：原本斷言 JS 直譯器的 `executeWithSteps` 記下 4 步——那是直譯器自己的步數模型，Cella 沒有對應的量；
// 留下的是這支程式的輸出（逐步執行本身由 Cella 的除錯器負責，不在這支）
describe('Integration - Scenario 6: Step Execution', () => {
  it('a simple program prints 3', async () => {
    await expectCellaOut(program('    int a = 1;\n    int b = 2;\n    int c = a + b;\n    cout << c;'), '3')
  })
})

// Quickstart 場景 7: 無窮迴圈保護
describe('Integration - Scenario 7: Infinite Loop Protection', () => {
  it('stops at the step limit and says so (unknown / fuel), not accept', async () => {
    const r = await runCella(program('    while (1 > 0) {\n        int x = 0;\n    }'), { steps: 100 })
    expect(r.verdict, describeCellaResult(r)).toBe('unknown')
    expect(r.problems.map((p) => p.kind)).toContain('fuel')
  })
})

// Quickstart 場景 8: 執行期錯誤
describe('Integration - Scenario 8: Runtime Error', () => {
  it('rejects an undeclared variable, and says which', async () => {
    const r = await runCella(program('    cout << x;'))
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems.map((p) => p.reason).join('\n')).toMatch(/undeclared identifier 'x'/)
  })
})
