/**
 * spec 160：**Python 的第一顆積木——兩條到達路徑各自走一次。**
 *
 * ## 為什麼一定要兩條
 *
 * `experience.md` 逐字：
 *
 * > 一顆積木可以有兩條到達路徑（**工具箱拖出來** vs **貼上程式碼 lift 出來**），
 * > 而**修好其中一條，另一條上的學生什麼都沒感覺到**。
 *
 * ```
 * 路徑①  工具箱拖一顆  →  積木 → extract → 樹 → generate  →  print(...)
 * 路徑②  貼一段程式碼  →  解析 → lift → 樹 → render      →  python_print 積木
 * ```
 *
 * ## ⚠️ 這一支刻意不比字串就算數
 *
 * `history/108` 抓到的三個假綠裡有一個是**roundtrip 走的是降級路徑**
 * ——`raw_code` 把原文原樣吐回來，於是字串一字不差**而身分是錯的**。
 *
 * > **比對輸出字串量不到身分。** 所以每一條都斷言 `componentId`。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { Parser, Language } from 'web-tree-sitter'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { createPythonLifter } from '../helpers/python-lift'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, BlockState } from '../../src/core/types'
import { PythonParser } from '../../src/languages/python/parser'
// ⚠️ **副作用匯入**：宣告降級積木（`raw_code` 要靠它才渲得出來）。
// 少了它，`print("a", "b")` 的兩個降級引數會**靜靜地渲不出來**，
// 而症狀看起來像「可變參數壞了」——那正是這一支第一次紅的原因。
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'

let renderer: PatternRenderer
let extractor: PatternExtractor
let lifter: Lifter
let pyParser: PythonParser

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

  // 🔴 **從 `public/` 讀**——wasm 出貨之後這裡與瀏覽器走同一份檔。
  pyParser = new PythonParser()
  await pyParser.init(`${process.cwd()}/public`)

  await Parser.init()
  lifter = createPythonLifter()
}, 60_000)

/** 一顆 `print(x)` 的語義節點——路徑①的起點（工具箱拖出來時的形狀）。 */
function printNode(): SemanticNode {
  return {
    id: 'n1',
    componentId: 'python:print',
    properties: {},
    children: {
      values: [{ id: 'n2', componentId: 'cpp:literal_string', properties: { value: 'hi' }, children: {} }],
    },
  }
}

