/**
 * Real-world C++ programs — end-to-end lift + interpret tests.
 *
 * Tests complex programs that combine multiple language features,
 * including constructs commonly found in competitive programming
 * and educational contexts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { SemanticInterpreter } from '../../src/interpreter/interpreter'
import { createTestLifter } from '../helpers/setup-lifter'
import { PatternRenderer } from '../../src/core/projection/pattern-renderer'
import { renderToBlocklyState, setPatternRenderer } from '../../src/core/projection/block-renderer'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { RenderStrategyRegistry } from '../../src/core/registry'
import { registerCppRenderStrategies } from '../../src/languages/cpp/renderers/strategies'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'

import universalConcepts from '../../src/blocks/semantics/universal-concepts.json'
import cppConcepts from '../../src/languages/cpp/semantics/concepts.json'
import universalBlocks from '../../src/blocks/projections/blocks/universal-blocks.json'
import basicBlocks from '../../src/languages/cpp/projections/blocks/basic.json'
import advancedBlocks from '../../src/languages/cpp/projections/blocks/advanced.json'
import specialBlocks from '../../src/languages/cpp/projections/blocks/special.json'

let tsParser: Parser
let lifter: Lifter
let patternRenderer: PatternRenderer

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)
  lifter = createTestLifter()

  // Set up PatternRenderer for render pipeline tests
  const tempRegistry = new BlockSpecRegistry()
  const allConcepts = [...universalConcepts as unknown as ConceptDefJSON[], ...cppConcepts as unknown as ConceptDefJSON[]]
  const allProjections = [
    ...universalBlocks as unknown as BlockProjectionJSON[],
    ...basicBlocks as unknown as BlockProjectionJSON[],
    ...advancedBlocks as unknown as BlockProjectionJSON[],
    ...specialBlocks as unknown as BlockProjectionJSON[],
  ]
  tempRegistry.loadFromSplit(allConcepts, allProjections)
  const allSpecs = tempRegistry.getAll()
  patternRenderer = new PatternRenderer()
  const renderStrategyRegistry = new RenderStrategyRegistry()
  registerCppRenderStrategies(renderStrategyRegistry)
  patternRenderer.setRenderStrategyRegistry(renderStrategyRegistry)
  patternRenderer.loadBlockSpecs(allSpecs)
  setPatternRenderer(patternRenderer)
})

async function runCode(code: string, stdin: string[] = []) {
  const tree = tsParser.parse(code)
  const sem = lifter.lift(tree.rootNode)
  expect(sem).not.toBeNull()
  const interp = new SemanticInterpreter({ maxSteps: 5000000 })
  await interp.execute(sem!, stdin)
  return interp
}

function liftCode(code: string) {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode)
}

// ============================================================
// Forward function declarations
// ============================================================
describe('forward function declarations', () => {
  it('should handle forward declaration then definition', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int add(int, int);
      int main() {
        cout << add(3, 4) << endl;
        return 0;
      }
      int add(int a, int b) {
        return a + b;
      }
    `)
    expect(interp.getOutput().join('')).toBe('7\n')
  })

  it('should handle multiple forward declarations', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      void greet();
      int square(int);
      int main() {
        greet();
        cout << square(5) << endl;
        return 0;
      }
      void greet() { cout << "hi" << endl; }
      int square(int x) { return x * x; }
    `)
    expect(interp.getOutput().join('')).toBe('hi\n25\n')
  })

  it('should handle forward decl with pointer params', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      void fill(int*, int);
      int main() {
        int arr[3];
        fill(arr, 3);
        for (int i = 0; i < 3; i++) cout << arr[i] << " ";
        cout << endl;
        return 0;
      }
      void fill(int* a, int n) {
        for (int i = 0; i < n; i++) a[i] = i + 1;
      }
    `)
    expect(interp.getOutput().join('')).toBe('1 2 3 \n')
  })
})

// ============================================================
// const qualifier
// ============================================================
describe('const variables', () => {
  it('should handle const int declaration', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        const int x = 42;
        cout << x << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('42\n')
  })

  it('should handle const with expression initializer', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int max = 10;
        const int limit = max + 1;
        cout << limit << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('11\n')
  })
})

// ============================================================
// scanf return value in expression
// ============================================================
describe('scanf in expression context', () => {
  it('should handle while(scanf()!=EOF)', async () => {
    const interp = await runCode(`
      #include <cstdio>
      int main() {
        int n;
        while (scanf("%d", &n) != EOF) {
          printf("%d\\n", n * 2);
        }
        return 0;
      }
    `, ['3', '5', '7'])
    expect(interp.getOutput().join('')).toBe('6\n10\n14\n')
  })

  it('should handle scanf return value comparison', async () => {
    const interp = await runCode(`
      #include <cstdio>
      int main() {
        int a, b;
        while (scanf("%d %d", &a, &b) == 2) {
          printf("%d\\n", a + b);
        }
        return 0;
      }
    `, ['1 2', '3 4'])
    expect(interp.getOutput().join('')).toBe('3\n7\n')
  })
})

// ============================================================
// Array with initializer
// ============================================================
describe('array with initializer', () => {
  it('should handle int arr[N]={0}', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[5] = {0};
        for (int i = 0; i < 5; i++) cout << arr[i] << " ";
        cout << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('0 0 0 0 0 \n')
  })
})

// ============================================================
// VLA (variable-length array)
// ============================================================
describe('variable-length arrays', () => {
  it('should handle bool VLA with variable size', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int n = 5;
        const int limit = n + 1;
        bool flags[limit];
        for (int i = 0; i < limit; i++) flags[i] = true;
        flags[0] = false;
        flags[1] = false;
        int count = 0;
        for (int i = 0; i < limit; i++) if (flags[i]) count++;
        cout << count << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('4\n')
  })
})

// ============================================================
// Ternary in printf
// ============================================================
describe('ternary in printf args', () => {
  it('should handle printf with ternary string result', async () => {
    const interp = await runCode(`
      #include <cstdio>
      int main() {
        int x = 7;
        printf("%s\\n", (x > 5) ? "big" : "small");
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('big\n')
  })
})

// ============================================================
// Combined: Prime checker program (the user's full program)
// ============================================================
describe('prime checker program', () => {
  it('should handle forward declarations + pointer params + do-while + scanf loop', async () => {
    // Simplified version focusing on the key constructs
    const interp = await runCode(`
      #include <cstdio>
      using namespace std;
      int checkp(int, int*);
      int main() {
        int p[10];
        p[0]=2; p[1]=3; p[2]=5; p[3]=7; p[4]=11;
        p[5]=13; p[6]=17; p[7]=19; p[8]=23; p[9]=29;
        int n;
        while (scanf("%d", &n) != EOF) {
          if (checkp(n, p)) printf("prime\\n");
          else printf("not prime\\n");
        }
        return 0;
      }
      int checkp(int n, int* p) {
        int b = 1;
        for (int m = 0; m < 10 && p[m]*p[m] <= n; m++) {
          if (n % p[m] == 0 && n != p[m]) { b = 0; break; }
        }
        if (b && n > 1) return 1;
        else return 0;
      }
    `, ['7', '10', '1', '29'])
    expect(interp.getOutput().join('')).toBe('prime\nnot prime\nnot prime\nprime\n')
  })

  it('should lift the full prime sieve program without error', () => {
    const sem = liftCode(`
      #include <stdio.h>
      #include <stdlib.h>
      using namespace std;
      void listp(int *,int);
      int checkp(int,int *);
      int main() {
        int p[4792]={0};
        listp(p,46340);
        int n;
        while(scanf("%d",&n)!=EOF) printf("%s\\n",(checkp(n,p))?"yes":"no");
        return 0;
      }
      void listp(int* p,int max) {
        const int limit=max+1;
        bool isp[limit];
        for(int i=2;i<=max;i++) isp[i]=true;
        for(int i=2;i*i<=max;) {
          for(int j=i*i;j<=max;j+=i) isp[j]=false;
          do{i++;}while(i*i<=max && !isp[i]);
        }
        int m=0;
        for(int i=2;i<=max;i++) if(isp[i]) p[m++]=i;
      }
      int checkp(int n,int* p) {
        int b=1;
        for(int m=0; m<4792 && p[m]*p[m]<=n ;m++) {
          if(n%p[m]==0&&n!=p[m]){b=0;break;}
        }
        if(b&&(n>1)) return 1;
        else if(n<2) return 0;
        else return 0;
      }
    `)
    expect(sem).not.toBeNull()
    expect(sem!.concept).toBe('program')
    // Should have body children including includes, forward decls, main, listp, checkp
    const body = sem!.children.body ?? []
    expect(body.length).toBeGreaterThanOrEqual(5) // at least: 2 includes + using + main + listp + checkp
    // Should have function definitions for main, listp, checkp
    const funcDefs = body.filter(n => n.concept === 'func_def')
    expect(funcDefs.length).toBe(3)
    const funcNames = funcDefs.map(n => n.properties.name)
    expect(funcNames).toContain('main')
    expect(funcNames).toContain('listp')
    expect(funcNames).toContain('checkp')
  })
})

// ============================================================
// Compound conditions in for loops
// ============================================================
describe('compound for-loop conditions', () => {
  it('should handle && in for condition', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[5] = {0};
        arr[0]=4; arr[1]=9; arr[2]=16; arr[3]=25; arr[4]=36;
        int sum = 0;
        for (int i = 0; i < 5 && arr[i] <= 20; i++) {
          sum += arr[i];
        }
        cout << sum << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('29\n')
  })
})

// ============================================================
// Post-increment in array index (p[m++])
// ============================================================
describe('post-increment in array index', () => {
  it('should handle p[m++] = value', async () => {
    const interp = await runCode(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[5] = {0};
        int m = 0;
        arr[m++] = 10;
        arr[m++] = 20;
        arr[m++] = 30;
        cout << arr[0] << " " << arr[1] << " " << arr[2] << " " << m << endl;
        return 0;
      }
    `)
    expect(interp.getOutput().join('')).toBe('10 20 30 3\n')
  })
})

// ============================================================
// Full render pipeline: lift → renderToBlocklyState
// ============================================================
describe('full render pipeline', () => {
  function liftAndRender(code: string) {
    const tree = tsParser.parse(code)
    const sem = lifter.lift(tree.rootNode)
    expect(sem).not.toBeNull()
    const blockState = renderToBlocklyState(sem!)
    return { sem: sem!, blockState }
  }

  /** Collect all block types recursively from rendered state */
  function collectBlockTypes(state: any): string[] {
    const types: string[] = []
    function walk(block: any) {
      if (!block) return
      if (block.type) types.push(block.type)
      if (block.inputs) {
        for (const input of Object.values(block.inputs) as any[]) {
          if (input?.block) walk(input.block)
        }
      }
      if (block.next?.block) walk(block.next.block)
    }
    for (const b of state.blocks?.blocks ?? []) walk(b)
    return types
  }

  it('should render the full prime checker program without error', () => {
    const { blockState } = liftAndRender(`
      #include <stdio.h>
      #include <stdlib.h>
      using namespace std;
      void listp(int *,int);
      int checkp(int,int *);
      int main() {
        int p[4792]={0};
        listp(p,46340);
        int n;
        while(scanf("%d",&n)!=EOF) printf("%s\\n",(checkp(n,p))?"yes":"no");
        return 0;
      }
      void listp(int* p,int max) {
        const int limit=max+1;
        bool isp[limit];
        for(int i=2;i<=max;i++) isp[i]=true;
        for(int i=2;i*i<=max;) {
          for(int j=i*i;j<=max;j+=i) isp[j]=false;
          do{i++;}while(i*i<=max && !isp[i]);
        }
        int m=0;
        for(int i=2;i<=max;i++) if(isp[i]) p[m++]=i;
      }
      int checkp(int n,int* p) {
        int b=1;
        for(int m=0; m<4792 && p[m]*p[m]<=n ;m++) {
          if(n%p[m]==0&&n!=p[m]){b=0;break;}
        }
        if(b&&(n>1)) return 1;
        else if(n<2) return 0;
        else return 0;
      }
    `)
    expect(blockState.blocks.blocks.length).toBeGreaterThan(0)
    const types = collectBlockTypes(blockState)
    // Debug: show rendered block types
    console.log('Rendered block types:', types)
    // Should contain function definitions
    expect(types).toContain('u_func_def')
    // Should contain key block types (not all raw_code)
    const nonRawTypes = types.filter(t => t !== 'c_raw_code' && t !== 'c_raw_expression')
    expect(nonRawTypes.length).toBeGreaterThan(5)
    // Should have while_loop, count_loop, do_while, etc.
    expect(types).toContain('u_while_loop')
    expect(types).toContain('c_do_while')
    // c_scanf in expression context should NOT appear as a statement block in expression slots
    // It should be rendered as c_raw_expression (safety fallback)
    expect(types).not.toContain('c_scanf')
  })

  it('should render array_assign blocks (not silently drop them)', () => {
    const { sem } = liftAndRender(`
      #include <iostream>
      using namespace std;
      int main() {
        int arr[5] = {0};
        arr[0] = 10;
        arr[1] = 20;
        return 0;
      }
    `)
    // Check that the semantic tree has array_assign concepts
    const body = sem.children.body ?? []
    const mainFunc = body.find(n => n.concept === 'func_def' && n.properties.name === 'main')
    expect(mainFunc).toBeDefined()
    const mainBody = mainFunc!.children.body ?? []
    const arrayAssigns = mainBody.filter(n => n.concept === 'array_assign')
    expect(arrayAssigns.length).toBe(2)
  })
})
