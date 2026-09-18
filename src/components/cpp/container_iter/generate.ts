/** `cpp:container_iter` 的 **generate** 路 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_iter', (node, ctx) => {
    // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    const which = node.properties.which ?? 'begin'
    /**
     * 🔴 **自由函式那一形要產回自由函式**（2026-09-18）。
     * 一律產成 `x.begin()` 的話，原生陣列那 4 支語料會**編不過**
     * ——`int a[5]; a.begin()` 沒有那個成員。
     * ⚠️ 只有 `begin`／`end` 有自由函式形式（反向那兩個這一刀不收）。
     */
    return node.properties.call === 'free' ? `${which}(${obj})` : `${obj}.${which}()`
  })
}
