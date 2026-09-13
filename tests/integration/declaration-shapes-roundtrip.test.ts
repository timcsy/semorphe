/**
 * **第一百一十五條護欄：一個宣告寫成什麼樣，轉一圈回來還是那個樣。**
 *
 * ## 🔴 它從哪裡來：一份不是我們寫的語料
 *
 * 2026-09-09，使用者拿他學生的練習 repo 當語料（218 個 `.cpp`、7327 行，
 * 內容是 AP325、TIOJ、zeroJudge、APCS 的競賽題）。
 *
 * 量到的第一個數字很好看：**解析失敗 0、lift 失敗 0、殘差 0.0%**。
 * 而第二個數字不是——**218 支裡 144 支轉一圈回來不是同一棵樹**：
 *
 * ```
 * string A[100];               →  string x;                 🔴 陣列、大小、名字一起蒸發
 * string s, t, u;              →  string s;                 🔴 第二、三個變數蒸發
 * string* p;                   →  string x;                 🔴 指標與名字蒸發
 * int a[10], b[20];            →  int a, b;                 🔴 兩個大小蒸發
 * vector<int> v(n);            →  vector<int> x;            🔴 名字與大小蒸發
 * ios::sync_with_stdio(0),…    →  …(0);⏎,  cin.tie(0);      🔴 編不過（136/218 支）
 * max({ans, f(l), f(r)})       →  max({…}, 0)               🔴 編不過
 * ```
 *
 * ⚠️ **而它們全部不出聲。** 殘差是 0、積木長得很正常、多數產出編得過
 * ——只是**它是另一支程式**。
 *
 * > **一份自己造的語料，量的是「我們想到的那些輸入」。**
 *
 * ## 為什麼是這一條護欄，而不是把那份語料收進來
 *
 * 那個 repo 是別人的。🟢 而**形狀是我們的**——這裡釘住的每一行都是
 * 從那份語料抽出來的**寫法**，不是它的內容。
 *
 * ## ⚠️ 它比對的是「程式碼」與「身分」兩樣
 *
 * 只比字串會漏掉一種缺陷：`stack<int> inbox, outbox;` 讓開走通用路徑之後
 * **字串是對的而 `cpp:stack_declare` 不見了**——學生看到的不再是那顆積木。
 *
 * > **一個為了修正確性而放棄身分的修法，是把一個缺陷換成另一個缺陷。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

/** 產出函式體裡的那幾行（去掉骨架與縮排）。 */
function bodyOf(code: string): string {
  const tree = parser.parse(code)
  if (!tree) return '🔴 解析不了'
  const root = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  if (!root) return '🔴 lift 不了'
  return generateCode(root, 'cpp', S)
    .split('\n')
    .filter((l) => l.trim() && !/^(int n, M, N;|int main|\})/.test(l.trim()))
    .map((l) => l.trim())
    .join(' ')
}

function identities(n: SemanticNode | null | undefined, out = new Set<string>()): Set<string> {
  if (!n) return out
  if (n.componentId) out.add(n.componentId)
  for (const b of Object.values(n.slots ?? {})) for (const c of b ?? []) identities(c, out)
  return out
}

function idsOf(code: string): Set<string> {
  const tree = parser.parse(code)
  if (!tree) return new Set()
  return identities(createTestLifter().lift(tree.rootNode as never) as SemanticNode)
}

const wrap = (body: string): string => `int n, M, N;\nint main() {\n${body}\n}`

/**
 * 每一行都出自那份語料。
 *
 * ⚠️ **產出必須逐字等於輸入**——所以這裡寫的是**產出的排版**
 * （`int a = 1` 而不是 `int a=1`）。那不是在遷就實作：
 * 一個「轉一圈回來一模一樣」的斷言，是不動點最強的形式。
 */
const SHAPES: readonly string[] = [
  // ─── 具體型別 × 宣告子形狀 ───
  'string s;',
  'string s = "a";',
  'string s, t, u;',
  'string A[100];',
  'string A[100], ans;',
  'string* p;',
  'string g[3] = {"a"};',
  'stringstream ss;',
  'stack<int> inbox, outbox;',
  // ─── 陣列 ───
  'int a[10];',
  'int a[10], b[20];',
  'vector<int> v[10];',
  // ─── 容器的建構式（最令人困惑的解析）───
  'vector<int> v(n);',
  'vector<int> v(5);',
  'vector<int> v(n, 0);',
  'vector<pair<int, int>> td(n);',
  'vector<vector<int>> grid(M, vector<int>(N));',
  'vector<vector<int>> grid(M, vector<int>(N, -1));',
  'vector<vector<bool>> d(M, vector<bool>(N, false));',
  // ─── 競賽模板：逗號運算式（語料裡 136/218 支的第一行）───
  'ios::sync_with_stdio(0), cin.tie(0);',
  // ─── `max`／`min` 的大括號多載 ───
  'int x = max({1, 2, 3});',
  'int x = min({1, 2});',
  'int x = max(1, 2);',
]

