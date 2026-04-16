/**
 * Boss 索引文件
 * 统一导出 Boss 基类及各关 Boss 配置
 */

export { default as BaseBoss } from './BaseBoss';
export { default as MirrorExecutionerBoss } from './MirrorExecutionerBoss';
export { default as ToxicWeaverBoss } from './ToxicWeaverBoss';
export { default as TideEyeBoss } from './TideEyeBoss';
export { default as BroodmotherBoss } from './BroodmotherBoss';
export { default as ThunderWardenBoss } from './ThunderWardenBoss';
export { default as TideDevourerBoss } from './TideDevourerBoss';
export { default as TimeBishopBoss } from './TimeBishopBoss';
export { default as StarRoyalistBoss } from './StarRoyalistBoss';

// 各关 Boss 独立配置
export * as Stage1Boss from './stage1Boss';
export * as Stage2Boss from './stage2Boss';
export * as Stage3Boss from './stage3Boss';
