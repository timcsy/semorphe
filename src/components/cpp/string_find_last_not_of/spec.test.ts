/**
 * `cpp:string_find_last_not_of` 的自證測。
 *
 * ## 這一顆搬家順帶治了一個病
 *
 * 它原本與 `find_first_not_of` 共用 `lifters/io.ts` 的一個 case，
 * 而**身分是樣板字串組出來的**（`` createNode(`cpp:string_${method}`) ``）。
 * 那一行的註解記著它害過一次：**模板字串組出來的身分，掃描器看不到**
 * ——命名空間遷移時它還組著舊前綴，於是兩顆概念**安靜地建不出來**。
 *
 * → 現在身分是**字面字串**，寫在 `lift.ts` 裡登錄給共用路由器。
 *
 * ⚠️ 每一條負向前面先釘一個正向：**空集合也會讓 `not.toContain` 過。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { createNode } from '../../../core/semantic-tree'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

function 身分們(src: string): string[] {
  const 樹 = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
  const out: string[] = []
  const 走 = (n: SemanticNode) => {
    out.push(n.conceptId)
    for (const kids of Object.values(n.children ?? {})) for (const k of kids) 走(k as SemanticNode)
  }
  走(樹)
  return out
}

const 程式 = `#include <iostream>
#include <string>
using namespace std;
int main() { string s = "hi  "; cout << s.find_last_not_of(" "); }`

describe('膠囊自證：cpp:string_find_last_not_of', () => {
  it('★ lift：身分由膠囊登錄，而且是字面字串', () => {
    expect(身分們(程式)).toContain('cpp:string_find_last_not_of')
  })

  it('★ lift 不亂報：沒有這個方法的程式不該產出它', () => {
    const 別的 = 身分們('int main() { int x = 1; }')
    expect(別的).toContain('cpp:var_declare')          // ← 先證明量到了東西
    expect(別的).not.toContain('cpp:string_find_last_not_of')
  })

  // ⚠️ 這一支在搬家前是**紅的**：這顆身分沒有產生器（實測過），
  // 而它看不見的原因是身分由樣板字串組出來。見 `generate.ts` 檔頭。
  it('★ generate：產回 s.find_last_not_of(...)', () => {
    const 樹 = createNode('cpp:program', {}, {
      body: [createNode('cpp:string_find_last_not_of', { obj: 's' }, {
        arg: [createNode('cpp:literal_string', { value: ' ' })],
      })],
    })
    expect(generateCode(樹, 'cpp', apcs as unknown as StylePreset)).toContain('s.find_last_not_of(')
  })

  it('★ execute："hi  " 去空白的位置是 1', async () => {
    const 樹 = createTestLifter().lift(parser.parse(程式)!.rootNode as never) as SemanticNode
    expect(JSON.stringify(樹)).toContain('cpp:string_find_last_not_of')  // ← 先證明它進了樹
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(樹)
    expect(i.getOutput().join('').trim()).toBe('1')
  })

  it('★ execute：全部都在集合裡時回 -1（不是 npos）', async () => {
    const 樹 = createTestLifter().lift(parser.parse(
      `#include <iostream>\n#include <string>\nusing namespace std;\nint main() { string s = "   "; cout << s.find_last_not_of(" "); }`,
    )!.rootNode as never) as SemanticNode
    const i = new SemanticInterpreter({ maxSteps: 100000 })
    await i.execute(樹)
    expect(i.getOutput().join('').trim()).toBe('-1')
  })
})
