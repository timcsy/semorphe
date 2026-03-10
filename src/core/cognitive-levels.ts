import type { CognitiveLevel } from './types'
import type { BlockSpecRegistry } from './block-spec-registry'

let globalBlockSpecRegistry: BlockSpecRegistry | null = null

/** Set the BlockSpecRegistry to use for level lookups */
export function setBlockSpecRegistry(registry: BlockSpecRegistry): void {
  globalBlockSpecRegistry = registry
}

/** Get the cognitive level for a block type. Unknown blocks default to L2. */
export function getBlockLevel(blockType: string): CognitiveLevel {
  if (globalBlockSpecRegistry) {
    return globalBlockSpecRegistry.getLevel(blockType)
  }
  return 2
}

/** Check if a block type is available at the given cognitive level */
export function isBlockAvailable(blockType: string, level: CognitiveLevel): boolean {
  return getBlockLevel(blockType) <= level
}

/** Filter a list of block types to those available at the given level */
export function filterBlocksByLevel(blockTypes: string[], level: CognitiveLevel): string[] {
  return blockTypes.filter(t => isBlockAvailable(t, level))
}
