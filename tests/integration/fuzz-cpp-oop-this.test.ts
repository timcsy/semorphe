/**
 * **模糊測試：C++ 物件導向裡的 `this`**（元件管線 311，2026-11-06）
 *
 * 十支程式由隔離的出題者寫（不知道 semorphe 的實作），預期輸出由本機 clang（專案的標頭墊片）跑出來、存在
 * `tests/fixtures/fuzz-cpp-oop-this.json`。報告：`tests/reports/fuzz-cpp-oop-this-20261106.md`。
 *
 * - `this` 本身：十支、104 處，**零降級**、再 lift 零漂移。
 * - 修好的：`Rect("A", 3, 4)` 建暫時物件被送成「呼叫一個叫 Rect 的函式」→ Cella 判「找不到 Rect」（P6）。現在送 `eTemp`。
 * - 盲測另外抓到五個本來就在、與 `this` 無關的缺陷（A 前置宣告、B gcd 的寫法、E 經過指標的 push、F new 樣板型別、G new 的空括號），都修了、各一支測試。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { expectCellaOut } from '../helpers/cella-run'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const PROGS = JSON.parse(readFileSync(`${process.cwd()}/tests/fixtures/fuzz-cpp-oop-this.json`, 'utf8')) as { id: string; code: string; expected: string }[]
const S = apcs as unknown as StylePreset
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const ids = (n: SemanticNode, o: string[] = []): string[] => { o.push(n.componentId); for (const k of Object.values(n.slots ?? {})) for (const c of k) ids(c, o); return o }
const shape = (n: SemanticNode): unknown => [n.componentId, n.properties, Object.fromEntries(Object.entries(n.slots ?? {}).map(([k, v]) => [k, v.map(shape)]))]
const prog = (id: string) => PROGS.find((p) => p.id === id)!

describe('模糊測試：C++ 物件導向裡的 this', () => {
  it('入口條件：十支都在', () => { expect(PROGS).toHaveLength(10) })

  it.each(PROGS.map((p) => [p.id, p]))('★ %s：this 都認得（元件身分）、除了前置宣告零降級、再 lift 不漂移', (_id, p) => {
    const t = lift((p as { code: string }).code)
    const all = ids(t)
    expect(all.filter((i) => i === 'cpp:this').length).toBeGreaterThan(0)
    // 唯一容許的降級：類別的前置宣告（`class X;`）——刻意照實降級（缺陷 A，見下面）
    const degraded: string[] = []
    const walk = (n: SemanticNode): void => {
      if (/raw_code|unresolved|raw_expression/.test(n.componentId)) {
        const raw = String(n.metadata?.rawCode ?? '')
        if (!/^(class|struct)\s+\w+\s*;$/.test(raw.trim())) degraded.push(raw.slice(0, 60))
      }
      for (const k of Object.values(n.slots ?? {})) for (const c of k) walk(c)
    }
    walk(t)
    expect(degraded).toEqual([])
    expect(shape(lift(generateCode(t, 'cpp', S)))).toEqual(shape(t))
  })

  it('★ Cella：this 用法齊全的那一支（Thermostat）判 accept、輸出與 clang 相同', async () => {
    await expectCellaOut(prog('fuzz_5').code, prog('fuzz_5').expected)
  })

  it('🔴 修好的：Rect("A", 3, 4) 是建暫時物件，不是呼叫函式——Cella 判 accept、輸出與 clang 相同', async () => {
    await expectCellaOut(prog('fuzz_8').code, prog('fuzz_8').expected)
  })

  /**
   * 缺陷 A（本來就在）：前置宣告 `class Account;` 原本被產成空的**定義** `class Account { };`——後面的定義成了重複定義。
   * 修法是照實降級（還沒有「只宣告、之後再定義」的元件）：原文連同分號照抄；路線圖〈類別的前置宣告〉。
   */
  it('🔴 修好的 A：前置宣告產回去仍是前置宣告（fuzz_4、fuzz_6、fuzz_9 的開頭）', () => {
    const out = generateCode(lift('class A;\nstruct B;\nint main() {\n}\n'), 'cpp', S)
    expect(out).toContain('class A;')
    expect(out).toContain('struct B;')
    expect(out).not.toMatch(/class A \{/)
  })

  /**
   * 缺陷 B（本來就在）：`gcd`／`std::gcd` 原本被收進 `__gcd` 那顆、產碼一律寫 `__gcd`——改了學生的字，而兩者意思不同（負數）。
   * 修法：只有 `__gcd` 進那顆；其餘是一般的函式呼叫，原字照產。
   */
  it('🔴 修好的 B：gcd、std::gcd、__gcd 各自照原字產回去（fuzz_7）', () => {
    const out = generateCode(lift('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    cout << gcd(12, 18) << std::gcd(4, 6) << __gcd(9, 6);\n}\n'), 'cpp', S)
    expect(out).toContain('gcd(12, 18) << std::gcd(4, 6) << __gcd(9, 6)')
  })

  /** 缺陷 E（本來就在）：經過指標呼叫一個叫 push 的方法（`this->push(v)`、`q->push(3)`）被認成「推入容器」，產回去是 `this.push(v)`。 */
  it('🔴 修好的 E：經過指標的 push 照原樣（箭頭）產回去，而且 Cella 判得出（fuzz_9）', async () => {
    const src = '#include <bits/stdc++.h>\nusing namespace std;\nstruct S {\n    int a;\n    S& push(int v) {\n        a = v;\n        return *this;\n    }\n    S& d() {\n        return this->push(2);\n    }\n    S& e(S* q) {\n        return q->push(3);\n    }\n};\nint main() {\n    S s;\n    S t;\n    s.d();\n    s.e(&t);\n    cout << s.a << t.a;\n}\n'
    const out = generateCode(lift(src), 'cpp', S)
    expect(out).toContain('return this->push(2);')
    expect(out).toContain('return q->push(3);')
    await expectCellaOut(src, '23')
  })

  /** 缺陷 F（本來就在）：`new vector<int>()` 的型別找不到 ⟹ 安靜地變成 `int`，Cella 判「int * 不能轉成 vector<int> *」（P6）。 */
  it('🔴 修好的 F：new 樣板型別的型別不再變成 int', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    vector<int>* vp = new vector<int>();\n    vp->push_back(1);\n    cout << vp->size();\n}\n', '1')
  })

  /** 缺陷 G（本來就在）：`new int()`（值初始化成 0）產回去成了 `new int`（值未定）。 */
  it('🔴 修好的 G：new int() 的空括號留著——值是 0；new int 的值未定（Cella 判用到還沒有值）', async () => {
    expect(generateCode(lift('int main() {\n    int* q = new int();\n}\n'), 'cpp', S)).toContain('new int();')
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int* q = new int();\n    cout << *q;\n}\n', '0')
  })
})

