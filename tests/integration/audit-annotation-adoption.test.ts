/**
 * 標註採用率護欄（第十一條）
 *
 * 量：每個標註有幾個**宣告者**、幾個**讀取點**。
 *
 * ## 這條問的問題，其他十條都沒問過
 *
 * 既有的護欄問的都是「東西對不對」。這一條問「**機制有沒有人用**」。
 *
 * > 「建一個機制不等於它在運作。」——`knowledge/history/020`
 *
 * ## 而「零讀取點」比「零宣告者」更難發現
 *
 * `introduces_scope` 有**四個**宣告者。按採用率看，健康。實際上其中兩個
 * （迴圈、函式定義）**各自在自己的執行器裡寫死了**同一件事，另外兩個什麼都
 * 沒做——**讀那個標註的人：零個。**
 *
 * 而它藏著一個真的語義錯誤：分支裡宣告的變數會外洩到外層，跑得出結果、
 * 印得出東西、而它是錯的。
 *
 * > **一個被繞過的機制，與一個運作中的機制，在抽查時長得一模一樣。**
 * > 那兩個「宣告了而且行為正確」的例子，與那個標註沒有任何關係。
 *
 * 見 `knowledge/history/023`。
 *
 * ## 判定
 *
 * 讀取點 = 原始碼裡呼叫 `hasAnnotation(…, '<名字>')` 或 `annotationOf(…, '<名字>')`。
 * **不算**「字串剛好出現在某處」——那正是 `consumedAnnotations: ['control_flow']`
 * 這種東西：它是一個**關於消費的宣告**，而它自己也沒有任何消費者。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  loadBaseline,
  writeBaseline,
  printReport,
  RATCHET_NOTE,
  type BaselineMeta,
  listSourceFiles,
  REPO_ROOT,
  assertRatchet,
} from '../helpers/guardrail'
import { universalConcepts } from '../../src/core/universal'
import { coreConcepts } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ComponentDefJSON } from '../../src/core/types'
// ⚠️ **不要自己列宣告來源。**
// 手列 `universalConcepts ＋ coreConcepts ＋ allStdModules` 會**漏掉膠囊**
// ——而症狀是「那顆元件的積木不見了／辨識不出來」，指向被害者不是兇手。
// `allCppConcepts()`／`allCppProjections()` 是組裝函式，它們含膠囊。
// 見 `tests/integration/audit-declaration-assembly.test.ts`（第三十七條護欄）。
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'

const RULE =
  '宣告者 = 概念定義的 annotations 裡有這個鍵。讀取點 = 原始碼呼叫 ' +
  '`hasAnnotation(…, \'名字\')` 或 `annotationOf(…, \'名字\')`。' +
  '**字串剛好出現在某處不算讀取**——那可能只是另一個沒人消費的宣告。'

const SELF_FALSIFICATION =
  '⚠️ 這條護欄的健康檢查是下面那三支合成注入，**不是報表上的數字**。' +
  '讀取點的比對若寫錯（例如漏了 `annotationOf`），每個標註都會顯示 0 個讀取點，' +
  '而「全部都沒人用」與「比對壞了」產出完全一樣。'

const NOT_DETECTED =
  '本護欄**不檢測**：讀了但**用錯**、透過變數間接取用標註名（`hasAnnotation(c, key)`）、' +
  '標註的**值**對不對。它只回答「有沒有任何地方直接讀這個標註」——' +
  '**這是保守方向**：它抓得到「完全沒人讀」，抓不到「讀了但沒作用」。'

interface AdoptionBaseline {
  _meta: BaselineMeta
  /** 零讀取點的標註 → 為什麼它還在。**理由必須指向 vision 裡真的存在的路線圖項目** */
  zeroReaders: Record<string, string>
  total: number
}

/**
 * 零讀取點有**三種**，而它們的處置完全不同。
 *
 * | 種類 | 意義 | 處置 |
 * |---|---|---|
 * | 被取代的殘留 | 舊設計的遺物，新機制已接手 | **刪掉** |
 * | 建了沒接上 | 機制在、消費者從未寫 | **接上或刪掉** |
 * | **消費者還沒到** | 為路線圖上的功能先宣告的 | **留著，且理由要指向那個項目** |
 *
 * ⚠️ 第三種是「用宣告刷數字」的入口——貼一句「這是為了未來」就能讓任何東西
 * 合法化。所以理由**不是自由文字**：它必須指名一個 `vision.md` 裡搜得到的
 * 路線圖項目，而下面有一支測試會去搜。
 *
 * 那條紀律來自 `knowledge/history/018`：「宣告需要門檻，而理由只有固定幾個
 * 值且不得增加——第三個值就是在替『還沒做』找一個體面的名字。」
 */
const PENDING = 'pending-consumer:'

/** 讀取點——只認具名的取用，不認「字串出現過」 */
export function countReaders(source: string, annotation: string): number {
  const esc = annotation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`(hasAnnotation|annotationOf)\\([^,)]+,\\s*['"\`]${esc}['"\`]`, 'g'))?.length ?? 0
}

