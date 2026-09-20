/**
 * **帶參數的巨集的四個面向**——而這一族的正題是**第①與第④互相矛盾，且兩邊都對**。
 *
 * ```
 * ① 產出的程式碼   rep(i,m) …  要【一字不差】回去          ← 學生沒碰積木
 * ④ 走一趟積木回來 rep(i,m) …  要變成 for (int i = 0; …)   ← 學生碰過積木
 * ```
 *
 * 🔴 **而那不是矛盾，是 `layoutHints` 的契約**（`core/types.ts` 那一格的檔頭）：
 * 「投影記住它，積木看不到它」「積木改過之後這一格會不在，那時產出預設的排版
 * ——**仍然正確**」。
 *
 * 在巨集這個消費者身上，「改過之後就不在」**是一個安全性質**：
 * 迴圈的界線一旦在積木那側被改過，再印 `rep(i,m)` 就是一句謊話。
 *
 * ## ⚠️ 這個檔為什麼不依賴語料
 *
 * `STUDYCPP_DIR` 沒設時那些探針會跳過，而**跳過的護欄與不存在的護欄長得一樣**。
 * 下面每一個形狀都是**從語料蒸餾**的（4 支、8 處、3 種用法）：
 *
 * ```cpp
 * #define rep(i,n) for(int i=0;i<n;i++)    三支
 * #define rep(i,n) for(int i=1;i<=n;i++)   一支
 * rep(i,m) cin >> d2[i]    單句       rep(k,4){ … }   區塊       rep(i,m) rep(j,n) …   巢狀
 * ```
 *
 * 出處：`AP325/7/7_4`、`AP325/6/6_6`、`AP325/4/4_19`、`AP325/6/6_5`。
 *
 * ⚠️ **那幾個出處刻意寫在程式碼區塊【外面】**（2026-09-20 踩到）：
 * 第五十三條護欄的 C++ 語料是**從測試檔的反引號區間刮出來的**，
 * 而三個反引號的圍籬也是反引號區間。`7/7_4` 裡的 `7_4` 在 C++ 文法裡
 * 剛好是一個**使用者定義字面值**——於是兩筆判定被「一個檔案路徑」變成了過期。
 *
 * > **一個把註解裡的範例當語料的抽取器，會把【檔案路徑】讀成程式。
 * > 而它報出來的「語料已經碰到它」是真的——碰到它的是註解。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import * as Blockly from 'blockly'
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { BlockSpecRegistry } from '../../src/core/blocks/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { setDegradationLanguage } from '../../src/core/blocks/degradation-blocks'
import { PatternExtractor } from '../../src/core/projection/pattern-extractor'
import { registerCppExtractStrategies } from '../../src/languages/cpp/extractors/extract-strategies'
import { canExecute } from '../../src/core/diagnostics'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const DEFS = '#define rep(i,n) for(int i=0;i<n;i++)\n#define per(i,n) for(int i=1;i<=n;i++)\n'

/** `[名稱, main 裡那一段, 產回去要含有的那一句]` */
const SHAPES: readonly [string, string, string][] = [
  ['語料：單句主體（AP325/4/4_19）', '  rep(i,n) s += i;', 'rep(i,n)'],
  ['語料：區塊主體（AP325/7/7_4）', '  rep(k,4){ s += k; }', 'rep(k,4)'],
  ['語料：巢狀（AP325/6/6_6）', '  rep(i,n) rep(j,n) s += i * j;', 'rep(j,n)'],
  ['語料：另一種表頭（AP325/6/6_5）', '  per(i,n) s += i;', 'per(i,n)'],
  ['引數是運算式', '  rep(i,n+1) s += i;', 'rep(i,n+1)'],
  ['引數之間有空白——原樣回去', '  rep(i, n) s += i;', 'rep(i, n)'],
  // 🔴 **這一種的樹形狀與上面每一種都不同**（實測）：`>>` 讓 tree-sitter
  //    把它解成【兩個並列的語句】，而 `s += i` 那一種解成【一個】。
  //    > **同一個巨集用法，樹的形狀隨它後面接什麼而變——
  //    > 而照那些形狀去認，等於把解析器的錯當成規格。**
  ['語料：主體是讀取（AP325/7/7_4）', '  rep(i, n) cin >> arr[i];', 'rep(i, n)'],
  ['三層巢狀', '  rep(i,n) rep(j,n) rep(k,n) s += i * j * k;', 'rep(k,n)'],
]