describe('第一百一十五條護欄：宣告的形狀轉一圈回來還是它自己', () => {
  it('★ 入口條件——語料真的跑得動', () => {
    expect(bodyOf(wrap('    int x = 1;'))).toBe('int x = 1;')
  })

  it.each(SHAPES)('🔴 %s', (shape) => {
    expect(
      bodyOf(wrap(`    ${shape}`)),
      `🔴 這個宣告轉一圈回來變了樣。\n`
        + '   ⚠️ 先問「掉的是【資料】還是【排版】」——掉資料的那一種，\n'
        + '   使用者的程式會【編不過或跑出另一個答案】，而系統全綠。',
    ).toBe(shape)
  })

  /**
   * 🔴 **身分不得為了正確性被犧牲。**
   *
   * `stack<int> inbox, outbox;` 原本產出 `stack<int> inbox;`（第二個蒸發）。
   * 「讓開走通用路徑」能修好字串，**而那會讓堆疊積木變成一顆普通的變數宣告**。
   */
  it.each([
    ['stack<int> inbox, outbox;', 'cpp:stack_declare'],
    ['string s, t, u;', 'cpp:string_declare'],
    ['string s;', 'cpp:string_declare'],
    ['vector<int> v(n);', 'cpp:vector_declare'],
    ['stringstream ss;', 'cpp:stringstream_declare'],
  ])('🔴 身分：%s 仍然是 %s', (shape, id) => {
    expect(
      [...idsOf(wrap(`    ${shape}`))],
      `🔴 這個宣告的身分掉了——產出的程式碼也許還是對的，\n`
        + '   而**學生看到的不再是那顆積木**。',
    ).toContain(id)
  })

  // ─── 注入（第四十九條）───

  it('★ 注入：一個真的走樣的宣告 → 抓得到', () => {
    // 刻意寫錯的期望——證明這條護欄不是永遠綠
    expect(bodyOf(wrap('    string A[100];'))).not.toBe('string x;')
  })

  /**
   * ★ **不動點要跑兩圈**——第一圈對而第二圈變的東西，
   * 在使用者連按兩次「切換檢視」時才會現形。
   */
  it.each(SHAPES)('★ 第二圈也不變：%s', (shape) => {
    const once = bodyOf(wrap(`    ${shape}`))
    expect(bodyOf(wrap(`    ${once}`))).toBe(once)
  })
})

/**
 * **第一百一十七條護欄：這些形狀，Blockly 真的載得進工作區嗎。**
 *
 * ## 🔴 它補的是我漏掉的那一層（2026-09-10）
 *
 * 上面那一批驗的是**產出的程式碼**；第一百零二條之類的驗的是 BlockState 的
 * JSON。**兩者都對「Blockly 建不建得起來」一個字都沒說**——第五十一條護欄的
 * 檔頭寫過這句，而它沒有被套到宣告這一族上。
 *
 * 使用者回報 `vector<int> C(n+1), V(n+1);` 會錯，接著問
 * 「你到底有沒有整個仔細測過一遍？」——**沒有**。這一條是那句話的回答。
 *
 * ⚠️ 一顆積木接不進語句鏈時，Blockly 拒絕的是**整個工作區**
 * ——使用者看到的不是少一行，是**一片空白**。
 */
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/degradation-blocks'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'

/** 從那份語料抽出來的、**曾經讓整個工作區載不進去**的形狀。 */
const LOADABLE_SHAPES: readonly string[] = [
  ...SHAPES,
  // 🔴 `cc[A[i]];` 是離散化的慣用寫法——一個沒有敘述形態的運算式當語句用
  '    int idx[3];\n    idx[0];',
  '    map<int, int> cc;\n    cc[1];',
  // 🔴 `return` 之後還有一行註解——學生真的這樣寫
  '    return 0;\n    // 保底',
  '    for (int i = 0; i < 3; i++) {\n      break;\n      // 說明\n    }',
  // 逗號那一族
  '    ios::sync_with_stdio(0), cin.tie(0);',
  '    for (int a = 0, b = n; a < b; a++, b--) {\n    }',
  '    vector<int> C(n), V(n);',
  '    vector<int> C(n + 1), V(n + 1);',
]

let blockExtractor: PatternExtractor

