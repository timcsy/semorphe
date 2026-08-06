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
import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import { coreConcepts } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import type { ConceptDefJSON } from '../../src/core/types'

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
  zeroReaders: string[]
  total: number
}

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
  const all = [
    ...(universalConcepts as unknown as ConceptDefJSON[]),
    ...coreConcepts,
    ...allStdModules.flatMap((m) => m.concepts),
  ]
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

  it('棘輪：零讀取點的標註不得增加', () => {
    const b = loadBaseline<AdoptionBaseline>('annotation-adoption')
    const 新增 = zeroReaders.map((r) => r.name).filter((n) => !b.zeroReaders.includes(n))
    expect(
      新增,
      '新增了「有人宣告、沒有人讀」的標註。**建一個機制不等於它在運作**——' +
        `建它的時候要同時交付讀取端：\n  ${新增.join('\n  ')}`,
    ).toEqual([])
    assertRatchet([['零讀取點的標註', zeroReaders.length, b.zeroReaders.length]])
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
    zeroReaders: zeroReaders.map((r) => r.name),
    total: rows.length,
  })
}
