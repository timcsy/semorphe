/**
 * `cpp:vector_declare` 的 **lift** 路
 *
 * ⚠️ **這一路搬進來的不是函式，是一筆資料。**
 *
 * 它原本是 `core/lifters/strategies.ts` 裡七顆容器共用的判別式中的一列。
 * 判別邏輯（找 `template_type`、拆樣板引數、抓宣告子）本來就是共用的，
 * 留在原處是對的；要回家的是「`vector` 這個樣板名屬於我」這個**宣告**。
 *
 * 這是元件化最常見的形狀之一——見 `specs/104-component-vertical-slice` 的 R1。
 */
import { registerContainerTemplate } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerContainerTemplate('vector', 'cpp:vector_declare', 'cpp/vector_declare')
}