const wrap = (body: string): string =>
  `#include <bits/stdc++.h>\nusing namespace std;\n${DEFS}`
  + `int main() {\n  int n = 3, s = 0;\n  int arr[3];\n${body}\n  cout << s;\n  return 0;\n}\n`

const S = apcs as unknown as StylePreset

let parser: Parser
let blockExtractor: PatternExtractor

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()

  registerFieldMultilineInput()
  registerDynamicDropdownField()
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

const lift = (src: string): SemanticNode =>
  createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
const squash = (x: string): string => x.replace(/\s+/g, '')
const ids = (n: SemanticNode, out: string[] = []): string[] => {
  out.push(n.componentId)
  for (const ks of Object.values(n.slots ?? {})) for (const k of ks) ids(k, out)
  return out
}

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
/** 走一趟積木回來，拿到整支程式的語義節點。 */
const throughBlocks = (body: string): SemanticNode => {
  const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
  const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
  return { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
}

describe('帶參數的巨集：四個面向', () => {
  it('★ 入口條件——這條路真的跑得動（否則下面每一條都在驗空氣）', () => {
    const got = ids(lift(wrap('  rep(i,n) s += i;')))
    expect(got, '🔴 定義那一行沒有身分').toContain('cpp:define_func')
    expect(got, '🔴 使用處沒有展開成迴圈').toContain('cpp:loop_count')
    expect(got, '🔴 還在降級').not.toContain('raw_code')
    expect(got).not.toContain('unresolved')
    // 🔴 展開出來的不得是一個【函式呼叫】——那是修之前的形狀
    expect(got, '🔴 巨集呼叫還被當成函式呼叫').not.toContain('cpp:func_call')
  })

  describe('① 產出的程式碼：巨集的拼法要一字不差', () => {
    it.each(SHAPES)('%s', (_name, body, want) => {
      const out = generateCode(lift(wrap(body)), 'cpp', S)
      expect(squash(out), `🔴 學生寫的 ${want} 被改寫掉了`).toContain(squash(want))
      expect(out, '🔴 展開後的表頭漏出來了').not.toContain('for (int')
    })
  })

  describe('② 語義的不動點：再 lift 一次還是同一棵', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const once = generateCode(lift(wrap(body)), 'cpp', S)
      expect(generateCode(lift(once), 'cpp', S), '🔴 來回一趟就走樣了').toBe(once)
    })
  })

  describe('③ 載得進工作區（紅了是一片空白，不是少一行）', () => {
    it.each(SHAPES)('%s', (_name, body) => {
      const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(wrap(body)))
      const ws = new Blockly.Workspace()
      let err: string | null = null
      try { Blockly.serialization.workspaces.load(state, ws) }
      catch (e) { err = e instanceof Error ? e.message : String(e) }
      finally { ws.dispose() }
      expect(err, '🔴 載不進去——使用者看到的不是少一行，是一片空白').toBeNull()
    })
  })

  describe('④ 走一趟積木回來：拼法【會不見】，而那是對的', () => {
    it.each(SHAPES)('%s', (_name, body, want) => {
      // ⚠️ `#define` 那一行本身當然還印著巨集的名字——要比的是 `main` 裡面那幾行
      const out = generateCode(throughBlocks(body), 'cpp', S)
      const meat = out.split('\n').filter((l) => !l.trimStart().startsWith('#define')).join('\n')
      expect(meat, '🔴 積木改過之後還印巨集——那會在界線被改掉時變成一句謊話')
        .not.toContain(want.slice(0, want.indexOf('(')) + '(')
      expect(out, '🔴 拼法不見了，而迴圈本身也不見了——那是【語義】的遺失').toContain('for (int')
    })

    it('🔴 語義本身不得掉：走一趟回來仍然是同一個迴圈', () => {
      const back = throughBlocks('  rep(i,n) s += i;')
      const got = ids(back)
      expect(got, '🔴 迴圈整顆掉了').toContain('cpp:loop_count')
      expect(squash(generateCode(back, 'cpp', S)), '🔴 主體掉了')
        .toContain(squash('s += i;'))
    })
  })
})

