/**
 * **探針：課文的程式碼用了還沒教過的元件嗎？**（2026-09-07）
 *
 * 使用者回報：第 2 課的程式碼裡有 `// 整數`，而**註解是什麼從來沒說過**。
 *
 * 這一支量的是那個缺陷的**一般形式**：
 * 一課的程式碼裡出現的元件，有沒有在「這一課 ∪ 之前每一課」的
 * `components` 宣告裡出現過。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(process.cwd())

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
}, 60_000)

/** 課文裡每一段 ```cpp 區塊。 */
function cppBlocks(md: string): string[] {
  const out: string[] = []
  const lines = md.split('\n')
  let buf: string[] | null = null
  for (const l of lines) {
    if (buf === null) { if (/^```(cpp|c\+\+|arduino)\s*$/.test(l.trim())) buf = []; continue }
    if (l.trim() === '```') { out.push(buf.join('\n')); buf = null; continue }
    buf.push(l)
  }
  return out
}

function idsIn(root: SemanticNode | null | undefined, acc: Set<string>): void {
  if (!root || typeof root !== 'object') return
  if (typeof root.componentId === 'string' && root.componentId.includes(':')) acc.add(root.componentId)
  for (const b of Object.values(root.children ?? {})) for (const c of b ?? []) idsIn(c, acc)
}

interface Row { id: string; declared: string[]; used: string[] }

function lessons(track: string): Row[] {
  const dir = path.join(ROOT, 'lessons', track)
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => {
      const j = JSON.parse(fs.readFileSync(path.join(dir, d.name, 'lesson.json'), 'utf8')) as
        { components?: string[] }
      const md = fs.readFileSync(path.join(dir, d.name, 'lesson.md'), 'utf8')
      return { id: `${track}/${d.name}`, declared: j.components ?? [], used: cppBlocks(md) }
    })
}

/**
 * **骨架用掉的元件**——🔴 **導出的，不是宣告的**。
 *
 * 骨架宣告的是**程式碼字串**（`int main() {` · `return 0;` ·
 * `using namespace std;`），而「它用掉哪些元件」要 lift 一次才知道。
 *
 * ⚠️ 而它們**課程不該教**：第 1～3 課 `scaffold: hidden`，
 * 第 4 課「程式從哪開始」才是把它們拆開的那一課。
 */
function skeletonComponents(lifter: ReturnType<typeof createTestLifter>): Set<string> {
  const out = new Set<string>()
  for (const f of ['main.json', 'arduino.json', 'none.json']) {
    const j = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src/languages/cpp/skeletons', f), 'utf8')) as Record<string, any>
    const lines: string[] = []
    for (const p of (j.preamble ?? []) as { code: string }[]) lines.push(p.code)
    for (const e of (j.entryFunctions ?? []) as Record<string, any>[]) {
      for (const o of (e.open ?? []) as { code: string }[]) lines.push(o.code)
      for (const c of (e.close ?? []) as { code: string }[]) lines.push(c.code)
    }
    const code = lines.join('\n')
    try {
      idsIn(lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode, out)
    } catch { /* 探針 */ }
  }
  // ⚠️ `#include` 是 auto-include 加的，同樣是骨架的一部分（`scaffold` 藏著它）
  out.add('cpp:include')
  return out
}

describe('探針：課文用了還沒教過的元件', () => {
  it('量六軌', () => {
    const tracks = fs.readdirSync(path.join(ROOT, 'lessons'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name)
    const lifter = createTestLifter()
    const SKELETON = skeletonComponents(lifter)
    console.log(`【骨架導出】${[...SKELETON].sort().join(' ')}\n`)
    let total = 0
    for (const t of tracks) {
      // ⚠️ 只有 C++ 那一族的軌道用得上這個解析器
      if (t.startsWith('python')) continue
      const taught = new Set<string>()
      for (const row of lessons(t)) {
        for (const c of row.declared) taught.add(c)
        const used = new Set<string>()
        for (const code of row.used) {
          try {
            const tree = lifter.lift(parser.parse(code)!.rootNode as never) as SemanticNode
            idsIn(tree, used)
          } catch { /* 片段解析不了就跳過——這是探針 */ }
        }
        const missing = [...used].filter((c) => !taught.has(c) && !SKELETON.has(c)).sort()
        if (missing.length > 0) {
          total += missing.length
          console.log(`${row.id}\n    用了而沒教過：${missing.join(' ')}`)
        }
      }
    }
    console.log(`\n【合計】${total} 筆`)
    expect(true).toBe(true)
  }, 300_000)
})
