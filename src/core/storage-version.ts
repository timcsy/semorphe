/**
 * 存檔的版本判定與欄位清單
 *
 * ## 為什麼是獨立的一個模組
 *
 * 自動載入與匯入檔案是兩條路徑，它們**必須**得到同一個判定。在此之前兩條
 * 路徑各自檢查，鬆緊度不同：自動載入那條（每次開頁面都跑）什麼都不檢查，
 * 匯入那條只檢查 `version` 欄位存在。放在獨立模組，是為了讓「有第二處判定」
 * 變得顯眼。
 *
 * 見 specs/052-storage-integrity-gate/research.md F2、contracts/storage.md
 */
import type { SavedState } from './storage'

/** 目前的存檔格式世代 */
export const CURRENT_VERSION = 2

/** 取出型別中「必填」的鍵 */
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]

/**
 * 存檔格式的全部欄位。
 *
 * **`satisfies` 是這裡的重點**：漏一個或多一個都編不過（實測 `TS1360`）。
 * TypeScript 的介面在執行期不存在，測試沒辦法列舉 `keyof SavedState`——
 * 這個常數是它在執行期的替身。
 *
 * 它**是手寫的**，但**不可能與型別漂移**，因為漂移會讓專案編不起來。
 * 這是把「推斷」改成「宣告」的同一招：缺失從沉默變成可偵測。
 */
export const SAVED_STATE_FIELDS = {
  version: 1,
  tree: 1,
  blocklyState: 1,
  code: 1,
  language: 1,
  styleId: 1,
  topicId: 1,
  enabledBranches: 1,
  lastModified: 1,
  blockStyleId: 1,
  locale: 1,
} satisfies Record<keyof Required<SavedState>, 1>

/** 必填欄位——形狀驗證用。同樣由編譯器釘住 */
export const REQUIRED_FIELDS = {
  version: 1,
  tree: 1,
  blocklyState: 1,
  code: 1,
  language: 1,
  styleId: 1,
  lastModified: 1,
} satisfies Record<RequiredKeys<SavedState>, 1>

/** 版本 N → N+1 的升級函式 */
export type Upgrade = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * 升級路徑註冊表。**目前刻意是空的——沒有需要升級的版本。**
 *
 * 它不是為未來預留的：沒有它，「版本較舊」只剩「拒絕」一條路，而
 * `CURRENT_VERSION` 首次調成 2 的那天，那等於拒絕掉每一位既有使用者的
 * 存檔——**比現況更糟**。它完成的是當下的 `needs-upgrade` 分支。
 *
 * `storage-version.test.ts` 有一支測試釘住「從 1 到 `CURRENT_VERSION` 的
 * 每一步都必須有註冊」。調高版本卻忘了寫升級函式，那支測試會變紅。
 */
/**
 * 1 → 2：**六對 statement／expression 雙版本合併成六個身分**（階段 6.5 的 B 項）。
 *
 * ## 為什麼這動得起
 *
 * P8「不做向後相容」的**範圍**已於 2026-08-07 釐清為**不含語義詞彙本身**
 * （`knowledge/history/026`）：P8 推導自「投影可重建」，而 componentId 改名動的是
 * **真實**，沒有東西可以重建它。這類變更 MUST 附一次性轉換。
 *
 * **這是那條釐清的第一次真正使用。**
 *
 * ## 只轉語義樹，不轉積木
 *
 * 積木型別是**加法式**保留的（`c_increment_expr` 仍然有效，只是現在對應到
 * `cpp_increment`）。轉積木型別是不必要的，而不必要的轉換是額外的風險面。
 */
const 合併掉的身分: Record<string, string> = {
  func_call_expr: 'func_call',
  cpp_method_call_expr: 'cpp_method_call',
  cpp_increment_expr: 'cpp_increment',
  cpp_compound_assign_expr: 'cpp_compound_assign',
  var_declare_expr: 'var_declare',
  cpp_scanf_expr: 'cpp_scanf',
}

