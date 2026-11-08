/**
 * **C++ → Python 沒有失真**——跨語言互轉第二對的驗收（spec 219）。
 *
 * ```
 * C++ 原文 ──lift──▶ 語意樹 ──convertCppToPython（型別由 Cella 給）──▶ Python 原始碼
 *   └──────────── Cella（lang cpp）                                  Cella（lang python）──┘
 *                              判決、輸出、assumes 相同
 * ```
 *
 * 整支換或不換（契約 C1）：課文的每一支解答不是「換過去且判決相同」就是「保留且附原因」——沒有第三種。
 * ⚠️ 正向錨點：「換過去」那一份要夠多（SC-001：至少一半），否則「全部保留」也會是綠的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { convertCppToPython } from '../../src/languages/cpp/cpp-to-python'
import { runCella, cellaTypesOfTree } from '../helpers/cella-run'
import type { SemanticNode } from '../../src/core/types'

let parser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
})

async function toPython(src: string): Promise<ReturnType<typeof convertCppToPython>> {
  const tree = lifter.lift(parser.parse(src)!.rootNode as never) as SemanticNode
  return convertCppToPython(tree, await cellaTypesOfTree(tree, { lang: 'cpp' }))
}

async function sameVerdict(src: string, py: string, stdin: string): Promise<void> {
  const a = await runCella(src, { lang: 'cpp', stdin })
  const b = await runCella(py, { lang: 'python', stdin })
  const show = `\n--- Python ---\n${py}--- C++: ${a.verdict} ${JSON.stringify(a.out)} / Python: ${b.verdict} ${JSON.stringify(b.out)} ${JSON.stringify(b.problems?.map((p) => p.reason ?? p.kind))}`
  expect(a.verdict, `C++ 那一側本身就不是 accept${show}`).toBe('accept')
  expect(b.verdict, show).toBe(a.verdict)
  expect(b.out, show).toBe(a.out)
  expect(b.assumes ?? [], show).toEqual(a.assumes ?? [])
}

const files = fs.readdirSync('lessons/cpp-beginner', { recursive: true }).map(String)
  .filter((f) => f.endsWith('.cpp') && f.includes('/solutions/')).sort().map((f) => `lessons/cpp-beginner/${f}`)

const stdinOf = (f: string): string => {
  const lesson = JSON.parse(fs.readFileSync(f.replace(/solutions\/.*/, 'lesson.json'), 'utf8'))
  const task = lesson.tasks.find((t: { id: string }) => t.id === path.basename(f, '.cpp').split('~')[0])
  return ((task?.check?.stdin ?? []) as string[]).map((l) => `${l}\n`).join('')
}

describe('C++ → Python：cpp-beginner 課文的解答', () => {
  const tally = { converted: [] as string[], kept: new Map<string, string[]>() }

  it('入口：讀到了課文的 C++ 解答', () => {
    expect(files.length).toBeGreaterThanOrEqual(60)
  })

  for (const f of files) {
    it(f.replace('lessons/cpp-beginner/', ''), async () => {
      const src = fs.readFileSync(f, 'utf8')
      const r = await toPython(src)
      if (r.code === null) {
        // 保留：每一筆都要有原因類別與說明（不是無原因的失敗）
        expect(r.reasons.length).toBeGreaterThan(0)
        for (const x of r.reasons) expect(x.detail.length, JSON.stringify(x)).toBeGreaterThan(0)
        for (const x of r.reasons) tally.kept.set(x.kind, [...(tally.kept.get(x.kind) ?? []), path.basename(path.dirname(path.dirname(f)))])
        return
      }
      tally.converted.push(f)
      await sameVerdict(src, r.code, stdinOf(f))
    }, 60_000)
  }

  it('★ 報表與門檻：換過去的至少一半（SC-001）；兩份加起來等於解答總數', () => {
    const kept = files.length - tally.converted.length
    console.log(`C++ → Python：換過去 ${tally.converted.length} 支／保留 ${kept} 支｜原因分佈 ${[...tally.kept].map(([k, v]) => `${k}:${v.length}`).join(' ')}`)
    expect(tally.converted.length, '換過去的不到一半').toBeGreaterThanOrEqual(Math.ceil(files.length / 2))
  })
})
