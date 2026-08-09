/**
 * 第二十二條護欄：**積木的訊息必須引用到它宣告的每一個參數**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的「args 有 2 個而訊息只寫 %1」
 * > 沒有被報出來，代表護欄壞了，不是積木都健康。**
 *
 * ## 為什麼需要這一條——它的代價是使用者看到的一團亂
 *
 * Blockly 在 `jsonInit` 時會驗這件事，驗不過就**拋例外**：
 *
 * ```
 * Error: Block "cpp_istringstream_declare": Message does not reference all 2 arg(s).
 * ```
 *
 * 而那個例外的落點很糟——它發生在飛出選單建立積木的過程中，於是
 * **`clearOldBlocks()` 中斷**：
 *
 * ```
 * Error: Block not present in workspace's list of top-most blocks.
 *   at clearOldBlocks → show → updateFlyout_
 * ```
 *
 * 舊分類的積木**永遠清不掉**，全部堆在 `translate(0, 0)`。使用者看到的是
 * **一疊互相重疊、來自好幾個分類的積木**——而那個症狀離根因（少一個 i18n 鍵）
 * 非常遠。
 *
 * ## 為什麼它躲了那麼久
 *
 * 這 5 顆壞掉的積木**沒有被任何課程收錄**，所以**從來沒有被渲染過**。
 * 一顆永遠不渲染的積木，壞掉與健康長得一模一樣。
 *
 * 直到有人把它們補進課程——**症狀才爆出來，而且看起來像是補課程造成的**。
 *
 * > 這與「工具箱拿不到」是同一族：**沒有入口的東西，壞了也沒有人知道**。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測訊息通不通順**——`'%1 %2'` 也算過。
 * - **不檢測 i18n 翻譯完不完整**——只要 zh-TW 或 en 任一有鍵就算解析得到。
 *   缺翻譯是另一件事（會顯示英文，不會炸）。
 * - **不檢測命令式註冊的積木**——它們不走 `jsonInit` 的訊息插值。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { printReport, listSourceFiles, REPO_ROOT } from '../helpers/guardrail'
import zhTWShared from '../../src/i18n/zh-TW/blocks.json'
import enShared from '../../src/i18n/en/blocks.json'
import { componentLabels } from '../../src/core/component/labels'

// ⚠️ **i18n 鍵不再只住在共用檔裡。** 元件膠囊自帶 `labels/<locale>.json`，
// 而這條護欄原本只讀共用檔——一顆把標籤搬進膠囊的元件，會被回報成「缺 i18n 鍵」，
// 症狀（依本檔開頭的說明）是「使用者看到一疊互相重疊的積木」。
// **搬對了反而報錯**，而錯的方向剛好是最嚇人的那種。
const zhTW = { ...zhTWShared, ...componentLabels('zh-TW') }
const en = { ...enShared, ...componentLabels('en') }

const MSGS = { ...(en as Record<string, string>), ...(zhTW as Record<string, string>) }

/** 把 `%{BKY_KEY}` 換成實際訊息；鍵不存在時留下一個找得到的標記 */
function resolve(raw: string): string {
  return raw.replace(/%\{BKY_(\w+)\}/g, (_, k: string) => MSGS[k] ?? `«缺鍵:${k}»`)
}

interface BlockDef {
  type?: string
  [k: string]: unknown
}

interface Violation {
  type: string
  slot: number
  reason: '缺 i18n 鍵' | '訊息沒引用到全部參數'
  detail: string
  file: string
}

function 檢查(bd: BlockDef, file: string): Violation[] {
  const out: Violation[] = []
  for (let i = 0; i < 5; i++) {
    const raw = bd[`message${i}`] as string | undefined
    const args = bd[`args${i}`] as unknown[] | undefined
    if (raw === undefined && args === undefined) continue
    const n = args?.length ?? 0
    // 空訊息＋有 args = 命令式註冊的動態積木（它們自己組欄位），不在範圍
    if (!raw && n > 0) continue
    const msg = resolve(raw ?? '')
    if (msg.includes('«缺鍵:')) {
      out.push({ type: bd.type ?? '?', slot: i, reason: '缺 i18n 鍵', detail: msg, file })
      continue
    }
    const refs = new Set([...msg.matchAll(/%(\d+)/g)].map((m) => Number(m[1])))
    const need = [...Array(n).keys()].map((k) => k + 1)
    if (need.some((k) => !refs.has(k))) {
      out.push({
        type: bd.type ?? '?',
        slot: i,
        reason: '訊息沒引用到全部參數',
        detail: `args=${n}，訊息「${msg}」只引用 ${[...refs].sort().join(',') || '（無）'}`,
        file,
      })
    }
  }
  return out
}

