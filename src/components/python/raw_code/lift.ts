/**
 * `python:raw_code` 的 **lift** 路——**空的，而那是顯式的空**。
 *
 * 這顆不認領任何 AST 節點：核心判定「這段我看不懂」時建一顆**裸的** `raw_code`
 * （`core/lift/lifter.ts:282`），而**要用哪一顆積木裝它**由降級登記處決定
 * （`core/degradation-blocks.ts`）。
 *
 * > **判別屬於核心，形態屬於膠囊。**
 */
export function registerLift(): void {}
