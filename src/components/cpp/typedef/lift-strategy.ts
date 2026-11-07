/** `cpp:typedef` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftTypedef', …)`。
 *
 * 🔴 2026-11-07 C 盲測抓到三個**靜默改寫**（都是 C 學生最常寫的 typedef）：
 * ```
 * typedef struct { int x, y; } Point;        →  typedef Point mytype;     struct 的本體整個不見
 * typedef struct Node { … } Node;            →  typedef Node mytype;
 * typedef int (*binop)(int, int);            →  typedef int mytype;       函式指標變成 int
 * typedef int *IntPtr;                       →  typedef int mytype;       星號與別名都不見
 * ```
 * 原因：原型別只認幾種型別節點（認不到 `struct_specifier` 就拿別名當原型別），別名只認直接子的 `type_identifier`
 * （包在 pointer／function 宣告子裡的找不到），找不到就填一個**編出來的名字** `mytype`。
 *
 * 修法照 P6：
 * - 認得的照實記：原型別多認 `struct／enum／union Tag`（**沒有本體**的那種）；宣告子是 `*…*名字` 的把星號接到原型別。
 * - 認不得的**回 null**（整句照原文降級）：帶本體的 struct／enum／union（`typedef struct {…} P;`）、函式指標、陣列 typedef、一句多個別名。
 *   ⚠️ 帶本體的 `typedef struct` 在 C 太常見——完整支援（積木上要有別名那一格）排成下一刀，見 tests/reports/fuzz-c-bridge-20261107.md。
 * - **再也不編名字**：找不到別名就回 null。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'

const TAGGED = new Set(['struct_specifier', 'enum_specifier', 'union_specifier'])

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // type_definition: typedef int myint; → cpp_typedef
    registry.register('cpp:liftTypedef', (node) => {
      const typeNode = node.childForFieldName('type') ?? node.namedChildren.find(c =>
        c.type === 'primitive_type' || c.type === 'type_identifier' ||
        c.type === 'qualified_identifier' || c.type === 'sized_type_specifier' ||
        // ⚠️ **`template_type` 也要認**（2026-09-17）：`typedef pair<int,int> P;`
        //    少了它，原型別被讀成第一個 `type_identifier`——而那是 `P` 自己，於是這個別名指向它自己。
        c.type === 'template_type' || TAGGED.has(c.type)
      )
      if (!typeNode) return null
      // 帶本體的 struct／enum／union：還裝不下（見檔頭）——照原文降級
      if (TAGGED.has(typeNode.type) && typeNode.childForFieldName('body')) return null
      // ⚠️ 比位置不比物件：web-tree-sitter 每次取節點都是新物件，`c !== typeNode` 永遠成立
      const declarators = node.namedChildren.filter((c) => c.startIndex !== typeNode.startIndex && c.type !== 'type_qualifier' && c.type !== 'comment')
      // 一句裡多個別名（`typedef int A, *B;`）：還裝不下
      if (declarators.length !== 1) return null
      let d: AstNode | null = declarators[0]
      let stars = ''
      while (d && d.type === 'pointer_declarator') {
        stars += '*'
        d = d.childForFieldName('declarator')
      }
      // 函式指標、陣列 typedef 這類宣告子：還裝不下
      if (!d || d.type !== 'type_identifier') return null
      const qualifiers = node.namedChildren.filter((c) => c.type === 'type_qualifier').map((c) => c.text)
      const origType = [...qualifiers, typeNode.text.replace(/\s+/g, ' ')].join(' ') + stars
      return createNode('cpp:typedef', { orig_type: origType, alias: d.text })
    })
}
