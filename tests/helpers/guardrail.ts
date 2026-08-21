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
 * ## ⚠️ 而第一版的判準只涵蓋了一部分——這是同一輪內的第二次
 *
 * 第一版寫的是「新 note 若**等於** `RATCHET_NOTE` 就保留舊的」。而 14 條護欄裡
 * 只有一部分傳純樣板，其餘（`silent-fallback`／`locality`／`behavior-error`…）
 * **各自組一段更長的固定說明**——它們不等於樣板，於是照樣覆蓋，
 * 三個基線裡剛加上去的理由當場又被吃掉一次。
 *
 * > **一個判準如果是照著手上那個實例寫的，它只會涵蓋那個實例。**
 *
 * → 真正的判準是**追加關係**：護欄組的 note 是固定前綴，人手寫的理由接在後面。
 * **舊 note 以新 note 開頭 ⇒ 舊的是「新的 ＋ 追加」，保留舊的。**
 * 這同時涵蓋純樣板那一種（`RATCHET_NOTE` 也是前綴），所以不必特例。
 *
 * 護欄真的改寫了自己那段固定說明時，前綴關係就不成立，新的照樣會贏。
 */
export function writeBaseline(guard: string, data: object): void {
  const file = path.join(BASELINE_DIR, `${guard}.json`)
  fs.mkdirSync(BASELINE_DIR, { recursive: true })
  const old = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as { _meta?: { note?: string } })
    : {}
  const carrying = old._meta !== undefined ? { _meta: old._meta, ...data } : data

  // ⚠️ 見上：舊 note 若是「新 note ＋ 追加」，保留舊的。
  const incoming = (data as { _meta?: { note?: string } })._meta
  const previous = old._meta?.note
  if (
    incoming?.note !== undefined &&
    previous !== undefined &&
    previous !== incoming.note &&
    previous.startsWith(incoming.note)
  ) {
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
 * **語料棘輪**——`assertRatchet` 的鏡像，而它看的是**分母**。
 *
 * ## 它防的是「護欄安靜地不再量任何東西」
 *
 * 一條護欄失效的方式**不是說錯話，是輸入悄悄乾掉**：語料被排除、掃描路徑
 * 改名、glob 被 shell 吃掉（`experience.md` 第十二個實例：`--include=*.md`
 * 沒加引號 → 每個 grep 靜默回零 → 44 個檔全被報成孤兒）。
 *
 * 那時候護欄**全綠**，而且與健康的長得一模一樣。
 *
 * > **一條護欄過不過時，不看它的結論舊不舊，看它的輸入還在不在。**
 *
 * ## 為什麼「變大」也要紅（而不是只擋縮水）
 *
 * 與 `assertRatchet` 同一個理由，方向相反：只擋縮水的話基線會停在舊值，
 * 於是「244 掉回 200」照樣過關——**而 176 → 244 這件事本來就已經發生過
 * 一次而沒有人出聲**（`silent-fallback`，2026-08-21 才被發現）。
 *
 * ⚠️ **代價要說清楚**：加一顆元件會讓幾條護欄的語料變大，於是要上調基線。
 * 那是**設計上的摩擦**，不是意外——`component-generate` 的清單裡本來就有
 * 一批「加一顆元件要一起改的基線」，這幾欄是同一類。
 * 🔴 而它有一個明確的誤用方式：**看到紅就整批重產基線**。那會把語料縮水
 * 一起洗掉。上調要看著數字上調。
 *
 * @param rows [名稱, 現值, 基線值][]
 */
export function assertCorpus(rows: readonly [string, number, number][]): void {
  const shrank = rows.filter(([, now, base]) => now < base)
  const grew = rows.filter(([, now, base]) => now > base)
  if (shrank.length > 0) {
    throw new Error(
      '🔴 **語料縮水**——這條護欄現在量的東西比基線少：\n' +
        shrank.map(([n, now, base]) => `  ✘ ${n}: ${base} → ${now}`).join('\n') +
        '\n（少掉的那些【沒有被檢查】，而護欄的結論看起來完全正常。' +
        '先確認是「東西真的被刪了」還是「掃描器不再吃到它」——後者是缺陷。）',
    )
  }
  if (grew.length > 0) {
    throw new Error(
      '語料變大了，**請上調基線並與這次改動一起 commit**：\n' +
        grew.map(([n, now, base]) => `  ✔ ${n}: ${base} → ${now}`).join('\n') +
        '\n（不上調的話基線會停在舊值，於是往後縮水到舊值都不會出聲。' +
        '⚠️ 看著數字上調，不要整批重產。）',
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
 * 而第四條護欄（`component-identity-review`）用 `componentId` 當鍵——
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
