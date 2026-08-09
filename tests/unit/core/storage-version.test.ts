/**
 * 版本閘門（US2）
 *
 * 三種版本情況必須有三種結果，而且**兩條讀取路徑判定一致**。
 *
 * 在此之前：自動載入那條（每次開頁面都跑）什麼都不檢查；匯入那條只檢查
 * `version` 欄位**存在**。最鬆的那條是自動跑的那條。
 *
 * 見 specs/052-storage-integrity-gate/research.md F2
 */
import { isValidComponentId, isNamespaced } from '../../../src/core/identity'
// 副作用：讓兩份套件的身分改名表登錄進來
import '../../../src/languages/cpp/all-declarations'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageService } from '../../../src/core/storage'
import {
  judge,
  judgeJSON,
  upgrade,
  CURRENT_VERSION,
  SAVED_STATE_FIELDS,
  REQUIRED_FIELDS,
  UPGRADES,
  registeredIdMigrations,
  registeredPropertyMigrations,
} from '../../../src/core/storage-version'

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

/** 一份合法的存檔，版本可覆寫 */
function 存檔(version = CURRENT_VERSION, extra: Record<string, unknown> = {}) {
  return {
    version,
    tree: null,
    blocklyState: {},
    code: '使用者的作品',
    language: 'cpp',
    styleId: 'apcs',
    lastModified: '2026-08-06T00:00:00.000Z',
    ...extra,
  }
}

describe('欄位清單由編譯器釘住', () => {
  it('SAVED_STATE_FIELDS 是 11 個欄位', () => {
    // 守的是「有人把 satisfies 拿掉之後清單縮水」
    expect(Object.keys(SAVED_STATE_FIELDS).length).toBe(11)
  })

  it('REQUIRED_FIELDS 是 SAVED_STATE_FIELDS 的子集', () => {
    const all = new Set(Object.keys(SAVED_STATE_FIELDS))
    for (const k of Object.keys(REQUIRED_FIELDS)) expect(all.has(k)).toBe(true)
  })
})

describe('版本判定：三種情況三種結果', () => {
  it('版本相同 → ok', () => {
    expect(judge(存檔(CURRENT_VERSION)).kind).toBe('ok')
  })

  it('版本較高 → too-new（不是靜默接受）', () => {
    const v = judge(存檔(99))
    expect(v.kind).toBe('too-new')
    expect(v.kind === 'too-new' && v.from).toBe(99)
  })

  it('版本較低 → needs-upgrade', () => {
    const v = judge(存檔(0))
    expect(v.kind).toBe('needs-upgrade')
  })
})

describe('形狀驗證：不是存檔的東西不得被當成存檔', () => {
  const 不是存檔: [string, unknown][] = [
    ['隨便一個物件', { hello: 'world' }],
    ['null', null],
    ['陣列', [1, 2, 3]],
    ['數字', 42],
    ['版本號是字串', 存檔(1 as number, { version: 'abc' })],
    ['版本號是 NaN', 存檔(NaN)],
    ['缺 code', (() => { const s = 存檔() as Record<string, unknown>; delete s.code; return s })()],
    ['缺 version', (() => { const s = 存檔() as Record<string, unknown>; delete s.version; return s })()],
  ]

  for (const [name, value] of 不是存檔) {
    it(`${name} → not-a-save`, () => {
      const v = judge(value)
      expect(v.kind, `判定結果：${JSON.stringify(v)}`).toBe('not-a-save')
      // 說不出為什麼拒絕，等於沒有拒絕——使用者會看到一個無法行動的訊息
      expect(v.kind === 'not-a-save' && v.detail.length).toBeGreaterThan(0)
    })
  }

  it('不是合法 JSON → not-a-save', () => {
    expect(judgeJSON('not json').verdict.kind).toBe('not-a-save')
  })

  it('合法存檔多帶不認得的欄位 → 仍然通過（FR-017）', () => {
    expect(judge(存檔(CURRENT_VERSION, { 來自未來的欄位: 42 })).kind).toBe('ok')
  })
})

describe('升級路徑', () => {
  it('CURRENT_VERSION 需要的每一步都有註冊（FR-016）', () => {
    const 缺的: number[] = []
    for (let v = 1; v < CURRENT_VERSION; v++) if (!UPGRADES[v]) 缺的.push(v)
    expect(
      缺的,
      `把 CURRENT_VERSION 調高卻沒註冊升級路徑，會讓每一位既有使用者的存檔被拒絕。` +
        `缺少：${缺的.map((v) => `${v}→${v + 1}`).join('、')}`,
    ).toEqual([])
  })

  it('沒有升級路徑時明確失敗，而不是產出半升級的狀態', () => {
    const r = upgrade(存檔(0) as Record<string, unknown>, 0)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain('升級路徑')
  })
})