describe('spec 160 · 兩條到達路徑', () => {
  it('★ 錨點：登錄表裡真的有 python_print（否則下面在驗空集合）', () => {
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allComponentDefs(), allCppProjections())
    expect(reg.getByBlockType('python_print'), 'forms/blocks.json 沒進登錄表').toBeTruthy()
  })

  it('🔴 路徑①：語義 → 積木 → 抽回語義，**身分不得漂走**', () => {
    const block = renderer.render(printNode()) as BlockState | null
    expect(block, 'render 回 null → 路徑①的第一段就斷了').toBeTruthy()
    expect(block!.type, '渲染出來的不是 Python 那顆').toBe('python_print')

    // 🔴 **引數要真的接在積木上。**
    //
    // ⚠️ 這一行是**瀏覽器抓到的、測試沒抓到的**：`renderMapping.inputs` 的方向
    // 我寫反了（寫成 `{語義接點: 輸入名}`，正確是 `{輸入名: 語義接點}`），
    // 而上下那些斷言**修正前後都綠**——它們只問「積木型別對不對」。
    // 使用者看到的是**一顆「輸出」積木，插槽空著**。
    //
    // > **型別對了不代表接點接上了**——而空插槽在截圖裡才看得見。
    expect(Object.keys(block!.inputs ?? {}),
      '引數沒接上 → 使用者看到一個空插槽').toEqual(['EXPR0'])

    const back = extractor.extract(block!)
    expect(back, 'extract 回 null → 積木抽不回語義，兩路沒有成對').toBeTruthy()
    // ⚠️ 這一行才是重點：字串對得上不代表身分對得上（history/108）
    expect(back!.componentId, '抽回來的身分漂走了——降級路徑也會給出「看起來對」的結果')
      .toBe('python:print')
  })

  it('🔴 路徑②：貼一段真的 Python → 認出 `python:print`，**不是降級**', async () => {
    const tree = await pyParser.parse('print("hi")')
    const sem = lifter.lift(tree.rootNode as never, 'python')
    expect(sem, 'lift 回 null → 路徑②走不到任何積木').toBeTruthy()

    const found = collect(sem!).filter((n) => n.componentId === 'python:print')
    expect(found.length,
      '⚠️ 沒認出來的話它會退成 raw_code——而 raw_code 把原文原樣吐回去，'
      + '**輸出字串會一字不差而身分是錯的**（history/108 的第二個假綠）').toBe(1)

    // 反向：**那顆 print 自己**不得是降級的
    expect(found[0]!.componentId, 'print 這顆本身走了降級路徑').toBe('python:print')
  })

  /**
   * 🎯 **spec 162 的驅動案例**：`print(a, b)` ——**多於一個引數**。
   *
   * spec 160 只做得到 `print(x)`，因為產生 `EXPR0..EXPRn` 的機制是命令式的、
   * 寫死在 `block-registrar` 裡（vision 記著的那 33 筆）。
   *
   * > **一個「只能一個引數」的 print，不是 print。**
   */
  it('🎯 `print(a, b)`：兩個引數都要走得完（spec 162 的驅動案例）', async () => {
    const tree = await pyParser.parse('print("a", "b")')
    const sem = lifter.lift(tree.rootNode as never)
    const print = collect(sem!).find((n) => n.componentId === 'python:print')!
    expect(print.children.values?.length, 'lift 只收到一個引數 → 可變參數在 lift 那一側就斷了').toBe(2)

    // 🔴 **走產品的入口**（`renderToBlocklyState`），不自己叫 `PatternRenderer.render`。
    //
    // ⚠️ 第一版直接叫後者，而**降級節點的渲染住在 `RenderContext` 裡**
    // （`renderDynamicRules` 的 `ctx?.renderExpression ?? this.render(...)`）——
    // 於是兩個 `raw_code` 引數靜靜地渲不出來，`inputs` 是空的，
    // 而症狀看起來像「可變參數壞了」。
    // > **繞過產品入口的測試，量到的是另一條路——而它會怪錯人。**
    setPatternRenderer(renderer)
    const ws = renderToBlocklyState(sem!)
    const block = ws.blocks.blocks[0] as BlockState | undefined
    expect(block?.type, '程式根渲不出積木').toBe('python_print')
    expect(Object.keys(block?.inputs ?? {}).sort(),
      '⚠️ 只長出 EXPR0 → 積木型別的【定義】沒有照著 `dynamicRules` 建那些 input')
      .toEqual(['EXPR0', 'EXPR1'])
    expect((block as { extraState?: { itemCount?: number } })?.extraState?.itemCount,
      'extraState 沒帶 itemCount → 存檔之後會塌回一個引數').toBe(2)

    const back = extractor.extract(block!)
    expect(back?.children.values?.length, '抽回來少了一個引數').toBe(2)
    expect(back?.componentId).toBe('python:print')
  })

  /**
   * 🔴 **存檔重開那條路**——`loadExtraState` 要把插槽長回來。
   *
   * ⚠️ 這一支是**注射逼出來的**：把 `loadExtraState` 裡長插槽的那一行拿掉之後，
   * 上面七支**一支都沒紅**。而它是使用者**關掉分頁隔天再打開**會走的路
   * ——渲染那條路不經過它。
   *
   * > **一條只有「載入舊檔」才會走的路，用「現在畫一次」是量不到的。**
   */
  /**
   * 🔴 **宣告的接點必須是 lift 真的產出的那些。**
   *
   * ⚠️ 這一支是**注射逼出來的**：改壞 `component.json` 的 `children` 之後，
   * 上面五支**一支都沒紅**——那個宣告沒有任何東西在驗。
   *
   * 而全域的宣告完整性護欄看不到它：**它的語料是 `tests/integration/` 裡的
   * C++ 片段**，Python 這顆躲在「無法確定」裡（cause=語料沒覆蓋）。
   *
   * > **一個量不到的地方，宣告錯了與宣告對了長得一模一樣**
   * > ——而我在修這顆的時候把這句話寫進了膠囊，卻沒有補上量它的東西。
   */
  it('🔴 `children` 宣告 ↔ lift 實際產出，必須對得上', async () => {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/python/print/component.json'), 'utf8'))
    const declared = Object.keys(manifest.children as Record<string, unknown>).sort()

    const tree = await pyParser.parse('print("hi")')
    const sem = lifter.lift(tree.rootNode as never, 'python')
    const print = collect(sem!).find((n) => n.componentId === 'python:print')!
    const actual = Object.keys(print.children ?? {}).sort()

    expect(actual, `宣告 ${declared.join('/')} 而 lift 產出 ${actual.join('/')}`).toEqual(declared)
  })

  /**
   * 🔴 **這一支釘的是【鄰域的邊界】，不是一個缺陷。**
   *
   * vision 階段 7 逐字：
   * > **第一個【不】落在同一類的地方在哪** —— 它比上一條更有價值：**它是鄰域的邊界**
   *
   * `print("hi")` 的**引數**降級成 `raw_code`，因為**沒有任何語言中立的字面常數元件**
   * ——233 顆全是 `cpp:` scope，`cpp:literal_string` 對 Python 不成立。
   *
   * ```
   * python:print          🟢 跨語言等價（ioRole=print）
   *   [values] raw_code   🔴 邊界：值的元件【是語言專屬的】
   * ```
   *
   * > **第二個語言連 `"hi"` 都得重做**——而那不是 print 的問題，是**元件身分的 scope 沒有中立層**。
   *
   * ⚠️ **釘成測試而不是寫在筆記裡**，因為它會被修掉：哪天有人加了語言中立的
   * 字面常數，這一支會紅，而**那時候紅是好事**——它會逼人回來改 vision 那一格。
   */
  it('🟢 邊界【已經移動】：引數不再降級——Python 有自己的字面常數了', async () => {
    const tree = await pyParser.parse('print("hi")')
    const sem = lifter.lift(tree.rootNode as never, 'python')
    const print = collect(sem!).find((n) => n.componentId === 'python:print')!
    const arg = print.children.values?.[0]
    // 🎯 **spec 167：這一格從 `raw_code` 變成 `python:literal_string`。**
    //
    // spec 160 寫這一條時附了一句話：
    // > 「⚠️ 這一格變了就表示邊界移動了——**去改 vision**，不要只是把測試改綠。」
    //
    // 🟢 **它真的變了，而 vision 也改了。**
    // ⚠️ 而**邊界本身還在，只是往後退了一格**：`python:literal_string` 的
    // `abstractComponent` 仍然是 `null`——C++ 的字串字面值與 Python 的 `str`
    // **在型別系統裡不是同一種東西**，硬指一個抽象父會是猜的（P6）。
    expect(arg?.componentId, '⚠️ 又降級了 → 字面常數那顆的 lift 樣式壞了')
      .toBe('python:literal_string')
  })

  it('🔴 路徑②的下半：lift 出來的樹**渲染得成積木**（兩條路在此會合）', async () => {
    const tree = await pyParser.parse('print("hi")')
    const sem = lifter.lift(tree.rootNode as never, 'python')
    const node = collect(sem!).find((n) => n.componentId === 'python:print')!
    const block = renderer.render(node) as BlockState | null
    expect(block?.type,
      '⚠️ 貼上程式碼之後【看得到積木】才算走完——lift 對了而渲染不出來，'
      + '學生看到的是空白').toBe('python_print')
  })

  it('★ 反向：不亂認——`foo("hi")` 不得變成 `python:print`', async () => {
    const tree = await pyParser.parse('foo("hi")')
    const sem = lifter.lift(tree.rootNode as never, 'python')
    expect(collect(sem!).filter((n) => n.componentId === 'python:print'),
      '只釘「會報」而不釘「不亂報」，等於沒釘（spec 157 的第三個假綠）').toEqual([])
  })
})

