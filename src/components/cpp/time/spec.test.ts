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
import { runCella, describeCellaResult } from '../../../../tests/helpers/cella-run'
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

  /**
   * 🔴 原本斷言「與 JavaScript 的時鐘相差不到幾秒」——那量的是 JS 直譯器去讀牆上時鐘。
   * Cella 是確定性的判決：實測 `time(0)` 回 0，並在判決的 `assumes` 裡記下 `{ environment, time.now }`
   * ——「現在幾點」是環境給的，判決不假裝知道，而是把這個假設說出來。
   * 所以斷言改成三個說得出道理的性質：
   *   ① 判決記下「現在的時間由環境決定」這個假設（這是判決誠實的地方；少了它，固定值就是在說謊）；
   *   ② 印出來的是一個非負整數（time_t 的秒數）；
   *   ③ 時間不倒退：先後兩次呼叫，後一次不小於前一次。
   * ⚠️ 刻意不斷言「是 0」：那是 Cella 選的代表值，不是 time() 的語義。
   */
  it('★ execute：判決說出「現在的時間由環境決定」，回傳非負的秒數、而且不倒退', async () => {
    const r = await runCella('#include <iostream>\n#include <ctime>\nusing namespace std;\nint main() { long a = time(0); long b = time(0); cout << a << " " << (b - a); return 0; }')
    expect(r.verdict, describeCellaResult(r)).toBe('accept')
    expect(r.assumes, '🔴 判決沒有記下 time.now 這個環境假設').toContainEqual({ implementation: 'environment', choice: 'time.now' })
    const [a, diff] = r.out.split(' ')
    expect(a, '印出來的要是一個非負整數').toMatch(/^\d+$/)
    expect(Number(diff), '時間倒退了').toBeGreaterThanOrEqual(0)
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
