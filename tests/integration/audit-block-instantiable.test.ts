/**
 * 第五十一條護欄：**每一顆宣告的積木都要真的建得出來。**
 *
 * ## 為什麼有這一支（2026-08-22，開瀏覽器看出來的）
 *
 * `python_loop_for` ——Python 最基本的迴圈積木——**在瀏覽器裡完全建不出來**：
 *
 * ```
 * Error: Block "python_loop_for": Message index %2 out of range.
 * ```
 *
 * 而那時：**5312 支測試全綠**、來回轉換一字不差、執行結果與真的 Python 相同。
 *
 * 症狀是使用者打開「流程控制」分類，看到 `if` 之後**就沒有了**
 * ——`for`／`while`／`break` 全部不見，而沒有任何東西出聲。
 *
 * ## 🔴 為什麼既有的測試看不到
 *
 * | | 做的事 | 看得到這個嗎 |
 * |---|---|---|
 * | 渲染那條路的測試 | 樹 → **BlockState（JSON）** | ❌ 沒有真的建積木 |
 * | 比對護欄 | 真的建，**而建不起來時 `catch { }` 跳過** | ❌ 被自己的容錯吃掉 |
 * | 可拿性護欄 | 這顆在不在工具箱的來源裡 | ❌ 在，只是建不出來 |
 *
 * > **一整排「渲得出積木」的測試，如果渲的是一份 JSON，
 * > 那麼它們對「Blockly 建不建得起來」這個問題一個字都沒說。**
 *
 * ⚠️ 而 `jsonInit` 的失敗**只在建的那一刻**發生——它讀 `Blockly.Msg` 展開
 * `%{BKY_...}`，所以**同一份宣告在不同語系下可以一個成功一個失敗**。
 * 這正是這裡兩種語系都跑一遍的理由。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import fs from 'node:fs'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import i18nBlocksEn from '../../src/i18n/en/blocks.json'
import { printReport, assertRatchet, assertCorpus, REPO_ROOT } from '../helpers/guardrail'
// 第二個維度：**一段程式的積木狀態載得進去嗎**（見那一支的檔頭）
import { PYTHON_CORPUS } from '../assets/python-corpus'
import { liftPython, createPythonLifter } from '../helpers/python-lift'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'
import { Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { PythonParser } from '../../src/languages/python/parser'
import { Parser } from 'web-tree-sitter'
import { backtickSpans } from '../helpers/backtick-corpus'

let reg: BlockSpecRegistry
let ws: Blockly.Workspace

/** 建一顆，回失敗的原因（成功回 `null`）。**注入餵得進來**，所以是純函式。 */
export function whyNotBuildable(type: string, workspace: Blockly.Workspace): string | null {
  try {
    const b = workspace.newBlock(type)
    b.dispose(false)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

beforeAll(() => {
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays']) declareDropdownSource(k, () => [])
  reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  ws = new Blockly.Workspace()
})

/** 用**產品那條路**註冊全部積木（paramList／branchList／variadic 都在裡面）。 */
async function registerViaProduct(): Promise<void> {
  const { BlockRegistrar } = await import('../../src/ui/block-registrar')
  const n = await import('../../src/languages/cpp/block-input-names')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
}

/** 宣告裡所有的積木型別。 */
function declaredTypes(): string[] {
  return (reg.getAll() as { blockDef?: { type?: string } }[])
    .map((s) => s.blockDef?.type)
    .filter((t): t is string => Boolean(t))
}

describe('第五十一條護欄：宣告的積木，Blockly 真的建得出來嗎', () => {
  it('★ 錨點：母體不是空的，而且真的走了產品那條註冊路', async () => {
    Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
    await registerViaProduct()
    expect(declaredTypes().length, '一顆都沒宣告 → 下面每一個零都是假的').toBeGreaterThan(100)
    expect(Blockly.Blocks['python_print'], '產品那條路沒跑 → 建的不是真的那一顆').toBeTruthy()
  })

  it('★ 注入①：訊息索引超出範圍的宣告【必須】被抓到', () => {
    Blockly.Blocks['__inject_bad'] = {
      init: function (this: Blockly.Block) {
        ;(this as unknown as { jsonInit: (d: unknown) => void }).jsonInit({
          type: '__inject_bad',
          message0: '對 %2 裡的每一個 %1',
          args0: [{ type: 'input_value', name: 'ONLY_ONE' }],
        })
      },
    }
    const why = whyNotBuildable('__inject_bad', ws)
    delete Blockly.Blocks['__inject_bad']
    expect(why, '這種宣告都抓不到 → 這條護欄量的是別的東西').toBeTruthy()
    expect(why).toContain('%2')
  })

  it('★ 注入②：健康的宣告不得被誤報', () => {
    Blockly.Blocks['__inject_ok'] = {
      init: function (this: Blockly.Block) {
        ;(this as unknown as { jsonInit: (d: unknown) => void }).jsonInit({
          type: '__inject_ok', message0: '對 %1', args0: [{ type: 'input_value', name: 'ONLY_ONE' }],
        })
      },
    }
    const why = whyNotBuildable('__inject_ok', ws)
    delete Blockly.Blocks['__inject_ok']
    expect(why, `健康的宣告被判成建不起來：${why}`).toBeNull()
  })

  it('★ 注入③：訊息沒載入時的失敗與宣告寫錯【必須】分得出來', () => {
    // ⚠️ `%{BKY_不存在}` 展不開時 Blockly 把它留成字面——那不是「建不起來」。
    Blockly.Blocks['__inject_msg'] = {
      init: function (this: Blockly.Block) {
        ;(this as unknown as { jsonInit: (d: unknown) => void }).jsonInit({
          type: '__inject_msg', message0: '%{BKY_THIS_KEY_DOES_NOT_EXIST} %1',
          args0: [{ type: 'input_value', name: 'ONLY_ONE' }],
        })
      },
    }
    const why = whyNotBuildable('__inject_msg', ws)
    delete Blockly.Blocks['__inject_msg']
    expect(why, '缺一則訊息不該被算成「建不起來」——那會讓真正的失敗淹在雜訊裡').toBeNull()
  })

  it('硬性零：每一顆都建得起來（中英兩種語系各一遍）', async () => {
    const failures: { type: string; locale: string; why: string }[] = []
    const types = declaredTypes()

    for (const [locale, table] of [['zh-TW', i18nBlocks], ['en', i18nBlocksEn]] as const) {
      // 🔴 **語系要重載**：`jsonInit` 展開 `%{BKY_...}` 是在**建的那一刻**，
      //    所以同一份宣告在不同語系下可以一個成功一個失敗。
      Object.assign(Blockly.Msg as Record<string, string>, table, componentLabels(locale))
      for (const t of Object.keys(Blockly.Blocks)) delete Blockly.Blocks[t]
      await registerViaProduct()
      for (const t of types) {
        if (!Blockly.Blocks[t]) continue
        const why = whyNotBuildable(t, ws)
        if (why) failures.push({ type: t, locale, why })
      }
    }

    printReport('宣告的積木建不建得起來', [
      `型別 ${types.length} 個 × 2 種語系`,
      `建不起來  ${failures.length} 個 ← 硬性零`,
      ...failures.map((f) => `  ✘ ${f.type}（${f.locale}）：${f.why}`),
      '',
      '⚠️ 渲染那條路的測試產出的是 **BlockState（JSON）**——它對「Blockly 建不建得起來」',
      '   一個字都沒說。而 `jsonInit` 的失敗只在**建的那一刻**發生。',
    ])

    assertCorpus([['宣告的積木型別', types.length]], 'block-instantiable')
    assertRatchet([['建不起來', failures.length]], 'block-instantiable', {
      detail: failures.map((f) => `${f.type}（${f.locale}）：${f.why}`),
    })
    expect(failures.map((f) => `${f.type}（${f.locale}）：${f.why}`), '建不起來的積木在工具箱裡【看不見】').toEqual([])
  })

  /**
   * 🔴 **第二個維度：一段程式的積木狀態【載得進去】嗎**（2026-08-22）。
   *
   * 上面那一支問「這顆積木建得起來嗎」，而它答不出下面這個：
   *
   * ```
   * MissingConnection: The block "python_method_call" is missing a(n) OBJ connection
   * ```
   *
   * `python_method_call` **建得起來**（它有 `init`），而它的 `args0` 宣告的
   * `OBJ` 與 `METHOD` 被可變參數的建構子**丟掉了**——那個建構子從零建整顆，
   * 表達不了「插槽在前」的形狀。於是渲染出來的狀態指名一個不存在的插槽，
   * **整個工作區載不進去**，使用者看到的是一片空白。
   *
   * ⚠️ 而 `METHOD` 被丟掉時**連錯都不報**（`getFieldValue` 靜靜回 `null`）。
   *
   * > **「這顆積木建得起來」與「這一段程式的積木擺得上去」是兩個問題。**
   *
   * 🟢 語料用第五十條護欄那一份——**AI 會寫的 Python**，不是照著積木挑的。
   */
  it('硬性零：語料的每一段，積木狀態都載得進工作區', async () => {
    registerCppLanguage()
    Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
    for (const t of Object.keys(Blockly.Blocks)) delete Blockly.Blocks[t]
    await registerViaProduct()

    const rsr = new RenderStrategyRegistry()
    registerCppRenderStrategies(rsr)
    const renderer = new PatternRenderer()
    renderer.setRenderStrategyRegistry(rsr)
    renderer.loadBlockSpecs(reg.getAll())
    setPatternRenderer(renderer)

    const pyParser = new PythonParser()
    await pyParser.init(`${process.cwd()}/public`)
    await Parser.init()
    createPythonLifter()
    // 🔴 **降級用哪一顆積木是【目標】決定的**——產品切到 Python 時會設，
    //    而這裡不設的話退回字面的 `raw_code`（那個型別不存在，於是整段載不進去）。
    //    ⚠️ 這是**測試的佈景漏了一步**，不是產品的洞：症狀長得像產品壞了。
    setDegradationLanguage('python')

    const failures: string[] = []
    let loaded = 0
    for (const [name, code] of PYTHON_CORPUS) {
      const tree = await liftPython(code)
      if (!tree) { failures.push(`${name}：lift 回 null`); continue }
      // ⚠️ `renderToBlocklyState` 回的**已經是**工作區狀態的形狀
      //    （`{ blocks: { languageVersion, blocks: [...] } }`）——再包一層的話
      //    Blockly 會說 `a is not iterable`。
      const { blockMappings: _drop, ...state } = renderToBlocklyState(tree)
      const load = new Blockly.Workspace()
      try {
        Blockly.serialization.workspaces.load(state, load)
        loaded++
      } catch (e) {
        failures.push(`${name}：${e instanceof Error ? e.message : String(e)}`)
      } finally {
        load.dispose()
      }
    }

    printReport('語料的積木狀態載得進工作區嗎', [
      `語料 ${PYTHON_CORPUS.length} 段｜載得進去 ${loaded}`,
      `載不進去  ${failures.length} 段 ← 硬性零`,
      ...failures.map((f) => `  ✘ ${f}`),
      '',
      '⚠️ 「這顆積木建得起來」與「這一段程式的積木擺得上去」是兩個問題：',
      '   前者只要 `init` 跑得完，後者要**每一個被指名的插槽真的存在**。',
    ])

    assertCorpus([['語料段數', PYTHON_CORPUS.length]], 'block-state-loadable')
    assertRatchet([['載不進去', failures.length]], 'block-state-loadable', { detail: failures })
    expect(failures, '載不進去的那一段，使用者看到的是一片空白').toEqual([])
  }, 120_000)

  /**
   * 🔴 **同一個問題的 C++ 那一半**（2026-08-23）。
   *
   * 上面那一支只跑 Python 語料，於是 `cpp_class_def` **沒有上下接點**這件事
   * 活了很久：兩個類別接不起來，工作區一載入就整段失敗。
   * 使用者看到的是一個紅色的「積木載入失敗」，而 5424 個測試全綠。
   *
   * > **一條護欄只跑一個語言的語料，它就只保護那一個語言。**
   *
   * ⚠️ 語料是**測試檔裡的反引號片段**（與第三十一條同一批來源）——
   * 只收語法完整的那些，片段本來就組不成工作區。
   */
  it('硬性零：C++ 語料的每一段，積木狀態都載得進工作區', async () => {
    Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
    for (const t of Object.keys(Blockly.Blocks)) delete Blockly.Blocks[t]
    await registerViaProduct()

    const rsr = new RenderStrategyRegistry()
    registerCppRenderStrategies(rsr)
    const renderer = new PatternRenderer()
    renderer.setRenderStrategyRegistry(rsr)
    renderer.loadBlockSpecs(reg.getAll())
    setPatternRenderer(renderer)
    setDegradationLanguage('cpp')

    await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
    const p = new Parser()
    p.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    const lifter = createTestLifter()

    const corpus: string[] = []
    const dir = `${REPO_ROOT}/tests/integration`
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.test.ts')) continue
      for (const c of backtickSpans(fs.readFileSync(`${dir}/${f}`, 'utf8'))) {
        if (!/[;{]/.test(c) || c.includes('${')) continue
        corpus.push(c)
      }
    }

    const failures: string[] = []
    let complete = 0
    for (const code of corpus) {
      let tree
      try { tree = p.parse(code) } catch { continue }
      if (!tree || (tree.rootNode as unknown as { hasError: boolean }).hasError) continue
      let tr
      try { tr = lifter.lift(tree.rootNode as never) } catch { continue }
      if (!tr) continue
      complete++
      const { blockMappings: _drop, ...state } = renderToBlocklyState(tr as never)
      const load = new Blockly.Workspace()
      try {
        Blockly.serialization.workspaces.load(state, load)
      } catch (e) {
        failures.push(`${code.slice(0, 60).replace(/\n/g, '⏎')}：${e instanceof Error ? e.message : String(e)}`)
      } finally {
        load.dispose()
      }
    }

    printReport('C++ 語料的積木狀態載得進工作區嗎', [
      `撈到 ${corpus.length} 段｜語法完整 ${complete}｜載不進去 ${failures.length} ← 硬性零`,
      ...failures.slice(0, 10).map((f) => `  ✘ ${f}`),
    ])

    expect(complete, '語法完整的一段都沒有 → 語料沒撈到，這一條不算數').toBeGreaterThan(50)
    assertRatchet([['C++ 載不進去', failures.length]], 'block-state-loadable-cpp', { detail: failures })
    expect(failures, '載不進去的那一段，使用者看到的是一片空白').toEqual([])
  }, 180_000)
})
