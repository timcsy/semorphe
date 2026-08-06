/**
 * 從元件定義合成最小語義節點（完備性護欄用）
 *
 * ## 為什麼合成而不手寫樣本
 *
 * 175 個元件手寫樣本 = 175 份新的維護負擔，而且**新增元件時會忘記補**——
 * 那正是本功能要治的病。合成能保證覆蓋率 100%（spec SC-003 要求無元件被
 * 靜默略過）。
 *
 * `ConceptDefJSON` 已經有 `properties`、`children`、`role`，足以合成。
 *
 * 見 specs/049-audit-guardrails/research.md D6
 */
import { createNode } from '../../src/core/semantic-tree'
import type { ConceptDefJSON, SemanticNode, PropertyValue } from '../../src/core/types'

/** 屬性名 → 合理的預設值。合成只要「跑得動」，不要求語義正確。 */
function defaultFor(prop: string): PropertyValue {
  const p = prop.toLowerCase()
  if (/(^|_)(name|var|obj|target|func|label)($|_)/.test(p)) return 'x'
  if (/(^|_)(type|vartype|rettype)($|_)/.test(p)) return 'int'
  if (/(^|_)(op|operator)($|_)/.test(p)) return '+'
  if (/(^|_)(value|literal|text|str|msg)($|_)/.test(p)) return '1'
  if (/(^|_)(index|idx|pos|size|count|len|n)($|_)/.test(p)) return '0'
  if (/(^|_)(header|include|module)($|_)/.test(p)) return 'iostream'
  return 'x'
}

/** 子槽宣告的型別 → 一個最小的填充節點 */
function fillerFor(slotType: string): SemanticNode {
  const t = (slotType || '').toLowerCase()
  if (t.includes('statement') || t.includes('body') || t.includes('block')) {
    return createNode('var_declare', { name: 'x', type: 'int' })
  }
  return createNode('number_literal', { value: '1' })
}

export interface SynthResult {
  node: SemanticNode
  /** 合成過程中遇到的問題（不影響回傳，但會列進報表） */
  notes: string[]
}

/**
 * 合成一個最小節點：properties 填預設、children 每個具名槽填一個最小子節點。
 */
export function synthMinimalNode(def: ConceptDefJSON): SynthResult {
  const notes: string[] = []

  const properties: Record<string, PropertyValue> = {}
  for (const p of def.properties ?? []) properties[p] = defaultFor(p)

  const children: Record<string, SemanticNode[]> = {}
  for (const [slot, slotType] of Object.entries(def.children ?? {})) {
    try {
      children[slot] = [fillerFor(String(slotType))]
    } catch {
      notes.push(`子槽 ${slot} 無法合成填充節點`)
    }
  }

  return { node: createNode(def.conceptId, properties, children), notes }
}

/** 判斷一段程式碼是不是「佔位輸出」——空字串、只有空白、或只剩分號 */
export function isPlaceholderOutput(code: string): boolean {
  const t = code.trim()
  if (t === '') return true
  if (/^;+$/.test(t)) return true
  // 常見的未實作佔位
  if (/^(\/\*\s*)?(TODO|NOT_IMPLEMENTED|UNSUPPORTED|unresolved)/i.test(t)) return true
  return false
}

/**
 * 判斷一個 executor 是不是「空操作」——函式體剝掉空白與註解後是空的。
 *
 * 這是「殼」判定的關鍵：`async () => {}` 是空操作。它**可能是對的**
 * （宣告性概念本來就不執行），也**可能是缺的**——兩者長得一模一樣，
 * 所以要求正確的那個用 `skipPaths` 出聲。見 knowledge/concepts/執行機構.md
 */
export function isNoopExecutor(fn: unknown): boolean {
  if (typeof fn !== 'function') return false
  const src = fn.toString()
  // 剝掉註解
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  // 箭頭函式：=> {} 或 => { }
  if (/=>\s*\{\s*\}\s*$/.test(stripped.trim())) return true
  // 一般函式：最後的 {} 是空的
  if (/\{\s*\}\s*$/.test(stripped.trim()) && !/\breturn\b|\bawait\b|\bctx\b/.test(stripped)) return true
  return false
}
