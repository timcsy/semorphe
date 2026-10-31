/**
 * **C18 判決綁定的語料**（spec 180 T009）：每一筆 `{id, text, program?}`，交給 Cella 的 CI。
 *
 * - `text`：semorphe 的 render（程式碼）——課文解答 lift 之後，用產品的產碼路徑（產生器 → 補丁器）產回來的 C++。
 * - `program`：formalize 翻得出時附上 Cella 的程式 JSON；翻不出來的不送（unknown 的理由另列在 `unknown`）。
 *
 * Cella 拿 clang 讀「semorphe 的 text」與「Cella 的 generate(program)」，比兩棵樹（綁定比對，四之十三後的 cella 回覆）。
 * ⚠️ 只有設了 `C18_CORPUS_OUT=<路徑>` 才寫檔——不讓 npm test 有副作用（our-verdicts 那一次的教訓）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { createTestLifter } from '../helpers/setup-lifter'
import { generateCode, setHeaderAliases } from '../../src/core/projection/code-generator'
import cTarget from '../../src/languages/cpp/targets/c.json'
import { createCppCodePatcher } from '../../src/languages/cpp/auto-include'
import { createPopulatedRegistry } from '../../src/languages/cpp/std'
import { formalize, cellaBoardOf } from '../../src/providers/cella/formalize'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import google from '../../src/languages/cpp/styles/google.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})

interface Source { id: string; code: string; board?: string; lang?: 'c' | 'cpp' }

function sources(): Source[] {
  const out: Source[] = []
  for (const track of ['cpp-beginner', 'cpp-advanced', 'c-bridge']) {
    for (const lesson of fs.readdirSync(path.join('lessons', track))) {
      const dir = path.join('lessons', track, lesson, 'solutions')
      if (!fs.existsSync(dir)) continue
      for (const f of fs.readdirSync(dir).filter((x) => /\.(cpp|c)$/.test(x))) {
        out.push({ id: `${track}/${lesson}/${f}`, code: fs.readFileSync(path.join(dir, f), 'utf8'), lang: f.endsWith('.c') ? 'c' : 'cpp' })
      }
    }
  }
  // Arduino 的課把 sketch 寫在 lesson.md 的程式碼區塊裡；板子看 lesson.json 的 pins.target
  for (const lesson of fs.readdirSync('lessons/arduino')) {
    const md = path.join('lessons/arduino', lesson, 'lesson.md')
    const meta = path.join('lessons/arduino', lesson, 'lesson.json')
    if (!fs.existsSync(md) || !fs.existsSync(meta)) continue
    const target = (JSON.parse(fs.readFileSync(meta, 'utf8')).pins?.target as string | undefined) ?? 'arduino-uno'
    let i = 0
    for (const m of fs.readFileSync(md, 'utf8').matchAll(/```(?:cpp|c\+\+|arduino|ino)?\n([\s\S]*?)```/g)) {
      if (!/void\s+setup\s*\(/.test(m[1])) continue
      out.push({ id: `arduino/${lesson}/sketch-${++i}`, code: m[1], board: cellaBoardOf(target) })
    }
  }
  return out
}

describe('C18 判決綁定的語料', () => {
  it('★ 每一份來源都產得出 text；翻得出的附 program', () => {
    const patch = createCppCodePatcher(createPopulatedRegistry() as never)
    const rows: Record<string, unknown>[] = []
    for (const s of sources()) {
      const tree = createTestLifter().lift(parser.parse(s.code)!.rootNode as never) as SemanticNode
      const style = (s.board ? google : s.lang === 'c' ? cStyle : apcs) as unknown as StylePreset
      // 產品依目標設定標頭別名（`app.ts` 的 setHeaderAliases）——C 程式要 `<stdio.h>` 不是 `<cstdio>`（cella 2026-10-31 比對時指出）
      setHeaderAliases(s.lang === 'c' ? (cTarget as { headerAliases?: Record<string, string> }).headerAliases : undefined)
      const raw = generateCode(tree, 'cpp', style)
      const text = (patch as (...a: unknown[]) => string | null)(raw, tree, style.namespace_style, 1, s.board ? 'arduino' : 'main', style.id) ?? raw
      const f = formalize(tree, { board: s.board, lang: s.lang })
      rows.push(f.program ? { id: s.id, text, program: f.program } : { id: s.id, text, unknown: f.unknown })
    }
    setHeaderAliases(undefined)
    const cRows = rows.filter((r) => String(r.id).startsWith('c-bridge/'))
    expect(cRows.filter((r) => String(r.text).includes('<cstdio>')).map((r) => r.id), '🔴 C 程式的 text 用了 C++ 的標頭').toEqual([])
    const withProgram = rows.filter((r) => r.program).length
    console.log(`C18 語料：${rows.length} 筆，附 program 的 ${withProgram} 筆`)
    expect(rows.length).toBeGreaterThan(90)
    if (process.env.C18_CORPUS_OUT) {
      fs.writeFileSync(process.env.C18_CORPUS_OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n')
      console.log(`寫到 ${process.env.C18_CORPUS_OUT}`)
    }
  })
})
