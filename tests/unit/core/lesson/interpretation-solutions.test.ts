import { describe, it, expect } from 'vitest'
import { pickSolution } from '../../../../src/core/lesson/load-lessons'

const files = {
  '/lessons/c/01/solutions/ex1.c': 'MAIN',
  '/lessons/c/01/solutions/ex1~zero.c': 'ZERO',
  '/lessons/c/01/solutions/ex1~eof.c': 'EOF',
  '/lessons/c/01/solutions/ex10.c': 'TEN',
  '/lessons/c/01/solutions/make.cpp': 'MAKE',
}

describe('解答檔的挑法（spec 218 R3）', () => {
  it('🔴 只比對 <task>.<ext>——不得撈到 <task>~<解讀>.<ext>、也不得撈到 ex10', () => {
    expect(pickSolution(files, 'c/01', 'ex1')).toBe('MAIN')
    expect(pickSolution(files, 'c/01', 'make')).toBe('MAKE')
  })
  it('解讀的解答：<task>~<id>.<ext>', () => {
    expect(pickSolution(files, 'c/01', 'ex1', 'zero')).toBe('ZERO')
    expect(pickSolution(files, 'c/01', 'ex1', 'eof')).toBe('EOF')
    expect(pickSolution(files, 'c/01', 'ex1', 'nope')).toBeUndefined()
  })
  it('沒有就是 undefined', () => {
    expect(pickSolution(files, 'c/01', 'ex2')).toBeUndefined()
  })
})
