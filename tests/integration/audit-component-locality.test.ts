/**
 * 第二十八條護欄：**膠囊就近性**——一顆元件的東西都在它自己的資料夾裡嗎
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果「注入」那一節合成的三個假違規（外洩的實作、混進來的外來身分、
 * > 留在共用檔的標籤）沒有被報出來，代表護欄壞了，不是膠囊乾淨。**
 *
 * 錨點是**合成的輸入**。不錨在「未膠囊化還剩幾顆」上——那個數字正是這條護欄
 * 要推向零的東西，錨在它上面的聲明**會在成功那天變紅**（`build-guardrail` 第 2 步）。
 *
 * ## 為什麼要新開一條，而不是改就近性護欄
 *
 * 現行就近性（`audit-locality.test.ts:56`）只算「實作」類：
 *
 * ```ts
 * if (classifyFile(file) !== '實作') continue
 * ```
 *
 * 而實測 `cpp:vector_declare` 的 8 個落點裡，**碎裂最嚴重的兩個是「宣告」類**
 * （`std/vector/{concepts,blocks}.json`，各被 4 顆元件共用），
 * **還有 2 個誰都看不到**（`i18n/{zh-TW,en}/blocks.json`——它們用積木訊息鍵索引，
 * 檔案裡一個 conceptId 字串都沒有）。
 *
 * 改舊護欄的話，兩個維度的數字混在一起，F 收工時的漲幅會分不出
 * 「實作真的變集中」與「換了一個維度」——`history/018` 的直接處方。
 *
 * ## 兩個方向（`experience.md`：「護欄常常只問了一個方向」）
 *
 * 把主詞與受詞對調再讀一次：
 *
 * | 方向 | 問什麼 | 抓什麼 |
 * |---|---|---|
 * | 正向 | 元件的東西都在自己資料夾裡嗎 | 搬漏了 |
 * | **反向** | 資料夾裡的東西都屬於這顆元件嗎 | 搬錯了、複製膠囊沒清乾淨 |
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測語義正確性**。C1–C8 全過的膠囊仍然可以做錯的事——`stack`／`queue`
 *   的 push 標籤說謊那次，十八條護欄一條都不叫，學生第一眼看出來。
 * - **不檢測標籤有沒有說出「作用在哪裡」**。那是人的判斷。
 * - **不檢測跨元件的組合正確性**（條件性正確）。
 * - **不檢測膠囊內部怎麼分檔**。契約刻意不管（薄協定；共同測不得超出協定）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, listSourceFiles, RATCHET_NOTE } from '../helpers/guardrail'
import { classifyFile } from '../helpers/file-classification'
import { scanText } from '../helpers/component-scan'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'
import { registeredComponents } from '../../src/core/component/registry'
import { componentOwnedLabelKeys, labelKeysOf } from '../../src/core/component/labels'
import { componentBlocks } from '../../src/core/component/registry'
import { idToDir } from '../../src/core/component/types'

const GUARD = 'component-locality'
const scanDirs = ['src']
const sharedLabelFiles = ['src/i18n/zh-TW/blocks.json', 'src/i18n/en/blocks.json']

interface Baseline {
  _meta: { guard: string; measuredAt: string; rule: string; note: string }
  /** 尚未膠囊化的元件數。只准下降。 */
  notEncapsulated: number
}

const allIdentities = (): string[] => allCppConcepts().map((c) => c.conceptId)

/** 這顆元件有沒有積木——`componentBlocks()` 是已蓋章的全部膠囊積木。 */
const hasBlocks = (id: string): boolean =>
  (componentBlocks() as { conceptId?: string }[]).some((b) => b.conceptId === id)

/** 一個膠囊資料夾的絕對前綴（相對 repo）。 */
const capsuleDirs = (id: string): string => `src/components/${idToDir(id)}/`

