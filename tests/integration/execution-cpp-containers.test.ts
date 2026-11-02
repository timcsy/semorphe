/**
 * Stack 與 Queue 的執行語義：Stack 是 LIFO、Queue 是 FIFO。
 *
 * 🔴 spec 198（重構 6c-1）：判準從 JS 直譯器換成 Cella（`tests/helpers/cella-run.ts`）。
 * 原本是**手搭語義樹**交給直譯器跑——換成程式碼字串之後，同一條斷言多守了一件事：
 * lift 與 formalize 有沒有把這段程式翻對（6c 測試盤點的風險 3：手搭樹的語義在拆掉直譯器後要有程式碼字串接手）。
 * 斷言也從 `toContain` 收緊成完整輸出。
 */
// ⚠️ 091：C++ 的 `cout << (x > 2)` 印出 **1／0**，不是 `true`／`false`（後者要 `std::boolalpha`）。
import { describe, it } from 'vitest'
import { expectCellaOut } from '../helpers/cella-run'

const program = (decl: string, body: string): string =>
  `#include <iostream>\n#include <stack>\n#include <queue>\nusing namespace std;\nint main() {\n    ${decl}\n${body}\n    return 0;\n}\n`

const pushAll = (c: string, xs: number[]): string => xs.map((x) => `    ${c}.push(${x});`).join('\n')

// ─── Stack (LIFO) ─────────────────────────────────────────────────────────────

describe('Stack execution (LIFO)', () => {
  it('top() returns the last pushed element', async () => {
    await expectCellaOut(program('stack<int> s;', `${pushAll('s', [10, 20, 30])}\n    cout << s.top();`), '30')
  })

  it('pop() removes the top element (LIFO order)', async () => {
    await expectCellaOut(program('stack<int> s;', `${pushAll('s', [10, 20, 30])}\n    s.pop();\n    cout << s.top();`), '20')
  })

  it('empty() returns true on empty stack, false after push', async () => {
    await expectCellaOut(program('stack<int> s;', '    cout << s.empty();'), '1')
    await expectCellaOut(program('stack<int> s;', '    s.push(1);\n    cout << s.empty();'), '0')
  })

  it('drain loop prints in LIFO order (30 20 10)', async () => {
    await expectCellaOut(program('stack<int> s;', `${pushAll('s', [10, 20, 30])}\n    while (!s.empty()) {\n        cout << s.top() << "\\n";\n        s.pop();\n    }`), '30\n20\n10\n')
  })
})

// ─── Queue (FIFO) ─────────────────────────────────────────────────────────────

describe('Queue execution (FIFO)', () => {
  it('front() returns the first pushed element', async () => {
    await expectCellaOut(program('queue<int> q;', `${pushAll('q', [10, 20, 30])}\n    cout << q.front();`), '10')
  })

  it('pop() removes the front element (FIFO order)', async () => {
    await expectCellaOut(program('queue<int> q;', `${pushAll('q', [10, 20, 30])}\n    q.pop();\n    cout << q.front();`), '20')
  })

  it('empty() returns true on empty queue, false after push', async () => {
    await expectCellaOut(program('queue<int> q;', '    cout << q.empty();'), '1')
    await expectCellaOut(program('queue<int> q;', '    q.push(1);\n    cout << q.empty();'), '0')
  })

  it('drain loop prints in FIFO order (10 20 30)', async () => {
    await expectCellaOut(program('queue<int> q;', `${pushAll('q', [10, 20, 30])}\n    while (!q.empty()) {\n        cout << q.front() << "\\n";\n        q.pop();\n    }`), '10\n20\n30\n')
  })

  it('queue and stack with same values produce opposite drain orders', async () => {
    await expectCellaOut(program('stack<int> s;', `${pushAll('s', [1, 2, 3])}\n    while (!s.empty()) {\n        cout << s.top() << "\\n";\n        s.pop();\n    }`), '3\n2\n1\n')
    await expectCellaOut(program('queue<int> q;', `${pushAll('q', [1, 2, 3])}\n    while (!q.empty()) {\n        cout << q.front() << "\\n";\n        q.pop();\n    }`), '1\n2\n3\n')
  })
})