/**
 * 🔴 **接手的條件——缺一就讓開，而「讓開」要維持今天的行為。**
 *
 * 這一段是這一刀最重要的負向面：**刻意沒有中途站**。
 * 一個「認得出巨集而還原不回去」的中間態，產出的是**看起來對而少東西**的樹
 * ——那正是這一刀在修的那個病。
 */
/**
 * 🔴 **語料見證**——第五十三條護欄的 C++ 語料是「測試檔裡的反引號區間」，
 * 而上面每一支用的都是單引號字串，**它一個字都看不到**。
 *
 * > **一份「我們的測試碰過哪些語法」的清單，如果它的來源是一種寫法，
 * > 那麼換一種寫法的測試對它而言不存在。**
 *
 * 所以這一支刻意用反引號，而且它是一支**真的測試**——不是為了餵掃描器而擺的字串。
 */
/**
 * 🔴 **舊存檔**——這一刀把 `layoutHints` 的值從 `boolean` 放寬成 `boolean | string`。
 *
 * `layoutHints` 住在 `metadata`，而**語義樹是存進存檔的**，所以放寬型別
 * 等於改了存檔的形狀。判斷是「不必動 `CURRENT_VERSION`」，而那個判斷要被釘住：
 *
 * ```
 * 舊存檔存的   { parenthesized: true }      布林
 * 新的存的     { macroHeader: "rep(i,m)" }  字串
 * ```
 *
 * 🟢 **既有的每一個消費者都用 `=== true`**（`precedence.ts`、`code-generator.ts`），
 * 所以一個字串值對它們而言就是「沒有那一格」——**放寬是相加的，不是相改的**。
 * ⚠️ 而反過來也要成立：舊存檔那個布林，在新的型別下**仍然要生效**。
 */
/**
 * 🔴 **按下「執行」那一刻的閘**——第六關（開瀏覽器）才看得到的一條路。
 *
 * ```
 * 語義樹      🟢 修好了（rep(i,n) 展開成一顆計數迴圈）
 * 積木        🟢 畫得出來
 * 程式碼      🟢 一字不差
 * 按「執行」   🔴 「這段程式有一處語法還不完整，所以還不能執行」
 * ```
 *
 * 根因：樹修復把樹修好了，**而原本那棵 AST 裡的 `ERROR` 節點還在**，
 * 於是 `lifter` 走到祖先時仍然把整支程式標成 `syntax_error`，
 * 而 `canExecute`（執行前的閘）讀的正是那個標記。
 *
 * 🔴 **而當時所有測試都是綠的**——它們直接呼叫 `execute(tree)`，
 * 那道閘只在**使用者按下按鈕**的那條路上。
 *
 * > **一道「使用者按下去才會走到」的檢查，
 * > 任何直接呼叫下一層的測試都看不到它。**
 *
 * ⚠️ 而修法本身也踩了一次：第一版用 `WeakSet<Node>` 記「哪些子樹修好了」，
 * 而 **web-tree-sitter 每次存取 `.children` 都產生新的 JS 包裝物件**
 * ——那個集合永遠回答「沒有」，看起來就像修復從來沒發生過。
 */
describe('帶參數的巨集：按下「執行」那一刻', () => {
  const gate = (src: string): boolean => canExecute(lift(src)).ok

  it('🔴 展開成功的程式要【跑得動】——不得被語法閘擋下', () => {
    expect(gate(wrap('  rep(i,n) s += i;')), '🔴 積木與程式碼都好的，而按執行被擋').toBe(true)
  })

  it('🔴 巨集定義在 main 裡面時也要跑得動（那是骨架的形狀）', () => {
    const src = '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n'
      + '  #define rep(i,n) for(int i=0;i<n;i++)\n  int n = 4, s = 0;\n'
      + '  rep(i,n) s += i;\n  rep(k,3){ s += k * 10; }\n'
      + '  rep(i,n) rep(j,2) s += i * j;\n  cout << s;\n  return 0;\n}'
    expect(gate(src), '🔴 骨架把 #define 放進 main，而那一種被擋').toBe(true)
  })

  it('🔴 括號裡的逗號運算式也要跑得動', () => {
    const src = '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ int x=0; cout << (x = 3, x + 1); return 0; }'
    expect(gate(src)).toBe(true)
  })

  it('★ 錨點：真的語法錯誤【仍然】要被擋下', () => {
    const src = '#include <bits/stdc++.h>\nint main(){ int x = @@@; return 0; }'
    expect(gate(src), '🔴 放寬過頭了——寫錯的程式變成跑得動').toBe(false)
  })

  it('★ 錨點：乾淨的程式照舊放行', () => {
    const src = '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ int s=0; for(int i=0;i<3;i++) s+=i; cout << s; return 0; }'
    expect(gate(src)).toBe(true)
  })
})

