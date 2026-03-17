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

// 微信内置浏览器（以及 iOS WKWebView）在“返回上一页/切回前台”时可能从 BFCache 恢复，
// 导致 JS 运行态、资源缓存、甚至首屏逻辑不更新。
// 兜底策略：检测到 back/forward 恢复就强制刷新一次，并用 sessionStorage 防止无限刷新循环。
(() => {
  const KEY = '__bfcache_reload_once__';

  const getNavType = () => {
    try {
      const entry = performance?.getEntriesByType?.('navigation')?.[0];
      if (entry && typeof entry.type === 'string') return entry.type;
    } catch (_) {
      // ignore
    }
    try {
      // legacy: 2 means TYPE_BACK_FORWARD
      const t = performance?.navigation?.type;
      if (typeof t === 'number') return t === 2 ? 'back_forward' : 'other';
    } catch (_) {
      // ignore
    }
    return 'unknown';
  };

  const shouldForceReload = (eventPersisted) => {
    if (eventPersisted) return true;
    return getNavType() === 'back_forward';
  };

  window.addEventListener('pageshow', (event) => {
    const forced = shouldForceReload(!!event.persisted);

    // 正常加载时清理标记：避免“刷新过一次后标记残留”，导致下次 BFCache 恢复不再刷新。
    if (!forced) {
      try {
        if (sessionStorage.getItem(KEY) === '1') sessionStorage.removeItem(KEY);
      } catch (_) {
        // ignore
      }
      return;
    }

    // BFCache/后退前进恢复：只允许强刷一次，防止无限循环。
    try {
      if (sessionStorage.getItem(KEY) === '1') return;
      sessionStorage.setItem(KEY, '1');
    } catch (_) {
      // sessionStorage 不可用时就直接刷新（最差情况用户会看到重复刷新，但一般不会）
    }
    window.location.reload();
  });
})();

function getViewportCssSize() {
  // 移动端（尤其是 iOS Safari）横竖屏切换/刷新时，innerWidth/innerHeight 可能短时间不准确。
  // 优先使用 visualViewport，其次使用容器实际尺寸，最后才回退 innerWidth/innerHeight。
  const vv = window.visualViewport;
  const vw = Number(vv?.width);
  const vh = Number(vv?.height);

  if (Number.isFinite(vw) && vw > 0 && Number.isFinite(vh) && vh > 0) {
    return { width: Math.round(vw), height: Math.round(vh), source: 'visualViewport' };
  }

  const container = document.getElementById('game-container');
  if (container) {
    const rect = container.getBoundingClientRect();
    const w = Number(rect.width);
    const h = Number(rect.height);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
      return { width: Math.round(w), height: Math.round(h), source: 'containerRect' };
    }
  }

  return { width: Math.round(window.innerWidth || 0), height: Math.round(window.innerHeight || 0), source: 'inner' };
}

/**
 * 获取设备显示信息
 */
function getDeviceDisplayInfo() {
  const dpr = window.devicePixelRatio || 1;
  const vp = getViewportCssSize();
  const w = vp.width || window.innerWidth;
  const h = vp.height || window.innerHeight;
  return {
    cssWidth: w,
    cssHeight: h,
    cssSource: vp.source,
    devicePixelRatio: dpr,
    physicalWidth: Math.round(w * dpr),
    physicalHeight: Math.round(h * dpr),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    orientation: w > h ? 'landscape' : 'portrait'
  };
}

const deviceInfo = getDeviceDisplayInfo();
console.log('📱 设备显示信息:', deviceInfo);
console.log(`  CSS 分辨率: ${deviceInfo.cssWidth}×${deviceInfo.cssHeight}`);
console.log(`  物理分辨率: ${deviceInfo.physicalWidth}×${deviceInfo.physicalHeight} (DPR: ${deviceInfo.devicePixelRatio})`);
console.log(`  屏幕方向: ${deviceInfo.orientation}`);

/**
 * Phaser 游戏配置（方案 A：固定设计视口）
 * - 逻辑分辨率固定为 720×1280（9:16），确保所有机型“玩法视野一致”。
 * - 使用 FIT 等比缩放：不同长宽比设备会出现黑边（通常是两侧黑边），但不会增加/减少可视范围。
 */
const GAME_WIDTH = 720;
const GAME_HEIGHT = 1280;

console.log(`🎮 逻辑游戏分辨率(固定): ${GAME_WIDTH}×${GAME_HEIGHT} (9:16)`);

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
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

// 将设备显示信息存入 registry，供任意场景访问
game.registry.set('deviceInfo', deviceInfo);

const applyResponsiveGameSize = (reason) => {
  const vp = getViewportCssSize();
  const w = Number(vp.width || 0);
  const h = Number(vp.height || 0);
  if (!(w > 0 && h > 0)) return;

  // 方案 A：不要改变逻辑尺寸，只刷新 FIT 布局（必要时同步父容器尺寸）。
  try {
    if (typeof game.scale.setParentSize === 'function') {
      game.scale.setParentSize(w, h);
    }
    game.scale.refresh();
    const orientation = w > h ? 'landscape' : 'portrait';
    console.log(`📐 Resize(${reason || 'unknown'}): viewport ${w}×${h} (${vp.source}) -> game fixed ${GAME_WIDTH}×${GAME_HEIGHT} (${orientation})`);
  } catch (_) {
    // ignore
  }
};

// 监听窗口尺寸变化（手机旋转等），刷新 FIT 布局
window.addEventListener('resize', () => applyResponsiveGameSize('window.resize'));
window.addEventListener('orientationchange', () => applyResponsiveGameSize('orientationchange'));
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => applyResponsiveGameSize('visualViewport.resize'));
}

// 首次启动时再校准两次：下一帧 + 250ms（解决移动端旋转后刷新时尺寸上报延迟）
requestAnimationFrame(() => applyResponsiveGameSize('raf'));
setTimeout(() => applyResponsiveGameSize('timeout250'), 250);

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

// 设置：是否显示敌人头顶血条与 debuff（默认关闭，保持画面干净）
if (!game.registry.has('showEnemyOverlays')) {
  game.registry.set('showEnemyOverlays', false);
}

const emitSettings = () => {
  uiBus.emit('phaser:settingsChanged', {
    showDamage: game.registry.get('showDamage') !== false,
    showEnemyOverlays: game.registry.get('showEnemyOverlays') === true
  });
};

uiBus.on('ui:settings:request', () => {
  emitSettings();
});

uiBus.on('ui:settings:setShowDamage', (v) => {
  game.registry.set('showDamage', !!v);
  emitSettings();
});

uiBus.on('ui:settings:setShowEnemyOverlays', (v) => {
  game.registry.set('showEnemyOverlays', !!v);
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
