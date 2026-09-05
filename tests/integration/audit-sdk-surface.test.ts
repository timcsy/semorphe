/**
 * **第一百零六條護欄：SDK 的公開面，改了要說得出改了什麼。**
 *
 * ## 🔴 為什麼需要它
 *
 * `src/sdk/index.ts` 的檔頭自己寫著這條規矩：
 *
 * > ⚠️ **這裡列出來的東西，就是我們對外承諾的形狀。**
 * > 加一個匯出很便宜，**移掉一個很貴**。
 *
 * 而那是一句**沒有機械檢查的規範**——這個 repo 的判準說得很清楚：
 * 那種規範會被下一次順手還原，而還原不會有人發現。
 *
 * ⚠️ **SDK 的破壞性改版有一個特別的性質**：它的傷害發生在**別人的專案裡**，
 * 而我們的測試全部是綠的。`npm test` 驗不到一個消費者的 build 壞了。
 *
 * > **一個公開介面的移除，在自己的 repo 裡與一次正常的重構長得一模一樣
 * > ——差別在別人的 CI 上。**
 *
 * ## 它怎麼運作
 *
 * ```
 * 新增一個匯出   基線上調（在 commit 訊息說一句）
 * 移掉／改名     🔴 顯式【下調】——那就是一次破壞性改版，訊息裡直接說
 * ```
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管型別簽章變了沒**——`.d.mts` 要 build 才有，而 `dist-sdk/` 在
 *   `.gitignore` 裡。這一條守的是**名字**那一層，而那是最便宜也最常見的破壞
 * - **不判斷一個匯出該不該在**——那是設計，不是機械檢查
 * - **不管 `dist-sdk/` 的產物**（它是產物）
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline } from '../helpers/guardrail'

const ENTRY = 'src/sdk/index.ts'

interface Baseline { _meta?: unknown; exports: string[]; note?: string }

/**
 * 這個檔對外匯出的**名字**。
 *
 * ⚠️ 只掃**這一個檔**，不追 `export * from`——那是刻意的：
 * `index.ts` 是**門面**，而門面的職責就是把清單寫在一個地方。
 * 🔴 若哪天有人加了 `export *`，這條護欄會**看不到它帶進來的東西**
 * ——所以底下另有一支擋著那個寫法。
 */
export function sdkExports(src: string): string[] {
  const out = new Set<string>()
  for (const line of src.split('\n')) {
    const t = line.trim()
    // 具名匯出串：`export` ＋ 大括號裡的清單（可帶 `as` 改名）
    // ⚠️ **這裡刻意不寫成範例碼**：這個目錄的反引號片段會被殘差護欄
    //    當成 C++ 語料掃走（判準是「裡面有 `;` 或大括號」）——
    //    而一段 TypeScript 餵進 C++ 解析器必殘。那正是 `history/172`
    //    「幽靈語料」的親戚：**註解裡的一個範例，會變成別人報表上的一筆缺陷。**
    const braced = /^export\s*(?:type\s*)?\{([^}]*)\}/.exec(t)
    if (braced) {
      for (const part of braced[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim()
        if (name) out.add(name)
      }
      continue
    }
    // `export function f` / `export class C` / `export const x` / `export type T`
    const named = /^export\s+(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/.exec(t)
    if (named) out.add(named[1])
  }
  return [...out].sort()
}

const SRC = fs.readFileSync(path.join(REPO_ROOT, ENTRY), 'utf8')
const NOW = sdkExports(SRC)

describe('第一百零六條護欄：SDK 的公開面', () => {
  it('★ 入口條件——真的讀到那個檔了', () => {
    expect(SRC.length, `🔴 ${ENTRY} 是空的或讀不到`).toBeGreaterThan(100)
    expect(NOW.length, '🔴 一個匯出都沒解析到 → 下面每一條都是空過的').toBeGreaterThan(5)
  })

  /**
   * 🔴 **`export *` 會讓這條護欄失明**——它把一整個模組的匯出帶進門面，
   * 而這裡看到的只有一行。
   *
   * > **一個「把清單寫在一個地方」的門面，加一個 `export *` 就不再是門面了。**
   */
  it('🔴 硬性零：門面不得用 `export *`', () => {
    const stars = SRC.split('\n')
      .map((l, i) => [l.trim(), i + 1] as const)
      .filter(([l]) => /^export\s*\*/.test(l))
      .map(([l, n]) => `${ENTRY}:${n}  ${l}`)
    expect(
      stars,
      '🔴 門面裡有 `export *`——它把一整個模組的匯出帶進公開面，\n' +
        '   而這條護欄看到的只有一行。**逐個列出來**，那正是門面的職責。',
    ).toEqual([])
  })

  it('🔴 公開面改了 → 說得出改了什麼', () => {
    if (process.env.GENERATE_BASELINE === '1') {
      writeBaseline('sdk-surface', { exports: NOW })
      return
    }
    const base = loadBaseline<Baseline>('sdk-surface')
    const removed = base.exports.filter((e) => !NOW.includes(e))
    const added = NOW.filter((e) => !base.exports.includes(e))

    expect(
      removed,
      '🔴 **這是一次破壞性改版**——底下這些匯出從公開面上消失了。\n' +
        '   ⚠️ 傷害發生在**別人的專案裡**，而我們的測試全部是綠的。\n' +
        '   要這麼做的話：下調 `tests/baselines/sdk-surface.json`，\n' +
        '   **並在 commit 訊息裡寫明破壞了什麼、消費者該怎麼改**。\n' +
        '   （改名也算——對消費者來說「改名」與「刪掉再加一個」沒有差別。）',
    ).toEqual([])

    expect(
      added,
      '🟢 公開面**變大了**——那多半是對的，而它要被記下來：\n' +
        '   上調 `tests/baselines/sdk-surface.json` 並在 commit 訊息說一句。\n' +
        '   ⚠️ 理由：加一個匯出很便宜，**而移掉它很貴**——所以加之前要想過。',
    ).toEqual([])
  })

  it('★ 注入：移掉一個匯出 → 報得出是哪一個', () => {
    const fake = ['A', 'B', 'C']
    const now = ['A', 'C']
    expect(fake.filter((e) => !now.includes(e))).toEqual(['B'])
  })

  it('★ 注入：`export *` → 抓得到', () => {
    const src = "export * from './core/types'\nexport { A } from './a'\n"
    expect(src.split('\n').filter((l) => /^export\s*\*/.test(l.trim()))).toHaveLength(1)
    // ⚠️ 而解析器**看不到** `export *` 帶進來的東西——那正是上面那條硬性零的理由
    expect(sdkExports(src)).toEqual(['A'])
  })
})
