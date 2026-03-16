import type { LiftStrategyRegistry } from '../../../../core/registry/lift-strategy-registry'
import type { AstNode, LiftContext } from '../../../../core/lift/types'
import type { SemanticNode } from '../../../../core/types'
import { createNode } from '../../../../core/semantic-tree'

function liftSingleDeclarator(decl: AstNode, type: string, ctx: LiftContext): SemanticNode {
  // 2D Array declarator: int arr[3][4] — nested array_declarator
  if (decl.type === 'array_declarator' && decl.namedChildren[0]?.type === 'array_declarator') {
    const innerArr = decl.namedChildren[0]
    const name = innerArr.namedChildren[0]?.text ?? 'arr'
    const rows = innerArr.namedChildren[1]?.text ?? '0'
    const cols = decl.namedChildren[1]?.text ?? '0'
    return createNode('cpp_array_2d_declare', { type, name, rows, cols })
  }

  // Array declarator: int arr[10]
  if (decl.type === 'array_declarator') {
    const name = decl.namedChildren[0]?.text ?? 'arr'
    const sizeNode = decl.namedChildren[1]
    // Lift size as a child expression node for proper rendering
    const sizeChild = sizeNode ? ctx.lift(sizeNode) : null
    return createNode('array_declare', { type, name }, {
      size: sizeChild ? [sizeChild] : [],
    })
  }

  // Plain identifier: int x
  if (decl.type === 'identifier') {
    return createNode('var_declare', { name: decl.text, type })
  }

  // Bare pointer declarator without init: int* ptr;
  if (decl.type === 'pointer_declarator') {
    const ptrIdent = decl.namedChildren.find(c => c.type === 'identifier')
    const name = ptrIdent?.text ?? 'ptr'
    return createNode('cpp_pointer_declare', { name, type })
  }

  // Bare reference declarator without init: int& ref; (rare, usually has init)
  if (decl.type === 'reference_declarator') {
    const refIdent = decl.namedChildren.find(c => c.type === 'identifier')
    const name = refIdent?.text ?? 'ref'
    return createNode('cpp_ref_declare', { name, type })
  }

  // init_declarator: name = value
  const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
  let name = nameNode?.text ?? 'x'

  // Reference declarator: int& ref = x
  if (nameNode?.type === 'reference_declarator') {
    const refIdent = nameNode.namedChildren.find(c => c.type === 'identifier')
    name = refIdent?.text ?? 'ref'
    const valueNode = decl.childForFieldName('value')
    if (valueNode) {
      const value = ctx.lift(valueNode)
      return createNode('cpp_ref_declare', { name, type }, {
        initializer: value ? [value] : [],
      })
    }
    return createNode('cpp_ref_declare', { name, type })
  }

  // Pointer declarator: int* ptr = &x
  if (nameNode?.type === 'pointer_declarator') {
    // Extract the actual identifier from pointer_declarator
    const ptrIdent = nameNode.namedChildren.find(c => c.type === 'identifier')
    name = ptrIdent?.text ?? 'ptr'
    const valueNode = decl.childForFieldName('value')
    if (valueNode) {
      const value = ctx.lift(valueNode)
      return createNode('cpp_pointer_declare', { name, type }, {
        initializer: value ? [value] : [],
      })
    }
    return createNode('cpp_pointer_declare', { name, type })
  }

  // Array init_declarator: int arr[10] = {...}
  if (nameNode?.type === 'array_declarator') {
    const arrName = nameNode.namedChildren[0]?.text ?? 'arr'
    const sizeNode = nameNode.namedChildren[1]
    const sizeChild = sizeNode ? ctx.lift(sizeNode) : null
    return createNode('array_declare', { type, name: arrName }, {
      size: sizeChild ? [sizeChild] : [],
    })
  }

  const valueNode = decl.childForFieldName('value')
  if (valueNode) {
    // Constructor-style initialization: Type name(args) — value is argument_list
    if (valueNode.type === 'argument_list') {
      const args = valueNode.namedChildren
        .map(a => ctx.lift(a))
        .filter((n): n is NonNullable<typeof n> => n !== null)
      return createNode('var_declare', { name, type, init_style: 'constructor' }, {
        initializer: args,
      })
    }
    const value = ctx.lift(valueNode)
    return createNode('var_declare', { name, type }, {
      initializer: value ? [value] : [],
    })
  }

  return createNode('var_declare', { name, type })
}

