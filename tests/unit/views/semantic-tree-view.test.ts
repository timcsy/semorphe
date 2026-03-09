import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { SemanticTreeView } from '../../../src/views/semantic-tree-view'
import type { SemanticNode } from '../../../src/core/types'

describe('SemanticTreeView', () => {
  it('should render a tree with concept names and properties', () => {
    const tree: SemanticNode = {
      id: 'root',
      concept: 'program',
      properties: {},
      children: {
        body: [
          {
            id: 'n1',
            concept: 'var_declare',
            properties: { type: 'int', name: 'x' },
            children: {
              init: [{
                id: 'n2',
                concept: 'number_literal',
                properties: { value: '5' },
                children: {},
              }],
            },
          },
          {
            id: 'n3',
            concept: 'print',
            properties: {},
            children: {
              values: [{
                id: 'n4',
                concept: 'var_ref',
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

    expect(html).toContain('program')
    expect(html).toContain('var_declare')
    expect(html).toContain('print')
    expect(html).toContain('number_literal')
    expect(html).toContain('var_ref')
    expect(html).toContain('int')
    expect(html).toContain('x')
  })

  it('should handle empty tree without error', () => {
    const emptyTree: SemanticNode = {
      id: 'root',
      concept: 'program',
      properties: {},
      children: {},
    }

    const view = new SemanticTreeView()
    const html = view.render(emptyTree)
    expect(html).toContain('program')
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
