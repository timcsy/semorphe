/**
 * **改程式碼之後，手排的積木留在原位**（vision「暫停的代償」；前置是 spec 221 的身分沿用）。
 *
 * 程式碼重畫時，渲染器把最上層的敘述全部串成一條、放在固定位置——使用者拖開的那幾疊會被併回去。
 * 這裡用節點身分對回去：重畫前是一疊開頭的節點，重畫後還在最上層 ⟹ 在那裡斷開、放回原位。
 *
 * ⚠️ **位置不只是外觀**：積木轉回程式碼時，幾疊的先後由位置決定（Blockly 的 `getTopBlocks(true)`）。
 * 放回原位之後的先後如果與程式碼不同，下一次動積木就會默默改掉程式的順序 ⟹ 那種情況不套用，照舊併成一條（P6：不做會改掉意思的事）。
 */

export interface StackHead { nodeId: string; x: number; y: number }

interface BlockJson { id?: string; x?: number; y?: number; next?: { block?: BlockJson }; [k: string]: unknown }
interface StateJson { blocks?: { languageVersion?: number; blocks?: BlockJson[] }; [k: string]: unknown }

/** 同 Blockly 的 `getTopBlocks(true)`：y 為主，x 依掃描角（3 度）微調 */
const scanOf = (p: { x: number; y: number }): number => p.y + Math.sin((3 * Math.PI) / 180) * p.x

/**
 * @param heads 重畫前每一疊開頭的節點與位置，照掃描順序
 * @returns 套用之後的積木狀態；不必或不該套用時回傳 null（不動原本的物件）
 */
export function keepLayoutByIdentity(
  state: object, mappings: readonly { blockId: string; nodeId: string }[], heads: readonly StackHead[],
): object | null {
  const s = state as StateJson
  const first = s.blocks?.blocks?.[0]
  if (!first || heads.length === 0) return null
  const nodeOf = new Map(mappings.map((m) => [m.blockId, m.nodeId]))
  const place = new Map(heads.map((h) => [h.nodeId, h]))

  const chain: BlockJson[] = []
  for (let b: BlockJson | undefined = first; b; b = b.next?.block) chain.push(b)
  const starts = chain.map((_, i) => i).filter((i) => i > 0 && place.has(nodeOf.get(chain[i].id ?? '') ?? ''))

  // 第一疊：開頭還是原本的開頭就回原位；開頭換了（上面多了一行）就跟著最上面那一疊走
  const headPlace = place.get(nodeOf.get(first.id ?? '') ?? '') ?? heads[0]
  const positions = [headPlace, ...starts.map((i) => place.get(nodeOf.get(chain[i].id ?? '') ?? '')!)]
  if (starts.length === 0 && headPlace.x === first.x && headPlace.y === first.y) return null
  for (let i = 1; i < positions.length; i++) if (scanOf(positions[i - 1]) >= scanOf(positions[i])) return null

  // 複製一條鏈（事件帶的物件是別人也可能讀的），在開頭的地方斷開
  const stacks: BlockJson[] = []
  const bounds = [0, ...starts, chain.length]
  for (let k = 0; k + 1 < bounds.length; k++) {
    let tail: BlockJson | undefined
    for (let i = bounds[k + 1] - 1; i >= bounds[k]; i--) {
      const { next: _dropped, ...rest } = chain[i]
      tail = tail ? { ...rest, next: { block: tail } } : rest
    }
    stacks.push({ ...tail!, x: positions[k].x, y: positions[k].y })
  }
  const others = s.blocks!.blocks!.slice(1)
  return { ...s, blocks: { ...s.blocks, blocks: [...stacks, ...others] } }
}
