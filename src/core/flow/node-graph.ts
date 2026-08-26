/**
 * 語義樹 → **節點圖**（節點＋接點＋接線）。
 *
 * ## 為什麼不是傳統的流程圖
 *
 * 第一版做成了教科書那種流程圖（矩形、菱形、往下的箭頭）。使用者當場否掉：
 *
 * > 「我要的比較像是 **Node 然後有 Flow 可以接線可以呈現資料流**的那種，
 * > **不是傳統意義上的『Flow Chart』**。」
 *
 * 差別不在畫風，在**誰是節點**：
 *
 * ```
 * 流程圖   一個語句一格，「x > 3」是格子裡的字
 * 節點圖   「>」自己是一個節點，左右兩條線接進來——資料流看得見
 * ```
 *
 * 而語義樹本來就是後者的形狀（`compare` 有 `left`／`right` 兩個子槽）。
 * **流程圖要把那個結構壓平成一行字，節點圖不用。**
 *
 * > **投影不該把真實壓扁成它自己的形狀——那樣它投的是自己。**
 *
 * ## 兩種線，兩種接點——而分界是宣告出來的
 *
 * | 子槽宣告的種類 | 變成什麼 |
 * |---|---|
 * | `statements`／`statement` | **執行接點**（哪一串語句從這裡跑） |
 * | 其他（`expression`…） | **資料接點**（這個位置要一個值） |
 *
 * 視圖不判斷「哪個插槽是條件」——它問膠囊（`slotsOf`）。P9 的硬零因此成立。
 */
import type { SemanticNode } from '../types'
import { slotsOf, roleOf } from '../component/traits'
import { annotationOf } from '../skip-declarations'
import { flowTitle, flowSlotName, flowValue, type FlowLabelSource } from './vocabulary'

export type PortKind = 'exec' | 'data'

/**
 * 這顆的執行是什麼形狀——**膠囊自己宣告的**（`annotations.control_flow`）。
 *
 * ⚠️ 節點圖用它替**執行接點分色**：迴圈的身體出口與分支的兩臂，
 * 在圖上不該長得一模一樣。認不得的回 `undefined`——**不猜**。
 */
export type FlowKind = 'branch' | 'loop' | 'sequence'

const FLOW_KINDS: string[] = ['branch', 'loop', 'sequence']

function flowKindOf(componentId: string): FlowKind | undefined {
  const raw = annotationOf(componentId, 'control_flow')
  return typeof raw === 'string' && FLOW_KINDS.includes(raw) ? (raw as FlowKind) : undefined
}

export interface GraphPort {
  key: string
  /** 設計過的位置名；`null` ＝ 沒設計過，**不畫名字**。⚠️ `__in__` 這種內部接點一律 `null`。 */
  label: string | null
  kind: PortKind
  side: 'in' | 'out'
  /** 執行出口才有：它通往的是分支的一臂、迴圈的身體，還是一段順序 */
  flow?: FlowKind
  /** 相對節點左上角的位置——**節點被拖走時接點跟著走** */
  dx: number
  dy: number
}

export interface GraphNode {
  id: string
  componentId: string
  /**
   * 節點標頭——**設計過的名字**，否則退到積木那句話（插槽換成「…」）。
   * 🔴 兩個都沒有時是 `null`：**畫一個沒有標題的盒子，而不是把身分印上去**
   * （2026-08-26，第七十八條護欄）。
   */
  title: string | null
  /** 這顆宣告的執行形狀（沒宣告就是 `undefined`——**不補預設值**） */
  flow?: FlowKind
  /**
   * 節點身上的欄位（宣告的 `properties`）。
   *
   * `label` 是**設計過的位置名**；`null` ＝ 還沒設計過，**這一列只顯示值**
   * ——因為一個插槽在積木上根本沒有名字（它是句子裡的一個空格），
   * 硬要顯示只能顯示 `initializer`，那就是代號。
   *
   * `value` 是**顯示文字**：下拉的話已經換成積木上那一格的字（`FALSE` → 「到（不含）」）。
   */
  fields: { key: string; label: string | null; value: string }[]
  ports: GraphPort[]
  w: number
  h: number
  /** 排版填的絕對位置 */
  x: number
  y: number
}

