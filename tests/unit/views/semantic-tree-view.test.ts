import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { SemanticNode } from '../../../src/core/types'

/**
 * ⚠️ **這個類別原本住在 `src/views/`，是一個假的視圖**——它的檔頭逐字寫著：
 *
 * > 「Dummy read-only view … **Used to verify** that the component/blockDef split
 * > enables views independent of the Blockly projection layer」
 *
 * 它成功了：`ViewHost` 契約與視圖登錄表（`src/core/view-registry.ts`）
 * 現在持續證明著同一件事。而一個**完成任務的假實作**繼續佔一個頂層目錄，
 * 會讓讀者以為 `src/views/` 是一個產品層。
 *
 * > **一個為了否證而寫的實作，它的歸宿是測試，不是原始碼樹。**
 *
 * 搬進來之後它保護的性質**沒有變弱**：它只 import `SemanticNode` 這個型別，
 * 所以哪天核心的型別需要 Blockly 才能用，這支測試就會壞。
 */
class SemanticTreeView {

  render(root: SemanticNode): string {
    return `<div class="semantic-tree">${this.renderNode(root, 0)}</div>`
  }

  private renderNode(node: SemanticNode, depth: number): string {
    const indent = '  '.repeat(depth)
    const props = Object.entries(node.properties)
      .map(([k, v]) => `<span class="prop">${k}=${String(v)}</span>`)
      .join(' ')

    const childrenHtml = Object.entries(node.children)
      .map(([name, nodes]) =>
        `${indent}  <div class="child-group" data-name="${name}">` +
        nodes.map(child => this.renderNode(child, depth + 2)).join('') +
        `${indent}  </div>`
      )
      .join('')

    return (
      `${indent}<div class="node" data-component="${node.componentId}">` +
      `<span class="component">${node.componentId}</span>` +
      (props ? ` ${props}` : '') +
      (childrenHtml ? `\n${childrenHtml}\n${indent}` : '') +
      `</div>\n`
    )
  }
}

describe('SemanticTreeView', () => {
  it('should render a tree with component names and properties', () => {
    const tree: SemanticNode = {
      id: 'root',
      componentId: 'cpp:program',
      properties: {},
      children: {
        body: [
          {
            id: 'n1',
            componentId: 'cpp:var_declare',
            properties: { type: 'int', name: 'x' },
            children: {
              init: [{
                id: 'n2',
                componentId: 'cpp:literal_number',
                properties: { value: '5' },
                children: {},
              }],
            },
          },
          {
            id: 'n3',
            componentId: 'cpp:print',
            properties: {},
            children: {
              values: [{
                id: 'n4',
                componentId: 'cpp:var_ref',
                properties: { name: 'x' },
                children: {},
              }],
            },
          },
        ],
      },
    }

    const view = new SemanticTreeView()
    const html = view.render(tree)

    expect(html).toContain('cpp:program')
    expect(html).toContain('cpp:var_declare')
    expect(html).toContain('cpp:print')
    expect(html).toContain('cpp:literal_number')
    expect(html).toContain('cpp:var_ref')
    expect(html).toContain('int')
    expect(html).toContain('x')
  })

  it('should handle empty tree without error', () => {
    const emptyTree: SemanticNode = {
      id: 'root',
      componentId: 'cpp:program',
      properties: {},
      children: {},
    }

    const view = new SemanticTreeView()
    const html = view.render(emptyTree)
    expect(html).toContain('cpp:program')
  })

  /**
   * ⚠️ **這兩支的掃描對象換過（2026-08-12，spec 117）。**
   *
   * 它們原本掃 `src/views/semantic-tree-view.ts`——**一個假的視圖**——
   * 證明「只依賴 core 的視圖是可能的」。而那個假視圖搬進本檔之後，
   * 掃描的對象就沒了。
   *
   * 換成掃**契約本身**（`view-host.ts` ＋ `view-registry.ts`）比原本**更強**：
   *
   * > **原本守的是「有一個假實作沒 import Blockly」，
   * > 現在守的是「所有視圖都必須實作的那份契約沒 import Blockly」。**
   *
   * 若契約本身認識 Blockly，「視圖可抽換」這句話就是假的——
   * 而硬體的 2D／3D 面板正是那個抽換。
   */
  const contractFiles = ['view-host.ts', 'view-registry.ts']

  it('★ 視圖契約不得 import blockly（靜態掃描）', () => {
    for (const f of contractFiles) {
      const content = fs.readFileSync(path.resolve(__dirname, '../../../src/core', f), 'utf-8')
      expect(content, `${f} import 了 blockly → 「視圖可抽換」是假的`).not.toContain("from 'blockly'")
      expect(content).not.toContain('from "blockly"')
    }
  })

  it('★ 視圖契約不得 import 投影或面板（靜態掃描）', () => {
    for (const f of contractFiles) {
      const content = fs.readFileSync(path.resolve(__dirname, '../../../src/core', f), 'utf-8')
      expect(content, `${f} import 了 projections/`).not.toContain('projections/')
      expect(content, `${f} import 了 panels/`).not.toContain('panels/')
    }
  })

  it('★ 反向：掃描真的讀到了檔案內容', () => {
    // 沒有這一支，路徑打錯時上面兩支會因為「空字串不含 blockly」而**假綠**。
    for (const f of contractFiles) {
      const content = fs.readFileSync(path.resolve(__dirname, '../../../src/core', f), 'utf-8')
      expect(content.length, `${f} 讀到空內容 → 掃描壞了`).toBeGreaterThan(200)
    }
  })
})
