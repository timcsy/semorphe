/**
 * 第二十七條護欄：**命名一致性**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的壞名字沒有被報出來，
 * > 代表護欄壞了，不是名字都乾淨。**
 *
 * ## 它存在的理由
 *
 * 「命名一致」是**不可否證的**。所以它會隨每個維護者的品味漂移，
 * 而在有版本之後，**每次漂移都是一次存檔遷移**（發版 ＋ 遷移表 ＋ 立墓碑）。
 *
 * > **趁還沒有版本的時候，把會反覆發生的錯誤先擋住。**
 *
 * 而 E 項踩過一次「一個假的驗收標準活了兩天，因為它是一個數字」
 * （`history/029`）。所以這裡的五項**每一項都要說得出它量的是什麼**，
 * 而不是給一個總分。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測名字好不好聽**——只檢測它是否由宣告過的詞彙組成
 * - **不檢測語義對不對**——`string_size` 若其實在算容量，這裡看不出來
 * - 詞彙表本身對不對是**人的判斷**，這裡只保證「宣告了什麼就照什麼來」
 */
import { describe, it, expect } from 'vitest'
import { printReport, loadBaseline, writeBaseline, newItems, assertRatchet } from '../helpers/guardrail'
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { paramSpecs } from '../../src/core/param-spec'
import { parseName, SEPARATOR } from '../../src/core/naming'
import { OPERATIONS, KINDS, MODIFIERS, ATOMIC_NAMES, SUBJECTS, RECEIVER_PARAM, SELF_NAMING_OPERATIONS } from '../../src/languages/cpp/naming'

type 違規類 = '接收者參數名' | '操作詞不在詞彙' | '裸的函式庫名' | '修飾詞站主體位' | '主體不在前' | '殘留 lang: scope'
interface Finding { 類: 違規類; id: string; 說明: string }

interface 概念 { conceptId: string; properties?: unknown }

/**
 * 接收者 = **操作作用在它身上的那個既有物件**。
 *
 * ⚠️ 第一版靠模板判定（開頭是 `${X}.` 或 `${X}[`），**漏報四顆**——
 * `lang:array_access`／`lang:array_assign`／`lang:var_assign` 是手寫產生器（沒有模板），
 * `cpp:pointer_assign` 的模板開頭是 `*${PTR_NAME}`。
 *
 * 現在靠**操作**判定：非單字名、且操作不在 `SELF_NAMING_OPERATIONS` 裡的元件，
 * 它的第一個識別字參數就是接收者。判準是**創造／引用 vs 操作**。
 *
 * **已知盲點**：單字名的元件（`increment`／`input`）拆不出操作，這裡看不到。
 * 那類會**低報**，不會誤報。
 */
function 接收者參數名(concepts: 概念[]): Map<string, string> {
  // ⚠️ **第二段是「種類」的元件沒有接收者**——它是一個東西，不是一個動作。
  // `loop_count` 的 `var_name` 是被創造的迴圈變數，不是被操作的物件。
  // 第一版只排除 `SELF_NAMING_OPERATIONS`，於是 loop 家族改名後全被誤報。
  const 自名 = new Set<string>([...SELF_NAMING_OPERATIONS, ...KINDS])
  const out = new Map<string, string>()
  for (const c of concepts) {
    const bare = c.conceptId.slice(c.conceptId.indexOf(':') + 1)
    const op = parseName(bare, SUBJECTS).operation
    if (!op || 自名.has(op)) continue
    const first = paramSpecs(c.properties as never)[0]
    if (first?.kind === 'identifier') out.set(c.conceptId, first.name)
  }
  return out
}

