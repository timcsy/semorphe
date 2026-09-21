/**
 * **探針：課文步驟裡那些程式碼片段，畫得出乾淨的積木嗎**
 *
 * ## 🔴 它要回答的問題（2026-09-21）
 *
 * 授課老師：「兩個學生要圖，我想應該是要連**跟著做的過程中拉積木的圖**也要給，
 * 不是只有完成品。」而使用者拍板的做法是「每一段步驟片段各畫一張」。
 *
 * ⚠️ **而在畫之前要先量一件事**：那些片段**不是完整的程式**
 * （69 課 352 段裡，完整程式只有 11 段）。一段 lift 不乾淨的片段會畫成
 * **灰色方塊**——而那比沒有圖更糟：
 *
 * > **一張示範「你這一步要拉什麼」的圖，如果畫出來的是一塊灰的，
 * > 它示範的是這個工具做不到那件事。**
 *
 * ## 它不是護欄
 *
 * 🔴 **它不進 `npm test`**（住在 `tests/probes/`）——它產出的是一份**讀數**，
 * 用來決定那 214 段裡哪些給圖、哪些列成待辦。護欄要等做法定案之後才寫。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { REPO_ROOT, printReport } from '../helpers/guardrail'
import { isDynamic } from '../../src/core/component/slot-check'
import '../../src/languages/cpp/skeletons'
import type { SemanticNode } from '../../src/core/types'

/** 步驟小節的標題長這樣：`## 三、把印出拉出來`。 */
const STEP_HEADING = /^#{2,3}\s+[一二三四五六七八九十]+、/

interface Frag { lesson: string; section: string; lang: string; code: string }

function fragments(): Frag[] {
  const out: Frag[] = []
  const root = path.join(REPO_ROOT, 'lessons')
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const dir of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const md = path.join(root, track.name, dir.name, 'lesson.md')
      if (!fs.existsSync(md)) continue
      let section: string | null = null
      let open = false
      let lang = ''
      let buf: string[] = []
      for (const line of fs.readFileSync(md, 'utf8').split('\n')) {
        if (!open && /^#{2,3}\s/.test(line)) { section = STEP_HEADING.test(line) ? line.replace(/^#+\s+/, '') : null }
        if (line.startsWith('```')) {
          if (!open) { open = true; lang = line.slice(3).trim(); buf = [] }
          else {
            open = false
            if (section !== null && buf.length > 0) {
              out.push({ lesson: `${track.name}/${dir.name}`, section, lang, code: buf.join('\n') })
            }
          }
          continue
        }
        if (open) buf.push(line)
      }
    }
  }
  return out
}

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

/** 樹裡有幾顆逃生艙（`raw_code`／`raw_expression`／`unresolved`）——問產品自己那一份。 */
function escapeHatches(tree: SemanticNode): number {
  let n = 0
  const walk = (node: SemanticNode): void => {
    if (isDynamic(node.componentId)) n++
    for (const kids of Object.values(node.slots ?? {})) for (const k of kids ?? []) walk(k)
  }
  walk(tree)
  return n
}

/** 樹裡總共幾顆。 */
function size(tree: SemanticNode): number {
  let n = 1
  for (const kids of Object.values(tree.slots ?? {})) for (const k of kids ?? []) n += size(k)
  return n
}

const CPP = new Set(['cpp', 'c', 'arduino', 'ino'])

describe('探針：課文步驟裡的程式碼片段，畫得出乾淨的積木嗎', () => {
  it('★ 入口條件：真的抓到片段了', () => {
    expect(fragments().length, '一段都沒抓到 → 掃描壞了').toBeGreaterThan(200)
  })

  it('量一次：C++ 那一族的片段，lift 之後有幾顆逃生艙', () => {
    const all = fragments()
    const cpp = all.filter((f) => CPP.has(f.lang))
    const clean: Frag[] = []
    const dirty: { f: Frag; hatches: number; size: number }[] = []
    const failed: Frag[] = []
    for (const f of cpp) {
      let tree: SemanticNode | null = null
      try {
        tree = createTestLifter().lift(parser.parse(f.code)!.rootNode as never) as SemanticNode | null
      } catch { tree = null }
      if (tree === null) { failed.push(f); continue }
      const h = escapeHatches(tree)
      if (h === 0) clean.push(f)
      else dirty.push({ f, hatches: h, size: size(tree) })
    }
    printReport('步驟片段：畫得出乾淨的積木嗎', [
      `步驟裡的片段（全部語言）   ${all.length}`,
      `  其中 C++ 那一族         ${cpp.length}`,
      `  🟢 沒有逃生艙           ${clean.length}`,
      `  🔴 有逃生艙（會出現灰塊） ${dirty.length}`,
      `  🔴 lift 回 null         ${failed.length}`,
      '',
      '⚠️ 依語言：' + [...new Set(all.map((f) => f.lang || '(無)'))].sort()
        .map((l) => `${l}=${all.filter((f) => (f.lang || '(無)') === l).length}`).join(' '),
      '',
      '有逃生艙的前 20 段：',
      ...dirty.slice(0, 20).map((d) =>
        `  ${d.f.lesson} 〈${d.f.section.slice(0, 18)}〉 ${d.hatches}/${d.size} 顆　${JSON.stringify(d.f.code.split('\n')[0].slice(0, 46))}`),
    ])
    // 🔴 探針不斷言缺陷數——它只要求自己真的量到了東西。
    expect(cpp.length, 'C++ 片段一段都沒有 → 語言標記的判斷壞了').toBeGreaterThan(50)
  })
})
