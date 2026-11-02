/**
 * 陣列初始值與標準演算法的執行
 *
 * ## 兩個都是「半條路修好」的病
 *
 * **陣列初始值**：`specs/050` 修好了辨識那半——`int a[3] = {1,2,3}` 的初始值
 * 會進到語義樹的 `values` 子槽。但**執行那半沒有接上**：`array_declare` 的
 * 執行器只按大小配置預設值，從來沒讀過 `values`。
 *
 * 於是 `int a[3]={3,1,2}; cout << a[0];` **輸出 0**。語義樹裡看得到值，跑起來
 * 卻是零——**半條路修好比沒修更難察覺**。
 *
 * **標準演算法**：`sort`／`reverse`／`fill`／`iota`／`partial_sum` 全部註冊成
 * 空操作。`sort(a, a+3)` 靜靜地什麼都不做，學生拿到未排序的陣列而毫無提示。
 *
 * 見 specs/053-declare-noop-execute/classification.md 的追加分類
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { expectCellaOut, runCella, describeCellaResult, knownCellaGap } from '../helpers/cella-run'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 60_000)

/** 包成完整程式交給 Cella 判（spec 202：執行判準從 JS 直譯器換成 Cella） */
const wrap = (body: string): string =>
  `#include <iostream>\n#include <algorithm>\n#include <numeric>\n#include <cstring>\nusing namespace std;\n` +
  `int main(){ ${body} return 0; }\n`

async function run(body: string, expected: string): Promise<void> {
  await expectCellaOut(wrap(body), expected)
}

describe('陣列初始值真的進到執行期', () => {
  it('int a[3] = {3,1,2} 讀得回原值', async () => {
    await run(`int a[3]={3,1,2}; cout << a[0] << a[1] << a[2];`, '312')
  })

  it('沒寫大小時，長度由初始值決定', async () => {
    await run(`int a[]={7,8}; cout << a[0] << a[1];`, '78')
  })

  it('初始值比大小少時，其餘補預設值', async () => {
    await run(`int a[3]={9}; cout << a[0] << a[1] << a[2];`, '900')
  })

  it('沒有初始值的區域陣列，讀它是未定義行為（Cella 判 reject）', async () => {
    // spec 202：原本期望 '00' 是 JS 直譯器的取捨（未初始化補 0）。C++：自動儲存期的陣列沒有初值時元素是不定值，
    // 讀它是 UB（[basic.indet]/2），g++ 印什麼都可能——改成斷言 reject 與種類
    const r = await runCella(wrap(`int a[2]; cout << a[0] << a[1];`))
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems.map((p) => p.kind)).toContain('ubUninit')
  })
})

describe('標準演算法不再是空操作', () => {
  it('sort 真的排序', async () => {
    await run(`int a[3]={3,1,2}; sort(a,a+3); cout << a[0] << a[1] << a[2];`, '123')
  })

  it('reverse 真的反轉', async () => {
    await run(`int a[3]={1,2,3}; reverse(a,a+3); cout << a[0] << a[2];`, '31')
  })

  it('fill 真的填值', async () => {
    await run(`int a[3]; fill(a,a+3,5); cout << a[0] << a[2];`, '55')
  })

  // 🟡 Cella 未支援（0.1.202611020258 判 unknown「std::iota is not supported yet」）；我們這側也還沒有 formalize（模型沒有就不送）。期望值 g++ 實測 13
  it('🟡 已知缺陷（修好時這條會紅）：iota 真的遞增填值', () => knownCellaGap(/翻不出（formalize 不收）[\s\S]*cpp:range_/, async () => {
    await run(`int a[3]; iota(a,a+3,1); cout << a[0] << a[2];`, '13')
  }))

  // 🟡 Cella 未支援（0.1.202611020258 判 unknown「std::partial_sum is not supported yet」）；我們這側也還沒有 formalize（模型沒有就不送）。期望值 g++ 實測 16
  it('🟡 已知缺陷（修好時這條會紅）：partial_sum 真的累加', () => knownCellaGap(/翻不出（formalize 不收）[\s\S]*cpp:range_/, async () => {
    await run(`int a[3]={1,2,3}; int b[3]; partial_sum(a,a+3,b); cout << b[0] << b[2];`, '16')
  }))

  it('★ 範圍只排一部分時，其餘不動', async () => {
    await run(`int a[4]={4,3,2,1}; sort(a,a+2); cout << a[0] << a[1] << a[2] << a[3];`, '3421')
  })

  it('★ 範圍解析不了時**出聲**，不是靜靜地什麼都不做', async () => {
    // 原本的空操作就是這種「安靜的錯」：程式跑完、結果錯了、沒有任何提示
    // spec 202：改由 Cella 判——要的是 reject，而且原因是「zzz 沒宣告」（不是翻不出／未支援的假綠）
    const r = await runCella(wrap(`int a[3]={1,2,3}; sort(zzz, zzz+3); cout << a[0];`))
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems.map((p) => p.reason).join('\n')).toMatch(/undeclared identifier 'zzz'/)
  })
})