/**
 * 這個檔案要不要計入「外洩」。
 *
 * 豁免三類，各有理由：
 * - **清單**（課程主題、歷史改名表）：登錄表的視圖與名冊，不是實作擴散
 * - **清冊**（基線、報表）：產生出來的紀錄
 * - **測試**：自證測的負向斷言**必然**提到別的元件身分，那不是擴散
 */
function counted(rel: string): boolean {
  const cls = classifyFile(rel)
  return cls !== '清單' && cls !== '清冊' && cls !== '測試'
}

// ── 偵測核心：純函式，注入才餵得進合成輸入 ────────────────────
//
// 分出來的理由與 `scanText` 從 `scanFile` 分出來的相同：
// **錨在真實檔案上的注入測試，會在那些檔案被修好的那天失效**
// ——本專案為此翻車過兩次。

export interface file { rel: string; content: string }

/** 正向：已元件化的元件，其身分出現在自己資料夾外。 */
export function detectLeak(file2: readonly file[], componentized: readonly string[]): string[] {
  const out: string[] = []
  for (const { rel, content } of file2) {
    if (!counted(rel)) continue
    const hits = scanText(content, componentized)
    for (const id of hits.code) {
      if (rel.startsWith(capsuleDirs(id))) continue
      out.push(`${id} 洩在 ${rel}:${(hits.lines[id] ?? []).join(',')}`)
    }
  }
  return out
}

/** 反向：膠囊資料夾裡出現別顆元件的身分。 */
export function detectForeign(file2: readonly file[], current: string, allIdentities: readonly string[]): string[] {
  const out: string[] = []
  for (const { rel, content } of file2) {
    if (classifyFile(rel) === '測試') continue // 負向斷言必須講得出別的身分
    for (const id of scanText(content, allIdentities).code) {
      if (id !== current) out.push(`${rel} 提到了不屬於 ${current} 的 ${id}`)
    }
  }
  return out
}

/** 標籤：已元件化的標籤鍵還留在共用檔裡。 */
export function detectLabelResidue(shared: Record<string, string>, capsuleOwns: ReadonlySet<string>, rel: string): string[] {
  return Object.keys(shared).filter((k) => capsuleOwns.has(k)).map((k) => `${rel} 仍有 ${k}`)
}