describe('帶參數的巨集：舊存檔（型別放寬之後）', () => {
  it('🔴 舊存檔的布林排版註記仍然生效——放寬不得把它吃掉', () => {
    const src = '#include <iostream>\nint main(){ int n = 3; cout << (n + 1) * 2; return 0; }'
    const out = generateCode(lift(src), 'cpp', S)
    // ★ 正向錨點：那對括號是靠 layoutHints.parenthesized（布林）帶回來的
    expect(squash(out), '🔴 布林那一格失效了——舊存檔的排版會整批走樣').toContain(squash('(n + 1) * 2'))
  })

  it('🔴 字串與布林可以同時住在同一格', () => {
    const src = `#include <iostream>\n${DEFS}int main(){ int n=3,s=0; rep(i,n) s += (i + 1) * 2; cout << s; return 0; }`
    const out = generateCode(lift(src), 'cpp', S)
    expect(squash(out), '🔴 巨集的拼法不見了').toContain(squash('rep(i,n)'))
    expect(squash(out), '🔴 括號不見了').toContain(squash('(i + 1) * 2'))
    expect(generateCode(lift(out), 'cpp', S), '🔴 不動點破了').toBe(out)
  })
})

describe('帶參數的巨集：語料見證', () => {
  it('★ 這一份原文既跑得過，也是語料掃描看得到的那一份', () => {
    const src = `#include <iostream>
using namespace std;
#define rep(i,n) for(int i=0;i<n;i++)
int main(){ int s = 0; rep(i,4) s += i; cout << s; return 0; }`
    const got = ids(lift(src))
    expect(got).toContain('cpp:define_func')
    expect(got).toContain('cpp:loop_count')
    expect(got).not.toContain('raw_code')
    expect(generateCode(lift(src), 'cpp', S)).toContain('rep(i,4)')
  })
})

describe('帶參數的巨集：讓開的那幾種', () => {
  const idsOf = (src: string): string[] => ids(lift(src))

  it('★ 沒定義過的名字：`rep(2,3)` 仍然是一個函式呼叫', () => {
    const got = idsOf('int rep(int a,int b){ return a+b; }\nint main(){ int x = rep(2,3); return x; }')
    expect(got).toContain('cpp:func_call')
    expect(got).not.toContain('cpp:define_func')
  })

  /**
   * 🔴 **證不出來的時候是【誠實降級】，不是讓開**——第三關量到的。
   *
   * 「讓開」聽起來安全，而它不是：tree-sitter 對 `go(i,n) s += i;` 給的是
   * 一棵**看起來合法而少一個名字**的樹，於是產回去是 `go(i, n) += i;`
   * ——**`s` 不見了，而且不出聲**。
   *
   * > **「讓開」與「誠實降級」的差別，不在我做了多少，
   * > 在使用者的程式碼有沒有被改掉。**
   */
  const verbatim = (src: string, must: string): void => {
    const out = generateCode(lift(src), 'cpp', S)
    expect(squash(out), `🔴 「${must}」被改掉了`).toContain(squash(must))
    expect(generateCode(lift(out), 'cpp', S), '🔴 不動點破了').toBe(out)
  }

  it('★ 引數個數對不上：不展開，而原文一字不差', () => {
    const src = `#include <iostream>\n${DEFS}int main(){ int s=0; rep(i) s += i; return s; }`
    const got = idsOf(src)
    expect(got, '🔴 引數個數不對還展開了').not.toContain('cpp:loop_count')
    expect(got, '🔴 沒有誠實降級——那會靜默少一個名字').toContain('cpp:raw_code')
    verbatim(src, 'rep(i) s += i;')
  })

  it('★ 巨集呼叫後面沒有語句：不展開，而原文一字不差', () => {
    const src = `#include <iostream>\n${DEFS}int main(){ int s=0; rep(i,3)\n}`
    expect(idsOf(src), '🔴 沒有主體還展開了').not.toContain('cpp:loop_count')
    verbatim(src, 'rep(i,3)')
  })

  it('★ 巨集體裡又呼叫另一個巨集：不展開，而原文一字不差', () => {
    const src = `#include <iostream>\n#define rep(i,n) for(int i=0;i<n;i++)\n#define go(i,n) rep(i,n)\nint main(){ int n=2,s=0; go(i,n) s += i; return s; }`
    const got = idsOf(src)
    expect(got, '🔴 展開了一層而第二層沒展開——那是【看起來對而少東西】的樹')
      .not.toContain('cpp:loop_count')
    expect(got).toContain('cpp:raw_code')
    verbatim(src, 'go(i,n) s += i;')
  })

  it('★ 運算式位置的函式巨集：不碰它（那仍然在墓碑那一側）', () => {
    const src = '#include <iostream>\n#define SQR(x) ((x)*(x))\nint main(){ int y = SQR(3); return y; }'
    const got = idsOf(src)
    expect(got, '🔴 定義那一行要認得').toContain('cpp:define_func')
    // 使用處**不展開**——它要的是求值，不是重解一段語句
    expect(got).toContain('cpp:func_call')
  })
})

