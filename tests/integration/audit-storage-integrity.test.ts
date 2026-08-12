/**
 * 存檔完整性護欄（第六條）
 *
 * ## 這條護欄的三個數字全部是 0——這件事本身就是它最大的風險
 *
 * 前五條護欄的基線都是非零的（20 檔、92 個殼、85 筆停用、8 個歧義群組）。
 * 非零數字有一個附帶的好處：**它證明量測真的量到了東西**。
 *
 * 這一條不同。US1–US3 已經把三種違規修到 0，所以護欄一裝上去就是 0/0/0。
 * 而一條回報「零違規」的健康護欄，與一條**什麼都沒量到**的壞護欄，
 * 產出完全一樣。
 *
 * **所以自我驗證不能靠斷言數字，必須靠注入。** 下面的「注入已知違規」那組
 * 測試才是這條護欄真正的健康檢查：故意餵一個會丟欄位的存檔實作進去，
 * 確認掃描器**報得出來、而且理由正確**。
 *
 * ## 為什麼理由也要釘
 *
 * 上一輪（051）的自我驗證測試通過了，但它只釘「這一群必須被報出來」。
 * 結果護欄因為**正確的事實**得到了**錯誤的結論**，而測試看不出差別。
 *
 * **一個因為錯誤理由而給出正確結果的護欄，看起來與健康的完全一樣。**
 *
 * 見 specs/052-storage-integrity-gate/contracts/storage.md
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadBaseline, writeBaseline, printReport, RATCHET_NOTE, type BaselineMeta , assertRatchet } from '../helpers/guardrail'
import { StorageService } from '../../src/core/storage'
import { SAVED_STATE_FIELDS, CURRENT_VERSION, UPGRADES } from '../../src/core/storage-version'
import type { SavedState } from '../../src/core/storage'

const STORAGE_KEY = 'semorphe-state'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

const RULE =
  '欄位守恆：存入可辨識值後讀回比對。判定一致性：自動載入與匯入對同一輸入的接受／拒絕須相同。' +
  '升級路徑：從 1 到 CURRENT_VERSION 的每一步都須註冊。'

/** 護欄的失效樣態——照 concepts/執行機構.md 的要求 */
const SELF_FALSIFICATION =
  '⚠️ 這條護欄的三個數字都是 0，而「健康的 0」與「什麼都沒量到的 0」產出一樣。' +
  '判斷它有沒有壞的唯一方式是「注入已知違規」那組測試——**那組如果沒跑或跑綠了卻沒報出違規，這裡的 0 一律不可信**。'

const NOT_DETECTED =
  '本護欄**不檢測**：存檔內容的語義正確性（語義樹是否真的可用）、localStorage 以外的儲存後端、' +
  '「存檔前先讀舊檔再合併」造成的污染傳播（已知、刻意留著、修法另外排）。'

interface IntegrityBaseline {
  _meta: BaselineMeta
  fieldsNotConserved: number
  verdictDisagreements: number
  missingUpgradeSteps: number
  notConservedFields: string[]
}

/** 每個欄位一個可辨識的值——用預設值的話，「丟了」與「存對了」會長得一樣 */
const probe: SavedState = {
  version: CURRENT_VERSION,
  tree: null,
  blocklyState: { probe: 'blockly' },
  code: 'probe-code',
  language: 'probe-lang',
  styleId: 'probe-style',
  topicId: 'probe-topic',
  enabledBranches: ['probe-branch'],
  lastModified: '2026-01-01T00:00:00.000Z',
  blockStyleId: 'probe-block-style',
  locale: 'probe-locale',
}

/** 由存檔層自己決定的欄位，不參與守恆比對 */
const systemRewritten = new Set(['lastModified'])

interface NotConserved {
  field: string
  reason: string
}

/**
 * 量欄位守恆。
 *
 * 接受一個 `StorageService`，**而不是直接用 module 層的那個**——這樣才能把
 * 一個故意壞掉的實作餵進來做注入驗證（見檔頭）。
 */
