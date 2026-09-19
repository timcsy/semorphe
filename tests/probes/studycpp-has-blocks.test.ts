/**
 * **探針：語料真的用到的每一顆元件，使用者都拿得到一塊積木嗎。**
 *
 * ## 🔴 它與第十九條護欄（可拿性）問的不是同一件事
 *
 * ```
 * 第十九條   已經【做出來】的每一塊積木，都在某個分類裡嗎      宣告 → 工具箱
 * 本探針     語料真的【用到】的每一顆身分，都有一塊積木嗎      語料 → 宣告 → 工具箱
 * ```
 *
 * 前者的母體是「我做了什麼」，後者的母體是「學生寫了什麼」。
 * 一顆從來沒被做出來的元件，在第十九條眼裡**不存在**，所以它永遠是綠的。
 *
 * > **一條護欄看得到的，是我宣告過的那些；
 * > 而學生撞到的，是他寫得出來的那些。**
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果語料抬升出來的身分數低於 50，代表探針壞了，不是世界長這樣。**
 *
 * ## 它不檢測什麼
 *
 * - **不檢測放對分類**（第十九條自己的檔頭也這麼說）。
 * - **不檢測課程有沒有收錄**——那是策展。
 * - 🔴 **降級用的身分（`raw_code`／`unresolved`）獨立一欄**，不算「沒有積木」
 *   ——它們是誠實降級的出口，而它們**本來就有**灰色方塊。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { loadToolbox } from '../helpers/toolbox'
import { componentComponents } from '../../src/core/component/registry'
import { nonComponentDecl } from '../../src/core/blocks/non-components'
/**
 * ⚠️ **副作用匯入**：`param_decl`／`_compound`／`_multi_field` 的「我不是元件」
 * 宣告住在這個模組的**頂層**。少了它 `nonComponentDecl()` 看不到那三筆，
 * 而這支探針會把一個結構節點報成「學生看不到的積木」。
 *
 * 🔴 **同一個坑 `tests/helpers/toolbox.ts` 的檔頭也記過**（Python 的分類宣告）。
 * > **一個「問宣告」的判定，它的正確性綁在「那份宣告被載入了沒」上。**
 */
import '../../src/languages/cpp/module'
import type { SemanticNode } from '../../src/core/types'

const DIR = process.env.STUDYCPP_DIR ?? ''
const all = (d: string, acc: string[] = []): string[] => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) all(p, acc)
    else if (e.name.endsWith('.cpp')) acc.push(p)
  }
  return acc
}
const FS = DIR ? all(DIR).sort() : []

let tsParser: Parser
let lifter: ReturnType<typeof createTestLifter>
beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  lifter = createTestLifter()
}, 120_000)

describe.skipIf(FS.length === 0)('探針：語料用到的元件，都有積木嗎', () => {
  it('🔴 每一顆語料用到的身分，都要有一塊積木', () => {
    /** 語料真的用到的身分，以及各自出現在幾支程式裡。 */
    const used = new Map<string, number>()
    for (const f of FS) {
      const seen = new Set<string>()
      let tree: SemanticNode
      try { tree = lifter.lift(tsParser.parse(fs.readFileSync(f, 'utf8')).rootNode as never) as SemanticNode }
      catch { continue }
      const walk = (n: SemanticNode): void => {
        seen.add(n.componentId)
        for (const kids of Object.values(n.slots ?? {})) for (const k of kids) walk(k)
      }
      walk(tree)
      for (const id of seen) used.set(id, (used.get(id) ?? 0) + 1)
    }

    expect(used.size, '🔴 語料抬升出來的身分數過低 → 探針壞了，不是世界長這樣')
      .toBeGreaterThan(50)

    /** 有形態（積木）的身分——由膠囊自己宣告的 `paths.render` 決定。 */
    const hasForm = new Set(
      (componentComponents() as { componentId: string; paths?: Record<string, unknown> }[])
        .filter((c) => c.paths?.render != null)
        .map((c) => c.componentId))

    /** 使用者在**某一個**工具箱裡拿得到的積木型別。 */
    const inToolbox = new Set(loadToolbox().snapshot.categories.flatMap((c) => c.blocks))

    /**
     * 🔴 **「這個節點不是元件」由宣告回答，不由一張我手寫的表**（2026-09-19）。
     *
     * `core/blocks/non-components.ts` 已經把三種例外分好了，而且**每一筆都要理由**
     *（那個檔的檔頭逐字：「一個沒有理由的宣告，與『懶得處理』長得一模一樣」）。
     * 我第一版在這裡寫了一張 `DEGRADE` 常數表，而它**漏了 `param_decl`**
     * ——於是這支探針把一個結構節點報成「學生看不到的積木」。
     *
     * > **一張為了跳過幾筆而手寫的表，它漏掉的那幾筆會被報成缺陷。**
     */
    const noForm: string[] = []
    const notAComponent: string[] = []
    for (const [id, n] of used) {
      const decl = nonComponentDecl(id)
      if (decl) { notAComponent.push(`${id}（${n} 支，${decl.kind}）`); continue }
      if (!hasForm.has(id)) noForm.push(`${id}（${n} 支）`)
    }

    console.log([
      '',
      '──────────────────────────────',
      '  語料用到的元件，都有積木嗎',
      '──────────────────────────────',
      `  掃描          ${FS.length} 支程式`,
      `  用到的身分    ${used.size} 顆`,
      `  🔴 沒有積木   ${noForm.length} 顆`,
      ...noForm.sort().map((s) => `       ✘ ${s}`),
      `  ⚪ 不是元件   ${notAComponent.length} 顆（宣告過的三種例外，見 non-components.ts）`,
      ...notAComponent.sort().map((s) => `       ${s}`),
      `  工具箱裡的型別 ${inToolbox.size} 種`,
      '',
      '  ── 語料用最多的 15 顆 ──',
      ...[...used.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
        .map(([id, n]) => `    ${String(n).padStart(3)} 支  ${id}`),
    ].join('\n'))

    expect(noForm, '🔴 語料用得到而沒有積木的身分——學生在畫面上看不到它').toEqual([])
  }, 600_000)
})
