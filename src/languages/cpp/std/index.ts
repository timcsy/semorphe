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
import { registerExecutors as registerCmathExecutors } from './cmath/executors'

// cstdlib
import cstdlibConcepts from './cstdlib/concepts.json'
import cstdlibBlocks from './cstdlib/blocks.json'
import { registerGenerators as registerCstdlibGenerators } from './cstdlib/generators'
import { registerLifters as registerCstdlibLifters } from './cstdlib/lifters'

// cctype
import cctypeConcepts from './cctype/concepts.json'
import cctypeBlocks from './cctype/blocks.json'
import { registerGenerators as registerCctypeGenerators } from './cctype/generators'
import { registerLifters as registerCctypeLifters } from './cctype/lifters'

// numeric
import numericConcepts from './numeric/concepts.json'
import numericBlocks from './numeric/blocks.json'
import { registerGenerators as registerNumericGenerators } from './numeric/generators'
import { registerLifters as registerNumericLifters } from './numeric/lifters'

// sstream
import sstreamConcepts from './sstream/concepts.json'
import sstreamBlocks from './sstream/blocks.json'
import { registerGenerators as registerSstreamGenerators } from './sstream/generators'
import { registerLifters as registerSstreamLifters } from './sstream/lifters'

// fstream
import fstreamConcepts from './fstream/concepts.json'
import fstreamBlocks from './fstream/blocks.json'
import { registerGenerators as registerFstreamGenerators } from './fstream/generators'
import { registerLifters as registerFstreamLifters } from './fstream/lifters'

// utility
import utilityConcepts from './utility/concepts.json'
import utilityBlocks from './utility/blocks.json'
import { registerGenerators as registerUtilityGenerators } from './utility/generators'
import { registerLifters as registerUtilityLifters } from './utility/lifters'

/**
 * 這個模組的執行器**還在核心層**，等混住檔案的拆分（見 specs/054 的 Out of Scope）。
 *
 * 具名而非匿名 `() => {}`，是為了讓它可被搜尋——「顯式的待辦」與「遺漏」要分得出來。
 */
const executorsStillInCore: StdModule['registerExecutors'] = () => {}

function makeModule(
  header: string,
  concepts: unknown[],
  blocks: unknown[],
  registerGenerators: StdModule['registerGenerators'],
  registerLifters: StdModule['registerLifters'],
  registerExecutors: StdModule['registerExecutors'],
): StdModule {
  return {
    header,
    concepts: concepts as ConceptDefJSON[],
    blocks: blocks as BlockProjectionJSON[],
    registerGenerators,
    registerLifters,
    registerExecutors,
  }
}

export const allStdModules: StdModule[] = [
  makeModule('<iostream>', iostreamConcepts, iostreamBlocks, registerIostreamGenerators, registerIostreamLifters, executorsStillInCore),
  makeModule('<cstdio>', cstdioConcepts, cstdioBlocks, registerCstdioGenerators, registerCstdioLifters, executorsStillInCore),
  makeModule('<cstring>', cstringConcepts, cstringBlocks, registerCstringGenerators, registerCstringLifters, executorsStillInCore),
  makeModule('<vector>', vectorConcepts, vectorBlocks, registerVectorGenerators, registerVectorLifters, executorsStillInCore),
  makeModule('<algorithm>', algorithmConcepts, algorithmBlocks, registerAlgorithmGenerators, registerAlgorithmLifters, executorsStillInCore),
  makeModule('<string>', stringConcepts, stringBlocks, registerStringGenerators, registerStringLifters, executorsStillInCore),
  makeModule('<map>', mapConcepts, mapBlocks, registerMapGenerators, registerMapLifters, executorsStillInCore),
  makeModule('<stack>', stackConcepts, stackBlocks, registerStackGenerators, registerStackLifters, executorsStillInCore),
  makeModule('<queue>', queueConcepts, queueBlocks, registerQueueGenerators, registerQueueLifters, executorsStillInCore),
  makeModule('<set>', setConcepts, setBlocks, registerSetGenerators, registerSetLifters, executorsStillInCore),
  makeModule('<cmath>', cmathConcepts, cmathBlocks, registerCmathGenerators, registerCmathLifters, registerCmathExecutors),
  makeModule('<cstdlib>', cstdlibConcepts, cstdlibBlocks, registerCstdlibGenerators, registerCstdlibLifters, executorsStillInCore),
  makeModule('<cctype>', cctypeConcepts, cctypeBlocks, registerCctypeGenerators, registerCctypeLifters, executorsStillInCore),
  makeModule('<numeric>', numericConcepts, numericBlocks, registerNumericGenerators, registerNumericLifters, executorsStillInCore),
  makeModule('<sstream>', sstreamConcepts, sstreamBlocks, registerSstreamGenerators, registerSstreamLifters, executorsStillInCore),
  makeModule('<fstream>', fstreamConcepts, fstreamBlocks, registerFstreamGenerators, registerFstreamLifters, executorsStillInCore),
  makeModule('<utility>', utilityConcepts, utilityBlocks, registerUtilityGenerators, registerUtilityLifters, executorsStillInCore),
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
