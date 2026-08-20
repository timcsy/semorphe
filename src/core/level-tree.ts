import type { LevelNode, Topic } from './types'

export interface DoublingWarning {
  nodeId: string
  parentId: string
  message: string
  severity: 'warning'
}

export function getVisibleConcepts(topic: Topic, enabledBranches: Set<string>): Set<string> {
  const result = new Set<string>()
  collectConcepts(topic.levelTree, enabledBranches, result)
  return result
}

function collectConcepts(node: LevelNode, enabledBranches: Set<string>, result: Set<string>): void {
  if (!enabledBranches.has(node.id)) return
  for (const concept of node.concepts) {
    result.add(concept)
  }
  for (const child of node.children) {
    collectConcepts(child, enabledBranches, result)
  }
}

export function flattenLevelTree(root: LevelNode): LevelNode[] {
  const result: LevelNode[] = []
  flatten(root, result)
  return result
}

function flatten(node: LevelNode, result: LevelNode[]): void {
  result.push(node)
  for (const child of node.children) {
    flatten(child, result)
  }
}

export function resolveEnabledBranches(root: LevelNode, selected: Set<string>): Set<string> {
  const result = new Set<string>()
  resolveAncestors(root, selected, result)
  return result
}

function resolveAncestors(node: LevelNode, selected: Set<string>, result: Set<string>): boolean {
  let needed = selected.has(node.id)
  for (const child of node.children) {
    if (resolveAncestors(child, selected, result)) {
      needed = true
    }
  }
  if (needed) {
    result.add(node.id)
  }
  return needed
}

export function validateDoublingGuideline(root: LevelNode): DoublingWarning[] {
  const warnings: DoublingWarning[] = []
  validateNode(root, warnings)
  return warnings
}

function validateNode(node: LevelNode, warnings: DoublingWarning[]): void {
  const parentCount = node.concepts.length
  for (const child of node.children) {
    const childCount = child.concepts.length
    if (parentCount > 0 && childCount > parentCount * 2) {
      warnings.push({
        nodeId: child.id,
        parentId: node.id,
        message: `Node "${child.id}" has ${childCount} concepts, more than double its parent "${node.id}" (${parentCount})`,
        severity: 'warning',
      })
    }
    validateNode(child, warnings)
  }
}

export function isConceptVisible(
  componentId: string,
  topic: Topic,
  enabledBranches: Set<string>
): boolean {
  const visible = getVisibleConcepts(topic, enabledBranches)
  return visible.has(componentId)
}
