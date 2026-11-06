/**
 * **執行覆蓋與類別**（元件管線 322 的瀏覽器驗收抓到）：原本每一個類別定義都被標成「這一次沒有被跑到」
 * ——類別定義不是會被執行的語句，Cella 的執行紀錄裡不會有它。
 *
 * 判準：不會被執行的宣告（元件性狀 `notExecuted`：類別、結構、前置宣告、函式原型）與它們沒有本體的直接成員（欄位、成員原型）不標；
 * 有本體而從沒被呼叫的方法**照樣標**——那正是覆蓋要問的。
 */
import { test, expect } from '@playwright/test'
import { freshApp, useAsSource, treeHas, runSkippingPrediction } from './helpers'

const neverRan = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const ws = (window as never as { __app: { blocklyPanel: { workspace: { getAllBlocks(o: boolean): { type: string; getSvgRoot(): SVGElement | null }[] } } } }).__app.blocklyPanel.workspace
  return ws.getAllBlocks(false).filter((b) => b.getSvgRoot()?.classList.contains('never-ran')).map((b) => b.type)
})

test('★ 類別定義、欄位、成員原型不標「沒跑到」；從沒被呼叫的方法照樣標', async ({ page }) => {
  test.setTimeout(120_000)
  await freshApp(page)
  const code = `#include <iostream>
using namespace std;
class Box {
public:
    Box(int a);
    int area() const;
    int unused() const;
private:
    int w;
};
Box::Box(int a) : w(a) {
}
int Box::area() const {
    return w * 2;
}
int Box::unused() const {
    return 0;
}
int main() {
    Box b(4);
    cout << b.area() << endl;
    return 0;
}`
  await page.evaluate((c) => (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await treeHas(page, 'cpp:method_def_outside')
  await runSkippingPrediction(page)
  await expect(page.locator('.console-output')).toContainText('8')
  // 正向錨點：從沒被呼叫的那一個方法被標出來（只有它）
  await expect.poll(() => neverRan(page)).toEqual(['cpp_method_def_outside'])
  await expect(page.locator('.console-output')).toContainText('有 1 塊積木')
})

test('★ 方法寫在類別裡的寫法：類別定義與欄位不標', async ({ page }) => {
  test.setTimeout(120_000)
  await freshApp(page)
  const code = `#include <iostream>
using namespace std;
struct P {
    int x;
};
class Box {
public:
    Box(int a) : w(a) {
    }
    int area() const {
        return w * 2;
    }
private:
    int w;
};
int main() {
    Box b(4);
    P p;
    p.x = 1;
    cout << b.area() + p.x << endl;
    return 0;
}`
  await page.evaluate((c) => (window as never as { __app: { codeView: { setCode(c: string): void } } }).__app.codeView.setCode(c), code)
  await useAsSource(page, '程式碼')
  await treeHas(page, 'cpp:method_def')
  await runSkippingPrediction(page)
  await expect(page.locator('.console-output')).toContainText('9')
  expect(await neverRan(page)).toEqual([])
})
