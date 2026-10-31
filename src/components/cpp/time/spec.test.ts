/**
 * `cpp:time` 的自證測——`time(0)`：現在的時間（秒）。
 *
 * 🔴 這一顆存在的理由是**標頭**：`time(0)` 原本落到通用的函式呼叫，相依解析只認元件身分，
 *    `<ctime>` 從來補不到（使用者 2026-10-31，設計 draft 五之六）。所以補丁器那一條是主角。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../../tests/helpers/setup-lifter'
import { registerCppLanguage } from '../../../languages/cpp/generators'
import { SemanticInterpreter } from '../../../interpreter/interpreter'
import { generateCode } from '../../../core/projection/code-generator'
import { createCppCodePatcher } from '../../../languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../../languages/cpp/std'
import { renderToBlocklyState } from '../../../core/projection/block-renderer'
import { setupTestRenderer } from '../../../../tests/helpers/setup-renderer'
import apcs from '../../../languages/cpp/styles/apcs.json'
import cStyle from '../../../languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../../core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode
const collect = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) collect(k, out)
  return out
}
const SEED = 'int main() { srand(time(0)); return 0; }'

describe('膠囊自證：cpp:time', () => {
  it('★ lift：`time(0)` 是這一顆', () => {
    expect(collect(lift(SEED))).toContain('cpp:time')
  })

  it('★ 只認 time(0)：其他寫法照舊是通用的函式呼叫，學生寫的文字不變', () => {
    expect(collect(lift(SEED)), '正向錨點：time(0) 認得到').toContain('cpp:time')
    for (const src of ['time(NULL)', 'time(nullptr)', 'std::time(0)']) {
      const code = `int main() { srand(${src}); return 0; }`
      expect(collect(lift(code)), src).not.toContain('cpp:time')
      expect(generateCode(lift(code), 'cpp', apcs as unknown as StylePreset), src).toContain(src)
    }
  })

  it('★ generate 與 round-trip：產回 time(0)，再 lift 還是這一顆', () => {
    const code = generateCode(lift(SEED), 'cpp', apcs as unknown as StylePreset)
    expect(code).toContain('srand(time(0));')
    expect(collect(lift(code))).toContain('cpp:time')
  })

  it('🔴 補丁器補得到 <ctime>（C 方言是 <time.h>）——這一顆存在的理由', () => {
    const tree = lift(SEED)
    const patch = createCppCodePatcher(createPopulatedRegistry() as never)
    const cpp = patch(generateCode(tree, 'cpp', apcs as unknown as StylePreset), tree, 'using', 1, 'main') ?? ''
    expect(cpp).toContain('#include <ctime>')
    const c = patch(generateCode(tree, 'cpp', cStyle as unknown as StylePreset), tree, 'explicit', 1, 'main', 'c') ?? ''
    expect(c).toContain('#include <time.h>')
    expect(c).not.toContain('<ctime>')
  })

  it('★ execute：回傳現在的秒數（與 JavaScript 的時鐘相差不到幾秒）', async () => {
    const i = new SemanticInterpreter({ maxSteps: 10_000 })
    await i.execute(lift('#include <iostream>\nusing namespace std;\nint main() { cout << time(0); return 0; }'))
    const printed = Number(i.getOutput().join(''))
    expect(printed, '印出來的要是一個數').not.toBeNaN()
    expect(Math.abs(printed - Math.floor(Date.now() / 1000))).toBeLessThan(5)
  })

  it('★ 積木渲染：`srand(time(0))` 的種子插槽裡是一塊「現在的時間」，不是通用的呼叫積木', () => {
    const state = renderToBlocklyState(lift(SEED)) as unknown as { blocks: { blocks: unknown[] } }
    const types: string[] = []
    const walk = (b: unknown): void => {
      if (!b || typeof b !== 'object') return
      const o = b as Record<string, unknown>
      if (typeof o.type === 'string') types.push(o.type)
      for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v)
    }
    walk(state.blocks.blocks)
    expect(types, '正向錨點：種子那塊在').toContain('cpp_random_seed')
    expect(types).toContain('cpp_time')
    expect(types).not.toContain('cpp_func_call_expression')
  })
})