/** Lift a class member (function_definition, field_declaration) into a semantic node */
function liftClassMember(node: AstNode, className: string, ctx: LiftContext): SemanticNode | null {
  if (node.type === 'function_definition') {
    const declNode = node.childForFieldName('declarator')
    const typeNode = node.childForFieldName('type')
    const bodyNode = node.childForFieldName('body')
    const nameNode = declNode?.childForFieldName('declarator')
    const isVirtual = node.children.some(c => !c.isNamed && c.text === 'virtual')

    // Constructor: function_definition where declarator name matches class name
    if (nameNode?.type === 'identifier' && nameNode.text === className) {
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const initListNode = node.namedChildren.find(c => c.type === 'field_initializer_list')
      const initList = initListNode ? initListNode.text.replace(/^:\s*/, '') : ''
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp_constructor', { class_name: className, init_list: initList }, { params, body })
    }

    // Destructor: function_definition where declarator is destructor_name
    if (nameNode?.type === 'destructor_name') {
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp_destructor', { class_name: className }, { body })
    }

    // Operator overload: function_definition where declarator is operator_name
    if (nameNode?.type === 'operator_name') {
      const op = nameNode.text.replace(/^operator/, '').trim()
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters')
      let paramType = ''
      let paramName = ''
      if (paramList) {
        const firstParam = paramList.namedChildren.find(c => c.type === 'parameter_declaration')
        if (firstParam) {
          const parsed = parseParamDeclaration(firstParam)
          paramType = parsed.type
          paramName = parsed.name
        }
      }
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp_operator_overload', { return_type: returnType, operator: op, param_type: paramType, param_name: paramName }, { body })
    }

    // Check for override keyword (via virtual_specifier node in declarator)
    const hasOverride = declNode?.namedChildren.some(c => c.type === 'virtual_specifier' && c.text === 'override') ?? false

    // Override method (with or without virtual keyword)
    if (hasOverride) {
      const methodName = nameNode?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp_override_method', { return_type: returnType, name: methodName }, { params, body })
    }

    // Virtual method with body
    if (isVirtual) {
      const methodName = nameNode?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      const body = extractBody(bodyNode, ctx)
      return createNode('cpp_virtual_method', { return_type: returnType, name: methodName }, { params, body })
    }

    // Regular member function → lift as func_def
    return ctx.lift(node)
  }

  if (node.type === 'field_declaration') {
    // Pure virtual: virtual void method() = 0;
    const isVirtual = node.children.some(c => !c.isNamed && c.text === 'virtual')
    const defaultVal = node.childForFieldName('default_value')
    if (isVirtual && defaultVal?.text === '0') {
      const typeNode = node.childForFieldName('type')
      const declNode = node.childForFieldName('declarator')
      const methodName = declNode?.childForFieldName('declarator')?.text ?? declNode?.namedChildren[0]?.text ?? 'method'
      const returnType = typeNode?.text ?? 'void'
      const paramList = declNode?.childForFieldName('parameters') ?? null
      const params = liftParamList(paramList, ctx)
      return createNode('cpp_pure_virtual', { return_type: returnType, name: methodName }, { params })
    }

    // Static member: static int count;
    const isStatic = node.namedChildren.some(c => c.type === 'storage_class_specifier' && c.text === 'static')
    if (isStatic) {
      const typeNode = node.childForFieldName('type')
      const type = typeNode?.text ?? 'int'
      const declNode = node.childForFieldName('declarator')
      const name = declNode?.text ?? 'member'
      return createNode('cpp_static_member', { type, name })
    }

    // Regular field declaration: type name; or type x, y;
    const typeNode = node.childForFieldName('type')
    const type = typeNode?.text ?? 'int'
    // Check for multi-variable declarations (e.g., double x, y;)
    const declarators = node.namedChildren.filter(c =>
      c.type === 'identifier' || c.type === 'field_identifier' ||
      c.type === 'pointer_declarator' || c.type === 'reference_declarator'
    ).filter(c => c !== typeNode) // exclude the type node itself
    if (declarators.length > 1) {
      // Multi-variable: create individual var_declare nodes wrapped in a container
      const nodes = declarators.map(d => createNode('var_declare', { type, name: d.text }))
      // Return first and add rest — use a wrapper approach
      // Actually, we need to return multiple nodes. Use the fact that struct/class member lifting
      // collects all children. Return a compound node that generateBody will flatten.
      return createNode('_multi_field', {}, { fields: nodes })
    }
    const declNode = node.childForFieldName('declarator')
    const name = declNode?.text ?? 'x'
    return createNode('var_declare', { type, name })
  }

  // Fallback: try generic lift
  return ctx.lift(node)
}


/** Extract parameters from a parameter_list node */
function liftParamList(paramList: AstNode | null, _ctx: LiftContext): SemanticNode[] {
  if (!paramList) return []
  const params: SemanticNode[] = []
  for (const p of paramList.namedChildren) {
    if (p.type === 'parameter_declaration') {
      const { type, name } = parseParamDeclaration(p)
      params.push(createNode('param_decl', { type, name }))
    }
  }
  return params
}

