/** `python:literal_string` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:literal_string', async (node) => ({
    type: 'string' as const,
    value: String(node.properties.value ?? ''),
  }))
}
