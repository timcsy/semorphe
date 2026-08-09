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

  g.set('cpp:ref_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'ref'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}${type}& ${name} = ${val};\n`
    }
    return `${indent(ctx)}${type}& ${name};\n`
  })

  g.set('cpp:static_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'count'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}static ${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}static ${type} ${name};\n`
  })

  g.set('cpp:static_member', (node, ctx) => {
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

  g.set('cpp:sizeof', (node) => {
    const target = node.properties.target ?? 'int'
    return `sizeof(${target})`
  })

  g.set('cpp:enum', (node, ctx) => {
    const name = node.properties.name ?? 'MyEnum'
    const values = node.properties.values ?? ''
    return `${indent(ctx)}enum ${name} { ${values} };\n`
  })

  g.set('cpp:loop_range', (node, ctx) => {
    const varType = node.properties.var_type ?? 'auto'
    const varName = node.properties.var_name ?? 'x'
    const container = node.properties.container ?? 'vec'
    const bodyNodes = node.children.body ?? []
    const bodyCode = generateBody(bodyNodes, indented(ctx))
    const ind = indent(ctx)
    return `${ind}for (${varType} ${varName} : ${container}) {\n${bodyCode}${ind}}\n`
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

  g.set('cpp:array_2d_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'arr'
    const rows = node.properties.rows ?? '3'
    const cols = node.properties.cols ?? '4'
    return `${indent(ctx)}${type} ${name}[${rows}][${cols}];\n`
  })

  g.set('cpp:array_2d_at', (node, ctx) => {
    const name = node.properties.obj ?? 'arr'
    const rowNodes = node.children.row ?? []
    const colNodes = node.children.col ?? []
    const row = rowNodes.length > 0 ? generateExpression(rowNodes[0], ctx) : '0'
    const col = colNodes.length > 0 ? generateExpression(colNodes[0], ctx) : '0'
    return `${name}[${row}][${col}]`
  })

  g.set('cpp:array_2d_assign', (node, ctx) => {
    const name = node.properties.obj ?? 'arr'
    const rowNodes = node.children.row ?? []
    const colNodes = node.children.col ?? []
    const vals = node.children.value ?? []
    const row = rowNodes.length > 0 ? generateExpression(rowNodes[0], ctx) : '0'
    const col = colNodes.length > 0 ? generateExpression(colNodes[0], ctx) : '0'
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    return `${indent(ctx)}${name}[${row}][${col}] = ${val};\n`
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

  g.set('cpp:const_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'MAX'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}const ${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}const ${type} ${name};\n`
  })

  g.set('cpp:constexpr_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'SIZE'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}constexpr ${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}constexpr ${type} ${name};\n`
  })

  g.set('cpp:auto_declare', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}auto ${name} = ${val};\n`
    }
    return `${indent(ctx)}auto ${name};\n`
  })

  g.set('cpp:typedef', (node, ctx) => {
    const origType = node.properties.orig_type ?? 'int'
    const alias = node.properties.alias ?? 'myint'
    return `${indent(ctx)}typedef ${origType} ${alias};\n`
  })

  g.set('cpp:using_alias', (node, ctx) => {
    const alias = node.properties.alias ?? 'll'
    const origType = node.properties.orig_type ?? 'long long'
    return `${indent(ctx)}using ${alias} = ${origType};\n`
  })

  g.set('cpp:struct_declare', (node, ctx) => {
    const name = node.properties.name ?? 'MyStruct'
    const members = node.children.members ?? []
    let code = `${indent(ctx)}struct ${name} {\n`
    code += generateBody(members, indented(ctx))
    code += `${indent(ctx)}};\n`
    return code
  })

  g.set('_multi_field', (node, ctx) => {
    const fields = node.children.fields ?? []
    return generateBody(fields, ctx)
  })
}
