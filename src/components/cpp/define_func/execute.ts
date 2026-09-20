/**
 * `cpp:define_func` 的 **execute** 路
 *
 * ## 展開不在這裡——它在 lift 那一側
 *
 * 一個函式形巨集在**執行期**沒有任何行為：它是一張「這段文字怎麼展開」的表，
 * 而展開發生在**語法樹被讀之前**（`languages/cpp/lang/macro-expand.ts` 的樹修復）。
 *
 * 🔴 **那它為什麼不是「顯式的空」**：`#ifdef` / `#ifndef` 讀的是一個
 * 「這個名字定義過沒有」的集合，而 `#define rep(i,n) …` **算定義過**。
 * 少了這一行，`#ifdef rep` 會答錯——而那是一個安靜的錯答案。
 *
 * ⚠️ 與同族那顆具名常數的巨集**刻意不同**：那一顆會把值綁進 scope
 *（`#define MAX 100` 之後 `MAX` 是一個名字），而這一顆**不綁**
 * ——`rep` 不是一個值，把它綁成任何東西都會讓後面的算式莫名其妙。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defined } from '../../../languages/cpp/lang/executors/preprocessor'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:define_func', async (node, _ctx) => {
    const name = String(node.properties.name ?? '')
    if (name) defined.add(name)
  })
}
