/**
 * 拒絕訊息（US3／FR-022）
 *
 * 「載入失敗」是**無法行動的**訊息。使用者需要知道兩件事：**為什麼**，
 * 以及**原檔還在不在**。少任何一件，訊息就等於沒說。
 */
import { describe, it, expect } from 'vitest'
import { describeRefusal } from '../../../src/ui/refusal-message'
import type { LoadOutcome } from '../../../src/core/storage'

type Refused = Extract<LoadOutcome, { kind: 'refused' }>

const 有備份 = (reason: Refused['reason']): Refused => ({
  kind: 'refused',
  reason,
  backedUpTo: 'semorphe-state.rejected',
})

describe('拒絕訊息說得出為什麼、也說得出原檔還在不在', () => {
  const 四種理由: [string, Refused['reason'], string][] = [
    ['版本較高', { code: 'too-new', found: 99, current: 1 }, '較新'],
    ['格式太舊', { code: 'no-upgrade-path', found: 0, current: 1 }, '太舊'],
    ['升級失敗', { code: 'upgrade-failed', found: 0, detail: 'x' }, '失敗'],
    ['不是存檔', { code: 'not-a-save', detail: '缺少必填欄位：code' }, '不是可用的存檔'],
  ]

  for (const [name, reason, 關鍵字] of 四種理由) {
    it(`${name}：訊息說得出原因`, () => {
      const msg = describeRefusal(有備份(reason))
      expect(msg).toContain(關鍵字)
      expect(msg, '沒有說原檔還在不在').toContain('原檔已保留')
    })
  }

  it('四種理由給出四種不同的訊息——不是同一句話', () => {
    const 全部 = 四種理由.map(([, r]) => describeRefusal(有備份(r)))
    expect(new Set(全部).size).toBe(4)
  })

  it('備份失敗時，訊息必須明確要求使用者先手動匯出', () => {
    const msg = describeRefusal({
      kind: 'refused',
      reason: { code: 'too-new', found: 99, current: 1 },
      backedUpTo: '',
    })
    expect(msg).toContain('無法備份')
    expect(msg, '沒有告訴使用者該做什麼').toContain('手動匯出')
    expect(msg).not.toContain('原檔已保留')
  })

  it('不是存檔時，把技術細節一併帶出來——使用者可能看得懂，開發者一定看得懂', () => {
    const msg = describeRefusal(有備份({ code: 'not-a-save', detail: '缺少必填欄位：code' }))
    expect(msg).toContain('缺少必填欄位：code')
  })
})
