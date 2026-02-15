import Phaser from 'phaser';

// Phaser <-> React 事件总线
// - 不直接在 React 中触碰 Scene 对象
// - 通过事件把意图传给 Phaser（或把状态回传给 React）
export const uiBus = new Phaser.Events.EventEmitter();
