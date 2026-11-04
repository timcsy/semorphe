/**
 * **探針：Cella 對參照編譯器**（spec 212，6c-5；預設跳過，`SEMORPHE_REFCC_PROBE=1` 才跑）。
 *
 * ## 它量的是什麼——為什麼參照編譯器族退場了，這一支還留著
 *
 * `npm test` 的判準只剩 Cella（spec 212）。而有一類缺陷 Cella 自己看不到：
 * **我們的 formalize 把程式翻錯了，Cella 照那份錯的判 accept**。輸出看起來合理、判決是綠的，
 * 只有把**原始碼**交給真的編譯器跑才看得出來——參照編譯器是唯一獨立於我們翻譯的第三方。
 *
 * > 6c-5 之前這件事散在 12 支交叉檢查裡、每次全套都跑（本機要墊片、CI 要 g++，三次 CI 紅）。
 * > 現在收成這一支：要量的時候開，平常不付代價。
 *
 * ## 怎麼跑
 *
 * ```bash
 * SEMORPHE_REFCC_PROBE=1 SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim \
 *   [STUDYCPP_DIR=/path/to/StudyCpp] npx vitest run tests/probes/refcc-cross-check.test.ts
 * ```
 *
 * 母體：課文的 C++ 參考解答（判決綁定語料，餵課文宣告的測資）；有 `STUDYCPP_DIR` 時加上學生語料（測資照各支的讀取順序生）。
 * 判準：兩邊都跑完時輸出要相同；Cella 判不是 accept 的不算（那是 Cella 的覆蓋，另有探針量），只列數字。
 *
 * ⚠️ 自我否證：開了而機器上沒有參照編譯器 → **紅**（不是安靜跳過——「跳過的探針與不存在的探針長得一樣」）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { buildBindingCorpus } from '../helpers/binding-corpus'
import { runCella } from '../helpers/cella-run'
import { runCppDetailed, hasReferenceCompiler, referenceCompilerInfo } from '../helpers/run-cpp'
import { readSchedule, makeStdin } from '../helpers/stdin-from-tree'

const RUN = process.env.SEMORPHE_REFCC_PROBE === '1'

function lessonStdin(id: string): string {
  const m = /^([^/]+)\/([^/]+)\/(.+)\.cpp$/.exec(id)
  if (!m) return ''
  const meta = path.join('lessons', m[1], m[2], 'lesson.json')
  if (!fs.existsSync(meta)) return ''
  const task = (JSON.parse(fs.readFileSync(meta, 'utf8')).tasks ?? []).find((t: { id: string }) => t.id === m[3])
  return ((task?.check?.stdin as string[] | undefined) ?? []).map((l) => `${l}\n`).join('')
}

function studyCpp(): { id: string; code: string }[] {
  const dir = process.env.STUDYCPP_DIR
  if (!dir) return []
  const out: { id: string; code: string }[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else if (f.endsWith('.cpp')) out.push({ id: `StudyCpp/${path.relative(dir, f)}`, code: fs.readFileSync(f, 'utf8') })
    }
  }
  walk(dir)
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

describe.skipIf(!RUN)('探針：Cella 對參照編譯器（量我們的翻譯）', () => {
  let parser: Parser
  beforeAll(async () => {
    await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
    parser = new Parser()
    parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
  })

  it('★ 入口條件：開了就要有參照編譯器', () => {
    expect(hasReferenceCompiler(), '🔴 SEMORPHE_REFCC_PROBE=1 而這台機器沒有 C++ 編譯器——裝一個，或不要開這支探針').toBe(true)
    console.log(`參照編譯器：${JSON.stringify(referenceCompilerInfo())}`)
  })

  it('🔴 兩邊都跑完時，輸出相同', async () => {
    const lessons = buildBindingCorpus(parser)
      .filter((r) => r.program && r.id.endsWith('.cpp') && !r.id.startsWith('arduino/'))
      .map((r) => ({ id: r.id, code: r.text, stdin: lessonStdin(r.id) }))
    const students = await Promise.all(studyCpp().map(async (s) => {
      const first = await runCella(s.code)
      return { ...s, stdin: makeStdin(readSchedule(first.tree), 1).join('\n') + '\n' }
    }))
    const all = [...lessons, ...students]
    expect(lessons.length, '🔴 課文語料讀不到 → 下面的 0 是零樣本').toBeGreaterThan(50)

    const tally = { same: 0, differ: 0, refFailed: 0, cellaNotAccept: 0 }
    const differ: string[] = []
    for (const p of all) {
      const ref = runCppDetailed(p.code, p.stdin)
      if (!ref.ok) { tally.refFailed++; continue }
      const r = await runCella(p.code, { stdin: p.stdin, steps: 5_000_000 })
      if (r.verdict !== 'accept') { tally.cellaNotAccept++; continue }
      if (r.out === ref.output) tally.same++
      else { tally.differ++; differ.push(`${p.id}｜參照 ${JSON.stringify(ref.output).slice(0, 80)}｜Cella ${JSON.stringify(r.out).slice(0, 80)}`) }
    }
    console.log([`Cella 對參照編譯器：${all.length} 支（課文 ${lessons.length}、學生 ${students.length}）`,
      `  相同 ${tally.same}｜不同 ${tally.differ}｜參照跑不完 ${tally.refFailed}｜Cella 不是 accept ${tally.cellaNotAccept}`, ...differ].join('\n'))
    // 不同的每一筆要判：我們送錯（修 formalize）、Cella 錯（回報）、或依未指定行為（看 Cella 的 assumes）
    expect(differ).toEqual([])
  }, 3_600_000)
})