function measureFieldConservation(storage: {
  save(s: Partial<SavedState>): boolean
  load(): SavedState | null
}): NotConserved[] {
  localStorageMock.clear()
  storage.save(probe)
  const loaded = storage.load()
  if (!loaded) return [{ field: '(整份存檔)', reason: '存入後完全載不回來' }]

  const out: NotConserved[] = []
  for (const field of Object.keys(SAVED_STATE_FIELDS) as (keyof SavedState)[]) {
    if (systemRewritten.has(field)) continue
    const store = JSON.stringify(probe[field])
    const loadBack = JSON.stringify(loaded[field])
    if (loadBack === store) continue
    out.push({
      field,
      reason: loadBack === undefined ? '存入後讀回為 undefined' : `存入後讀回變成 ${loadBack}`,
    })
  }
  return out
}

/** 量兩條讀取路徑的判定是否一致 */
function measureVerdictAgreement(): { input: string; auto: string; imported: string }[] {
  const storage = new StorageService()
  const valid = { ...probe }
  const samples: [string, unknown][] = [
    ['合法、版本相同', valid],
    ['版本較高', { ...valid, version: CURRENT_VERSION + 98 }],
    ['版本較低', { ...valid, version: 0 }],
    ['不是存檔', { hello: 'world' }],
    ['缺必填欄位', { version: CURRENT_VERSION, code: 'x' }],
    ['多帶未知欄位', { ...valid, fromFuture: 1 }],
  ]

  const out: { input: string; auto: string; imported: string }[] = []
  for (const [name, value] of samples) {
    localStorageMock.clear()
    const json = JSON.stringify(value)
    localStorage.setItem(STORAGE_KEY, json)
    const auto = storage.load() === null ? '拒絕' : '接受'
    const imported = storage.importFromJSON(json) === null ? '拒絕' : '接受'
    if (auto !== imported) out.push({ input: name, auto, imported })
  }
  return out
}

/** 量從 1 到 CURRENT_VERSION 有幾步沒有註冊升級路徑 */
function measureUpgradeCoverage(): number[] {
  const missing: number[] = []
  for (let v = 1; v < CURRENT_VERSION; v++) if (!UPGRADES[v]) missing.push(v)
  return missing
}

const notConserved = measureFieldConservation(new StorageService())
const disagreements = measureVerdictAgreement()
const missingSteps = measureUpgradeCoverage()

