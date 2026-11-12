/**
 * 第 411 刀：**迴圈與推導式綁定的名字，走一趟真的積木回來還在不在**。
 *
 * `for c in s:` 走一趟積木回來曾經變成 `for i in s:`（2026-08-21 起），而迴圈體還在讀 `c`：
 * 單一名字只寫在 `obj`，而積木只認 `targets`（paramList 的 `PARAM_{i}`），於是積木上那一格是預設的 `i`。
 * 程式碼那一路（lift → generate）一直是綠的——**只在積木那一條投影上壞掉的缺陷，不經過那條投影的測試看不到**。
 *
 * ⚠️ 所以這一支走**真的 Blockly**（無頭工作區）：渲染出的狀態載進去、再存出來、再抽回語義。
 * 只比渲染出的 JSON 會漏掉它——那份 JSON 裡本來就沒有名字，是 Blockly 在 init 時補上的 `i`。
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { generatePython, liftPython } from '../helpers/python-lift'
// ⚠️ 副作用匯入：宣告降級積木（`raw_code` 要靠它才渲得出來）
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/panels/blocks/dynamic-dropdown-field'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'

let renderer: PatternRenderer
let extractor: PatternExtractor
let ws: Blockly.Workspace

beforeAll(async () => {
  registerCppLanguage()
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  const specs = reg.getAll()
  const rsr = new RenderStrategyRegistry()
  registerCppRenderStrategies(rsr)
  renderer = new PatternRenderer()
  renderer.setRenderStrategyRegistry(rsr)
  renderer.loadBlockSpecs(specs)
  extractor = new PatternExtractor()
  extractor.loadBlockSpecs(specs)
  // 積木那一路：與 form-invariance 同一套（產品宣告哪些，這裡就宣告哪些）
  registerFieldMultilineInput()
  registerDynamicDropdownField()
  for (const k of ['names', 'vars', 'funcs', 'arrays', 'cpp_var_types', 'cpp_param_types', 'cpp_return_types']) declareDropdownSource(k, () => [])
  // ⚠️ 型別註記的下拉用產品那一份（第 423 刀：空的清單讓 `def f():` 回來多一個 `-> __custom__`——那是這支測試的假象，不是產品的）
  await import('../../src/languages/python/pack')
  ws = new Blockly.Workspace()
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  const { BlockRegistrar } = await import('../../src/panels/blocks/block-registrar')
  new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
}, 120_000)

const throughBlocks = async (code: string): Promise<string> => {
  const sem = await liftPython(code)
  setPatternRenderer(renderer)
  const st = renderToBlocklyState(sem!)
  ws.clear()
  const blk = Blockly.serialization.blocks.append(st.blocks.blocks[0], ws)
  return generatePython(extractor.extract(Blockly.serialization.blocks.save(blk) as never)).trim()
}

describe('已知的正規化：同一支程式，文字不同', () => {
  // 第 420 刀：`for (a, b) in …` 的括號是排版註記，積木那一趟不存它——回來是 `for a, b in …`（Python 的同一支程式）
  it('for (a, b) in ps → for a, b in ps', async () => {
    expect(await throughBlocks('for (a, b) in ps:\n    print(a + b)\n')).toBe('for a, b in ps:\n    print(a + b)')
  })
  // 多餘的括號（優先級本來就比 and 高）走積木不留——兩元比較也一樣；鏈的每一段都還在（第 426 刀）
  it('(0 < x < 20 != 21) and ok → 0 < x < 20 != 21 and ok', async () => {
    expect(await throughBlocks('y = (0 < x < 20 != 21) and ok\n')).toBe('y = 0 < x < 20 != 21 and ok')
  })
})

describe('綁定的名字走一趟真的積木回來', () => {
  for (const c of [
    'for c in xs:\n    print(c)',
    'for k, v in d.items():\n    print(k, v)',
    'y = [x * 2 for x in xs]',
    't = [(a, b) for a, b in zip(xs, ys) if b - a == 2]',
    's = [w for w, c in r if c == 1]',
    'z = "".join(ch * n for ch, n in runs)',
    'd = {k: v for k, v in xs}',
    'q = [x for row in g for x in row]',
    'a = b = 0',
    'is_prime[0] = is_prime[1] = False',
    'o.x = y = 1',
    // 第 412 刀：f-string 的轉換是插值那一格的下拉——走一趟積木要回得來（空字串那個選項＝沒有轉換）
    'p = f"{s!r:<16}-> {t!s}|{u!a}|{v}|{w:.2f}"',
    // 第 418 刀：自我說明 `{x=}` 是插值那一格的另一個下拉（空字串那個選項＝沒有）
    'p = f"{x=}|{s = }|{v=:.2f}|{s=!s}|{o.n=}"',
    // 第 417 刀：迴圈的 `else:` 走齒輪——`for` 的參數列 ＋ 尾巴兩個機制存在同一份 extraState 裡
    'for i in xs:\n    if i > 2:\n        break\nelse:\n    print("none")',
    'for k, v in d.items():\n    print(k)\nelse:\n    print(v)',
    'while n > 0:\n    n = n - 1\nelse:\n    print(n)',
    // 第 416 刀：主體只有 pass 的空類別——積木上方法與欄位兩格都是空的，回來要寫回 pass
    'class P:\n    pass',
    // 第 420 刀：目標是一個樣式——接在 PATTERN 那一格的元組／變數／展開積木
    'for i, (w, c) in enumerate(r, 1):\n    print(i, w, c)',
    'for x, in ps:\n    print(x)',
    'for a, *rest in rows:\n    print(a, rest)',
    'for (dr, dc), name in moves.items():\n    print(name)\nelse:\n    print(0)',
    // 第 421 刀：序列指派的目標是一個樣式——左值（名字、索引、屬性）組成的元組與展開，接在 PATTERN 那一格
    'a[i], a[j] = a[j], a[i]',
    'first, *mid, last = r',
    'a, (b, c) = 1, (2, 3)',
    'o.x, o.y = o.y, o.x',
    'x, = t',
    // 第 422 刀：推導式的目標是一個樣式——同一個 PATTERN 插槽，串列／產生器／集合／字典四種推導式
    'r = [n for n, *_ in g]',
    'r = [x for i, (x, y) in enumerate(ps) if i > 0]',
    'r = sum(a * b for (a, b), c in zip(u, v))',
    'r = {x for x, in ps}',
    'r = {k: a for k, (a, b) in d.items()}',
    // 第 419 刀：產生器運算式只在它是呼叫唯一的引數時不帶自己的括號——判準是語義樹的結構，走過積木還在
    'print(sum(x for x in r), any(x > 1 for x in r))',
    'g = (x for x in r)',
    'print(*(f"{x:3}" for x in r))',
    'm = max((x for x in r), default=0)',
    't = sorted((x for x in r), reverse=True)',
    'f(a, (x for x in r))',
    // 第 423 刀：nonlocal（與 global 同形）與 del 的可增減目標（名字、屬性、某一格）
    'def f():\n    c = 0\n    def g():\n        nonlocal c\n        c += 1\n    g()\n    return c',
    'del b.rate',
    'del a, xs[0], o.y',
    // ⚠️ 這支只載第一顆頂層積木，所以 del 一個名字單獨寫
    'del x',
    // 第 424 刀：裝飾器——可增減的裝飾器插槽（名字、屬性、呼叫）＋ 下面一格定義（trailingInputs）
    '@staticmethod\ndef fmt(x):\n    return x',
    '@a\n@b.c\n@lru_cache(maxsize=None)\ndef f(n):\n    return n',
    '@dataclass\nclass P:\n    x = 0',
    'class A:\n    @staticmethod\n    def f(x):\n        return x\n    @property\n    def g(self):\n        return 1',
    // 第 425 刀：參數的星號是 param_decl 的 variadic 標記（list＝*args、dict＝**kw）——積木上要有一格裝它，走一趟回來還在
    'def f(*args):\n    return args',
    'def total(*args, scale=1, **kw):\n    return sum(args) * scale',
    'def g(a, b: int = 2, *rest, **opts):\n    return a',
    'y = 0 < x < 20 != 21',
    'y = a <= b <= c <= d >= e',
    'y = 0 < x < 20',
    'if 0 < x < 20 != 21:\n    print(x)',
    'while 0 <= i < n <= m:\n    i += 1',
    'y = 0 < x < 20 != (a < b < c < d)',
    'y = 1 < x in z',
  ]) {
    it(c.split('\n')[0], async () => {
      expect(await throughBlocks(c + '\n')).toBe(c)
    })
  }
})

/**
 * 第 427 刀：函式參數的齒輪——「收集其餘引數」與「預設值」不能同時開（`*scale=1` 是語法錯誤）。
 * 兩個都勾時**剛勾的贏**，齒輪裡另一個勾也拿掉。另：有型別註記時星號要留著（原本產回 `args: int`）。
 * ⚠️ 這裡用 headless 工作區替齒輪建子積木（`initSvg` 換成空的）——走的是產品的 `decompose`／`compose`。
 */