describe('修好的：建構子與方法的參數預設值（盲測 fuzz_7 抓到）', () => {
  it.each([
    ['建構子', 'struct P {\n    int x;\n    P(int a = 3) : x(a) {\n    }\n};\n', 'P(int a = 3)'],
    ['方法', 'struct P {\n    int x;\n    int g(int k = 5) {\n        return k;\n    }\n};\n', 'int g(int k = 5)'],
  ])('★ %s的預設值產回去還在', (_n, src, want) => {
    expect(generateCode(lift(src), 'cpp', S)).toContain(want)
  })
  it('★ 執行：只給一個引數，用到預設值', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nstruct P {\n    int x, y;\n    P(int a = 1, int b = 2) : x(a), y(b) {}\n};\nint main() {\n    P p(5);\n    cout << p.x << p.y;\n}\n', '52')
  })
})

describe('修好的：建構子與方法的預設值交給 Cella', () => {
  it('★ 方法的預設值：p.g() 用到預設值（原本預設值被靜靜丟掉，會被判引數太少）', async () => {
    await expectCellaOut('#include <bits/stdc++.h>\nusing namespace std;\nstruct P {\n    int g(int k = 5) {\n        return k * 2;\n    }\n};\nint main() {\n    P p;\n    cout << p.g() << p.g(1);\n}\n', '102')
  })
})
