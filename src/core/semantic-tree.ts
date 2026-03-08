import type { SemanticNode, PropertyValue, SemanticModel } from './types'

let idCounter = 0

export function generateId(): string {
  return `node_${++idCounter}_${Date.now().toString(36)}`
}

export function resetIdCounter(): void {
  idCounter = 0
}

export function createEmptyProgram(): SemanticNode {
  return {
    id: generateId(),
    concept: 'program',
    properties: {},
    children: { body: [] },
  }
}

export function createNode(
  concept: string,
  properties: Record<string, PropertyValue> = {},
  children: Record<string, SemanticNode[]> = {},
): SemanticNode {
  return {
    id: generateId(),
    concept,
    properties,
    children,
  }
}

export function addChild(
  tree: SemanticNode,
  targetId: string,
  childName: string,
  child: SemanticNode,
): SemanticNode {
  if (tree.id === targetId) {
    const existingChildren = tree.children[childName] ?? []
    return {
      ...tree,
      children: {
        ...tree.children,
        [childName]: [...existingChildren, child],
      },
    }
  }

  const newChildren: Record<string, SemanticNode[]> = {}
  let changed = false
  for (const [key, nodes] of Object.entries(tree.children)) {
    const mapped = nodes.map(n => {
      const updated = addChild(n, targetId, childName, child)
      if (updated !== n) changed = true
      return updated
    })
    newChildren[key] = mapped
  }

  return changed ? { ...tree, children: newChildren } : tree
}

export function removeChild(
  tree: SemanticNode,
  targetId: string,
  childName: string,
  index: number,
): SemanticNode {
  if (tree.id === targetId) {
    const existing = tree.children[childName] ?? []
    const updated = [...existing.slice(0, index), ...existing.slice(index + 1)]
    return {
      ...tree,
      children: {
        ...tree.children,
        [childName]: updated,
      },
    }
  }

  const newChildren: Record<string, SemanticNode[]> = {}
  let changed = false
  for (const [key, nodes] of Object.entries(tree.children)) {
    const mapped = nodes.map(n => {
      const updated = removeChild(n, targetId, childName, index)
      if (updated !== n) changed = true
      return updated
    })
    newChildren[key] = mapped
  }

  return changed ? { ...tree, children: newChildren } : tree
}

export function updateProperty(
  tree: SemanticNode,
  targetId: string,
  key: string,
  value: PropertyValue,
): SemanticNode {
  if (tree.id === targetId) {
    return {
      ...tree,
      properties: { ...tree.properties, [key]: value },
    }
  }

  const newChildren: Record<string, SemanticNode[]> = {}
  let changed = false
  for (const [k, nodes] of Object.entries(tree.children)) {
    const mapped = nodes.map(n => {
      const updated = updateProperty(n, targetId, key, value)
      if (updated !== n) changed = true
      return updated
    })
    newChildren[k] = mapped
  }

  return changed ? { ...tree, children: newChildren } : tree
}

export function findById(tree: SemanticNode, id: string): SemanticNode | null {
  if (tree.id === id) return tree

  for (const nodes of Object.values(tree.children)) {
    for (const node of nodes) {
      const found = findById(node, id)
      if (found) return found
    }
  }

  return null
}

export function serializeTree(tree: SemanticNode): string {
  return JSON.stringify(tree)
}

export function deserializeTree(json: string): SemanticNode {
  return JSON.parse(json) as SemanticNode
}

/** 深比較兩個 SemanticNode 的語義是否等價（忽略 metadata） */
export function nodeEquals(a: SemanticNode, b: SemanticNode): boolean {
  if (a.concept !== b.concept) return false

  const aKeys = Object.keys(a.properties)
  const bKeys = Object.keys(b.properties)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a.properties[key] !== b.properties[key]) return false
  }

  const aChildKeys = Object.keys(a.children)
  const bChildKeys = Object.keys(b.children)
  if (aChildKeys.length !== bChildKeys.length) return false
  for (const key of aChildKeys) {
    const aChild = a.children[key]
    const bChild = b.children[key]
    if (bChild === undefined) return false
    if (aChild.length !== bChild.length) return false
    for (let i = 0; i < aChild.length; i++) {
      if (!nodeEquals(aChild[i], bChild[i])) return false
    }
  }

  return true
}

/** 深比較兩個 SemanticModel 的語義是否等價（忽略 metadata） */
export function semanticEquals(a: SemanticModel, b: SemanticModel): boolean {
  return nodeEquals(a.program, b.program)
}

/** 走訪 SemanticNode 樹 */
export function walkNodes(root: SemanticNode, visitor: (node: SemanticNode) => void): void {
  visitor(root)
  for (const children of Object.values(root.children)) {
    for (const node of children) {
      walkNodes(node, visitor)
    }
  }
}

/** 序列化 SemanticModel 為 JSON */
export function serializeModel(model: SemanticModel): string {
  return JSON.stringify(model)
}

/** 反序列化 JSON 為 SemanticModel */
export function deserializeModel(json: string): SemanticModel {
  return JSON.parse(json) as SemanticModel
}
