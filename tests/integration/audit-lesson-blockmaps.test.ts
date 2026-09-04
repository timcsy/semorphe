/**
 * **第一百零二條護欄：每一課的「程式碼 ↔ 積木」對照**
 *
 * 🔴 使用者 2026-09-04：「我比較在意的是程式碼跟積木或是節點的對照，
 * **目前使用者幾乎沒有辦法從課程了解積木長怎樣**」。
 *
 * 那份對照由 `tools/demo/record-blockmaps.spec.ts` 產生，而**產生的東西會過期**
 * ——課文裡的程式碼改了，圖還是舊的，而**畫面上看不出來**。
 *
 * > **一張手工截的圖是死的；一份腳本產的對照是活的——課文改了它會紅。**
 *
 * 這一條就是那個「會紅」：它拿對照裡記的 `codeHash` 去跟課文現在的
 * 〈完成的樣子〉比。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果掃到的課少於 1 堂，這支什麼都沒驗——不是「每一課都對」。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BASELINE = path.join(ROOT, 'tests/baselines/lesson-blockmaps.json')

interface Case { id: string; code: string; bm?: { codeHash: string; code: string; svg: string; blocks: unknown[]; badgeLines?: number[] } }

function collect(): Case[] {
  const root = path.join(ROOT, 'lessons')
  const out: Case[] = []
  for (const track of fs.readdirSync(root, { withFileTypes: true })) {
    if (!track.isDirectory()) continue
    for (const dir of fs.readdirSync(path.join(root, track.name), { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const p = path.join(root, track.name, dir.name)
      if (!fs.existsSync(path.join(p, 'lesson.json'))) continue
      const md = fs.readFileSync(path.join(p, 'lesson.md'), 'utf8')
      const code = md.split('## 完成的樣子')[1]?.split('\n## ')[0]
        ?.match(/```[a-z]*\n([\s\S]+?)\n```/)?.[1] ?? ''
      const id = `${track.name}/${dir.name}`
      const f = path.join(ROOT, 'assets/blockmaps', `${id.replace('/', '__')}.json`)
      out.push({ id, code, bm: fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : undefined })
    }
  }
  return out
}

const CASES = collect()
const hash = (s: string): string => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16)

describe('第一百零二條護欄：課文的程式碼↔積木對照', () => {
  it('★ 入口條件——真的掃到課了', () => {
    expect(CASES.length, '🔴 一堂課都沒掃到 → 下面每一條都是空過的').toBeGreaterThanOrEqual(1)
  })

  it('🔴 對照不得過期——課文改了，圖要跟著重產', () => {
    const stale = CASES.filter((c) => c.bm !== undefined && c.bm.codeHash !== hash(c.code))
    expect(
      stale.map((c) => c.id),
      '🔴 這幾課的對照是舊的——課文裡的程式碼改過，而圖沒有重產。\n' +
        '   重產：npx playwright test tools/demo/record-blockmaps.spec.ts ' +
        '--config=tools/demo/playwright.demo.config.ts',
    ).toEqual([])
  })

  it('🔴 有對照的，內容不得是空的', () => {
    const empty = CASES.filter((c) => c.bm !== undefined
      && (c.bm.blocks.length === 0 || c.bm.svg.length < 200))
    expect(empty.map((c) => c.id), '🔴 產出了一張沒有用的圖').toEqual([])
  })

  it('🔴 每一份對照都要有 badgeLines——少了它，那一頁的號碼配不起來', () => {
    // ⚠️ 這一條擋的是**舊格式**：產生器加了新欄位而沒有全部重產時，
    //    課文頁會安靜地少掉配對（`badgeLines ?? []`），而畫面上只是「號碼沒變粗」。
    const old = CASES.filter((c) => c.bm !== undefined
      && (!Array.isArray(c.bm.badgeLines) || c.bm.badgeLines.length === 0))
    expect(old.map((c) => c.id), '🔴 這幾課的對照是舊格式，要重產').toEqual([])
  })

  it('⚠️ 存下來的程式碼要與課文逐字相同（雜湊之外的第二道）', () => {
    const drift = CASES.filter((c) => c.bm !== undefined && c.bm.code !== c.code)
    expect(drift.map((c) => c.id), '🔴 對照裡存的程式碼與課文不同').toEqual([])
  })

  /**
   * ★ **注入：一份過期的對照必須被報出來。**
   *
   * 🔴 第四十九條護欄要的就是這個——**一條沒有被證明過會說話的護欄，
   * 與沒有那條護欄是同一件事**。
   *
   * ⚠️ 這裡注入的是「同一份宣告的兩半不一致」：把課文的程式碼改一個字，
   * 而對照裡記的雜湊還是舊的。
   */
  it('★ 注入：課文改了而圖沒重產 → 會報出是哪一課', () => {
    const fake: Case = {
      id: '合成/一堂課',
      code: 'int main(){ return 0; }',
      bm: { codeHash: hash('別的程式'), code: '別的程式', svg: 'x'.repeat(300), blocks: [{}], badgeLines: [1] },
    }
    const stale = [fake].filter((c) => c.bm !== undefined && c.bm.codeHash !== hash(c.code))
    expect(stale.map((c) => c.id)).toEqual(['合成/一堂課'])
  })

  it('★ 注入：正確的對照 → 不報', () => {
    const code = 'int main(){ return 0; }'
    const ok: Case = {
      id: '合成/一堂課', code,
      bm: { codeHash: hash(code), code, svg: 'x'.repeat(300), blocks: [{}], badgeLines: [1] },
    }
    expect([ok].filter((c) => c.bm !== undefined && c.bm.codeHash !== hash(c.code))).toEqual([])
  })

  /**
   * 🔴 **棘輪：沒有對照的課只准下降。**
   *
   * 今天是 **2**（`arduino/12-液晶顯示`、`arduino/13-溫濕度`），而**原因已經查清楚**：
   *
   * ```
   * cpp_lcd_declare / cpp_dht_declare / cpp_servo_declare
   *   宣告了 renderMapping.dynamicRules 的 inputPattern: "CTOR_{i}"
   *   而【沒有任何人照著它建那些 input】
   *   → Blockly 載入時丟 "missing a(n) CTOR_0 connection"
   *   → 整個工作區載入失敗 ⟹ 學生看到的是【空白的積木畫布】
   * ```
   *
   * > **一顆積木少了一個宣告好的插槽，壞掉的不是那一顆——是整張畫布。**
   *
   * ⚠️ 而**整套測試看不到它**：那兩課的 e2e 驗的是「樹對不對」與「跑出來對不對」，
   * 兩者都不看積木。這一條是它今天唯一的哨兵。
   */
  it('棘輪：沒有對照的課只准下降', () => {
    const missing = CASES.filter((c) => c.bm === undefined).map((c) => c.id).sort()
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as { missing: string[]; lessons: number }
    expect(CASES.length, '🔴 課變少了 → 這條棘輪的分母被偷偷縮小').toBeGreaterThanOrEqual(base.lessons)
    expect(
      missing.length,
      `🔴 沒有對照的課變多了：${JSON.stringify(missing)}（基線 ${base.missing.length}）`,
    ).toBeLessThanOrEqual(base.missing.length)
  })
})
