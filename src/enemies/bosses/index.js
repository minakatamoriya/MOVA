/**
 * Boss 索引文件
 * 统一导出 Boss 基类及各关 Boss 配置
 */

export { default as BaseBoss } from './BaseBoss';

// 各关 Boss 独立配置
export * as Stage1Boss from './stage1Boss';
export * as Stage2Boss from './stage2Boss';
export * as Stage3Boss from './stage3Boss';
