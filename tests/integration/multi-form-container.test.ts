/**
 * 多形態的第一個真實案例：容器操作（specs/097-multi-form-projection）
 *
 * ## 這個檔案存在的理由是一句學生說的話
 *
 * > 「stack 和 queue 的 push 意思不一樣，所以積木寫錯了。」
 *
 * 查證後**兩邊都對，但對在不同的層**：執行器完全不分支（`arr.value.push(val)`，
 * stack 與 queue 走同一行）→ 身分是對的；而標籤 `"Push %2 onto %1"` 的 `onto`
 * 字面就是堆疊語義 → **形態說謊了**。
 *
 * **十八條護欄一條都不會叫**：執行測試綠、來回轉換綠、五路完備綠。
 * 而使用者第一眼就看出來。見 `knowledge/episodes/2026-08-07-學生說積木寫錯了.md`。
 *
 * ## 這裡驗的東西，有一格機器驗不到
 *
 * SC-001 要求「**不看 tooltip**」——tooltip 大多是對的，MSG0 才是說謊的地方，
 * 而 MSG0 是學生一邊拼一邊讀的那句。所以下面驗的是 **MSG0 對應的字串**。
 * 但「讀了之後知不知道 pop 會拿到什麼」只有人驗得到，見 quickstart 的手動那一格。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { setupTestRenderer, clearTestRenderer } from '../helpers/setup-renderer'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
// ⚠️ **不要自己列宣告來源**（第三十七條護欄）。這裡原本只讀 `core`，
// 而 `cpp:container_push` 2026-08-11 進了膠囊——症狀是「積木文字是空的」
// 與「舊積木型別註冊不到」，看起來像形態機制壞了。
import { allCppConcepts, allCppProjections } from '../../src/languages/cpp/all-declarations'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import zhTW from '../../src/i18n/zh-TW/blocks.json'
// 膠囊自帶的標籤——搬進膠囊的元件其 MSG0 不在共用 i18n 檔裡了。
import { componentLabels } from '../../src/core/component/labels'

let treeParser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  treeParser = new Parser()
  treeParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
  setupTestRenderer()
})

afterAll(() => clearTestRenderer())

const PRELUDE = '#include <iostream>\n#include <stack>\n#include <queue>\nusing namespace std;\n'

function lift(body: string): SemanticNode {
  const tree = treeParser.parse(`${PRELUDE}int main(){ ${body} return 0; }`)
  if (!tree) throw new Error('parse 失敗')
  return createTestLifter().lift(tree.rootNode as never) as SemanticNode
}

function collect(node: SemanticNode, pred: (n: SemanticNode) => boolean): SemanticNode[] {
  const out: SemanticNode[] = []
  const walk = (n: SemanticNode): void => {
    if (!n) return
    if (pred(n)) out.push(n)
    for (const list of Object.values(n.children ?? {})) for (const c of list ?? []) walk(c as SemanticNode)
  }
  walk(node)
  return out
}

/** 蒐集渲染出來的所有積木型別 */
function blockTypes(tree: SemanticNode): string[] {
  const state = renderToBlocklyState(tree) as { blocks?: { blocks?: unknown[] } }
  const out: string[] = []
  const walk = (b: unknown): void => {
    if (!b || typeof b !== 'object') return
    const blk = b as { type?: string; inputs?: Record<string, { block?: unknown }>; next?: { block?: unknown } }
    if (blk.type) out.push(blk.type)
    for (const v of Object.values(blk.inputs ?? {})) walk(v?.block)
    walk(blk.next?.block)
  }
  for (const b of state.blocks?.blocks ?? []) walk(b)
  return out
}

/** 積木型別 → 它的 MSG0 字串（**不是 tooltip**） */
function msg0(blockType: string): string {
  const reg = new BlockSpecRegistry()
  reg.loadFromSplit(allCppConcepts(), allCppProjections())
  const spec = reg.getByBlockType(blockType)
  const raw = (spec?.blockDef as Record<string, unknown> | undefined)?.message0 as string | undefined
  if (!raw) return ''
  const key = /^%\{BKY_(\w+)\}$/.exec(raw)?.[1]
  const allLabels = { ...(zhTW as Record<string, string>), ...componentLabels('zh-TW') }
  return key ? (allLabels[key] ?? '') : raw
}

const stackProgram = 'stack<int> st; st.push(1); st.pop();'
const queueProgram = 'queue<int> q; q.push(1); q.pop();'

// ─── 辨識側：容器種類寫進節點（CK-1）────────────────────────────────

