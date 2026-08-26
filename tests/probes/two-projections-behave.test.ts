/**
 * **探測（不是護欄）**：同一棵語義樹的兩種投影，**跑起來一樣嗎**。
 *
 * ## 它從哪來——而它等了一輪
 *
 * `draft/2026-08-13-C和C++難分難捨.md`§六 逐字：
 *
 * > 「**編得過只是門檻。** 真正的對照是把兩邊都跑起來比輸出
 * > ——而那要**等①②修完**，因為今天有 4/10 段編不過，**分母不夠**。」
 *
 * ```
 * 昨天   4/10 編不過 → 分母不夠 → 問不了
 * 今天   🟢 10/10 編得過 → 分母補齊 → 【現在問得了】
 * ```
 *
 * ⚠️ 而 §二 的教訓正是為它寫的：
 * **「分母不夠時，任何『差異為 0』都不算數。」**
 *
 * ## 它驗的是根公理【沒有被驗過的那一半】
 *
 * ```
 * 今天驗的   兩種投影【各自】合法       c-style-parity（編得過）
 * 🔴 沒驗的  兩種投影【跑起來一樣】     ← 本檔
 * ```
 *
 * 「唯一真實，各式投影」——而**投影之間的一致性**在這之前沒有任何東西在看。
 *
 * ## ⚠️ 自我否證
 *
 * > **如果「兩邊都編得過的段數」低於下限，代表語料或編譯器沒進來，
 * > 這份報表不算數——不是「兩種投影一致」。**
 *
 * 錨在**兩邊都編得過的段數**（合成量）。
 * 🔴 **刻意不錨在「不一致數」**——那正是要推向零的東西。
 *
 * ## 為什麼是探測而不是護欄
 *
 * ⚠️ **第一次跑之前不知道那個數字**。`build-guardrail` 6.5：
 * 「先跑、確認紅、**逐項指名**、修好，**最後才產基線**」。
 * 🟢 **而它有一天該變成護欄**——「兩種投影跑起來一樣」有明確的目標值（0），
 * 而 6.8 的第三個問題（別台機器一樣嗎）在這裡**天然成立**：
 * **兩邊在同一台機器上跑同一批**，環境相依性抵銷掉了。
 *
 * ## 這支不檢測什麼
 *
 * - **不檢測積木側**——只比兩種**程式碼**投影
 * - **不檢測「輸出對不對」**——只比**兩邊一不一樣**
 * - ⚠️ **不檢測讀輸入／隨機的程式**——語料的篩選已經排掉它們，
 *   而**那不是遺漏，是它們不可判定**
 *
 * ## ⚠️ 而語料裡有一筆是壞的，那筆要留在「不可判定」欄裡
 *
 * 撈語料的做法是「抓測試檔裡的反引號字面」，而其中一筆是
 * **`int main` 三個字**（某支測試在驗解析器對殘缺輸入的行為）。
 * 它**兩邊都編不過**——而那不是我們的缺陷。
 *
 * > **一個從測試檔撈出來的語料庫，會撈到那些【刻意壞掉的樣本】。**
 *
 * 🔴 **而正確的處置是留在「不可判定」欄，不是把它篩掉**：
 * 篩掉的話分母會安靜地變小，而**縮分母比修分子容易**
 * （`build-guardrail` 6.5 的同一條）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import cStyle from '../../src/languages/cpp/styles/c.json'
import apcsStyle from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'
import { backtickSpans } from '../helpers/backtick-corpus'

const REPO_ROOT = process.cwd()
const C = cStyle as unknown as StylePreset
const CPP = apcsStyle as unknown as StylePreset

const hasCC = (() => {
  try { execSync('gcc --version && g++ --version', { stdio: 'ignore' }); return true } catch { return false }
})()

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${REPO_ROOT}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${REPO_ROOT}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 30000)

/** 與 `c-style-parity` 同一份篩選——⚠️ 排除的是「C 本來就沒有的」與「不可判定的」。 */
function neutralCorpus(limit: number): string[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  const out: string[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.test.ts')) continue
    for (const raw of backtickSpans(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      const c = raw.replace(/\\\\/g, '\\')
      if (!/int\s+main/.test(c) || c.includes('${')) continue
      if (/\b(class|vector|string|try|template|namespace\s+\w|new |delete |cin\s*>>|rand\s*\()/.test(c)) continue
      out.push(c)
      if (out.length >= limit) return [...new Set(out)]
    }
  }
  return [...new Set(out)]
}

/** 編譯並執行；回 `null` 代表**編不過**（不進分母）。 */
function compileRun(code: string, lang: 'c' | 'c++', dir: string, tag: string): string | null {
  const ext = lang === 'c' ? 'c' : 'cpp'
  const src = path.join(dir, `${tag}.${ext}`)
  const bin = path.join(dir, tag)
  fs.writeFileSync(src, code)
  const cc = lang === 'c' ? 'gcc -x c -std=c99' : 'g++ -x c++ -std=c++17'
  try {
    execSync(`${cc} -w -o ${bin} ${src}`, { stdio: 'pipe', timeout: 20000 })
    return execSync(bin, { stdio: 'pipe', timeout: 10000 }).toString()
  } catch { return null }
}

describe('探測：同一棵樹的兩種投影，跑起來一樣嗎', () => {
  it.skipIf(!hasCC)('★ 逐段比對輸出', () => {
    const corpus = neutralCorpus(12)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'twoproj-'))

    let both = 0
    const diffs: string[] = []
    const undecidable: string[] = []

    for (const [i, src] of corpus.entries()) {
      // 🔴 **同一棵樹**投影兩次——中間沒有第二次 lift。
      // 那是「切換不改語義樹」最強的證明：**根本沒有第二棵樹**。
      const tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode
      const outCpp = compileRun(generateCode(tree, 'cpp', CPP), 'c++', tmp, `x${i}cpp`)
      const outC = compileRun(generateCode(tree, 'cpp', C), 'c', tmp, `x${i}c`)

      // ⚠️ 有一邊編不過或跑不動 → **不可判定，不進任一邊**
      // （`build-guardrail` 第 5 步：為了讓數字好看而樂觀歸類，比沒有分類更糟）
      if (outCpp === null || outC === null) {
        undecidable.push(`${outCpp === null ? 'C++' : 'C'} 那一側跑不動：${src.slice(0, 120).replace(/\n/g, '⏎')}`)
        continue
      }
      both++
      if (outCpp !== outC) {
        diffs.push(`C++=${JSON.stringify(outCpp.slice(0, 40))} vs C=${JSON.stringify(outC.slice(0, 40))}\n     ${src.slice(0, 70).replace(/\n/g, '⏎')}`)
      }
    }
    fs.rmSync(tmp, { recursive: true, force: true })

    console.log(`\n  兩邊都跑得動 ${both} / ${corpus.length}｜🔴 輸出不一致 ${diffs.length}｜⚠️ 不可判定 ${undecidable.length}`)
    for (const d of diffs) console.log(`   🔴 ${d}`)
    for (const u of undecidable.slice(0, 4)) console.log(`   ⚠️ ${u}`)

    // ★ 入口條件——錨在**兩邊都跑得動的段數**（合成量），見檔頭的自我否證
    expect(
      both,
      `只有 ${both} 段兩邊都跑得動 → 語料或編譯器沒進來，這份報表不算數。` +
        `⚠️ 這不代表「兩種投影一致」。`,
    ).toBeGreaterThan(3)
  }, 180000)
})
