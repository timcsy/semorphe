/**
 * **「跟著做／排一排」裡，行末註解不做成積木——而一個字都沒少**
 *
 * ## 🔴 它從哪來（2026-09-21）
 *
 * 授課老師逐字：
 *
 * > 在課文裡面的註解，因為轉過去都會變備注的灰積木，
 * > 但是**學生通常不需要拉這些積木**，所以看看是否可以在畫面上做個調整？
 *
 * 追問之後定的範圍：
 *
 * > 我希望在「跟著做」、「排一排」的情境把註解積木取消掉就好
 * > （**除非在講註解的單元**）
 *
 * ## ⚠️ 它是一個【有範圍的特例】，不是推翻 139
 *
 * [history/139](../../knowledge/history/139-註解變成一顆看得到的積木.md)
 * 是同一位使用者 2026-08-24 定的：「一般的 statement，註解在上面……
 * 可以讓學生比較容易看到註解」。**那條規矩在其他情境完全不動**
 * ——底下有一支反向錨點釘著它。
 *
 * 改變前提的讀數是：**在這個工具裡「看得見」與「拖得動」是同一件事**。
 * 那兩種題目的程式是課文給的，而一塊「放哪裡都對」的灰積木讀起來是工作。
 *
 * ## 🟢 而這條路比預設【更】一字不差
 *
 * 139 記著一個具名代價：行末註解會被搬到自己一行（`COMMENT_REFLOW`）。
 * 關掉之後註解變成前一個語句的 `annotations`，產碼用 `cs.trailing`
 * **貼回原來那一行的行末**——那個代價在這條路上不存在。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測自成一行的註解**——它本來就是獨立的一句話，照舊是一塊。
 * - **不檢測 app 怎麼決定要不要關**（那是 `commentsShouldBeBlocks`，
 *   一支 e2e 釘著它）。這裡只驗 lifter 的契約。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import '../../src/languages/cpp/skeletons'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const STYLE = apcs as unknown as StylePreset

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

const SRC = 'int main() {\n    int n = 10;\n    n += 5;        // 完全等於 n = n + 5;\n    cout << n << endl;    // 15\n    return 0;\n}\n'

function lift(src: string, asBlocks: boolean): SemanticNode {
  const l = createTestLifter()
  l.setCommentsAsBlocks(() => asBlocks)
  const t = l.lift(parser.parse(src)!.rootNode as never) as SemanticNode | null
  if (t === null) throw new Error('lift 回 null')
  return t
}

function ids(n: SemanticNode, out: string[] = []): string[] {
  out.push(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) ids(k, out)
  return out
}
function notes(n: SemanticNode, out: string[] = []): string[] {
  for (const a of n.annotations ?? []) if (a.position === 'inline') out.push(a.text)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) notes(k, out)
  return out
}

describe('「跟著做／排一排」裡，行末註解不做成積木', () => {
  it('★ 反向錨點：預設（其他情境）照舊是兩顆註解積木——139 沒有被推翻', () => {
    // 🔴 這一條先跑。它紅了表示我把 139 一起改掉了，而那不是使用者要的。
    const tree = lift(SRC, true)
    expect(ids(tree).filter((x) => x === 'cpp:comment')).toHaveLength(2)
    expect(notes(tree), '預設那一路不該產生 inline 標註').toEqual([])
  })

  it('🔴 關掉之後：一顆註解積木都沒有', () => {
    const tree = lift(SRC, false)
    // 🔴 **先證明樹是好的**——這一條是 2026-09-21 補的，而它抓到過一次真的翻車：
    //    `commentsLost()` 只認節點不認標註，於是整支 main 降級成一塊 `raw_code`，
    //    而**這一支與底下兩支同時變綠**（降級節點產碼時把原文原樣吐出來）。
    //
    // > **一個「某某不存在」的斷言，在整棵樹都不存在的時候也是綠的。**
    expect(ids(tree), '整棵樹降級了 → 下面驗的不是我以為的東西').not.toContain('cpp:raw_code')
    expect(ids(tree)).toContain('cpp:var_assign_compound')
    expect(ids(tree).filter((x) => x === 'cpp:comment')).toEqual([])
  })

  it('🔴 而原文一個字都沒少——它掛在前一個語句身上', () => {
    expect(notes(lift(SRC, false))).toEqual(['完全等於 n = n + 5;', '15'])
  })

  it('🔴 產回去時貼在【原來那一行的行末】', () => {
    const tree = lift(SRC, false)
    expect(ids(tree), '整棵樹降級了 → raw_code 會把原文原樣吐出來，這一條會空過')
      .not.toContain('cpp:raw_code')
    const out = generateCode(tree, 'cpp', STYLE)
    // ⚠️ 判準是「與那一行的程式碼同一行」，不是「字串裡有它」
    //    ——搬到自己一行的話後者照樣成立，而那正是這一刀要避開的。
    const line = out.split('\n').find((l) => l.includes('n += 5'))
    expect(line, 'n += 5 那一行不見了').toBeDefined()
    expect(line).toContain('// 完全等於 n = n + 5;')
    expect(out.split('\n').find((l) => l.includes('endl'))).toContain('// 15')
  })

  it('★ 反向錨點：預設那一路，註解【會】被搬到自己一行（139 記著的代價）', () => {
    // 🔴 沒有這一條的話，上面那條「貼在行末」可能兩邊都成立而測不出差別。
    const out = generateCode(lift(SRC, true), 'cpp', STYLE)
    expect(out.split('\n').find((l) => l.includes('n += 5')), '預設那一路竟然也貼在行末？')
      .not.toContain('//')
    expect(out).toContain('// 完全等於 n = n + 5;')   // ⚠️ 但它還在，只是換了行
  })

  /**
   * 🔴 **結構的表頭是【第二條】產生註解節點的路。**
   *
   * ⚠️ **下面這一行刻意不用反引號圍起來**：七支護欄拿「測試檔的反引號區間」
   * 當 C++ 語料（`tests/helpers/backtick-corpus.ts`），而它有分號與大括號
   * ——圍起來的話它會被當成一支學生的程式。（同一個坑今天第二次。）
   *
   *     while (n <= 5) {  // ② 條件
   *
   * 那一句註解在 AST 上是 `while_statement` 的
   * 直接子節點（不在 `block` 裡），由 `attachHeaderComments` 放進區塊的第一格
   *（139 的規則：「對於結構，註解在區塊內」）。
   *
   * ⚠️ 第一版只改了另一條路，於是**這一種照樣長出灰積木**，而其他的都沒有
   * ——量到 176 張圖裡剩 2 張。
   *
   * > **一個「幾乎都對」的規則，比一個沒有生效的規則難查
   * > ——後者一眼看得出來，前者要把母體整個數一遍。**
   */
  it('🔴 結構表頭的行末註解：不是積木，而且貼回【表頭那一行】', () => {
    const src = 'int main() {\n    while (n <= 5) {    // 條件\n        n = n + 1;\n    }\n    return 0;\n}\n'
    const tree = lift(src, false)
    expect(ids(tree), '整棵樹降級了').not.toContain('cpp:raw_code')
    expect(ids(tree).filter((x) => x === 'cpp:comment'), '🔴 表頭的註解還是一塊積木').toEqual([])
    const out = generateCode(tree, 'cpp', STYLE)
    const header = out.split('\n').find((l) => l.includes('while'))
    expect(header, 'while 那一行不見了').toBeDefined()
    // 🔴 判準是「貼在【表頭】那一行」——貼在收尾的 `}` 後面時
    //    `out.includes('// 條件')` 照樣成立，而那是錯的位置。
    expect(header).toContain('// 條件')
  })

  it('★ 反向錨點：結構表頭在預設那一路，照舊是區塊裡的一塊積木（139）', () => {
    const src = 'int main() {\n    while (n <= 5) {    // 條件\n        n = n + 1;\n    }\n    return 0;\n}\n'
    expect(ids(lift(src, true)).filter((x) => x === 'cpp:comment')).toHaveLength(1)
  })

  /**
   * 🔴 **沒有主體的節點，它的行末註解也要有人收**（2026-09-21，第 218 刀）。
   *
   * 這是追「步驟圖畫不乾淨的那 13 段」時翻出來的，而它是**既有缺陷**
   * ——兩種模式都會中：
   *
   *     #include <cstdlib>                    →  cpp:include   🟢
   *     #include <cstdlib>    // rand, srand  →  raw_code      🔴 整行變灰
   *
   * ⚠️ 那顆註解在 AST 上是 `preproc_include` 的**子節點**，所以
   * 「同一列的註解」那條分支看不到它（它看的是兄弟），而
   * `attachHeaderComments` 在沒有主體時直接讓開。沒有人收 ⟹
   * `commentsLost` 判「掉了」⟹ 誠實降級。
   *
   * > **一條「沒有東西可放就讓開」的路，讓開之後那個東西不會消失
   * > ——它會變成別人眼中的「掉了」。**
   */
  it('🔴 `#include` 帶行末註解：不得整行變灰，而註解留在行末', () => {
    const src = '#include <cstdlib>    // rand, srand\n#include <ctime>      // time'
    for (const asBlocks of [true, false]) {
      const tree = lift(src, asBlocks)
      expect(ids(tree), `asBlocks=${asBlocks} 時整行降級了`).not.toContain('raw_code')
      expect(ids(tree).filter((x) => x === 'cpp:include'), '兩個 include 都要在').toHaveLength(2)
      const out = generateCode(tree, 'cpp', STYLE)
      expect(out.split('\n').find((l) => l.includes('cstdlib')), '註解沒有留在那一行')
        .toContain('// rand, srand')
    }
  })

  it('★ 自成一行的註解，兩條路都照舊是一顆積木', () => {
    const src = 'int main() {\n    // 先算再印\n    int n = 1;\n    return 0;\n}\n'
    for (const asBlocks of [true, false]) {
      expect(ids(lift(src, asBlocks)).filter((x) => x === 'cpp:comment'),
        `asBlocks=${asBlocks} 時自成一行的註解不見了`).toHaveLength(1)
    }
  })
})
