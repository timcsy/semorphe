import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { SemanticTreeView } from '../../../src/views/semantic-tree-view'
import type { SemanticNode } from '../../../src/core/types'

describe('SemanticTreeView', () => {
  it('should render a tree with concept names and properties', () => {
    const tree: SemanticNode = {
      id: 'root',
      conceptId: 'lang:program',
      properties: {},
      children: {
        body: [
          {
            id: 'n1',
            conceptId: 'lang:var_declare',
            properties: { type: 'int', name: 'x' },
            children: {
              init: [{
                id: 'n2',
                conceptId: 'lang:number_literal',
                properties: { value: '5' },
                children: {},
              }],
            },
          },
          {
            id: 'n3',
            conceptId: 'lang:print',
            properties: {},
            children: {
              values: [{
                id: 'n4',
                conceptId: 'lang:var_ref',
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

    expect(html).toContain('lang:program')
    expect(html).toContain('lang:var_declare')
    expect(html).toContain('lang:print')
    expect(html).toContain('lang:number_literal')
    expect(html).toContain('lang:var_ref')
    expect(html).toContain('int')
    expect(html).toContain('x')
  })

  it('should handle empty tree without error', () => {
    const emptyTree: SemanticNode = {
      id: 'root',
      conceptId: 'lang:program',
      properties: {},
      children: {},
    }

    const view = new SemanticTreeView()
    const html = view.render(emptyTree)
    expect(html).toContain('lang:program')
  })

  it('semantic-tree-view.ts should not import blockly (static analysis)', () => {
    const filePath = path.resolve(__dirname, '../../../src/views/semantic-tree-view.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain("from 'blockly'")
    expect(content).not.toContain('from "blockly"')
  })

  it('semantic-tree-view.ts should not import projections or panels (static analysis)', () => {
    const filePath = path.resolve(__dirname, '../../../src/views/semantic-tree-view.ts')
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).not.toContain('projections/')
    expect(content).not.toContain('panels/')
  })
})