export interface GraphWire {
  from: { node: string; port: string }
  to: { node: string; port: string }
  kind: PortKind
}

export interface NodeGraph {
  nodes: GraphNode[]
  wires: GraphWire[]
  width: number
  height: number
}

export const NODE_W = 168
const HEADER_H = 26
const ROW_H = 20
const PAD_Y = 8
const GAP_X = 46
const GAP_Y = 18
const INDENT = 40
/** 執行接點在標頭那一列，資料接點從標頭下面排起 */
const EXEC_DY = HEADER_H / 2

interface Built {
  node: GraphNode
  /** 這顆的資料來源（要畫在左邊的那些子樹） */
  sources: Built[]
  /** 執行子串：每個執行接點一串 */
  bodies: { port: string; nodes: Built[] }[]
}

/** 一個節點的高度由它的列數決定——接點與欄位各佔一列 */
function heightOf(rows: number): number {
  return HEADER_H + Math.max(rows, 1) * ROW_H + PAD_Y
}

function build(node: SemanticNode, labels?: FlowLabelSource): Built {
  const slots = slotsOf(node.componentId)
  const fields = Object.entries(node.properties ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, v]) => ({
      key,
      label: flowSlotName(node.componentId, key),
      value: flowValue(node.componentId, key, String(v), labels),
    }))

  const dataSlots = slots.filter((s) => !s.isBody)
  const bodySlots = slots.filter((s) => s.isBody)

  const ports: GraphPort[] = []
  // 語句才有執行接點。**表達式沒有**——它不「被執行到」，它被取值。
  const isStatement = roleOf(node.componentId) !== 'expression'
  if (isStatement) {
    ports.push({ key: '__in__', label: null, kind: 'exec', side: 'in', dx: 0, dy: EXEC_DY })
    ports.push({ key: '__next__', label: null, kind: 'exec', side: 'out', dx: NODE_W, dy: EXEC_DY })
  } else {
    ports.push({ key: '__out__', label: null, kind: 'data', side: 'out', dx: NODE_W, dy: EXEC_DY })
  }

  let row = 0
  const sources: Built[] = []
  for (const s of dataSlots) {
    const kids = node.children[s.slot] ?? []
    // ⚠️ 一個子槽可能裝**好幾個**值（`print` 的 `values`）——每一個各自一個接點，
    //    不是把它們併成一條線。併起來的話「第二個引數是誰」在圖上就消失了。
    if (kids.length === 0) continue
    kids.forEach((kid, i) => {
      const key = kids.length > 1 ? `${s.slot}[${i}]` : s.slot
      // ⚠️ 一個子槽裝好幾個值時鍵是 `values[0]`，而**名字問的是子槽本身**
      //    ——`values[0]` 不是一個詞彙，`values` 才是。
      ports.push({
        key,
        label: flowSlotName(node.componentId, s.slot),
        kind: 'data', side: 'in', dx: 0, dy: HEADER_H + row * ROW_H + ROW_H / 2,
      })
      row++
      sources.push(build(kid, labels))
    })
  }
  const fieldRows = fields.length
  // ⚠️ **空的插槽不長接點**——與資料接點同一條規則。
  // `python:if` 宣告了三個身體（`body`／`elif_body`／`else_body`），
  // 而一段沒有 elif 的程式若照樣長出那個接點，圖上會多一個**永遠沒有線的洞**。
  // 🔴 這與「節點編輯器都把接點畫滿」不同，理由是**這張圖是導出的，不是接出來的**：
  //    使用者不會去接那個接點，它只會是雜訊。
  const bodies = bodySlots
    .map((s) => ({ port: s.slot, nodes: (node.children[s.slot] ?? []).map((k) => build(k, labels)) }))
    .filter((b) => b.nodes.length > 0)
  const flow = flowKindOf(node.componentId)
  for (const b of bodies) {
    ports.push({
      key: b.port,
      label: flowSlotName(node.componentId, b.port),
      kind: 'exec',
      side: 'out',
      flow,
      dx: NODE_W,
      dy: HEADER_H + (row + fieldRows) * ROW_H + ROW_H / 2,
    })
    row++
  }

  return {
    node: {
      id: node.id,
      componentId: node.componentId,
      title: flowTitle(node.componentId, labels),
      flow,
      fields,
      ports,
      w: NODE_W,
      h: heightOf(row + fieldRows),
      x: 0,
      y: 0,
    },
    sources,
    bodies,
  }
}

