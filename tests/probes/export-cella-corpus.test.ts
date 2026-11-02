/**
 * **把送給 Cella 的語料匯出成一份固定的檔案**（第 219 刀；cella 2026-11-02 要的）——讓 Cella 那邊發版前自己跑回歸，不必等我們跑完整探針再回報。
 *
 * 每一筆：送給 `checker.verdict` 的 program、stdin、steps，加上**真的編譯器**跑出來的 stdout 與結束碼當期待值。
 * 兩份：學生的練習（StudyCpp，`STUDYCPP_DIR`）與課文（判決綁定語料）。
 *
 * ⚠️ 只在本機用：學生的程式不是我們的，也不是 cella 的——匯出的位置在任何 repo 之外（`CELLA_CORPUS_OUT`），不提交。
 * ⚠️ 期待值的來源要寫清楚：Arduino 的草稿在本機編不了，它的期待值是**課文宣告的** `check.stdout`（`expectedFrom: "lesson-check"`）。
 *
 * ```
 * CELLA_CORPUS_OUT=…/semorphe-cella-corpus STUDYCPP_DIR=… SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim \
 *   npx vitest run tests/probes/export-cella-corpus.test.ts
 * ```
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { formalize } from '../../src/providers/cella/formalize'
import { readSchedule, makeStdin } from '../helpers/stdin-from-tree'
import { buildBindingCorpus } from '../helpers/binding-corpus'
import type { SemanticNode } from '../../src/core/types'

const ROOT = path.resolve(__dirname, '../..')
const OUT = process.env.CELLA_CORPUS_OUT ?? ''
const DIR = process.env.STUDYCPP_DIR ?? ''
const INC = process.env.SEMORPHE_REFCC_INCLUDE
const STEPS = 1_000_000
const RUN_TIMEOUT_MS = 10_000
/** 期待的 stdout 最多留這麼多——逾時的程式（無窮迴圈一直印）十秒內能印出幾十 MB，第一版整份 244 MB */
const MAX_STDOUT = 1_000_000

interface Row {
  id: string
  family: 'cfamily'
  program: unknown
  stdin: string
  steps: number
  expected: { stdout: string | null; exitCode: number | null; from: 'compiler' | 'lesson-check'; truncated?: boolean; note?: string }
}

