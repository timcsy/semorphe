/** 探針第二輪：轉得回去嗎。 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
const DIR = process.env.STUDYCPP_DIR ?? ''
let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

function files(): { rel: string; code: string }[] {
  const out: { rel: string; code: string }[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!/\.(cpp|cc)$/.test(e.name)) continue
      out.push({ rel: path.relative(DIR, p), code: fs.readFileSync(p, 'utf8') })
    }
  }
  walk(DIR)
  return out.sort((a, b) => a.rel.localeCompare(b.rel))
}

/** 語義指紋——只留「意義」，丟掉排版與位置。 */
function fp(n: SemanticNode | null | undefined): string {
  if (!n || typeof n !== 'object') return ''
  const props = Object.entries(n.properties ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`).join(',')
  const kids = Object.entries(n.children ?? {}).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, arr]) => `${k}[${(arr ?? []).map(fp).join('|')}]`).join('')
  return `(${n.componentId}${props ? ' ' + props : ''}${kids})`
}

const lift = (code: string): SemanticNode | null => {
  const t = parser.parse(code)
  if (!t) return null
  try { return createTestLifter().lift(t.rootNode as never) as SemanticNode } catch { return null }
}

describe.skipIf(!process.env.STUDYCPP_DIR)('探針：StudyCpp 轉得回去嗎', () => {
  it('★ lift → 產碼 → 再 lift，語義還是同一棵嗎', () => {
    const all = files()
    let ok = 0, drift = 0, genErr = 0, reliftErr = 0
    const cases: { rel: string; a: string; b: string; src: string; out: string }[] = []
    for (const f of all) {
      const a = lift(f.code)
      if (!a) continue
      let out: string
      try { out = generateCode(a, 'cpp', S) } catch { genErr++; continue }
      const b = lift(out)
      if (!b) { reliftErr++; continue }
      if (fp(a) === fp(b)) { ok++; continue }
      drift++
      if (cases.length < 12) cases.push({ rel: f.rel, a: fp(a), b: fp(b), src: f.code, out })
    }
    console.log(`\n╔══ 轉得回去嗎（語義不動點）══╗`)
    console.log(`同一棵 ${ok}｜走樣 ${drift}｜產碼丟例外 ${genErr}｜產出的碼 lift 不回來 ${reliftErr}`)
    for (const c of cases) {
      console.log(`\n── ${c.rel} ──`)
      // 找第一個差異點
      let i = 0
      while (i < c.a.length && i < c.b.length && c.a[i] === c.b[i]) i++
      const w = 110
      console.log(`  原 …${c.a.slice(Math.max(0, i - 40), i + w)}`)
      console.log(`  後 …${c.b.slice(Math.max(0, i - 40), i + w)}`)
    }
    expect(true).toBe(true)
  }, 900_000)
})
