/** `cpp:var_declare` 的 **generate** 路——從共用檔原封剪過來（probe）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'
import { cTypeName } from '../../../languages/cpp/target-dialect'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare', (node, ctx) => {
      // ⚠️ **位置感知**：`for (int i = 0; …)` 的初始化位置不要分號與縮排。
      // 那是**形態**不是身分——B 項把 `var_declare_expr` 合併進來。
      const finish = (expr: string): string => (ctx.isExpression ? expr : `${indent(ctx)}${expr};\n`)
      // 🔴 C 沒有「宣告過 struct 就能省略標籤」那條規則——`struct Point p;`。
      // ⚠️ 而 `_structNames` 只有 C 目標會被填（見 `program/generate.ts`），
      // 所以 C++ 那一側**一個字都沒變**。
      const rawType = String(node.properties.type ?? 'int')
      const type = ctx._structNames ? cTypeName(rawType, ctx._structNames) : rawType
      const declarators = node.children.declarators ?? []

      // Multi-variable: int x, v1 = 0;
      //
      // 🔴 **每一個宣告子由【它自己的產生器】畫，這裡只脫掉型別前綴**（2026-09-09）
      //
      // 這裡原本自己重新實作了一次「宣告子長什麼樣」——名字，也許再一個初始值。
      // 而現實比那寬：
      //
      // ```
      // int a[10], b[20];      →  int a, b;        🔴 兩個大小一起蒸發
      // string A[100], ans;    →  string A, ans;   🔴 同上
      // ```
      //
      // ⚠️ `cpp:array_declare` 帶的是 `size`，`cpp:pointer_declare` 帶的是星號
      // ——而這個分支只讀 `name` 與 `initializer`，其餘的**安靜地丟掉**。
      //
      // > **一個容器自己重新實作了一次「我的成員長什麼樣」的規則，
      // > 那份實作永遠只有寫的那天是完整的。**
      //
      // 🟢 而每一顆宣告子**都有自己的產生器**，產的是完整的一句
      // （`int a[10];`）。要的是去掉型別之後那一段，而型別是**我們自己**
      // 剛放上去的，所以脫它不是猜。
      //
      // ⚠️ **脫不掉就退回舊行為**——一個對不上的前綴代表這顆宣告子的形狀
      // 與我們以為的不同，而那時候「少畫一點」比「亂剪一刀」安全。
      if (declarators.length > 0) {
        const parts = declarators.map(d => {
          const own = generateExpression(d, { ...ctx, indent: 0, isExpression: true }).trim()
          const ownType = String(d.properties.type ?? type)
          if (own.startsWith(ownType)) {
            const rest = own.slice(ownType.length).trim()
            if (rest.length > 0) return rest
          }
          const name = d.properties.name ?? 'x'
          const inits = d.children.initializer ?? []
          if (inits.length > 0) {
            return `${name} = ${generateExpression(inits[0], ctx)}`
          }
          return name
        })
        return finish(`${type} ${parts.join(', ')}`)
      }

      // Single variable
      const name = node.properties.name ?? 'x'
      const inits = node.children.initializer ?? []
      if (inits.length > 0) {
        // Constructor-style initialization: Type name(args)
        if (node.properties.init_style === 'constructor') {
          const args = inits.map(a => generateExpression(a, ctx))
          return finish(`${type} ${name}(${args.join(', ')})`)
        }
        const val = generateExpression(inits[0], ctx)
        return finish(`${type} ${name} = ${val}`)
      }
      return finish(`${type} ${name}`)
    })
}