describe('C 字串函式不再是空操作', () => {
  it('strcpy 真的複製', async () => {
    await run(`char s[8]; strcpy(s,"hi"); cout << s;`, 'hi')
  })

  it('strcat 真的串接', async () => {
    await run(`char s[8]="a"; strcat(s,"b"); cout << s;`, 'ab')
  })

  it('memset 存的是字元不是字碼', async () => {
    // 原本 `'a'` 求值成 97 直接塞進去，`cout << s` 印出 979797
    // spec 202：原本的程式沒有寫結尾的 NUL（s[3] 是不定值，`cout << s` 讀到它是 UB）——補上 `s[3]=0`，g++ 實測 aaa
    await run(`char s[4]; memset(s,'a',3); s[3]=0; cout << s;`, 'aaa')
  })

  it('★ memset 之後沒有結尾的 NUL，印它是未定義行為（Cella 判 reject）', async () => {
    // 原本 JS 直譯器照印 'aaa'；C++ 的 `cout << s` 讀到 s[3] 的不定值（[basic.indet]/2）
    const r = await runCella(wrap(`char s[4]; memset(s,'a',3); cout << s;`))
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems.map((p) => p.kind)).toContain('ubUninit')
  })

  it('memcpy 真的複製', async () => {
    await run(`char a[4]="ab"; char b[4]; memcpy(b,a,3); cout << b;`, 'ab')
  })

  it('★ 字元陣列印出來是字串，不是 [array]', async () => {
    // 這一個讓上面四個「看起來」都是壞的——壞的其實是輸出那一段
    await run(`char s[4]="ab"; cout << s;`, 'ab')
  })

  it('★ char s[4]="ab" 拆成字元，不是整串塞進 s[0]', async () => {
    await run(`char s[4]="ab"; cout << s[0] << s[1];`, 'ab')
  })

  it('★ 非字元陣列不受影響', async () => {
    await run(`int a[2]={1,2}; cout << a[0] << a[1];`, '12')
  })
})

describe('辨識不出來的程式碼不再被靜靜略過', () => {
  // spec 202：執行判準換成 Cella——兜底容器在 formalize 那一步就被拒收（不是交給 Cella 之後安靜地跳過）
  it('★ 交給 Cella 之前 raw_code 會出聲，不是什麼都沒發生', async () => {
    // 兜底容器原本註冊成空操作：使用者寫的一段程式什麼都沒發生、
    // 而且沒有任何提示——「靜默降級是 bug 的藏身之處」，這裡藏的是
    // 使用者自己的程式碼。
    const { createNode } = await import('../../src/core/semantic-tree')
    const { formalize } = await import('../../src/providers/cella/formalize')
    const fz = formalize(
      createNode('cpp:program', {}, { body: [createNode('cpp:raw_code', { code: 'asm volatile("nop")' }, {})] }),
      { lang: 'cpp' },
    )
    expect(fz.program).toBeNull()
    expect(fz.unknown.map((u) => u.construct)).toContain('cpp:raw_code')
  })

  it('★ 出聲的訊息指得回是哪一段程式碼', async () => {
    // 翻不出的那一筆帶著節點 id——產品拿它對回原始碼（那個節點身上就是 XYZZY_MARKER 那一段）
    const { createNode } = await import('../../src/core/semantic-tree')
    const { formalize } = await import('../../src/providers/cella/formalize')
    const raw = createNode('cpp:raw_code', { code: 'XYZZY_MARKER' }, {})
    const fz = formalize(createNode('cpp:program', {}, { body: [raw] }), { lang: 'cpp' })
    expect(fz.unknown.map((u) => u.nodeId)).toContain(raw.id)
    expect(raw.properties.code).toBe('XYZZY_MARKER')
  })
})

describe('條件編譯：#ifdef / #ifndef 的 body 真的會跑', () => {
  async function runPP(body: string, expected: string): Promise<void> {
    await expectCellaOut(`#include <iostream>\nusing namespace std;\nint main(){ \n${body}\n return 0; }\n`, expected)
  }

  // 條件編譯在前端展開（第 237 刀：cpp:ifdef／ifndef 的 formalize、函式裡的 #define）。期望值 g++ 實測 7
  it('#define 之後 #ifdef 的 body 會跑', async () => {
    await runPP(`#define N 1\n#ifdef N\ncout << 7;\n#endif`, '7')
  })

  // 條件編譯在前端展開（第 237 刀：cpp:ifdef／ifndef 的 formalize、函式裡的 #define）。期望值 g++ 實測 1
  it('未定義時 #ifdef 的 body 不跑', async () => {
    await runPP(`#ifdef ZZZ\ncout << 7;\n#endif\ncout << 1;`, '1')
  })

  // 條件編譯在前端展開（第 237 刀：cpp:ifdef／ifndef 的 formalize、函式裡的 #define）。期望值 g++ 實測 7
  it('未定義時 #ifndef 的 body 會跑', async () => {
    await runPP(`#ifndef ZZZ\ncout << 7;\n#endif`, '7')
  })

  // 條件編譯在前端展開（第 237 刀：cpp:ifdef／ifndef 的 formalize、函式裡的 #define）。期望值 g++ 實測 1
  it('已定義時 #ifndef 的 body 不跑', async () => {
    await runPP(`#define M 1\n#ifndef M\ncout << 7;\n#endif\ncout << 1;`, '1')
  })

  it('★ 巨集名本身不得被當成變數 lift 進 body', async () => {
    // 實測過：`childForFieldName('name')` 在這個位置不一定回傳巨集名節點，
    // 只比對物件參照的話 `N` 會變成 var_ref 進到 body，執行時報未宣告變數。
    const src = `#include <iostream>\nusing namespace std;\nint main(){ \n#define N 1\n#ifdef N\ncout << 7;\n#endif\n return 0; }\n`
    const tree = lifter.lift(tsParser.parse(src).rootNode as never) as SemanticNode
    const found: string[] = []
    const walk = (n: SemanticNode | null): void => {
      if (!n) return
      if (n.componentId === 'cpp:ifdef') for (const c of n.slots?.body ?? []) found.push(c.componentId)
      for (const a of Object.values(n.slots ?? {})) for (const c of a) walk(c)
    }
    walk(tree)
    expect(found, `body 裡混進了非程式碼的節點：${found.join('、')}`).not.toContain('cpp:var_ref')
  })
})
