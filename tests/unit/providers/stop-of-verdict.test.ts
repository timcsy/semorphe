/**
 * `stopOfVerdict`：一次判決 → 執行停下的原因（鍵、參數、節點）——內建 Cella 提供者與 cos-mos 的 Provider 共用同一張對照表
 * （2026-11-04 與 cos-mos 定：「換宿主，結果不變」——同一支有號溢位的程式，兩個宿主上學生看到同一句）。
 */
import { describe, it, expect } from 'vitest'
import { stopOfVerdict, UB_KEY } from '../../../src/providers/cella/stop-of-verdict'

const v = (verdict: 'accept' | 'reject' | 'unknown' | 'invalid', problems: Record<string, unknown>[]) =>
  ({ verdict, basis: 'computed', exit: null, out: '', problems }) as never

describe('stopOfVerdict', () => {
  it('★ accept 而沒有該停的問題 → null（ended）', () => {
    expect(stopOfVerdict(v('accept', []))).toBeNull()
    expect(stopOfVerdict(v('accept', [{ kind: 'assumed', category: 'indeterminate', reason: 'x' }]))).toBeNull()
  })

  it('★ 有號溢位 → 與內建提供者同一個鍵；at 收回語意樹的節點 id', () => {
    const r = stopOfVerdict(v('reject', [{ kind: 'ubOverflow', category: 'error', at: 'node_7/rhs', clause: '[expr.pre]/4', reason: 'signed overflow' }]))
    expect(r).toEqual({ kind: 'runtime', i18nKey: 'RUNTIME_ERR_UB_OVERFLOW', params: expect.objectContaining({ clause: '[expr.pre]/4' }), nodeId: 'node_7' })
    expect(UB_KEY.ubOverflow).toBe('RUNTIME_ERR_UB_OVERFLOW')
  })

  it('★ 其他未定義行為 → 通用那一句；未指定 → 未指定那一句', () => {
    expect(stopOfVerdict(v('reject', [{ kind: 'ubShift', category: 'error', at: 'n1', reason: 'shift amount' }]))?.i18nKey).toBe('RUNTIME_ERR_UNDEFINED_BEHAVIOR')
    expect(stopOfVerdict(v('unknown', [{ kind: 'ubOrder', category: 'indeterminate', at: 'n1' }]))?.i18nKey).toBe('RUNTIME_ERR_UNSPECIFIED_BEHAVIOR')
  })

  it('★「沒辦法判斷」與「程式錯了」用不同的鍵：步數用完、模型做不到', () => {
    expect(stopOfVerdict(v('unknown', [{ kind: 'fuel', category: 'indeterminate' }]))?.i18nKey).toBe('RUNTIME_ERR_MAX_STEPS')
    expect(stopOfVerdict(v('unknown', [{ kind: 'unsupported', category: 'unsupported', at: 'n2', reason: 'std::begin is not supported yet' }])))
      .toMatchObject({ i18nKey: 'RUNTIME_ERR_CELLA_UNSUPPORTED', params: { why: 'std::begin is not supported yet' }, nodeId: 'n2' })
  })

  it('★ 不合規則（含未宣告）→ 「不合規則，沒有執行」；沒接住的例外 → 例外那一句', () => {
    expect(stopOfVerdict(v('reject', [{ kind: 'undeclared', category: 'error', at: 'n3', reason: "use of undeclared identifier 'x'", params: { name: 'x', what: 'variable' } }])))
      .toMatchObject({ i18nKey: 'RUNTIME_ERR_CELLA_REJECTED', params: { why: "use of undeclared identifier 'x'", name: 'x' }, nodeId: 'n3' })
    expect(stopOfVerdict(v('accept', [{ kind: 'uncaught', category: 'termination', at: 'n4', reason: 'ValueError: bad' }])))
      .toMatchObject({ i18nKey: 'RUNTIME_ERR_UNCAUGHT_EXCEPTION', params: { text: 'ValueError: bad' } })
  })

  it('🔴 挑第一則學生該看的，不一定是 problems[0]：還沒寫完／假設不算；錯誤先於判不出', () => {
    const r = stopOfVerdict(v('reject', [
      { kind: 'hole', category: 'incomplete', at: 'n0' },
      { kind: 'fuel', category: 'indeterminate' },
      { kind: 'ubDivZero', category: 'error', at: 'n9' },
    ]))
    expect(r).toMatchObject({ i18nKey: 'RUNTIME_ERR_UB_DIV_ZERO', nodeId: 'n9' })
  })

  it('🔴 系統之間的問題（invalid）不說成「程式不合規則」——那是學生寫錯的說法', () => {
    expect(stopOfVerdict(v('invalid', [{ kind: 'malformed', category: 'invalid', at: 'n5', reason: 'unknown node kind' }])))
      .toMatchObject({ i18nKey: 'RUNTIME_ERR_CELLA_INVALID', params: { why: 'unknown node kind' }, nodeId: 'n5' })
  })

  it('🔴 不是 accept 卻挑不到問題 → 照實說判決本身（不得回 null 冒充跑完）', () => {
    expect(stopOfVerdict(v('invalid', []))).toMatchObject({ kind: 'runtime', i18nKey: 'RUNTIME_ERR_CELLA_INVALID', params: { why: 'invalid' } })
    expect(stopOfVerdict(v('reject', []))).toMatchObject({ kind: 'runtime', i18nKey: 'RUNTIME_ERR_CELLA_REJECTED', params: { why: 'reject' } })
  })
})

describe('stopOfVerdict 對真的判決（cos-mos 核對的那一支：有號溢位）', () => {
  it('🔴 有號溢位 → RUNTIME_ERR_UB_OVERFLOW，nodeId 指回語意樹上的一顆', async () => {
    const { runCella } = await import('../../helpers/cella-run')
    const r = await runCella('#include <climits>\nint main() {\n  int a = INT_MAX;\n  int b = a + 1;\n  return b;\n}\n')
    expect(r.verdict).toBe('reject')
    const s = stopOfVerdict(r.raw as never)
    expect(s?.i18nKey).toBe('RUNTIME_ERR_UB_OVERFLOW')
    const ids = new Set<string>()
    const walk = (n: { id: string; slots?: Record<string, unknown[]> }): void => { ids.add(n.id); for (const k of Object.values(n.slots ?? {})) (k as never[]).forEach(walk) }
    walk(r.tree as never)
    expect(ids.has(s!.nodeId!), `🔴 ${s?.nodeId} 對不回語意樹`).toBe(true)
  }, 120_000)
})
