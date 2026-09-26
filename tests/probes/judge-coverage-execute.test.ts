/**
 * **探針：`execute` 那一路的判定者覆蓋率**（2026-09-25）
 *
 * ## 它在問什麼
 *
 * 契約框架推到最後剩下一個**還沒有分母**的數字：
 *
 * > **有幾條契約【沒有判定者】？**
 * > 一條沒有判定者的契約，讀起來與一條被判過的完全一樣。
 *
 * 而五路裡 `execute` 是**唯一有外部 oracle** 的那一路（`g++`）。
 * 它的判定者是「拿語料跟參照編譯器對答案」，而那條對照的母體是
 * **語料程式**，不是**元件**。
 *
 * ⟹ 所以覆蓋率不是「每顆元件都驗過」，是**「哪幾顆元件曾經出現在那條對照裡」**。
 *
 * ## ⚠️ 這支量的是【上界】，不是覆蓋率本身
 *
 * ```
 * 這支量的   一顆元件有沒有出現在語料的語義樹裡
 * 真正的     它有沒有出現在【兩邊都跑完的那幾支】裡（studycpp-behaves 量到 91/218）
 * ```
 *
 * 出現在語料裡是被對到的**必要條件**，不是充分條件。
 * ⟹ **上界低的話，真正的數字更低。** 而上界便宜得多。
 *
 * ## 🔴 為什麼這個數字重要
 *
 * `execute` 是五路裡最貴、最容易錯、而且**形狀完美的缺陷活得最久**的那一路
 * （語料曾量到 91 支裡 41 支輸出不同，而那兩族的 lift 與 generate 都是對的）。
 *
 * > **一個只錯在 `execute` 那一路的缺陷，形狀是完美的
 * > ——而形狀完美正是它活下來的原因。**
 *
 * 沒有出現在語料裡的元件，**它的執行語義從來沒有被任何外部權威看過**。
 *
 * ## 🔴 而有【兩份】語料用同一個 oracle，第一版只數了一份
 *
 * ```
 * StudyCpp        218 支   外部 repo，要 STUDYCPP_DIR
 * 🔴 課文的解答     88 支   【就在這個 repo 裡】，而第一百二十九條護欄
 *                         拿真的 g++ 跑它們（「課文承諾的答案，要有一台真的編譯器跑得出來」）
 * ```
 *
 * ⟹ 課文那一半**永遠跑得到**，所以這支探針只有 StudyCpp 那一半會跳過。
 *
 * > **問「有幾顆沒被看過」之前，要先數清楚【有幾雙眼睛】。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { allComponentDefs } from '../helpers/component-scan'
import type { SemanticNode } from '../../src/core/types'

const DIR = process.env.STUDYCPP_DIR ?? ''
let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (f: string) => `${process.cwd()}/public/${f}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
}, 180_000)

function walk(n: SemanticNode, seen: Set<string>): void {
  seen.add(n.componentId)
  for (const kids of Object.values(n.slots ?? {})) for (const k of kids) walk(k, seen)
}

function cppFiles(dir: string): string[] {
  const out: string[] = []
  if (!fs.existsSync(dir)) return out
  const rec = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) rec(p)
      else if (/\.(cpp|cc)$/.test(e.name)) out.push(p)
    }
  }
  rec(dir)
  return out
}

/** 走訪一批檔案，收出現過的身分。 */
function idsIn(files: readonly string[]): Set<string> {
  const seen = new Set<string>()
  const lifter = createTestLifter()
  for (const f of files) {
    const tree = parser.parse(fs.readFileSync(f, 'utf8'))
    if (!tree) continue
    const root = lifter.lift(tree.rootNode as never) as SemanticNode | null
    if (root) walk(root, seen)
  }
  return seen
}

