/**
 * **formalize 的元件對照**（spec 180 FR-007、SC-004；重構階段 4）。
 *
 * 每顆 C++ 元件，formalize 要嘛對應到 Cella 的建構子，要嘛還沒有——而「還沒有」的那些，
 * formalize 會照實回 unknown（不送、不猜）。這條護欄不另立一張表：**對照的真相就是 formalize 自己的分派**
 *（`case 'cpp:…'`），從原始碼讀出來——另立一張表就是第二份真相。
 *
 * 棘輪：「還沒對應」的數字只准下降。⚠️ 它量的是「有沒有一條路」，不是「那條路對不對」——
 * 對不對由 `tests/unit/providers/formalize.test.ts` 的形狀判定者與（升級 Cella 後）判決入口的 `invalid` 管。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport, assertRatchet, assertCorpus } from '../helpers/guardrail'

const SRC = path.join(REPO_ROOT, 'src/providers/cella/formalize/index.ts')
const handled = new Set([...fs.readFileSync(SRC, 'utf8').matchAll(/case '(cpp:[a-z0-9_]+)'/g)].map((m) => m[1]))
const all = fs.readdirSync(path.join(REPO_ROOT, 'src/components/cpp'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(REPO_ROOT, 'src/components/cpp', e.name, 'component.json')))
  .map((e) => `cpp:${e.name}`)
const unmapped = all.filter((id) => !handled.has(id)).sort()

describe('護欄：formalize 的元件對照', () => {
  it('★ 入口條件：真的讀到元件與分派', () => {
    expect(all.length, '一顆 C++ 元件都沒讀到').toBeGreaterThan(200)
    expect(handled.size, 'formalize 一個分派都沒讀到 → 下面的數字是假的').toBeGreaterThan(30)
  })

  it('🔴 分派裡的每一個身分都是真的元件——打錯字的 case 永遠不會被走到', () => {
    const ghost = [...handled].filter((id) => !all.includes(id))
    expect(ghost).toEqual([])
  })

  it('棘輪：還沒對應的元件只准下降', () => {
    printReport('formalize 的元件對照（spec 180）', [
      `C++ 元件 ${all.length} 顆；已對應 ${handled.size}；還沒對應 ${unmapped.length}`,
      `還沒對應：${unmapped.join(' ')}`,
    ])
    assertCorpus([['C++ 元件數', all.length]], 'formalize-coverage')
    assertRatchet([['還沒對應', unmapped.length]], 'formalize-coverage')
  })
})
