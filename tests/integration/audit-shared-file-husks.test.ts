/**
 * **第三十八條護欄：共用檔的殼與重複**
 *
 * ## 它量什麼
 *
 * F（膠囊搬家）把 177 顆元件的五路剪出共用檔之後，共用檔剩下兩種東西：
 *
 * ```
 * ✅ 真正共用的演算法與訊號類別   formatParams / openBraceFor / ReturnSignal …
 * ❌ 空掉的註冊函式               export function registerXxx() { }
 * ```
 *
 * 第二種就是**殼**——`components/執行機構.md` 的主題，而階段 6.5 花了整段在治它。
 * **F 自己又生了一批出來**，因為搬家是一顆一顆搬的，
 * 而「這個模組已經沒有東西可註冊了」只有在最後一顆搬完才成立。
 *
 * > **一個清償動作會在它自己的尾巴上生出同一種債。**
 *
 * ## 它同時量第二件事：重複的演算法
 *
 * 第一次跑就抓到兩組**逐字相同**的函式住在兩個檔裡：
 *
 * ```
 * mapFind                core/executors/containers.ts  與  std/map/executors.ts
 * resolveRange / numOf   std/algorithm/executors.ts    與  std/numeric/executors.ts
 * ```
 *
 * 而**不同的膠囊各 import 一份**（`container_count` 用前者、`map_assign` 用後者）。
 * 那正是這個專案的頭號病：**兩份真相會漂移**。
 *
 * ⚠️ 它為什麼在 F 之後才現形：以前那些函式是模組內部的實作細節，
 * 只有自己的註冊函式在用；膠囊化之後它們變成**跨膠囊的 import**，
 * 於是「同一個東西有兩個進入點」才看得出來。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「這個演算法該住哪」**——只說「它有兩份」與「這個註冊函式是空的」。
 * - **不檢測膠囊內部**（`src/components/`）。膠囊的空 `registerLift()` 是**顯式的空**
 *   （判別走 pattern，建構子另外提供），那是設計不是殼。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * > **如果「掃到的共用檔數」或「掃到的 export 總數」是 0，
 * > 代表工具壞了，不是世界長這樣。**
 *
 * 錨在**掃描的輸入量**上，不錨在殼的筆數——後者正是這條護欄要推向零的東西，
 * 錨在它上面的健康檢查**會在成功的那天變紅**（`build-guardrail` 第 2 步，
 * 這個專案已經犯過七次的形狀）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, loadBaseline, writeBaseline, printReport, assertRatchet, RATCHET_NOTE } from '../helpers/guardrail'

const GUARD_NAME = 'shared-file-husks'

interface Baseline {
  _meta: { note: string; ratchet: string }
  scanned: { fileCount: number; exportCount: number }
  husks: number
  duplicates: number
  details: { husks: string[]; duplicates: string[] }
}

/**
 * 共用檔＝`src/` 底下**不在膠囊裡**的 `.ts`。
 *
 * ⚠️ 膠囊排除掉，理由見檔頭：膠囊的空 `registerLift()` 是顯式的空。
 */
function sharedFiles(): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name !== 'components') walk(p)
      } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
    }
  }
  walk(path.join(REPO_ROOT, 'src'))
  return out
}

/** 一個函式的本體去掉註解與空行之後還剩什麼。 */
function bodyIsEmpty(src: string, head: number): boolean {
  let d = 0
  let i = src.indexOf('{', head)
  const start = i
  while (i < src.length) {
    if (src[i] === '{') d++
    else if (src[i] === '}') {
      d--
      if (d === 0) break
    }
    i++
  }
  const body = src.slice(start + 1, i)
  return !body.split('\n').some((l) => {
    const t = l.trim()
    return t !== '' && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  })
}

/** 空掉的註冊函式。**純函式**——注入才餵得進合成輸入。 */
export function detectHusks(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(/export (?:async )?function (register\w+)\s*\(/g)) {
    if (bodyIsEmpty(content, m.index ?? 0)) out.push(m[1])
  }
  return out
}

/** 一個檔匯出的非登錄符號（演算法、常數、類別）。 */
export function exportedAlgorithms(content: string): string[] {
  return [...content.matchAll(/export (?:async )?(?:function|const|class) (\w+)/g)]
    .map((m) => m[1])
    .filter((n) => !n.startsWith('register'))
}

