/**
 * 膠囊登錄表——掃描 `src/components/**​/component.json`，驗契約，記下來源
 *
 * ## 為什麼是掃描，不是一份清單
 *
 * 手寫清單的話「加一顆元件」＝編輯一個既有的共用檔，而那正是這整個階段要治的病：
 *
 * > 碎裂的痛不在「碰幾個檔」，在**碰幾個既有的共用檔**。
 *
 * 掃描之後，加一顆元件＝**新增一個資料夾，零編輯**。
 *
 * ## `import.meta.glob` 而不是 `fs`
 *
 * 這個檔要在**瀏覽器**裡跑（膠囊是 production 路徑，不只是測試）。
 * `fs` 在瀏覽器不存在，而 `import.meta.glob` 由 Vite 在建置時展開成靜態 import
 * ——瀏覽器與 Vitest 兩邊同一份程式碼。
 *
 * ⚠️ 代價：glob 的樣式必須是**字面常數**，不能用變數組出來。所以
 * `COMPONENT_ROOT` 在這裡是寫死的字串——這是工具的限制，不是雙重真相；
 * 下面有一支斷言把兩者釘在一起。
 */
import { COMPONENT_ROOT, FIVE_PATHS, idToDir } from './types'
import type { ComponentManifest, ComponentRegistration } from './types'

// ⚠️ 樣式必須字面常數（見檔頭）。與 COMPONENT_ROOT 的一致性由下面的斷言保證。
const MANIFESTS = import.meta.glob('/src/components/*/*/component.json', { eager: true }) as Record<
  string,
  { default: ComponentManifest }
>

if (!'/'.concat(COMPONENT_ROOT).startsWith('/src/components')) {
  throw new Error(`COMPONENT_ROOT 與 glob 樣式不一致：${COMPONENT_ROOT}`)
}

let cache: ComponentRegistration[] | null = null

/**
 * 從檔案路徑推出 `<scope>/<name>`。
 *
 * **這不是「從檔名推歸屬」**——歸屬的唯一真相仍是 manifest 裡的 `conceptId`。
 * 這個值只有一個用途：**與宣告核對**。兩個來源不一致就代表有人複製膠囊
 * 忘了改 id，而那是只信宣告抓不到的（見 `component-move-parity.test.ts`）。
 */
function pathToDir(globKey: string): string {
  // ⚠️ **用 split 不用正則。** 第一版寫成以 `/\/src...` 開頭的正則，而註解投影
  // 護欄把它判成「核心在剝除 C 家族的行註解」。那是**誤報，但判準沒有錯**——
  // 以跳脫斜線開頭的正則，在這個專案裡確實幾乎都在處理 `//`。
  // 路徑拆解本來就該用 split，改完誤報消失，而且更好讀。
  const parts = globKey.split('/').filter(Boolean) // src, components, <scope>, <name>, component.json
  const i = parts.indexOf('components')
  if (i < 0 || parts.length !== i + 4 || parts[i + 3] !== 'component.json') {
    throw new Error(`元件路徑不符 <scope>/<name> 版型：${globKey}`)
  }
  return `${parts[i + 1]}/${parts[i + 2]}`
}

/** C1–C4 的驗證。**違反就 throw**——載不起來要當場知道，不是安靜地少一顆。 */
function verifyContract(manifest: ComponentManifest, sourceDir: string): void {
  const where = `膠囊 ${sourceDir}`

  // C1：身分格式
  if (typeof manifest.conceptId !== 'string' || !manifest.conceptId.includes(':')) {
    throw new Error(`${where}：conceptId 必須是 <scope>:<name> 格式，收到 ${String(manifest.conceptId)}`)
  }

  // C2：身分與路徑一致
  if (idToDir(manifest.conceptId) !== sourceDir) {
    throw new Error(
      `${where}：conceptId「${manifest.conceptId}」對應的資料夾應是 ` +
        `${idToDir(manifest.conceptId)}，但它住在 ${sourceDir}。` +
        `（複製膠囊時忘了改 conceptId？）`,
    )
  }

  // C3：五路全列，沒有的要寫 null ＋ 理由
  if (!manifest.paths || typeof manifest.paths !== 'object') {
    throw new Error(`${where}：缺少 paths。五路要全部列出，沒有的寫 null ＋ 理由`)
  }
  for (const p of FIVE_PATHS) {
    if (!(p in manifest.paths)) {
      throw new Error(
        `${where}：paths 少了「${p}」。**沒有那一路也要寫**（null ＋ _${p}_why）——` +
          `不然「顯式的空」與「遺漏的空」分不出來，而後者就是殼。`,
      )
    }
    if (manifest.paths[p] === null && !manifest.paths[`_${p}_why`]) {
      throw new Error(`${where}：paths.${p} 是 null，必須在 _${p}_why 說明理由`)
    }
  }
}

