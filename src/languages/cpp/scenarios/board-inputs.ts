/**
 * **板子的時間序列輸入**（spec 218 US2）——Arduino 題目的情境：程式讀了哪些輸入腳，就替每一支產生幾條分得出讀法的輸入。
 *
 * 形狀與判決請求的 `boardInputs` 相同：`{ t: 毫秒, key: 'digital:2' | 'analog:A0', value }`（`@cella-lang/arduino` 的環境輸入）。
 * 按鈕題的兩種讀法（按一下切換 vs. 按住才亮）在「按下又放開」那一條才分得出——所以要有那一條。
 * 決定性：同一棵樹 → 同一批、同一個順序。沒讀任何腳 → 回空的（交給「沒有輸入」那一個種類跑一次）。
 */
import type { SemanticNode } from '../../../core/types'
import type { Scenario } from '../../../core/disambiguation/types'

export const BOARD_INPUTS_KIND = 'board-inputs'

type Event = { t: number; key: string; value: number }

function walk(n: SemanticNode | undefined, fn: (x: SemanticNode) => void): void {
  if (!n || typeof n !== 'object') return
  fn(n)
  for (const v of Object.values(n.slots ?? {})) for (const c of (Array.isArray(v) ? v : [v]) as SemanticNode[]) walk(c, fn)
}

/** 名字 → 腳位（`const int BTN = 2;` 被 lift 成腳位宣告或常數宣告；兩種都收） */
function pinNames(tree: SemanticNode): Map<string, string> {
  const m = new Map<string, string>()
  walk(tree, (n) => {
    const p = n.properties as Record<string, unknown> | undefined
    const name = typeof p?.name === 'string' ? p.name : ''
    if (!name) return
    if (typeof p?.pin === 'string' && p.pin !== '') { m.set(name, p.pin); return }
    const init = n.slots?.initializer?.[0]
    const v = init?.properties?.value
    if (typeof v === 'string' && /^(?:\d+|A\d+)$/.test(v)) m.set(name, v)
  })
  return m
}

function pinOf(n: SemanticNode | undefined, names: Map<string, string>): string | null {
  if (!n) return null
  const p = n.properties as Record<string, unknown>
  const v = typeof p?.value === 'string' ? p.value : typeof p?.name === 'string' ? (names.get(p.name) ?? p.name) : null
  return v && /^(?:\d+|A\d+)$/.test(v) ? v : null
}

/** 程式讀了哪些腳（照出現的順序、去重） */
export function readPins(tree: SemanticNode): { digital: string[]; analog: string[] } {
  const names = pinNames(tree)
  const digital: string[] = [], analog: string[] = []
  walk(tree, (n) => {
    const id = n.componentId ?? ''
    const pin = /:(digital_read|analog_read)$/.test(id) ? pinOf(n.slots?.pin?.[0], names) : null
    if (!pin) return
    const list = id.endsWith(':analog_read') ? analog : digital
    if (!list.includes(pin)) list.push(pin)
  })
  return { digital, analog }
}

export function boardInputScenarios(tree: SemanticNode): Scenario[] {
  const { digital, analog } = readPins(tree)
  const out: Scenario[] = []
  const mk = (events: Event[], label: string): Scenario => ({ kind: BOARD_INPUTS_KIND, payload: { events }, label })
  for (const pin of digital.slice(0, 2)) {
    const key = `digital:${pin}`
    out.push(
      mk([{ t: 0, key, value: 0 }], `腳 ${pin} 一直放開`),
      mk([{ t: 0, key, value: 1 }], `腳 ${pin} 一直按著`),
      mk([{ t: 0, key, value: 0 }, { t: 300, key, value: 1 }], `腳 ${pin} 在第 300 毫秒按下`),
      mk([{ t: 0, key, value: 0 }, { t: 300, key, value: 1 }, { t: 600, key, value: 0 }], `腳 ${pin} 按下又放開`),
      mk([{ t: 0, key, value: 0 }, { t: 300, key, value: 1 }, { t: 600, key, value: 0 }, { t: 900, key, value: 1 }, { t: 1200, key, value: 0 }], `腳 ${pin} 按兩下`),
    )
  }
  for (const pin of analog.slice(0, 2)) {
    const key = `analog:${pin}`
    out.push(
      mk([{ t: 0, key, value: 0 }], `${pin} 一直是 0`),
      mk([{ t: 0, key, value: 1023 }], `${pin} 一直是 1023`),
      mk([0, 200, 500, 800, 1023].map((value, i) => ({ t: i * 300, key, value })), `${pin} 一階一階升高`),
    )
  }
  return out
}
