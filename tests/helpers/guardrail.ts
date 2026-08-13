/**
 * 護欄共用形狀：量測 → 報表 → 與基線比對（棘輪）
 *
 * 四條護欄（中立性／完備性／缺陷帳／就近性）都是這個形狀。
 * 見 specs/049-audit-guardrails/data-model.md
 */
import fs from 'node:fs'
import path from 'node:path'

export const REPO_ROOT = path.resolve(__dirname, '../..')
const BASELINE_DIR = path.join(REPO_ROOT, 'tests/baselines')

export interface BaselineMeta {
  guard: string
  measuredAt: string
  /** 判定方式的一句話描述（FR-012／FR-042 要求記錄） */
  rule: string
  note: string
}

export const RATCHET_NOTE =
  '數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。'

/**
 * 載入基線。缺失時擲出可讀錯誤——第一次跑護欄本來就沒有基線，
 * 錯誤訊息要直接告訴維護者下一步做什麼。
 */
export function loadBaseline<T>(guard: string): T {
  const file = path.join(BASELINE_DIR, `${guard}.json`)
  if (!fs.existsSync(file)) {
    throw new Error(
      `基線檔不存在：tests/baselines/${guard}.json\n` +
        `這是護欄第一次執行的正常狀態。請先跑一次量測產生基線並 commit，之後棘輪才會生效。\n` +
        `見 tests/baselines/README.md`,
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

/**
 * 重產基線。
 *
 * ⚠️ **既有的 `_meta` 會被保留。**
 *
 * `build-guardrail` 第 7 步說「上調的理由要寫進基線檔的 `note`，不是只寫在
 * commit 訊息裡——commit 訊息沒有人會回頭翻，而基線檔是下一個看到這個數字的人
 * **一定會打開**的地方」。
 *
 * 而在此之前這個函式**直接覆寫整個檔**：寫的人以為留下了理由，
 * 下一次重產就沒了。**一個會靜默清掉理由的寫入器，等於把那個約定變成謊話。**
 *
 * 2026-08-11 發現：同一個病先在 `toolbox-snapshot` 的區域寫入器上修過一次，
 * **而沒有掃同形的地方**——共用的這一份也有，於是 `identity-namespace` 的
 * 上調理由當場被吃掉。這是「一個教訓被記下來、處方也被記下來，
 * 而程式碼仍然帶著那個病」的又一次。
 *
 * 呼叫端要**顯式覆寫** `_meta` 的話，把它放進 `data` 就好——傳進來的贏。
 *
 * ## 🔴 而 2026-08-13 發現那句話就是第三次的漏洞
 *
 * 前兩次修的是「整份 `_meta` 被覆寫」。而**14 條護欄的呼叫端全都傳
 * `note: RATCHET_NOTE`**（那個通用樣板），於是「傳進來的贏」讓保存機制
 * 對它們**全部失效**——20 個基線裡累積的上調理由，每次重產都被靜默清掉一次。
 *
 * 當場的實例：`conformance` 的 note 記著 2026-08-10「上升是揭露不是退步」
 * 的完整說明，重產一次就沒了。
 *
 * > **一個機制修好了，而繞過它的那條路仍然是預設的走法。**
 *
 * → 判準很窄，所以安全：**通用樣板不得覆蓋具體理由**。
 * 呼叫端寫的若是 `RATCHET_NOTE` 本身（＝「我沒有要說什麼」），而舊的不是，
 * 就保留舊的。呼叫端真的要換一份具體說明時，寫進去的不會等於樣板，照樣會贏。
 */
export function writeBaseline(guard: string, data: object): void {
  const file = path.join(BASELINE_DIR, `${guard}.json`)
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
  const old = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { _meta?: { note?: string } })
    : {}
  const carrying = old._meta !== undefined ? { _meta: old._meta, ...data } : data

  // ⚠️ 見上：通用樣板不得覆蓋具體理由。
  const incoming = (data as { _meta?: { note?: string } })._meta
  const previous = old._meta?.note
  if (incoming?.note === RATCHET_NOTE && previous !== undefined && previous !== RATCHET_NOTE) {
    ;(carrying as { _meta: { note: string } })._meta = { ...incoming, note: previous }
  }

  fs.writeFileSync(file, JSON.stringify(carrying, null, 2) + '\n', 'utf8')
}

/**
 * 棘輪比對：回傳**新增項的清單**，不是布林。
 *
 * FR-005 要求失敗時指名是哪一項使數字上升，所以比對粒度必須是項目而非總數。
 * 空陣列 = 通過。
 */
export function newItems<T>(current: readonly T[], baseline: readonly T[], key: (x: T) => string): T[] {
  const known = new Set(baseline.map(key))
  return current.filter((x) => !known.has(key(x)))
}

/** 有改善時提示可下調基線（不影響通過與否） */
export function fixedItems<T>(current: readonly T[], baseline: readonly T[], key: (x: T) => string): T[] {
  const now = new Set(current.map(key))
  return baseline.filter((x) => !now.has(key(x)))
}

/** 統一的報表輸出——護欄的產出是報表，不只是通過／失敗（FR-002） */
export function printReport(title: string, lines: string[]): void {
  const bar = '─'.repeat(Math.min(72, title.length + 4))
  console.log(`\n${bar}\n  ${title}\n${bar}`)
  for (const l of lines) console.log(l)
  console.log('')
}

/** 把報表同時寫成檔案（給補完地圖這類需要留存的產出） */
export function writeReport(relPath: string, content: string): void {
  const file = path.join(REPO_ROOT, relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

/** 遞迴列出目錄下所有 .ts / .json 原始檔（跳過 node_modules 與 .d.ts） */
export function listSourceFiles(relDir: string, exts = ['.ts']): string[] {
  const abs = path.join(REPO_ROOT, relDir)
  if (!fs.existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue
        walk(f)
      } else if (exts.some((x) => e.name.endsWith(x)) && !e.name.endsWith('.d.ts')) {
        out.push(path.relative(REPO_ROOT, f))
      }
    }
  }
  walk(abs)
  return out.sort()
}

/**
 * 棘輪：**兩個方向都要出聲**。
 *
 * ## 為什麼改善也要紅
 *
 * 棘輪只擋上升的話，它不會自己收緊。實際發生過：一個功能把「孤兒實作」從 4
 * 修到 1，**基線卻還寫著 4**——那等於默許它退回 4 而不會有人發現。
 *
 * 改善訊息每次都印，但沒有人會為了一行 stdout 去改檔案。**只有紅色會。**
 *
 * 下調基線是十秒鐘的事，而且本來就該與那次改善同一個 commit——
 * 「不准紅著過夜」講的是不要放著，不是不要紅。
 *
 * @param rows [名稱, 現值, 基線值][]
 */
export function assertRatchet(rows: readonly [string, number, number][]): void {
  const worse = rows.filter(([, now, base]) => now > base)
  const better = rows.filter(([, now, base]) => now < base)
  if (worse.length > 0) {
    throw new Error(
      '棘輪退步：\n' +
        worse.map(([n, now, base]) => `  ✘ ${n}: ${base} → ${now}`).join('\n'),
    )
  }
  if (better.length > 0) {
    throw new Error(
      '棘輪有改善，**請下調基線並與這次改善一起 commit**：\n' +
        better.map(([n, now, base]) => `  ✔ ${n}: ${base} → ${now}`).join('\n') +
        '\n（棘輪只擋上升的話不會自己收緊——舊基線會默許退回去而沒有人發現）',
    )
  }
}

/**
 * **判定落點的識別碼**——顯示與識別分開。
 *
 * ## 為什麼這個要共用
 *
 * 這件事出過**三次**，而三次都只修了那一條護欄：
 *
 * | | 鍵長什麼樣 | 怎麼爛的 |
 * |---|---|---|
 * | `specs/108` → `110` | 語料前 80 字元 | **碰撞**：17 筆明細只有 16 個不同鍵 |
 * | `specs/113` | `檔:行號` | 刪一行 → 底下全漂移，**判定全變孤兒而程式碼沒改** |
 * | 同日 `#35` | `檔:行號` | 同一個坑，**在修好上一個的同一天寫的** |
 *
 * 而第四條護欄（`component-identity-review`）用 `conceptId` 當鍵——
 * **穩定身分天生沒有這個問題**。所以坑只在「從內容或位置導出鍵」的時候。
 *
 * > **識別碼必須識別得出那個東西。**
 * > 行號識別的是**位置**；截斷的字串識別的是**開頭**。兩個都不是那個東西。
 *
 * ⚠️ **介面刻意要兩個參數**——逼呼叫者分開想「人要看到什麼」與
 * 「什麼東西變了才算變了」。只給一個字串的話，下一個人還是會傳行號。
 *
 * @param display 報表上給人看的（檔名、語料開頭）——**可以重複**
 * @param identityContent 決定「是不是同一筆」的內容——**變了就該是新的一筆**
 */
export function decisionKey(display: string, identityContent: string): string {
  let h = 0
  for (let i = 0; i < identityContent.length; i++) h = ((h << 5) - h + identityContent.charCodeAt(i)) | 0
  return `${display}#${(h >>> 0).toString(36)}`
}