/** 全部膠囊。第一次呼叫時掃描並驗證。 */
export function registeredComponents(): ComponentRegistration[] {
  if (cache) return cache
  const out: ComponentRegistration[] = []
  for (const [key, mod] of Object.entries(MANIFESTS)) {
    const sourceDir = pathToDir(key)
    const manifest = mod.default
    verifyContract(manifest, sourceDir)
    out.push({ conceptId: manifest.conceptId, sourceDir, manifest })
  }
  cache = out.sort((a, b) => a.conceptId.localeCompare(b.conceptId))
  return cache
}

/** 測試用：丟掉快取。production 路徑不該需要它。 */
export function resetComponentCache(): void {
  cache = null
}

/** 膠囊宣告的概念定義（形狀與 `concepts.json` 的一筆相同，因為它就是那一筆）。 */
export function componentManifests(): ComponentManifest[] {
  return registeredComponents().map((c) => c.manifest)
}

/** `conceptId` → 它宣告的依賴（C++ 是標頭檔）。給 `#include` 解析與工具箱 owner 章用。 */
export function componentRequires(): [conceptId: string, header: string][] {
  return registeredComponents().flatMap((c) => (c.manifest.requires ?? []).map((h) => [c.conceptId, h] as [string, string]))
}

// ── 接回既有的載入路徑 ─────────────────────────────────────────
//
// R4 的決定：**膠囊自我登錄，不改載入架構**。所以這裡提供的是既有組裝點
// 已經在用的兩種形狀（概念定義陣列、積木投影陣列），呼叫端只多加一個展開。
//
// 順手把 `std/index.ts` 改成「掃描元件」是誘人的，但那會讓這次切片的成本數字
// 混進一次架構改動——`history/018` 的另一面。**架構收斂等元件夠多再做。**

// ⚠️ 樣式必須字面常數（同上）。
const FORMS = import.meta.glob('/src/components/*/*/forms/blocks.json', { eager: true }) as Record<
  string,
  { default: unknown[] }
>

/** 元件宣告的概念定義。形狀與 `concepts.json` 的一筆相同，因為它就是那一筆。 */
export function componentConcepts(): ComponentManifest[] {
  return registeredComponents().map((c) => c.manifest)
}

/**
 * 元件宣告的積木投影，**已蓋 owner 章**。
 *
 * `owner` 原本由 `makeModule(header, …)` 蓋——工具箱靠它把 `<map>` 的容器與
 * `<stack>` 的容器分開（兩者的 `category` 都是 `'containers'`）。元件化之後
 * 沒有模組了，所以章從 `requires[0]` 蓋。
 *
 * ⚠️ 沒有 `requires` 就不蓋章，**不給預設值**——一顆該有 header 卻忘了宣告的
 * 元件，症狀會是「積木掉進錯的工具箱分類」，而給了預設值它會變成「掉進一個
 * 看起來合理的分類」，更難發現。
 *
 * ⚠️ **而核心元件本來就沒有 header**（`cpp:literal_char` 不 `#include` 任何東西），
 * 所以它們在 `component.json` 裡**顯式寫 `owner`**。
 * 這與上面那條是同一個立場：**拒絕猜，要求宣告。**
 * 沒有它的症狀是積木從工具箱**整個消失**——因為 `toolbox-categories.ts`
 * 的段落是 `{ from: '(core)' }`，查無此章就整批回傳零筆。
 */
