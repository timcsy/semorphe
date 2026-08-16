/**
 * **探測（不是護欄）**：把「我們的判定」導出成 `/tmp/ours.json`，
 * 給 `tools/clangd-oracle/run.mjs` 當左半邊。
 *
 * ## 為什麼分兩支
 *
 * 我們的閘門跑在 node，clangd 跑在瀏覽器的 worker 裡（它 build 時只開了
 * `worker` 環境）。**兩邊沒有一個共同的執行環境**，所以用一份 JSON 接。
 *
 * ## ⚠️ 沒有斷言，這是刻意的
 *
 * 「我們擋下幾筆」**沒有目標值**——有些放行是對的（`unsupported` 是我們
 * 還沒長到，該跑）。`概念/執行機構`「量測工具有三種」：
 *
 * > **這個量有沒有目標值？沒有 → 探針，靠看報表推動。
 * > 硬把沒有目標值的量做成護欄，會逼人去湊一個目標。**
 *
 * 唯一的斷言是**入口條件**（樣本數），錨在合成量上。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { writeFileSync } from 'node:fs'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { canExecute } from '../../src/core/diagnostics'
import { H, COMPETITIVE, APCS_CORPUS, ARDUINO } from './scenario-corpus'
import type { SemanticNode } from '../../src/core/types'

/** 第一課的成品，與 `lesson-mistakes.test.ts` 同一組變異。 */
const OK = `int main() {\n    cout << "Hello!" << endl;\n    return 0;\n}`
const MISTAKES: Record<string, string> = {
  '對照（正確）': OK,
  '① cout 漏分號': OK.replace('endl;', 'endl'),
  '② return 漏分號': OK.replace('return 0;', 'return 0'),
  '③ 漏右大括號': OK.slice(0, -1),
  '④ 全形分號': OK.replace('endl;', 'endl；'),
  '⑤ 全形引號': OK.replace('"Hello!"', '“Hello!”'),
  '⑥ 引號沒關': OK.replace('"Hello!"', '"Hello!'),
  '⑦ Cout 大小寫': OK.replace('cout', 'Cout'),
  '⑧ << 寫成 <': OK.replace('cout <<', 'cout <'),
  '⑨ 全形括號': OK.replace('main()', 'main（）'),
}

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

describe('導出我們的判定（給 clangd 裁判當左半邊）', () => {
  it('全部樣本 → /tmp/ours.json', () => {
    const samples: Array<{ group: string; name: string; code: string }> = []
    for (const [k, v] of Object.entries(COMPETITIVE)) samples.push({ group: '競賽', name: k, code: H + v })
    for (const [k, v] of Object.entries(APCS_CORPUS)) samples.push({ group: 'APCS', name: k, code: H + v })
    for (const [k, v] of Object.entries(ARDUINO)) samples.push({ group: 'Arduino', name: k, code: v })
    for (const [k, v] of Object.entries(MISTAKES)) samples.push({ group: '第一課錯誤', name: k, code: H + v })

    // ★ 入口條件——錨在**樣本數**（合成量）。不錨在「擋下幾筆」：那是會變的。
    expect(samples.length, '語料沒進來，這份導出不算數').toBeGreaterThan(40)

    const rows = samples.map((s) => {
      const tree = createTestLifter().lift(parser.parse(s.code)!.rootNode as never) as SemanticNode
      return { ...s, weRefuse: !canExecute(tree).ok }
    })
    writeFileSync('/tmp/ours.json', JSON.stringify(rows))
    console.log(`\n樣本 ${rows.length}｜我們擋下 ${rows.filter((r) => r.weRefuse).length}\n`)
  }, 180000)
})
