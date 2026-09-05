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
import { engineHash } from '../../tools/blockmap/engine-hash'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const BASELINE = path.join(ROOT, 'tests/baselines/lesson-blockmaps.json')

interface Case { id: string; code: string; bm?: { codeHash: string; engineHash?: string; code: string; svg: string; blocks: unknown[]; badgeLines?: number[] } }

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

  /**
   * 🔴 **這一條是 2026-09-05 補的，而它補的是一次真的翻車。**
   *
   * 使用者在課文頁上看到 `1000000LL * 1000000LL` 的積木寫著 `0 × 0`
   * ——而**產品當下是對的**（實測積木上是 `1000000LL × 1000000LL`）。
   * 錯的是那張圖：它是在 `field_number` 改成 `field_input` 之前產的。
   *
   * 而上面那條「對照不得過期」全綠，因為**那一課的課文一個字都沒改**。
   *
   * > **一份產物的過期，有兩種來源：輸入變了，或者【產它的那台機器變了】。
   * > 只錨住前者的檢查，會在後者發生時保持全綠。**
   */
  it('🔴 圖不得是舊引擎產的——積木的畫法改了，圖也要跟著重產', () => {
    const now = engineHash(ROOT)
    const stale = CASES.filter((c) => c.bm !== undefined && c.bm.engineHash !== now)
    expect(
      stale.map((c) => c.id),
      '🔴 這幾張圖是【舊的積木引擎】產的——課文沒改，而積木的畫法改了。\n' +
        `   重產：npx playwright test --config=tools/demo/playwright.demo.config.ts record-blockmaps\n` +
        `   （現在的指紋 ${now}；來源清單在 tools/blockmap/engine-hash.ts 的 ENGINE_FILES）`,
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

  it('🔴 存下來的程式碼要與課文【逐字相同】', () => {
    // 🟢 使用者 2026-09-05：「完成的樣子要和對照一致」——而讓它們一致的方式
    //    是**把鷹架那幾行寫進課文**，不是放寬這條斷言。
    //
    // 🪦 中間有一版驗「課文的每一行都要在裡面」，而它 17 課紅：產生器那時
    //    讓積木把程式碼產回去，順帶帶進了格式正規化
    //    （`char s[20] = "hello";` → `= {"hello"};`）。
    //
    // > **與其讓兩份東西「盡量像」，不如讓它們是同一份——
    // > 然後這條斷言就可以是最嚴的那一種。**
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

  it('★ 注入：圖是舊引擎產的 → 會報出是哪一課', () => {
    const now = engineHash(ROOT)
    const fake: Case = {
      id: '合成/一堂課', code: 'int main() {}',
      bm: { codeHash: hash('int main() {}'), engineHash: '0000000000000000',
        code: 'int main() {}', svg: 'x'.repeat(300), blocks: [{}], badgeLines: [1] },
    }
    expect([fake].filter((c) => c.bm !== undefined && c.bm.engineHash !== now).map((c) => c.id))
      .toEqual(['合成/一堂課'])
  })

  /**
   * ⚠️ **這一條擋的是「指紋算出來永遠一樣」**——一個常數函式會讓上面那條
   * 永遠綠，而它看起來跟真的一模一樣。
   */
  it('★ 指紋要真的跟著來源動——改一個位元組，指紋就要換', () => {
    const before = engineHash(ROOT)
    const f = path.join(ROOT, 'tools/blockmap/engine-hash.ts')
    const body = fs.readFileSync(f, 'utf8')
    // engine-hash.ts 自己不在 ENGINE_FILES 裡，所以拿 block-registrar 當白老鼠
    const g = path.join(ROOT, 'src/ui/block-registrar.ts')
    const orig = fs.readFileSync(g, 'utf8')
    try {
      fs.writeFileSync(g, orig + '\n// 注入\n')
      expect(engineHash(ROOT), '🔴 來源改了而指紋沒動——那這條護欄永遠是綠的').not.toBe(before)
    } finally {
      fs.writeFileSync(g, orig)
      fs.writeFileSync(f, body)
    }
    expect(engineHash(ROOT), '🔴 還原了而指紋沒回來——那它不是內容的函式').toBe(before)
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
