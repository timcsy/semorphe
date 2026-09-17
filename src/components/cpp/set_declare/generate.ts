/**
 * `cpp:set_declare` 的 **generate** 路。
 *
 * ⚠️ **這一支差一點被我判成死碼**（2026-09-17）：`generateNode` 確實**先問樣板
 * 產生器**，而這顆的 `forms/blocks.json` 宣告過 `codeTemplate`。而查下去才發現
 * `setTemplateGenerator` 在 `src/` 內**零呼叫**——樣板產生器在產品裡從沒被裝上，
 * 所以活的一直是這一支。
 *
 * > **「哪一條路徑會贏」讀得出來，「那條路徑有沒有被接上」讀不出來
 * > ——而後者才決定使用者拿到哪一份。**
 *
 * 🟢 那份樣板已經拿掉了：它與這裡對同一件事的說法不一樣（`std::set` vs `set`），
 * 而一份沒有人跑的第二真相，會在有人裝上它的那天變成一個缺陷。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:set_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 's'
    // ⚠️ 只有明講「不要去重」才是 multiset——舊存檔沒有這個屬性，而它們是 set。
    const kind = String(node.properties.unique ?? 'true') === 'false' ? 'multiset' : 'set'
    return `${indent(ctx)}${kind}<${type}> ${name};\n`
  })
}