function scan(extra: BlockDef[] = []): Violation[] {
  const out: Violation[] = []
  for (const rel of listSourceFiles('src', ['.json'])) {
    if (rel.includes('/i18n/')) continue
    let arr: unknown
    try {
      arr = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(arr)) continue
    for (const entry of arr) {
      const bd = (entry as { blockDef?: BlockDef })?.blockDef
      if (bd && typeof bd === 'object') out.push(...檢查(bd, rel))
    }
  }
  for (const bd of extra) out.push(...檢查(bd, '（合成）'))
  return out.sort((a, b) => a.type.localeCompare(b.type))
}

// ─── 自我驗證：兩個方向都要釘 ─────────────────────────────────────

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 注入「args 有 2 個而訊息只寫 %1」→ **必須被報出**', () => {
    const hit = scan([{ type: '__合成_少引用__', message0: '只有 %1', args0: [{}, {}] }]).filter(
      (v) => v.type === '__合成_少引用__',
    )
    expect(hit, '合成的違規沒有被報出來 → **護欄壞了**').toHaveLength(1)
    expect(hit[0].reason, '報出來了但理由錯——修的人會去找錯的東西').toBe('訊息沒引用到全部參數')
  })

  it('★ 注入「i18n 鍵不存在」→ **必須被報出**，且理由要說是缺鍵', () => {
    // ⚠️ 這是真正咬人的那一種：`%{BKY_...}` 展不開，訊息裡一個 `%1` 都沒有。
    //
    // ⚠️ 合成的鍵名刻意用 ASCII——第一版寫中文鍵名，而 `\w` 在 JS 正則裡
    // 不含中日韓字元，於是**注入測試自己失敗**。合成輸入要落在判定函式
    // 認得的形狀裡，否則驗的是別的東西。
    const hit = scan([
      { type: '__合成_缺鍵__', message0: '%{BKY_NO_SUCH_KEY_AT_ALL}', args0: [{}] },
    ]).filter((v) => v.type === '__合成_缺鍵__')
    expect(hit).toHaveLength(1)
    expect(hit[0].reason, '缺鍵與「訊息寫錯」的修法不同——歸錯類會讓人去改訊息而不是補鍵').toBe('缺 i18n 鍵')
  })

  it('★ 反向：注入一個**正確**的積木 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上面兩支。
    const hit = scan([{ type: '__合成_正確__', message0: '建立 %1 佇列 %2', args0: [{}, {}] }]).filter(
      (v) => v.type === '__合成_正確__',
    )
    expect(hit, '一個正確的積木被報成違規 → 這條護欄會亂叫').toEqual([])
  })

  it('★ 反向：**沒有參數**的訊息不得被報出', () => {
    expect(scan([{ type: '__合成_無參數__', message0: '停止程式' }]).filter((v) => v.type === '__合成_無參數__')).toEqual([])
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    // 零違規與「一個積木都沒掃到」產出一模一樣。
    let n = 0
    for (const rel of listSourceFiles('src', ['.json'])) {
      if (rel.includes('/i18n/')) continue
      try {
        const a = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
        if (Array.isArray(a)) n += a.filter((e) => (e as { blockDef?: unknown })?.blockDef).length
      } catch { /* 不是積木檔 */ }
    }
    expect(n, '零顆積木 → 是掃描壞了，不是專案空了').toBeGreaterThan(150)
    expect(Object.keys(MSGS).length, 'i18n 是空的 → 每一顆都會被誤報成缺鍵').toBeGreaterThan(500)
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('積木訊息與參數的一致性', () => {
  const violations = scan()

  it('報表', () => {
    printReport('積木訊息／參數一致性', [
      `違規：${violations.length}`,
      '',
      ...violations.map((v) => `  ⚠️ ${v.type.padEnd(32)} [${v.reason}] ${v.detail}`),
    ])
    expect(true).toBe(true)
  })

  it('★ 違規 = 0', () => {
    // ⚠️ **硬性零，不用棘輪**（`build-guardrail` 第 6.8 步）。
    //
    // 判準：「留一筆在那裡，這條規範還成立嗎？」——不成立。
    // 一顆這樣的積木**只要被渲染一次就會弄壞整個飛出選單**：它的例外中斷
    // `clearOldBlocks()`，於是舊分類的積木永遠清不掉、全部疊在 (0, 0)。
    // 留一筆等於留一顆定時炸彈，而引信是「有人把它加進課程」。
    expect(
      violations.map((v) => `${v.type} [${v.reason}] ${v.detail}`),
      'Blockly 會在 jsonInit 拋例外，而那個例外會中斷飛出選單的清理，' +
        '造成使用者看到一疊互相重疊的積木——症狀離根因非常遠。',
    ).toEqual([])
  })
})