export function registerCppLiftStrategies(registry: LiftStrategyRegistry): void {
  // struct_specifier: struct Name { members };
  registry.register('cpp:liftStructDef', (node, ctx) => {
    const nameNode = node.childForFieldName('name')
    const structName = nameNode?.text ?? 'MyStruct'
    const bodyNode = node.childForFieldName('body')
    const members: SemanticNode[] = []

    if (bodyNode) {
      for (const child of bodyNode.namedChildren) {
        if (child.type === 'access_specifier') continue
        const lifted = liftClassMember(child, structName, ctx)
        if (lifted) members.push(lifted)
      }
    }

    return createNode('cpp_struct_declare', { name: structName }, { members })
  })

  // class_specifier: class Name : public Base { public: ... private: ... protected: ... };
  registry.register('cpp:liftClassDef', (node, ctx) => {
    const nameNode = node.childForFieldName('name')
    const className = nameNode?.text ?? 'MyClass'
    const bodyNode = node.childForFieldName('body')

    // Extract base class from base_class_clause
    const baseClause = node.namedChildren.find(c => c.type === 'base_class_clause')
    let baseClass = ''
    let baseAccess = 'public'
    if (baseClause) {
      // base_class_clause contains access_specifier? and type_identifier
      for (const child of baseClause.namedChildren) {
        if (child.type === 'access_specifier') {
          baseAccess = child.text.replace(/:$/, '').trim()
        } else if (child.type === 'type_identifier' || child.type === 'qualified_identifier') {
          baseClass = child.text
        }
      }
    }

    const publicMembers: SemanticNode[] = []
    const privateMembers: SemanticNode[] = []
    const protectedMembers: SemanticNode[] = []
    let currentAccess = 'private' // default access in class

    if (bodyNode) {
      for (const child of bodyNode.namedChildren) {
        if (child.type === 'access_specifier') {
          const accessText = child.text.replace(/:$/, '').trim()
          currentAccess = accessText
          continue
        }
        const lifted = liftClassMember(child, className, ctx)
        if (lifted) {
          if (currentAccess === 'public' || currentAccess === 'public:') publicMembers.push(lifted)
          else if (currentAccess === 'protected' || currentAccess === 'protected:') protectedMembers.push(lifted)
          else privateMembers.push(lifted)
        }
      }
    }

    const props: Record<string, string> = { name: className }
    if (baseClass) {
      props.base_class = baseClass
      props.base_access = baseAccess
    }

    return createNode('cpp_class_def', props, {
      public: publicMembers,
      protected: protectedMembers,
      private: privateMembers,
    })
  })

  // lambda_expression: [capture](params) -> ret { body }
  registry.register('cpp:liftLambda', (node, ctx) => {
    const captureSpec = node.namedChildren.find(c => c.type === 'lambda_capture_specifier')
    let capture = '&'
    if (captureSpec) {
      const inner = captureSpec.text.slice(1, -1) // strip [ ]
      capture = inner || ''
    }
    const declNode = node.namedChildren.find(c => c.type === 'abstract_function_declarator')
    const paramList = declNode?.namedChildren.find(c => c.type === 'parameter_list') ?? null
    const params = liftParamList(paramList, ctx)
    const trailingReturn = declNode?.namedChildren.find(c => c.type === 'trailing_return_type')
    const returnType = trailingReturn ? trailingReturn.text.replace(/^->\s*/, '') : ''
    const bodyNode = node.namedChildren.find(c => c.type === 'compound_statement') ?? null
    const body = extractBody(bodyNode, ctx)
    return createNode('cpp_lambda', { capture, return_type: returnType }, { params, body })
  })

  // namespace_definition: namespace N { body }
  registry.register('cpp:liftNamespace', (node, ctx) => {
    const nameNode = node.namedChildren.find(c => c.type === 'namespace_identifier')
    const name = nameNode?.text ?? 'ns'
    const bodyNode = node.namedChildren.find(c => c.type === 'declaration_list')
    const body: SemanticNode[] = []
    if (bodyNode) {
      for (const child of bodyNode.namedChildren) {
        const lifted = ctx.lift(child)
        if (lifted) body.push(lifted)
      }
    }
    return createNode('cpp_namespace_def', { name }, { body })
  })

  // doc comment: /** ... */ → doc_comment with structured properties
  registry.register('cpp:liftDocComment', (node) => {
    const props = parseDocComment(node.text)
    return createNode('doc_comment', props)
  })

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
    const paramChildren: SemanticNode[] = []

    if (declaratorNode) {
      const nameNode = declaratorNode.childForFieldName('declarator')
      name = nameNode?.text ?? declaratorNode.namedChildren[0]?.text ?? 'f'

      const paramList = declaratorNode.childForFieldName('parameters')
      if (paramList) {
        for (const param of paramList.namedChildren) {
          if (param.type === 'parameter_declaration') {
            const { type: pType, name: pName } = parseParamDeclaration(param)
            paramChildren.push(createNode('param_decl', { type: pType, name: pName }))
          }
        }
      }
    }

    const body = extractBody(bodyNode, ctx)
    return createNode('func_def', { name, return_type: returnType }, { params: paramChildren, body })
  })

  // type_definition: typedef int myint; → cpp_typedef
  registry.register('cpp:liftTypedef', (node) => {
    const typeNode = node.namedChildren.find(c =>
      c.type === 'primitive_type' || c.type === 'type_identifier' ||
      c.type === 'qualified_identifier' || c.type === 'sized_type_specifier'
    )
    const aliasNode = node.namedChildren.find(c => c.type === 'type_identifier' &&
      (c.startPosition.row !== typeNode?.startPosition.row || c.startPosition.column !== typeNode?.startPosition.column)
    )
    const origType = typeNode?.text ?? 'int'
    const alias = aliasNode?.text ?? 'mytype'
    return createNode('cpp_typedef', { orig_type: origType, alias })
  })

  // alias_declaration: using ll = long long; → cpp_using_alias
  registry.register('cpp:liftAliasDeclaration', (node) => {
    const nameNode = node.namedChildren.find(c => c.type === 'type_identifier')
    const descriptorNode = node.namedChildren.find(c => c.type === 'type_descriptor')
    const alias = nameNode?.text ?? 'mytype'
    const origType = descriptorNode?.text ?? 'int'
    return createNode('cpp_using_alias', { alias, orig_type: origType })
  })

  // sizeof_expression: sizeof(int) or sizeof(x)
  registry.register('cpp:liftSizeof', (node) => {
    const child = node.namedChildren[0]
    if (child) {
      if (child.type === 'type_descriptor') {
        return createNode('cpp_sizeof', { target: child.text })
      }
      if (child.type === 'parenthesized_expression') {
        return createNode('cpp_sizeof', { target: child.namedChildren[0]?.text ?? child.text })
      }
      return createNode('cpp_sizeof', { target: child.text })
    }
    return createNode('cpp_sizeof', { target: 'int' })
  })

  // enum_specifier: enum Color { RED, GREEN, BLUE };
  registry.register('cpp:liftEnum', (node) => {
    const nameNode = node.namedChildren.find(c => c.type === 'type_identifier')
    const listNode = node.namedChildren.find(c => c.type === 'enumerator_list')
    const name = nameNode?.text ?? 'MyEnum'
    const values = listNode
      ? listNode.namedChildren
          .filter(c => c.type === 'enumerator')
          .map(e => {
            const eName = e.childForFieldName('name')?.text ?? ''
            const eValue = e.childForFieldName('value')?.text
            return eValue ? `${eName} = ${eValue}` : eName
          })
          .join(', ')
      : ''
    return createNode('cpp_enum', { name, values })
  })

  // for_range_loop: for (auto x : vec) { body }
  registry.register('cpp:liftRangeFor', (node, ctx) => {
    const typeNode = node.namedChildren.find(c =>
      c.type === 'primitive_type' || c.type === 'type_identifier' ||
      c.type === 'placeholder_type_specifier'
    )
    const varType = typeNode?.text ?? 'auto'
    // The identifier after the type
    const varNode = node.namedChildren.find(c => c.type === 'identifier')
    const varName = varNode?.text ?? 'x'
    // The container is the "right" field or the second identifier
    const rightNode = node.childForFieldName('right')
    const container = rightNode?.text ?? 'vec'
    const bodyNode = node.childForFieldName('body') ?? node.namedChildren.find(c => c.type === 'compound_statement') ?? null
    const body = extractBody(bodyNode, ctx)
    return createNode('cpp_range_for', { var_type: varType, var_name: varName, container }, { body })
  })

  // declaration: multi-variable + array declarations
  registry.register('cpp:liftDeclaration', (node, ctx) => {
    // Detect type qualifiers: const, constexpr
    const qualifierNode = node.namedChildren.find(c => c.type === 'type_qualifier')
    const qualifier = qualifierNode?.text

    // Detect auto (placeholder_type_specifier)
    const autoNode = node.namedChildren.find(c => c.type === 'placeholder_type_specifier')

    // Detect template_type (vector<int>, map<string,int>, etc.)
    // Also check inside qualified_identifier (e.g., std::vector<int>)
    let templateTypeNode = node.namedChildren.find(c => c.type === 'template_type')
    if (!templateTypeNode) {
      const qualifiedNode = node.namedChildren.find(c => c.type === 'qualified_identifier')
      if (qualifiedNode) {
        templateTypeNode = qualifiedNode.namedChildren.find(c => c.type === 'template_type') ?? null
      }
    }
    if (templateTypeNode) {
      const templateName = templateTypeNode.namedChildren.find(c => c.type === 'type_identifier')?.text ?? ''
      const templateArgs = templateTypeNode.namedChildren.find(c => c.type === 'template_argument_list')
      const innerType = templateArgs ? templateArgs.text.slice(1, -1).trim() : 'int' // strip < >

      // Container declare concepts
      const containerConcepts: Record<string, string> = {
        'vector': 'cpp_vector_declare',
        'stack': 'cpp_stack_declare',
        'queue': 'cpp_queue_declare',
        'priority_queue': 'cpp_priority_queue_declare',
        'set': 'cpp_set_declare',
        'map': 'cpp_map_declare',
        'pair': 'cpp_pair_declare',
      }

      const conceptId = containerConcepts[templateName]
      if (conceptId) {
        const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
        const name = decl?.type === 'identifier'
          ? decl.text
          : (decl?.childForFieldName('declarator') ?? decl?.namedChildren[0])?.text ?? 'x'

        // map needs key_type and value_type as separate properties
        if (templateName === 'map') {
          const args = templateArgs?.namedChildren.filter(c => c.type === 'type_descriptor' || c.type === 'type_identifier') ?? []
          const keyType = args[0]?.text ?? 'int'
          const valueType = args[1]?.text ?? 'int'
          return createNode(conceptId, { key_type: keyType, value_type: valueType, name })
        }

        return createNode(conceptId, { type: innerType, name })
      }

      // Unknown template type — fall through to var_declare with full template text
    }

    // Detect non-template container/stream types (string, ifstream, ofstream, stringstream)
    // These are type_identifier, possibly inside qualified_identifier (std::string, std::ifstream, etc.)
    const streamConcepts: Record<string, string> = {
      'string': 'cpp_string_declare',
      'ifstream': 'cpp_ifstream_declare',
      'ofstream': 'cpp_ofstream_declare',
      'stringstream': 'cpp_stringstream_declare',
    }
    const typeIdentNode = node.namedChildren.find(c => c.type === 'type_identifier')
    const qualifiedIdNode = node.namedChildren.find(c => c.type === 'qualified_identifier')
    // Get the final type name (e.g., "string" from "std::string" or plain "string")
    let simpleTypeName: string | null = null
    if (typeIdentNode && streamConcepts[typeIdentNode.text]) {
      simpleTypeName = typeIdentNode.text
    } else if (qualifiedIdNode) {
      // Look for type_identifier inside qualified_identifier (e.g., std::string → "string")
      const innerTypeIdent = qualifiedIdNode.namedChildren.find(c => c.type === 'type_identifier')
      if (innerTypeIdent && streamConcepts[innerTypeIdent.text]) {
        simpleTypeName = innerTypeIdent.text
      }
    }
    if (simpleTypeName && streamConcepts[simpleTypeName]) {
      const conceptId = streamConcepts[simpleTypeName]
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
      const name = decl?.type === 'identifier'
        ? decl.text
        : (decl?.childForFieldName('declarator') ?? decl?.namedChildren[0])?.text ?? 'x'
      // For stream types with constructor args (e.g., ifstream fin("input.txt"))
      if (decl?.type === 'init_declarator') {
        const valueNode = decl.childForFieldName('value')
        if (valueNode?.type === 'argument_list') {
          const args = valueNode.namedChildren
            .map(a => ctx.lift(a))
            .filter((n): n is NonNullable<typeof n> => n !== null)
          return createNode(conceptId, { name }, { initializer: args })
        }
        if (valueNode) {
          const value = ctx.lift(valueNode)
          return createNode(conceptId, { name }, { initializer: value ? [value] : [] })
        }
      }
      return createNode(conceptId, { name })
    }

    const typeNode = node.namedChildren.find(c =>
      c.type === 'primitive_type' || c.type === 'type_identifier' ||
      c.type === 'qualified_identifier' || c.type === 'sized_type_specifier' ||
      c.type === 'template_type'
    )
    const type = typeNode?.text ?? 'int'

    // auto declaration: auto x = expr;
    if (autoNode) {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator')
      if (decl) {
        const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
        const name = nameNode?.text ?? 'x'
        const valueNode = decl.childForFieldName('value')
        const value = valueNode ? ctx.lift(valueNode) : null
        return createNode('cpp_auto_declare', { name }, {
          initializer: value ? [value] : [],
        })
      }
      return createNode('cpp_auto_declare', { name: 'x' })
    }

    // const/constexpr declaration
    if (qualifier === 'const' || qualifier === 'constexpr') {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'pointer_declarator')
      if (decl) {
        const lifted = liftSingleDeclarator(decl, type, ctx)
        const conceptId = qualifier === 'const' ? 'cpp_const_declare' : 'cpp_constexpr_declare'
        // Use type from lifted node; append * for pointer concepts
        let liftedType = (lifted.properties.type as string) ?? type
        if (lifted.concept === 'cpp_pointer_declare') liftedType += '*'
        return createNode(conceptId, {
          type: liftedType,
          name: lifted.properties.name as string ?? 'x',
        }, {
          initializer: lifted.children.initializer ?? [],
        })
      }
      const conceptId = qualifier === 'const' ? 'cpp_const_declare' : 'cpp_constexpr_declare'
      return createNode(conceptId, { type, name: 'x' })
    }

    // Static declarations: static int count = 0;
    const storageSpec = node.namedChildren.find(c => c.type === 'storage_class_specifier')
    if (storageSpec?.text === 'static') {
      const decl = node.namedChildren.find(c => c.type === 'init_declarator' || c.type === 'identifier')
      if (decl) {
        if (decl.type === 'identifier') {
          return createNode('cpp_static_declare', { name: decl.text, type })
        }
        const nameNode = decl.childForFieldName('declarator') ?? decl.namedChildren[0]
        const name = nameNode?.text ?? 'x'
        const valueNode = decl.childForFieldName('value')
        if (valueNode) {
          const value = ctx.lift(valueNode)
          return createNode('cpp_static_declare', { name, type }, {
            initializer: value ? [value] : [],
          })
        }
        return createNode('cpp_static_declare', { name, type })
      }
      return createNode('cpp_static_member', { name: 'x', type })
    }

    // Forward function declarations: void listp(int *, int); → structured forward_decl
    const funcDeclarator = node.namedChildren.find(c => c.type === 'function_declarator')
    if (funcDeclarator) {
      const nameNode = funcDeclarator.namedChildren.find(c => c.type === 'identifier')
      const paramList = funcDeclarator.childForFieldName('parameters')
        ?? funcDeclarator.namedChildren.find(c => c.type === 'parameter_list')
      const paramChildren: SemanticNode[] = []
      if (paramList) {
        for (const p of paramList.namedChildren) {
          if (p.type === 'parameter_declaration') {
            const { type: pType, name: pName } = parseParamDeclaration(p)
            paramChildren.push(createNode('param_decl', { type: pType, name: pName }))
          }
        }
      }
      return createNode('forward_decl', {
        return_type: type,
        name: nameNode?.text ?? 'f',
      }, { params: paramChildren })
    }

    const declarators = node.namedChildren.filter(c =>
      c.type === 'init_declarator' || c.type === 'identifier' || c.type === 'array_declarator' ||
      c.type === 'pointer_declarator' || c.type === 'reference_declarator'
    )

    if (declarators.length === 0) {
      return createNode('var_declare', { name: 'x', type })
    }

    const liftedNodes = declarators.map(decl => liftSingleDeclarator(decl, type, ctx))

    if (liftedNodes.length === 1) return liftedNodes[0]

    return createNode('var_declare', { type }, { declarators: liftedNodes })
  })

  // try_statement: try { } catch (type name) { }
  registry.register('cpp:liftTryCatch', (node, ctx) => {
    const tryBody = extractBody(node.childForFieldName('body') ?? null, ctx)
    const catchClause = node.namedChildren.find(c => c.type === 'catch_clause') ?? null
    let catchType = 'exception&'
    let catchName = 'e'
    let catchBody: SemanticNode[] = []
    if (catchClause) {
      const paramList = catchClause.childForFieldName('parameters')
        ?? catchClause.namedChildren.find(c => c.type === 'parameter_list')
      if (paramList) {
        const param = paramList.namedChildren.find(c => c.type === 'parameter_declaration')
        if (param) {
          const { type, name } = parseParamDeclaration(param)
          catchType = type
          catchName = name
        }
      }
      const catchBodyNode = catchClause.childForFieldName('body') ?? null
      catchBody = extractBody(catchBodyNode, ctx)
    }
    return createNode('cpp_try_catch', { catch_type: catchType, catch_name: catchName }, {
      try_body: tryBody,
      catch_body: catchBody,
    })
  })

  // template_declaration: template <typename T> T func(T a) { ... }
  registry.register('cpp:liftTemplateFunction', (node, ctx) => {
    const templateParams = node.namedChildren.find(c => c.type === 'template_parameter_list')
    const typeParam = templateParams?.namedChildren.find(c =>
      c.type === 'type_parameter_declaration'
    )
    const t = typeParam?.namedChildren.find(c => c.type === 'type_identifier')?.text ?? 'T'

    const funcDef = node.namedChildren.find(c => c.type === 'function_definition')
    if (!funcDef) return null

    const returnTypeNode = funcDef.childForFieldName('type')
    const returnType = returnTypeNode?.text ?? 'T'

    const declarator = funcDef.childForFieldName('declarator')
    const funcName = declarator?.childForFieldName('declarator')?.text
      ?? declarator?.namedChildren.find(c => c.type === 'identifier')?.text
      ?? 'myFunc'

    const paramList = declarator?.namedChildren.find(c => c.type === 'parameter_list')
    const params: SemanticNode[] = []
    if (paramList) {
      for (const p of paramList.namedChildren) {
        if (p.type === 'parameter_declaration') {
          const { type, name } = parseParamDeclaration(p)
          params.push(createNode('var_declare', { type, name }))
        }
      }
    }

    const bodyNode = funcDef.childForFieldName('body')
    const body = extractBody(bodyNode ?? null, ctx)

    return createNode('cpp_template_function', {
      t, return_type: returnType, func_name: funcName,
    }, { params, body })
  })

  // cast_expression: (Type*)malloc(size) → cpp_malloc; fallback → cpp_cast
  registry.register('cpp:liftCastExpression', (node, ctx) => {
    const typeNode = node.childForFieldName('type')
    const valueNode = node.childForFieldName('value')
    const targetType = typeNode?.text ?? 'int'

    // Check for (Type*)malloc(...) pattern → cpp_malloc
    if (valueNode?.type === 'call_expression') {
      const funcNode = valueNode.childForFieldName('function')
      if (funcNode?.text === 'malloc') {
        const argsNode = valueNode.childForFieldName('arguments')
        const argChildren = argsNode?.namedChildren ?? []
        const size = argChildren[0] ? ctx.lift(argChildren[0]) : null
        return createNode('cpp_malloc', { type: targetType }, { size: size ? [size] : [] })
      }
    }

    // Default: regular cast
    const value = valueNode ? ctx.lift(valueNode) : null
    return createNode('cpp_cast', { target_type: targetType }, {
      value: value ? [value] : [],
    })
  })

  registry.register('cpp:liftNewExpression', (node) => {
    const typeNode = node.namedChildren.find(c =>
      c.type === 'type_identifier' || c.type === 'primitive_type' || c.type === 'sized_type_specifier'
    )
    const type = typeNode?.text ?? 'int'
    const argList = node.namedChildren.find(c => c.type === 'argument_list')
    const args = argList ? argList.namedChildren.map(a => a.text).join(', ') : ''
    return createNode('cpp_new', { type, args })
  })

  // count_loop: add inclusive property based on operator (< vs <=)
  registry.register('cpp:liftCountFor', (node, ctx) => {
    const initNode = node.childForFieldName('initializer')
    const condNode = node.childForFieldName('condition')
    const updateNode = node.childForFieldName('update')
    const bodyNode = node.childForFieldName('body')

    if (!initNode || initNode.type !== 'declaration') return null
    if (!condNode || condNode.type !== 'binary_expression') return null
    if (!updateNode) return null

    // Only match ascending count loops: condition must be < or <=
    const condOp = condNode.children.find(c => !c.isNamed)?.text
    if (condOp !== '<' && condOp !== '<=') return null

    // Accept i++, ++i, or i += 1
    if (updateNode.type !== 'update_expression' && !isCountingUpdate(updateNode)) return null

    const decl = initNode.namedChildren.find(c => c.type === 'init_declarator')
    const varName = decl
      ? (decl.childForFieldName('declarator') ?? decl.namedChildren[0])?.text ?? 'i'
      : extractDeclVarName(initNode)

    // Verify condition and update use the same variable
    const condLeft = condNode.childForFieldName('left')?.text
    const updateVar = updateNode.type === 'update_expression'
      ? updateNode.namedChildren[0]?.text
      : updateNode.childForFieldName('left')?.text
    if (condLeft !== varName || updateVar !== varName) return null

    const fromNode = decl
      ? (decl.childForFieldName('value') ?? decl.namedChildren[1])
      : null
    const toNode = condNode.childForFieldName('right')
    const op = condNode.children.find(c => !c.isNamed)?.text
    const inclusive = op === '<=' ? 'TRUE' : 'FALSE'

    const from = fromNode ? ctx.lift(fromNode) : null
    const to = toNode ? ctx.lift(toNode) : null
    const body = extractBody(bodyNode, ctx)

    return createNode('count_loop', { var_name: varName, inclusive }, {
      from: from ? [from] : [],
      to: to ? [to] : [],
      body,
    })
  })
}

