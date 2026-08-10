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
import { paramSpecs } from '../../src/core/param-spec'
import type { ConceptDefJSON, SemanticNode, PropertyValue, ParamSpec, ParamKind } from '../../src/core/types'

/**
 * 概念 → 它的運算子該長什麼樣。
 *
 * **原本所有概念的 `operator` 都填 `'+'`**，於是 `compare` 產生 `1 + 1`、
 * `logic` 也產生 `1 + 1`——那不是比較也不是邏輯運算。完備性護欄的 lift 判定
 * 用「產生程式碼再辨識回來，身分還在嗎」，而**身分判定需要語義忠實的樣本**。
 *
 * 合成器原本的契約是「跑得動就好，不要求語義正確」——那對偵測「路徑存在嗎」
 * 是夠的，對「身分守得住嗎」不夠。**同一支工具被兩種要求用著。**
 *
 * 見 specs/057（完備性的殼有多少是量測造成的）
 */
const OPERATOR_FOR: Record<string, string> = {
  'cpp:compare': '<',
  'cpp:logic': '&&',
  'cpp:arithmetic': '+',
  'cpp:var_assign_compound': '+=',
  cpp_compound_assign_expr: '+=',
  'cpp:increment': '++',
  cpp_increment_expr: '++',
  cpp_bitwise: '&',
}

/**
 * `ParamKind` → 一個型別上正確的預設值。
 *
 * ⚠️ 這是**規格驅動**的路，優於底下 `defaultFor` 的名字正則猜測：
 * 猜測靠的是「叫 `type` 的大概是型別」，而規格是宣告出來的事實。
 * 規格化推進到哪，猜測就退到哪。
 */
const BY_KIND: Record<ParamKind, PropertyValue> = {
  identifier: 'x',
  type_expr: 'int',
  enum: 'x', // 沒有 values 時的保底；有 values 走下面第一個允許值
  literal: '1',
  count: '0',
}

/**
 * 一個參數的合成值。**規格優先，名字猜測墊底。**
 *
 * 順序有理由：`default`（產生器實際的退路，最貼近真實）→ `values[0]`
 * （enum 唯一保證合法的值）→ `kind` → 名字正則。
 */
function synthValue(sp: ParamSpec, conceptId?: string): PropertyValue {
  // ⚠️ **空字串不算可用的合成值。** `default: ''` 是誠實的（產生器的退路
  // 真的是空），而拿它去合成節點會產出 `var_ref` 沒有名字、`cpp_raw_code`
  // 沒有內容——完備性護欄當場多出七個假的「殼」。
  // 宣告的預設值回答「缺省時產出什麼」，合成器問的是「一個像樣的樣本長怎樣」。
  if (sp.default !== undefined && sp.default !== '') return sp.default
  if (sp.kind === 'enum' && sp.values?.length) return sp.values[0]
  if (sp.kind !== 'literal') return BY_KIND[sp.kind]
  return defaultFor(sp.name, conceptId)
}

/** 屬性名 → 合理的預設值。**未規格化的元件走這條**——靠名字猜。 */
function defaultFor(prop: string, conceptId?: string): PropertyValue {
  const p = prop.toLowerCase()
  if (/(^|_)(name|var|obj|target|func|label)($|_)/.test(p)) return 'x'
  if (/(^|_)(type|vartype|rettype)($|_)/.test(p)) return 'int'
  if (/(^|_)(op|operator)($|_)/.test(p)) return OPERATOR_FOR[conceptId ?? ''] ?? '+'
  if (/(^|_)(value|literal|text|str|msg)($|_)/.test(p)) return '1'
  if (/(^|_)(index|idx|pos|size|count|len|n)($|_)/.test(p)) return '0'
  if (/(^|_)(header|include|module)($|_)/.test(p)) return 'iostream'
  return 'x'
}

/** 子槽宣告的型別 → 一個最小的填充節點 */
function fillerFor(slotType: string): SemanticNode {
  const t = (slotType || '').toLowerCase()
  // ⚠️ **宣告指名了子節點型別時，就合成那個型別**——不要退回猜測。
  //
  // `params` 的子節點是 `param_decl`（結構節點，帶 `{type, name}`）。
  // 退回 `cpp:literal_number` 的話，合成出來的參數沒有型別也沒有名字，
  // 於是任何「參數走得過投影嗎」的判定都會拿到垃圾——`specs/105` 的符合性
  // 護欄就在這裡誤報過一次（`cpp:template_function`）。
  if (t === 'param_decl') return createNode('param_decl', { type: 'int', name: 'p' })
  if (t.includes('statement') || t.includes('body') || t.includes('block')) {
    return createNode('cpp:var_declare', { name: 'x', type: 'int' })
  }
  return createNode('cpp:literal_number', { value: '1' })
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
  // ⚠️ 已規格化的元件走 `synthValue`（讀宣告），其餘走 `defaultFor`（猜名字）。
  // `paramSpecs` 把純名字清單正規化成 `kind: 'literal'`，於是那條路自動落回猜測。
  for (const sp of paramSpecs(def.properties)) {
    properties[sp.name] = synthValue(sp, def.conceptId)
  }

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
