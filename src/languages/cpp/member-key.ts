/**
 * **類別成員與它在類別外的定義配對用的鍵**（第 322 刀，類別外定義成員函式）——類別裡的原型與類別外的定義用同一個寫法。
 *
 * 鍵 ＝ 名字 ＋ 參數型別串 ＋ 尾端 const：多載（`f(int)`／`f(double)`、`get()`／`get() const`）是不同的成員。
 * 參數名不進鍵（原型常不寫名字：`void link(B*);` 配 `void A::link(B* b)`）；型別的空白去掉（`B *` 與 `B*` 是同一個）。
 */
import type { SemanticNode } from '../../core/types'

export function memberKeyOf(n: SemanticNode): string {
  const types = (n.slots?.params ?? []).map((p) => String(p.properties?.type ?? '').replace(/\s+/g, ''))
  const isConst = String(n.properties?.is_const ?? 'false') === 'true'
  return `${String(n.properties?.name ?? '')}(${types.join(',')})${isConst ? 'const' : ''}`
}

/** 建構子的鍵：參數型別串（建構子沒有名字可分，多載靠參數）——類別裡的原型與類別外的定義同一個寫法 */
export function constructorKeyOf(n: SemanticNode): string {
  const types = (n.slots?.params ?? []).map((p) => String(p.properties?.type ?? '').replace(/\s+/g, ''))
  return `#constructor(${types.join(',')})`
}

/** 解構子的鍵：一個類別只有一個 */
export const DESTRUCTOR_KEY = '#destructor'