describe('辨識：容器種類寫進節點', () => {
  it('★ 堆疊上的 push 帶 container_kind: stack', () => {
    const pushes = collect(lift(stackProgram), (n) => n.conceptId === 'cpp:container_push')
    expect(pushes).toHaveLength(1)
    expect(pushes[0].properties?.container_kind).toBe('stack')
  })

  it('★ 佇列上的 push 帶 container_kind: queue', () => {
    const pushes = collect(lift(queueProgram), (n) => n.conceptId === 'cpp:container_push')
    expect(pushes[0].properties?.container_kind).toBe('queue')
  })

  it('★ pop 同樣帶容器種類', () => {
    expect(collect(lift(stackProgram), (n) => n.conceptId === 'cpp:container_pop')[0].properties?.container_kind).toBe('stack')
    expect(collect(lift(queueProgram), (n) => n.conceptId === 'cpp:container_pop')[0].properties?.container_kind).toBe('queue')
  })

  it('★ 負向（CK-1）：查不到型別時**不寫**該屬性，不猜', () => {
    // `unknownThing` 沒有宣告 → 辨識脈絡查不到型別
    const pushes = collect(lift('unknownThing.push(1);'), (n) => n.conceptId === 'cpp:container_push')
    expect(pushes).toHaveLength(1)
    expect(
      pushes[0].properties?.container_kind,
      '猜一個容器種類會讓積木顯示錯的位置——比中性標籤更糟',
    ).toBeUndefined()
  })
})

// ─── 投影側：學生看得到的那件事（SC-001）──────────────────────────

describe('投影：積木文字說出元素跑到哪裡', () => {
  it('★ 堆疊的 push 積木文字提到「頂端」', () => {
    const types = blockTypes(lift(stackProgram))
    const pushType = types.find((t) => t.includes('push'))
    expect(pushType, `渲染出來的積木型別：${types.join('、')}`).toBeDefined()
    expect(msg0(pushType!), '學生讀的是 MSG0，不是 tooltip').toContain('頂端')
  })

  it('★ 佇列的 push 積木文字提到「尾端」', () => {
    const types = blockTypes(lift(queueProgram))
    const pushType = types.find((t) => t.includes('push'))
    expect(msg0(pushType!)).toContain('尾端')
  })

  it('★ 兩者是**不同的積木型別**', () => {
    const s = blockTypes(lift(stackProgram)).find((t) => t.includes('push'))
    const q = blockTypes(lift(queueProgram)).find((t) => t.includes('push'))
    expect(s).not.toBe(q)
  })

  it('★ 負向（FR-007）：容器種類未知時用中性形態，且**不宣稱位置**', () => {
    const t = blockTypes(lift('unknownThing.push(1);')).find((x) => x.includes('push'))
    const text = msg0(t!)
    expect(text).not.toContain('頂端')
    expect(text).not.toContain('尾端')
  })
})

// ─── 形態是投影：產出與行為必須相同（C-3）─────────────────────────

describe('C-3 兩個形態產出相同、行為相同', () => {
  it('★ 產出的 C++ 都是 .push(...)', () => {
    expect(generateCode(lift(stackProgram), 'cpp', apcs as never)).toContain('st.push(1);')
    expect(generateCode(lift(queueProgram), 'cpp', apcs as never)).toContain('q.push(1);')
  })

  it('★ 執行結果由容器決定，不由形態決定', async () => {
    const run = async (tree: SemanticNode): Promise<string> => {
      const i = new SemanticInterpreter({ maxSteps: 50000 })
      await i.execute(tree)
      return i.getOutput().join('')
    }
    // 堆疊 LIFO：推 1、2 之後 top 是 2
    const stack = lift('stack<int> st; st.push(1); st.push(2); cout << st.top();')
    // 佇列 FIFO：推 1、2 之後 front 是 1
    const queue = lift('queue<int> q; q.push(1); q.push(2); cout << q.front();')
    expect(await run(stack)).toBe('2')
    expect(await run(queue)).toBe('1')
  })

  it('★ CK-3：執行器 MUST NOT 讀 container_kind——改成錯的值，行為不變', async () => {
    const run = async (kind: string | undefined): Promise<string> => {
      const props: Record<string, string> = { obj: 's' }
      if (kind !== undefined) props.container_kind = kind
      const tree = createNode('cpp:program', {}, {
        body: [
          createNode('cpp:stack_declare', { name: 's', type: 'int' }, {}),
          createNode('cpp:container_push', { ...props }, { value: [createNode('cpp:literal_number', { value: '1' }, {})] }),
          createNode('cpp:container_push', { ...props }, { value: [createNode('cpp:literal_number', { value: '2' }, {})] }),
          createNode('cpp:print', {}, { values: [createNode('cpp:stack_peek', { obj: 's' }, {})] }),
        ],
      })
      const i = new SemanticInterpreter({ maxSteps: 50000 })
      await i.execute(tree)
      return i.getOutput().join('')
    }
    const correct = await run('stack')
    expect(await run('queue'), '執行器讀了 container_kind → 形態污染了行為').toBe(correct)
    expect(await run(undefined)).toBe(correct)
  })
})

