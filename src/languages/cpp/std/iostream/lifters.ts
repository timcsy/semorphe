import type { Lifter } from '../../../../core/lift/lifter'

export function registerIostreamLifters(_lifter: Lifter): void {
  // cout/cin chain detection is handled in the core expressions lifter
  // (binary_expression with << / >> operators)
  // No additional iostream-specific lifter registrations needed
}
