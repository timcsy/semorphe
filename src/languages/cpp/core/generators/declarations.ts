import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression, generateBody, indented } from '../../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare', (node, ctx) => {
    // ⚠️ **位置感知**：`for (int i = 0; …)` 的初始化位置不要分號與縮排。
    // 那是**形態**不是身分——B 項把 `var_declare_expr` 合併進來。
    const 收尾 = (expr: string): string => (ctx.isExpression ? expr : `${indent(ctx)}${expr};\n`)
    const type = node.properties.type ?? 'int'
    const declarators = node.children.declarators ?? []

    // Multi-variable: int x, v1 = 0;
    if (declarators.length > 0) {
      const parts = declarators.map(d => {
        const name = d.properties.name ?? 'x'
        const inits = d.children.initializer ?? []
        if (inits.length > 0) {
          return `${name} = ${generateExpression(inits[0], ctx)}`
        }
        return name
      })
      return 收尾(`${type} ${parts.join(', ')}`)
    }

    // Single variable
    const name = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      // Constructor-style initialization: Type name(args)
      if (node.properties.init_style === 'constructor') {
        const args = inits.map(a => generateExpression(a, ctx))
        return 收尾(`${type} ${name}(${args.join(', ')})`)
      }
      const val = generateExpression(inits[0], ctx)
      return 收尾(`${type} ${name} = ${val}`)
    }
    return 收尾(`${type} ${name}`)
  })

  g.set('cpp:var_declare_ref', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'ref'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}${type}& ${name} = ${val};\n`
    }
    return `${indent(ctx)}${type}& ${name};\n`
  })

  g.set('cpp:var_declare_static', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'count'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}static ${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}static ${type} ${name};\n`
  })

  g.set('cpp:member_static', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'count'
    return `${indent(ctx)}static ${type} ${name};\n`
  })

  g.set('cpp:var_assign', (node, ctx) => {
    const name = node.properties.obj ?? 'x'
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${indent(ctx)}${name} = ${val};\n`
    }
    return `${indent(ctx)}${name};\n`
  })

  g.set('cpp:forward_decl', (node, ctx) => {
    const returnType = node.properties.return_type ?? 'void'
    const name = node.properties.name ?? ''
    const paramChildren = node.children.params ?? []
    const paramStr = paramChildren.map(p => {
      const t = String(p.properties.type ?? 'int')
      const n = String(p.properties.name ?? '')
      if (t.endsWith('[]')) {
        const baseType = t.slice(0, -2)
        return n ? `${baseType} ${n}[]` : `${baseType}[]`
      }
      return n ? `${t} ${n}` : t
    }).join(', ')
    return `${indent(ctx)}${returnType} ${name}(${paramStr});\n`
  })

  g.set('cpp:array_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'arr'
    const sizeNodes = node.children.size ?? []
    const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : (node.properties.size ?? '10')
    // 初始值三態：欄位不存在 → 無初始化；[] → `= {}`；有內容 → `= {…}`
    const values = node.children.values
    const init = values === undefined ? '' : ` = {${values.map(v => generateExpression(v, ctx)).join(', ')}}`
    return `${indent(ctx)}${type} ${name}[${size}]${init};\n`
  })

  // 巢狀初始值列表（多維陣列的一層）——只在 array_declare 的 values 下出現
  g.set('cpp_initializer_list', (node, ctx) => {
    const values = node.children.values ?? []
    return `{${values.map(v => generateExpression(v, ctx)).join(', ')}}`
  })

  g.set('cpp:array_at', (node, ctx) => {
    const name = node.properties.obj ?? 'arr'
    const indexNodes = node.children.index ?? []
    const idx = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
    return `${name}[${idx}]`
  })







  g.set('cpp:template_function', (node, ctx) => {
    const t = node.properties.t ?? 'T'
    const returnType = node.properties.return_type ?? 'T'
    const funcName = node.properties.func_name ?? 'myFunc'
    const paramChildren = node.children.params ?? []
    const paramStr = paramChildren.map(p => {
      const pt = String(p.properties.type ?? 'T')
      const pn = String(p.properties.name ?? '')
      if (pt.endsWith('[]')) {
        const baseType = pt.slice(0, -2)
        return pn ? `${baseType} ${pn}[]` : `${baseType}[]`
      }
      return pn ? `${pt} ${pn}` : pt
    }).join(', ')
    const bodyNodes = node.children.body ?? []
    const bodyCode = generateBody(bodyNodes, indented(ctx))
    const ind = indent(ctx)
    return `${ind}template <typename ${t}>\n${ind}${returnType} ${funcName}(${paramStr}) {\n${bodyCode}${ind}}\n`
  })







  g.set('cpp:array_assign', (node, ctx) => {
    const name = node.properties.obj ?? 'arr'
    const indexNodes = node.children.index ?? []
    const idx = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
    const vals = node.children.value ?? []
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    return `${indent(ctx)}${name}[${idx}] = ${val};\n`
  })

  g.set('cpp:pointer_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'ptr'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}${type}* ${name} = ${val};\n`
    }
    return `${indent(ctx)}${type}* ${name};\n`
  })

  g.set('cpp:var_declare_const', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'MAX'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}const ${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}const ${type} ${name};\n`
  })

  g.set('cpp:var_declare_constexpr', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'SIZE'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}constexpr ${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}constexpr ${type} ${name};\n`
  })

  g.set('cpp:var_declare_auto', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}auto ${name} = ${val};\n`
    }
    return `${indent(ctx)}auto ${name};\n`
  })







  g.set('_multi_field', (node, ctx) => {
    const fields = node.children.fields ?? []
    return generateBody(fields, ctx)
  })
}