// ─── 加法式的保證（T007–T009，取代原本的存檔轉換）──────────────────

describe('加法式：舊存檔不會壞', () => {
  it('★ 舊的積木型別 cpp_container_push **仍然註冊得到**', () => {
    // 這是加法式的核心保證。**一旦有人手癢把它改名，這支就紅**——
    // 而改名會讓每一份既有存檔裡的那顆積木變成不認得的型別。
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppConcepts(), allCppProjections())
    expect(reg.getByBlockType('cpp_container_push')).toBeDefined()
    expect(reg.getByBlockType('cpp_container_pop')).toBeDefined()
  })

  it('★ 舊積木型別反推得到同一個 conceptId（C-4）', () => {
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppConcepts(), allCppProjections())
    const neutral = reg.getByBlockType('cpp_container_push')?.conceptMapping?.conceptId
    const stack = reg.getByBlockType('cpp_container_push_stack')?.conceptMapping?.conceptId
    const queue = reg.getByBlockType('cpp_container_push_queue')?.conceptMapping?.conceptId
    expect(neutral).toBe('cpp:container_push')
    expect(stack).toBe('cpp:container_push')
    expect(queue).toBe('cpp:container_push')
  })

  it('★ 自癒：舊存檔重新渲染後升級成新形態', () => {
    // `sync-controller.ts` 的任何編輯都會走 `renderToBlocklyState`。
    // 所以帶著中性積木的舊專案，第一次編輯就會拿到說得清楚的那顆。
    const types = blockTypes(lift(stackProgram))
    expect(types.some((t) => t === 'cpp_container_push_stack'), '重新渲染沒有升級 → 自癒那條路斷了').toBe(true)
  })
})

// ─── 工具箱：學生找得到嗎（一名學生實際問的問題）──────────────────

describe('工具箱放的是形態，不是退路', () => {
  // ⚠️ 這兩支原本讀的是 `cppCategoryDefs` 的 `extraTypes` **宣告清單**。
  // 100（E 項）把歸屬改成導出之後那份清單不再存在，而更重要的是：
  // **讀宣告永遠回答不了「學生看不看得到」**——中間還隔著一個建構器，
  // 而那個建構器真的吃掉過三顆積木（`buildIoContents` 的前綴分堆）。
  // 改成看**真正建出來的工具箱**。
  it('★ 四顆變體都在工具箱裡——學生找得到', async () => {
    const { loadToolbox } = await import('../helpers/toolbox')
    const { categoriesOf } = loadToolbox()
    for (const t of ['cpp_container_push_stack', 'cpp_container_push_queue', 'cpp_container_pop_stack', 'cpp_container_pop_queue']) {
      expect(categoriesOf.has(t), `${t} 不在工具箱 → 學生只能拖中性版出來、接上變數、等它自己變`).toBe(true)
    }
  })

  it('★ 中性版**不在**工具箱——它是型別查不到時的退路，不是一個選項', async () => {
    const { loadToolbox } = await import('../helpers/toolbox')
    const { categoriesOf } = loadToolbox()
    expect(categoriesOf.has('cpp_container_push'), '放著只會變成三顆很像的積木').toBe(false)
    expect(categoriesOf.has('cpp_container_pop')).toBe(false)
  })

  it('★ 預設變數名用 stk／que，沿用本分類既有的慣例', async () => {
    const { BlockSpecRegistry } = await import('../../src/core/block-spec-registry')
    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppConcepts(), allCppProjections())
    const objDefault = (bt: string): string | undefined => {
      const args = ((reg.getByBlockType(bt)?.blockDef as Record<string, unknown>)?.args0 ?? []) as { name?: string; text?: string }[]
      return args.find((a) => a.name === 'OBJ')?.text
    }
    expect(objDefault('cpp_container_push_stack')).toBe('stk')
    expect(objDefault('cpp_container_push_queue')).toBe('que')
  })
})
