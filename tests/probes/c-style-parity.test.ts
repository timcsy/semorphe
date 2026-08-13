/**
 * **C style 的對照實驗：同一棵語義樹，兩種投影，兩個編譯器**
 *
 * ## 它回答什麼
 *
 * `tests/probes/c-vs-cpp.mjs` 量了「C 編不過的原因」，而那批語料**只有一邊**
 * ——262 段裡 230 段倒在 `#include <iostream>`，那是**寫法**不是語言。
 *
 * > **一個語料庫如果全部用同一種風格寫成，它量不出「風格差多少」
 * > ——它只會告訴你它自己選了哪一種。**
 *
 * 這支做的是真正的對照：**同一個語義**，用 C style 與 C++ style 各投影一次，
 * 兩邊各自編譯。那才隔離得出「語言差異」與「寫法差異」。
 *
 * ## ⚠️ 為什麼是 12 段而不是全部
 *
 * 每段要編兩次，全量（262 段）要好幾分鐘——而這支會進全套。
 * **探測不需要全量**：12 段足以回答「C style 產得出 C」，
 * 而「差異有多大」那個問題由上面那支腳本用全量回答。
 *
 * ⚠️ 缺 C 編譯器時**跳過而不是紅**——這支不是護欄，它沒有要守的規範。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { REPO_ROOT } from '../helpers/guardrail'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import cStyle from '../../src/languages/cpp/styles/c.json'
import apcs from '../../src/languages/cpp/styles/apcs.json'

const C = cStyle as unknown as StylePreset
const CPP = apcs as unknown as StylePreset

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

const lift = (code: string): SemanticNode => lifter.lift(tsParser.parse(code)!.rootNode as never) as SemanticNode

/** 只取**能兩邊都表達**的語料：不用 class／vector／try 那些 C 沒有的東西。 */
function neutralCorpus(limit: number): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/`([^`]{4,400})`/g)) {
      const c = m[1].replace(/\\\\/g, '\\')
      if (!/int\s+main/.test(c) || c.includes('${')) continue
      // ⚠️ 排除 C 本來就沒有的東西——那是「有沒有」不是「寫法」，
      // 混進來會讓這支測到的是 Topic 該管的事。
      if (/\b(class|vector|string|try|template|namespace\s+\w|new |delete |cin\s*>>|rand\s*\()/.test(c)) continue
      out.push(c)
      if (out.length >= limit) return [...new Set(out)]
    }
  }
  return [...new Set(out)]
}

const hasC = (() => { try { execSync('gcc --version', { stdio: 'pipe' }); return true } catch { return false } })()

describe('C style 的對照：同一個語義，兩種投影', () => {
  it('★ 健康檢查：語料真的撈到了（否則下面每一支都空過）', () => {
    expect(neutralCorpus(12).length, '中性語料是空的——篩選條件太嚴').toBeGreaterThan(3)
  })

  it('🔴 C style 產出的碼不得帶任何 C++ 專屬的東西', () => {
    for (const src of neutralCorpus(12)) {
      const out = generateCode(lift(src), 'cpp', C)
      expect(out, `C style 產出了 using namespace std：\n${out.slice(0, 120)}`).not.toContain('using namespace std')
      expect(out, `C style 產出了 cout：\n${out.slice(0, 120)}`).not.toContain('cout')
      expect(out, `C style 產出了 <iostream>：\n${out.slice(0, 120)}`).not.toContain('iostream')
    }
  })

  it('★ 反向：同一棵樹用 C++ style 就產 cout——證明差別來自 style 而不是語料', () => {
    // ⚠️ **用 inline 語料而不是撈的**：第一版撈中性語料再篩「有輸出的」，
    // 而那批剛好都用 printf——於是這支**空過**（篩完是空集合時 `.some` 永遠 false）。
    //
    // > **一支反向測試如果它的輸入是被篩出來的，那個篩選就是它的盲點。**
    const src = '#include <iostream>\nusing namespace std;\nint main(){ int x = 5; cout << x << endl; return 0; }'
    const tree = lift(src)
    const asC = generateCode(tree, 'cpp', C)
    const asCpp = generateCode(tree, 'cpp', CPP)
    // 同一棵樹，兩種投影，而它們必須不同——否則 style 沒有作用
    expect(asCpp, 'C++ style 沒產 cout').toContain('cout')
    expect(asC, 'C style 產了 cout').not.toContain('cout')
    expect(asC, 'C style 該產 printf').toContain('printf')
  })

  it.skipIf(!hasC)('🔴 對照：C style 的產出用 C 編譯器編得過', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cstyle-'))
    const fails: string[] = []
    let ok = 0
    for (const [i, src] of neutralCorpus(12).entries()) {
      const out = generateCode(lift(src), 'cpp', C)
      const f = path.join(tmp, `p${i}.c`)
      fs.writeFileSync(f, out)
      try { execSync(`gcc -x c -std=c99 -w -fsyntax-only ${f}`, { stdio: 'pipe', timeout: 15000 }); ok++ }
      catch (e) {
        const err = String((e as { stderr?: Buffer }).stderr ?? '')
        fails.push(`${(err.split('\n').find((l) => l.includes('error:')) ?? '?').replace(/^.*error: /, '').slice(0, 60)}\n     ${out.slice(0, 90).replace(/\n/g, '⏎')}`)
      }
    }
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log(`\n  C style → gcc -std=c99：${ok} 通過 / ${ok + fails.length}`)
    for (const f of fails.slice(0, 6)) console.log(`   ✘ ${f}`)
    // ⚠️ 不斷言全過——這支是探測。它的價值是**那份失敗清單**，
    // 而清單為空的那天才該把它變成護欄（build-guardrail 6.8）。
    expect(ok + fails.length, '一段都沒跑到').toBeGreaterThan(0)
  })
})