describe('第三十八條護欄：共用檔的殼與重複', () => {
  it('★ 健康檢查：掃描真的吃到東西', () => {
    const files = sharedFiles()
    expect(files.length, '一個共用檔都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(50)
    const total = files.reduce((n, f) => n + exportedAlgorithms(fs.readFileSync(f, 'utf8')).length, 0)
    expect(total, '一個 export 都沒看到 → 掃描器沒吃到內容').toBeGreaterThan(50)
  })

  it('★ 注入①：空掉的註冊函式必須被報出', () => {
    expect(detectHusks('export function registerFoo(): void {\n}\n')).toEqual(['registerFoo'])
    expect(detectHusks('export function registerBar(r: X): void {\n  // 只剩註解\n\n}\n')).toEqual(['registerBar'])
  })

  it('★ 注入②：有內容的、以及不叫 register 的，都不得被報', () => {
    // 這一條不可省。沒有它，一個「什麼都報」的掃描器也能通過注入①。
    expect(detectHusks('export function registerFoo(): void {\n  r("a", f)\n}\n')).toEqual([])
    expect(detectHusks('export function computeFoo(): void {\n}\n')).toEqual([])
    expect(detectHusks('沒有任何函式的一份檔')).toEqual([])
  })

  it('★ 注入③：同名的 export 出現在兩個檔要被判為重複', () => {
    const a = exportedAlgorithms('export function mapFind(x) { return 1 }')
    const b = exportedAlgorithms('export function mapFind(x) { return 1 }')
    expect(a).toEqual(['mapFind'])
    expect(a[0]).toBe(b[0])
  })

  it('棘輪：空殼與重複都只准下降', () => {
    const files = sharedFiles()
    const husks: string[] = []
    const origin = new Map<string, string[]>()

    for (const f of files) {
      const rel = path.relative(REPO_ROOT, f)
      const s = fs.readFileSync(f, 'utf8')
      for (const fn of detectHusks(s)) husks.push(`${rel} → ${fn}()`)
      for (const e of exportedAlgorithms(s)) {
        if (!origin.has(e)) origin.set(e, [])
        origin.get(e)!.push(rel)
      }
    }
    const duplicates = [...origin]
      .filter(([, ps]) => ps.length > 1)
      .map(([e, ps]) => `${e}：${ps.join(' 與 ')}`)
      .sort()
    husks.sort()

    if (process.env.GENERATE_BASELINE) {
      writeBaseline(GUARD_NAME, {
        _meta: {
          note:
            '共用檔（`src/` 扣掉膠囊）裡的**空掉的註冊函式**與**同名的 export**。\n' +
            '⚠️ 兩個數字的意義不同：空殼是**殼**（規範說有、實際是空的），' +
            '重複是**兩份真相**（會漂移）。\n' +
            '⚠️ 下降必須是「刪掉了殼／合併了兩份」，不是「把檔案排除在掃描外」。',
          ratchet: RATCHET_NOTE,
        },
        scanned: {
          fileCount: files.length,
          exportCount: files.reduce((n, f) => n + exportedAlgorithms(fs.readFileSync(f, 'utf8')).length, 0),
        },
        husks: husks.length,
        duplicates: duplicates.length,
        details: { husks, duplicates },
      } satisfies Baseline)
      return
    }

    const base = loadBaseline<Baseline>(GUARD_NAME)
    printReport('共用檔的殼與重複', [
      `掃描   ${files.length} 個共用檔`,
      `空殼   ${husks.length}（基線 ${base.husks}）`,
      ...husks.map((x) => `  ✘ ${x}`),
      `重複   ${duplicates.length}（基線 ${base.duplicates}）`,
      ...duplicates.map((x) => `  ✘ ${x}`),
    ])
    const newHusks = husks.filter((x) => !base.details.husks.includes(x))
    const newDuplicates = duplicates.filter((x) => !base.details.duplicates.includes(x))
    expect(newHusks, `新增了空掉的註冊函式：\n  ${newHusks.join('\n  ')}`).toEqual([])
    expect(newDuplicates, `新增了兩份同名的 export（會漂移）：\n  ${newDuplicates.join('\n  ')}`).toEqual([])
    assertRatchet([
      ['空殼', husks.length, base.husks],
      ['重複', duplicates.length, base.duplicates],
    ])
  })
})