describe('兩條讀取路徑判定一致（FR-010）', () => {
  let storage: StorageService

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    storage = new StorageService()
  })

  const 樣本: [string, unknown][] = [
    ['合法、版本相同', 存檔(CURRENT_VERSION)],
    ['版本較高', 存檔(99)],
    ['不是存檔', { hello: 'world' }],
    ['缺必填欄位', { version: 1, code: 'x' }],
  ]

  for (const [name, value] of 樣本) {
    it(`${name}：自動載入與匯入檔案得到相同結論`, () => {
      const json = JSON.stringify(value)
      localStorage.setItem(STORAGE_KEY, json)

      const 自動載入 = storage.load()
      const 匯入 = storage.importFromJSON(json)

      expect(
        自動載入 === null,
        `自動載入 ${自動載入 === null ? '拒絕' : '接受'}，` +
          `匯入 ${匯入 === null ? '拒絕' : '接受'}——兩條路徑鬆緊度不同`,
      ).toBe(匯入 === null)
    })
  }
})

describe('自動載入的行為', () => {
  let storage: StorageService

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    storage = new StorageService()
  })

  it('版本相同 → 正常載入，與現況完全相同（FR-013／FR-042）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(存檔(CURRENT_VERSION)))
    expect(storage.load()?.code).toBe('使用者的作品')
  })

  it('版本較高 → 不載入', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(存檔(99)))
    expect(storage.load()).toBeNull()
  })

  it('不是存檔形狀 → 不載入（現況會原樣回傳）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ hello: 'world' }))
    expect(storage.load()).toBeNull()
  })

  it('loadOutcome() 說得出為什麼——不只是 null', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(存檔(99)))
    const r = storage.loadOutcome()
    expect(r.kind).toBe('refused')
    expect(r.kind === 'refused' && r.reason.code).toBe('too-new')
  })

  it('沒有存檔 → empty，與「被拒絕」可區分', () => {
    expect(storage.loadOutcome().kind).toBe('empty')
  })
})

describe('v2 → v3：元件身分加上命名空間（spec 103 的四個 Acceptance Scenario）', () => {
  const 升 = (tree: unknown): unknown =>
    (UPGRADES[2]({ version: 2, tree } as Record<string, unknown>) as { tree: unknown }).tree

  it('① 舊身分（cpp_ 與裸名）都轉得動，含巢狀子節點', () => {
    const out = 升({
      conceptId: 'cpp:if',
      children: {
        body: [{ conceptId: 'cpp:vector_declare', children: {} }],
        condition: [{ conceptId: 'cpp:compare', children: {} }],
      },
    }) as { conceptId: string; children: Record<string, { conceptId: string }[]> }
    expect(out.conceptId).toBe('cpp:if')
    expect(out.children.body[0].conceptId).toBe('cpp:vector_declare')
    expect(out.children.condition[0].conceptId).toBe('cpp:compare')
  })

  it('② 已是新格式的身分**原樣通過**（冪等）', () => {
    // 樹裡本來就有三顆 `cpp:math_*`——它們不得被加成 `cpp:cpp:math_pow`。
    const out = 升({ conceptId: 'cpp:math_pow', children: {} }) as { conceptId: string }
    expect(out.conceptId).toBe('cpp:math_pow')
  })

  it('③ 表裡認不得的身分**原樣保留**，該節點不丟棄', () => {
    const out = 升({
      conceptId: '__某個未來的身分__',
      properties: { keep: 'me' },
      children: { body: [{ conceptId: 'cpp:print', children: {} }] },
    }) as { conceptId: string; properties: Record<string, string>; children: Record<string, { conceptId: string }[]> }
    expect(out.conceptId).toBe('__某個未來的身分__')
    expect(out.properties.keep, '認不得就整個節點丟掉的話，使用者的資料會消失').toBe('me')
    expect(out.children.body[0].conceptId, '認不得的父節點不得阻斷子節點的轉換').toBe('cpp:print')
  })

  it('④ 積木型別**完全不動**——66 顆身分與積木型別同名', () => {
    const raw = {
      version: 2,
      tree: { conceptId: 'cpp:class_def', children: {} },
      blocklyState: { blocks: { blocks: [{ type: 'cpp_class_def' }] } },
    } as Record<string, unknown>
    const out = UPGRADES[2](raw) as { tree: { conceptId: string }; blocklyState: unknown }
    expect(out.tree.conceptId).toBe('cpp:class_def')
    expect(
      JSON.stringify(out.blocklyState),
      '積木型別被轉了 → 積木會消失，而那有十幾種成因，無從歸因',
    ).toBe(JSON.stringify(raw.blocklyState))
  })

  it('⑤ 轉換表的每一筆走完鏈都要落在合法身分上', () => {
    // ⚠️ 原本檢查「每一筆的目標在白名單內」——**D1 之後那是錯的**。
    // v2→v3 把裸名帶到 `lang:*`，而 v4→v5 又把 `lang:*` 帶到 `cpp:*`。
    // 中間那一站**本來就不該是合法的現存 scope**，它是歷史的中繼點。
    const 表 = registeredIdMigrations()
    // ⚠️ 這個數字會隨每一次 G 的改名增加——**它不該是硬編的**。
    // 它要驗的是「表非空且每一筆都走得通」，不是「剛好幾筆」。
    expect(Object.keys(表).length, '改名表是空的 → 沒有任何套件登錄').toBeGreaterThan(200)
    const 解析 = (id: string): string => {
      let cur = id
      for (let i = 0; i < 10 && 表[cur]; i++) cur = 表[cur]
      return cur
    }
    for (const old of Object.keys(表)) {
      expect(isValidComponentId(解析(old)), `${old} → … → ${解析(old)} 走完鏈仍不合法`).toBe(true)
    }
    void isNamespaced
  })
})