function allSource(): string {
  let s = ''
  for (const dir of ['src/core', 'src/ui', 'src/interpreter', 'src/views', 'src/languages']) {
    for (const rel of listSourceFiles(dir)) s += readFileSync(join(REPO_ROOT, rel), 'utf8')
  }
  return s
}

function measure(): { name: string; declarers: number; readers: number }[] {
  const src = allSource()
  const counts = new Map<string, number>()
  const all = allCppConcepts()
  for (const c of all) {
    const ann = (c as { annotations?: Record<string, unknown> }).annotations
    if (!ann) continue
    for (const k of Object.keys(ann)) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts]
    .map(([name, declarers]) => ({ name, declarers, readers: countReaders(src, name) }))
    .sort((a, b) => b.declarers - a.declarers)
}

const rows = measure()
const zeroReaders = rows.filter((r) => r.readers === 0)

/** 產生基線時用的理由表——改這裡要同時說得出為什麼 */
const KNOWN_REASONS: Record<string, string> = {
  control_flow: 'pending-consumer:9.1 DataFlow 視圖',
}

const r_in = (b: AdoptionBaseline, n: string): boolean => n in b.zeroReaders

describe('護欄：標註採用率（機制有沒有人用）', () => {
  it('產出可讀報表', () => {
    const lines = [SELF_FALSIFICATION, NOT_DETECTED, '', `判定規則：${RULE}`, '']
    lines.push(`標註：${rows.length} 種｜**零讀取點：${zeroReaders.length} 種**`)
    lines.push('')
    lines.push('**零讀取點而有宣告者 = 這個機制從未執行過。**')
    lines.push('若那些宣告者「行為正確」，它們是各自繞過機制自己實作的——')
    lines.push('那讓機制看起來被驗證過，而它與那些例子沒有任何關係。')
    lines.push('')
    for (const r of rows) {
      const flag = r.readers === 0 ? '  ⚠️ 從未執行' : ''
      lines.push(`  ${r.name.padEnd(20)} 宣告者 ${String(r.declarers).padStart(3)} ｜ 讀取點 ${r.readers}${flag}`)
    }
    printReport('標註採用率護欄（第十一條）', lines)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('★ 合成注入：具名讀取必須被數到', () => {
    expect(countReaders(`if (hasAnnotation(concept, 'debug_step')) return`, 'debug_step')).toBe(1)
    expect(countReaders(`const v = annotationOf(c, "control_flow")`, 'control_flow')).toBe(1)
  })

  it('★ 合成注入：字串剛好出現不算讀取', () => {
    expect(
      countReaders(`consumedAnnotations: ['control_flow', 'introduces_scope']`, 'control_flow'),
      '把「宣稱自己會消費」算成「真的讀了」的話，這條護欄會替最危險的那種殼背書' +
        '——一個關於消費的宣告，而它自己也沒有消費者。',
    ).toBe(0)
  })

  it('★ 合成注入：不同標註不得互相計數', () => {
    expect(countReaders(`hasAnnotation(c, 'debug_step')`, 'debug')).toBe(0)
  })

  it('★ 標註清單不是空的——空的話這條什麼都沒量', () => {
    expect(rows.length).toBeGreaterThan(2)
  })

  it('★ 每個零讀取點的標註都要有**可複查的**理由', () => {
    const b = loadBaseline<AdoptionBaseline>('annotation-adoption')
    const vision = readFileSync(join(REPO_ROOT, 'knowledge/vision.md'), 'utf8')
    for (const r of zeroReaders) {
      const reason = b.zeroReaders[r.name]
      expect(reason, `${r.name} 沒有記錄理由——零讀取點必須說得出為什麼還在`).toBeTruthy()
      if (reason.startsWith(PENDING)) {
        const item = reason.slice(PENDING.length)
        expect(
          vision.includes(item),
          `${r.name} 的理由說它在等「${item}」，而 vision 裡搜不到那個項目。` +
            '**「這是為了未來」是刷數字最方便的入口**——理由必須指向一個真的存在的' +
            '路線圖項目，否則貼一句話就能讓任何東西合法化。',
        ).toBe(true)
      }
    }
  })

  it('棘輪：零讀取點的標註不得增加', () => {
    const b = loadBaseline<AdoptionBaseline>('annotation-adoption')
    const added = zeroReaders.map((r) => r.name).filter((n) => !(r_in(b, n)))
    expect(
      added,
      '新增了「有人宣告、沒有人讀」的標註。**建一個機制不等於它在運作**——' +
        `建它的時候要同時交付讀取端：\n  ${added.join('\n  ')}`,
    ).toEqual([])
    assertRatchet([['零讀取點的標註', zeroReaders.length, Object.keys(b.zeroReaders).length]])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-annotation-adoption.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('annotation-adoption', {
    _meta: {
      guard: 'annotation-adoption',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    zeroReaders: Object.fromEntries(
      zeroReaders.map((r) => [r.name, KNOWN_REASONS[r.name] ?? '（未記錄——請補上理由）']),
    ),
    total: rows.length,
  })
}
