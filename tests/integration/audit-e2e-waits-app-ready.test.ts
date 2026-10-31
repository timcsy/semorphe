/**
 * **餵程式碼的 e2e，要等 app 的 init 做完**（2026-10-31，第 394 刀立）。
 *
 * ## 為什麼
 *
 * 編輯器在 init 的前段就建好了，而後段還會從預設的樹重投影一次、把編輯器寫回預設程式。
 * 只等「畫面出現」就 `setCode` 的話，那份程式碼會被蓋掉——樹停在 `program/func_def/return`。
 * 這是 e2e `c-target` 間歇紅了一個月的主因（`knowledge/episodes/2026-10-31-一個月重現不了的紅.md`）。
 *
 * 第 392 刀修了共用的 helpers 與兩支 spec，**而漏了自己定義 ready 的那幾支**——下一輪 e2e 就換
 * `console-comes-back` 紅（單獨跑 3 輪紅 2 輪）。同一個坑的第二次 ⟹ 立這一條。
 *
 * ## 判準
 *
 * 一支 e2e 檔有 `setCode(` ⟹ 它必須「自己等 `__appReady`」，或「從 `./helpers` 用了會等的函式」
 * （`freshApp`／`appReady`／`appKeepingStorage`／`openLessonLink`）。
 * ⚠️ 靜態判準：它看不出「等」與「餵」的先後順序——那一層由各 spec 的寫法負責。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport } from '../helpers/guardrail'

const WAITING_HELPERS = /\b(freshApp|appReady|appKeepingStorage|openLessonLink)\(/

/** 一份 e2e 原始碼：沒有餵程式碼 → 'n/a'；有餵而有等 → 'ok'；有餵而沒等 → 'missing'。 */
export function classify(src: string): 'n/a' | 'ok' | 'missing' {
  if (!/\bsetCode\(/.test(src)) return 'n/a'
  if (src.includes('__appReady')) return 'ok'
  if (WAITING_HELPERS.test(src) && /from '\.\/helpers'/.test(src)) return 'ok'
  return 'missing'
}

const DIR = path.join(REPO_ROOT, 'e2e')
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts'))
const verdicts = files.map((f) => ({ f, v: classify(fs.readFileSync(path.join(DIR, f), 'utf8')) }))

describe('護欄：餵程式碼的 e2e 要等 app 的 init 做完', () => {
  it('★ 入口條件：真的掃到餵程式碼的 spec', () => {
    expect(verdicts.filter((x) => x.v !== 'n/a').length, '🔴 一支會 setCode 的都沒掃到 → 掃描壞了').toBeGreaterThan(10)
  })

  it('★ 注入：只等畫面就餵程式碼 → 抓到；自己等或用會等的 helper → 不報', () => {
    const page = "await page.goto('/')\nawait expect(page.locator('.injectionDiv')).toBeVisible()\nawait page.evaluate(() => __app.codeView.setCode('x'))"
    expect(classify(page)).toBe('missing')
    expect(classify(page + '\nwindow.__appReady')).toBe('ok')
    expect(classify("import { freshApp } from './helpers'\nawait freshApp(page)\n" + page)).toBe('ok')
    expect(classify("await page.goto('/')")).toBe('n/a')
  })

  it('🔴 硬性零：會 setCode 的 spec 都等過 init', () => {
    const missing = verdicts.filter((x) => x.v === 'missing').map((x) => x.f)
    printReport('餵程式碼的 e2e 有沒有等 init', [
      `會 setCode 的 ${verdicts.filter((x) => x.v !== 'n/a').length} 支；沒等的 ${missing.length} 支`,
      ...missing.map((f) => `  e2e/${f}`),
    ])
    expect(missing).toEqual([])
  })
})
