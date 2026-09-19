/**
 * **解析器解錯的兩種形狀，以及「不該動的時候不要動」。**
 *
 * ## 🔴 這支測試的重點在負向
 *
 * 「換一棵樹」是這個管線裡**唯一一個會繞過使用者那段文字**的機制。
 * 它往寬了壞的症狀不是紅——是**一段合法的程式被換成另一段合法而不同的程式**，
 * 而每一層下游都會正確地處理那棵錯的樹。
 *
 * 所以這裡的每一條正向後面都有一條負向，而負向才是重點：
 *
 * ```
 * 正向  !K--            要被修成 !(K--)
 * 負向  K--             不得被動
 * 正向  a<b && c>-d     那個 a 是變數 ⟹ 修
 * 負向  mx<int>(3,5)    mx 不是變數 ⟹ 不得被搶
 * ```
 *
 * ⚠️ 行為對不對由 `interpreter-matches-compiler` 拿 g++ 當權威量；
 *    這裡量的是**判準本身**（誰被認領、誰沒有），以及
 *    **修復有沒有把自己的痕跡擦掉**（那對括號）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../../../helpers/setup-lifter'
import { registerCppLanguage } from '../../../../src/languages/cpp/generators'
import { generateCode } from '../../../../src/core/projection/code-generator'
import { postfixUnderUnary, suspectTemplate } from '../../../../src/languages/cpp/lang/misparse'
import apcs from '../../../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../../../src/core/types'
import type { AstNode } from '../../../../src/core/lift/types'

const ROOT = process.cwd()
let parser: Parser
let lifter: ReturnType<typeof createTestLifter>
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
const roundTrip = (body: string, glob = ''): string => {
  const src = `${H}${glob}\nint main(){ ${body} return 0; }\n`
  const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
  return generateCode(tree, 'cpp', apcs as unknown as StylePreset)
}
const ids = (body: string, glob = ''): string[] => {
  const src = `${H}${glob}\nint main(){ ${body} return 0; }\n`
  const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
  const out: string[] = []
  const walk = (n: SemanticNode): void => {
    out.push(n.componentId)
    for (const kids of Object.values(n.slots ?? {})) for (const k of kids) walk(k)
  }
  walk(tree)
  return out
}
/** 在一段程式裡找第一個符合的語法節點——判準函式要直接餵它。 */
const astFind = (src: string, type: string): AstNode | null => {
  let hit: AstNode | null = null
  const walk = (n: AstNode): void => {
    if (!hit && n.type === type) hit = n
    for (const c of n.namedChildren) walk(c)
  }
  walk(parser.parse(src).rootNode as never)
  return hit
}

describe('解析器解錯的形狀①：後置遞減被套在一元運算外面', () => {
  it('★ 正向錨點：`!K--` 的語法樹真的是解錯的（否則下面在驗空氣）', () => {
    const node = astFind(`${H}int main(){ int K=3; if(!K--) ; return 0; }`, 'update_expression')
    expect(node, '🔴 連 update_expression 都找不到 → 這支測試壞了').not.toBeNull()
    const r = postfixUnderUnary(node!)
    expect(r, '🔴 判準認不出來了——tree-sitter 換版修好了嗎？那就該拆掉這條規則').not.toBeNull()
    expect(r!.unaryOp).toBe('!')
    expect(r!.inner.text).toBe('K')
  })

  it('★ 修好之後產回去【一字不差】——那對括號是我插的，不是使用者寫的', () => {
    expect(roundTrip('int K=3; if(!K--) cout<<"z";')).toContain('if (!K--)')
  })

  it('★ 身分對：外面是「不成立」，裡面才是遞減', () => {
    const src = `${H}int main(){ int K=3; if(!K--) cout<<"z"; return 0; }`
    const tree = lifter.lift(parser.parse(src).rootNode as never) as SemanticNode
    const dig = (n: SemanticNode): SemanticNode | null => {
      if (n.componentId === 'cpp:logic_not') return n
      for (const kids of Object.values(n.slots ?? {})) for (const k of kids) { const r = dig(k); if (r) return r }
      return null
    }
    const not = dig(tree)
    expect(not, '🔴 沒有「不成立」那一顆 → 修復沒發生').not.toBeNull()
    expect(not!.slots.operand?.[0]?.componentId).toBe('cpp:increment')
  })

  /**
   * 🔴 **`(*p)--` 是合法的 C++**——所以那個形狀的「唯一剩下的讀法」論證不成立，
   * 而規則刻意不收它。（實測 tree-sitter 對 `!*p--` 本來就解對。）
   */
  it('🔴 負向：只收 `!` `-` `~`，不得順手把 `*`／`&` 也收進來', () => {
    const node = astFind(`${H}int main(){ int q=1; int* p=&q; cout << (*p--); return 0; }`, 'update_expression')
    expect(node).not.toBeNull()
    expect(postfixUnderUnary(node!), '🔴 `*p--` 被認領了 → `(*p)--` 是合法的，這是誤判').toBeNull()
  })

  it('🔴 負向：沒有一元運算包著的後置遞減不得被動', () => {
    const node = astFind(`${H}int main(){ int K=3; cout << K--; return 0; }`, 'update_expression')
    expect(node).not.toBeNull()
    expect(postfixUnderUnary(node!)).toBeNull()
    expect(roundTrip('int K=3; cout << K-- << K;')).toContain('K--')
  })

  it('🔴 負向：前置形（`--K`）不在此列', () => {
    const node = astFind(`${H}int main(){ int K=3; cout << --K; return 0; }`, 'update_expression')
    expect(node).not.toBeNull()
    expect(postfixUnderUnary(node!)).toBeNull()
  })
})

