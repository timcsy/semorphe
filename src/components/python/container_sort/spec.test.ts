/** `python:container_sort` 的自證測。每條負向前先釘正向錨點。 */
import { describe, it, expect } from 'vitest'
import { liftPython, componentIdsOf, generatePython as gen, runPython } from '../../../../tests/helpers/python-lift'

/**
 * 🔴 **`key=` 與 `reverse=`**（2026-08-22）。它們在 AI 生的 Python 裡比
 * 裸的 `sorted(xs)` 還常見，而之前掉進通用桶（跑得動、而學生拖不到）。
 */
describe('兩個關鍵字引數', () => {
  it('★ lift ＋ round-trip：空的那一格不得被寫出來', async () => {
    for (const code of ['a = sorted(w)\n', 'a = sorted(w, key=len)\n', 'a = sorted(w, reverse=True)\n', 'a = sorted(w, key=len, reverse=True)\n']) {
      expect(componentIdsOf(await liftPython(code)), code.trim()).toContain('python:container_sort')
      expect(gen(await liftPython(code)).trimEnd()).toBe(code.trimEnd())
    }
  })

  it('🔴 execute：四種組合各測一次', async () => {
    const out = await runPython('w = ["bb", "a", "ccc"]\nprint(sorted(w))\nprint(sorted(w, key=len))\nprint(sorted(w, reverse=True))\nprint(sorted(w, key=len, reverse=True))\n')
    expect(out).toContain("['a', 'bb', 'ccc']\n['a', 'bb', 'ccc']\n['ccc', 'bb', 'a']\n['ccc', 'bb', 'a']")
  })

  it('🔴 別的關鍵字引數讓一般呼叫接手——積木上沒有那一格', async () => {
    expect(componentIdsOf(await liftPython('a = sorted(w, foo=1)\n'))).not.toContain('python:container_sort')
  })
})
