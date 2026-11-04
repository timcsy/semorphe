/**
 * **不解析 Cella 的 reason**（三方會議第三輪後記二，使用者定；vision〈形態檢查與判決的界線盤點〉）。
 *
 * Cella 判決裡每一則 problem 的 `reason` 是**開發者的紀錄**（英文、句型會隨版本變）；學生看到的文字由結構化的
 * `kind`／`params` 組（`core/verdict-diagnostics.ts`）。在此之前近似名字的提示是解析 clang／NameError 的句型——
 * Cella 改一個字，提示就靜靜地消失。這條護欄數：**讀判決的檔案裡，對 `reason` 做字串比對的地方**——硬性零。
 *
 * 母體：`src/` 裡提到判決型別（`CellaVerdict`／`VerdictProblem`／`CellaTypes`／判決的 `problems`）的檔案。
 * ⚠️ 別的模組也有自己的 `reason`（存檔升級、流程圖的拒絕原因）——它們不讀判決，不在母體裡。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const READS_VERDICT = /\b(CellaVerdict|VerdictProblem|CellaTypes)\b|\bverdict\.problems\b/
/** 對 reason 的字串比對：`.reason.match(`、`reason?.includes(`、`RegExp(…reason…)`、`/…/.test(x.reason)` */
const PARSES_REASON = [
  /\breason\??\.(match|matchAll|test|replace|replaceAll|exec|split|startsWith|endsWith|includes|search|indexOf)\(/,
  /RegExp\([^)]*\breason\b/,
  /\/[^/\n]+\/[gimsuy]*\.(test|exec)\([^)]*\breason\b/,
]

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const f = path.join(dir, e.name)
    return e.isDirectory() ? files(f) : f.endsWith('.ts') && !f.endsWith('.test.ts') ? [f] : []
  })
}

function hits(src: string): string[] {
  return src.split('\n').flatMap((line, i) => (PARSES_REASON.some((r) => r.test(line)) ? [`${i + 1}: ${line.trim().slice(0, 100)}`] : []))
}

describe('不解析 Cella 的 reason', () => {
  const population = files(path.join(ROOT, 'src')).filter((f) => READS_VERDICT.test(fs.readFileSync(f, 'utf8')))

  it('★ 入口：母體不是空的（讀判決的檔案至少有轉診斷的那一支）', () => {
    expect(population.map((f) => path.relative(ROOT, f))).toContain('src/core/verdict-diagnostics.ts')
  })

  it('★ 注入：一行解析 reason 的程式碼會被認出來；對照組不會', () => {
    expect(hits("const name = /undeclared identifier '(\\w+)'/.exec(p.reason)?.[1]")).toHaveLength(1)
    expect(hits('if (p.reason?.includes("not assignable")) return')).toHaveLength(1)
    expect(hits("const why = p.reason ?? ''  // 原文只放進開發者紀錄")).toHaveLength(0)
  })

  it('🔴 硬性零：讀判決的檔案裡，沒有對 reason 做字串比對', () => {
    const found = population.flatMap((f) => hits(fs.readFileSync(f, 'utf8')).map((h) => `${path.relative(ROOT, f)}:${h}`))
    expect(found, '學生看到的文字由 kind／params 組——reason 只是開發者的紀錄，不解析它').toEqual([])
  })
})

describe('積木側不顯示 reason 原文——通用的那幾種用種類名稱（spec 216）', () => {
  const zh = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/zh-TW/blocks.json'), 'utf8')) as Record<string, string>
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en/blocks.json'), 'utf8')) as Record<string, string>

  it('🔴 通用那一句（CELLA_OTHER）的積木側不帶 {reason}，帶 {kindLabel}', () => {
    for (const t of [zh, en]) {
      expect(t.DIAG_CELLA_OTHER_BLOCK).not.toContain('{reason}')
      expect(t.DIAG_CELLA_OTHER_BLOCK).toContain('{kindLabel}')
    }
  })

  it('🔴 每一種走通用那一句的判決，都有中英文的名稱', async () => {
    const { GENERIC_KINDS } = await import('../../src/core/verdict-diagnostics')
    expect(GENERIC_KINDS.length, '入口：通用的種類不是空的').toBeGreaterThan(0)
    const missing = GENERIC_KINDS.flatMap((k) => [zh, en].filter((t) => !t[`DIAG_KIND_${k}`]).map((t) => `${k}（${t === zh ? 'zh-TW' : 'en'}）`))
    expect(missing, '缺名稱的種類會退成「一個還沒有中文說明的狀況」').toEqual([])
  })
})
