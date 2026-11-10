/**
 * `cpp:namespace_def` 的**自證測**——**沒有名稱隔離是設計，不是缺陷**
 *
 * ## 這裡放什麼
 *
 * 這顆的執行器只有一行（`await ctx.executeBody(...)`），而它的註解逐字說
 * 「這個直譯器**沒有名稱隔離**，本體直接跑」。那句話有一個**沒有被寫下來的
 * 後果**：`namespace Math` 裡的 `square` 登記成裸名 `square`，
 * 而呼叫端拿到的是 `Math::square`——**兩端對不起來**。
 *
 * 症狀是 `UNDEFINED_FUNC`，而它在第三十二條護欄的 18 段缺口裡佔了 **2 段**。
 *
 * > **一個設計決定如果只寫在一端的註解裡，另一端不會知道。**
 *
 * 2026-08-13 補上 `cpp:func_call` 的退回查找。這一組測試釘的就是那個對接。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { runCella, describeCellaResult, expectCellaOut } from '../../../../tests/helpers/cella-run'
import type { Lifter } from '../../../core/lift/lifter'
import type { SemanticNode } from '../../../core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

const lift = (code: string): SemanticNode | null => lifter.lift(tsParser.parse(code)!.rootNode as never)

function ids(n: SemanticNode | null, out = new Set<string>()): Set<string> {
  if (!n) return out
  out.add(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

// spec 200（重構 6c-2b）：執行的判準從 JS 直譯器換成 Cella——不是 accept 就丟出說得出原因的判決描述
async function run(code: string): Promise<string> {
  const r = await runCella(code)
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  return r.out
}

const head = '#include <iostream>\nusing namespace std;\n'


describe('cpp:namespace_def', () => {
  it('★ 正向錨點：這段碼真的產生了 cpp:namespace_def', () => {
    expect(ids(lift(`${head}namespace M { int f(){ return 1; } }\nint main(){ return 0; }`))).toContain('cpp:namespace_def')
  })

  it('限定名呼叫得到——這 2 段是第三十二條護欄的缺口', async () => {
    expect(
      await run(`${head}namespace Math {\n  int square(int x){ return x * x; }\n}\nint main(){ cout << Math::square(5) << endl; return 0; }`),
    ).toBe('25\n')
  })

  it('同一個 namespace 裡多個函式', async () => {
    expect(
      await run(
        `${head}namespace Math {\n  int add(int a, int b){ return a + b; }\n  int multiply(int a, int b){ return a * b; }\n}\nint main(){ cout << Math::add(2, 3) << endl; cout << Math::multiply(2, 3) << endl; return 0; }`,
      ),
    ).toBe('5\n6\n')
  })

  it('🔴 裸名【叫不到】——namespace 的名字是隔離的', async () => {
    // spec 200：這一條原本斷言「裸名叫得到」——那是 JS 直譯器**刻意**做錯的地方（它的註解逐字寫著「這在真的 C++ 裡是錯的」），
    // 用來撐住它的退回查找。換成 Cella 之後改成 C++ 的答案：`square` 沒有在全域宣告，要被判 reject。
    const r = await runCella(`${head}namespace Math {\n  int square(int x){ return x * x; }\n}\nint main(){ cout << square(4) << endl; return 0; }`)
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(describeCellaResult(r)).toMatch(/undeclared|square/)
  })

  it('🔴 反向：不存在的限定名仍然要報錯——退回查找不得吞掉錯誤', async () => {
    // 沒有這一支的話，一個「限定名一律當成成功」的實作也會通過上面全部。
    const r = await runCella(`${head}namespace Math {\n  int square(int x){ return x * x; }\n}\nint main(){ cout << Math::cube(5); return 0; }`)
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(describeCellaResult(r), '要指名那個不存在的名字').toMatch(/cube/)
  })

  it('🔴 反向：完整名優先於裸名', async () => {
    // 兩個都存在時拿完整名那一份。⚠️ 今天沒有任何地方用完整名登記，
    // 所以這一支測的是「順序寫對了」而不是一個活的情境——
    // 而順序寫反的話，上面那支「裸名叫得到」仍然會綠。
    expect(
      await run(`${head}int square(int x){ return x + 100; }\nnamespace Math {\n  int helper(int x){ return x * x; }\n}\nint main(){ cout << Math::helper(5) << endl; cout << square(5) << endl; return 0; }`),
    ).toBe('25\n105\n')
  })
})

describe('命名空間裡的類別當型別（盲測 fuzz_9：ds::Item）', () => {
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
  const NS = 'namespace ds { struct Item { int w; }; }\n'
  it.each([
    ['區域變數', 'ds::Item it; it.w = 3; cout << it.w;', '3'],
    ['new 與指標', 'ds::Item* p = new ds::Item; p->w = 1; cout << p->w; delete p;', '1'],
    ['容器的元素型別', 'vector<ds::Item> v(2); v[0].w = 7; cout << v[0].w;', '7'],
  ])('★ %s', async (_n, body, want) => {
    await expectCellaOut(`${H}${NS}int main() { ${body} return 0; }`, want)
  }, 120_000)

  it('★ 參數與兩層命名空間', async () => {
    await expectCellaOut(`${H}${NS}int get(const ds::Item& i) { return i.w; }\nint main() { ds::Item x; x.w = 5; cout << get(x); return 0; }`, '5')
    await expectCellaOut(`${H}namespace a { namespace b { struct T { int w; }; } }\nint main() { a::b::T x; x.w = 3; cout << x.w; return 0; }`, '3')
  }, 120_000)

  it('★ 沒有定義的限定名照實標翻不出，不猜', async () => {
    const r = await runCella(`${H}${NS}int main() { ds::Nope x; return 0; }`)
    expect(r.verdict).toBe('untranslated')
    expect(r.untranslated.map((u) => u.reason).join()).toContain('ds::Nope')
  }, 120_000)
})