export function componentBlocks(owner?: string | null): unknown[] {
  const byDir = new Map(registeredComponents().map((c) => [c.sourceDir, c]))
  const out: unknown[] = []
  for (const [key, mod] of Object.entries(FORMS)) {
    const parts = key.split('/').filter(Boolean)
    const i = parts.indexOf('components')
    if (i < 0) continue
    const c = byDir.get(`${parts[i + 1]}/${parts[i + 2]}`)
    if (!c) throw new Error(`${key} 沒有對應的 component.json——forms 不得孤兒存在`)
    const section = (c.manifest as { owner?: string }).owner ?? c.manifest.requires?.[0] ?? null
    // `owner === undefined` ＝ 全要；否則只要這個 owner 的（`null` ＝ 沒有 owner 的）。
    if (owner !== undefined && section !== owner) continue
    for (const b of mod.default) out.push(section ? { ...(b as object), owner: section } : b)
  }
  return out
}

/**
 * **不屬於指定 owner 清單的膠囊積木**——給「其餘的接在最後」用。
 *
 * ⚠️ 為什麼要這個而不是 `componentBlocks(null)`：
 * 呼叫端原本列舉「std 模組的 header」＋「沒有 owner 的（null）」兩類，
 * 而 `(core)` **兩類都不是**——於是核心元件的積木**從工具箱整個消失**，
 * 而症狀是「一顆剛搬好的元件看起來像被刪掉了」（第三顆膠囊實測）。
 *
 * > **列舉已知的 owner，等於保證下一個新 owner 會被漏掉。**
 * > 改成「扣掉已處理的，其餘全要」——**新的 owner 自動被涵蓋**。
 */
export function componentBlocksNotIn(handled: readonly (string | null)[]): unknown[] {
  const set2 = new Set(handled)
  const out: unknown[] = []
  for (const b of componentBlocks() as { owner?: string }[]) {
    if (set2.has(b.owner ?? null)) continue
    out.push(b)
  }
  return out
}

/** `conceptId` → 依賴（C++ 是標頭檔）。給 `#include` 解析用。 */
export function componentConceptMappings(): [conceptId: string, header: string][] {
  return registeredComponents().flatMap((c) =>
    (c.manifest.requires ?? []).map((h) => [c.conceptId, h] as [string, string]),
  )
}

/**
 * **類別成員的角色** —— 元件自己宣告，消費者問角色不問身分
 *
 * ## 為什麼需要它
 *
 * `core/executors/structs.ts` 的 `拆解成員` 原本這樣分派：
 *
 * ```ts
 * } else if (m.conceptId === 'cpp:constructor') { ctor = { … } }
 * ```
 *
 * 那**不是實作散落，是一個合法的消費者**——`class_def` 要知道自己的成員裡
 * 哪一個是建構式，才知道實例化時要跑什麼。而它擋住膠囊化：
 * 只要那些身分寫在共用檔裡，就近性護欄就會指名。
 *
 * > **「另一顆元件需要認得它」是真的耦合，不是碎裂。**
 * > 處置不是把消費者搬走，是**把「我是什麼角色」變成元件自己的宣告**。
 *
 * ## ⚠️ 這裡**沒有登錄呼叫**，而那是刻意的
 *
 * 第一版把過渡角色做成 `registerPendingMemberRole()`，而它**壞了 16 支測試**
 * ——登錄發生在 `registerCppLifters` 裡，而執行器可能更早跑。
 *
 * > **把資料做成登錄呼叫，等於替它發明一個會忘記呼叫的時序。**
 * > （2026-08-10 記下的教訓，而它在 2026-08-11 又被犯了一次。）
 *
 * 這一版全部走 **`import.meta.glob` 的 eager 讀取**（`registeredComponents()`）
 * ——模組載入即完成，沒有「誰先呼叫」的問題。
 */
export type MemberRole = 'constructor' | 'destructor' | 'method' | 'operator' | 'static-field' | 'pure-virtual'

/** 一顆元件在類別裡扮演什麼角色。沒宣告回 `undefined`——**不猜**。 */
export function memberRoleOf(conceptId: string): MemberRole | undefined {
  const c = registeredComponents().find((x) => x.conceptId === conceptId)
  return (c?.manifest as { memberRole?: MemberRole } | undefined)?.memberRole
}

/** 宣告了這個角色的元件身分。 */
export function componentsWithMemberRole(role: MemberRole): string[] {
  return registeredComponents()
    .filter((c) => (c.manifest as { memberRole?: string }).memberRole === role)
    .map((c) => c.conceptId)
}