function cppFiles(d: string): string[] {
  const out: string[] = []
  const walk = (x: string): void => {
    for (const e of fs.readdirSync(x, { withFileTypes: true })) {
      const p = path.join(x, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.cpp')) out.push(p)
    }
  }
  walk(d)
  return out.sort()
}

/** 用參照編譯器編、跑。⚠️ 直接 spawn 執行檔（不經 shell），逾時就砍它本身。 */
function compileAndRun(code: string, stdin: string, lang: 'c' | 'cpp', tmp: string): Row['expected'] {
  const src = path.join(tmp, lang === 'c' ? 'p.c' : 'p.cpp')
  const bin = path.join(tmp, 'p.out')
  fs.writeFileSync(src, code)
  const args = lang === 'c' ? ['-std=c11', '-lm'] : ['-std=c++17']
  try {
    execFileSync(lang === 'c' ? 'gcc' : 'g++', [...args, ...(INC && lang === 'cpp' ? [`-I${INC}`] : []), '-o', bin, src], { stdio: 'pipe' })
  } catch (e) {
    // 第一行常是「In file included from …」——抓第一個真正的 error 行
    const lines = String((e as { stderr?: Buffer }).stderr ?? e).split('\n')
    const first = lines.find((l) => /error:|Undefined symbols/.test(l)) ?? lines[0]
    return { stdout: null, exitCode: null, from: 'compiler', note: `編不過：${first.replace(/^.*?(error:|Undefined)/, '$1').slice(0, 200)}` }
  }
  const r = spawnSync(bin, { input: stdin, timeout: RUN_TIMEOUT_MS, killSignal: 'SIGKILL', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const cut = (o: string | null): { stdout: string | null; truncated?: boolean } =>
    o !== null && o.length > MAX_STDOUT ? { stdout: o.slice(0, MAX_STDOUT), truncated: true } : { stdout: o }
  if (r.error || r.signal) return { ...cut(r.stdout ?? null), exitCode: null, from: 'compiler', note: r.signal === 'SIGKILL' ? `逾時（${RUN_TIMEOUT_MS} ms）` : String(r.error ?? r.signal) }
  return { ...cut(r.stdout), exitCode: r.status, from: 'compiler' }
}

function compilerVersion(): string {
  try { return execFileSync('g++', ['--version'], { encoding: 'utf8' }).split('\n')[0].trim() } catch { return '?' }
}

describe.skipIf(!OUT)('匯出給 Cella 的回歸語料', () => {
  it('寫出 studycpp.json、lessons.json 與 README.md', async () => {
    await Parser.init({ locateFile: (s: string) => `${ROOT}/public/${s}` })
    const parser = new Parser()
    parser.setLanguage(await Language.load(`${ROOT}/public/tree-sitter-cpp.wasm`))
    registerCppLanguage()
    fs.mkdirSync(OUT, { recursive: true })
    const tmp = fs.mkdtempSync(path.join(OUT, '.build-'))
    try {
      // ── 學生的練習 ──
      const student: Row[] = []
      const untranslated: string[] = []
      if (DIR && fs.existsSync(DIR)) {
        for (const f of cppFiles(DIR)) {
          const src = fs.readFileSync(f, 'utf8')
          let tree: SemanticNode
          try { tree = createTestLifter().lift(parser.parse(src)!.rootNode as never) as SemanticNode } catch { untranslated.push(path.relative(DIR, f)); continue }
          const fz = formalize(tree, { lang: 'cpp' })
          if (!fz.program) { untranslated.push(path.relative(DIR, f)); continue }
          const stdin = makeStdin(readSchedule(tree), 1, 200).map((l) => `${l}\n`).join('')
          student.push({ id: path.relative(DIR, f), family: 'cfamily', program: fz.program, stdin, steps: STEPS, expected: compileAndRun(src, stdin, 'cpp', tmp) })
        }
        expect(student.length, '★ 入口條件：學生的練習翻得出一百五十支以上（擋的是母體空了：218 支、翻得出的隨 formalize 長大）').toBeGreaterThan(150)
        fs.writeFileSync(path.join(OUT, 'studycpp.json'), JSON.stringify(student))
      }

      // ── 課文（判決綁定語料）──
      const lessons: Row[] = []
      for (const row of buildBindingCorpus(parser).filter((r) => r.program)) {
        const m = /^([^/]+)\/([^/]+)\/(.+)\.(cpp|c)$/.exec(row.id)
        const meta = m ? path.join(ROOT, 'lessons', m[1], m[2], 'lesson.json') : ''
        const task = meta && fs.existsSync(meta) ? (JSON.parse(fs.readFileSync(meta, 'utf8')).tasks ?? []).find((t: { id: string }) => t.id === m![3]) : undefined
        const check = task?.check as { stdin?: string[]; stdout?: string } | undefined
        const stdin = (check?.stdin ?? []).map((l) => `${l}\n`).join('')
        const arduino = row.id.startsWith('arduino/')
        lessons.push({
          id: row.id, family: 'cfamily', program: row.program, stdin,
          // Arduino 的 sketch 要模擬到 5 秒（setup 一次、loop 重複）——步數照 binding-verdict 那支
          steps: arduino ? 50_000_000 : STEPS,
          expected: arduino
            ? { stdout: check?.stdout ?? null, exitCode: null, from: 'lesson-check', note: '本機編不了 Arduino；期待值是課文宣告的 check.stdout（沒有宣告就是 null）' }
            : compileAndRun(row.text, stdin, m?.[4] === 'c' ? 'c' : 'cpp', tmp),
        })
      }
      expect(lessons.length, '★ 入口條件：課文翻得出一百支以上').toBeGreaterThan(100)
      fs.writeFileSync(path.join(OUT, 'lessons.json'), JSON.stringify(lessons))

      const cella = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/cella-lang/package.json'), 'utf8')).version
      const head = (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return '?' } })()
      const bad = (rs: Row[]): number => rs.filter((r) => r.expected.from === 'compiler' && r.expected.exitCode === null).length
      fs.writeFileSync(path.join(OUT, 'README.md'), [
        '# 給 Cella 的回歸語料（semorphe 匯出）',
        '',
        `⚠️ **只在本機讀，不提交**——學生的程式（StudyCpp）不是 semorphe 的，也不是 cella 的。`,
        '',
        `- 匯出：semorphe ${head}、送出時對應的 cella-lang ${cella}、參照編譯器 ${compilerVersion()}（-std=c++17${INC ? ' ＋ bits/stdc++.h 墊片' : ''}）`,
        `- 重產：semorphe 的 \`tests/probes/export-cella-corpus.test.ts\`（檔頭有指令），覆蓋同一個位置`,
        '',
        '## 檔案',
        `- \`studycpp.json\`：${student.length} 筆（翻不出的 ${untranslated.length} 支不在裡面：${untranslated.join('、') || '無'}）`,
        `- \`lessons.json\`：${lessons.length} 筆`,
        '',
        '## 每一筆',
        '```',
        'id        檔名',
        'family    "cfamily"',
        'program   送給 checker.verdict 的 JSON',
        'stdin     輸入（一行一筆，已含換行）——學生的程式是「問程式自己」生的，課文是 check.stdin',
        'steps     步數上限（Arduino 50,000,000，其餘 1,000,000）',
        'expected  { stdout, exitCode, from: "compiler" | "lesson-check", note? }',
        '```',
        `- 編不過或逾時的（exitCode 為 null、from 為 compiler）：學生 ${bad(student)} 支、課文 ${bad(lessons)} 支——note 寫了原因`,
        `- stdout 超過 ${MAX_STDOUT.toLocaleString()} 字元就截斷（\`truncated: true\`）——逾時的程式十秒內能印出幾十 MB`,
        '- ⚠️ 期待值來自 **Apple clang ＋ libc++**：struct 的 `operator<` 沒有標 const 又拿去排序／priority_queue 的，libc++ 編不過而 libstdc++（g++）編得過——note 會寫「invalid operands to binary expression」，那是實作差異，不是程式錯（Cella 照標準判 accept）',
        '- 沒有 `main` 的檔（說明、設定）連結不了——note 是「Undefined symbols」，本來就不是一支程式',
        '- 學生的程式的測資不保證有意義（只保證兩邊餵同一份）；有些會讀越界、未初始化——那時 Cella 判 reject 而編譯器照樣跑出東西，是預期的',
        '',
      ].join('\n'))
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  }, 3_600_000)
})