/** 就地改寫語義樹裡的舊身分。**只改認得的，其餘原樣通過。** */
function 改寫身分(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(改寫身分)
  const n = node as Record<string, unknown>
  const out: Record<string, unknown> = { ...n }
  const cid = out.conceptId
  if (typeof cid === 'string' && 合併掉的身分[cid]) out.conceptId = 合併掉的身分[cid]
  const children = out.children
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    const c: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(children as Record<string, unknown>)) c[k] = 改寫身分(v)
    out.children = c
  }
  return out
}

export const UPGRADES: Record<number, Upgrade> = {
  1: (raw) => ({ ...raw, tree: 改寫身分(raw.tree), version: 2 }),
}

export type VersionVerdict =
  | { kind: 'ok' }
  | { kind: 'needs-upgrade'; from: number }
  | { kind: 'too-new'; from: number }
  | { kind: 'not-a-save'; detail: string }

/**
 * 判定一份**已經解析過**的資料是不是可用的存檔。
 *
 * 形狀不符時回傳 `not-a-save` 並說明原因——「說不出為什麼拒絕」等於沒有拒絕，
 * 使用者會看到一個無法行動的訊息。
 *
 * **額外欄位不構成拒絕理由**：一份來自較新版本、版本號卻相同的存檔會多出
 * 欄位。判嚴的代價是抹掉使用者的資料，判鬆的代價是多存幾個沒用的鍵——
 * 不對稱，所以判鬆。
 */
export function judge(value: unknown): VersionVerdict {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { kind: 'not-a-save', detail: `不是物件（${describe(value)}）` }
  }

  const obj = value as Record<string, unknown>

  const missing = Object.keys(REQUIRED_FIELDS).filter((k) => !(k in obj))
  if (missing.length > 0) {
    return { kind: 'not-a-save', detail: `缺少必填欄位：${missing.join('、')}` }
  }

  const version = obj.version
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    return { kind: 'not-a-save', detail: `版本號不是有限數字（${describe(version)}）` }
  }

  if (version > CURRENT_VERSION) return { kind: 'too-new', from: version }
  if (version < CURRENT_VERSION) return { kind: 'needs-upgrade', from: version }
  return { kind: 'ok' }
}

/**
 * 從 JSON 字串判定。**兩條讀取路徑都走這裡**，所以它們不可能鬆緊度不同。
 */
export function judgeJSON(json: string): { verdict: VersionVerdict; value: unknown } {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return { verdict: { kind: 'not-a-save', detail: '不是合法的 JSON' }, value: undefined }
  }
  return { verdict: judge(value), value }
}

/**
 * 逐版套用升級，從 `from` 到 `CURRENT_VERSION`。
 *
 * 逐版而非一步到位，是為了讓「新增一版」只需要寫一個函式。
 *
 * 失敗時回傳 `null`——**不得產出半升級的狀態**，那比拒絕更難察覺。
 */
export function upgrade(
  raw: Record<string, unknown>,
  from: number,
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
  let current = raw
  for (let v = from; v < CURRENT_VERSION; v++) {
    const step = UPGRADES[v]
    if (!step) return { ok: false, reason: `沒有從版本 ${v} 到 ${v + 1} 的升級路徑` }
    try {
      current = { ...step(current), version: v + 1 }
    } catch (e) {
      return { ok: false, reason: `版本 ${v} → ${v + 1} 的升級失敗：${String(e)}` }
    }
  }
  const after = judge(current)
  if (after.kind !== 'ok') {
    return { ok: false, reason: `升級後仍然不是可用的存檔：${describeVerdict(after)}` }
  }
  return { ok: true, value: current }
}

function describe(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return '陣列'
  return typeof v
}

function describeVerdict(v: VersionVerdict): string {
  switch (v.kind) {
    case 'ok':
      return '可用'
    case 'needs-upgrade':
      return `仍是版本 ${v.from}`
    case 'too-new':
      return `版本 ${v.from} 高於當前`
    case 'not-a-save':
      return v.detail
  }
}
