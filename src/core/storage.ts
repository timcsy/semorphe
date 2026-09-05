import { CURRENT_VERSION, judgeJSON, upgrade } from './storage-version'
import { MemoryKeyValueStore, type KeyValueStore } from './host/key-value-store'

const STORAGE_KEY = 'semorphe-state'
/** 被拒絕的存檔搬到這裡。覆蓋式，只留一份 */
const BACKUP_KEY = 'semorphe-state.rejected'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB limit

export type RefusalReason =
  | { code: 'too-new'; found: number; current: number }
  | { code: 'no-upgrade-path'; found: number; current: number }
  | { code: 'upgrade-failed'; found: number; detail: string }
  | { code: 'not-a-save'; detail: string }

/**
 * 載入的結果。
 *
 * `refused` 分支**型別上就必須帶 `backedUpTo`**——「拒絕了但沒備份」編不
 * 出來。這是「拒絕不得破壞原資料」的執行機構，不靠實作自律。
 */
export type LoadOutcome =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: SavedState }
  | { kind: 'migrated'; state: SavedState; from: number }
  | { kind: 'refused'; reason: RefusalReason; backedUpTo: string }

/**
 * 濾掉值為 `undefined` 的欄位。
 *
 * 直接展開的話，「這次沒提供」（`undefined`）會覆蓋掉「上次存的值」——
 * 那是換一種方式丟資料。
 */
function definedOnly<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}

export interface SavedState {
  version: number
  /**
   * 積木工作區的狀態——**side-car，而它是快取不是真相**（v11 起）。
   *
   * 🔴 在 v11 之前這裡還存著一份 `tree`，而**沒有任何還原路徑在讀它**
   * （8 個升級步驟認真地改寫了它 8 次）。真相是 `code`，樹是導出的。
   *
   * ⚠️ 失效條件是 `codeHash`：對不上就**寧可重排版**，
   * 也不要拿一份與程式碼不一致的積木——那會變成第二份真相。
   *
   * ## 🔴 **選填**（2026-09-06 改的，而它修的是一個真的缺陷）
   *
   * `FIELD_OWNERSHIP` 把它歸在 `sideCar` 桶，而那個桶的定義逐字是
   * 「**可以丟，丟了重算**」。而在此之前它同時被列在 `REQUIRED_FIELDS` 裡
   * ——於是把它從存檔裡拿掉的結果**不是重算，是整份存檔被拒絕**。
   *
   * 實測（`e2e/sidecar-droppable.spec.ts`）：刪掉它之後重新整理，
   * 畫布空的、**程式碼也是空的**——使用者的東西全部不見了。
   *
   * > **兩份宣告如果對同一個欄位說了相反的話，
   * > 執行的是【驗證】那一份——而寫下另一份的人以為自己說了算。**
   */
  blocklyState?: object
  /** `blocklyState` 對應的那份程式碼的雜湊——見上 */
  codeHash?: string
  /**
   * **流程節點手放過的位置**（v17）——side-car，而它是**狀態不是快取**。
   *
   * 🔴 存的是**鑰匙不是 `nodeId`**：`generateId()` 帶著計數器與時戳，
   * 重開之後一個 id 都不會留（實測「改一行不相干的程式碼，id 相同數 0」）。
   * 還原時用 `core/flow/layout-key.ts` 的配對器對回去。
   *
   * ⚠️ **對不回去就不放**——回自動排版。那與「side-car 刪掉 ＝ 自動排版」
   * 是同一條線：**一份對不上的佈局與一份不存在的佈局，結果必須一樣。**
   */
  flowLayout?: { keys: string[]; x: number; y: number }[]
  code: string
  language: string
  styleId: string
  topicId?: string
  /**
   * 目標 ID（spec 136 起）。
   *
   * ⚠️ **舊存檔沒有這一格**——還原時以 `targetId` 優先、沒有就回退到 `topicId`。
   * P8「不做向後相容」管的是投影與程式碼，**不管存檔**（見 `history/026`）。
   */
  targetId?: string
  enabledBranches?: string[]
  lastModified: string
  blockStyleId?: string
  locale?: string
}

export class StorageService {
  private defaultLanguage: string
  /**
   * 存在哪——**由呼叫端決定**（2026-09-06，spec 173）。
   *
   * 🔴 在此之前這個類別直接叫 `localStorage`，而那是**一個宿主的東西**
   * （Node 沒有、VSCode 的擴充主程序沒有、無痕模式下叫它會拋）。
   *
   * > **一個「核心」如果它的存檔只在一個宿主上跑得起來，
   * > 那它不是核心，是那個宿主的一部分。**
   *
   * ⚠️ 預設是**記憶體**：核心不知道有 `localStorage` 這種東西。
   * 網頁版由組裝點傳 `createBrowserStore()` 進來（`src/ui/browser-store.ts`）。
   */
  private store: KeyValueStore

  constructor(defaultLanguage = 'cpp', store: KeyValueStore = new MemoryKeyValueStore()) {
    this.defaultLanguage = defaultLanguage
    this.store = store
  }