describe('護欄：膠囊就近性（一顆元件的東西都在自己的資料夾裡嗎）', () => {
  // ── 棘輪：膠囊化的進度 ────────────────────────────────────
  it('棘輪：尚未膠囊化的元件數只准下降', () => {
    const encapsulated = new Set(registeredComponents().map((c) => c.conceptId))
    const notEncapsulated = allIdentities().filter((id) => !encapsulated.has(id))

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD, {
        _meta: {
          guard: GUARD,
          measuredAt: new Date().toISOString().slice(0, 10),
          rule:
            '一顆元件的宣告／實作／標籤都住在 src/components/<scope>/<name>/ 裡。' +
            '⚠️ **維度與現行就近性護欄不同**：這條算宣告＋實作＋標籤，' +
            '現行那條只算「實作」類（audit-locality.test.ts:56）。' +
            '**兩個數字不得互相比較**——3.46 與這裡的數字量的不是同一件事。',
          note: RATCHET_NOTE,
        },
        notEncapsulated: notEncapsulated.length,
      } satisfies Baseline)
    }

    const base = loadBaseline<Baseline>(GUARD)
    expect(notEncapsulated.length, `未膠囊化的元件數上升了：${base.notEncapsulated} → ${notEncapsulated.length}`).toBeLessThanOrEqual(
      base.notEncapsulated,
    )
    if (notEncapsulated.length < base.notEncapsulated) {
      throw new Error(
        `棘輪有改善，**請下調基線並與這次改善一起 commit**：\n` +
          `  ✔ 未膠囊化: ${base.notEncapsulated} → ${notEncapsulated.length}\n` +
          `（棘輪只擋上升的話不會自己收緊——舊基線會默許退回去而沒有人發現）`,
      )
    }
  })

  // ── 正向（FR-010）：硬性零 ──────────────────────────────
  it('正向：已膠囊化的元件，其身分不得出現在自己資料夾以外的非清單類檔', () => {
    const encapsulated = registeredComponents().map((c) => c.conceptId)
    if (encapsulated.length === 0) {
      // 還沒有膠囊時這一條無事可做，而「無事可做」不等於「通過」。
      // 注入測試（下方）才是它此刻的健康檢查——`build-guardrail` 第 9 步：
      // 基線是 0 的時候，一條回報零違規的健康護欄與一條什麼都沒量到的護欄，產出完全相同。
      return
    }
    const leaked = detectLeak(
      listSourceFiles('src', ['.ts', '.json']).map((rel) => ({
        rel,
        content: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
      })),
      encapsulated,
    )
    expect(leaked, `已膠囊化的元件不得出現在自己資料夾外：\n  ${leaked.join('\n  ')}`).toEqual([])
  })

  // ── 反向（FR-011）：硬性零 ──────────────────────────────
  it('反向：膠囊資料夾裡不得出現別顆元件的身分', () => {
    const ids = allIdentities()
    const foreign: string[] = []
    for (const c of registeredComponents()) {
      const dir = capsuleDirs(c.conceptId).replace(/.$/, '')
      foreign.push(
        ...detectForeign(
          listSourceFiles(dir, ['.ts', '.json']).map((rel) => ({
            rel,
            content: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
          })),
          c.conceptId,
          ids,
        ),
      )
    }
    expect(foreign, `膠囊資料夾裡混進了別顆元件：\n  ${foreign.join('\n  ')}`).toEqual([])
  })

  // ── 標籤那一維（FR-012）：今天沒有任何護欄看得到 ───────────
  it('標籤：已膠囊化元件的標籤鍵不得留在共用的 i18n 檔', () => {
    const owns = componentOwnedLabelKeys()
    if (owns.size === 0) return
    const residual = sharedLabelFiles.flatMap((rel) =>
      detectLabelResidue(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')), owns, rel),
    )
    expect(residual, `標籤搬進膠囊之後共用檔要刪乾淨（兩份會漂移）：\n  ${residual.join('\n  ')}`).toEqual([])
  })

  it('標籤：**有積木的**膠囊都要有標籤檔（沒有標籤的元件在 UI 上是空白的）', () => {
    // ⚠️ **條件是「有積木」，不是「是膠囊」**（2026-08-11 修正）。
    //
    // `cpp:comma_expr` 有身分、有 lift、有產生、有執行，而**沒有積木**
    // ——`for (i = 0, j = 1; …)` 的逗號運算式是辨識出來的，
    // 使用者沒有一顆積木可以拖。沒有積木就沒有東西要標籤。
    //
    // 原本的寫法會逼一顆這樣的元件生出一份**沒有人讀的標籤**，
    // 而那正是這個專案在追的殼。
    const none = registeredComponents()
      .filter((c) => hasBlocks(c.conceptId) && labelKeysOf(c).length === 0)
      .map((c) => c.conceptId)
    expect(none, `這些膠囊有積木卻沒有任何標籤：${none.join('、')}`).toEqual([])
  })

  // ── 注入：兩個方向都要釘（build-guardrail 第 9 步） ─────────
  describe('注入', () => {
    const fakeIdentity = ['cpp:fake_alpha', 'cpp:fake_beta']

    it('壞的輸入會報：實作外洩必須被 scanText 抓到', () => {
      const fakeFile = `register('cpp:fake_alpha', () => {})`
      expect(scanText(fakeFile, fakeIdentity).code).toEqual(['cpp:fake_alpha'])
    })

    it('壞的輸入會報：膠囊裡的外來身分必須被抓到', () => {
      const fakeFile = `g.set('cpp:fake_beta', () => '')`
      const hits = scanText(fakeFile, fakeIdentity).code.filter((id) => id !== 'cpp:fake_alpha')
      expect(hits).toEqual(['cpp:fake_beta'])
    })

    it('壞的輸入會報：標籤留在共用檔必須被抓到', () => {
      const owns = new Set(['CPP_FAKE_ALPHA_MSG0'])
      const shared = { CPP_FAKE_ALPHA_MSG0: '假的', OTHER_KEY: '別人的' }
      expect(Object.keys(shared).filter((k) => owns.has(k))).toEqual(['CPP_FAKE_ALPHA_MSG0'])
    })

    it('好的輸入不亂報：沒提到假身分的檔案必須沉默', () => {
      // ⚠️ 這一則不可省。沒有它，一個「什麼都報」的掃描器也能通過上面三則。
      const clean = `const x = 'cpp:fake_alphabet'\n// cpp:fake_alpha 只在註解裡`
      expect(scanText(clean, fakeIdentity).code).toEqual([])
    })

    it('好的輸入不亂報：路徑前綴比對不得把 vector_declare2 當成 vector_declare', () => {
      expect(`src/components/cpp/vector_declare2/x.ts`.startsWith(capsuleDirs('cpp:vector_declare'))).toBe(false)
      expect(`src/components/cpp/vector_declare/x.ts`.startsWith(capsuleDirs('cpp:vector_declare'))).toBe(true)
    })
  })

  // ── US2：三類違規各自要變紅，而且**理由各不相同** ─────────────
  //
  // `build-guardrail` 第 8 步：釘理由不只釘結果——**一個因為錯誤理由而給出
  // 正確結果的護欄，看起來與健康的完全一樣。**
  describe('US2 注入：三類違規', () => {
    const current = 'cpp:vector_declare'
    const cleanCapsule: file[] = [
      { rel: 'src/components/cpp/vector_declare/generate.ts', content: `g.set('${current}', () => '')` },
    ]

    it('① 實作外洩回共用檔 → 紅，且指名元件與檔案', () => {
      const violations = detectLeak(
        [{ rel: 'src/languages/cpp/core/lifters/strategies.ts', content: `const t = { 'vector': '${current}' }` }],
        [current],
      )
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain(current)
      expect(violations[0]).toContain('strategies.ts')
      expect(violations[0], '理由一：**洩在**別的檔').toContain('洩在')
    })

    it('② 膠囊裡混進別顆元件 → 紅，且指名那個外來身分', () => {
      const violations = detectForeign(
        [{ rel: 'src/components/cpp/vector_declare/generate.ts', content: `g.set('cpp:vector_size', () => '')` }],
        current,
        [current, 'cpp:vector_size'],
      )
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('cpp:vector_size')
      expect(violations[0], '理由二：**不屬於**這顆').toContain('不屬於')
    })

    it('③ 標籤留在共用 i18n 檔 → 紅', () => {
      const violations = detectLabelResidue(
        { CPP_VECTOR_DECLARE_MSG0: '建立 %1 列表 %2', OTHER_KEY: '別人的' },
        new Set(['CPP_VECTOR_DECLARE_MSG0']),
        'src/i18n/zh-TW/blocks.json',
      )
      expect(violations).toEqual(['src/i18n/zh-TW/blocks.json 仍有 CPP_VECTOR_DECLARE_MSG0'])
      expect(violations[0], '理由三：**仍有**（該搬走而沒搬）').toContain('仍有')
    })

    it('★ 三個理由互不相同——不是同一條規則報三次', () => {
      const reason = ['洩在', '不屬於', '仍有']
      expect(new Set(reason).size, '三類違規共用同一個訊息的話，看報表的人分不出發生了什麼').toBe(3)
    })

    it('★ 對照組：乾淨的膠囊三條都不得報', () => {
      // ⚠️ 不可省。沒有這一則，一個「什麼都報」的偵測器也能通過上面三則。
      expect(detectLeak(cleanCapsule, [current])).toEqual([])
      expect(detectForeign(cleanCapsule, current, [current, 'cpp:vector_size'])).toEqual([])
      expect(detectLabelResidue({ OTHER_KEY: '別人的' }, new Set(['CPP_VECTOR_DECLARE_MSG0']), 'x')).toEqual([])
    })
  })
})