function collect(n: SemanticNode, out: SemanticNode[] = []): SemanticNode[] {
  out.push(n)
  for (const kids of Object.values(n.children ?? {})) for (const k of kids) collect(k, out)
  return out
}

/**
 * 🔴 **貼一整段程式碼 → 積木**（2026-08-21）。
 *
 * 上面那幾支走的是**一顆**積木。而使用者在瀏覽器貼的是一整段，
 * 於是渲染要走完整棵樹——**而那條路在測試裡從來沒有被完整走過**。
 *
 * 症狀（瀏覽器實測看到的）：程式碼在、執行正確，**而畫布是空的**。
 *
 * > **一顆積木渲得出來，不代表一棵樹渲得出來
 * > ——而中間那些節點是【新加的那些】。**
 */
describe('整段程式碼 → 積木（渲染那條路）', () => {
  const render = async (code: string): Promise<BlockState> => {
    const tree = lifter.lift((await pyParser.parse(code)).rootNode as never) as SemanticNode
    expect(tree, '提升不得回 null').not.toBeNull()
    setPatternRenderer(renderer)
    return renderToBlocklyState(tree, 'python')
  }

  /** 這棵樹渲出來的積木型別（遞迴收集）。 */
  const typesIn = (s: unknown, out: string[] = []): string[] => {
    const n = s as { type?: string; blocks?: unknown[]; inputs?: Record<string, { block?: unknown }>; next?: { block?: unknown } }
    if (n?.type) out.push(n.type)
    for (const b of (n?.blocks as { blocks?: unknown[] })?.blocks ?? []) typesIn(b, out)
    for (const v of Object.values(n?.inputs ?? {})) if (v?.block) typesIn(v.block, out)
    if (n?.next?.block) typesIn(n.next.block, out)
    return out
  }

  it('★ 錨點：最單純的一段渲得出積木（否則下面在驗空集合）', async () => {
    const state = await render('print(1)\n')
    expect(typesIn(state), `渲出來是空的：${JSON.stringify(state).slice(0, 200)}`).toContain('python_print')
  })

  it('🔴 這一批新元件全部渲得出積木', async () => {
    const CASES: [string, string][] = [
      ['python_array_make', 'a = [1, 2]\n'],
      ['python_map_make', 'd = {"k": 1}\n'],
      ['python_container_at', 'x = a[0]\n'],
      ['python_container_find', 'y = "k" in d\n'],
      ['python_var_assign_compound', 'total += 1\n'],
      ['python_string_make', 'x = f"hi {n}"\n'],
      ['python_tuple_make', 'p = (3, 4)\n'],
      ['python_var_assign_sequence', 'x, y = p\n'],
      ['python_import', 'import math\n'],
      ['python_member_at', 'x = math.pi\n'],
      ['python_try_catch', 'try:\n    n = 1\nexcept:\n    pass\n'],
      ['python_array_make_for', 'a = [x for x in xs]\n'],
      ['python_class_def', 'class C:\n    def m(self):\n        pass\n'],
      // ⚠️ 運算式位置用的是**運算式形態**——那正是 `expressionCounterpart` 的作用。
      //    語句位置（下一筆）才是那一顆本身。
      ['python_method_call_expression', 'a = s.strip()\n'],
      ['python_method_call', 's.strip()\n'],
      ['python_container_size', 'a = len(xs)\n'],
      ['python_range_make', 'a = range(3)\n'],
      ['python_string_upper', 'a = s.upper()\n'],
      ['python_container_append', 'xs.append(1)\n'],
    ]
    for (const [type, code] of CASES) {
      const got = typesIn(await render(code))
      expect(got, `${code.trim()} 渲不出 ${type}（拿到：${got.join(',')}）`).toContain(type)
      expect(got, `${code.trim()} 渲出了灰色方塊`).not.toContain('python_raw_code')
    }
  })

  it('🔴 一整段（不是一顆）也要渲得出來', async () => {
    const got = typesIn(await render(
      'nums = [3, 1]\nfor n in nums:\n    print(n)\nprint(len(nums))\n',
    ))
    for (const t of ['python_var_assign', 'python_array_make', 'python_loop_for', 'python_print', 'python_container_size']) {
      expect(got, `整段裡少了 ${t}（拿到：${got.join(',')}）`).toContain(t)
    }
  })
})
