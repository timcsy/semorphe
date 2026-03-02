import * as Blockly from 'blockly'
import type { BlockRegistry, ToolboxDefinition } from '../core/block-registry'
import type { BlockSpec } from '../core/types'

export class BlocklyEditor {
  private workspace: Blockly.WorkspaceSvg | null = null
  private container: HTMLElement
  private onChangeCallback: ((workspace: unknown) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  init(registry: BlockRegistry): void {
    // Register all blocks with Blockly
    this.registerBlocks(registry)

    // Create workspace with toolbox
    const toolboxDef = registry.toToolboxDef()
    this.workspace = Blockly.inject(this.container, {
      toolbox: this.convertToolbox(toolboxDef),
      grid: { spacing: 20, length: 3, colour: '#ccc', snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
      trashcan: true,
    })

    // Listen for changes
    this.workspace.addChangeListener((event: Blockly.Events.Abstract) => {
      if (event.isUiEvent) return
      if (this.onChangeCallback) {
        const state = Blockly.serialization.workspaces.save(this.workspace!)
        this.onChangeCallback(state)
      }
    })
  }

  onChange(callback: (workspace: unknown) => void): void {
    this.onChangeCallback = callback
  }

  getState(): unknown {
    if (!this.workspace) return { blocks: { languageVersion: 0, blocks: [] } }
    return Blockly.serialization.workspaces.save(this.workspace)
  }

  setState(state: unknown): void {
    if (!this.workspace) return
    Blockly.serialization.workspaces.load(state as object, this.workspace)
  }

  updateToolbox(registry: BlockRegistry): void {
    if (!this.workspace) return
    this.registerBlocks(registry)
    const toolboxDef = registry.toToolboxDef()
    this.workspace.updateToolbox(this.convertToolbox(toolboxDef) as Blockly.utils.toolbox.ToolboxDefinition)
  }

  dispose(): void {
    if (this.workspace) {
      this.workspace.dispose()
      this.workspace = null
    }
  }

  private registerBlocks(registry: BlockRegistry): void {
    // Get all categories and register each block's blockDef with Blockly
    const categories = new Set<string>()
    const allSpecs: BlockSpec[] = []

    // Collect all block specs by iterating categories
    for (const cat of ['variables', 'values', 'operators', 'conditions', 'loops', 'arrays',
      'functions', 'io', 'pointers', 'structures', 'strings', 'containers',
      'algorithms', 'oop', 'templates', 'special', 'preprocessor', 'containers_adv']) {
      const ids = registry.getByCategory(cat)
      for (const id of ids) {
        const spec = registry.get(id)
        if (spec) {
          categories.add(cat)
          allSpecs.push(spec)
        }
      }
    }

    for (const spec of allSpecs) {
      // Only register if not already registered
      if (!Blockly.Blocks[spec.id]) {
        Blockly.Blocks[spec.id] = {
          init: function (this: Blockly.Block) {
            this.jsonInit(spec.blockDef as object)
          },
        }
      }
    }
  }

  private convertToolbox(def: ToolboxDefinition): object {
    return {
      kind: 'categoryToolbox',
      contents: def.contents.map(cat => ({
        kind: 'category',
        name: cat.name,
        contents: cat.contents.map(block => ({
          kind: 'block',
          type: block.type,
        })),
      })),
    }
  }
}
