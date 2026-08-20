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
import { SemanticInterpreter } from '../../../interpreter/interpreter'
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
  for (const kids of Object.values(n.children ?? {})) for (const k of kids as SemanticNode[]) ids(k, out)
  return out
}

async function run(code: string): Promise<string> {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(code) as SemanticNode)
  return i.getOutput().join('')
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

  it('★ 裸名仍然叫得到——沒有名稱隔離的另一面', async () => {
    // ⚠️ 這在真的 C++ 裡是錯的（要 using 或限定），而在這個直譯器裡**刻意**成立。
    // 釘住它，是因為它是上面那條退回查找的前提；哪天要做真的隔離，這支會紅，
    // 而那時該紅——它在說「你正在改變一個被依賴的設計」。
    expect(await run(`${head}namespace Math {\n  int square(int x){ return x * x; }\n}\nint main(){ cout << square(4) << endl; return 0; }`)).toBe(
      '16\n',
    )
  })

  it('🔴 反向：不存在的限定名仍然要報錯——退回查找不得吞掉錯誤', async () => {
    // 沒有這一支的話，一個「限定名一律當成成功」的實作也會通過上面全部。
    await expect(run(`${head}namespace Math {\n  int square(int x){ return x * x; }\n}\nint main(){ cout << Math::cube(5); return 0; }`)).rejects.toThrow()
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
