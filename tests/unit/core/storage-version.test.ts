/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（2026-08-21，見 `vitest.config.ts` 的說明）——
 * 這個檔碰得到 DOM，所以顯式加回來。
 *
 * 🪦 **理由裡的 `localStorage` 已於 2026-09-06 退場**（spec 173）：
 * 存放變成一個注入的埠，而這個檔注入的是記憶體實作。
 * ⚠️ **`document` 那一半仍然成立**，所以這一行留著。
 * > **一個「因為 A、B、C 所以需要 X」的理由，在 A 消失時
 * > 不會自己變成「因為 B、C」——它會整句留著，然後被當成還完整的。**
 */
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
import { MemoryKeyValueStore } from '../../../src/core/host/key-value-store'
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

/**
 * 🪦 **這裡曾經是一個把 `globalThis.localStorage` 換掉的 mock**
 * （2026-09-06，spec 173 之前）。
 *
 * 存放變成一個**注入的埠**之後，那種替身不再需要——也不再可行：
 * 核心不看全域了。
 *
 * > **一個測試如果要換掉全域才測得到，那它測的東西就綁在全域上
 * > ——而換掉全域的那一行，正是那個綁定的收據。**
 *
 * ⚠️ 而換成注入之後多了一件事：**每一個 `describe` 各自拿一個新的 store**，
 * 於是測試之間再也不可能互相污染（舊的做法靠記得呼叫 `clear()`）。
 */
let backing = new MemoryKeyValueStore()

/** 一份合法的存檔，版本可覆寫 */
function savedState(version = CURRENT_VERSION, extra: Record<string, unknown> = {}) {
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
  it('SAVED_STATE_FIELDS 是 13 個欄位', () => {
    // 守的是「有人把 satisfies 拿掉之後清單縮水」
    // ⚠️ 11 → 12（2026-08-17，spec 136）：新增 `targetId`。
    // **上調是刻意的**——目標取代了「課程清單 ＋ 風格」兩次分開的選擇，
    // 而存檔要記得使用者選的是哪個目標。舊存檔沒有這一格，還原時回退到 `topicId`。
    // ⚠️ 12 → 13（2026-08-27，v17）：新增 `flowLayout`——流程節點手放過的位置。
    // **上調是刻意的**：在此之前那份佈局只活在記憶體裡，重新整理就沒了。
    // 🔴 它與 `blocklyState` 同桶（sideCar）而**性質不同**：積木狀態導得出來
    // （從程式碼重 lift）＝ 快取，而**沒有人算得出使用者想把盒子放哪** ＝ 狀態。
    expect(Object.keys(SAVED_STATE_FIELDS).length).toBe(13)
  })

  it('REQUIRED_FIELDS 是 SAVED_STATE_FIELDS 的子集', () => {
    const all = new Set(Object.keys(SAVED_STATE_FIELDS))
    for (const k of Object.keys(REQUIRED_FIELDS)) expect(all.has(k)).toBe(true)
  })
})

describe('版本判定：三種情況三種結果', () => {
  it('版本相同 → ok', () => {
    expect(judge(savedState(CURRENT_VERSION)).kind).toBe('ok')
  })

  it('版本較高 → too-new（不是靜默接受）', () => {
    const v = judge(savedState(99))
    expect(v.kind).toBe('too-new')
    expect(v.kind === 'too-new' && v.from).toBe(99)
  })

  it('版本較低 → needs-upgrade', () => {
    const v = judge(savedState(0))
    expect(v.kind).toBe('needs-upgrade')
  })
})

describe('形狀驗證：不是存檔的東西不得被當成存檔', () => {
  const notASave: [string, unknown][] = [
    ['隨便一個物件', { hello: 'world' }],
    ['null', null],
    ['陣列', [1, 2, 3]],
    ['數字', 42],
    ['版本號是字串', savedState(1 as number, { version: 'abc' })],
    ['版本號是 NaN', savedState(NaN)],
    ['缺 code', (() => { const s = savedState() as Record<string, unknown>; delete s.code; return s })()],
    ['缺 version', (() => { const s = savedState() as Record<string, unknown>; delete s.version; return s })()],
  ]

  for (const [name, value] of notASave) {
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
    expect(judge(savedState(CURRENT_VERSION, { futureFields: 42 })).kind).toBe('ok')
  })
})

