/**
 * 🔴 版面清單要問宿主，不能問宣告。
 *
 * 2026-09-01 使用者在 VSCode 回報「說是四格其實根本不是」——那裡程式碼在
 * IDE 的編輯器裡，面板只畫得出流程與積木。
 *
 * 🪦 **2026-09-02（spec 171）大幅簡化**：主控台搬出編輯區、十字退場之後，
 * 三張版面**全是純欄**，於是「跨格算一格」「兩列合併」那整組判斷不再需要。
 *
 * > **一個化簡如果讓一半的測試沒有東西可測，那不是測試不見了
 * > ——是那一半的複雜度不見了。**
 */
import { describe, it, expect } from 'vitest'
import { hostLayoutOptions, reduceAreas, layoutPreset, LAYOUT_PRESETS } from '../../../src/core/host/layout-presets'
import type { UnderstandingLayer } from '../../../src/core/view-host'

const ALL = (): boolean => true
/** VSCode 的單層視窗：只有積木。 */
const BLOCKS_ONLY = (l: UnderstandingLayer): boolean => l === 'space'
/** 一個只有流程與積木的宿主。 */
const NO_CODE = (l: UnderstandingLayer): boolean => l === 'relation' || l === 'space'

describe('三張版面，而每一張都只有一列', () => {
  it('🔴 十字退場——清單是三張', () => {
    expect(LAYOUT_PRESETS.map((p) => p.id)).toEqual(['focus', 'compare', 'three-column'])
  })

  it('🔴 每一張的 areas 都只有【一列】——沒有任何一張需要編輯區有第二列', () => {
    // 這是 spec 171 的核心：唯一需要第二列的是十字，而它需要第二列
    // 只因為主控台在編輯區裡。
    for (const p of LAYOUT_PRESETS) {
      expect(p.areas, `${p.id} 不只一列`).toHaveLength(1)
    }
  })

  it('🔴 主控台不得出現在任何一張版面裡', () => {
    for (const p of LAYOUT_PRESETS) {
      expect(p.areas.flat(), `${p.id} 裡有主控台`).not.toContain('state')
    }
  })
})

describe('宿主少了某幾層', () => {
  it('四層都在時，三張都留著', () => {
    expect(hostLayoutOptions(ALL, 'space').map((o) => o.id))
      .toEqual(['focus', 'compare', 'three-column'])
  })

  it('🔴 只畫積木的視窗——塌成同形狀的只留一張', () => {
    const opts = hostLayoutOptions(BLOCKS_ONLY, 'space')
    expect(opts).toHaveLength(1)
    expect(opts[0].areas).toEqual([['space']])
  })

  it('沒有程式碼那一層時，剩下流程與積木', () => {
    const three = hostLayoutOptions(NO_CODE, 'space').find((o) => o.id === 'three-column')
    expect(three?.areas).toEqual([['relation', 'space']])
  })

  it('🔴 一格都不剩的版面不得進清單——它會讓 applyLayout 拿 areas[0] 時炸掉', () => {
    const FLOW_ONLY = (l: UnderstandingLayer): boolean => l === 'relation'
    const opts = hostLayoutOptions(FLOW_ONLY, 'relation')
    expect(opts.every((o) => o.areas.length > 0 && o.areas[0].length > 0)).toBe(true)
  })

  it('⚠️ 對照在只有流程的視窗裡整張是空的', () => {
    const FLOW_ONLY = (l: UnderstandingLayer): boolean => l === 'relation'
    expect(reduceAreas(layoutPreset('compare')!, FLOW_ONLY, 'relation')).toEqual([])
  })

  it('專注的 `*` 要先解析成焦點層再判斷', () => {
    const FLOW_ONLY = (l: UnderstandingLayer): boolean => l === 'relation'
    expect(reduceAreas(layoutPreset('focus')!, FLOW_ONLY, 'relation')).toEqual([['relation']])
  })
})
