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
import { registerExecutors as registerCstdioExecutors } from './cstdio/executors'

// cstring
import cstringConcepts from './cstring/concepts.json'
import cstringBlocks from './cstring/blocks.json'
import { registerGenerators as registerCstringGenerators } from './cstring/generators'
import { registerLifters as registerCstringLifters } from './cstring/lifters'
import { registerExecutors as registerCstringExecutors } from './cstring/executors'

// vector
import vectorConcepts from './vector/concepts.json'
import vectorBlocks from './vector/blocks.json'
import { registerGenerators as registerVectorGenerators } from './vector/generators'
import { registerLifters as registerVectorLifters } from './vector/lifters'
import { registerExecutors as registerVectorExecutors } from './vector/executors'

// algorithm
import algorithmConcepts from './algorithm/concepts.json'
import algorithmBlocks from './algorithm/blocks.json'
import { registerGenerators as registerAlgorithmGenerators } from './algorithm/generators'
import { registerLifters as registerAlgorithmLifters } from './algorithm/lifters'
import { registerExecutors as registerAlgorithmExecutors } from './algorithm/executors'

// string
import stringConcepts from './string/concepts.json'
import stringBlocks from './string/blocks.json'
import { registerGenerators as registerStringGenerators } from './string/generators'
import { registerLifters as registerStringLifters } from './string/lifters'
import { registerExecutors as registerStringExecutors } from './string/executors'

// map
import mapConcepts from './map/concepts.json'
import mapBlocks from './map/blocks.json'
import { registerGenerators as registerMapGenerators } from './map/generators'
import { registerLifters as registerMapLifters } from './map/lifters'
import { registerExecutors as registerMapExecutors } from './map/executors'

// stack
import stackConcepts from './stack/concepts.json'
import stackBlocks from './stack/blocks.json'
import { registerGenerators as registerStackGenerators } from './stack/generators'
import { registerLifters as registerStackLifters } from './stack/lifters'
import { registerExecutors as registerStackExecutors } from './stack/executors'

// queue
import queueConcepts from './queue/concepts.json'
import queueBlocks from './queue/blocks.json'
import { registerGenerators as registerQueueGenerators } from './queue/generators'
import { registerLifters as registerQueueLifters } from './queue/lifters'
import { registerExecutors as registerQueueExecutors } from './queue/executors'

// set
import setConcepts from './set/concepts.json'
import setBlocks from './set/blocks.json'
import { registerGenerators as registerSetGenerators } from './set/generators'
import { registerLifters as registerSetLifters } from './set/lifters'
import { registerExecutors as registerSetExecutors } from './set/executors'

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
import { registerExecutors as registerCstdlibExecutors } from './cstdlib/executors'

// cctype
import cctypeConcepts from './cctype/concepts.json'
import cctypeBlocks from './cctype/blocks.json'
import { registerGenerators as registerCctypeGenerators } from './cctype/generators'
import { registerLifters as registerCctypeLifters } from './cctype/lifters'
import { registerCctypeExecutors } from './cctype/executors'

// numeric
import numericConcepts from './numeric/concepts.json'
import numericBlocks from './numeric/blocks.json'
import { registerGenerators as registerNumericGenerators } from './numeric/generators'
import { registerLifters as registerNumericLifters } from './numeric/lifters'
import { registerExecutors as registerNumericExecutors } from './numeric/executors'

// sstream
import sstreamConcepts from './sstream/concepts.json'
import sstreamBlocks from './sstream/blocks.json'
import { registerGenerators as registerSstreamGenerators } from './sstream/generators'
import { registerLifters as registerSstreamLifters } from './sstream/lifters'
import { registerExecutors as registerSstreamExecutors } from './sstream/executors'

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
import { registerExecutors as registerUtilityExecutors } from './utility/executors'

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
    // ⚠️ 蓋 owner 章。工具箱靠它把 `<map>` 的容器與 `<stack>` 的容器分開——
    // 兩者的 `category` 都是 `'containers'`，而它們該去不同的工具箱分類。
    blocks: (blocks as BlockProjectionJSON[]).map((b) => ({ ...b, owner: header })),
    registerGenerators,
    registerLifters,
    registerExecutors,
  }
}

export const allStdModules: StdModule[] = [
  makeModule('<iostream>', iostreamConcepts, iostreamBlocks, registerIostreamGenerators, registerIostreamLifters, executorsStillInCore),
  makeModule('<cstdio>', cstdioConcepts, cstdioBlocks, registerCstdioGenerators, registerCstdioLifters, registerCstdioExecutors),
  makeModule('<cstring>', cstringConcepts, cstringBlocks, registerCstringGenerators, registerCstringLifters, registerCstringExecutors),
  makeModule('<vector>', vectorConcepts, vectorBlocks, registerVectorGenerators, registerVectorLifters, registerVectorExecutors),
  makeModule('<algorithm>', algorithmConcepts, algorithmBlocks, registerAlgorithmGenerators, registerAlgorithmLifters, registerAlgorithmExecutors),
  makeModule('<string>', stringConcepts, stringBlocks, registerStringGenerators, registerStringLifters, registerStringExecutors),
  makeModule('<map>', mapConcepts, mapBlocks, registerMapGenerators, registerMapLifters, registerMapExecutors),
  makeModule('<stack>', stackConcepts, stackBlocks, registerStackGenerators, registerStackLifters, registerStackExecutors),
  makeModule('<queue>', queueConcepts, queueBlocks, registerQueueGenerators, registerQueueLifters, registerQueueExecutors),
  makeModule('<set>', setConcepts, setBlocks, registerSetGenerators, registerSetLifters, registerSetExecutors),
  makeModule('<cmath>', cmathConcepts, cmathBlocks, registerCmathGenerators, registerCmathLifters, registerCmathExecutors),
  makeModule('<cstdlib>', cstdlibConcepts, cstdlibBlocks, registerCstdlibGenerators, registerCstdlibLifters, registerCstdlibExecutors),
  makeModule('<cctype>', cctypeConcepts, cctypeBlocks, registerCctypeGenerators, registerCctypeLifters, registerCctypeExecutors),
  makeModule('<numeric>', numericConcepts, numericBlocks, registerNumericGenerators, registerNumericLifters, registerNumericExecutors),
  makeModule('<sstream>', sstreamConcepts, sstreamBlocks, registerSstreamGenerators, registerSstreamLifters, registerSstreamExecutors),
  makeModule('<fstream>', fstreamConcepts, fstreamBlocks, registerFstreamGenerators, registerFstreamLifters, executorsStillInCore),
  makeModule('<utility>', utilityConcepts, utilityBlocks, registerUtilityGenerators, registerUtilityLifters, registerUtilityExecutors),
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
  registry.registerConceptMapping('cpp:print', '<iostream>')
  registry.registerConceptMapping('cpp:input', '<iostream>')
  registry.registerConceptMapping('cpp:endl', '<iostream>')
  return registry
}