// ─── 排版 ────────────────────────────────────────────────────────────────
//
// **執行往下走，資料從左邊進來。**
// ⚠️ 這是純函式：吃樹、吐座標。使用者拖過的位移不進來（那是面板的私有狀態）。

/** 一棵資料子樹的尺寸：自己在最右邊，來源疊在左邊 */
function measure(b: Built): { w: number; h: number } {
  if (b.sources.length === 0) return { w: b.node.w, h: b.node.h }
  const subs = b.sources.map(measure)
  const subW = Math.max(...subs.map((s) => s.w))
  const subH = subs.reduce((a, s) => a + s.h, 0) + GAP_Y * (subs.length - 1)
  return { w: subW + GAP_X + b.node.w, h: Math.max(subH, b.node.h) }
}

/** 把一棵資料子樹放好：`right` 是這顆自己的右緣，`top` 是整棵的上緣 */
function placeData(b: Built, right: number, top: number, out: GraphNode[]): void {
  const size = measure(b)
  b.node.x = right - b.node.w
  b.node.y = top + (size.h - b.node.h) / 2
  out.push(b.node)
  let y = top
  for (const s of b.sources) {
    const sz = measure(s)
    placeData(s, right - b.node.w - GAP_X, y, out)
    y += sz.h + GAP_Y
  }
}

interface Cursor { y: number; maxRight: number }

function placeStatements(list: Built[], left: number, cur: Cursor, out: GraphNode[], wires: GraphWire[]): void {
  let prev: Built | null = null
  for (const b of list) {
    const size = measure(b)
    placeData(b, left + size.w, cur.y, out)
    cur.maxRight = Math.max(cur.maxRight, left + size.w)
    cur.y += size.h + GAP_Y

    for (const s of b.sources) collectDataWires(s, b, wires)
    if (prev) wires.push({ from: { node: prev.node.id, port: '__next__' }, to: { node: b.node.id, port: '__in__' }, kind: 'exec' })
    prev = b

    for (const body of b.bodies) {
      if (body.nodes.length === 0) continue
      wires.push({ from: { node: b.node.id, port: body.port }, to: { node: body.nodes[0].node.id, port: '__in__' }, kind: 'exec' })
      placeStatements(body.nodes, left + INDENT, cur, out, wires)
    }
  }
}

/** 資料線：每個來源的輸出 → 消費者的那個接點 */
function collectDataWires(src: Built, consumer: Built, wires: GraphWire[]): void {
  const port = consumer.node.ports.filter((p) => p.kind === 'data' && p.side === 'in')[consumer.sources.indexOf(src)]
  if (port) wires.push({ from: { node: src.node.id, port: '__out__' }, to: { node: consumer.node.id, port: port.key }, kind: 'data' })
  for (const s of src.sources) collectDataWires(s, src, wires)
}

/**
 * 一串語句 → 一張節點圖。
 *
 * `labels` 是**問積木那張表**的埠（標題的退路、下拉的顯示文字）——
 * 沒接的宿主拿到的是「沒有標題的盒子 ＋ 只有值的欄位」，
 * 🔴 **而不是一個印著 `func_def` 的盒子**（第七十八條護欄）。
 */
export function buildNodeGraph(statements: SemanticNode[], labels?: FlowLabelSource): NodeGraph {
  const built = statements.map((n) => build(n, labels))
  const nodes: GraphNode[] = []
  const wires: GraphWire[] = []
  const cur: Cursor = { y: 0, maxRight: 0 }
  placeStatements(built, 0, cur, nodes, wires)
  const width = nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.x + n.w))
  const height = nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.y + n.h))
  return { nodes, wires, width, height }
}
