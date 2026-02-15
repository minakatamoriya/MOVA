/**
 * Roguelike 场景管理器
 * 负责管理游戏中的所有场景和场景切换
 */
export default class RoguelikeSceneManager {
  constructor(game) {
    this.game = game;
    
    // 定义所有游戏场景
    this.sceneKeys = {
      BOOT: 'BootScene',
      PRELOAD: 'PreloadScene',
      MENU: 'MenuScene',
      GAME: 'GameScene',
      LEVELUP: 'LevelUpScene',
      SHOP: 'ShopScene',
      GAMEOVER: 'GameOverScene'
    };
  }

  /**
   * 切换到指定场景
   * @param {string} sceneKey - 场景键值
   * @param {object} data - 传递给新场景的数据
   */
  switchTo(sceneKey, data = {}) {
    const currentScene = this.game.scene.getScenes(true)[0];
    if (currentScene) {
      currentScene.scene.start(sceneKey, data);
    }
  }

  /**
   * 启动场景（不停止当前场景）
   * @param {string} sceneKey - 场景键值
   * @param {object} data - 传递给新场景的数据
   */
  launch(sceneKey, data = {}) {
    const currentScene = this.game.scene.getScenes(true)[0];
    if (currentScene) {
      currentScene.scene.launch(sceneKey, data);
    }
  }

  /**
   * 暂停场景
   * @param {string} sceneKey - 场景键值
   */
  pause(sceneKey) {
    this.game.scene.pause(sceneKey);
  }

  /**
   * 恢复场景
   * @param {string} sceneKey - 场景键值
   */
  resume(sceneKey) {
    this.game.scene.resume(sceneKey);
  }

  /**
   * 停止场景
   * @param {string} sceneKey - 场景键值
   */
  stop(sceneKey) {
    this.game.scene.stop(sceneKey);
  }
}