describe('升級路徑', () => {
  it('CURRENT_VERSION 需要的每一步都有註冊（FR-016）', () => {
    const missingOnes: number[] = []
    for (let v = 1; v < CURRENT_VERSION; v++) if (!UPGRADES[v]) missingOnes.push(v)
    expect(
      missingOnes,
      `把 CURRENT_VERSION 調高卻沒註冊升級路徑，會讓每一位既有使用者的存檔被拒絕。` +
        `缺少：${missingOnes.map((v) => `${v}→${v + 1}`).join('、')}`,
    ).toEqual([])
  })

  it('沒有升級路徑時明確失敗，而不是產出半升級的狀態', () => {
    const r = upgrade(savedState(0) as Record<string, unknown>, 0)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toContain('升級路徑')
  })
})

describe('兩條讀取路徑判定一致（FR-010）', () => {
  let storage: StorageService

  beforeEach(() => {
    backing = new MemoryKeyValueStore()
    vi.clearAllMocks()
    storage = new StorageService('cpp', backing)
  })

  const samples: [string, unknown][] = [
    ['合法、版本相同', savedState(CURRENT_VERSION)],
    ['版本較高', savedState(99)],
    ['不是存檔', { hello: 'world' }],
    ['缺必填欄位', { version: 1, code: 'x' }],
  ]

  for (const [name, value] of samples) {
    it(`${name}：自動載入與匯入檔案得到相同結論`, () => {
      const json = JSON.stringify(value)
      backing.write(STORAGE_KEY, json)

      const autoLoad = storage.load()
      const imports = storage.importFromJSON(json)

      expect(
        autoLoad === null,
        `自動載入 ${autoLoad === null ? '拒絕' : '接受'}，` +
          `匯入 ${imports === null ? '拒絕' : '接受'}——兩條路徑鬆緊度不同`,
      ).toBe(imports === null)
    })
  }
})

describe('自動載入的行為', () => {
  let storage: StorageService

  beforeEach(() => {
    backing = new MemoryKeyValueStore()
    vi.clearAllMocks()
    storage = new StorageService('cpp', backing)
  })

  it('版本相同 → 正常載入，與現況完全相同（FR-013／FR-042）', () => {
    backing.write(STORAGE_KEY, JSON.stringify(savedState(CURRENT_VERSION)))
    expect(storage.load()?.code).toBe('使用者的作品')
  })

  it('版本較高 → 不載入', () => {
    backing.write(STORAGE_KEY, JSON.stringify(savedState(99)))
    expect(storage.load()).toBeNull()
  })

  it('不是存檔形狀 → 不載入（現況會原樣回傳）', () => {
    backing.write(STORAGE_KEY, JSON.stringify({ hello: 'world' }))
    expect(storage.load()).toBeNull()
  })

  it('loadOutcome() 說得出為什麼——不只是 null', () => {
    backing.write(STORAGE_KEY, JSON.stringify(savedState(99)))
    const r = storage.loadOutcome()
    expect(r.kind).toBe('refused')
    expect(r.kind === 'refused' && r.reason.code).toBe('too-new')
  })

  it('沒有存檔 → empty，與「被拒絕」可區分', () => {
    expect(storage.loadOutcome().kind).toBe('empty')
  })
})