/** Known compound type prefixes for text-based fallback parsing */
const COMPOUND_TYPE_PREFIXES = [
  'unsigned long long', 'long long', 'unsigned long', 'unsigned int',
  'unsigned short', 'unsigned char', 'long double', 'signed char',
]

/** Parse a parameter_declaration AST node into { type, name } */
function parseParamDeclaration(param: AstNode): { type: string; name: string } {
  const typeNode = param.namedChildren.find(c =>
    c.type === 'primitive_type' || c.type === 'type_identifier' ||
    c.type === 'qualified_identifier' || c.type === 'sized_type_specifier'
  )
  const declNode = param.namedChildren.find(c =>
    c.type === 'identifier' || c.type === 'pointer_declarator' ||
    c.type === 'reference_declarator' || c.type === 'array_declarator'
  )

  // If we have structured children, use them
  if (typeNode || declNode) {
    let type = typeNode?.text ?? 'int'
    let name = ''

    if (declNode) {
      if (declNode.type === 'pointer_declarator') {
        type += '*'
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? ''
      } else if (declNode.type === 'reference_declarator') {
        type += '&'
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? ''
      } else if (declNode.type === 'array_declarator') {
        // int arr[] → type stays, name is the identifier inside
        const innerIdent = declNode.namedChildren.find(c => c.type === 'identifier')
        name = innerIdent?.text ?? declNode.namedChildren[0]?.text ?? ''
        type += '[]'
      } else {
        name = declNode.text
      }
    }

    return { type, name }
  }

  // Fallback: parse from text (handles mock nodes and edge cases)
  return parseParamText(param.text.trim())
}

