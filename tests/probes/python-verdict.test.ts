/**
 * **Python 課文的解答交給 Cella 判決**（spec 195；同 C 家族的 `binding-verdict`）。
 *
 * 驗收（〈重構〉Python formalize 那一段）：
 * - 課文 Python 解答**全部翻得出**（formalize 不留 unknown）；
 * - Cella 的 `python.verdict` 判 accept 的，**輸出與課文宣告的一致**（`check.stdout`，餵 `check.stdin`）。
 * ⚠️ 入口條件先於讀數：解答要有幾十份；一支故意寫壞的（未定義的名字）必須判出 NameError（accept、exit 1、帶 problem）——
 *    〈零缺陷與零樣本的讀數長得一模一樣〉。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { liftPython } from '../helpers/python-lift'
import { formalizePython } from '../../src/providers/cella/formalize/python'
import { createCellaChecker, type CellaChecker } from '../../src/providers/cella/verdict'
import { compareOutput } from '../../src/core/lesson/lesson'

const read = (pkg: string | null, file: string): Uint8Array =>
  fs.readFileSync(path.join('node_modules', pkg === null ? 'cella-lang' : `@cella-lang/${pkg}`, file))

interface Sol { id: string; code: string; stdin: string; stdout?: string }
function solutions(): Sol[] {
  const out: Sol[] = []
  for (const track of ['python-beginner', 'python-bridge']) {
    for (const lesson of fs.readdirSync(path.join('lessons', track))) {
      const dir = path.join('lessons', track, lesson, 'solutions')
      const meta = path.join('lessons', track, lesson, 'lesson.json')
      if (!fs.existsSync(dir)) continue
      const tasks = fs.existsSync(meta) ? (JSON.parse(fs.readFileSync(meta, 'utf8')).tasks ?? []) as { id: string; check?: { stdin?: string[]; stdout?: string } }[] : []
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.py'))) {
        const c = tasks.find((t) => t.id === f.replace(/\.py$/, ''))?.check
        out.push({ id: `${track}/${lesson}/${f}`, code: fs.readFileSync(path.join(dir, f), 'utf8'), stdin: (c?.stdin ?? []).map((l) => `${l}\n`).join(''), stdout: c?.stdout })
      }
    }
  }
  return out
}

/**
 * **已知翻不出、而且原因在別處的**——要與實際翻不出的【完全相符】：修好了也會紅（提醒拿掉這一筆），不是安靜地放過。
 */
const KNOWN_GAPS: Record<string, string> = {
  // 🪦 'python-beginner/12-文字處理/ex1.py'（math_max 的 key=）——cella 對照表 c4c423b3e 修好（2026-11-01）
}

let checker: CellaChecker
const sols = solutions()
const rows: { s: Sol; program: unknown; unknown: unknown[] }[] = []

beforeAll(async () => {
  for (const s of sols) {
    const tree = await liftPython(s.code)
    const r = tree ? formalizePython(tree) : { program: null, unknown: [{ nodeId: '-', construct: '-', reason: 'lift 失敗' }] }
    rows.push({ s, program: r.program, unknown: r.unknown })
  }
  checker = await createCellaChecker(read, ['python'])
}, 900_000)

describe('Python 課文的解答交給 Cella 判決', () => {
  it('★ 入口條件：解答有幾十份；寫壞的程式判得出 NameError', async () => {
    expect(sols.length).toBeGreaterThan(30)
    const tree = await liftPython('print(nope)\n')
    const r = formalizePython(tree!)
    expect(r.program).not.toBeNull()
    const v = checker.verdict(r.program)
    expect(v.verdict).toBe('accept')
    expect(JSON.stringify(v.problems)).toMatch(/NameError/)
  })

  it('🔴 全部翻得出；accept 的輸出與課文一致', () => {
    const notTranslated = rows.filter((r) => !r.program).map((r) => `  ${r.s.id}：${JSON.stringify(r.unknown).slice(0, 200)}`)
    const tally: Record<string, number> = {}
    const detail: string[] = []
    const wrongOut: string[] = []
    for (const r of rows.filter((x) => x.program)) {
      const v = checker.verdict(r.program, r.s.stdin, 5_000_000)
      tally[v.verdict] = (tally[v.verdict] ?? 0) + 1
      if (v.verdict !== 'accept') detail.push(`  ${v.verdict.padEnd(7)} ${r.s.id}  ${v.problems.map((p) => `${p.kind}${p.reason ? `（${p.reason.slice(0, 80)}）` : ''}`).join('；')}`)
      // 用產品判題的同一支比（結尾換行、行尾空白不算；多一行、少一行都算）——e2e 用的是「包含」，08／12 的「排回去」因此錯了兩個月沒人發現
      else if (r.s.stdout !== undefined && !compareOutput(v.out ?? '', r.s.stdout).passed) wrongOut.push(`  ${r.s.id}：預期 ${JSON.stringify(r.s.stdout).slice(0, 80)}，Cella 印 ${JSON.stringify(v.out).slice(0, 80)}`)
    }
    console.log([`Python 課文解答 ${sols.length} 份：翻得出 ${rows.length - notTranslated.length}`, ...notTranslated,
      `Cella 判決：${Object.entries(tally).map(([k, n]) => `${k} ${n}`).join('｜')}`, ...detail,
      `accept 而輸出與課文不同：${wrongOut.length}`, ...wrongOut].join('\n'))
    expect(rows.filter((r) => !r.program).map((r) => r.s.id).sort(), '🔴 翻不出的與已知缺口不符（多了＝新的缺陷；少了＝修好了，把 KNOWN_GAPS 那一筆拿掉）')
      .toEqual(Object.keys(KNOWN_GAPS).sort())
    expect(wrongOut, '🔴 Cella 跑出來的與課文承諾的不一致').toEqual([])
  })
})
