#!/usr/bin/env python3
"""把 Cella 的「Python 元件 → python.ast」對照表同步進這個 repo（spec 195）。

來源（姊妹 repo，cella 維護）：
  packages/python/docs/components.json    對照表：每顆元件的模板、具名轉換、運算子表
  tools/python/component_map_check.py     參考實作（`Expander`）＋ 範例（元件實例 → generate.ts 產生的 Python）

產出（進版本控制，測試不依賴姊妹 repo）：
  src/components/python/<name>/formalize.json    那顆元件的模板——**formalize 是元件自己的動詞**（第 389 刀），不是一張中央大表
  src/providers/cella/formalize/python-tables.json   運算子表（四張，元件共用）
  tests/fixtures/python-component-map.json      範例：元件實例 ＋ 照 CPython ast 轉出的預期樹（不含節點 id）

用法：python3 tools/sync-python-formalize.py [cella 的路徑，預設 ../cella]
"""
import json, os, subprocess, sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
CELLA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'cella'))
sys.path.insert(0, os.path.join(CELLA, 'tools', 'python'))
import component_map_check as cm  # noqa: E402
from py_to_json import convert  # noqa: E402

table = json.load(open(os.path.join(CELLA, 'packages/python/docs/components.json')))
rev = subprocess.run(['git', '-C', CELLA, 'log', '-1', '--format=%h', '--', 'packages/python/docs/components.json'],
                     capture_output=True, text=True).stdout.strip()
source = f'cella packages/python/docs/components.json @ {rev}'

# ① 每顆元件的模板，放進它自己的膠囊
written = 0
for cid, tmpl in table['components'].items():
    name = cid.split(':', 1)[1]
    d = os.path.join(ROOT, 'src/components/python', name)
    if not os.path.isdir(d):
        print(f'  ⚠️ 對照表有、這個 repo 沒有的元件：{cid}')
        continue
    with open(os.path.join(d, 'formalize.json'), 'w') as f:
        json.dump({'_source': source, 'template': tmpl}, f, ensure_ascii=False, indent=2)
        f.write('\n')
    written += 1

# ② 運算子表
with open(os.path.join(ROOT, 'src/providers/cella/formalize/python-tables.json'), 'w') as f:
    json.dump({'_source': source, **table['tables']}, f, ensure_ascii=False, indent=2)
    f.write('\n')

# ③ 範例：實例照 N 的形狀序列化；預期樹照參考實作的比法（敘述位置、program 整棵）
def ser(x):
    return {'id': x.id, 'componentId': 'python:' + x.comp, 'properties': x.props,
            'slots': {k: [ser(c) for c in v] for k, v in x.slots.items()}}

cases = []
for comp, x, src in cm.examples():
    whole = comp == 'program'
    want = convert(src) if whole else convert(src)['body'][0]
    cases.append({'component': comp, 'src': src, 'statement': not whole, 'instance': ser(x), 'want': cm.strip(want)})
with open(os.path.join(ROOT, 'tests/fixtures/python-component-map.json'), 'w') as f:
    json.dump({'_source': source, 'statementRole': sorted(cm.STATEMENT_ROLE), 'cases': cases}, f, ensure_ascii=False, indent=1)
    f.write('\n')

print(f'模板 {written} 顆、範例 {len(cases)} 個（{source}）')
