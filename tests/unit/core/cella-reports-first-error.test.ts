/**
 * **觸發線：Cella 判「編譯不過」時只回報第一個錯**（錯誤訊息第四步量到，2026-11-05）
 *
 * 錯誤訊息的設計原本要做「同一個名字的『找不到』只標第一處，其餘收成『還有 N 處』」——量到 Cella 對一個打錯的名字
 * 用了三次也只回報一則，semorphe 自己的檢查也沒有逐次標名字的規則 ⟹ 那個機制今天沒有對象，沒做（機制有了沒人接）。
 * 這支釘住那個前提：哪天 Cella 開始回報每一處，這裡會紅——那就是去做「收成還有 N 處」的時機。
 */
import { describe, it, expect } from 'vitest'
import { runCella, describeCellaResult } from '../../helpers/cella-run'

describe('觸發線：Cella 對編譯錯誤只回報第一則', () => {
  it('同一個打錯的名字用三次 → 只有一則 undeclared', async () => {
    const r = await runCella('int main(){ int t = 0; cout << totl; cout << totl; cout << totl; return 0; }', { style: 'apcs' })
    expect(r.verdict, describeCellaResult(r)).toBe('reject')
    expect(r.problems.filter((p) => p.kind === 'undeclared'), '🔴 Cella 開始回報每一處了——去做「收成還有 N 處」（見錯誤訊息的 draft 第二節第 4 點）').toHaveLength(1)
  }, 120_000)
})
