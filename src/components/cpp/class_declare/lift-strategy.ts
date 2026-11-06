/**
 * `cpp:class_declare` 的 **lift** 路——`class C;`／`struct C;`（沒有本體的 class／struct）。
 *
 * ⚠️ 只認【獨立成一句】的：外層那一句除了這個 specifier 與分號沒有別的（沒有宣告子）。
 *    `struct Node* next;`（欄位）、`struct Point p;`（C 風格的變數宣告）的型別也是沒有本體的 struct_specifier
 *    ——那些是型別，不是前置宣告；讓開（回 null），由它們自己的元件處理。
 * ⚠️ 樣板的前置宣告（`template <class T> class X;`）外層是 template_declaration，也讓開。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftClassDeclare', (node) => {
    const name = node.childForFieldName('name')
    if (!name || name.type !== 'type_identifier') return null
    const parent = node.parent
    if (!parent || parent.type === 'template_declaration') return null
    // 外層那一句（translation_unit／區塊裡）——這個 specifier 的下一個兄弟是分號，才是獨立的一句
    const sibs = parent.children
    const at = sibs.findIndex((c) => c.startIndex === node.startIndex && c.type === node.type)
    if (at < 0 || sibs[at + 1]?.type !== ';') return null
    if (parent.type !== 'translation_unit' && parent.type !== 'compound_statement' && parent.type !== 'declaration_list') return null
    return createNode('cpp:class_declare', { keyword: node.type === 'struct_specifier' ? 'struct' : 'class', name: name.text })
  })
}