describe('第一百一十七條護欄：載得進工作區', () => {
  beforeAll(async () => {
    registerFieldMultilineInput()
    registerDynamicDropdownField()
    // ⚠️ **產品宣告哪些，這裡就要宣告哪些**——少一個的症狀是「每一支都紅」，
    //    而那是護欄壞了，不是產品壞了（2026-09-10 實測踩過）。
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
    const rsr = new RenderStrategyRegistry()
    registerCppRenderStrategies(rsr)
    const renderer = new PatternRenderer()
    renderer.setRenderStrategyRegistry(rsr)
    renderer.loadBlockSpecs(reg.getAll())
    setPatternRenderer(renderer)
    setDegradationLanguage('cpp')
    blockExtractor = new PatternExtractor()
    blockExtractor.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(blockExtractor)
  }, 180_000)

  it.each(LOADABLE_SHAPES)('🔴 載得進工作區：%s', (shape) => {
    const src = shape.startsWith(' ') ? wrap(shape) : wrap(`    ${shape}`)
    const tree = parser.parse(src)
    const root = createTestLifter().lift(tree!.rootNode as never) as SemanticNode
    const { blockMappings: _drop, ...state } = renderToBlocklyState(root)
    const ws = new Blockly.Workspace()
    let err: string | null = null
    try {
      Blockly.serialization.workspaces.load(state, ws)
    } catch (e) {
      err = e instanceof Error ? e.message : String(e)
    } finally {
      ws.dispose()
    }
    expect(
      err,
      '🔴 載不進去——使用者看到的不是少一行，是**一片空白**。',
    ).toBeNull()
  })
})

/**
 * **第一百一十八條護欄：走一趟積木回來，程式碼還是那一段。**
 *
 * ## 🔴 第四個面向，而它是最後一個被量的（2026-09-10）
 *
 * 前三個面向——產出的**程式碼**、語義**不動點**、**載得進**工作區——都綠了，
 * 而學生在畫面上看到的仍然是錯的：
 *
 * ```
 * vector<int> C(n + 1), V(n + 1);
 *   積木上   「宣告 vector<int> 變數 C , V」   🔴 兩個 (n+1) 不見了
 * ```
 *
 * 那顆積木的多宣告子形態只有「名字」與「= 初始值」兩格，
 * 而陣列大小、指標星號、建構引數**沒有地方住**。
 * ⚠️ 學生一動積木，那幾樣就從**程式碼裡**沒了。
 *
 * > **前三個面向問的是「我送出去的對不對」；
 * > 這一個問的是「它從積木那一側走回來之後還在不在」。**
 */
describe('第一百一十八條護欄：走一趟積木回來', () => {
  /** 沿著 `next` 走完一條鏈——⚠️ `extract` 只讀一顆。 */
  function chainOf(b0: unknown): SemanticNode[] {
    const acc: SemanticNode[] = []
    let cur = b0 as { next?: { block: unknown } } | undefined
    while (cur) {
      const n = blockExtractor.extract(cur as never)
      if (n) acc.push(n)
      cur = (cur.next?.block ?? undefined) as typeof cur
    }
    return acc
  }

  function viaBlocks(body: string): string {
    const tree = parser.parse(wrap(`    ${body}`))
    const root = createTestLifter().lift(tree!.rootNode as never) as SemanticNode
    const { blockMappings: _drop, ...state } = renderToBlocklyState(root)
    const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
    const rebuilt = { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
    return generateCode(rebuilt, 'cpp', S)
      .split('\n').map((l) => l.trim())
      .filter((l) => l && !/^(int n, M, N;|int main|\}|return 0;)/.test(l))
      .join(' ')
  }

  const squash = (x: string): string => x.replace(/\s+/g, '')

  it('★ 入口條件——這條路真的跑得動', () => {
    expect(squash(viaBlocks('int x = 1;'))).toBe(squash('int x = 1;'))
  })

  /**
   * ⚠️ 有些形狀在積木上**刻意攤成一串**（`int a[10], b[20];` → 兩顆積木），
   * 所以這裡比的是**去掉逗號之後的等價寫法**，不是逐字。
   */
  it.each([
    ['int a[10], b[20];', 'int a[10]; int b[20];'],
    ['int* p, * q;', 'int* p; int* q;'],
    ['vector<int> C(n), V(n);', 'vector<int> C(n); vector<int> V(n);'],
    ['vector<int> C(n + 1), V(n + 1);', 'vector<int> C(n + 1); vector<int> V(n + 1);'],
    // ⚠️ 攤成兩顆，而**那比原本好**：學生看到的是兩顆堆疊積木，
    //    不是一顆型別欄寫著 `stack<int>` 的通用宣告積木。
    ['stack<int> inbox, outbox;', 'stack<int> inbox; stack<int> outbox;'],
    ['int a = 1, b = 2;', 'int a = 1, b = 2;'],
    ['string s, t, u;', 'string s; string t; string u;'],
    ['string A[100], ans;', 'string A[100]; string ans;'],
    ['deque<int> d(n);', 'deque<int> d(n);'],
    ['ios::sync_with_stdio(0), cin.tie(0);', 'ios::sync_with_stdio(0), cin.tie(0);'],
  ])('🔴 走一趟積木：%s', (body, expected) => {
    expect(
      squash(viaBlocks(body)),
      '🔴 走一趟積木之後那一段變了——**學生一動積木，他的程式就變了**。',
    ).toBe(squash(expected))
  })

  it('★ 注入：這條護欄不是永遠綠', () => {
    expect(squash(viaBlocks('int a[10], b[20];'))).not.toBe(squash('int a, b;'))
  })
})
