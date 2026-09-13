/**
 * **探針：課文〈完成的樣子〉用到的元件，這一課都宣告了嗎——而這一支在【秒】的量級。**
 *
 * ## 🔴 它為什麼存在：那條 e2e 要十五分鐘
 *
 * `e2e/lessons.spec.ts` 的「宣告的元件 ＝ 程式碼真的用到的元件」已經在驗同一件事，
 * 而它開瀏覽器、逐課載入。2026-09-13 改課文的那一輪，它在**第十二分鐘**才說出
 * 「第 16 課的程式碼用了沒宣告的 `cpp:arithmetic`」——一行 JSON 的漏字。
 *
 * > **一條驗證迴路如果比人的耐性長，它就會在最需要的時候被跳過。**
 *
 * 🟢 這一支走 lift，不開瀏覽器，一輪兩秒。形狀與 `lesson-solutions-run` 同一個模子。
 *
 * ## ⚠️ 它是【必要條件】，不是充分條件
 *
 * ```
 * 這一支驗得到   課文的程式碼 lift 出來的元件，都在 lesson.json 的 components 裡
 * 它驗不到       骨架那一批到底是哪幾顆（這裡寫死六顆，e2e 那一支【問 app】）
 * ```
 *
 * 🔴 所以它**不取代** e2e 那一支——它是寫課文時的快檔。
 * ⚠️ 骨架那張清單若在產品那側變了，這一支會開始誤報（而 e2e 不會）。
 *
 * ## ⚠️ 它不進 `npm test`
 *
 * 住在 `tests/probes/`。它要載 tree-sitter 的 wasm 與語言套件，
 * 而它答的是「我剛寫的課文對不對」，不是「這個 repo 的形狀」。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')
const LESSONS = path.join(ROOT, 'lessons')

/**
 * 骨架提供的那幾顆——課程刻意不教（前三課整個藏著它們）。
 * ⚠️ 與 `CLAUDE.md`／`audit-lesson-vocabulary` 同一張清單；那一側改了，這裡要跟。
 */
const SKELETON = new Set([
  'cpp:program', 'cpp:func_def', 'cpp:include',
  'cpp:using_namespace', 'cpp:return', 'cpp:literal_number',
])

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

function cppLessons(): { id: string; dir: string }[] {
  const out: { id: string; dir: string }[] = []
  for (const track of fs.readdirSync(LESSONS)) {
    const td = path.join(LESSONS, track)
    if (!fs.statSync(td).isDirectory()) continue
    for (const d of fs.readdirSync(td)) {
      const p = path.join(td, d)
      if (!fs.existsSync(path.join(p, 'lesson.json'))) continue
      const j = JSON.parse(fs.readFileSync(path.join(p, 'lesson.json'), 'utf8'))
      if ((j.pins?.target ?? 'cpp') !== 'cpp') continue   // ⚠️ 這一支只讀得懂 C++
      out.push({ id: `${track}/${d}`, dir: p })
    }
  }
  return out
}

describe('探針：課文用到的元件，這一課宣告了嗎（快檔，秒級）', () => {
  const CASES = cppLessons()

  it('入口條件：真的掃到課了', () => {
    expect(CASES.length, '🔴 一堂課都沒掃到 → 下面那一條是空過的').toBeGreaterThan(10)
  })

  it('硬性零：沒有一課用到自己沒宣告的元件', () => {
    const findings: string[] = []
    for (const c of CASES) {
      const j = JSON.parse(fs.readFileSync(path.join(c.dir, 'lesson.json'), 'utf8'))
      const md = fs.readFileSync(path.join(c.dir, 'lesson.md'), 'utf8')
      const code = md.split('## 完成的樣子')[1]?.split('\n## ')[0]
        ?.match(/```[a-z]*\n([\s\S]+?)\n```/)?.[1]
      if (code === undefined) { findings.push(`${c.id} · 抽不出〈完成的樣子〉的程式碼`); continue }

      const seen = new Set<string>()
      const walk = (n: unknown): void => {
        if (!n || typeof n !== 'object') return
        const node = n as { componentId?: string; slots?: Record<string, unknown[]> }
        if (node.componentId) seen.add(node.componentId)
        for (const k of Object.keys(node.slots ?? {})) for (const ch of node.slots![k] ?? []) walk(ch)
      }
      walk(lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode)

      const declared = new Set<string>(j.components ?? [])
      for (const id of [...seen].sort()) {
        // 🔴 結構節點（`param_decl` 之類）不帶冒號——學生在積木盤上看不到它們
        if (!id.includes(':') || SKELETON.has(id)) continue
        if (!declared.has(id)) findings.push(`${c.id} · 用了沒宣告的 ${id}`)
      }
    }
    expect(
      findings,
      '🔴 課文的程式碼用了這一課沒宣告的元件——學生在課堂上會找不到那幾顆積木。\n'
        + '🟢 修法：把它加進那一課 `lesson.json` 的 `components`。',
    ).toEqual([])
  }, 120_000)
})
