import type { BlockSpec, BlockOverride, BlockArgOverride } from '../types'

export function mergeArgs(
  baseArgs: Array<Record<string, unknown>>,
  overrideArgs: BlockArgOverride[]
): Array<Record<string, unknown>> {
  const result = baseArgs.map((a) => ({ ...a }))

  for (const override of overrideArgs) {
    if (override._remove) {
      const idx = result.findIndex((a) => a.name === override.name)
      if (idx !== -1) {
        result.splice(idx, 1)
      }
      continue
    }

    const existingIdx = result.findIndex((a) => a.name === override.name)
    if (existingIdx !== -1) {
      const { _remove, _insert, ...fields } = override
      result[existingIdx] = { ...result[existingIdx], ...fields }
    } else {
      const { _remove, _insert, ...fields } = override
      result.push(fields as Record<string, unknown>)
    }
  }

  return result
}

export function applyBlockOverride(spec: BlockSpec, override: BlockOverride): BlockSpec {
  const newSpec = { ...spec }
  const blockDef = { ...(spec.blockDef as Record<string, unknown>) }

  if (override.message !== undefined) {
    blockDef.message0 = override.message
  }

  if (override.tooltip !== undefined) {
    blockDef.tooltip = override.tooltip
  }

  if (override.args) {
    const baseArgs = (blockDef.args0 as Array<Record<string, unknown>>) ?? []
    blockDef.args0 = mergeArgs(baseArgs, override.args)
  }

  newSpec.blockDef = blockDef

  if (override.renderMapping && spec.renderMapping) {
    newSpec.renderMapping = {
      ...spec.renderMapping,
      ...override.renderMapping,
      fields: {
        ...spec.renderMapping.fields,
        ...(override.renderMapping.fields ?? {}),
      },
      inputs: {
        ...spec.renderMapping.inputs,
        ...(override.renderMapping.inputs ?? {}),
      },
      statementInputs: {
        ...spec.renderMapping.statementInputs,
        ...(override.renderMapping.statementInputs ?? {}),
      },
    }
  } else if (override.renderMapping) {
    newSpec.renderMapping = override.renderMapping as BlockSpec['renderMapping']
  }

  return newSpec
}
