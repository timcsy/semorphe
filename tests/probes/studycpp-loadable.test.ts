/**
 * **探針：那 218 支，Blockly 真的載得進工作區嗎。**
 *
 * ## 🔴 它補的是我自己漏掉的那一層（2026-09-10）
 *
 * 前一輪拿這份語料量的是**語義不動點**（lift → 產碼 → 再 lift），
 * 而那一層**對「Blockly 建不建得起來」一個字都沒說**
 * ——第五十一條護欄的檔頭寫過這句，我還在 `history/224` 引用過它，
 * 然後**沒有把它套到這份語料上**。
 *
 * 使用者回報 `vector<int> C(n+1), V(n+1);` 會錯，接著問：
 * 「你到底有沒有整個仔細測過一遍？」——**沒有**。
 *
 * > **一個你剛寫下來的教訓，如果沒有立刻套回手上這份輸入，
 * > 它記的是「我知道有這回事」，不是「我檢查過了」。**
 *
 * ⚠️ 沒有 `STUDYCPP_DIR` 就跳過——語料是別人的 repo。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { createTestLifter } from '../helpers/setup-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'

const DIR = process.env.STUDYCPP_DIR ?? ''
let parser: Parser

beforeAll(async () => {
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  // ⚠️ **產品宣告哪些，這裡就要宣告哪些**——少一個的症狀是
  //    「215 支載不進去」，而那是探針壞了，不是產品壞了（實測踩過）。
  for (const k of ['names', 'vars', 'funcs', 'arrays',
    'cpp_var_types', 'cpp_param_types', 'cpp_return_types', 'python_types']) {
    declareDropdownSource(k, () => [])
  }
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  const ws = new Blockly.Workspace()
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  const { BlockRegistrar } = await import('../../src/ui/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })

  registerCppLanguage()
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  const renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(reg.getAll())
  setPatternRenderer(renderer)
  setDegradationLanguage('cpp')

  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
}, 180_000)

describe.skipIf(!process.env.STUDYCPP_DIR)('探針：StudyCpp 載得進工作區嗎', () => {
  it('★ 每一支都要載得進去', () => {
    const files: { rel: string; code: string }[] = []
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === '.git') continue
        const p = path.join(d, e.name)
        if (e.isDirectory()) { walk(p); continue }
        if (!/\.(cpp|cc)$/.test(e.name)) continue
        files.push({ rel: path.relative(DIR, p), code: fs.readFileSync(p, 'utf8') })
      }
    }
    walk(DIR)
    expect(files.length, '🔴 語料沒讀到').toBeGreaterThan(50)

    const failures: { rel: string; why: string }[] = []
    for (const f of files) {
      const tree = parser.parse(f.code)
      if (!tree) continue
      const root = createTestLifter().lift(tree.rootNode as never)
      if (!root) continue
      const { blockMappings: _drop, ...state } = renderToBlocklyState(root as never)
      const ws = new Blockly.Workspace()
      try {
        Blockly.serialization.workspaces.load(state, ws)
      } catch (e) {
        failures.push({ rel: f.rel, why: e instanceof Error ? e.message : String(e) })
      } finally {
        ws.dispose()
      }
    }

    console.log(`\n╔══ 載得進工作區嗎 ══╗\n檔數 ${files.length}｜載不進去 ${failures.length}`)
    const byWhy = new Map<string, string[]>()
    for (const f of failures) {
      const k = f.why.replace(/"block_\d+"/g, '"…"').slice(0, 120)
      byWhy.set(k, [...(byWhy.get(k) ?? []), f.rel])
    }
    for (const [why, rels] of [...byWhy].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n  ✘ ${rels.length} 支：${why}`)
      for (const r of rels.slice(0, 4)) console.log(`      ${r}`)
    }
    expect(failures.map((f) => `${f.rel}：${f.why}`),
      '🔴 載不進去的那一支，使用者看到的是一片空白').toEqual([])
  }, 600_000)
})