describe('解析器解錯的形狀②：小於號被當成樣板的角括號', () => {
  it('★ 正向錨點：`a < b && c > -d` 真的被解成樣板（否則下面在驗空氣）', () => {
    const root = parser.parse(`${H}int main(){ int a=1,b=2,c=3,d=4; if(a < b && c > -d) ; return 0; }`)
      .rootNode as unknown as AstNode
    const hit = suspectTemplate(root, () => true)
    expect(hit, '🔴 判準認不出來了——tree-sitter 換版修好了嗎？那就該拆掉這條規則').not.toBeNull()
    expect(hit!.text).toBe('a')
  })

  /**
   * 🔴 **語料的 `AP325/7/7_3.cpp`：誤判的那顆在 `&&` 的【右】邊。**
   * 第一版的判準寫「`binary_expression` 的左子節點是 `template_function`」，
   * 於是這一支照樣紅，而**訊息與修之前一模一樣**。
   * > **一條「左子節點是 X」的規則，量到的是我舉的那個例子的形狀，不是那個病。**
   */
  it('🔴 誤判的那顆不一定在左邊（AP325/7/7_3 的 `i>=0 && i<m && j>=0 && j<n`）', () => {
    const body = 'int i=1,j=1,m=5,n=5; if(i>=0 && i<m && j>=0 && j<n) cout<<"in";'
    expect(roundTrip(body)).toContain('if (i >= 0 && i < m && j >= 0 && j < n)')
    /**
     * 🔴 症狀是**條件變成一句指定值**（`j>` 後面的 `=0` 被當成賦值），
     * 而那在 `cout` 那一行之前就炸了。所以斷言問的是身分。
     * ⚠️ 母體只有這一句，所以 `cpp:var_assign` 一顆都不該有
     *——宣告的初始值走的是 `*_declare` 不是 `var_assign`。
     */
    expect(ids(body), '🔴 後面的 `=0` 被當成指定值了').not.toContain('cpp:var_assign')
  })

  it('★ 修好之後產回去【一字不差】——`(a)` 那對括號不得留下', () => {
    const code = roundTrip('int a=1,b=2,c=3,d=4; if(a < b && c > -d) cout<<"y";')
    expect(code).toContain('if (a < b && c > -d)')
    expect(code, '🔴 我插進去的括號留在使用者的程式裡了').not.toContain('(a) <')
  })

  it('★ 身分對：頂層是「而且」，兩邊各是一個比較', () => {
    const got = ids('int a=1,b=2,c=3,d=4; if(a < b && c > -d) cout<<"y";')
    expect(got).toContain('cpp:logic')
    expect(got).toContain('cpp:compare')
    expect(got).not.toContain('cpp:raw_code')
    expect(got).not.toContain('cpp:template_function')
  })

  /**
   * 🔴 **這一條是整族裡最重要的一條。**
   * 判準是「那個名字宣告過嗎」——宣告過的才是誤判。真的樣板呼叫**不得被搶**。
   * ⚠️ `mx<int>(3,5)` 今天在執行期還是不支援（另一個缺口），
   *    所以這裡量的是**身分**不是輸出。
   * ⚠️ 樣板本體刻意寫成 `return a;`——第一版寫 `a>b?a:b`，於是那個比較
   *    **從本體裡**冒出來，測試紅了而缺陷不存在。
   *    > **一個負向斷言掃的是整棵樹時，母體裡不得有合法的同類。**
   */
  it('🔴 負向：真的樣板呼叫不得被認領（名字沒有被宣告成變數）', () => {
    const got = ids('cout << mx<int>(3,5);', 'template<class T> T mx(T a, T b){ return a; }')
    expect(got, '🔴 樣板呼叫被當成小於號重寫了').not.toContain('cpp:compare')
  })

  it('🔴 負向：解對了的 `a < b && c > d` 不得被動', () => {
    expect(roundTrip('int a=1,b=2,c=3,d=4; if(a < b && c > d) cout<<"y";'))
      .toContain('if (a < b && c > d)')
  })
})
