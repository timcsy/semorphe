/**
 * **判決綁定語料**（Cella 的衍生原則 C18「判決綁定」）的產生流程——`tests/probes/binding-corpus.test.ts`（交給 cella 的語料）與
 * `tests/probes/binding-verdict.test.ts`（在我們這側跑 Cella 的判決）共用（spec 180 T010，第 394 刀抽出）。
 *
 * 每一筆：`id`、`text`（產品的產碼路徑產回來的程式碼）、`tree`（交給 formalize 的那一棵——含補丁器補的骨架節點）、
 * 以及 `program`（翻得出時）或 `unknown`（翻不出的理由）。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Parser } from 'web-tree-sitter'
import { createTestLifter } from './setup-lifter'
import { generateCode, setHeaderAliases } from '../../src/core/projection/code-generator'
import cTarget from '../../src/languages/cpp/targets/c.json'
import '../../src/languages/cpp/pack'
import { languagePack } from '../../src/core/language-packs'
import { formalize, cellaBoardOf } from '../../src/providers/cella/formalize'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import google from '../../src/languages/cpp/styles/google.json'
import cStyle from '../../src/languages/cpp/styles/c.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

export interface BindingRow {
  id: string
  text: string
  tree: SemanticNode
  program?: unknown
  unknown?: { nodeId: string; construct: string; reason: string }[]
}

export interface Source { id: string; code: string; board?: string; lang?: 'c' | 'cpp' }

/**
 * 課文裡的 C++ 程式碼區塊——**逐行**認圍籬。
 * 🔴 第 390 刀之前用一支正則，而它要求開頭是「```cpp」緊接換行：「```cpp demo」對不上，
 *    於是**收尾的 ``` 被當成下一塊的開頭**，之後整課錯位（伺服那課因此只收到一個沒宣告 `s` 的片段，完整的 sketch 漏掉）。
 */
function fencedBlocks(md: string): string[] {
  const out: string[] = []
  let cur: string[] | null = null
  let keep = false
  for (const line of md.split('\n')) {
    const fence = /^```(\S*)/.exec(line)
    if (cur === null) {
      if (fence) { cur = []; keep = ['', 'cpp', 'c++', 'arduino', 'ino'].includes(fence[1]) }
    } else if (/^```\s*$/.test(line)) {
      if (keep) out.push(cur.join('\n') + '\n')
      cur = null
    } else cur.push(line)
  }
  return out
}

export function sources(): Source[] {
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
    for (const code of fencedBlocks(fs.readFileSync(md, 'utf8'))) {
      // 只收完整的 sketch：課文中段的片段（`s.attach(9);` 而 `Servo s;` 在上一段）不是一支程式
      if (!/void\s+setup\s*\(/.test(code) || !/void\s+loop\s*\(/.test(code)) continue
      out.push({ id: `arduino/${lesson}/sketch-${++i}`, code, board: cellaBoardOf(target) })
    }
  }
  return out
}


/** 產生整份語料（`parser` 由呼叫端初始化好：tree-sitter-cpp，並已 `registerCppLanguage()`）。 */
export function buildBindingCorpus(parser: Parser): BindingRow[] {
  // 🔴 走產品的那一份 shaping（語言套件交出來的）：文字用補丁器、交給 formalize 的樹用骨架積木那一棵
  //    ——補丁器補的 `#include`／`using` 也要在 program 裡（cella 比對判決綁定語料時指出），而那幾顆正是畫面上淡色的骨架積木
  const shaping = languagePack('cpp')!.createCodeShaping!() as {
    patchCode: (...a: unknown[]) => string | null
    autoIncludeNodes: (t: SemanticNode, ns: 'using' | 'explicit', styleId: string) => SemanticNode[]
  }
  const rows: BindingRow[] = []
  for (const s of sources()) {
    const tree = createTestLifter().lift(parser.parse(s.code)!.rootNode as never) as SemanticNode
    const style = (s.board ? google : s.lang === 'c' ? cStyle : apcs) as unknown as StylePreset
    // 產品依目標設定標頭別名（`app.ts` 的 setHeaderAliases）——C 程式要 `<stdio.h>` 不是 `<cstdio>`（cella 2026-10-31 比對時指出）
    setHeaderAliases(s.lang === 'c' ? (cTarget as { headerAliases?: Record<string, string> }).headerAliases : undefined)
    const raw = generateCode(tree, 'cpp', style)
    const text = shaping.patchCode(raw, tree, style.namespace_style, 1, s.board ? 'arduino' : 'main', style.id) ?? raw
    const shown = { ...tree, slots: { ...tree.slots, body: [...shaping.autoIncludeNodes(tree, style.namespace_style, style.id), ...(tree.slots.body ?? [])] } }
    const f = formalize(shown, { board: s.board, lang: s.lang })
    rows.push(f.program ? { id: s.id, text, tree: shown, program: f.program } : { id: s.id, text, tree: shown, unknown: f.unknown as never })
  }
  setHeaderAliases(undefined)
  return rows
}