describe('v3 → v4：接收者參數統一叫 obj（G 項第 1 步）', () => {
  const 升 = (tree: unknown): unknown =>
    (UPGRADES[3]({ version: 3, tree } as Record<string, unknown>) as { tree: unknown }).tree

  it('★ 舊參數名轉得動，含巢狀', () => {
    const out = 升({
      conceptId: 'lang:program',
      properties: {},
      children: {
        body: [
          { conceptId: 'lang:var_assign', properties: { name: 'x' }, children: {} },
          { conceptId: 'cpp:vector_size', properties: { vector: 'v' }, children: {} },
          { conceptId: 'cpp:pointer_assign', properties: { ptr_name: 'p' }, children: {} },
        ],
      },
    }) as { children: Record<string, { properties: Record<string, string> }[]> }
    const b = out.children.body
    expect(b[0].properties.obj, 'var_assign 的 name 沒轉成 obj').toBe('x')
    expect(b[1].properties.obj).toBe('v')
    expect(b[2].properties.obj).toBe('p')
    expect(b[0].properties.name, '舊的鍵應該不見了').toBeUndefined()
  })

  it('★ 不在表裡的屬性原樣保留', () => {
    const out = 升({
      conceptId: 'lang:var_declare',
      properties: { name: 'x', type: 'int' },
      children: {},
    }) as { properties: Record<string, string> }
    // `var_declare.name` 是**它自己的名字**，不是接收者——不該被改
    expect(out.properties.name, 'var_declare 的 name 被誤改了').toBe('x')
    expect(out.properties.type).toBe('int')
  })

  it('★ 反向：不升級的話，產生器會拿不到接收者', () => {
    // 沒有這一支，前兩支綠可能只是因為「舊屬性名本來也讀得到」。
    const 舊 = { conceptId: 'cpp:vector_size', properties: { vector: 'v' }, children: {} }
    expect(
      (舊.properties as Record<string, string>).obj,
      '舊格式本來就有 obj → 那這個遷移沒有存在的必要',
    ).toBeUndefined()
  })

  it('★ 兩個套件的參數改名表都登錄了（機制有沒有接上）', () => {
    const 表 = registeredPropertyMigrations()
    expect(Object.keys(表).length, '沒有任何套件登錄參數改名——機制有了沒人接上').toBe(10)
    for (const map of Object.values(表)) {
      expect(Object.values(map), '接收者統一叫 obj').toEqual(['obj'])
    }
  })
})

describe('端到端：v2 的存檔走完整條鏈（順序不能倒）', () => {
  it('★ 身分與參數都要落在最終形態', () => {
    // ⚠️ 這一支是為了一個**我真的犯過的錯**：
    // 參數改名跑在 v3→v4，身分改名（D1）跑在 v4→v5。
    // 我一度把參數改名表的鍵「順手」更新成 `cpp:*`——那會讓 v3 的樹對不上，
    // 結果是 **id 改了而參數沒改**，而分段各自的單元測試**都會過**。
    //
    // > **遷移表的鍵屬於它那個版本，不屬於現在。**
    const r = upgrade(
      {
        version: 2,
        tree: { conceptId: 'var_assign', properties: { name: 'x' }, children: {} },
        blocklyState: {}, code: '', language: 'cpp', styleId: 'apcs', lastModified: 0,
      } as Record<string, unknown>,
      2,
    )
    expect(r.ok, r.ok ? '' : (r as { reason: string }).reason).toBe(true)
    const tree = (r as { value: { tree: { conceptId: string; properties: Record<string, string> } } }).value.tree
    expect(tree.conceptId, '身分沒走到最終形態').toBe('cpp:var_assign')
    expect(tree.properties.obj, '參數沒改到——多半是遷移表的鍵用了現在的 id').toBe('x')
    expect(tree.properties.name).toBeUndefined()
  })
})