  /**
   * Save state to localStorage.
   *
   * 合併用**展開**而不是逐欄位列舉。列舉表與型別宣告是兩份東西，選填欄位漏
   * 列舉時編譯器不會發現——`blockStyleId` 與 `locale` 就是這樣被丟了。展開
   * 之後，漏欄位在結構上不可能發生。
   *
   * 見 specs/052-storage-integrity-gate/research.md F5（消除，不是偵測）
   */
  save(state: Partial<SavedState>): boolean {
    try {
      const existing = this.load()
      const defaults: SavedState = {
        version: CURRENT_VERSION,
        blocklyState: {},
        code: '',
        language: this.defaultLanguage,
        styleId: 'apcs',
        lastModified: '',
      }
      const merged: SavedState = {
        ...defaults,
        ...(existing ?? {}), // 未知欄位一併帶下去（FR-017）
        ...definedOnly(state), // 值為 undefined 的欄位不得覆蓋既有值
        version: CURRENT_VERSION,
        lastModified: new Date().toISOString(),
      }
      const json = JSON.stringify(merged)
      if (json.length > MAX_SIZE) {
        console.warn('Storage size exceeds limit, not saving')
        return false
      }
      // 🔴 **寫不進去是一個【失敗】**——埠回 `false`，這裡如實往上傳。
      //    在此之前它被 `catch` 吞成同一個 `return false`，
      //    於是「配額滿」與「存檔格式不對」在呼叫端長得一樣。
      return this.store.write(STORAGE_KEY, json)
    } catch {
      return false
    }
  }

  /**
   * Load state from localStorage.
   *
   * **簽章不變**（既有呼叫端與既有測試零改動）。內部委派給 `loadOutcome()`——
   * 想區分「沒有存檔」與「存檔被拒絕」的呼叫端用那一個。
   */
  load(): SavedState | null {
    const r = this.loadOutcome()
    return r.kind === 'loaded' || r.kind === 'migrated' ? r.state : null
  }

  /**
   * 載入並回報**為什麼**。
   *
   * `load()` 的二態（狀態或 `null`）分不出「沒有存檔」與「存檔被拒絕」，
   * 而那個分不出來會讓「拒絕載入」在四步之內變成「永久刪除」：呼叫端以為
   * 是新的一頁 → 使用者操作 → 自動存檔 → 預設值蓋掉原存檔。
   *
   * 見 specs/052-storage-integrity-gate/research.md F3
   */
  loadOutcome(): LoadOutcome {
    let json: string | null
    try {
      json = this.store.read(STORAGE_KEY)
    } catch {
      return { kind: 'empty' }
    }
    if (!json) return { kind: 'empty' }

    const { verdict, value } = judgeJSON(json)

    switch (verdict.kind) {
      case 'ok':
        return { kind: 'loaded', state: value as SavedState }

      case 'needs-upgrade': {
        const r = upgrade(value as Record<string, unknown>, verdict.from)
        if (r.ok) return { kind: 'migrated', state: r.value as unknown as SavedState, from: verdict.from }
        const code = r.reason.includes('升級路徑') ? 'no-upgrade-path' : 'upgrade-failed'
        return this.refuse(
          json,
          code === 'no-upgrade-path'
            ? { code, found: verdict.from, current: CURRENT_VERSION }
            : { code: 'upgrade-failed', found: verdict.from, detail: r.reason },
        )
      }

      case 'too-new':
        return this.refuse(json, {
          code: 'too-new',
          found: verdict.from,
          current: CURRENT_VERSION,
        })

      case 'not-a-save':
        return this.refuse(json, { code: 'not-a-save', detail: verdict.detail })
    }
  }

  /**
   * 拒絕之前先把原始內容搬到備份鍵。
   *
   * **順序不可調換**：備份寫成功才回報拒絕。寫不進去（例如空間不足）時
   * `backedUpTo` 為空字串——寧可讓使用者看到「載入失敗且沒有備份」，也不
   * 假裝備份好了。主鍵在這條路徑上完全不動。
   */
  private refuse(raw: string, reason: RefusalReason): LoadOutcome {
    // 🔴 **寫入失敗是一個【回傳值】，不是一個例外**（2026-09-06，spec 173）。
    //
    //    在此之前這裡包 `try/catch`，因為 `localStorage.setItem` 在配額滿時**拋**。
    //    埠把它換成 `boolean`——⚠️ 而換完之後 `catch` 那條路**永遠不會走到**，
    //    於是「備份寫不進去」會被回報成「備份好了」。
    //
    //    那正是這一支測試（T026）擋下來的：
    //    「備份沒寫成功卻回報備份好了，**比沒有備份更危險**」。
    //
    // > **把一個例外換成回傳值的時候，接例外的那一段不會報錯——
    // > 它只是安靜地變成永遠成功。**
    const ok = this.store.write(BACKUP_KEY, raw)
    return { kind: 'refused', reason, backedUpTo: ok ? BACKUP_KEY : '' }
  }

  /** Clear saved state */
  clear(): void {
    try {
      this.store.remove(STORAGE_KEY)
    } catch { /* ignore */ }
  }

  /** Export state as downloadable JSON blob */
  exportToBlob(state: SavedState): Blob {
    const json = JSON.stringify(state, null, 2)
    return new Blob([json], { type: 'application/json' })
  }

  /**
   * Import state from JSON string.
   *
   * 走**同一個** `judgeJSON`——與自動載入不得有第二種鬆緊度。在此之前這裡
   * 只檢查 `version` 欄位存在，於是 `version: 99` 通過。
   */
  importFromJSON(json: string): SavedState | null {
    const { verdict, value } = judgeJSON(json)
    if (verdict.kind === 'ok') return value as SavedState
    if (verdict.kind === 'needs-upgrade') {
      const r = upgrade(value as Record<string, unknown>, verdict.from)
      return r.ok ? (r.value as unknown as SavedState) : null
    }
    return null
  }

  /** Trigger download of a blob as a file */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
