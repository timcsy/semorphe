/**
 * `cpp:define_func` 的 **generate** 路
 *
 * ⚠️ **括號緊貼名字**——`#define rep(i,n)` 與 `#define rep (i,n)` 在 C 裡是
 * **兩個不同的東西**（後者是一個值為 `(i,n)` 的物件形巨集）。中間多一個空格
 * 會把一個可展開的樣板變成一個常數。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:define_func', (node, _ctx) => {
    const name = node.properties.name ?? ''
    const params = node.properties.params ?? ''
    const value = node.properties.value ?? ''
    return `#define ${name}(${params}) ${value}\n`
  })
}
