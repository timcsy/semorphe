import { describe, it } from 'vitest'
import { liftPython, generatePython, componentIdsOf } from '../helpers/python-lift'
describe('P0', () => {
  it('方法呼叫', async () => {
    const t = await liftPython('nums.append(9)\nprint(1)\n')
    console.log('IDS: ' + JSON.stringify(componentIdsOf(t)))
    console.log('OUT: ' + JSON.stringify(generatePython(t)))
  })
  it('f-string', async () => {
    const t = await liftPython('print(f"hi {n}")\n')
    console.log('IDS: ' + JSON.stringify(componentIdsOf(t)))
    console.log('OUT: ' + JSON.stringify(generatePython(t)))
  })
})
