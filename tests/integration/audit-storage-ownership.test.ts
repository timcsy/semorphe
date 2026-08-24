/**
 * **第六十一條護欄：存檔的每一個欄位，都要說得出它屬於誰、而且有人讀它。**
 *
 * ## 這條從哪來
 *
 * 2026-08-24 規劃「網頁版有檔案」時查證 `SavedState`，發現兩件事：
 *
 * ```
 * ① 一份存檔裡混了四種歸屬     檔案 · 主體的外觀 · 使用者 · 教學情境
 * ② `tree` 存了 10 個世代、被遷移改寫 8 次，而【沒有任何還原路徑在讀它】
 * ```
 *
 * 第二件事之所以能活這麼久，是因為**沒有人在量「這個欄位有沒有人讀」**
 * ——它與 `annotation-adoption`（宣告了而沒有人消費）是同一個病。
 *
 * > **一個沒有人讀的存檔欄位，會被每一次遷移認真地搬運下去。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果這支護欄在「某個欄位真的沒有人讀」的情況下仍然報零，
 * > 代表它的讀取點比對寫錯了——那是工具壞了，不是欄位都健康。**
 *
 * 判斷依據是 `★ 合成注入`那兩支（餵合成的原始碼給比對函式），
 * **不是**真實那個數字。⚠️ 同一個坑 `annotation-adoption` 踩過：
 * 「讀取點的比對若寫錯，每個標註都會顯示 0 個讀取點，
 * 而**『全部都沒人用』與『比對壞了』產出完全一樣**」。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測歸屬判得對不對**——那是判斷，落在 `FIELD_OWNERSHIP` 的宣告上，
 *   而這裡只要求**每一個欄位都被判過**。
 * - **不檢測遷移正確性**——那是 `audit-storage-integrity`。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SAVED_STATE_FIELDS, FIELD_OWNERSHIP } from '../../src/core/storage-version'
import { printReport, assertRatchet, assertCorpus, REPO_ROOT } from '../helpers/guardrail'

/** 讀取點——只認具名的取用，不認「字串剛好出現」 */
export function countReaders(source: string, field: string): number {
  const esc = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // `state.tree` / `saved.tree` / `loaded.state.tree` / `s.tree`——一個識別字後面接 `.欄位`
  return source.match(new RegExp(`\\b[a-zA-Z_$][\\w$]*\\.${esc}\\b`, 'g'))?.length ?? 0
}

/** 存檔模組自己不算——它當然會碰每一個欄位 */
const SELF = ['src/core/storage.ts', 'src/core/storage-version.ts']

function consumerSource(): string {
  let out = ''
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !SELF.includes(rel)) {
        out += fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')
      }
    }
  }
  walk('src')
  return out
}

const src = consumerSource()
const fields = Object.keys(SAVED_STATE_FIELDS)
/** `version`／`lastModified` 是存檔機制自己的元資料——它們的消費者就是存檔模組 */
const META = new Set(['version', 'lastModified'])
const unread = fields.filter((f) => !META.has(f) && countReaders(src, f) === 0)

describe('護欄：存檔欄位的歸屬與讀取點（第六十一條）', () => {
  it('★ 合成注入：具名的讀取必須被數到', () => {
    expect(countReaders(`if (state.blocklyState) restore(state.blocklyState)`, 'blocklyState')).toBe(2)
    expect(countReaders(`const c = saved.code`, 'code')).toBe(1)
  })

  it('★ 合成注入：不同欄位不得互相計數，字串剛好出現也不算', () => {
    expect(countReaders(`const t = state.treeish`, 'tree'), '前綴相同不算').toBe(0)
    expect(countReaders(`console.log('tree')`, 'tree'), '字串裡出現不算').toBe(0)
  })

  it('★ 入口條件：真的讀到消費端的原始碼了', () => {
    // ⚠️ 錨在**輸入量**上：原始碼的量不會因為這條護欄想推向零的東西被修好而變小
    expect(src.length, '一個字都沒讀到 → 下面每個零都是假的').toBeGreaterThan(500_000)
    expect(fields.length, '欄位清單是空的 → 什麼都沒量').toBeGreaterThan(5)
  })

  it('🔴 硬性零：每一個存檔欄位都要說得出它屬於誰', () => {
    const missing = fields.filter((f) => !(f in FIELD_OWNERSHIP))
    expect(
      missing,
      '一個沒被判過歸屬的欄位，會在「多檔案」那天不知道該跟著檔案走還是跟著使用者走',
    ).toEqual([])
  })

  it('★ 歸屬的值域是封閉的——第五個值要先問「它是不是一個新的歸屬」', () => {
    const allowed = new Set(['document', 'sideCar', 'user', 'context', 'meta'])
    const bad = Object.entries(FIELD_OWNERSHIP).filter(([, v]) => !allowed.has(v))
    expect(bad).toEqual([])
  })

  it('棘輪：沒有讀取點的存檔欄位只准下降', () => {
    printReport('存檔欄位的歸屬與讀取點（第六十一條）', [
      `欄位 ${fields.length} 個`,
      '',
      ...fields.map((f) => {
        const n = META.has(f) ? '—' : String(countReaders(src, f))
        return `  ${f.padEnd(18)} ${String(FIELD_OWNERSHIP[f] ?? '（未判）').padEnd(10)} 讀取點 ${n}`
      }),
      '',
      '**沒有讀取點 ＝ 每一次遷移都在認真地搬運一個沒有人要的東西。**',
    ])
    assertCorpus([['存檔欄位數', fields.length]], 'storage-ownership')
    assertRatchet([['沒有讀取點的欄位', unread.length]], 'storage-ownership', { detail: unread })
  })
})