describe('探針：execute 判定者的覆蓋率（上界）', () => {
  it('★ 兩份語料都要數到（母體不是空的）', () => {
    // 🔴 「零缺陷」與「零樣本」的讀數長得一模一樣——分開它們的只有入口條件。
    expect(cppFiles('lessons').length, '🔴 課文的解答檔沒讀到').toBeGreaterThan(50)
    if (DIR) expect(cppFiles(DIR).length, '🔴 StudyCpp 沒讀到').toBeGreaterThan(200)
  })

  it('🔴 有幾顆元件的執行語義，從來沒有被外部權威看過', () => {
    const lesson = cppFiles('lessons')
    const study = DIR ? cppFiles(DIR) : []
    const files = [...lesson, ...study]

    const seenLesson = idsIn(lesson)
    const seenStudy = idsIn(study)
    const seen = new Set([...seenLesson, ...seenStudy])

    // 只看 cpp：語料是 C++，而 python 那些本來就不在這條對照裡。
    const cpp = allComponentDefs()
      .map((d) => d.componentId)
      .filter((id) => id.startsWith('cpp:'))
      .sort()
    const covered = cpp.filter((id) => seen.has(id))
    const naked = cpp.filter((id) => !seen.has(id))

    // 🔴 **那 N 裡有幾個是量測工具自己的？**——這條規矩今年踩過六次，這裡先問一次。
    //
    //    裸的 130 顆不是同一種裸：Arduino 那一族的 oracle 是【實體板子】不是 `g++`，
    //    把它們算進這條對照的分母，量到的是「語料是競賽題」而不是「覆蓋率低」。
    const OTHER_ORACLE = /analog_|digital_|delay|dht_|eeprom|pwm_|servo|tone|wifi_|pulse|micros|millis|lcd_|serial|attach|interrupt|random_seed/
    const noLift = new Set(
      allComponentDefs()
        .filter((d) => (d.skipPaths ?? []).includes('lift') || d.paths?.lift == null)
        .map((d) => d.componentId),
    )
    const excused = naked.filter((id) => OTHER_ORACLE.test(id) || noLift.has(id))
    const realGap = naked.filter((id) => !excused.includes(id))
    const denom = cpp.length - excused.length

    console.log(`\n╔══ execute 判定者的覆蓋率（上界）══╗`)
    console.log(`語料：課文解答 ${lesson.length} 支（判定者＝audit-lesson-answers-vs-compiler 的 g++）`)
    console.log(`      StudyCpp ${study.length} 支${study.length === 0 ? '  ⚠️ 沒有 STUDYCPP_DIR，這一半沒數到' : ''}`)
    console.log(`      合計 ${files.length} 支｜樹裡出現的身分 ${seen.size} 種｜cpp 元件 ${cpp.length} 顆`)
    console.log(`\n  各自看到：課文 ${seenLesson.size} 種 · StudyCpp ${seenStudy.size} 種`)
    const onlyLesson = [...seenLesson].filter((i) => !seenStudy.has(i) && i.startsWith('cpp:'))
    console.log(`  🟢 只有課文看得到的：${onlyLesson.length} 顆 ← 少數了一份語料會漏掉的那些`)
    console.log(`\n  原始    出現 ${covered.length} / ${cpp.length}  (${Math.round(covered.length * 100 / cpp.length)}%)`)
    console.log(`  ⚠️ 而那個數字會誤導 —— 先扣掉【不該算進這條對照】的：`)
    console.log(`     · oracle 是實體板子不是 g++（Arduino 那一族）`)
    console.log(`     · lift 顯式是空的（降級目標、由父節點消費）`)
    console.log(`     扣掉 ${excused.length} 顆`)
    console.log(`\n  🟢 調整後  ${covered.length} / ${denom}  (${Math.round(covered.length * 100 / denom)}%)`)
    console.log(`  🔴 真的裸著 ${realGap.length} 顆 ← 它們的執行語義沒有被【任何】外部權威看過`)
    console.log(`\n真的裸著的（前 50）：`)
    for (const id of realGap.slice(0, 50)) console.log(`   ${id}`)

    // ★ 正向錨點：最常見的那幾顆一定要在，否則是走訪壞了不是覆蓋率低。
    for (const must of ['cpp:program', 'cpp:func_def', 'cpp:var_declare', 'cpp:if']) {
      expect(covered, `🔴 ${must} 沒出現在語料裡 —— 那不可能，是這支探針壞了`).toContain(must)
    }
    expect(covered.length, '🔴 覆蓋率為零 → 走訪壞了').toBeGreaterThan(20)
  }, 600_000)
})

