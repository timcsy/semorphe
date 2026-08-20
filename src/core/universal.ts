/**
 * 通用積木與概念的**唯一入口**（已蓋上 owner 章）
 *
 * 在此之前 `universal-blocks.json` 被三個地方各自直接 import。要讓工具箱知道
 * 一顆積木是誰宣告的，蓋章必須發生在**一個**地方——三個地方各蓋一次就是
 * 三份會漂移的真相，而漏掉的那一份會讓那些積木在工具箱裡靜靜消失。
 *
 * ## ⚠️ 而今天這兩個陣列都是**空的**（2026-08-12 查證）
 *
 * F 完成（177/177 膠囊化）之後，`universal-concepts.json` 與
 * `universal-blocks.json` 都是 `[]`。所以這個模組今天實際提供的只有
 * `UNIVERSAL_OWNER` 這個字串常數，而 29 處 import 展開的是兩個空陣列。
 *
 * > **一個「唯一入口」在它守的東西全部搬走之後，仍然是唯一入口
 * > ——只是入口後面沒有東西了。**
 *
 * **沒有在這次一併刪掉**，理由是這是一個搬移 spec（`specs/117`）——
 * **搬移不重寫**。而「要不要刪」是一個獨立問題：`UNIVERSAL_OWNER` 仍有消費者，
 * 而空陣列的展開移除是安全的但需要逐處確認。
 */
import type { ComponentDefJSON, BlockProjectionJSON } from '../core/types'
import _concepts from './universal-concepts.json'
import _blocks from './universal-blocks.json'

/** 通用積木的 owner 標記——與 std 模組的 header 同一個名字空間 */
export const UNIVERSAL_OWNER = '(universal)'

export const universalConcepts = _concepts as unknown as ComponentDefJSON[]

export const universalBlocks: BlockProjectionJSON[] = (
  _blocks as unknown as BlockProjectionJSON[]
).map((b) => ({ ...b, owner: UNIVERSAL_OWNER }))