function measure(注入: 概念[] = []): Finding[] {
  const out: Finding[] = []
  const 概念們 = [...(allCppConcepts() as unknown as 概念[]), ...注入]
  const recv = 接收者參數名(概念們)
  // 第二段可以是**操作**（動作）或**種類**（名詞性的種差）
  const ops = new Set<string>([...OPERATIONS, ...KINDS])
  const mods = new Set<string>(MODIFIERS)
  const atomics = new Set<string>(ATOMIC_NAMES)

  // ① 接收者角色只准有一個名字，而那個名字是**宣告出來的**，不是多數決
  for (const [id, name] of recv) {
    if (name !== RECEIVER_PARAM) {
      out.push({ 類: '接收者參數名', id, 說明: `接收者叫 \`${name}\`，而宣告的名字是 \`${RECEIVER_PARAM}\`` })
    }
  }

  for (const c of 概念們) {
    const scope = c.conceptId.slice(0, c.conceptId.indexOf(':'))
    const bare = c.conceptId.slice(c.conceptId.indexOf(':') + 1)

    // ⑤ D1：`lang:` 這個 scope 已經沒有工作了
    if (scope === 'lang') {
      out.push({ 類: '殘留 lang: scope', id: c.conceptId, 說明: '各套件自理，通用性住在轉換規範裡——`lang:` 是假的通用宣稱' })
    }

    // ④ 修飾詞不得站在主體位置
    const 首段 = bare.split(SEPARATOR)[0]
    if (mods.has(首段)) {
      out.push({ 類: '修飾詞站主體位', id: c.conceptId, 說明: `\`${首段}\` 是修飾詞，該是參數或形態` })
      continue
    }

    // ⚠️ **宣告過的單字名要先放行**，否則下面「主體不在前」會攔截 `using_namespace`
    //（`namespace` 是已知主體，但這顆是宣告過的語言構造）。
    // 檢查的順序就是判定的優先權——第一版把它排在後面，於是三顆被誤報。
    if (atomics.has(bare)) continue

    // ③ 主體在前：**開頭沒有主體、而結尾有**，才是主體被放到後面去了。
    //
    // ⚠️ 少了「開頭沒有主體」這個條件，`literal_string` 會被誤報——
    // 它的主體是 `literal`，而結尾的 `string` 是**種類**。
    // 一個字可以同時是某處的主體與另一處的種類，位置才決定它扮演什麼。
    const parsedFirst = parseName(bare, SUBJECTS)
    const 後綴 = parsedFirst.subject
      ? undefined
      : [...SUBJECTS].sort((a, b) => b.length - a.length)
          .find((sub) => bare !== sub && bare.endsWith(SEPARATOR + sub))
    if (後綴) {
      out.push({ 類: '主體不在前', id: c.conceptId, 說明: `主體 \`${後綴}\` 在後面——排序即分群，同族要排得在一起` })
      continue
    }

    const parsed = parseName(bare, SUBJECTS)
    if (parsed.atomic) {
      // ③ 不可分解的名字必須是被允許的單字名
      if (!atomics.has(bare)) {
        out.push({ 類: '裸的函式庫名', id: c.conceptId, 說明: '不可分解，且不在允許的單字名清單裡（多半是抄來的函式庫名）' })
      }
      continue
    }
    // ② 操作詞必須在封閉詞彙裡
    if (parsed.operation && !ops.has(parsed.operation)) {
      out.push({ 類: '操作詞不在詞彙', id: c.conceptId, 說明: `操作 \`${parsed.operation}\` 不在詞彙表（同義詞請合併）` })
    }
  }
  return out.sort((a, b) => a.類.localeCompare(b.類) || a.id.localeCompare(b.id))
}

const 合成 = (id: string): 概念 => ({ conceptId: id, properties: [] })

// ─── 自我驗證 ─────────────────────────────────────────────────────

describe('自我驗證：這條護欄真的量得到東西', () => {
  it('★ 注入一個抄來的函式庫名 → **必須被報出**', () => {
    const hit = measure([合成('cpp:__合成_strlen__')]).find((f) => f.id === 'cpp:__合成_strlen__')
    expect(hit?.類, '不可分解又不在單字名清單裡的名字沒被報出 → **護欄壞了**').toBe('裸的函式庫名')
  })

  it('★ 注入一個不在詞彙裡的操作詞 → **必須被報出**', () => {
    const hit = measure([合成('cpp:string_lengthy')]).find((f) => f.id === 'cpp:string_lengthy')
    expect(hit?.類).toBe('操作詞不在詞彙')
  })

  it('★ 注入一個修飾詞站主體位的名字 → **必須被報出**', () => {
    const hit = measure([合成('cpp:static_thing')]).find((f) => f.id === 'cpp:static_thing')
    expect(hit?.類).toBe('修飾詞站主體位')
  })

  it('★ 反向：一個完全合格的名字 → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的檢查也能通過上面三支。
    expect(
      measure([合成('cpp:string_size')]).find((f) => f.id === 'cpp:string_size'),
      '一個由宣告詞彙組成的名字被報成違規 → 這條會亂叫',
    ).toBeUndefined()
  })

  it('★ 反向：允許的單字名 → **必須不被報出**', () => {
    expect(measure([合成('cpp:if')]).find((f) => f.id === 'cpp:if')).toBeUndefined()
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    expect(allCppConcepts().length, '登錄表是空的 → 每一項都會是假的零').toBeGreaterThan(150)
    expect(接收者參數名(allCppConcepts() as unknown as 概念[]).size, '一個接收者都認不出來 → 模板比對壞了').toBeGreaterThan(20)
  })
})

