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
 * 🟢 這一支走 lift → 直譯器，不開瀏覽器，一輪幾秒。
 *
 * ## ⚠️ 它是【必要條件】，不是充分條件
 *
 * ```
 * 這一支驗得到   這段程式碼 lift 得動，而直譯器跑出那個答案
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
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { runPython } from '../helpers/python-lift'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import type { Lifter } from '../../src/core/lift/lifter'
import type { SemanticNode } from '../../src/core/types'

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
          stdout: t.check.stdout, stdin: t.check.stdin ?? [],
        })
      }
    }
  }
  return out
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
}, 120_000)

async function runCppSource(src: string, stdin: string[]): Promise<string> {
  const tree = lifter.lift(tsParser.parse(src).rootNode as never) as SemanticNode
  const out: string[] = []
  const interp = new SemanticInterpreter({ maxSteps: 500_000 })
  interp.setOutputCallback((s) => out.push(s))
  await interp.execute(tree, stdin)
  return out.join('')
}

const CASES = collect()

describe('探針：參考解答跑出宣告的答案（快檔，秒級）', () => {
  it('入口條件：真的收到題目了', () => {
    expect(CASES.length, '🔴 一份解答都沒收到 → 下面全部不算數').toBeGreaterThan(40)
  })

  for (const c of CASES) {
    const py = c.file.endsWith('.py')
    it(`${c.lesson}〈${c.title}〉`, async () => {
      const got = py ? await runPython(c.src, c.stdin) : await runCppSource(c.src, c.stdin)
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
