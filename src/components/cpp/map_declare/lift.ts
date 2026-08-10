/**
 * `cpp:map_declare` 的 **lift** 路——**一筆資料：「`map` 這個型別名屬於我」**
 *
 * 原本住在 `pending-containers.ts` 的過渡表裡。那張表的檔頭寫著
 * 「每搬一顆進膠囊，就從這裡刪掉一列。這張表歸零的那天就刪掉這個檔」
 * ——**這一批就是那一天。**
 */
import { registerContainerTemplate } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerContainerTemplate('map', 'cpp:map_declare', 'cpp/map_declare')
}
