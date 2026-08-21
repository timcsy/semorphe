/**
 * 🔴 **降級的語句在區塊裡必須跟著縮排**（2026-08-21）。
 *
 * `unresolved` 的產生器（`code-generator.ts:117`）少了 `indent(ctx)`，
 * 而它**上面兩行**的 `raw_code` 產生器有。
 *
 * 症狀：`for i in range(3):` 裡的 `total += i`（`augmented_assignment` 還沒有元件）
 * 產回去頂到最左邊——**產出的是一段語義完全不同、而且合法的 Python**。
 *
 * > **兩個做同一件事的產生器住在同一個檔的相鄰兩行，
 * > 而其中一個少做了一件事——那不會有任何測試變紅。**
 *
 * ⚠️ 它比「缺一顆元件」嚴重：一顆灰積木學生看得見（P6），
 * 而一段縮排錯掉的 Python **看起來很正常**。
 */
import { describe, it, expect } from 'vitest'
import { liftPython, generatePython } from '../helpers/python-lift'

const lineWith = (out: string, needle: string): string | undefined =>
  out.split('\n').find((l) => l.includes(needle))

describe('降級的語句在區塊裡的縮排', () => {
  it('★ 正向錨點：認得出來的語句本來就有縮排（否則下面在驗空的）', async () => {
    const out = generatePython(await liftPython('for i in xs:\n    print(i)\n'))
    expect(out, '產不出東西 → 量測壞了').toContain('print')
    expect(lineWith(out, 'print'), `錨點自己就沒縮排：${JSON.stringify(out)}`).toMatch(/^\s+/)
  })

  it('🔴 認不出來的語句也必須縮排', async () => {
    const out = generatePython(await liftPython('for i in xs:\n    total += i\n'))
    const line = lineWith(out, 'total')
    expect(line, '找不到那一行 → 這支測試量不到東西').toBeDefined()
    expect(line, `降級語句頂到最左邊了：${JSON.stringify(out)}`).toMatch(/^\s+total/)
  })

  it('🔴 巢狀兩層也要對', async () => {
    const out = generatePython(await liftPython('for i in xs:\n    while ok:\n        total += i\n'))
    const line = lineWith(out, 'total')
    expect(line, `巢狀第二層的縮排不對：${JSON.stringify(out)}`).toMatch(/^ {8}total/)
  })

  it('★ 對照組：頂層的降級語句【不得】被多加縮排', async () => {
    const out = generatePython(await liftPython('total += i\n'))
    expect(lineWith(out, 'total'), `頂層被多縮了：${JSON.stringify(out)}`).toMatch(/^total/)
  })
})
