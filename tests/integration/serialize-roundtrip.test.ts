import { describe, it, expect, beforeAll } from 'vitest'
import { renderToBlocklyState } from '../../src/core/projection/block-renderer'
import { createNode } from '../../src/core/semantic-tree'
import type { SemanticNode } from '../../src/core/types'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { IF_INPUTS, WHILE_INPUTS, COUNT_LOOP_INPUTS } from '../../src/blocks/block-input-names'

/**
 * Simulate Block Style switching: render semantic tree → block state → verify
 * that all input names in the state match what the runtime Blockly blocks expect.
 *
 * This is the cross-layer integration test that was missing — it verifies
 * the full path: SemanticNode → PatternRenderer/RenderStrategy → BlockState
 * produces input names consistent with app.new.ts dynamic registration.
 */

function makeProgram(...body: SemanticNode[]): SemanticNode {
  return { id: 'root', concept: 'program', properties: {}, children: { body } }
}

describe('serialize roundtrip: rendered block state matches runtime input names', () => {
  beforeAll(() => {
    setupTestRenderer()
  })

  it('u_if rendered state uses CONDITION and THEN (not COND/BODY)', () => {
    const ifStmt = createNode('if', {}, {
      condition: [createNode('var_ref', { name: 'x' })],
      then_body: [createNode('break', {})],
    })
    const state = renderToBlocklyState(makeProgram(ifStmt))
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_if')
    // Must use the same names as block-input-names.ts (derived from JSON)
    expect(block.inputs[IF_INPUTS.value[0]]).toBeDefined()     // CONDITION
    expect(block.inputs[IF_INPUTS.statement[0]]).toBeDefined()  // THEN
    // Must NOT have old names
    expect(block.inputs['COND']).toBeUndefined()
    expect(block.inputs['BODY']).toBeUndefined()
  })

  it('u_if with else uses CONDITION, THEN, ELSE', () => {
    const ifElse = createNode('if', {}, {
      condition: [createNode('compare', { operator: '>' }, {
        left: [createNode('var_ref', { name: 'a' })],
        right: [createNode('number_literal', { value: '0' })],
      })],
      then_body: [createNode('var_assign', { name: 'x' }, {
        value: [createNode('number_literal', { value: '1' })],
      })],
      else_body: [createNode('var_assign', { name: 'x' }, {
        value: [createNode('number_literal', { value: '2' })],
      })],
    })
    const state = renderToBlocklyState(makeProgram(ifElse))
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_if')
    expect(block.inputs[IF_INPUTS.value[0]]).toBeDefined()     // CONDITION
    expect(block.inputs[IF_INPUTS.statement[0]]).toBeDefined()  // THEN
    expect(block.inputs['ELSE']).toBeDefined()
    expect(block.inputs['COND']).toBeUndefined()
  })

  it('u_while_loop rendered state uses CONDITION and BODY', () => {
    const whileStmt = createNode('while_loop', {}, {
      condition: [createNode('var_ref', { name: 'running' })],
      body: [createNode('break', {})],
    })
    const state = renderToBlocklyState(makeProgram(whileStmt))
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_while_loop')
    expect(block.inputs[WHILE_INPUTS.value[0]]).toBeDefined()     // CONDITION
    expect(block.inputs[WHILE_INPUTS.statement[0]]).toBeDefined() // BODY
    expect(block.inputs['COND']).toBeUndefined()
  })

  it('u_count_loop rendered state uses FROM, TO, BODY', () => {
    const countLoop = createNode('count_loop', { var_name: 'i' }, {
      from: [createNode('number_literal', { value: '0' })],
      to: [createNode('number_literal', { value: '10' })],
      body: [createNode('break', {})],
    })
    const state = renderToBlocklyState(makeProgram(countLoop))
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_count_loop')
    expect(block.inputs[COUNT_LOOP_INPUTS.value[0]]).toBeDefined()     // FROM
    expect(block.inputs[COUNT_LOOP_INPUTS.value[1]]).toBeDefined()     // TO
    expect(block.inputs[COUNT_LOOP_INPUTS.statement[0]]).toBeDefined() // BODY
  })

  it('nested if inside while: all input names correct at both levels', () => {
    const nested = createNode('while_loop', {}, {
      condition: [createNode('var_ref', { name: 'ok' })],
      body: [
        createNode('if', {}, {
          condition: [createNode('var_ref', { name: 'flag' })],
          then_body: [createNode('break', {})],
        }),
      ],
    })
    const state = renderToBlocklyState(makeProgram(nested))
    const whileBlock = state.blocks.blocks[0]

    expect(whileBlock.type).toBe('u_while_loop')
    expect(whileBlock.inputs[WHILE_INPUTS.value[0]]).toBeDefined()

    const ifBlock = whileBlock.inputs[WHILE_INPUTS.statement[0]].block
    expect(ifBlock.type).toBe('u_if')
    expect(ifBlock.inputs[IF_INPUTS.value[0]]).toBeDefined()
    expect(ifBlock.inputs[IF_INPUTS.statement[0]]).toBeDefined()
    expect(ifBlock.inputs['COND']).toBeUndefined()
  })

  it('if-else-if-else chain flattened into single u_if with ELSEIF inputs', () => {
    // Semantic tree: nested if chain (as produced by lifter)
    // if (a > 0) { x = 1 } else if (b > 0) { x = 2 } else if (c > 0) { x = 3 } else { x = 4 }
    const ifChain = createNode('if', {}, {
      condition: [createNode('compare', { operator: '>' }, {
        left: [createNode('var_ref', { name: 'a' })],
        right: [createNode('number_literal', { value: '0' })],
      })],
      then_body: [createNode('var_assign', { name: 'x' }, {
        value: [createNode('number_literal', { value: '1' })],
      })],
      else_body: [createNode('if', { isElseIf: 'true' }, {
        condition: [createNode('compare', { operator: '>' }, {
          left: [createNode('var_ref', { name: 'b' })],
          right: [createNode('number_literal', { value: '0' })],
        })],
        then_body: [createNode('var_assign', { name: 'x' }, {
          value: [createNode('number_literal', { value: '2' })],
        })],
        else_body: [createNode('if', { isElseIf: 'true' }, {
          condition: [createNode('compare', { operator: '>' }, {
            left: [createNode('var_ref', { name: 'c' })],
            right: [createNode('number_literal', { value: '0' })],
          })],
          then_body: [createNode('var_assign', { name: 'x' }, {
            value: [createNode('number_literal', { value: '3' })],
          })],
          else_body: [createNode('var_assign', { name: 'x' }, {
            value: [createNode('number_literal', { value: '4' })],
          })],
        })],
      })],
    })

    const state = renderToBlocklyState(makeProgram(ifChain))
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_if')
    // Primary condition and body
    expect(block.inputs['CONDITION']).toBeDefined()
    expect(block.inputs['THEN']).toBeDefined()
    // Flattened else-if inputs (not nested u_if blocks)
    expect(block.inputs['ELSEIF_CONDITION_0']).toBeDefined()
    expect(block.inputs['ELSEIF_THEN_0']).toBeDefined()
    expect(block.inputs['ELSEIF_CONDITION_1']).toBeDefined()
    expect(block.inputs['ELSEIF_THEN_1']).toBeDefined()
    // Final else
    expect(block.inputs['ELSE']).toBeDefined()
    // extraState should reflect the structure
    expect(block.extraState).toEqual({ elseifCount: 2, hasElse: true })
    // Should NOT have nested u_if in ELSE
    expect(block.inputs['ELSE'].block.type).not.toBe('u_if')
  })

  it('if-else-if without final else', () => {
    const ifChain = createNode('if', {}, {
      condition: [createNode('var_ref', { name: 'a' })],
      then_body: [createNode('break', {})],
      else_body: [createNode('if', { isElseIf: 'true' }, {
        condition: [createNode('var_ref', { name: 'b' })],
        then_body: [createNode('continue', {})],
      })],
    })

    const state = renderToBlocklyState(makeProgram(ifChain))
    const block = state.blocks.blocks[0]

    expect(block.type).toBe('u_if')
    expect(block.inputs['ELSEIF_CONDITION_0']).toBeDefined()
    expect(block.inputs['ELSEIF_THEN_0']).toBeDefined()
    expect(block.inputs['ELSE']).toBeUndefined()
    expect(block.extraState).toEqual({ elseifCount: 1, hasElse: false })
  })

  it('u_negate rendered state has VALUE input with child expression', () => {
    const negateExpr = createNode('negate', {}, {
      value: [createNode('var_ref', { name: 'b' })],
    })
    const assign = createNode('var_assign', { name: 'result' }, {
      value: [negateExpr],
    })
    const state = renderToBlocklyState(makeProgram(assign))
    const assignBlock = state.blocks.blocks[0]

    expect(assignBlock.type).toBe('u_var_assign')
    // The negate block should be in the VALUE input of the assignment
    const valueInput = assignBlock.inputs['VALUE']
    expect(valueInput).toBeDefined()
    const negateBlock = valueInput.block
    expect(negateBlock.type).toBe('u_negate')
    // The negate block must have a VALUE input containing var_ref(b)
    expect(negateBlock.inputs['VALUE']).toBeDefined()
    expect(negateBlock.inputs['VALUE'].block).toBeDefined()
    expect(negateBlock.inputs['VALUE'].block.type).toBe('u_var_ref')
  })
})
