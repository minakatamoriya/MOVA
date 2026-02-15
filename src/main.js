import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import MenuScene from './scenes/MenuScene';
import ItemShopScene from './scenes/ItemShopScene';
import EquipmentScene from './scenes/EquipmentScene';
import GameScene from './scenes/GameScene';
import LevelUpScene from './scenes/LevelUpScene';
import BuildTreeScene from './scenes/BuildTreeScene';
import ShopScene from './scenes/ShopScene';
import GameOverScene from './scenes/GameOverScene';
import RoguelikeSceneManager from './managers/RoguelikeSceneManager';
import { mountUi } from './ui/mount';
import { uiBus } from './ui/bus';
import { resetSkillTreeProgress } from './classes/progression';

/**
 * Phaser 游戏配置
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  input: {
    // 关键：不要监听 window 级事件，否则点击 React Overlay 也会触发 Phaser 输入
    windowEvents: false
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    ItemShopScene,
    EquipmentScene,
    GameScene,
    BuildTreeScene,
    LevelUpScene,
    ShopScene,
    GameOverScene
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// 创建游戏实例
const game = new Phaser.Game(config);

// UI 模式：React 负责菜单与按钮，Phaser 只渲染玩法画面
game.registry.set('uiMode', 'react');

// 稳定的场景上下文广播：无论从哪里 start 场景，都同步给 React
(() => {
  const IN_GAME_SCENES = new Set(['GameScene', 'LevelUpScene', 'BuildTreeScene', 'ShopScene']);
  const sceneManager = game.scene;
  const emitContext = (key) => {
    const sceneKey = typeof key === 'string' ? key : key?.key;
    if (!sceneKey) return;
    uiBus.emit('phaser:sceneChanged', sceneKey);
    uiBus.emit('phaser:inGameChanged', IN_GAME_SCENES.has(sceneKey));
  };

  // SceneManager：只保证 start() 广播（launch 属于 ScenePlugin，不在 SceneManager 上）
  if (typeof sceneManager.start === 'function') {
    const originalStart = sceneManager.start.bind(sceneManager);
    sceneManager.start = (key, data) => {
      emitContext(key);
      return originalStart(key, data);
    };
  }

  // ScenePlugin：覆盖场景内 this.scene.start()/launch() 的调用路径
  const scenePluginProto = Phaser?.Scenes?.ScenePlugin?.prototype;
  if (scenePluginProto && !scenePluginProto.__uiContextWrapped) {
    Object.defineProperty(scenePluginProto, '__uiContextWrapped', { value: true, enumerable: false });

    const wrap = (methodName) => {
      const original = scenePluginProto[methodName];
      if (typeof original !== 'function') return;
      scenePluginProto[methodName] = function (key, data) {
        emitContext(key);
        return original.call(this, key, data);
      };
    };

    wrap('start');
    wrap('launch');
    wrap('resume');
  }
})();

// React -> Phaser：统一场景跳转（避免每个 Scene 都各自绑定）
uiBus.on('ui:gotoScene', (sceneKey, data) => {
  if (!sceneKey) return;
  try {
    if (sceneKey === 'GameScene') {
      resetSkillTreeProgress(game.registry);
    }
    game.scene.start(sceneKey, data || {});
  } catch (e) {
    // ignore
  }
});

// 挂载 React UI（叠在 Canvas 之上）
mountUi();

// 创建场景管理器实例（可选，用于高级场景管理）
const sceneManager = new RoguelikeSceneManager(game);

// 将场景管理器添加到游戏注册表，以便在任何场景中访问
game.registry.set('sceneManager', sceneManager);

// 初始化全局金币
if (!game.registry.has('globalCoins')) {
  game.registry.set('globalCoins', 0);
}

// 设置：是否显示伤害数字
if (!game.registry.has('showDamage')) {
  game.registry.set('showDamage', true);
}

const emitSettings = () => {
  uiBus.emit('phaser:settingsChanged', {
    showDamage: game.registry.get('showDamage') !== false
  });
};

uiBus.on('ui:settings:request', () => {
  emitSettings();
});

uiBus.on('ui:settings:setShowDamage', (v) => {
  game.registry.set('showDamage', !!v);
  emitSettings();
});

// 初始推送一次（React 可能已挂载）
emitSettings();

if (!game.registry.has('ownedItems')) {
  game.registry.set('ownedItems', []);
}

if (!game.registry.has('equippedItems')) {
  game.registry.set('equippedItems', new Array(6).fill(null));
}

// 游戏准备就绪后移除加载提示
game.events.once('ready', () => {
  const loadingElement = document.querySelector('.loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
});

// 导出游戏实例
export default game;