describe('齒輪：收集其餘引數與預設值互斥', () => {
  const funcBlock = async (code: string): Promise<Blockly.Block> => {
    const sem = await liftPython(code)
    setPatternRenderer(renderer)
    const st = renderToBlocklyState(sem!)
    ws.clear()
    const top = Blockly.serialization.blocks.append(st.blocks.blocks[0], ws)
    const fd = top.type === 'python_func_def' ? top : top.getDescendants(false).find((b) => b.type === 'python_func_def')
    expect(fd, '正向錨點：要是一顆函式定義').toBeTruthy()
    return fd!
  }
  const gear = (blk: Blockly.Block): Blockly.Block[] => {
    const fake = { newBlock: (t: string) => { const b = ws.newBlock(t); (b as unknown as { initSvg: () => void }).initSvg = () => {}; return b } }
    const container = (blk as unknown as { decompose: (w: unknown) => Blockly.Block }).decompose(fake)
    const items: Blockly.Block[] = []
    let it = container.getInputTargetBlock('STACK')
    while (it) { items.push(it); it = it.getNextBlock() }
    ;(blk as unknown as { __container: Blockly.Block }).__container = container
    return items
  }
  const compose = (blk: Blockly.Block): void =>
    (blk as unknown as { compose: (c: Blockly.Block) => void }).compose((blk as unknown as { __container: Blockly.Block }).__container)
  const code = (blk: Blockly.Block): string =>
    generatePython(extractor.extract(Blockly.serialization.blocks.save(blk) as never)).trim()

  it('已經是 *args 的那格，勾預設值 → 預設值贏，星號收起來', async () => {
    const blk = await funcBlock('def f(*args, scale=1):\n    pass\n')
    expect(code(blk)).toBe('def f(*args, scale=1):\n    pass')
    const items = gear(blk)
    items[0].setFieldValue('TRUE', 'OPT_default')
    compose(blk)
    expect(items[0].getFieldValue('OPT_variadic'), '齒輪裡的勾也要拿掉，不是悄悄不理').toBe('FALSE')
    expect(code(blk)).toBe('def f(args, scale=1):\n    pass')
  })

  it('已經有預設值的那格，勾收集其餘引數 → 收集贏，預設值收起來', async () => {
    const blk = await funcBlock('def f(*args, scale=1):\n    pass\n')
    const items = gear(blk)
    items[1].setFieldValue('TRUE', 'OPT_variadic')
    compose(blk)
    expect(items[1].getFieldValue('OPT_default')).toBe('FALSE')
    blk.setFieldValue('list', 'PARAM_VARIADIC_1')
    const out = code(blk)
    expect(out, '🔴 不得產出 `*scale=1`').not.toContain('=')
    expect(out).toBe('def f(*args, *scale):\n    pass')
  })

  it('*args 加上型別註記，星號要留著', async () => {
    const blk = await funcBlock('def f(*args):\n    pass\n')
    const items = gear(blk)
    items[0].setFieldValue('TRUE', 'OPT_type')
    compose(blk)
    blk.setFieldValue('int', 'PARAM_TYPE_0')
    expect(code(blk)).toBe('def f(*args: int):\n    pass')
  })
})
