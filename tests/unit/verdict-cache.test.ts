/**
 * 判決結果快取（`tests/helpers/verdict-cache.ts`）——鍵對、id 換得回來、不該存的不存。
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cachedVerdict, normalizeWithIds, directoryStore, storeFromEnv, type VerdictStore } from '../helpers/verdict-cache'
import { normalizeFormal } from '../helpers/normalize-formal'

const memory = (): VerdictStore & { m: Map<string, string> } => {
  const m = new Map<string, string>()
  return { m, get: (k) => m.get(k), put: (k, v) => void m.set(k, v) }
}

/** 同一支程式 lift 兩次：結構一樣、節點編號不同 */
const prog = (a: string, b: string): unknown => ({
  items: [{ k: 'iFun', n: a, body: [{ k: 'sExpr', n: b, e: { k: 'eVar', x: a } }] }],
})
const A = prog('node_1_aaa', 'node_2_aaa')
const B = prog('node_7_bbb', 'node_9_bbb')
const key = (program: unknown) => ({ moduleHash: 'm1', program, stdin: '', steps: 100 })

describe('判決結果快取', () => {
  it('正規化與 normalize-formal 同一條規則（兩份實作，釘住輸出相同）', () => {
    expect(normalizeWithIds(A).normalized).toEqual(normalizeFormal(A))
    expect(normalizeWithIds(A).normalized).toEqual(normalizeWithIds(B).normalized)
  })

  it('只差節點編號 ⟹ 命中；判決裡指回節點的字串換回這一次的 id', () => {
    const s = memory()
    let calls = 0
    const judge = (at: string) => () => { calls++; return { verdict: 'reject', out: '', problems: [{ kind: 'ubBounds', at: `${at}/rhs` }] } }
    const v1 = cachedVerdict(judge('node_2_aaa'), key(A), s)
    expect(v1.problems[0].at).toBe('node_2_aaa/rhs')
    expect(s.m.size).toBe(1)
    // 存的是標籤，不是這一次的 id
    expect([...s.m.values()][0]).toContain('"#2/rhs"')
    const v2 = cachedVerdict(judge('不該被呼叫'), key(B), s)
    expect(calls).toBe(1)
    expect(v2.problems[0].at).toBe('node_9_bbb/rhs')
  })

  it('鍵的每一格都算數：判決器、stdin、步數、程式任何一個不同就不命中', () => {
    const s = memory()
    let calls = 0
    const judge = () => { calls++; return { verdict: 'accept', out: 'x', problems: [] } }
    cachedVerdict(judge, key(A), s)
    cachedVerdict(judge, { ...key(A), moduleHash: 'm2' }, s)
    cachedVerdict(judge, { ...key(A), stdin: '1\n' }, s)
    cachedVerdict(judge, { ...key(A), steps: 101 }, s)
    cachedVerdict(judge, key({ items: [] }), s)
    expect(calls).toBe(5)
    cachedVerdict(judge, key(B), s)
    expect(calls).toBe(5)
  })

  it('輸出裡有長得像標籤的字串（程式印出 #1）⟹ 不存：讀回來時會被誤換', () => {
    const s = memory()
    cachedVerdict(() => ({ verdict: 'accept', out: '#1', problems: [] }), key(A), s)
    expect(s.m.size).toBe(0)
  })

  it('判決提到程式裡沒有的節點 ⟹ 不存（換不回來）', () => {
    const s = memory()
    cachedVerdict(() => ({ verdict: 'reject', out: '', problems: [{ at: 'node_99_zzz' }] }), key(A), s)
    expect(s.m.size).toBe(0)
  })

  it('SEMORPHE_VERDICT_CACHE=0 關掉；給目錄就換位置', () => {
    expect(storeFromEnv({ SEMORPHE_VERDICT_CACHE: '0' })).toBeNull()
    const dir = mkdtempSync(join(tmpdir(), 'vc-'))
    const st = storeFromEnv({ SEMORPHE_VERDICT_CACHE: dir })!
    st.put('abcdef', '{"a":1}')
    expect(directoryStore(dir).get('abcdef')).toBe('{"a":1}')
    expect(st.get('zzzz')).toBeUndefined()
  })
})
