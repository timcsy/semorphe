/**
 * spec 160：**Python 的第一顆積木——兩條到達路徑都要走得到。**
 *
 * ## 為什麼是【兩條】
 *
 * `experience.md` 逐字：
 *
 * > 一顆積木可以有兩條到達路徑（**工具箱拖出來** vs **貼上程式碼 lift 出來**），
 * > 而**修好其中一條，另一條上的學生什麼都沒感覺到**。
 *
 * spec 157 已經證明 Python 的 `print` **產得回去**（路徑①的下半），
 * 而積木那一側一個字都還沒有。這一支釘的是積木。
 *
 * ## 這一支同時是 P3 的直接檢驗
 *
 * `principles.md:65` 逐字：
 *
 * > 系統可以在**不修改既有程式碼**的前提下加入新元件、新語言、新套件
 *
 * 🔴 **如果加一顆 Python 積木必須動 `block-registrar`，P3 當場被否證**
 * ——而那正是 `vision` 裡那 33 筆要量的東西。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'
import { componentBlocks, componentComponents } from '../../src/core/component/registry'

describe('spec 160 · Python 的第一顆積木', () => {
  it('★ 錨點：膠囊登錄表真的掃到了 Python（否則下面在驗空集合）', () => {
    const ids = (componentComponents() as { componentId: string }[]).map((c) => c.componentId)
    expect(ids, 'python:print 應該早在 spec 156 就進了登錄表').toContain('python:print')
  })

  it('🔴 `python:print` 有一顆宣告式的積木', () => {
    const forms = componentBlocks() as { componentId: string; blockDef?: { type?: string } }[]
    const py = forms.filter((f) => f.componentId === 'python:print')
    expect(py.length, '膠囊裡沒有 forms/blocks.json → 路徑①（工具箱）走不到').toBeGreaterThan(0)
    expect(py[0]?.blockDef?.type).toBe('python_print')
  })

  it('🔴 P3 的直接檢驗：`block-registrar` 一行 Python 都不准出現', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/block-registrar.ts'), 'utf8')
    expect(/python/i.test(src),
      '⚠️ 加一顆 Python 積木若必須動 block-registrar，P3（不修改既有程式碼）當場被否證。'
      + '這正是 vision 那 33 筆要量的東西。').toBe(false)
  })

  it('🔴 五路完備性：render／extract 不再是缺（只剩 execute）', () => {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/python/print/component.json'), 'utf8'))
    const missing = Object.entries(manifest.paths as Record<string, unknown>)
      .filter(([k, v]) => !k.startsWith('_') && v === null)
      .map(([k]) => k)
    expect(missing.sort(),
      'render／extract 必須成對補上；execute 維持【誠實的缺】（spec 156 明確排除 Python 執行期）')
      .toEqual(['execute'])
  })

  it('🔴 wasm 出貨——而它出貨的理由是【有人要它】', () => {
    const shipped = path.join(REPO_ROOT, 'public/tree-sitter-python.wasm')
    expect(fs.existsSync(shipped),
      '⚠️ 第四十六條護欄：出貨的每一個 wasm 都要有人真的去要它。'
      + '反過來也成立——有人要它的時候它就必須出貨，否則瀏覽器裡拿不到。').toBe(true)
  })
})
