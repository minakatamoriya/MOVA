import { normalizeCoreKey } from '../classDefs';

// 将“职业核心”启用逻辑集中管理（GameScene 只负责调用）

export function applyCoreUpgrade(scene, coreUpgradeId) {
  if (!scene || !coreUpgradeId) return false;

  const toCoreKey = (id) => {
    if (!id) return null;
    if (id === 'archer_core') return 'archer';
    if (id === 'drone_core' || id === 'druid_core') return 'druid';
    if (id === 'warrior_core') return 'warrior';
    if (id === 'mage_core') return 'mage';
    if (id === 'paladin_core') return 'paladin';
    if (id === 'warlock_core') return 'warlock';
    return null;
  };

  const pickedCore = normalizeCoreKey(toCoreKey(coreUpgradeId));
  if (!pickedCore) return false;

  const currentMainCore = normalizeCoreKey(scene.buildState?.core);

  // 双职业原则：主职业锁定普攻形态；副职业只提供强化。
  // 已有主职业时，再选 core 视为副职业（不切换普攻形态）。
  if (currentMainCore && currentMainCore !== pickedCore) {
    scene.buildState.offCore = pickedCore;
    if (scene.registry) scene.registry.set('offCore', pickedCore);
    if (scene.player?.setOffCore) scene.player.setOffCore(pickedCore);
    if (scene.player) scene.player.canFire = true;
    return true;
  }

  // 第一次选择：锁定主职业
  scene.switchBuildCore(pickedCore);
  if (scene.registry) scene.registry.set('mainCore', pickedCore);
  if (scene.player?.setMainCoreAttack) scene.player.setMainCoreAttack(pickedCore);
  if (scene.player) scene.player.canFire = true;

  // 战士：启用近战月牙斩基础攻击系统（以前的风刃代码保留，供后续回旋斩扩展）
  if (pickedCore === 'warrior' && typeof scene.enableWarriorBuild === 'function') {
    scene.enableWarriorBuild();
  }

  // 圣骑：启用护盾脉冲系统（并创建索敌提示圈）
  if (pickedCore === 'paladin' && typeof scene.enablePaladinBuild === 'function') {
    scene.enablePaladinBuild();
  }

  // 术士：启用“毒圈 -> Boss Debuff tick”体系。
  // 注意：起始房间拾取核心走 applyCoreUpgrade（不走 GameScene.applyUpgrade），
  // 若不在这里打开 warlockEnabled，则毒圈只会伤害小怪（碰撞层直接结算），Boss 不会走 updateWarlockDebuff。
  if (pickedCore === 'warlock') {
    scene.warlockEnabled = true;
    // 新术士主职业：剧毒新星不依赖“命中自动上毒”的旧框架
    scene.warlockDebuffEnabled = false;
  }

  // 兼容：德鲁伊不再走旧 drone 系统
  if (pickedCore === 'druid') {
    scene.droneEnabled = false;
    scene.droneCount = 0;
    scene.droneTracking = false;
    if (scene.destroyDroneUnits) scene.destroyDroneUnits();
  }

  return true;
}
