/**
 * `cpp:raw_code` 的 **lift** 路——**一個建構子，而不是一個判別**。
 *
 * ## ⚠️ 這顆不「認領」任何 AST 節點
 *
 * 它是**降級的落點**：共用檔判定「這段我看不懂」時，建一顆它。
 * 所以這裡沒有 `registerLift` 的內容——**判別屬於共用檔，建構屬於膠囊**。
 *
 * ## 🔴 而它為什麼存在（2026-08-17）
 *
 * 在此之前，共用檔直接寫 `createNode('cpp:raw_code', …)`
 * ——**身分字串出現在膠囊資料夾外**，而就近性護欄**兩個方向都報**。
 *
 * > **共用檔要用膠囊的東西時，呼叫它匯出的建構子
 * > ——身分字串只留在膠囊裡一處。**
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/** 建一顆「這段原始碼我看不懂」的節點。⚠️ 原文會**原樣產回去**（見 `generate.ts`）。 */
export function buildRawCode(code: string): SemanticNode {
  return createNode('cpp:raw_code', { code })
}

/** 這顆由共用檔**呼叫**建構子，不是被問判別。 */
export function registerLift(): void {}
