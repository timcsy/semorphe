/**
 * **護欄：規格消歧**（spec 218 FR-012）——三件事，各附一個注入：
 * ① 課文宣告了的解讀，每一個都有參考解答（`solutions/<題目>~<解讀>.<副檔名>`）——缺了的話老師看到的那一欄永遠「比不了」
 * ② 核心（`src/core/disambiguation/`）不出現任何登記過的情境種類名字——種類由領域套件登記，核心認得一種就不是通用的了
 * ③ 比對器不碰 DOM、檔案系統、任何提供者——它要在瀏覽器與 Node（cos-mos 的批次）兩邊都跑得動（P9）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { registeredScenarioKinds } from '../../src/core/disambiguation/scenario-registry'

const ROOT = process.cwd()
const CORE = path.join(ROOT, 'src/core/disambiguation')

function lessonsWithInterpretations(): { lesson: string; task: string; ids: string[] }[] {
  const out: { lesson: string; task: string; ids: string[] }[] = []
  for (const track of fs.readdirSync(path.join(ROOT, 'lessons'))) {
    const tdir = path.join(ROOT, 'lessons', track)
    if (!fs.statSync(tdir).isDirectory()) continue
    for (const d of fs.readdirSync(tdir)) {
      const j = path.join(tdir, d, 'lesson.json')
      if (!fs.existsSync(j)) continue
      for (const t of JSON.parse(fs.readFileSync(j, 'utf8')).tasks ?? []) {
        if (Array.isArray(t.interpretations)) out.push({ lesson: `${track}/${d}`, task: t.id, ids: t.interpretations.map((x: { id: string }) => x.id) })
      }
    }
  }
  return out
}

function missingSolutions(entries: { lesson: string; task: string; ids: string[] }[], exists: (p: string) => boolean): string[] {
  const bad: string[] = []
  for (const e of entries) {
    const dir = path.join(ROOT, 'lessons', e.lesson, 'solutions')
    const names = fs.existsSync(dir) ? fs.readdirSync(dir) : []
    for (const id of e.ids) if (!names.some((n) => n.startsWith(`${e.task}~${id}.`) && exists(path.join(dir, n)))) bad.push(`${e.lesson}#${e.task}~${id}`)
  }
  return bad
}

const coreSources = (): { file: string; text: string }[] =>
  fs.readdirSync(CORE).filter((f) => f.endsWith('.ts')).map((f) => ({ file: f, text: fs.readFileSync(path.join(CORE, f), 'utf8') }))

function kindMentions(sources: { file: string; text: string }[], kinds: string[]): string[] {
  // 只看程式碼，不看註解（說明文字裡舉例是可以的）
  const code = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  return sources.flatMap((s) => kinds.filter((k) => new RegExp(`['"\`]${k.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}['"\`]`).test(code(s.text))).map((k) => `${s.file} · ${k}`))
}

const FORBIDDEN_IMPORT = /from\s+['"](?:node:[^'"]+|fs|path|[^'"]*\/providers\/[^'"]*|[^'"]*\/ui\/[^'"]*|[^'"]*\/panels\/[^'"]*)['"]/
const DOM_USE = /\b(?:document|window|localStorage|HTMLElement)\b/
function impurities(sources: { file: string; text: string }[]): string[] {
  const code = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  return sources.flatMap((s) => [
    ...(FORBIDDEN_IMPORT.test(code(s.text)) ? [`${s.file} · import 了檔案系統／提供者／畫面`] : []),
    ...(DOM_USE.test(code(s.text)) ? [`${s.file} · 碰到 DOM／瀏覽器的全域`] : []),
  ])
}

describe('★ 護欄：規格消歧（spec 218）', () => {
  registerCppLanguage()

  it('入口：有宣告解讀的題目、有登記的情境種類、核心有檔案', () => {
    expect(lessonsWithInterpretations().length).toBeGreaterThanOrEqual(2)
    expect(registeredScenarioKinds().length).toBeGreaterThanOrEqual(2)
    expect(coreSources().length).toBeGreaterThanOrEqual(4)
  })

  it('🔴 硬性零：宣告了的解讀都有參考解答', () => {
    expect(missingSolutions(lessonsWithInterpretations(), fs.existsSync)).toEqual([])
  })
  it('★ 注入：假裝一份解答不見了 → 抓得到', () => {
    const one = lessonsWithInterpretations().slice(0, 1)
    expect(missingSolutions(one, () => false).length).toBe(one[0].ids.length)
  })

  it('🔴 硬性零：核心不出現任何登記過的情境種類名字', () => {
    expect(kindMentions(coreSources(), registeredScenarioKinds())).toEqual([])
  })
  it('★ 注入：核心裡寫一個種類名字 → 抓得到', () => {
    const k = registeredScenarioKinds()[0]
    expect(kindMentions([{ file: 'x.ts', text: `if (s.kind === '${k}') {}` }], [k])).toEqual([`x.ts · ${k}`])
  })

  it('🔴 硬性零：比對器不碰 DOM、檔案系統、提供者、畫面', () => {
    expect(impurities(coreSources())).toEqual([])
  })
  it('★ 注入：import 提供者、用 document → 都抓得到', () => {
    expect(impurities([{ file: 'a.ts', text: "import { x } from '../../providers/cella/provider'" }])).toHaveLength(1)
    expect(impurities([{ file: 'b.ts', text: 'const el = document.createElement("div")' }])).toHaveLength(1)
    expect(impurities([{ file: 'c.ts', text: "import fs from 'node:fs'" }])).toHaveLength(1)
  })
})
