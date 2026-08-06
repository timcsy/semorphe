/**
 * 轉型運算（US1b）
 *
 * ## 這不是「還沒實作」，是「實作被關掉」
 *
 * 四個轉型概念在 `src/languages/cpp/../executors/functions.ts` 有能用的實作。
 * 而 `src/interpreter/interpreter.ts` 的「無執行行為」清單**在它們之後**才跑，
 * 用 `Map.set` 把它們蓋成空操作。
 *
 * 結果是 `static_cast<int>(3.9)` 得到的不是 3——而且沒有任何錯誤訊息。
 * 程式跑完、印出一個東西、而它是錯的。
 *
 * **修法是從清單刪掉那四行，不是新寫轉型邏輯。** 動手重寫的話會產生第五處
 * 註冊，而問題本來就是註冊太多處。
 *
 * 見 specs/053-declare-noop-execute/research.md F8
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'
import { registerCppSkipDeclarations } from '../../src/languages/cpp/generators'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  registerCppSkipDeclarations()
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
}, 60_000)

async function run(body: string): Promise<string> {
  const src = `#include <iostream>\nusing namespace std;\nint main(){ ${body} return 0; }\n`
  const tree = lifter.lift(tsParser.parse(src).rootNode as never) as SemanticNode
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 100000 })
  interp.setOutputCallback((s: string) => out.push(s))
  await interp.execute(tree)
  return out.join('')
}

describe('轉型運算：實作一直都在，只是被清單蓋掉', () => {
  it('static_cast<int>(3.9) 是 3，不是 void', async () => {
    expect(await run(`double d = 3.9; cout << static_cast<int>(d);`)).toBe('3')
  })

  it('static_cast 會截斷不會四捨五入', async () => {
    expect(await run(`double d = 3.1; cout << static_cast<int>(d);`)).toBe('3')
    expect(await run(`double d = 9.99; cout << static_cast<int>(d);`)).toBe('9')
  })

  it('dynamic_cast 有回傳值', async () => {
    expect(await run(`double d = 2.7; cout << dynamic_cast<int>(d);`)).toBe('2')
  })

  it('reinterpret_cast 有回傳值', async () => {
    expect(await run(`double d = 1.9; cout << reinterpret_cast<int>(d);`)).toBe('1')
  })

  it('const_cast 有回傳值', async () => {
    expect(await run(`int a = 5; const int c = a; cout << const_cast<int&>(c);`)).toBe('5')
  })

  it('轉型可以進運算式，不只是單獨印出來', async () => {
    expect(await run(`double d = 3.7; cout << static_cast<int>(d) + 1;`)).toBe('4')
  })

  it('★ 每個轉型概念只有一處註冊——重複註冊時勝負由載入順序決定', () => {
    const interp = new SemanticInterpreter({ maxSteps: 100 })
    for (const c of ['cpp_static_cast', 'cpp_dynamic_cast', 'cpp_reinterpret_cast', 'cpp_const_cast']) {
      const ex = interp.getExecutor(c)
      expect(ex, `${c} 完全沒有執行器`).toBeDefined()
    }
    // 勝出的必須是**會回傳值**的那個，不是空操作
    const dup = interp.duplicateRegistrations()
    const castDups = dup.filter((d) => d.concept.includes('cast'))
    expect(
      castDups,
      `轉型概念仍有重複註冊：${castDups.map((d) => `${d.concept}×${d.count}`).join('、')}` +
        '——勝負由載入順序決定，而那個順序不是任何人設計的',
    ).toEqual([])
  })
})
