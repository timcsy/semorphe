/**
 * **formalize 的元件對照**（spec 180 FR-007、SC-004；重構階段 4）。
 *
 * 每顆 C++ 元件，formalize 要嘛對應到 Cella 的建構子，要嘛還沒有——而「還沒有」的那些，
 * formalize 會照實回 unknown（不送、不猜）。這條護欄不另立一張表：**對照的真相是「哪些元件資料夾有 `formalize.ts`」**
 *（第 389 刀起每顆元件的翻譯住在自己的膠囊，引擎用 glob 收集）——另立一張表就是第二份真相。
 *
 * 🪦 第 389 刀之前，真相是引擎裡的 `case 'cpp:…'`（從原始碼讀出來）。那個讀法漏算了一顆：
 *    巢狀初值串列（`cpp:initializer_list`）在 `initOf` 裡用 `if` 判，不是 `case`——它有翻譯，卻被算成「還沒對應」。
 *
 * 棘輪：「還沒對應」的數字只准下降。⚠️ 它量的是「有沒有一條路」，不是「那條路對不對」——
 * 對不對由 `tests/unit/providers/formalize.test.ts` 的形狀判定者與（升級 Cella 後）判決入口的 `invalid` 管。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, printReport, assertRatchet, assertCorpus } from '../helpers/guardrail'

const CPP = path.join(REPO_ROOT, 'src/components/cpp')
const dirs = fs.readdirSync(CPP, { withFileTypes: true }).filter((e) => e.isDirectory())
const all = dirs.filter((e) => fs.existsSync(path.join(CPP, e.name, 'component.json'))).map((e) => `cpp:${e.name}`)
/** 一個 `formalize.ts` 的原始碼 → 它註冊的身分（`r.<位置>('cpp:…'`）。純函式：注入才餵得進合成輸入。 */
export function registeredIds(src: string): string[] {
  return [...src.matchAll(/r\.[a-zA-Z]+\(\s*'([a-z0-9_]+:[a-z0-9_.]+)'/g)].map((m) => m[1])
}
/** 註冊了不屬於自己資料夾的身分的那些。 */
export function foreignRegistrations(files: ReadonlyMap<string, readonly string[]>): string[] {
  return [...files].flatMap(([own, ids]) => ids.filter((id) => id !== own).map((id) => `${own} 的 formalize.ts 註冊了 ${id}`))
}

/** 有 `formalize.ts` 的資料夾 → 它在原始碼裡註冊的身分。 */
const files = new Map(dirs
  .filter((e) => fs.existsSync(path.join(CPP, e.name, 'formalize.ts')))
  .map((e) => [`cpp:${e.name}`, registeredIds(fs.readFileSync(path.join(CPP, e.name, 'formalize.ts'), 'utf8'))] as const))
const handled = new Set(files.keys())
const unmapped = all.filter((id) => !handled.has(id)).sort()

describe('護欄：formalize 的元件對照', () => {
  it('★ 入口條件：真的讀到元件與分派', () => {
    expect(all.length, '一顆 C++ 元件都沒讀到').toBeGreaterThan(200)
    expect(handled.size, '一個 formalize.ts 都沒讀到 → 下面的數字是假的').toBeGreaterThan(30)
    expect([...files.values()].every((ids) => ids.length > 0), '有 formalize.ts 卻讀不到任何註冊 → 讀法壞了').toBe(true)
  })

  it('🔴 每個 formalize.ts 都住在一顆真的元件裡——沒有 component.json 的資料夾不會被走到', () => {
    const ghost = [...handled].filter((id) => !all.includes(id))
    expect(ghost).toEqual([])
  })

  it('🔴 每個 formalize.ts 註冊的身分都是它所在資料夾的那一顆（引擎載入時也會 throw，這裡先說出是哪一個檔）', () => {
    expect(foreignRegistrations(files)).toEqual([])
  })

  it('★ 注入①：每一個註冊位置的寫法都讀得到身分（含換行），而註解與別的呼叫不算', () => {
    const src = [
      "  r.expr('cpp:x', (n, f) => f.k('eNum', { n: n.id }))",
      "  r.stmt(\n    'cpp:x', (n, f) => f.exprStmt(n))",
      "  r.constInt('cpp:x', (n) => null)",
      "  // r 的說明裡提到 'cpp:y' 不是註冊",
      "  f.call(n, 'cpp:z', [])",
    ].join('\n')
    expect(registeredIds(src)).toEqual(['cpp:x', 'cpp:x', 'cpp:x'])
  })

  it('★ 注入②：註冊了別顆的身分 → 紅，且指名是哪一個檔、哪一個身分', () => {
    const bad = foreignRegistrations(new Map([['cpp:x', ['cpp:x', 'cpp:y']], ['cpp:z', ['cpp:z']]]))
    expect(bad).toEqual(['cpp:x 的 formalize.ts 註冊了 cpp:y'])
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
