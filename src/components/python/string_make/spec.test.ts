/**
 * `python:string_make` 與 `python:string_insert` 的自證測。
 *
 * 🔴 **這一顆的存在理由是「產出不合法的 Python」**，不是「少一顆積木」：
 * 在它之前，`f"{name}"` 被當成普通字串，產回去是 `"f"{name}""`。
 * 所以來回轉換那幾支是這個檔的重點。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython, runPython } from '../../../../tests/helpers/python-lift'

const ids = async (code: string): Promise<string[]> => componentIdsOf(await liftPython(code))
const roundTrip = async (code: string): Promise<string> => generatePython(await liftPython(code)).trim()

describe('python:string_make', () => {
  it('lift：f-string 認得出來，而普通字串不受影響', async () => {
    const f = await ids('x = f"hi {name}"')
    expect(f, '正向錨點——沒有它，下面的負向斷言會空過').toContain('python:string_make')
    expect(f).toContain('python:string_insert')
    expect(f).not.toContain('unresolved')

    // 🔴 對照組：同一個 AST 節點型別，而普通字串必須仍然走字面值那顆
    const plain = await ids('y = "plain"')
    expect(plain).toContain('python:literal_string')
    expect(plain).not.toContain('python:string_make')
  })

  it('lift：格式規格是結構化的一格，不是黏在文字裡', async () => {
    const tree = await liftPython('x = f"{s:.1f}"')
    const find = (n: unknown): Record<string, unknown> | null => {
      const node = n as { componentId?: string; properties?: Record<string, unknown>; children?: Record<string, unknown[]> }
      if (node?.componentId === 'python:string_insert') return node.properties ?? {}
      for (const kids of Object.values(node?.children ?? {})) for (const k of kids ?? []) { const r = find(k); if (r) return r }
      return null
    }
    expect(find(tree), '找不到插槽 → 這支測試量不到東西').not.toBeNull()
    expect(find(tree)?.format, '冒號是語法不是格式，不得留在值裡').toBe('.1f')
  })

  it('來回：四種寫法都一字不差', async () => {
    expect(await roundTrip('x = f"{a}"')).toBe('x = f"{a}"')
    expect(await roundTrip('x = f"文字{a}文字"')).toBe('x = f"文字{a}文字"')
    expect(await roundTrip('x = f"{a:.2f}"')).toBe('x = f"{a:.2f}"')
    // ⚠️ 單引號寫的會產成雙引號——**引號的選擇不是語義**，所以比的是意思相同
    expect(await roundTrip("x = f'{a}{b}'")).toBe('x = f"{a}{b}"')
  })

  it('來回：普通字串不得被改動', async () => {
    expect(await roundTrip('x = "plain"')).toBe('x = "plain"')
  })

  it('執行：真的有輸出，而且格式有作用', async () => {
    expect(await runPython('x = 5\nprint(f"值是 {x}")\n')).toContain('值是 5')
    expect(await runPython('x = 3.14159\nprint(f"{x:.2f}")\n')).toContain('3.14')
  })

  it('🔴 執行：認不得的格式【丟錯】，不得靜默照原樣印', async () => {
    const out = await runPython('x = 1\nprint(f"{x:>10}")\n')
    expect(out, `靜默印出來了：${JSON.stringify(out)}——那與「格式本來就這樣」看起來一樣`).not.toMatch(/^\s*1\s*$/)
  })
})
