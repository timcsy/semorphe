/**
 * 通用積木與概念的**唯一入口**（已蓋上 owner 章）
 *
 * 在此之前 `universal-blocks.json` 被三個地方各自直接 import。要讓工具箱知道
 * 一顆積木是誰宣告的，蓋章必須發生在**一個**地方——三個地方各蓋一次就是
 * 三份會漂移的真相，而漏掉的那一份會讓那些積木在工具箱裡靜靜消失。
 */
import type { ConceptDefJSON, BlockProjectionJSON } from '../core/types'
import _concepts from './semantics/universal-concepts.json'
import _blocks from './projections/blocks/universal-blocks.json'

/** 通用積木的 owner 標記——與 std 模組的 header 同一個名字空間 */
export const UNIVERSAL_OWNER = '(universal)'

export const universalConcepts = _concepts as unknown as ConceptDefJSON[]

export const universalBlocks: BlockProjectionJSON[] = (
  _blocks as unknown as BlockProjectionJSON[]
).map((b) => ({ ...b, owner: UNIVERSAL_OWNER }))