describe('v2 → v3：元件身分加上命名空間（spec 103 的四個 Acceptance Scenario）', () => {
  const rise = (tree: unknown): unknown =>
    (UPGRADES[2]({ version: 2, tree } as Record<string, unknown>) as { tree: unknown }).tree

  it('① 舊身分（cpp_ 與裸名）都轉得動，含巢狀子節點', () => {
    const out = rise({
      componentId: 'cpp:if',
      children: {
        body: [{ componentId: 'cpp:vector_declare', children: {} }],
        condition: [{ componentId: 'cpp:compare', children: {} }],
      },
    }) as { componentId: string; children: Record<string, { componentId: string }[]> }
    expect(out.componentId).toBe('cpp:if')
    expect(out.children.body[0].componentId).toBe('cpp:vector_declare')
    expect(out.children.condition[0].componentId).toBe('cpp:compare')
  })

  it('② 已是新格式的身分**原樣通過**（冪等）', () => {
    // 樹裡本來就有三顆 `cpp:math_*`——它們不得被加成 `cpp:cpp:math_pow`。
    const out = rise({ componentId: 'cpp:math_pow', children: {} }) as { componentId: string }
    expect(out.componentId).toBe('cpp:math_pow')
  })

  it('③ 表裡認不得的身分**原樣保留**，該節點不丟棄', () => {
    const out = rise({
      componentId: '__某個未來的身分__',
      properties: { keep: 'me' },
      children: { body: [{ componentId: 'cpp:print', children: {} }] },
    }) as { componentId: string; properties: Record<string, string>; children: Record<string, { componentId: string }[]> }
    expect(out.componentId).toBe('__某個未來的身分__')
    expect(out.properties.keep, '認不得就整個節點丟掉的話，使用者的資料會消失').toBe('me')
    expect(out.children.body[0].componentId, '認不得的父節點不得阻斷子節點的轉換').toBe('cpp:print')
  })

  it('④ 積木型別**完全不動**——66 顆身分與積木型別同名', () => {
    const raw = {
      version: 2,
      tree: { componentId: 'cpp:class_def', children: {} },
      blocklyState: { blocks: { blocks: [{ type: 'cpp_class_def' }] } },
    } as Record<string, unknown>
    const out = UPGRADES[2](raw) as { tree: { componentId: string }; blocklyState: unknown }
    expect(out.tree.componentId).toBe('cpp:class_def')
    expect(
      JSON.stringify(out.blocklyState),
      '積木型別被轉了 → 積木會消失，而那有十幾種成因，無從歸因',
    ).toBe(JSON.stringify(raw.blocklyState))
  })

  it('⑤ 轉換表的每一筆走完鏈都要落在合法身分上', () => {
    // ⚠️ 原本檢查「每一筆的目標在白名單內」——**D1 之後那是錯的**。
    // v2→v3 把裸名帶到 `lang:*`，而 v4→v5 又把 `lang:*` 帶到 `cpp:*`。
    // 中間那一站**本來就不該是合法的現存 scope**，它是歷史的中繼點。
    const table = registeredIdMigrations()
    // ⚠️ 這個數字會隨每一次 G 的改名增加——**它不該是硬編的**。
    // 它要驗的是「表非空且每一筆都走得通」，不是「剛好幾筆」。
    expect(Object.keys(table).length, '改名表是空的 → 沒有任何套件登錄').toBeGreaterThan(200)
    const parse = (id: string): string => {
      let cur = id
      for (let i = 0; i < 10 && table[cur]; i++) cur = table[cur]
      return cur
    }
    for (const old of Object.keys(table)) {
      expect(isValidComponentId(parse(old)), `${old} → … → ${parse(old)} 走完鏈仍不合法`).toBe(true)
    }
    void isNamespaced
  })
})

describe('v3 → v4：接收者參數統一叫 obj（G 項第 1 步）', () => {
  const rise = (tree: unknown): unknown =>
    (UPGRADES[3]({ version: 3, tree } as Record<string, unknown>) as { tree: unknown }).tree

  it('★ 舊參數名轉得動，含巢狀', () => {
    const out = rise({
      componentId: 'lang:program',
      properties: {},
      children: {
        body: [
          { componentId: 'lang:var_assign', properties: { name: 'x' }, children: {} },
          { componentId: 'cpp:vector_size', properties: { vector: 'v' }, children: {} },
          { componentId: 'cpp:pointer_assign', properties: { ptr_name: 'p' }, children: {} },
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
    const out = rise({
      componentId: 'lang:var_declare',
      properties: { name: 'x', type: 'int' },
      children: {},
    }) as { properties: Record<string, string> }
    // `var_declare.name` 是**它自己的名字**，不是接收者——不該被改
    expect(out.properties.name, 'var_declare 的 name 被誤改了').toBe('x')
    expect(out.properties.type).toBe('int')
  })

  it('★ 反向：不升級的話，產生器會拿不到接收者', () => {
    // 沒有這一支，前兩支綠可能只是因為「舊屬性名本來也讀得到」。
    const old = { componentId: 'cpp:vector_size', properties: { vector: 'v' }, children: {} }
    expect(
      (old.properties as Record<string, string>).obj,
      '舊格式本來就有 obj → 那這個遷移沒有存在的必要',
    ).toBeUndefined()
  })

  it('★ 兩個套件的參數改名表都登錄了（機制有沒有接上）', () => {
    const table = registeredPropertyMigrations()
    expect(Object.keys(table).length, '沒有任何套件登錄參數改名——機制有了沒人接上').toBe(10)
    for (const map of Object.values(table)) {
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
        tree: { componentId: 'var_assign', properties: { name: 'x' }, children: {} },
        blocklyState: {}, code: '', language: 'cpp', styleId: 'apcs', lastModified: 0,
      } as Record<string, unknown>,
      2,
      // ⚠️ **停在 v10**：v11 把 `tree` 從存檔裡拿掉了（沒有還原路徑在讀它），
      //    而這一支要驗的正是 v1→v9 那八個改寫 `tree` 的步驟。
      10,
    )
    expect(r.ok, r.ok ? '' : (r as { reason: string }).reason).toBe(true)
    const tree = (r as { value: { tree: { componentId: string; properties: Record<string, string> } } }).value.tree
    expect(tree.componentId, '身分沒走到最終形態').toBe('cpp:var_assign')
    expect(tree.properties.obj, '參數沒改到——多半是遷移表的鍵用了現在的 id').toBe('x')
    expect(tree.properties.name).toBeUndefined()
  })
})
