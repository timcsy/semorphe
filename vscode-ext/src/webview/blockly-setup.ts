import { BlocklyPanel } from '../../../src/ui/panels/blockly-panel'
import type { BlocklyPanelOptions } from '../../../src/ui/panels/blockly-panel'

export type { BlocklyPanelOptions }

/**
 * VSCode WebView variant — simply re-exports BlocklyPanel.
 * Media path is now handled via BlocklyPanelOptions.media.
 */
export class VscodeBlocklyPanel extends BlocklyPanel {
  constructor(options: BlocklyPanelOptions) {
    super(options)
  }
}
