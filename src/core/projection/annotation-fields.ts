/**
 * **標頭註解的欄位化**（2026-08-23）——`annotationFields` 這個宣告的兩端。
 *
 * 🔴 **它取代的是什麼**：在這之前，`if a:  # 為什麼` 的註解只住在
 * `extraState.annotations` 裡——**積木上看不到、點不到、改不掉**，
 * 而它是使用者親手打的字。來回轉換保得住它，可是使用者**不知道它還在**。
 *
 * > **使用者打的字要有一個看得到的家。**
 *
 * ⚠️ 這一層**不取代** `extraState` 那一條——沒有宣告欄位的 slot
 * （`for`／`while`／`class` 的標頭）照舊走 `extraState`。
 * 兩條同時在，**而有欄位的那一格贏**：欄位是使用者改得動的那一份。
 */
import type { Annotation, RenderMapping, SemanticNode } from '../types'
import type { BlockState } from './pattern-extractor'

/**
 * 🔴 **一個固定的 extraState 鍵**，而不是再開一個宣告欄位。
 *
 * 理由：`ELIF_NOTE_2` 這種欄位是 mutator 長出來的，而 Blockly 的載入順序是
 * **`loadExtraState` 先、欄位後**——註解要被寫進去，那一格必須先存在。
 * 所以渲染那一路填欄位時**必須同時掀開這個旗標**。
 */
export const SHOW_NOTES_KEY = 'showNotes'

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `elif:{i}` → /^elif:(\d+)$/；沒有 `{i}` 的就是死字串。 */
const patternRegex = (p: string): RegExp =>
  new RegExp(`^${p.split('{i}').map(escape).join('(\\d+)')}$`)

const fill = (p: string, i: string | undefined): string =>
  i === undefined ? p : p.replace('{i}', i)

/** 渲染：把 `node.annotations` 裡有 slot 的那些寫進對應欄位。 */
export function fillAnnotationFields(
  mapping: RenderMapping,
  node: SemanticNode,
  block: BlockState,
): void {
  const decl = mapping.annotationFields
  if (!decl) return
  let wrote = false
  for (const a of node.annotations ?? []) {
    if (a.type !== 'comment' || !a.slot) continue
    for (const [fieldPattern, slotPattern] of Object.entries(decl)) {
      const m = patternRegex(slotPattern).exec(a.slot)
      if (!m) continue
      block.fields[fill(fieldPattern, m[1])] = a.text
      wrote = true
      break
    }
  }
  if (wrote) block.extraState = { ...block.extraState, [SHOW_NOTES_KEY]: true }
}

/**
 * 擷取：把欄位讀回標註。
 *
 * 🔴 **宣告了欄位的積木，它的【所有】有 slot 的標註都由欄位說了算**
 * ——包含「一格都沒填」。回傳的 `owns` 就是這個意思。
 *
 * ⚠️ 否則會出現這個 bug：使用者在齒輪裡關掉「顯示註解」（＝刪掉那些字），
 * 而 `extraState` 裡上一輪渲染留下的那份**把它們原封不動地長回來**。
 * **一個刪不掉的東西，比一個看不見的東西更糟。**
 *
 * 代價寫在這裡：**宣告 `annotationFields` 的元件必須把自己會產生的 slot 全部宣告**，
 * 漏一個 = 那一種註解在這顆積木上會被丟掉。
 */
export function readAnnotationFields(
  mapping: RenderMapping,
  block: BlockState,
): { annotations: Annotation[]; owns: boolean } {
  const annotations: Annotation[] = []
  const decl = mapping.annotationFields
  if (!decl) return { annotations, owns: false }
  for (const [fieldPattern, slotPattern] of Object.entries(decl)) {
    const rx = patternRegex(fieldPattern)
    for (const [name, value] of Object.entries(block.fields ?? {})) {
      const m = rx.exec(name)
      if (!m) continue
      const text = String(value ?? '').trim()
      if (text) annotations.push({ type: 'comment', text, position: 'inline', slot: fill(slotPattern, m[1]) })
    }
  }
  return { annotations, owns: true }
}
