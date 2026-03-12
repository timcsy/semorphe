import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'

const style = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout', naming_convention: 'camelCase',
  indent_size: 4, brace_style: 'K&R', namespace_style: 'using', header_style: 'individual',
}

async function main() {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  const parser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  parser.setLanguage(lang)
  const lifter = createTestLifter()
  registerCppLanguage()

  const code = `#include <iostream>
using namespace std;
int main() {
    int day = 3;
    switch (day) {
        case 1:
            cout << "Mon" << endl;
            break;
        case 2:
            cout << "Tue" << endl;
            break;
        case 3:
            cout << "Wed" << endl;
            break;
        default:
            cout << "Other" << endl;
            break;
    }
    return 0;
}`

  const tree = parser.parse(code)
  const sem = lifter.lift(tree.rootNode as any)
  const gen1 = generateCode(sem!, 'cpp', style as any)
  console.log('=== gen1 ===')
  console.log(gen1)
  const tree2 = parser.parse(gen1)
  const sem2 = lifter.lift(tree2.rootNode as any)
  const gen2 = generateCode(sem2!, 'cpp', style as any)
  console.log('MATCH:', gen1 === gen2)
}
main().catch(console.error)
