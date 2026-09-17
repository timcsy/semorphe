/**
 * `cpp:map_declare` 的 **generate** 路。
 *
 * ⚠️ 樣板已經拿掉（同 `set` 那一顆，理由見那裡）：它與這一支對同一件事的說法
 * 不一樣，而它今天不會被發現，是因為樣板產生器在產品裡從沒被裝上。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement components
    g.set('cpp:map_declare', (node, ctx) => {
      const keyType = node.properties.key_type ?? 'int'
      const valueType = node.properties.value_type ?? 'int'
      const name = node.properties.name ?? 'mp'
      // ⚠️ 只有明講「沒有序」才是 unordered_map——舊存檔沒有這個屬性，而它們是 map。
      const kind = String(node.properties.ordered ?? 'true') === 'false' ? 'unordered_map' : 'map'
      // 🔴 同 `set` 那一顆：`map<char,int> r = f();` 的初始值原本整段消失。
      const source = (node.slots.source ?? [])[0]
      if (source) {
        return `${indent(ctx)}${kind}<${keyType}, ${valueType}> ${name} = ${generateExpression(source, ctx)};\n`
      }
      return `${indent(ctx)}${kind}<${keyType}, ${valueType}> ${name};\n`
    })
}
