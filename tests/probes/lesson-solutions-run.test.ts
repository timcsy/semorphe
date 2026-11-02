/**
 * **探針：每一份參考解答，跑出來真的是課程宣告的那個答案嗎——而這一支在【秒】的量級。**
 *
 * ## 🔴 它為什麼存在：那條 e2e 要五分鐘
 *
 * `e2e/lessons.spec.ts` 已經在驗同一件事，而它開瀏覽器、逐課載入，
 * 一輪 **5.1 分鐘**。寫題目的時候要改一行等五分鐘，那條迴路太長
 * ——而迴路太長的後果不是慢，是**改完不驗**。
 *
 * > **一條驗證迴路如果比人的耐性長，它就會在最需要的時候被跳過。**
 *
 * 🟢 這一支走 lift → formalize → Cella 判決（產品同一條路；spec 203 起，原本是 JS 直譯器），不開瀏覽器。
 *    C 家族讀建置時編好的判決器、Python 第一次用到才準備 python 家族的判決器（有建置快取時零點幾秒、沒有時當場編約 3 秒）。
 *
 * ## ⚠️ 它是【必要條件】，不是充分條件
 *
 * ```
 * 這一支驗得到   這段程式碼 lift 得動，而 Cella 判 accept、跑出那個答案
 * 它驗不到       課程的 pins／鷹架／工具箱下，學生在畫面上真的做得到
 * ```
 *
 * 🔴 所以它**不取代** e2e 那一支，它是寫題目時的快檔。
 * 兩支都留著，而它們錨在同一份宣告（`lesson.json` 的 `check.stdout`）。
 *
 * ## ⚠️ 它不進 `npm test`
 *
 * 住在 `tests/probes/`。理由與其他探針相同：它要載 tree-sitter 的 wasm
 * 與兩個語言套件，而它答的是「我剛寫的題目對不對」，不是「這個 repo 的形狀」。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { runCella, describeCellaResult } from '../helpers/cella-run'

const ROOT = path.resolve(__dirname, '../..')
const LESSONS = path.join(ROOT, 'lessons')

interface Case {
  lesson: string
  taskId: string
  title: string
  file: string
  src: string
  stdout: string
  stdin: string[]
  /** 課程的目標（`lesson.json` 的 `pins.target`）——`c` 的課文照 C 判（spec 203） */
  target: string | undefined
}

function collect(): Case[] {
  const out: Case[] = []
  for (const track of fs.readdirSync(LESSONS)) {
    const td = path.join(LESSONS, track)
    if (!fs.statSync(td).isDirectory()) continue
    for (const dir of fs.readdirSync(td)) {
      const ld = path.join(td, dir)
      const jf = path.join(ld, 'lesson.json')
      if (!fs.existsSync(jf)) continue
      const j = JSON.parse(fs.readFileSync(jf, 'utf8'))
      const sols = path.join(ld, 'solutions')
      if (!fs.existsSync(sols)) continue
      for (const t of j.tasks ?? []) {
        if (!t.check?.stdout) continue
        const file = fs.readdirSync(sols).find((f) => f.replace(/\.[^.]+$/, '') === t.id)
        if (!file) continue
        out.push({
          lesson: `${track}/${dir}`, taskId: t.id, title: t.title, file,
          src: fs.readFileSync(path.join(sols, file), 'utf8'),
          stdout: t.check.stdout, stdin: t.check.stdin ?? [], target: j.pins?.target,
        })
      }
    }
  }
  return out
}

/**
 * 執行判準：Cella（spec 203，重構 6c-2e）。判不出、翻不出、判定有錯、Python 沒接住的例外——一律紅並說出原因（P6）。
 * ⚠️ stdin 是一行一筆（課文的 `check.stdin`），以換行接起來——cin／scanf 以空白分隔、Python 的 input() 一次讀一行，兩邊都對。
 */
function targetStyle(target: string | undefined): string {
  const f = path.join(ROOT, 'src/languages/cpp/targets', `${target ?? 'cpp'}.json`)
  return (JSON.parse(fs.readFileSync(f, 'utf8')) as { style: string }).style
}

async function runSolution(c: Case): Promise<string> {
  const lang = c.file.endsWith('.py') ? 'python' : c.target === 'c' ? 'c' : 'cpp'
  const stdin = c.stdin.length ? `${c.stdin.join('\n')}\n` : ''
  // 課文的解答只寫本體（沒有 #include）——照產品補上自動引入：目標的風格（`src/languages/cpp/targets/<目標>.json` 的 style）
  const style = lang === 'python' ? undefined : targetStyle(c.target)
  const r = await runCella(c.src, { lang, stdin, steps: 20_000_000, style })
  if (r.verdict !== 'accept') throw new Error(describeCellaResult(r))
  if (lang === 'python' && r.problems.some((p) => p.kind === 'uncaught')) throw new Error(describeCellaResult(r))
  return r.out
}

const CASES = collect()

describe('探針：參考解答跑出宣告的答案（快檔，秒級）', () => {
  it('入口條件：真的收到題目了', () => {
    expect(CASES.length, '🔴 一份解答都沒收到 → 下面全部不算數').toBeGreaterThan(40)
    // 三個家族都要有（Python 走 python 家族的判決器、C 課文走 C）——少一族那一族的入口就沒被驗到
    expect(CASES.filter((c) => c.file.endsWith('.py')).length, 'Python 的解答').toBeGreaterThan(0)
    expect(CASES.filter((c) => c.file.endsWith('.c')).length, 'C 的解答').toBeGreaterThan(0)
  })

  for (const c of CASES) {
    it(`${c.lesson}〈${c.title}〉`, async () => {
      const got = await runSolution(c)
      // ⚠️ 判準與 e2e 那一支相同：**期望的每一行照順序出現過**。
      //    逐字比對會被「主控台回顯使用者輸入」弄壞，而那不是程式的錯。
      const wanted = c.stdout.trim().split('\n')
      let at = 0
      for (const line of wanted) {
        const i = got.indexOf(line, at)
        expect(i, `🔴 少了這一行：${JSON.stringify(line)}\n   實際輸出：${JSON.stringify(got)}`).toBeGreaterThanOrEqual(0)
        at = i + line.length
      }
    }, 30_000)
  }
})