describe('護欄：存檔完整性', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('產出可讀報表', () => {
    const lines: string[] = []
    lines.push(SELF_FALSIFICATION)
    lines.push(NOT_DETECTED)
    lines.push('')
    lines.push(`判定規則：${RULE}`)
    lines.push('')
    lines.push(
      `欄位不守恆：${notConserved.length}／${Object.keys(SAVED_STATE_FIELDS).length - systemRewritten.size} 個受檢欄位` +
        `｜判定不一致：${disagreements.length}／6 種輸入` +
        `｜缺升級路徑：${missingSteps.length}／${Math.max(0, CURRENT_VERSION - 1)} 步`,
    )
    if (notConserved.length > 0) {
      lines.push('')
      lines.push('**欄位不守恆**（存進去載不回來——無聲的資料遺失）：')
      for (const x of notConserved) lines.push(`  ${x.field}：${x.reason}`)
    }
    if (disagreements.length > 0) {
      lines.push('')
      lines.push('**兩條讀取路徑判定不一致**（同一份資料，自動載入與匯入結論不同）：')
      for (const d of disagreements) lines.push(`  ${d.input}：自動載入=${d.auto}，匯入=${d.imported}`)
    }
    if (missingSteps.length > 0) {
      lines.push('')
      lines.push(`**缺升級路徑**：${missingSteps.map((v) => `${v}→${v + 1}`).join('、')}`)
      lines.push('  ← 調高 CURRENT_VERSION 卻沒註冊升級函式，會拒絕掉每一位既有使用者的存檔')
    }
    lines.push('')
    lines.push(`目前 CURRENT_VERSION = ${CURRENT_VERSION}，已註冊升級路徑 ${Object.keys(UPGRADES).length} 條。`)

    printReport('存檔完整性護欄', lines)
    expect(notConserved.length).toBeGreaterThanOrEqual(0)
  })

  // ─────────────────────────────────────────────────────────────
  // ★ 自我驗證：注入已知違規
  //
  // 這組才是這條護欄的健康檢查。三個數字都是 0，斷言它們等於 0 完全
  // 證明不了護欄有在運作。
  // ─────────────────────────────────────────────────────────────

  it('★ 注入：會丟欄位的存檔實作，必須被報出來', () => {
    // 一個故意丟掉 locale 的實作——就是修好之前的那個 bug
    const brokenImpl = {
      save(s: Partial<SavedState>): boolean {
        const { locale: _drop, ...rest } = s as SavedState
        void _drop
        localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
        return true
      },
      load(): SavedState | null {
        const j = localStorage.getItem(STORAGE_KEY)
        return j ? (JSON.parse(j) as SavedState) : null
      },
    }

    const found = measureFieldConservation(brokenImpl)
    const localeItem = found.find((x) => x.field === 'locale')

    expect(
      localeItem,
      '掃描器沒有報出被丟掉的 locale —— 那麼報表上的「0」是瞎的，不是健康的',
    ).toBeDefined()

    // ★ 釘的是**理由**，不只是結果。
    // 051 的教訓：只釘「必須被報出來」的話，護欄可以因為錯誤的理由得到
    // 正確的結果，而測試看不出差別。
    expect(
      localeItem!.reason,
      `報出來了，但理由是「${localeItem!.reason}」——理由錯了代表掃描器判斷的是別的東西`,
    ).toBe('存入後讀回為 undefined')
  })

  it('★ 注入：值被改掉（不是丟掉）的實作，理由必須是「變成了什麼」而不是「undefined」', () => {
    const tamperedImpl = {
      save(s: Partial<SavedState>): boolean {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, locale: '被改掉了' }))
        return true
      },
      load(): SavedState | null {
        const j = localStorage.getItem(STORAGE_KEY)
        return j ? (JSON.parse(j) as SavedState) : null
      },
    }

    const found = measureFieldConservation(tamperedImpl)
    const localeItem = found.find((x) => x.field === 'locale')
    expect(localeItem).toBeDefined()
    expect(
      localeItem!.reason,
      '「丟了」與「被改了」是兩種不同的病，理由必須分得出來',
    ).toContain('變成')
  })

  it('★ 注入：不誤報——正確的實作必須是零違規', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上面兩支
    expect(measureFieldConservation(new StorageService())).toEqual([])
  })

  it('棘輪：三個數字皆不得上升', () => {
    const b = loadBaseline<IntegrityBaseline>('storage-integrity')
    const rows: [string, number, number][] = [
      ['欄位不守恆', notConserved.length, b.fieldsNotConserved],
      ['判定不一致', disagreements.length, b.verdictDisagreements],
      ['缺升級路徑', missingSteps.length, b.missingUpgradeSteps],
    ]
    const worsened = rows.filter(([, now, base]) => now > base)

    if (worsened.length > 0) {
      const addedFields = notConserved.filter((x) => !b.notConservedFields.includes(x.field))
      printReport('存檔完整性：數字上升', [
        ...worsened.map(([n, now, base]) => `  ✘ ${n}: ${base} → ${now}`),
        ...addedFields.map((x) => `  ✘ 新的不守恆欄位：${x.field}（${x.reason}）`),
        ...disagreements.map((d) => `  ✘ 判定不一致：${d.input}（自動=${d.auto}，匯入=${d.imported}）`),
      ])
    }
    expect(worsened.map(([n]) => n)).toEqual([])
  })
})

/** 產生基線：`GENERATE_BASELINE=1 npx vitest run tests/integration/audit-storage-integrity.test.ts` */
if (process.env.GENERATE_BASELINE) {
  writeBaseline('storage-integrity', {
    _meta: {
      guard: 'storage-integrity',
      measuredAt: new Date().toISOString().slice(0, 10),
      rule: RULE,
      note: RATCHET_NOTE + ' ' + SELF_FALSIFICATION,
    },
    fieldsNotConserved: notConserved.length,
    verdictDisagreements: disagreements.length,
    missingUpgradeSteps: missingSteps.length,
    notConservedFields: notConserved.map((x) => x.field),
  })
}