// ─── 詞彙表自身 ────────────────────────────────────────────────────

describe('詞彙表不得長出沒人用的字', () => {
  it('報表：每個宣告的操作詞被幾顆元件用', () => {
    const 用量 = new Map<string, number>(OPERATIONS.map((o) => [o, 0]))
    for (const c of allCppConcepts() as unknown as 概念[]) {
      const bare = c.conceptId.slice(c.conceptId.indexOf(':') + 1)
      const op = parseName(bare, SUBJECTS).operation
      if (op && 用量.has(op)) 用量.set(op, 用量.get(op)! + 1)
    }
    printReport('操作詞彙的用量', [
      `詞彙 ${OPERATIONS.length} 個｜主體 ${SUBJECTS.length} 個｜單字名 ${ATOMIC_NAMES.length} 個`,
      '',
      ...[...用量].sort((a, b) => b[1] - a[1]).map(([o, n]) => `  ${o.padEnd(12)} ${n}${n === 0 ? '   ⚠️ 零使用——是還沒改到，還是這個字不該存在？' : ''}`),
    ])
    expect(true).toBe(true)
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('命名一致性（G 項的驗收）', () => {
  const findings = measure()
  const 依類 = (k: 違規類): Finding[] => findings.filter((f) => f.類 === k)

  it('報表', () => {
    const 類別 = ['接收者參數名', '操作詞不在詞彙', '裸的函式庫名', '修飾詞站主體位', '主體不在前', '殘留 lang: scope'] as 違規類[]
    printReport('命名一致性', [
      類別.map((k) => `${k} ${依類(k).length}`).join('｜'),
      '',
      ...類別.flatMap((k) => {
        const l = 依類(k)
        if (l.length === 0) return []
        return [
          `**${k}**（${l.length}）：`,
          ...l.slice(0, 12).map((f) => `  ⚠️ ${f.id.padEnd(34)} ${f.說明}`),
          l.length > 12 ? `     …還有 ${l.length - 12} 顆` : '',
          '',
        ]
      }),
    ])
    expect(true).toBe(true)
  })

  it('★ 棘輪：五項都只准下降，上升時指名', () => {
    // ⚠️ **棘輪不是硬性零**（`build-guardrail` 第 6.8 步）：
    // 「留一筆還成立嗎」→ 不成立，命名一致是全有全無的。
    // 「修法貴不貴」→ **貴**，每一筆都是改名，而改名要動遍全樹（D 花了十輪）。
    // → 大量既有違規 ＋ 修法昂貴 = 棘輪，慢慢還。**G 完成時再收硬性零。**
    const 分項 = Object.fromEntries(
      (['接收者參數名', '操作詞不在詞彙', '裸的函式庫名', '修飾詞站主體位', '主體不在前', '殘留 lang: scope'] as 違規類[])
        .map((k) => [k, 依類(k)]),
    ) as Record<違規類, Finding[]>
    const current = { guard: 'naming', 分項 }
    if (process.env.GENERATE_BASELINE) {
      writeBaseline('naming', current)
      return
    }
    const base = loadBaseline<typeof current>('naming')
    for (const [k, list] of Object.entries(分項) as [違規類, Finding[]][]) {
      const added = newItems(list, base.分項[k] ?? [], (f) => f.id)
      expect(added.map((f) => `${f.id}：${f.說明}`), `【${k}】新增了違規——命名退步了。`).toEqual([])
    }
    assertRatchet(
      (Object.keys(分項) as 違規類[]).map((k) => [k, 分項[k].length, (base.分項[k] ?? []).length] as [string, number, number]),
    )
  })
})
