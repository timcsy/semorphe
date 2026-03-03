import type { BlockSpec, LanguageAdapter, LanguageModule, ParserModule, GeneratorModule } from '../../core/types'
import { CppParser } from './parser'
import { CppGenerator } from './generator'
import { CppLanguageAdapter } from './adapter'
import { BlockRegistry } from '../../core/block-registry'
import basicBlocks from './blocks/basic.json'
import specialBlocks from './blocks/special.json'
import advancedBlocks from './blocks/advanced.json'

/**
 * CppLanguageModule：包裝 C++ 的 Parser、Generator、Adapter 與積木定義。
 * 提供 LanguageModule 介面讓核心系統注入使用。
 */
export class CppLanguageModule implements LanguageModule {
  readonly languageId = 'cpp'

  private parser: CppParser
  private generator: CppGenerator
  private adapter: CppLanguageAdapter
  private blockSpecs: BlockSpec[]

  constructor(registry: BlockRegistry) {
    this.parser = new CppParser()
    this.adapter = new CppLanguageAdapter()
    this.generator = new CppGenerator(registry, this.adapter)
    this.blockSpecs = [
      ...basicBlocks as BlockSpec[],
      ...specialBlocks as BlockSpec[],
      ...advancedBlocks as BlockSpec[],
    ]
  }

  getParser(): ParserModule {
    return this.parser as unknown as ParserModule
  }

  getGenerator(): GeneratorModule {
    return this.generator as unknown as GeneratorModule
  }

  getBlockSpecs(): BlockSpec[] {
    return this.blockSpecs
  }

  getAdapter(): LanguageAdapter {
    return this.adapter
  }
}
