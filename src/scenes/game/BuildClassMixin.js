import Phaser from 'phaser';
import { applyCoreUpgrade } from '../../classes/attacks/coreEnablers';
import { getBaseColorForCoreKey, getBasicSkillColorScheme } from '../../classes/visual/basicSkillColors';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../../classes/attacks/basicAttackMods';
import { CORE_OPTIONS } from '../../classes/classDefs';
import {
  UPGRADE_POOLS,
  OFF_FACTION_ENTRY_OPTIONS,
  UNIVERSAL_POOLS,
  NATURE_BRANCH_POOLS,
  NATURE_CONTRACT_OPTIONS,
  THIRD_SPEC_PREP_OPTIONS,
  DEPTH_SPEC_POOLS,
  DUAL_SPEC_POOLS
} from '../../classes/upgradePools';
import { shouldOfferSecondCore } from '../../classes/dualClass';
import { recordSkillTreeProgress as recordSkillTreeProgressToRegistry } from '../../classes/progression';
import { getAccentCoreKeyForOffFaction, getThirdSpecTypeForMainOff, getMaxLevel } from '../../classes/talentTrees';

/**
 * 职业构建 / 升级 / 近战 / 法师 / 圣骑 / 术士 / 德鲁伊宠物 相关方法
 */
export function applyBuildClassMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    applyUpgrade(upgrade) {
      if (!upgrade || !this.player) return;

      const existingOffFaction = this.registry.get('offFaction') || null;
      if (!existingOffFaction) {
        const entryUpgradeToFaction = {
          arcane_swift: 'arcane',
          arcane_enlighten: 'arcane',
          arcane_circle: 'arcane',
          ranger_precise: 'ranger',
          ranger_agile: 'ranger',
          ranger_hunter: 'ranger',
          unyielding_bloodrage: 'unyielding',
          unyielding_battlecry: 'unyielding',
          unyielding_duel: 'unyielding',
          curse_corrosion: 'curse',
          curse_weakness: 'curse',
          curse_wither: 'curse',
          guardian_block: 'guardian',
          guardian_armor: 'guardian',
          guardian_counter: 'guardian',
          druid_pet_bear: 'nature',
          druid_pet_hawk: 'nature',
          druid_pet_treant: 'nature'
        };

        const inferredFaction = entryUpgradeToFaction[upgrade.id] || null;
        if (inferredFaction) {
          this.registry.set('offFaction', inferredFaction);

          const accentCore = getAccentCoreKeyForOffFaction(inferredFaction);
          if (accentCore && this.player?.setOffCore) this.player.setOffCore(accentCore);

          const mainCoreKey = this.registry.get('mainCore') || this.buildState.core;
          const thirdSpecType = getThirdSpecTypeForMainOff({ mainCoreKey, offFaction: inferredFaction });
          if (thirdSpecType) this.registry.set('thirdSpecType', thirdSpecType);
        }
      }

      this.recordSkillTreeProgress(upgrade);

      switch (upgrade.id) {
        case 'off_arcane':
        case 'off_ranger':
        case 'off_unyielding':
        case 'off_curse':
        case 'off_guardian':
        case 'off_nature': {
          const map = {
            off_arcane: { faction: 'arcane', accentCore: 'mage' },
            off_ranger: { faction: 'ranger', accentCore: 'scatter' },
            off_unyielding: { faction: 'unyielding', accentCore: 'warrior' },
            off_curse: { faction: 'curse', accentCore: 'warlock' },
            off_guardian: { faction: 'guardian', accentCore: 'paladin' },
            off_nature: { faction: 'nature', accentCore: 'drone' }
          };
          const picked = map[upgrade.id];
          if (picked) {
            this.registry.set('offFaction', picked.faction);
            if (this.player?.setOffCore) this.player.setOffCore(picked.accentCore);

            const mainCoreKey = this.registry.get('mainCore') || this.buildState.core;
            const thirdSpecType = getThirdSpecTypeForMainOff({ mainCoreKey, offFaction: picked.faction });
            if (thirdSpecType) this.registry.set('thirdSpecType', thirdSpecType);
          }
          break;
        }

        case 'scatter_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'archer_rapidfire':
          this.player.archerRapidfire = true;
          break;
        case 'archer_pierce':
          this.player.archerPierce = true;
          break;
        case 'archer_arrowrain':
          this.player.archerArrowRain = true;
          break;

        case 'archer_range':
          this.player.upgradeArcherRange();
          break;
        case 'archer_rate':
          this.player.upgradeArcherRate();
          break;
        case 'archer_damage':
          this.player.upgradeArcherDamage();
          break;
        case 'archer_scatter':
          this.player.upgradeArcherScatter();
          break;
        case 'scatter_range':
          this.player.upgradeScatterRange();
          break;
        case 'scatter_rate':
          this.player.upgradeScatterRate();
          break;
        case 'scatter_count':
          this.player.upgradeScatterCount();
          break;
        case 'scatter_ring':
          this.player.enableScatterRing();
          break;
        case 'scatter_homing':
          this.player.enableScatterHoming();
          break;
        case 'scatter_explode':
          this.player.enableScatterExplode();
          break;
        case 'drone_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'druid_pet_bear':
        case 'druid_pet_hawk':
        case 'druid_pet_treant':
          if (this.registry && this.registry.get('naturePetType')) break;
          if (this.petManager) {
            this.petManager.unlockPetByUpgradeId(upgrade.id);
            const owned = this.petManager?.owned ? Array.from(this.petManager.owned) : [];
            if (owned.length > 0) {
              this.registry.set('naturePetType', owned[0]);
            }
          }
          break;

        case 'nature_bear_solidarity':
          this.player.natureBearSplit = Math.min(0.30, (this.player.natureBearSplit || 0) + 0.10);
          break;
        case 'nature_bear_strength':
          this.player.natureDamageMult = Math.min(1.35, (this.player.natureDamageMult || 1) * 1.08);
          this.player.applyStatMultipliers(this.player.equipmentMods || {});
          break;
        case 'nature_bear_carapace':
          this.player.natureDamageTakenMult = Math.max(0.85, (this.player.natureDamageTakenMult || 1) * 0.96);
          break;
        case 'nature_bear_rage':
          this.player.natureRageLevel = Math.min(3, (this.player.natureRageLevel || 0) + 1);
          break;
        case 'nature_bear_earthquake':
          this.player.natureEarthquakeLevel = Math.min(3, (this.player.natureEarthquakeLevel || 0) + 1);
          break;
        case 'nature_bear_thornshield':
          this.thornsPercent = Math.min(0.35, (this.thornsPercent || 0) + 0.04);
          break;

        case 'nature_hawk_crit':
          this.player.critChance = Math.min(0.95, (this.player.critChance || 0) + 0.03);
          break;
        case 'nature_hawk_evade':
          this.player.dodgeChance = Math.min(0.35, (this.player.dodgeChance || 0) + 0.05);
          break;
        case 'nature_hawk_speed':
          this.player.natureMoveSpeedMult = Math.min(1.35, (this.player.natureMoveSpeedMult || 1) * 1.05);
          this.player.applyStatMultipliers(this.player.equipmentMods || {});
          break;
        case 'nature_hawk_windslash':
          this.player.natureWindSlashLevel = Math.min(3, (this.player.natureWindSlashLevel || 0) + 1);
          break;
        case 'nature_hawk_skycall':
          this.player.natureSkyCallLevel = Math.min(3, (this.player.natureSkyCallLevel || 0) + 1);
          break;
        case 'nature_hawk_huntmark':
          this.player.natureHuntMarkLevel = Math.min(3, (this.player.natureHuntMarkLevel || 0) + 1);
          break;

        case 'nature_treant_regen':
          this.player.natureTreantRegenLevel = Math.min(3, (this.player.natureTreantRegenLevel || 0) + 1);
          break;
        case 'nature_treant_root':
          this.player.natureTreantRootLevel = Math.min(3, (this.player.natureTreantRootLevel || 0) + 1);
          break;
        case 'nature_treant_armor':
          this.player.flatDamageReduction = Math.min(18, (this.player.flatDamageReduction || 0) + 1);
          break;
        case 'nature_treant_thorns':
          this.thornsPercent = Math.min(0.35, (this.thornsPercent || 0) + 0.03);
          break;
        case 'nature_treant_summon':
          this.player.natureTreantSummonLevel = Math.min(3, (this.player.natureTreantSummonLevel || 0) + 1);
          break;
        case 'nature_treant_reborn':
          this.player.natureTreantRebornLevel = Math.min(3, (this.player.natureTreantRebornLevel || 0) + 1);
          break;
        case 'druid_meteor_shower':
          this.player.druidMeteorShower = true;
          break;
        case 'druid_meteor':
          this.player.druidMeteor = true;
          break;
        case 'druid_starfire':
          this.player.druidStarfire = true;
          break;
        case 'warrior_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'warrior_spin':
          this.player.warriorSpin = true;
          if (this.slashArcSpan) this.slashArcSpan = Math.PI * 2;
          break;
        case 'warrior_swordqi':
          this.player.warriorSwordQi = true;
          break;
        case 'warrior_endure':
          this.player.warriorEndure = true;
          break;
        case 'warrior_hp':
          this.upgradeWarriorHp();
          break;
        case 'warrior_thorns':
          this.upgradeWarriorThorns();
          break;
        case 'warrior_range':
          this.upgradeWarriorRange();
          break;
        case 'warrior_lifesteal':
          this.upgradeWarriorLifesteal();
          break;
        case 'mage_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'mage_refract':
          this.player.mageRefract = true;
          break;
        case 'mage_overheat':
          this.player.mageOverheat = true;
          break;
        case 'mage_charge':
          this.player.mageCharge = true;
          break;
        case 'mage_arcane_perception': {
          this.player.mageArcanePerceptionLevel = Math.min(3, (this.player.mageArcanePerceptionLevel || 0) + 1);
          const base = this.player.arcaneRayBaseRange || this.player.arcaneRayRange || 220;
          this.player.arcaneRayBaseRange = base;
          this.player.arcaneRayRange = Math.round(base + this.player.mageArcanePerceptionLevel * 45);
          break;
        }
        case 'mage_energy_focus':
          this.player.mageEnergyFocusLevel = Math.min(3, (this.player.mageEnergyFocusLevel || 0) + 1);
          break;
        case 'mage_arcane_split':
          this.player.mageArcaneSplitLevel = Math.min(3, (this.player.mageArcaneSplitLevel || 0) + 1);
          break;

        case 'archer_bounce':
          this.player.archerArrowBounce = 1;
          break;
        case 'paladin_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'paladin_pierce':
          this.player.paladinPierce = true;
          break;
        case 'paladin_holyfire':
          this.player.paladinHolyfire = true;
          break;
        case 'paladin_triple':
          this.player.paladinTriple = true;
          break;
        case 'paladin_stun': {
          this.player.paladinStunLevel = Math.min(3, (this.player.paladinStunLevel || 0) + 1);
          this.player.paladinStunChance = Math.min(0.95, this.player.paladinStunLevel * 0.10);
          break;
        }
        case 'warlock_core':
          applyCoreUpgrade(this, upgrade.id);
          {
            const mainCore = this.registry.get('mainCore') || this.buildState.core;
            if (mainCore === 'warlock') {
              this.warlockEnabled = true;
              this.warlockDebuffEnabled = false;
            }
          }
          break;
        case 'warlock_spread':
          this.player.warlockPoisonSpreadStacks = Math.min(3, (this.player.warlockPoisonSpreadStacks || 0) + 1);
          break;
        case 'warlock_corrode':
          this.player.warlockPoisonCorrodeStacks = Math.min(3, (this.player.warlockPoisonCorrodeStacks || 0) + 1);
          break;
        case 'warlock_toxicity':
          this.player.warlockPoisonToxicityStacks = Math.min(3, (this.player.warlockPoisonToxicityStacks || 0) + 1);
          break;
        case 'warlock_malady':
          this.player.warlockPoisonDiseaseStacks = Math.min(3, (this.player.warlockPoisonDiseaseStacks || 0) + 1);
          break;
        case 'warlock_autoseek':
          this.player.warlockPoisonAutoSeek = true;
          break;
        case 'warlock_contagion':
          this.player.warlockPoisonContagion = true;
          break;
        case 'warlock_smoke':
          this.player.warlockPoisonSmoke = true;
          this.warlockEnabled = true;
          break;
        case 'warlock_plague':
          this.player.warlockPoisonPlague = true;
          break;

        case 'arcane_swift':
          this.player.universalFireRateMult = Math.max(0.6, (this.player.universalFireRateMult || 1) * 0.92);
          this.player.applyStatMultipliers(this.player.equipmentMods || { damageMult: 1, fireRateMult: 1, speedMult: 1 });
          break;
        case 'arcane_enlighten':
          this.levelUpChoiceCount = Math.max(this.levelUpChoiceCount || 3, 4);
          break;
        case 'arcane_circle':
          this.player.arcaneCircleEnabled = true;
          break;

        case 'ranger_precise':
          this.player.critChance = Math.min(0.95, (this.player.critChance || 0) + 0.10);
          break;
        case 'ranger_agile':
          this.player.dodgeChance = Math.min(0.6, (this.player.dodgeChance || 0) + 0.08);
          break;
        case 'ranger_hunter':
          this.player.hunterCritBonus = Math.max(this.player.hunterCritBonus || 0, 0.15);
          break;

        case 'unyielding_bloodrage':
          this.player.bloodrageEnabled = true;
          break;
        case 'unyielding_battlecry':
          this.player.battlecryEnabled = true;
          break;
        case 'unyielding_duel':
          this.player.deathDuelEnabled = true;
          break;

        case 'curse_corrosion':
          this.player.curseCorrosion = true;
          this.warlockEnabled = true;
          break;
        case 'curse_weakness':
          this.player.curseWeakness = true;
          this.warlockEnabled = true;
          break;
        case 'curse_wither':
          this.player.curseWither = true;
          this.warlockEnabled = true;
          break;

        case 'guardian_block':
          this.player.blockChance = Math.min(0.5, (this.player.blockChance || 0) + 0.05);
          break;
        case 'guardian_armor':
          this.player.flatDamageReduction = Math.min(25, (this.player.flatDamageReduction || 0) + 3);
          break;
        case 'guardian_counter':
          this.player.counterOnBlock = true;
          break;
        default:
          break;
      }

      // (tutorialAwaitingFirstCore 机制已移除 —— 核心在起始房间选武器时确定)
    },

    recordSkillTreeProgress(upgrade) {
      recordSkillTreeProgressToRegistry(this.registry, upgrade);

      if (this.isReactUiMode() && this.viewMenuOpen) {
        this.emitUiSnapshot();
      }
    },

    getPrimaryTarget() {
      const tank = this.petManager?.getTankPet?.();
      if (tank) return tank;
      return this.player;
    },

    switchBuildCore(nextCore) {
      const prevCore = this.buildState?.core;
      if (prevCore && prevCore !== nextCore) {
        this.disableBuildCore(prevCore);
      }
      this.buildState.core = nextCore;
    },

    disableBuildCore(core) {
      switch (core) {
        case 'warrior':
          this.disableWarriorBuild();
          break;
        case 'scatter':
          if (this.player?.disableScatterBuild) this.player.disableScatterBuild();
          break;
        case 'mage':
          this.laserEnabled = false;
          if (this.player?.disableLaserBuild) this.player.disableLaserBuild();
          break;
        case 'drone':
          this.droneEnabled = false;
          this.droneCount = 0;
          this.droneTracking = false;
          this.destroyDroneUnits();
          break;
        case 'paladin':
          this.paladinEnabled = false;
          if (this._paladinTargetRing) {
            this._paladinTargetRing.destroy();
            this._paladinTargetRing = null;
          }
          break;
        case 'warlock':
          this.warlockEnabled = false;
          this.warlockDebuffEnabled = false;
          break;
        default:
          break;
      }
    },

    disableWarriorBuild() {
      this.meleeEnabled = false;
      this.meleeInBladePrev = false;
      this.meleeLastTime = 0;
      this.destroySlashFan();

      if (this._warriorTargetRing) {
        this._warriorTargetRing.destroy();
        this._warriorTargetRing = null;
      }

      if (this.player) {
        this.player.canFire = true;
      }
    },

    getNearestEnemy(maxDist = Infinity) {
      if (!this.player) return null;

      const px = this.player.x;
      const py = this.player.y;
      const maxD2 = Number.isFinite(maxDist) ? (maxDist * maxDist) : Infinity;

      const enemies = [];
      const boss = this.bossManager?.getCurrentBoss?.();
      if (boss && boss.isAlive) enemies.push(boss);

      const minions = this.bossManager?.getMinions?.() || this.bossManager?.minions || [];
      if (Array.isArray(minions) && minions.length > 0) {
        for (let i = 0; i < minions.length; i++) {
          const m = minions[i];
          if (m && m.isAlive) enemies.push(m);
        }
      }

      let best = null;
      let bestD2 = Infinity;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const dx = e.x - px;
        const dy = e.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 <= maxD2 && d2 < bestD2) {
          best = e;
          bestD2 = d2;
        }
      }

      return best;
    },

    setBuildCore(core) {
      this.buildState.core = core;
    },

    triggerLevelUp() {
      let levelOverride = null;
      if (arguments && arguments.length > 0 && typeof arguments[0] === 'object') {
        levelOverride = arguments[0]?.levelOverride ?? null;
      }

      this._levelUpActive = true;
      this.buildState.levelUps += 1;

      const options = this.getLevelUpOptions();

      if (this.physics?.world) this.physics.world.pause();
      if (this.anims) this.anims.pauseAll();
      if (this.time) this.time.paused = true;
      if (this.tweens) this.tweens.pauseAll();

      this.scene.pause('GameScene');
      this.scene.launch('LevelUpScene', {
        level: levelOverride || this.playerData.level,
        choices: options.length,
        options
      });
    },

    getLevelUpOptions() {
      const coreOptions = CORE_OPTIONS;

      if (!this.buildState.core) {
        return [...coreOptions];
      }

      const pools = UPGRADE_POOLS;
      const universalPools = UNIVERSAL_POOLS;

      const choiceCount = this.levelUpChoiceCount || 3;

      const selectedTrees = this.registry.get('selectedTrees') || [];

      const skillTreeLevels = this.registry.get('skillTreeLevels') || {};
      const isMaxed = (id) => (skillTreeLevels[id] || 0) >= getMaxLevel(id);

      const mainCore = this.registry.get('mainCore') || this.buildState.core;
      const offFaction = this.registry.get('offFaction') || null;
      const naturePetType = this.registry.get('naturePetType') || null;

      let thirdSpecType = this.registry.get('thirdSpecType') || null;
      if (!thirdSpecType && mainCore && offFaction) {
        thirdSpecType = getThirdSpecTypeForMainOff({ mainCoreKey: mainCore, offFaction });
        if (thirdSpecType) this.registry.set('thirdSpecType', thirdSpecType);
      }

      if (shouldOfferSecondCore(this.buildState.levelUps, selectedTrees.length) && !offFaction) {
        return this.pickRandomUpgrades(OFF_FACTION_ENTRY_OPTIONS, choiceCount);
      }

      if (offFaction === 'nature' && !naturePetType) {
        return [...NATURE_CONTRACT_OPTIONS];
      }

      let combinedPool = [];
      if (mainCore) combinedPool = combinedPool.concat(pools[mainCore] || []);
      if (offFaction) {
        if (offFaction === 'nature' && naturePetType && NATURE_BRANCH_POOLS[naturePetType]) {
          combinedPool = combinedPool.concat(NATURE_BRANCH_POOLS[naturePetType] || []);
        } else {
          combinedPool = combinedPool.concat(universalPools[offFaction] || []);
        }
      }

      if (mainCore && offFaction && thirdSpecType) {
        const accentCoreKey = getAccentCoreKeyForOffFaction(offFaction);

        if (thirdSpecType === 'depth') {
          combinedPool = combinedPool.concat([THIRD_SPEC_PREP_OPTIONS.depth]);
          combinedPool = combinedPool.concat(DEPTH_SPEC_POOLS[mainCore] || []);
        } else if (thirdSpecType === 'dual') {
          combinedPool = combinedPool.concat([THIRD_SPEC_PREP_OPTIONS.dual]);
          if (accentCoreKey && DUAL_SPEC_POOLS[mainCore] && DUAL_SPEC_POOLS[mainCore][accentCoreKey]) {
            combinedPool = combinedPool.concat(DUAL_SPEC_POOLS[mainCore][accentCoreKey] || []);
          }
        }
      }

      combinedPool = combinedPool.filter(opt => !isMaxed(opt.id));

      let options = this.pickRandomUpgrades(combinedPool, choiceCount);

      return options;
    },

    pickRandomUpgrades(options, count) {
      const pool = [...options];
      const result = [];
      while (pool.length > 0 && result.length < count) {
        const index = Phaser.Math.Between(0, pool.length - 1);
        result.push(pool.splice(index, 1)[0]);
      }
      return result;
    },

    enableDroneBuild() {
      this.droneEnabled = true;
      this.droneCount = Math.max(1, this.droneCount);
      this.player.canFire = true;
      this.syncDroneUnits();
    },

    upgradeDroneCount() {
      this.droneEnabled = true;
      this.droneCount = Math.min(this.droneMaxCount, this.droneCount + 1);
      this.syncDroneUnits();
    },

    upgradeDroneRate() {
      this.droneEnabled = true;
      this.droneFireRate = Math.max(300, Math.floor(this.droneFireRate * 0.85));
    },

    enableDroneHeal() {
      this.droneEnabled = true;
      this.droneHeal = true;
    },

    enableDroneShield() {
      this.droneEnabled = true;
      this.droneShield = true;
    },

    enableDroneDebuff() {
      this.droneEnabled = true;
      this.droneDebuff = true;
    },

    enableDroneTracking() {
      this.droneEnabled = true;
      this.droneTracking = true;
    },

    destroyDroneUnits() {
      if (!this.droneUnits) this.droneUnits = [];
      this.droneUnits.forEach((unit) => {
        if (unit && unit.active) unit.destroy();
      });
      this.droneUnits = [];
    },

    createDroneUnit() {
      const unit = this.add.container(0, 0);
      unit.isDrone = true;

      const body = this.add.circle(0, 0, 7, 0x88ffcc, 0.95);
      body.setStrokeStyle(2, 0x00ffff, 0.9);

      const core = this.add.circle(2, -1, 2, 0xffffff, 0.9);
      const thruster = this.add.circle(-7, 0, 2, 0x00ffff, 0.55);

      unit.add([body, core, thruster]);
      unit.setDepth((this.player?.depth ?? 0) - 1);

      return unit;
    },

    syncDroneUnits() {
      if (!this.droneUnits) this.droneUnits = [];
      const target = Phaser.Math.Clamp(this.droneCount || 0, 0, this.droneMaxCount);

      while (this.droneUnits.length < target) {
        this.droneUnits.push(this.createDroneUnit());
      }
      while (this.droneUnits.length > target) {
        const unit = this.droneUnits.pop();
        if (unit && unit.active) unit.destroy();
      }
    },

    getDroneBehindVector() {
      const dir = this.player?.lastDirection || 'down';
      switch (dir) {
        case 'up':
          return { x: 0, y: 1 };
        case 'down':
          return { x: 0, y: -1 };
        case 'left':
          return { x: 1, y: 0 };
        case 'right':
          return { x: -1, y: 0 };
        default:
          return { x: 0, y: 1 };
      }
    },

    updateDrones(time, delta) {
      if (!this.droneEnabled || !this.player) return;
      if (!this.droneUnits) this.droneUnits = [];
      this.syncDroneUnits();

      const behind = this.getDroneBehindVector();
      const baseAngle = Math.atan2(behind.y, behind.x);
      const count = this.droneUnits.length;
      const follow = 0.22;
      const maxSpread = Phaser.Math.DegToRad(90);
      const spread = count <= 1 ? 0 : Math.min(maxSpread, Phaser.Math.DegToRad(22 + count * 6));
      const stepAngle = count <= 1 ? 0 : spread / (count - 1);
      const radius = 34 + Math.min(18, count * 2);

      for (let i = 0; i < count; i++) {
        const unit = this.droneUnits[i];
        if (!unit || !unit.active) continue;

        const offsetIndex = i - (count - 1) / 2;
        const angle = baseAngle + offsetIndex * stepAngle;
        const radial = radius + Math.abs(offsetIndex) * 1.8;

        const targetX = this.player.x + Math.cos(angle) * radial;
        const targetY = this.player.y + Math.sin(angle) * radial;

        unit.x = Phaser.Math.Linear(unit.x, targetX, follow);
        unit.y = Phaser.Math.Linear(unit.y, targetY, follow);

        const boss = this.bossManager?.getCurrentBoss();
        if (boss && boss.isAlive) {
          unit.rotation = Phaser.Math.Angle.Between(unit.x, unit.y, boss.x, boss.y);
        }
      }

      const boss = this.bossManager?.getCurrentBoss();
      if (!boss || !boss.isAlive) {
        // no target - don't shoot
      } else {
        if (time - this.droneLastShot >= this.droneFireRate) {
          this.droneLastShot = time;

          for (let i = 0; i < this.droneUnits.length; i++) {
            const unit = this.droneUnits[i];
            if (!unit || !unit.active) continue;

            const shotAngle = Phaser.Math.Angle.Between(unit.x, unit.y, boss.x, boss.y);
            const bullet = this.bulletManager?.createPlayerBullet(
              unit.x,
              unit.y,
              0x88ffcc,
              {
                radius: 4,
                speed: 260,
                damage: Math.max(1, Math.round(this.player.bulletDamage * 0.45)),
                angleOffset: shotAngle,
                isAbsoluteAngle: true,
                hasGlow: true,
                hasTrail: true,
                glowRadius: 7,
                homing: !!this.droneTracking,
                homingTurn: this.droneTrackingTurn,
                skipUpdate: false
              }
            );

            if (bullet) {
              bullet.poison = this.droneDebuff;
              this.player.bullets.push(bullet);
            }
          }
        }
      }

      if (this.droneHeal && time - this.droneLastHeal > 2200) {
        this.droneLastHeal = time;
        this.player.heal(3);
      }

      if (this.droneShield && time - this.droneLastShield > 5200) {
        this.droneLastShield = time;
        this.player.shieldCharges += 1;
        this.player.updateShieldIndicator();
      }
    },

    enableWarriorBuild() {
      this.meleeEnabled = true;
      this.thornsPercent = Math.max(this.thornsPercent, 0.12);
      this.meleeRange = 220;
      this.meleeLifesteal = 0;
      this.player.canFire = false;
      this.player.maxHp += 30;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);

      this.slashFan = null;
      this.slashGraphics = [];
      this.meleeCooldown = 700;
      this.slashFacingAngle = null;
      this.slashSwingDir = 1;
      this.slashSwingStartTime = 0;
      this.slashSwingDuration = 650;
      this.slashArcSpan = Math.PI;
      this.slashTailLength = 0.32;
      this.slashEllipseYScale = 0.78;

      this.slashParticleManager = null;
      this.slashParticleEmitter = null;

      if (this._warriorTargetRing) this._warriorTargetRing.destroy();
      this._warriorTargetRing = this.add.circle(0, 0, 28, 0xff3a3a, 0.06);
      this._warriorTargetRing.setStrokeStyle(3, 0xff3a3a, 0.55);
      this._warriorTargetRing.setDepth(60);
      this._warriorTargetRing.setVisible(false);

      this.events.emit('updatePlayerInfo');
    },

    upgradeWarriorHp() {
      this.player.maxHp += 20;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
      this.events.emit('updatePlayerInfo');
    },

    upgradeWarriorThorns() {
      this.thornsPercent = Math.min(0.35, this.thornsPercent + 0.08);
    },

    upgradeWarriorRange() {
      this.meleeRange = Math.min(320, (this.meleeRange || 220) + 25);
    },

    upgradeWarriorLifesteal() {
      this.meleeLifesteal = Math.min(0.18, (this.meleeLifesteal || 0) + 0.03);
    },

    updateMelee(time) {
      if (!this.meleeEnabled || !this.player) return;

      const range = this.meleeRange || 150;

      const acquireRange = Math.max(280, range * 2.4);
      const target = this.getNearestEnemy(acquireRange);

      if (this._warriorTargetRing) {
        if (target && target.isAlive) {
          const r = Phaser.Math.Clamp(range, 90, 420);
          this._warriorTargetRing.setRadius(r);
          this._warriorTargetRing.setPosition(this.player.x, this.player.y);
          this._warriorTargetRing.setVisible(true);
        } else {
          this._warriorTargetRing.setVisible(false);
        }
      }

      if (!target || !target.isAlive) {
        this.destroySlashFan();
        this.slashSwingStartTime = time;
        return;
      }

      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
      const inAttackRange = dist <= range;

      let facingAngle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      this.slashFacingAngle = facingAngle;

      if (!inAttackRange) {
        this.destroySlashFan();
        this.slashSwingStartTime = time;
        return;
      }

      if (!this.slashSwingStartTime) this.slashSwingStartTime = time;
      const baseSwingDuration = this.slashSwingDuration || 1000;
      const swingDuration = baseSwingDuration;

      this.slashArcSpan = this.player.warriorSpin ? Math.PI * 2 : Math.PI;

      while (time - this.slashSwingStartTime >= swingDuration) {
        this.slashSwingStartTime += swingDuration;

        if (!this.player.warriorSpin) {
          this.slashSwingDir *= -1;
        } else {
          this.slashSwingDir = 1;
        }

        if (this.player.warriorSpin) {
          this.spawnWarriorMeleeHit(facingAngle);
        } else if (this.player.warriorSwordQi) {
          this.spawnWarriorCrescentProjectile(facingAngle, this.slashSwingDir);
        } else {
          this.spawnWarriorMeleeHit(facingAngle);
        }
      }
      const swingProgressLinear = Phaser.Math.Clamp((time - this.slashSwingStartTime) / swingDuration, 0, 1);
      const bezier01 = (t, p1, p2) => {
        const u = 1 - t;
        return (3 * u * u * t * p1) + (3 * u * t * t * p2) + (t * t * t);
      };
      const swingProgress = Phaser.Math.Clamp(bezier01(swingProgressLinear, 0.55, 0.98), 0, 1);

      const visualRange = range * 0.48;
      this.displaySlashFan(
        this.player.x,
        this.player.y,
        visualRange,
        facingAngle,
        this.slashSwingDir,
        swingProgress
      );
    },

    spawnWarriorMeleeHit(facingAngle) {
      if (!this.player || !this.bulletManager) return;

      const angle = (typeof facingAngle === 'number') ? facingAngle : -Math.PI / 2;

      const scheme0 = getBasicSkillColorScheme('warrior', this.player.offCoreKey);
      const redCore = 0xff3a3a;
      const redBright = 0xff7777;
      const redGlow = 0xffb3b3;
      const scheme = {
        ...scheme0,
        coreColor: redCore,
        coreBright: redBright,
        accentColor: redCore,
        glowColor: redGlow,
        trailColor: redCore
      };

      const enh = getBasicAttackEnhancements(this.player.mainCoreKey, this.player.offCoreKey);

      const arcSpan = this.player.warriorSpin ? Math.PI * 2 : (Math.PI * 1.12);
      const start = -arcSpan / 2;
      const end = arcSpan / 2;
      const yScale = Phaser.Math.Clamp(this.slashEllipseYScale ?? 0.78, 0.55, 0.95);

      const hitRange = (this.meleeRange || 220) * 0.60;
      const radius = Phaser.Math.Clamp(Math.floor(hitRange), 46, 140);

      const ellipsePoint = (phi, r) => ({
        x: Math.cos(phi) * r,
        y: Math.sin(phi) * r * yScale
      });

      const g = this.add.graphics({ x: this.player.x, y: this.player.y });
      g.setDepth(4);
      g.setVisible(false);

      g.isPlayerBullet = true;
      g.active = true;
      g.markedForRemoval = false;
      g.followPlayer = true;

      g.damage = Math.max(1, Math.round((this.player.bulletDamage || 34) * 1.05));
      g.speed = 0;

      g.radius = 14;
      g.hitShape = 'arcSamples';
      g.arcSampleRadius = 14;
      g.arcSamples = [];

      const ringRadii = this.player.warriorSpin
        ? [radius * 0.35, radius * 0.70, radius]
        : [radius * 0.55, radius];

      const sampleCount = this.player.warriorSpin ? 20 : 12;
      for (let r = 0; r < ringRadii.length; r++) {
        const rr = ringRadii[r];
        for (let s = 0; s < sampleCount; s++) {
          const t = sampleCount === 1 ? 0.5 : (s / (sampleCount - 1));
          const phi = Phaser.Math.Linear(start, end, t);
          const p = ellipsePoint(phi, rr);
          g.arcSamples.push({ x: p.x, y: p.y });
        }
      }

      g.rotation = angle;
      g.angleOffset = angle;
      g.isAbsoluteAngle = true;
      g.homing = false;
      g.explode = false;
      g.skipUpdate = false;

      g.maxLifeMs = 140;
      g.pierce = true;
      g.maxHits = 99;
      g.hitCooldownMs = 9999;

      g.visualCoreColor = scheme.coreBright;
      g.visualAccentColor = scheme.coreColor;

      this.bulletManager.playerBulletGroup.add(g);
      if (enh) {
        applyEnhancementsToBullet(g, enh, scheme);
      }

      this.player.bullets.push(g);
    },

    spawnWarriorCrescentProjectile(facingAngle, swingDir) {
      if (!this.player || !this.bulletManager) return;

      const angle = (typeof facingAngle === 'number') ? facingAngle : -Math.PI / 2;

      const forward = this.player.visualRadius + 14;
      const lateral = 14;
      const perp = angle + Math.PI / 2;
      const spawnX = this.player.x + Math.cos(angle) * forward + Math.cos(perp) * lateral * (swingDir > 0 ? 1 : -1);
      const spawnY = this.player.y + Math.sin(angle) * forward + Math.sin(perp) * lateral * (swingDir > 0 ? 1 : -1);

      const scheme0 = getBasicSkillColorScheme('warrior', this.player.offCoreKey);
      const redCore = 0xff3a3a;
      const redBright = 0xff7777;
      const redGlow = 0xffb3b3;
      const scheme = {
        ...scheme0,
        coreColor: redCore,
        coreBright: redBright,
        accentColor: redCore,
        glowColor: redGlow,
        trailColor: redCore
      };

      const enh = getBasicAttackEnhancements(this.player.mainCoreKey, this.player.offCoreKey);

      const g = this.add.graphics({ x: spawnX, y: spawnY });
      g.setDepth(5);
      g.setBlendMode(Phaser.BlendModes.ADD);

      const baseRange = (this.meleeRange || 220) * 0.48;
      const arcSpan = this.slashArcSpan || Math.PI;
      const start = -arcSpan / 2;
      const end = arcSpan / 2;
      const yScale = Phaser.Math.Clamp(this.slashEllipseYScale ?? 0.78, 0.55, 0.95);

      g.scaleX = 1;
      g.scaleY = 1;

      const crescentR = Phaser.Math.Clamp(Math.floor(baseRange), 34, 78);
      const thickness = Phaser.Math.Clamp(Math.floor(crescentR * 0.26), 10, 22);
      const outerR = crescentR + Math.floor(thickness * 0.55);
      const innerR = Math.max(8, crescentR - Math.floor(thickness * 0.55));
      const segments = 72;

      const ellipsePoint = (phi, r) => ({
        x: Math.cos(phi) * r,
        y: Math.sin(phi) * r * yScale
      });

      g.fillStyle(scheme.coreBright, 0.40);
      g.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const phi = Phaser.Math.Linear(start, end, t);
        const p = ellipsePoint(phi, outerR);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      for (let i = segments; i >= 0; i--) {
        const t = i / segments;
        const phi = Phaser.Math.Linear(start, end, t);
        const p = ellipsePoint(phi, innerR);
        g.lineTo(p.x, p.y);
      }
      g.closePath();
      g.fillPath();

      g.lineStyle(18, scheme.coreColor, 0.14);
      g.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const phi = Phaser.Math.Linear(start, end, t);
        const p = ellipsePoint(phi, outerR);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();

      g.lineStyle(10, scheme.coreBright, 0.92);
      g.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const phi = Phaser.Math.Linear(start, end, t);
        const p = ellipsePoint(phi, crescentR);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();

      g.lineStyle(5, 0xffffff, 0.30);
      g.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const phi = Phaser.Math.Linear(start + 0.03, end - 0.03, t);
        const p = ellipsePoint(phi, innerR + 2);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();

      g.rotation = angle;

      g.damage = Math.max(1, Math.round((this.player.bulletDamage || 34) * 1.05));
      g.speed = 640;
      g.radius = Math.max(8, Math.floor(thickness * 0.55));
      g.hitShape = 'arcSamples';
      g.arcSampleRadius = g.radius;
      g.arcSamples = [];
      const sampleCount = 9;
      for (let s = 0; s < sampleCount; s++) {
        const tt = sampleCount === 1 ? 0.5 : (s / (sampleCount - 1));
        const phi = Phaser.Math.Linear(start, end, tt);
        const p = ellipsePoint(phi, crescentR);
        g.arcSamples.push({ x: p.x, y: p.y });
      }
      g.angleOffset = angle;
      g.isAbsoluteAngle = true;
      g.homing = !!this.player.warriorSwordQi;
      if (g.homing) {
        g.homingTurn = 0.08;
      }
      g.explode = false;
      g.skipUpdate = false;
      g.isPlayerBullet = true;
      g.active = true;
      g.markedForRemoval = false;

      g.maxLifeMs = this.player.warriorSwordQi ? 720 : 520;

      g.pierce = true;
      g.maxHits = 99;
      g.hitCooldownMs = 9999;

      g.visualCoreColor = scheme.coreBright;
      g.visualAccentColor = scheme.coreColor;

      const glow = this.add.circle(spawnX, spawnY, 26, scheme.glowColor, 0.10);
      glow.setStrokeStyle(2, scheme.coreColor, 0.12);
      glow.depth = -1;
      g.glow = glow;

      g.trailTimer = this.time.addEvent({
        delay: 70,
        repeat: -1,
        callback: () => {
          if (!g.active || g.markedForRemoval) {
            if (g.trailTimer) g.trailTimer.remove();
            g.trailTimer = null;
            return;
          }

          const emitAt = (lx, ly) => {
            const cosR = Math.cos(g.rotation || 0);
            const sinR = Math.sin(g.rotation || 0);
            const ex = g.x + (lx * cosR - ly * sinR);
            const ey = g.y + (lx * sinR + ly * cosR);
            const p = this.add.circle(
              ex + Phaser.Math.Between(-2, 2),
              ey + Phaser.Math.Between(-2, 2),
              Phaser.Math.Between(2, 3),
              scheme.trailColor,
              0.75
            );
            this.tweens.add({
              targets: p,
              alpha: 0,
              scale: 0.15,
              duration: 240,
              onComplete: () => p.destroy()
            });
          };

          const p0 = ellipsePoint(start, outerR);
          const p1 = ellipsePoint(end, outerR);
          emitAt(p0.x, p0.y);
          emitAt(p1.x, p1.y);
        }
      });

      this.bulletManager.playerBulletGroup.add(g);

      if (enh) {
        applyEnhancementsToBullet(g, enh, scheme);
      }

      this.player.bullets.push(g);
    },

    isInSlashFan(targetX, targetY, centerX, centerY, range, facing) {
      const dx = targetX - centerX;
      const dy = targetY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > range * 1.12) return false;

      const targetAngle = Math.atan2(dy, dx);
      let facingAngle = 0;
      if (typeof facing === 'number') {
        facingAngle = facing;
      } else {
        switch (facing) {
          case 'up':
            facingAngle = -Math.PI / 2;
            break;
          case 'down':
            facingAngle = Math.PI / 2;
            break;
          case 'left':
            facingAngle = Math.PI;
            break;
          case 'right':
            facingAngle = 0;
            break;
          default:
            facingAngle = Math.PI / 2;
        }
      }

      let angleDiff = targetAngle - facingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const fanAngle = Math.PI * 1.12;
      return Math.abs(angleDiff) <= fanAngle / 2;
    },

    displaySlashFan(centerX, centerY, range, facing, swingDir, swingProgress) {
      if (!this.slashFan || !this.slashFan.active) {
        this.slashFan = this.make.graphics({ x: centerX, y: centerY, add: true });
        this.slashFan.setDepth(5);
        this.slashFan.setBlendMode(Phaser.BlendModes.ADD);
        this.slashGraphics = [];
      } else {
        this.slashFan.setPosition(centerX, centerY);
      }

      this.slashFan.clear();

      this.slashGraphics = this.slashGraphics.filter(g => {
        if (!g.active) {
          g.destroy();
          return false;
        }
        return true;
      });

      let baseAngle = 0;
      if (typeof facing === 'number') {
        baseAngle = facing;
      } else {
        switch (facing) {
          case 'up': baseAngle = -Math.PI / 2; break;
          case 'down': baseAngle = Math.PI / 2; break;
          case 'left': baseAngle = Math.PI; break;
          case 'right': baseAngle = 0; break;
          default: baseAngle = Math.PI / 2;
        }
      }

      const arcSpan = this.slashArcSpan || Math.PI;
      const tailLen = Phaser.Math.Clamp(this.slashTailLength ?? 0.45, 0.15, 0.85);
      const segments = 76;

      const leftAngle = baseAngle - arcSpan / 2;
      const rightAngle = baseAngle + arcSpan / 2;

      const startAngle = swingDir > 0 ? leftAngle : rightAngle;
      const endAngle = swingDir > 0 ? rightAngle : leftAngle;

      const headT = Phaser.Math.Clamp(swingProgress, 0, 1);

      const tailColor = Phaser.Display.Color.ValueToColor(0xff2a2a);
      const midColor = Phaser.Display.Color.ValueToColor(0xff5555);
      const headColor = Phaser.Display.Color.ValueToColor(0xfffff0);

      const lerp3 = (t) => {
        if (t < 0.5) {
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(tailColor, midColor, 100, Math.floor(t * 2 * 100));
          return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        }
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(midColor, headColor, 100, Math.floor((t - 0.5) * 2 * 100));
        return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
      };

      const yScale = Phaser.Math.Clamp(this.slashEllipseYScale ?? 0.78, 0.55, 0.95);
      const toEllipsePoint = (angle) => {
        const phi = angle - baseAngle;
        const rx = range;
        const ry = range * yScale;
        const lx = Math.cos(phi) * rx;
        const ly = Math.sin(phi) * ry;
        const cosA = Math.cos(baseAngle);
        const sinA = Math.sin(baseAngle);
        return {
          x: lx * cosA - ly * sinA,
          y: lx * sinA + ly * cosA
        };
      };

      const drawArc = (radius, coreWidth, glowWidth, coreAlpha, glowAlpha) => {
        let prevX = null;
        let prevY = null;

        for (let i = 0; i < segments; i++) {
          const t = i / (segments - 1);
          const angle = Phaser.Math.Linear(startAngle, endAngle, t);
          const p = toEllipsePoint(angle);
          const x = p.x;
          const y = p.y;

          if (prevX !== null) {
            const behind = headT - t;
            const inTail = behind >= 0 && behind <= tailLen;

            if (!inTail) {
              prevX = x;
              prevY = y;
              continue;
            }

            const u = 1 - behind / tailLen;
            const w = Phaser.Math.Easing.Cubic.Out(u);

            const color = lerp3(w);
            const aCore = Phaser.Math.Clamp(coreAlpha * (0.12 + 0.88 * w), 0, 1);
            const aGlow = Phaser.Math.Clamp(glowAlpha * (0.08 + 0.92 * w), 0, 1);

            const coreW = Phaser.Math.Clamp(coreWidth * (0.55 + 0.55 * w), 2, coreWidth * 1.15);
            const glowW = Phaser.Math.Clamp(glowWidth * (0.45 + 0.75 * w), 3, glowWidth * 1.25);

            this.slashFan.lineStyle(glowW, color, aGlow);
            this.slashFan.lineBetween(prevX, prevY, x, y);
            this.slashFan.lineStyle(coreW, color, aCore);
            this.slashFan.lineBetween(prevX, prevY, x, y);
          }

          prevX = x;
          prevY = y;
        }
      };

      const scale = Phaser.Math.Clamp(range / 220, 0.45, 1);
      drawArc(range, 13 * scale, 34 * scale, 0.92, 0.24);

      const headAngle = Phaser.Math.Linear(startAngle, endAngle, headT);
      const headP = toEllipsePoint(headAngle);
      const headX = headP.x;
      const headY = headP.y;

      this.slashFan.fillStyle(0xfffff0, 0.10);
      this.slashFan.fillCircle(headX, headY, 30 * scale);
      this.slashFan.fillStyle(0xfffff0, 0.08);
      this.slashFan.fillCircle(headX, headY, 44 * scale);

      const hx2 = headX + Math.cos(headAngle) * 8;
      const hy2 = headY + Math.sin(headAngle) * 8;
      this.slashFan.lineStyle(36 * scale, 0xfffff0, 0.08);
      this.slashFan.lineBetween(headX, headY, hx2, hy2);
      this.slashFan.lineStyle(18 * scale, 0xfffff0, 0.95);
      this.slashFan.lineBetween(headX, headY, hx2, hy2);

      if (!this.slashParticleEmitter || !this.slashParticleEmitter.active) {
        const textureKey = 'slash_particle';
        if (!this.textures.exists(textureKey)) {
          const g = this.make.graphics({ x: 0, y: 0, add: false });
          g.fillStyle(0xffffff, 1);
          g.fillCircle(4, 4, 4);
          g.generateTexture(textureKey, 8, 8);
          g.destroy();
        }

        this.slashParticleEmitter = this.add.particles(0, 0, textureKey, {
          quantity: 0,
          lifespan: { min: 160, max: 320 },
          speed: { min: 18, max: 70 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.18, end: 0 },
          alpha: { start: 0.70, end: 0 },
          tint: [0xff2a2a, 0xff5555, 0xfffff0],
          blendMode: 'ADD'
        });

        this.slashParticleManager = this.slashParticleEmitter?.manager || this.slashParticleEmitter;
        if (this.slashParticleManager?.setDepth) this.slashParticleManager.setDepth(6);
        if (this.slashParticleManager?.setBlendMode) this.slashParticleManager.setBlendMode(Phaser.BlendModes.ADD);
      }

      if (this.slashParticleEmitter) {
        const headWorldX = centerX + headX;
        const headWorldY = centerY + headY;
        const tangent = headAngle + (swingDir > 0 ? Math.PI / 2 : -Math.PI / 2);
        const deg = Phaser.Math.RadToDeg(tangent);
        this.slashParticleEmitter.setAngle({ min: deg - 55, max: deg + 55 });

        const samples = 4;
        for (let s = 0; s <= samples; s++) {
          const tt = Phaser.Math.Clamp(headT - (s / samples) * tailLen, 0, 1);
          const a = Phaser.Math.Linear(startAngle, endAngle, tt);
          const ep = toEllipsePoint(a);
          const px = centerX + ep.x;
          const py = centerY + ep.y;
          this.slashParticleEmitter.emitParticleAt(px, py, s === 0 ? 2 : 1);
        }

        this.slashParticleEmitter.emitParticleAt(headWorldX, headWorldY, 2);
      }
    },

    destroySlashFan() {
      if (this.slashFan && this.slashFan.active) {
        this.slashFan.destroy();
        this.slashFan = null;
      }

      if (this.slashGraphics && this.slashGraphics.length > 0) {
        this.slashGraphics.forEach(g => {
          if (g && g.active) g.destroy();
        });
        this.slashGraphics = [];
      }

      if (this.slashParticleManager && this.slashParticleManager.active) {
        this.slashParticleManager.destroy();
        this.slashParticleManager = null;
        this.slashParticleEmitter = null;
      }
    },

    enableMageBuild() {
      this.laserEnabled = true;
      this.player.canFire = true;
      this.player.scatterEnabled = false;
      this.player.setWeapon('laser');
      this.player.laserDamageMult = 2.0;
      this.player.baseFireRate = 320;
      this.player.applyStatMultipliers({ damageMult: 1, fireRateMult: 1, speedMult: 1 });
    },

    upgradeMageCrit() {
      this.player.critChance = Math.min(0.5, this.player.critChance + 0.06);
    },

    upgradeMageCritDamage() {
      this.player.critMultiplier = Math.min(3.2, this.player.critMultiplier + 0.25);
    },

    upgradeMageCharge() {
      this.player.laserDamageMult = Math.min(3.5, this.player.laserDamageMult + 0.3);
      this.player.baseFireRate = Math.min(420, this.player.baseFireRate + 30);
      this.player.applyStatMultipliers(this.player.equipmentMods);
    },

    enablePaladinBuild() {
      this.paladinEnabled = true;
      this.player.canFire = true;
      this.player.scatterEnabled = true;
      this.player.scatterBulletCount = 1;
      this.player.scatterSpread = 0;

      if (this._paladinTargetRing) this._paladinTargetRing.destroy();
      const paladinColor = getBaseColorForCoreKey('paladin');
      this._paladinTargetRing = this.add.circle(0, 0, 28, paladinColor, 0.05);
      this._paladinTargetRing.setStrokeStyle(3, paladinColor, 0.55);
      this._paladinTargetRing.setDepth(60);
      this._paladinTargetRing.setVisible(false);
    },

    updatePaladinTargetingRing(time) {
      if (!this.player) return;

      const mainCore = this.registry?.get?.('mainCore') || this.buildState?.core;
      const active = mainCore === 'paladin' || this.player.mainCoreKey === 'paladin' || this.paladinEnabled;
      if (!active) {
        if (this._paladinTargetRing) this._paladinTargetRing.setVisible(false);
        return;
      }

      if (this._paladinTargetRing && (!this._paladinTargetRing.active || !this._paladinTargetRing.geom)) {
        try { this._paladinTargetRing.destroy(); } catch (_) { /* ignore */ }
        this._paladinTargetRing = null;
      }

      if (!this._paladinTargetRing) {
        const paladinColor = getBaseColorForCoreKey('paladin');
        this._paladinTargetRing = this.add.circle(0, 0, 28, paladinColor, 0.05);
        this._paladinTargetRing.setStrokeStyle(3, paladinColor, 0.55);
        this._paladinTargetRing.setDepth(60);
        this._paladinTargetRing.setVisible(false);
      }

      const acquireRange = 520;
      const target = this.getNearestEnemy(acquireRange);
      if (target && target.isAlive) {
        const baseReach = 140;
        const reach = this.player.paladinPierce ? Math.round(baseReach * 1.12) : baseReach;
        const baseRadius = 160;
        const radius = this.player.paladinPierce ? Math.round(baseRadius * 1.12) : baseRadius;
        const attackRange = reach + radius + 10;

        const r = Phaser.Math.Clamp(attackRange, 120, 520);
        this._paladinTargetRing.setRadius(r);
        this._paladinTargetRing.setPosition(this.player.x, this.player.y);
        this._paladinTargetRing.setVisible(true);
      } else {
        this._paladinTargetRing.setVisible(false);
      }
    },

    updateArcherRangeRing(time) {
      if (!this.player) return;

      const mainCore = this.registry?.get?.('mainCore') || this.buildState?.core;
      const active = mainCore === 'scatter' || this.player.mainCoreKey === 'scatter';
      if (!active) {
        if (this._archerRangeRing) this._archerRangeRing.setVisible(false);
        return;
      }

      if (this._archerRangeRing && (!this._archerRangeRing.active || !this._archerRangeRing.geom)) {
        try { this._archerRangeRing.destroy(); } catch (_) { /* ignore */ }
        this._archerRangeRing = null;
      }

      if (!this._archerRangeRing) {
        const c = 0x00ffff;
        this._archerRangeRing = this.add.circle(0, 0, 28, c, 0.03);
        this._archerRangeRing.setStrokeStyle(2, c, 0.22);
        this._archerRangeRing.setDepth(60);
        this._archerRangeRing.setVisible(false);
      }

      const r = Phaser.Math.Clamp(
        Math.round(this.player.archerArrowRange || this.player.archerArrowRangeBase || 680),
        240,
        860
      );

      this._archerRangeRing.setRadius(r);
      this._archerRangeRing.setPosition(this.player.x, this.player.y);
      this._archerRangeRing.setVisible(true);
    },

    upgradePaladinCooldown() {
      this.paladinCooldown = Math.max(2600, Math.floor(this.paladinCooldown * 0.88));
    },

    upgradePaladinPulse() {
      this.paladinPulseDamage += 24;
      this.paladinPulseRadius += 16;
    },

    upgradePaladinShield() {
      this.player.shieldCharges += 1;
      this.player.updateShieldIndicator();
    },

    updatePaladinPulse(time) {
      if (!this.paladinEnabled || !this.player) return;
      if (time - this.paladinLastTime < this.paladinCooldown) return;

      const boss = this.bossManager.getCurrentBoss();
      const bullets = this.getBossBullets();
      const radius = this.paladinPulseRadius;
      const radiusSq = radius * radius;

      bullets.forEach(bullet => {
        const dx = bullet.x - this.player.x;
        const dy = bullet.y - this.player.y;
        if (dx * dx + dy * dy <= radiusSq) {
          bullet.destroy();
        }
      });

      if (boss && boss.isAlive) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y);
        if (dist <= radius + 40) {
          if (!boss.isInvincible) {
            boss.takeDamage(this.paladinPulseDamage);
            this.showDamageNumber(boss.x, boss.y - 50, this.paladinPulseDamage);
          }
        }
      }

      const paladinColor = getBaseColorForCoreKey('paladin');
      const pulse = this.add.circle(this.player.x, this.player.y, radius, paladinColor, 0.12);
      pulse.setStrokeStyle(2, paladinColor, 0.8);
      this.tweens.add({
        targets: pulse,
        alpha: 0,
        duration: 350,
        onComplete: () => pulse.destroy()
      });

      this.paladinLastTime = time;
    },

    enableWarlockBuild() {
      this.warlockEnabled = true;
      this.warlockDebuffEnabled = true;
      if (this.player) this.player.canFire = true;
    },

    upgradeWarlockPoison() {
      this.warlockPoisonDps += 4;
      this.warlockPoisonDuration += 1200;
    },

    upgradeWarlockWeaken() {
      this.warlockWeakenAmount = Math.min(0.4, this.warlockWeakenAmount + 0.08);
      this.warlockSlowAmount = Math.min(0.45, this.warlockSlowAmount + 0.08);
    },

    upgradeWarlockSlow() {
      this.warlockSlowAmount = Math.min(0.5, this.warlockSlowAmount + 0.08);
    },

    applyWarlockOnHit(boss, forceApply = false) {
      if ((!this.warlockEnabled && !forceApply) || !boss) return;
      if (!boss.debuffs) {
        boss.debuffs = { poisonEnd: 0, poisonTick: 0, weakenEnd: 0 };
      }
      const now = this.time.now;
      const base = this.player?.baseFireRate || 2000;
      const fr = this.player?.fireRate || base;
      const ratio = Phaser.Math.Clamp(fr / base, 0.35, 2.0);
      const poisonTickMs = Math.max(120, Math.round(500 * ratio));
      boss.debuffs.poisonEnd = now + this.warlockPoisonDuration;
      boss.debuffs.poisonTick = Math.min(boss.debuffs.poisonTick || now, now + poisonTickMs);
      boss.debuffs.weakenEnd = now + this.warlockPoisonDuration;
      boss.damageTakenMult = 1 + this.warlockWeakenAmount;

      boss.debuffs.poisonStacks = Math.max(1, boss.debuffs.poisonStacks || 1);
    },

    updateWarlockDebuff(time, delta) {
      const now = this.time?.now ?? time;
      const boss = this.bossManager?.getCurrentBoss?.() || null;
      const minions = this.bossManager?.getMinions?.() || [];
      const targets = [boss, ...(Array.isArray(minions) ? minions : [])].filter(t => t && t.isAlive);
      if (targets.length === 0) return;

      const poisonZones = this.bulletManager?.getPlayerBullets?.()
        ?.filter((b) => b && b.active && !b.markedForRemoval && b.isPoisonZone)
        || [];

      if (!this.warlockEnabled && poisonZones.length === 0) return;

      const circleOverlap = (x1, y1, r1, x2, y2, r2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const rr = (r1 + r2);
        return (dx * dx + dy * dy) < (rr * rr);
      };

      if (poisonZones.length > 0) {
        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          if (!target || !target.isAlive || target.isInvincible) continue;

          const targetR = (target.bossSize ?? target.radius ?? 40);
          let inAnyZone = false;
          for (let z = 0; z < poisonZones.length; z++) {
            const zone = poisonZones[z];
            const zoneR = (zone.radius ?? 0);
            if (zoneR <= 0) continue;
            if (circleOverlap(zone.x, zone.y, zoneR, target.x, target.y, targetR)) {
              inAnyZone = true;
              break;
            }
          }

          if (!inAnyZone) continue;

          target.debuffs = target.debuffs || {};
          target.debuffs.poisonZone = target.debuffs.poisonZone || { stacks: 0, inZoneUntil: 0, nextGainAt: 0, nextDecayAt: 0, nextTickAt: 0 };
          const pz = target.debuffs.poisonZone;
          const wasInZone = (pz.inZoneUntil || 0) > now;
          pz.inZoneUntil = now + 250;
          if (!wasInZone) {
            pz.stacks = Math.max(1, pz.stacks || 0);
            pz.nextGainAt = now + 1000;
            pz.nextDecayAt = 0;
            pz.nextTickAt = now;
          }
        }
      }

      if (boss && boss.isAlive) {
        if (!boss.debuffs) {
          boss.debuffs = { poisonEnd: 0, poisonTick: 0, weakenEnd: 0 };
        }
      }

      if (boss && boss.isAlive && boss.debuffs) {
        const weaknessActive = boss.debuffs.damageDownEnd && time < boss.debuffs.damageDownEnd;
        const smokeActive = boss.debuffs.smokeEnd && time < boss.debuffs.smokeEnd;
        if (!weaknessActive && !smokeActive) {
          boss.damageDealtMult = 1;
          if (boss.debuffs.damageDownEnd && time > boss.debuffs.damageDownEnd) boss.debuffs.damageDownEnd = 0;
          if (boss.debuffs.smokeEnd && time > boss.debuffs.smokeEnd) boss.debuffs.smokeEnd = 0;
        } else {
          boss.damageDealtMult = Math.min(boss.damageDealtMult || 1, 0.85);
        }
      }

      const tickPoisonZone = (target) => {
        if (!target || !target.isAlive) return;
        if (target.isInvincible) return;
        if (!target.debuffs || !target.debuffs.poisonZone) return;

        const pz = target.debuffs.poisonZone;
        const inZone = (pz.inZoneUntil || 0) > now;

        const capBonus = Math.max(0, this.player?.warlockPoisonToxicityStacks || 0);
        const cap = 3 + capBonus;
        const gainIntervalMs = 1000;
        const decayIntervalMs = 1500;
        const tickIntervalMs = 1000;

        pz.stacks = Math.max(0, Math.min(cap, pz.stacks || 0));

        if (inZone) {
          if (!pz.nextGainAt) pz.nextGainAt = now + gainIntervalMs;
          if (now >= pz.nextGainAt) {
            const steps = Math.max(1, Math.floor((now - pz.nextGainAt) / gainIntervalMs) + 1);
            pz.stacks = Math.min(cap, pz.stacks + steps);
            pz.nextGainAt = pz.nextGainAt + steps * gainIntervalMs;
          }
          pz.nextDecayAt = now + decayIntervalMs;
        } else if (pz.stacks > 0) {
          pz.nextGainAt = 0;
          if (!pz.nextDecayAt) pz.nextDecayAt = now + decayIntervalMs;
          if (now >= pz.nextDecayAt) {
            const steps = Math.max(1, Math.floor((now - pz.nextDecayAt) / decayIntervalMs) + 1);
            pz.stacks = Math.max(0, pz.stacks - steps);
            pz.nextDecayAt = pz.nextDecayAt + steps * decayIntervalMs;
          }
        }

        if (target?.setDebuffStacks) {
          target.setDebuffStacks('poisonZone', pz.stacks, { label: '毒', color: '#66ff99' });
        }

        if (pz.stacks > 0) {
          if (!pz.nextTickAt) pz.nextTickAt = now + tickIntervalMs;
          if (now >= pz.nextTickAt) {
            pz.nextTickAt = now + tickIntervalMs;

            const maladyStacks = Math.max(0, this.player?.warlockPoisonDiseaseStacks || 0);
            const damageMult = 1 + 0.15 * maladyStacks;
            const atk = Math.max(1, this.player?.bulletDamage || 1);
            const baseAt1 = Math.max(1, Math.round(atk * 0.30 * damageMult));
            const incPerStack = Math.max(1, Math.round(atk * 0.15 * damageMult));
            const poisonDamage = Math.max(1, Math.round(baseAt1 + (pz.stacks - 1) * incPerStack));

            const critChance = Math.max(0, this.player?.critChance || 0);
            const critMult = Math.max(1, this.player?.critMultiplier || 1);
            const isCrit = critChance > 0 && Math.random() < critChance;
            const finalDamage = isCrit ? Math.max(1, Math.round(poisonDamage * critMult)) : poisonDamage;

            target.takeDamage(finalDamage);
            this.showDamageNumber(target.x, target.y - 30, finalDamage, { color: '#66ff99', isCrit });
          }
        } else {
          if (!inZone) {
            pz.nextTickAt = 0;
            pz.nextGainAt = 0;
            pz.nextDecayAt = 0;
            if (target?.setDebuffStacks) {
              target.setDebuffStacks('poisonZone', 0, { label: '毒', color: '#66ff99' });
            }
          }
        }
      };

      for (let i = 0; i < targets.length; i++) {
        tickPoisonZone(targets[i]);
      }

      if (boss && boss.isAlive && !boss.isInvincible && time < boss.debuffs.poisonEnd && time >= boss.debuffs.poisonTick) {
        const base = this.player?.baseFireRate || 2000;
        const fr = this.player?.fireRate || base;
        const ratio = Phaser.Math.Clamp(fr / base, 0.35, 2.0);
        boss.debuffs.poisonTick = time + Math.max(120, Math.round(500 * ratio));
        const stacks = Math.max(1, boss.debuffs.poisonStacks || 1);
        const poisonDamage = Math.round(this.warlockPoisonDps * 0.5 * stacks);

        const critChance = Math.max(0, this.player?.critChance || 0);
        const critMult = Math.max(1, this.player?.critMultiplier || 1);
        const isCrit = critChance > 0 && Math.random() < critChance;
        const finalDamage = isCrit ? Math.max(1, Math.round(poisonDamage * critMult)) : poisonDamage;

        boss.takeDamage(finalDamage);
        this.showDamageNumber(boss.x, boss.y - 30, finalDamage, { color: '#66ff99', isCrit });
      }

      if (boss && boss.debuffs.poisonEnd && time > boss.debuffs.poisonEnd) {
        boss.debuffs.poisonStacks = 1;
      }

      if (boss && boss.debuffs.weakenEnd && time > boss.debuffs.weakenEnd) {
        boss.damageTakenMult = 1;
      }
    },

    getBossBullets() {
      if (this.bulletManager?.getBossBullets) {
        return this.bulletManager.getBossBullets();
      }

      const bullets = [];
      this.children.list.forEach(child => {
        if (child && child.active && !child.isPlayerBullet && !child.isBoss && !child.isPlayer) {
          if (child.type === 'Arc' || child.type === 'Star' || child.type === 'Rectangle' || child.type === 'Polygon') {
            bullets.push(child);
          }
        }
      });
      return bullets;
    },

    addActiveBuild(upgrade) {
      if (!this.activeBuilds) this.activeBuilds = [];
      if (this.activeBuilds.length >= 3) {
        this.activeBuilds.shift();
      }
      this.activeBuilds.push({ id: upgrade.id, name: upgrade.name, icon: upgrade.icon });
      this.updateInventoryUI();
    }

  });
}