/**
 * **巨集體不是一個值的物件形巨集**——`#define z -'0'`（2026-09-20，第 203 刀）。
 *
 * 語料 `w/APCS/j607_trash` 用的就是它（`x = x*10+(s[i]z)`），而在這一刀之前
 * **兩條投影都錯，而兩條都不出聲**：
 *
 * ```
 * 執行    (s[0]z) 算成 52（把 z 整個忽略）   🔴 錯，而且不出聲
 * 產回去  (s[0]z) → (s[0])                  🔴 z 靜默消失
 * ```
 *
 * > **一個「這一段我看不懂」的節點，如果兩條投影都不說，
 * > 那它就不是降級，是一個錯的答案。**
 *
 * 🟢 而「產出一字不差」的機制**本來就在**（`generateExpression` 的第一個分支，
 * `layoutHints.verbatim` ＋ `metadata.rawCode`，`"abc" "def"` 那條線在用）
 * ——這一刀只是接上它。
 */
describe('巨集體不是一個值：`#define z -\'0\'`', () => {
  const idsOf = (src: string): string[] => ids(lift(src))
  const FRAG = '#include <iostream>\n#include <string>\nusing namespace std;\n#define z -\'0\'\n'

  it('★ 入口條件：這個形狀真的解出一個 ERROR 節點（否則下面在驗空氣）', () => {
    const t = parser.parse('int main(){ string s="47"; int x = (s[0]zz); return 0; }')!
    expect(t.rootNode.hasError, '🔴 tree-sitter 不再給 ERROR ⟹ 這一族的判準要重寫').toBe(true)
  })

  it('🔴 產回去一字不差——`(s[0]z)` 不得變成 `(s[0])`', () => {
    const src = `${FRAG}int main(){ string s="47"; int x = (s[0]z); return x; }`
    const out = generateCode(lift(src), 'cpp', S)
    expect(squash(out), '🔴 `z` 靜默消失了').toContain(squash('(s[0]z)'))
    expect(squash(out), '🔴 把學生寫的巨集換成了展開的樣子').not.toContain(squash("(s[0] - '0')"))
  })

  it('🔴 展開之後認得出來——不得留在降級通道', () => {
    const got = idsOf(`${FRAG}int main(){ string s="47"; int x = (s[0]z); return x; }`)
    expect(got, '★ 正向錨點：定義那一行還在').toContain('cpp:define')
    expect(got, '🔴 整段掉進 raw_code').not.toContain('raw_code')
    expect(got).not.toContain('unresolved')
  })

  /**
   * ⚠️ **不能用檔案共用的 `throughBlocks`**——它 `wrap()` 的是這個檔自己的
   * 那兩個 `#define rep/per`，而這一族要的是 `#define z`。
   * 🔴 第一版就這樣寫，於是它量到的是「`z` 沒定義所以沒展開」——
   * **一支看起來在驗展開、而其實在驗沒展開的測試。**
   */
  it('★ 走一趟積木回來：拼法消失，而語義一格都沒掉', () => {
    const src = `${FRAG}int main(){ string s="47"; int x = (s[0]z); return x; }`
    const { blockMappings: _drop, ...state } = renderToBlocklyState(lift(src))
    const backs = (state.blocks.blocks as unknown[]).flatMap(chainOf)
    const back = { componentId: 'cpp:program', properties: {}, slots: { body: backs } } as SemanticNode
    const out = generateCode(back, 'cpp', S)
    expect(squash(out), '★ 正向錨點：真的走回來了').toContain(squash('int x ='))
    // 積木碰過了 ⟹ `layoutHints` 不在 ⟹ 產出展開後的樣子，而那是【對的】
    expect(squash(out), '🔴 拼法還在——而它可能已經是一句謊話').not.toContain(squash('(s[0]z)'))
    expect(squash(out), '🔴 語義掉了一格').toContain(squash("s[0] - '0'"))
  })

  it('🔴 ★ 錨點：不是巨集的名字【不得】被這條規則認領', () => {
    // `zz` 沒有定義過 ⟹ 這條修復要讓開，行為與這一刀之前逐字相同
    const t = lift('#include <string>\nusing namespace std;\nint main(){ string s="47"; int x = (s[0]zz); return x; }')
    const hasVerbatim = (n: SemanticNode): boolean =>
      n.metadata?.layoutHints?.verbatim === true
      || Object.values(n.slots ?? {}).some((ks) => ks.some(hasVerbatim))
    expect(hasVerbatim(t), '🔴 把一個不認得的名字當成巨集展開了').toBe(false)
  })

  it('🔴 ★ 錨點：一般的物件形巨集與別名巨集都不得被碰', () => {
    const a = idsOf('#include <iostream>\nusing namespace std;\n#define N 100\nint main(){ cout << N; return 0; }')
    expect(a).toContain('cpp:define')
    const b = idsOf('#include <utility>\nusing namespace std;\n#define F first\nint main(){ pair<int,int> p={3,4}; return p.F; }')
    expect(b).toContain('cpp:define')
    // 兩者都沒有 ERROR 節點 ⟹ 這條修復根本不會被叫到
    expect(a).not.toContain('raw_code')
    expect(b).not.toContain('raw_code')
  })

  /**
   * 🔴 **重解出來的那棵樹少了型別上下文**（第二次踩到同一個形狀）。
   *
   * `isStringVar` 是**往 AST 上面走**找宣告的，而重解出來的樹裡只有那一段
   * ——`string s;` 不在上面。於是同一段程式碼**兩條路徑給出兩顆不同的身分**：
   *
   * ```
   * 第一趟（走修復）  重解 → 查不到宣告 → cpp:array_at
   * 第二趟（走一般路）                   → cpp:string_at
   * ```
   *
   * 症狀有兩個，而**第二個比較貴**：語義不動點破掉（語料 `w/APCS/j607_trash`），
   * 以及**學生看到錯的積木**（`cpp:array_at` 與 `cpp:string_at` 是兩塊積木）。
   *
   * 🟢 處置：`isStringVar` **先問型別表**（它跨那棵重解的樹活著），查不到才走 AST。
   */
  it('🔴 重解出來的子樹要拿到型別——`s[i]` 是字串的一格，不是陣列的一格', () => {
    const got = idsOf(`${FRAG}int main(){ string s="47"; int x = (s[0]z); return x; }`)
    expect(got, '🔴 重解掉了型別上下文 ⟹ 學生看到的是【陣列】那塊積木').toContain('cpp:string_at')
    expect(got).not.toContain('cpp:array_at')
  })

  it('🔴 產出一字不差在【語句位置】也要成立', () => {
    // `x = x*10+(s[i]z);` 是一個【語句】——`generateExpression` 讀 `verbatim`，
    // 而在這一刀之前 `generateNode`（語句那一路）不讀，於是這一種被展開掉了。
    const src = `${FRAG}int main(){ string s="47"; int x = 0;\n  x = x*10+(s[0]z);\n  return x; }`
    const out = generateCode(lift(src), 'cpp', S)
    expect(squash(out), '🔴 語句位置的 `z` 被展開掉了').toContain(squash('x = x*10+(s[0]z);'))
  })

  it('★ 不動點：產回去再 lift，還是同一棵', () => {
    const src = `${FRAG}int main(){ string s="47"; int x = (s[0]z); return x; }`
    const once = generateCode(lift(src), 'cpp', S)
    const twice = generateCode(lift(once), 'cpp', S)
    expect(twice).toBe(once)
  })
})
