import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

function liftSingleDeclarator(decl: AstNode, type: string, ctx: LiftContext): SemanticNode {
  // Array declarator: int arr[10]
  if (decl.type === 'array_declarator') {
    const name = decl.namedChildren[0]?.text ?? 'arr'
    const sizeNode = decl.namedChildren[1]
    const size = sizeNode?.text ?? '10'
    return createNode('array_declare', { type, name, size })
  }

  // Plain identifier: int x
  if (decl.type === 'identifier') {
    return createNode('var_declare', { name: decl.text, type })
  }

  // init_declarator: name = value
  const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
  const name = nameNode?.text ?? 'x'

  // Array init_declarator: int arr[10] = {...}
  if (nameNode?.type === 'array_declarator') {
    const arrName = nameNode.namedChildren[0]?.text ?? 'arr'
    const sizeNode = nameNode.namedChildren[1]
    const size = sizeNode?.text ?? '10'
    return createNode('array_declare', { type, name: arrName, size })
  }

  const valueNode = decl.childForFieldName('value')
  if (valueNode) {
    const value = ctx.lift(valueNode)
    return createNode('var_declare', { name, type }, {
      initializer: value ? [value] : [],
    })
  }

  return createNode('var_declare', { name, type })
}

export function registerCppLiftStrategies(registry: LiftStrategyRegistry): void {
  // preproc_include: system vs local include distinction
  registry.register('cpp:liftPreprocInclude', (node) => {
    const pathNode = node.namedChildren.find(c => c.type === 'system_lib_string' || c.type === 'string_literal')
    if (!pathNode) {
      const raw = createNode('raw_code', {})
      raw.metadata = { rawCode: node.text }
      return raw
    }
    const rawPath = pathNode.text
    if (rawPath.startsWith('<') && rawPath.endsWith('>')) {
      const header = rawPath.slice(1, -1)
      return createNode('cpp_include', { header, local: false })
    }
    if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
      const header = rawPath.slice(1, -1)
      return createNode('cpp_include_local', { header })
    }
    const raw = createNode('raw_code', {})
    raw.metadata = { rawCode: node.text }
    return raw
  })

  // function_definition: deep nested declarator extraction
  registry.register('cpp:liftFunctionDef', (node, ctx) => {
    const typeNode = node.childForFieldName('type')
    const declaratorNode = node.childForFieldName('declarator')
    const bodyNode = node.childForFieldName('body')

    const returnType = typeNode?.text ?? 'void'
    let name = 'f'
    const params: string[] = []

    if (declaratorNode) {
      const nameNode = declaratorNode.childForFieldName('declarator')
      name = nameNode?.text ?? declaratorNode.namedChildren[0]?.text ?? 'f'

      const paramList = declaratorNode.childForFieldName('parameters')
      if (paramList) {
        for (const param of paramList.namedChildren) {
          if (param.type === 'parameter_declaration') {
            params.push(param.text)
          }
        }
      }
    }

    const body = extractBody(bodyNode, ctx)
    return createNode('func_def', { name, return_type: returnType, params }, { body })
  })

  // declaration: multi-variable + array declarations
  registry.register('cpp:liftDeclaration', (node, ctx) => {
    const typeNode = node.namedChildren.find(c =>
      c.type === 'primitive_type' || c.type === 'type_identifier' ||
      c.type === 'qualified_identifier' || c.type === 'sized_type_specifier'
    )
    const type = typeNode?.text ?? 'int'

    const declarators = node.namedChildren.filter(c =>
      c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'array_declarator'
    )

    if (declarators.length === 0) {
      return createNode('var_declare', { name: 'x', type })
    }

    const liftedNodes = declarators.map(decl => liftSingleDeclarator(decl, type, ctx))

    if (liftedNodes.length === 1) return liftedNodes[0]

    return createNode('var_declare', { type }, { declarators: liftedNodes })
  })
}

function extractBody(node: AstNode | null, ctx: LiftContext): SemanticNode[] {
  if (!node) return []
  const lifted = ctx.lift(node)
  if (!lifted) return []
  if (lifted.concept === '_compound') {
    return lifted.children.body ?? []
  }
  return [lifted]
}
