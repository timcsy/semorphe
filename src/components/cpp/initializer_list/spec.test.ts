/**
 * `cpp:initializer_list` 的自證測——每一條負向前面先釘一個正向。
 *
 * ## 這顆為什麼從 structural 升格
 *
 * 原本的理由逐字是「它是宣告的子節點、不獨立存在」——**而那句話只對辨識那一路成立**。
 * 積木那一路需要它獨立存在，否則 `{{1,2},{3,4}}` 表達不出來：外層需要接一顆內層，
 * 而插槽群沒有巢狀。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import apcs from '../../../languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const H = '#include <iostream>\n#include <vector>\nusing namespace std;\n'
const lift = (body: string): SemanticNode =>
  createTestLifter().lift(parser.parse(H + `int main(){ ${body} }`)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.children ?? {})) for (const k of ks) collect(k, out)
  return out
}
const run = async (body: string): Promise<string> => {
  const i = new SemanticInterpreter({ maxSteps: 100000 })
  await i.execute(lift(body))
  return i.getOutput().join('')
}

describe('膠囊自證：cpp:initializer_list', () => {
  it('★ lift：多維的內層是這顆身分，而且巢狀不被壓平', () => {
    const ids = collect(lift('int a[2][3] = {{1,2,3},{4,5,6}}; cout << a[1][2];'))
    expect(ids).toContain('cpp:initializer_list')   // ← 正向錨點
    expect(ids).not.toContain('raw_code')
    expect(ids).not.toContain('unresolved')
    // 兩層——外層兩顆，各自帶三個值
    expect(ids.filter((x) => x === 'cpp:initializer_list')).toHaveLength(2)
  })

  it('★ generate：產回巢狀的原樣', () => {
    const code = generateCode(
      lift('int a[2][3] = {{1,2,3},{4,5,6}}; cout << a[1][2];'),
      'cpp', apcs as unknown as StylePreset,
    )
    expect(code).toContain('int a[2][3] = {{1, 2, 3}, {4, 5, 6}}')
  })

  it('★ execute：多維讀得到', async () => {
    expect(await run('int a[2][3] = {{1,2,3},{4,5,6}}; cout << a[1][2];')).toBe('6')
  })

  it('★ execute：沒有型別脈絡時它就是一串值——不猜型別也不丟錯', async () => {
    // ⚠️ 消費者（`evalInitializer`）通常會先攔截它。這一支測的是**沒有被攔截**時，
    // 少了執行器會丟 `UNKNOWN_CONCEPT`——那會讓整段程式停住。
    expect(await run('struct P{int x;}; P p{7}; cout << p.x;')).toBe('7')
  })

  it('★ 一維仍然是一串值，不會被包成一顆（不得因為升格而改變樹形）', () => {
    const ids = collect(lift('int a[3] = {1,2,3}; cout << a[2];'))
    expect(ids, '一維的初始值直接掛在 values 上，沒有中間層').not.toContain('cpp:initializer_list')
    expect(ids).toContain('cpp:array_declare')
  })
})