/** Parse a parameter text like "long long x" or "int *" into { type, name } */
function parseParamText(text: string): { type: string; name: string } {
  // Try compound type prefixes first
  for (const ct of COMPOUND_TYPE_PREFIXES) {
    if (text.startsWith(ct + ' ')) {
      const rest = text.slice(ct.length).trim()
      if (rest.startsWith('*') || rest.startsWith('&')) {
        return { type: ct + rest[0], name: rest.slice(1).trim() }
      }
      return { type: ct, name: rest }
    }
    if (text === ct) return { type: ct, name: '' }
  }
  // Simple: first token is type, rest is name
  const parts = text.split(/\s+/)
  if (parts.length === 1) return { type: parts[0], name: '' }
  return { type: parts[0], name: parts.slice(1).join(' ') }
}

/** Check if node is i += 1 (assignment_expression/augmented_assignment_expression with += and right == '1') */
function isCountingUpdate(node: AstNode): boolean {
  // tree-sitter C++ uses assignment_expression for compound assignments like +=
  if (node.type !== 'assignment_expression' && node.type !== 'augmented_assignment_expression') return false
  const op = node.children.find(c => !c.isNamed)?.text
  const right = node.childForFieldName('right')
  return op === '+=' && right?.text === '1'
}

/** Extract variable name from a declaration without init_declarator (e.g., `int i`) */
function extractDeclVarName(init: AstNode): string {
  const ident = init.namedChildren.find(c => c.type === 'identifier')
  return ident?.text ?? 'i'
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

/** Parse a doc comment into structured properties */
function parseDocComment(text: string): Record<string, string> {
  // Strip /** and */
  let body = text
  if (body.startsWith('/**')) body = body.slice(3)
  if (body.endsWith('*/')) body = body.slice(0, -2)
  // Clean up lines: remove leading whitespace and *
  const lines = body.split('\n').map(l => l.replace(/^\s*\*?\s?/, '').trim()).filter(l => l.length > 0)

  const props: Record<string, string> = {}
  const briefLines: string[] = []
  let paramIdx = 0

  for (const line of lines) {
    if (line.startsWith('@brief ')) {
      briefLines.push(line.slice(7).trim())
    } else if (line.startsWith('@param ')) {
      const rest = line.slice(7).trim()
      const spaceIdx = rest.indexOf(' ')
      if (spaceIdx > 0) {
        props[`param_${paramIdx}_name`] = rest.slice(0, spaceIdx)
        props[`param_${paramIdx}_desc`] = rest.slice(spaceIdx + 1).trim()
      } else {
        props[`param_${paramIdx}_name`] = rest
        props[`param_${paramIdx}_desc`] = ''
      }
      paramIdx++
    } else if (line.startsWith('@return ') || line.startsWith('@returns ')) {
      const tag = line.startsWith('@returns ') ? '@returns ' : '@return '
      props.return_desc = line.slice(tag.length).trim()
    } else if (!line.startsWith('@')) {
      briefLines.push(line)
    }
  }

  props.brief = briefLines.join('\n')
  return props
}
