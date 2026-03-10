export type { StdModule } from './types'
export { ModuleRegistry } from './module-registry'
export type { DependencyEdge, DependencyResolver } from '../../../core/dependency-resolver'

import type { StdModule } from './types'
import { ModuleRegistry } from './module-registry'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../../core/types'

// iostream
import iostreamConcepts from './iostream/concepts.json'
import iostreamBlocks from './iostream/blocks.json'
import { registerIostreamGenerators } from './iostream/generators'
import { registerIostreamLifters } from './iostream/lifters'

// cstdio
import cstdioConcepts from './cstdio/concepts.json'
import cstdioBlocks from './cstdio/blocks.json'
import { registerCstdioGenerators } from './cstdio/generators'
import { registerCstdioLifters } from './cstdio/lifters'

// cstring
import cstringConcepts from './cstring/concepts.json'
import cstringBlocks from './cstring/blocks.json'
import { registerGenerators as registerCstringGenerators } from './cstring/generators'
import { registerLifters as registerCstringLifters } from './cstring/lifters'

// vector
import vectorConcepts from './vector/concepts.json'
import vectorBlocks from './vector/blocks.json'
import { registerGenerators as registerVectorGenerators } from './vector/generators'
import { registerLifters as registerVectorLifters } from './vector/lifters'

// algorithm
import algorithmConcepts from './algorithm/concepts.json'
import algorithmBlocks from './algorithm/blocks.json'
import { registerGenerators as registerAlgorithmGenerators } from './algorithm/generators'
import { registerLifters as registerAlgorithmLifters } from './algorithm/lifters'

// string
import stringConcepts from './string/concepts.json'
import stringBlocks from './string/blocks.json'
import { registerGenerators as registerStringGenerators } from './string/generators'
import { registerLifters as registerStringLifters } from './string/lifters'

// map
import mapConcepts from './map/concepts.json'
import mapBlocks from './map/blocks.json'
import { registerGenerators as registerMapGenerators } from './map/generators'
import { registerLifters as registerMapLifters } from './map/lifters'

// stack
import stackConcepts from './stack/concepts.json'
import stackBlocks from './stack/blocks.json'
import { registerGenerators as registerStackGenerators } from './stack/generators'
import { registerLifters as registerStackLifters } from './stack/lifters'

// queue
import queueConcepts from './queue/concepts.json'
import queueBlocks from './queue/blocks.json'
import { registerGenerators as registerQueueGenerators } from './queue/generators'
import { registerLifters as registerQueueLifters } from './queue/lifters'

// set
import setConcepts from './set/concepts.json'
import setBlocks from './set/blocks.json'
import { registerGenerators as registerSetGenerators } from './set/generators'
import { registerLifters as registerSetLifters } from './set/lifters'

// cmath
import cmathConcepts from './cmath/concepts.json'
import cmathBlocks from './cmath/blocks.json'
import { registerGenerators as registerCmathGenerators } from './cmath/generators'
import { registerLifters as registerCmathLifters } from './cmath/lifters'

function makeModule(
  header: string,
  concepts: unknown[],
  blocks: unknown[],
  registerGenerators: StdModule['registerGenerators'],
  registerLifters: StdModule['registerLifters'],
): StdModule {
  return {
    header,
    concepts: concepts as ConceptDefJSON[],
    blocks: blocks as BlockProjectionJSON[],
    registerGenerators,
    registerLifters,
  }
}

export const allStdModules: StdModule[] = [
  makeModule('<iostream>', iostreamConcepts, iostreamBlocks, registerIostreamGenerators, registerIostreamLifters),
  makeModule('<cstdio>', cstdioConcepts, cstdioBlocks, registerCstdioGenerators, registerCstdioLifters),
  makeModule('<cstring>', cstringConcepts, cstringBlocks, registerCstringGenerators, registerCstringLifters),
  makeModule('<vector>', vectorConcepts, vectorBlocks, registerVectorGenerators, registerVectorLifters),
  makeModule('<algorithm>', algorithmConcepts, algorithmBlocks, registerAlgorithmGenerators, registerAlgorithmLifters),
  makeModule('<string>', stringConcepts, stringBlocks, registerStringGenerators, registerStringLifters),
  makeModule('<map>', mapConcepts, mapBlocks, registerMapGenerators, registerMapLifters),
  makeModule('<stack>', stackConcepts, stackBlocks, registerStackGenerators, registerStackLifters),
  makeModule('<queue>', queueConcepts, queueBlocks, registerQueueGenerators, registerQueueLifters),
  makeModule('<set>', setConcepts, setBlocks, registerSetGenerators, registerSetLifters),
  makeModule('<cmath>', cmathConcepts, cmathBlocks, registerCmathGenerators, registerCmathLifters),
]

/**
 * Create a fully populated ModuleRegistry with all concept→header mappings.
 * Includes both auto-registered concepts (from concepts.json) and
 * manual mappings for universal concepts whose generators live in std modules.
 */
export function createPopulatedRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry()
  for (const mod of allStdModules) {
    registry.register(mod)
  }
  // Universal I/O concepts — not in any concepts.json but generated by iostream
  registry.registerConceptMapping('print', '<iostream>')
  registry.registerConceptMapping('input', '<iostream>')
  registry.registerConceptMapping('endl', '<iostream>')
  return registry
}
