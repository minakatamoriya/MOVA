import Phaser from 'phaser';
import { applyCoreUpgrade } from '../../classes/attacks/coreEnablers';
import { getBaseColorForCoreKey, getBasicSkillColorScheme } from '../../classes/visual/basicSkillColors';
import { resolveClassColor } from '../../classes/visual/classColors';
import { applyEnhancementsToBullet, getBasicAttackEnhancements } from '../../classes/attacks/basicAttackMods';
import { CORE_OPTIONS, normalizeCoreKey } from '../../classes/classDefs';
import {
  UPGRADE_POOLS,
  OFF_FACTION_ENTRY_OPTIONS,
  UNIVERSAL_POOLS,
  THIRD_SPEC_PREP_OPTIONS,
  DEPTH_SPEC_POOLS,
  DUAL_SPEC_POOLS,
  DUAL_SPEC_GENERIC_BONUS_BY_ID,
  getThirdDepthPrepBonus,
  getThirdDualPrepBonus,
  getThirdSpecPrepOption,
  TALENT_OFFER_WEIGHT_CONFIG
} from '../../classes/upgradePools';
import { getTalentOfferStage } from '../../classes/dualClass';
import { recordSkillTreeProgress as recordSkillTreeProgressToRegistry } from '../../classes/progression';
import { getAccentCoreKeyForOffFaction, getThirdSpecTypeForMainOff, getMaxLevel, getTreeIdForSkill, normalizeSkillId } from '../../classes/talentTrees';
import { getUpgradeOfferPresentation } from '../../classes/upgradeOfferPresentation';
import { calculateResolvedDamage } from '../../combat/damageModel';
import { getPaladinHammerAcquireRange } from '../../classes/attacks/weapons/paladinHammer';
import { spawnWarriorMeleeHit as _spawnWarriorMeleeHit, spawnWarriorCrescentProjectile as _spawnWarriorCrescentProjectile } from '../../classes/attacks/weapons/warriorSlash';

function applyThirdSpecBonusPackage(player, bonuses = {}) {
  if (!player || !bonuses || typeof bonuses !== 'object') return;

  player.thirdSpecDamageBonus = Math.max(0, Number(player.thirdSpecDamageBonus || 0) + Number(bonuses.damageBonus || 0));
  player.thirdSpecFireRateBonus = Math.max(0, Number(player.thirdSpecFireRateBonus || 0) + Number(bonuses.fireRateBonus || 0));
  player.thirdSpecCritChanceBonus = Math.max(0, Number(player.thirdSpecCritChanceBonus || 0) + Number(bonuses.critChanceBonus || 0));
  player.thirdSpecDamageReductionBonus = Math.max(0, Number(player.thirdSpecDamageReductionBonus || 0) + Number(bonuses.damageReductionBonus || 0));
  player.thirdSpecDodgeChanceBonus = Math.max(0, Number(player.thirdSpecDodgeChanceBonus || 0) + Number(bonuses.dodgeChanceBonus || 0));
  player.thirdSpecBlockChanceBonus = Math.max(0, Number(player.thirdSpecBlockChanceBonus || 0) + Number(bonuses.blockChanceBonus || 0));
  player.thirdSpecRegenRatioPerSec = Math.max(0, Number(player.thirdSpecRegenRatioPerSec || 0) + Number(bonuses.regenRatioPerSec || 0));

  player.applyStatMultipliers?.(player.equipmentMods || {});
  player.applyEquipmentEffects?.(player.equipmentMods || {});
}

/**
 * 职业构建 / 升级 / 近战 / 法师 / 圣骑 / 术士 / 德鲁伊宠物 相关方法
 */
export function applyBuildClassMixin(GameScene) {
  Object.assign(GameScene.prototype, {

    isRangeIndicatorEnabled() {
      const v = this.registry?.get?.('showRangeIndicators');
      if (typeof v === 'boolean') return v;
      if (typeof this.showRangeIndicators === 'boolean') return this.showRangeIndicators;
      return true;
    },

    // 统一的“攻击范围圈”样式：只变颜色（职业色），其余一致
    ensureUnifiedRangeRing(propName, classKey) {
      if (!propName) return null;

      const color = resolveClassColor(classKey);

      // 统一样式参数：与圣骑士范围圈一致（更易辨识）
      const fillAlpha = 0.05;
      const strokeWidth = 3;
      const strokeAlpha = 0.55;

      let ring = this[propName];
      if (ring && (!ring.active || !ring.geom || typeof ring.setRadius !== 'function')) {
        try { ring.destroy(); } catch (_) { /* ignore */ }
        ring = null;
      }

      if (!ring) {
        ring = this.add.circle(0, 0, 28, color, fillAlpha);
        ring.setStrokeStyle(strokeWidth, color, strokeAlpha);
        ring.setDepth(60);
        ring.setVisible(false);
        this[propName] = ring;
      } else {
        // 若职业切换，颜色也同步
        try {
          ring.setFillStyle?.(color, fillAlpha);
          ring.setStrokeStyle?.(strokeWidth, color, strokeAlpha);
        } catch (_) {
          // ignore
        }
      }

      return ring;
    },

    applyUpgrade(upgrade) {
      if (!upgrade || !this.player) return;

      const normalizedUpgradeId = normalizeSkillId(upgrade.id);

      const existingOffFaction = this.registry.get('offFaction') || null;
      if (!existingOffFaction) {
        const entryUpgradeToFaction = {
          off_arcane: 'arcane',
          off_ranger: 'ranger',
          off_unyielding: 'unyielding',
          off_summon: 'summon',
          off_guardian: 'guardian',
          off_nature: 'nature'
        };

        const inferredFaction = entryUpgradeToFaction[normalizedUpgradeId]
          || (normalizedUpgradeId.startsWith('arcane_') ? 'arcane' : null)
          || (normalizedUpgradeId.startsWith('ranger_') ? 'ranger' : null)
          || (normalizedUpgradeId.startsWith('unyielding_') ? 'unyielding' : null)
          || (normalizedUpgradeId.startsWith('summon_') ? 'summon' : null)
          || (normalizedUpgradeId.startsWith('guardian_') ? 'guardian' : null)
          || (normalizedUpgradeId.startsWith('nature_') || normalizedUpgradeId.startsWith('druid_pet_') ? 'nature' : null);
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

      switch (normalizedUpgradeId) {
        case 'off_arcane':
        case 'off_ranger':
        case 'off_unyielding':
        case 'off_summon':
        case 'off_guardian':
        case 'off_nature': {
          const map = {
            off_arcane: { faction: 'arcane', accentCore: 'mage' },
            off_ranger: { faction: 'ranger', accentCore: 'archer' },
            off_unyielding: { faction: 'unyielding', accentCore: 'warrior' },
            off_summon: { faction: 'summon', accentCore: 'warlock' },
            off_guardian: { faction: 'guardian', accentCore: 'paladin' },
            off_nature: { faction: 'nature', accentCore: 'druid' }
          };
          const picked = map[normalizedUpgradeId];
          if (picked) {
            this.registry.set('offFaction', picked.faction);
            if (this.player?.setOffCore) this.player.setOffCore(picked.accentCore);

            if (normalizedUpgradeId === 'off_arcane') {
              this.player.arcaneCircleEnabled = true;
              this.player.universalFireRateMult = Math.max(0.6, (this.player.universalFireRateMult || 1) * 0.92);
              this.player.applyStatMultipliers?.(this.player.equipmentMods || {});
            }

            if (normalizedUpgradeId === 'off_ranger') {
              this.player.rangerBeaconEnabled = true;
              this.player.offEntryDodgeChance = Math.max(this.player.offEntryDodgeChance || 0, 0.10);
              this.player.dodgeChance = Math.min(0.95, (this.player.dodgeChance || 0) + 0.10);
            }

            if (normalizedUpgradeId === 'off_unyielding') {
              this.player.bloodrageEnabled = true;
              this.player.bloodragePerStack = Math.max(this.player.bloodragePerStack || 0, 0.02);
              this.player.offEntryCritChance = Math.max(this.player.offEntryCritChance || 0, 0.10);
              this.player.critChance = Math.min(0.95, (this.player.critChance || this.player.baseCritChance || 0.05) + 0.10);
            }

            if (normalizedUpgradeId === 'off_summon') {
              this.player.offEntryDamageMult = Math.max(this.player.offEntryDamageMult || 1, 1.08);
              this.player.summonStarterGuardCount = Math.max(1, this.player.summonStarterGuardCount || 0);
              this.player.summonStarterMageCount = Math.max(1, this.player.summonStarterMageCount || 0);
              this.undeadSummonManager?.refreshFromPlayer?.();
              this.undeadSummonManager?.refreshSummonStats?.();
              this.player.applyStatMultipliers?.(this.player.equipmentMods || {});
            }

            if (normalizedUpgradeId === 'off_guardian') {
              this.player.offEntryDamageReduction = Math.max(this.player.offEntryDamageReduction || 0, 0.10);
              this.player.guardianBlockLevel = Math.max(this.player.guardianBlockLevel || 0, 1);
              this.player.guardianBlockBonus = Math.max(this.player.guardianBlockBonus || 0, 0.05);
              this.player.guardianSacredSealLevel = Math.max(this.player.guardianSacredSealLevel || 0, 1);
              this.player.guardianSealMaxStacks = Math.max(this.player.guardianSealMaxStacks || 0, 3);
            }

            if (normalizedUpgradeId === 'off_nature') {
              this.petManager?.unlockPetByUpgradeId?.('druid_pet_bear');
              this.petManager?.refreshPetStats?.();
            }

            const mainCoreKey = this.registry.get('mainCore') || this.buildState.core;
            const thirdSpecType = getThirdSpecTypeForMainOff({ mainCoreKey, offFaction: picked.faction });
            if (thirdSpecType) this.registry.set('thirdSpecType', thirdSpecType);
          }
          break;
        }

        case 'archer_core':
          this.upgradeWarriorThorns();
          break;
        case 'warrior_swordqi':
          this.player.warriorSwordQiLevel = Math.min(3, (this.player.warriorSwordQiLevel || 0) + 1);
          break;
        case 'warrior_endure':
          this.player.warriorEndureLevel = Math.min(3, (this.player.warriorEndureLevel || 0) + 1);
          break;
        case 'warrior_range':
          this.player.warriorArcLevel = Math.min(3, (this.player.warriorArcLevel || 0) + 1);
          break;
        case 'warrior_lifesteal':
          this.upgradeWarriorLifesteal();
          break;
        case 'mage_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'mage_refract':
        case 'mage_frostbite':
          this.player.mageFrostbiteLevel = Math.min(3, (this.player.mageFrostbiteLevel || 0) + 1);
          break;
        case 'mage_arcane_perception':
        case 'mage_cold_focus': {
          this.player.mageColdFocusLevel = Math.min(3, (this.player.mageColdFocusLevel || 0) + 1);
          const base = this.player.mageMissileRangeBase || this.player.mageMissileRange || 280;
          this.player.mageMissileRangeBase = base;
          this.player.mageMissileRange = Math.round(base + this.player.mageColdFocusLevel * 45);
          break;
        }
        case 'mage_energy_focus':
        case 'mage_ice_veins':
          this.player.mageIceVeinsLevel = Math.min(3, (this.player.mageIceVeinsLevel || 0) + 1);
          break;
        case 'mage_deep_freeze':
          this.player.mageDeepFreezeLevel = Math.min(3, (this.player.mageDeepFreezeLevel || 0) + 1);
          break;
        case 'mage_frost_nova':
          this.player.mageFrostNovaLevel = Math.min(3, (this.player.mageFrostNovaLevel || 0) + 1);
          break;

        case 'archer_bounce':
          this.player.archerArrowBounce = Math.min(3, (this.player.archerArrowBounce || 0) + 1);
          break;
        case 'paladin_core':
          applyCoreUpgrade(this, upgrade.id);
          break;
        case 'paladin_pierce':
          this.player.paladinPierce = true;
          break;
        case 'paladin_repulse':
          this.player.paladinKnockback = Math.max(28, Number(this.player.paladinKnockback || 0));
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
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_corrode':
          this.player.warlockPoisonCorrodeStacks = Math.min(3, (this.player.warlockPoisonCorrodeStacks || 0) + 1);
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_toxicity':
          this.player.warlockPoisonToxicityStacks = Math.min(3, (this.player.warlockPoisonToxicityStacks || 0) + 1);
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_malady':
          this.player.warlockPoisonDiseaseStacks = Math.min(3, (this.player.warlockPoisonDiseaseStacks || 0) + 1);
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_autoseek':
          this.player.warlockPoisonAutoSeek = Math.min(3, (this.player.warlockPoisonAutoSeek || 0) + 1);
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_contagion':
          this.player.warlockPoisonContagion = true;
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_smoke':
          this.player.warlockPoisonSmoke = true;
          this.warlockEnabled = true;
          this.refreshWarlockPoisonNovaState();
          break;
        case 'warlock_plague':
          this.player.warlockPoisonPlague = true;
          this.refreshWarlockPoisonNovaState();
          break;

        case 'arcane_circle':
          this.player.arcaneCircleEnabled = true;
          this.player.arcaneCircleLevel = Math.min(3, (this.player.arcaneCircleLevel || 0) + 1);
          break;
        case 'arcane_circle_range':
          this.player.arcaneCircleRangeLevel = Math.min(3, (this.player.arcaneCircleRangeLevel || 0) + 1);
          break;
        case 'arcane_fire_circle':
          this.player.arcaneFireCircleLevel = Math.min(3, (this.player.arcaneFireCircleLevel || 0) + 1);
          break;
        case 'arcane_frost_circle':
          this.player.arcaneFrostCircleLevel = Math.min(3, (this.player.arcaneFrostCircleLevel || 0) + 1);
          break;
        case 'arcane_resonance_mark':
          this.player.arcaneResonanceMarkLevel = Math.min(3, (this.player.arcaneResonanceMarkLevel || 0) + 1);
          break;
        case 'arcane_flowcasting':
          this.player.arcaneFlowcastingLevel = Math.min(3, (this.player.arcaneFlowcastingLevel || 0) + 1);
          break;

        case 'ranger_snaretrap':
          this.player.rangerSnareTrapLevel = Math.min(3, (this.player.rangerSnareTrapLevel || 0) + 1);
          break;
        case 'ranger_huntmark':
          this.player.rangerHuntmarkLevel = Math.min(3, (this.player.rangerHuntmarkLevel || 0) + 1);
          break;
        case 'ranger_spiketrap':
          this.player.rangerSpikeTrapLevel = Math.min(3, (this.player.rangerSpikeTrapLevel || 0) + 1);
          break;
        case 'ranger_blasttrap':
          this.player.rangerBlastTrapLevel = Math.min(3, (this.player.rangerBlastTrapLevel || 0) + 1);
          break;
        case 'ranger_trapcraft':
          this.player.rangerTrapcraftLevel = Math.min(3, (this.player.rangerTrapcraftLevel || 0) + 1);
          break;
        case 'ranger_pack_hunter':
          this.player.rangerPackHunterLevel = Math.min(3, (this.player.rangerPackHunterLevel || 0) + 1);
          break;

        case 'unyielding_bloodrage':
          this.player.bloodrageEnabled = true;
          this.player.bloodragePerStack = [0, 0.02, 0.03, 0.04][Math.min(3, ((this.player.unyieldingBloodrageLevel || 0) + 1))] || 0.03;
          this.player.unyieldingBloodrageLevel = Math.min(3, (this.player.unyieldingBloodrageLevel || 0) + 1);
          break;
        case 'unyielding_battlecry':
          this.player.battlecryEnabled = true;
          this.player.battlecryBonus = [0, 0.10, 0.20, 0.30][Math.min(3, ((this.player.unyieldingBattlecryLevel || 0) + 1))] || 0.15;
          this.player.unyieldingBattlecryLevel = Math.min(3, (this.player.unyieldingBattlecryLevel || 0) + 1);
          break;
        case 'unyielding_hamstring':
          this.player.unyieldingHamstringLevel = Math.min(3, (this.player.unyieldingHamstringLevel || 0) + 1);
          break;
        case 'unyielding_sunder':
          this.player.unyieldingSunderLevel = Math.min(3, (this.player.unyieldingSunderLevel || 0) + 1);
          break;
        case 'unyielding_standfast':
          this.player.unyieldingStandfastLevel = Math.min(3, (this.player.unyieldingStandfastLevel || 0) + 1);
          break;
        case 'unyielding_executioner':
          this.player.unyieldingExecutionerLevel = Math.min(3, (this.player.unyieldingExecutionerLevel || 0) + 1);
          break;
        case 'unyielding_duel':
          this.player.deathDuelEnabled = true;
          break;

        case 'summon_necrotic_vitality':
          this.player.curseNecroticVitalityLevel = Math.min(3, (this.player.curseNecroticVitalityLevel || 0) + 1);
          this.undeadSummonManager?.refreshSummonStats?.();
          break;
        case 'summon_skeleton_guard':
          this.player.curseSkeletonGuardLevel = Math.min(3, (this.player.curseSkeletonGuardLevel || 0) + 1);
          this.undeadSummonManager?.refreshFromPlayer?.();
          break;
        case 'summon_skeleton_mage':
          this.player.curseSkeletonMageLevel = Math.min(3, (this.player.curseSkeletonMageLevel || 0) + 1);
          this.undeadSummonManager?.refreshFromPlayer?.();
          break;
        case 'summon_mage_empower':
          this.player.curseMageEmpowerLevel = Math.min(3, (this.player.curseMageEmpowerLevel || 0) + 1);
          this.undeadSummonManager?.refreshSummonStats?.();
          break;
        case 'summon_guard_bulwark':
          this.player.curseGuardBulwarkLevel = Math.min(3, (this.player.curseGuardBulwarkLevel || 0) + 1);
          this.undeadSummonManager?.refreshSummonStats?.();
          break;
        case 'summon_ember_echo':
          this.player.curseEmberEchoLevel = Math.min(3, (this.player.curseEmberEchoLevel || 0) + 1);
          break;

        case 'guardian_block':
          this.player.guardianBlockLevel = Math.min(3, (this.player.guardianBlockLevel || 0) + 1);
          this.player.guardianBlockBonus = [0, 0.05, 0.10, 0.15][this.player.guardianBlockLevel] || 0;
          break;
        case 'guardian_armor':
          this.player.flatDamageReduction = Math.min(25, (this.player.flatDamageReduction || 0) + 2);
          break;
        case 'guardian_counter':
          this.player.guardianCounterLevel = Math.min(3, (this.player.guardianCounterLevel || 0) + 1);
          this.player.counterOnBlock = true;
          break;
        case 'guardian_sacred_seal':
          this.player.guardianSacredSealLevel = Math.min(3, (this.player.guardianSacredSealLevel || 0) + 1);
          this.player.guardianSealMaxStacks = 2 + this.player.guardianSacredSealLevel;
          break;
        case 'guardian_holy_rebuke':
          this.player.guardianHolyRebukeLevel = Math.min(3, (this.player.guardianHolyRebukeLevel || 0) + 1);
          break;
        case 'guardian_light_fortress':
          this.player.guardianLightFortressLevel = Math.min(3, (this.player.guardianLightFortressLevel || 0) + 1);
          break;

        // === 紧急冷却天赋（记录 player 属性，实际触发由 installPassiveCooldownSkills 管理） ===
        case 'paladin_divine_shelter':
          this.player.paladinDivineShelterLevel = Math.min(3, (this.player.paladinDivineShelterLevel || 0) + 1);
          break;
        case 'paladin_shelter_extension':
          this.player.paladinShelterExtensionLevel = Math.min(3, (this.player.paladinShelterExtensionLevel || 0) + 1);
          break;
        case 'archer_nimble_evade':
          this.player.archerNimbleEvadeLevel = Math.min(3, (this.player.archerNimbleEvadeLevel || 0) + 1);
          break;
        case 'archer_evade_mastery':
          this.player.archerEvadeMasteryLevel = Math.min(3, (this.player.archerEvadeMasteryLevel || 0) + 1);
          break;
        case 'warrior_blood_conversion':
          this.player.warriorBloodConversionLevel = Math.min(3, (this.player.warriorBloodConversionLevel || 0) + 1);
          break;
        case 'warrior_bloodlust_mastery':
          this.player.warriorBloodlustMasteryLevel = Math.min(3, (this.player.warriorBloodlustMasteryLevel || 0) + 1);
          break;
        case 'mage_shatter':
          this.player.mageShatterLevel = Math.min(3, (this.player.mageShatterLevel || 0) + 1);
          break;
        case 'mage_frost_domain':
          this.player.mageFrostDomainLevel = Math.min(3, (this.player.mageFrostDomainLevel || 0) + 1);
          break;
        case 'druid_nourish':
          this.player.druidNourishLevel = Math.min(3, (this.player.druidNourishLevel || 0) + 1);
          break;
        case 'druid_meteor_shower': {
          this.player.druidMeteorShowerLevel = Math.min(3, (this.player.druidMeteorShowerLevel || 0) + 1);
          const rangeByLevel = [310, 350, 395, 440];
          this.player.druidStarfallRangeBase = rangeByLevel[this.player.druidMeteorShowerLevel] || 310;
          this.player.applyStatMultipliers?.(this.player.equipmentMods || {});
          break;
        }
        case 'druid_meteor':
          this.player.druidMeteorLevel = Math.min(3, (this.player.druidMeteorLevel || 0) + 1);
          break;
        case 'druid_starfire':
          this.player.druidStarfireLevel = Math.min(3, (this.player.druidStarfireLevel || 0) + 1);
          break;
        case 'druid_nourish_growth':
          this.player.druidNourishGrowthLevel = Math.min(3, (this.player.druidNourishGrowthLevel || 0) + 1);
          break;
        case 'warlock_infernal':
          this.player.warlockInfernalLevel = Math.min(3, (this.player.warlockInfernalLevel || 0) + 1);
          break;
        case 'warlock_infernal_contract':
          this.player.warlockInfernalContractLevel = Math.min(3, (this.player.warlockInfernalContractLevel || 0) + 1);
          break;

        // === 第三天赋：准备节点 ===
        case 'third_depth_prep':
          this.player.thirdDepthPrepUnlocked = true;
          applyThirdSpecBonusPackage(this.player, getThirdDepthPrepBonus(normalizeCoreKey(this.registry.get('mainCore') || this.buildState.core))?.bonuses);
          if (normalizeCoreKey(this.registry.get('mainCore') || this.buildState.core) === 'warlock') {
            this.player.warlockDepthInfernalUnlocked = true;
            this.undeadSummonManager?.summonInfernal?.({ persistent: true, level: 3 });
          }
          break;
        case 'third_dual_prep':
          this.player.thirdDualPrepUnlocked = true;
          applyThirdSpecBonusPackage(this.player, getThirdDualPrepBonus({
            mainCoreKey: normalizeCoreKey(this.registry.get('mainCore') || this.buildState.core),
            offFaction: this.registry.get('offFaction') || null
          })?.bonuses);
          break;

        // === 第三天赋：深度专精 ===
        case 'mage_dualcaster':
          this.player.mageDualcaster = Math.min(3, (this.player.mageDualcaster || 0) + 1);
          break;
        case 'mage_trilaser':
          this.player.mageTrilaser = Math.min(3, (this.player.mageTrilaser || 0) + 1);
          break;
        case 'mage_arcanomorph':
          this.player.mageArcanomorphLevel = Math.min(3, (this.player.mageArcanomorphLevel || 0) + 1);
          break;
        case 'archer_windfury':
          this.player.archerWindfury = Math.min(3, (this.player.archerWindfury || 0) + 1);
          break;
        case 'archer_eagleeye':
          this.player.archerEagleeye = Math.min(3, (this.player.archerEagleeye || 0) + 1);
          break;
        case 'warrior_bladestorm':
          this.player.warriorBladestorm = Math.min(3, (this.player.warriorBladestorm || 0) + 1);
          break;
        case 'warrior_berserkgod':
          this.player.warriorBerserkgodLevel = Math.min(3, (this.player.warriorBerserkgodLevel || 0) + 1);
          break;
        case 'warrior_unyielding':
          this.player.warriorUnyielding = Math.min(3, (this.player.warriorUnyielding || 0) + 1);
          break;
        case 'warlock_souleater':
          this.player.warlockSouleaterLevel = Math.min(3, (this.player.warlockSouleaterLevel || 0) + 1);
          break;
        case 'warlock_netherlord':
          this.player.warlockNetherlord = Math.min(3, (this.player.warlockNetherlord || 0) + 1);
          break;
        case 'paladin_avenger':
          this.player.paladinAvengerLevel = Math.min(3, (this.player.paladinAvengerLevel || 0) + 1);
          break;
        case 'paladin_sacredshield':
          this.player.paladinSacredshield = Math.min(3, (this.player.paladinSacredshield || 0) + 1);
          break;
        case 'paladin_divine':
          this.player.paladinDivine = Math.min(3, (this.player.paladinDivine || 0) + 1);
          break;
        case 'druid_kingofbeasts':
          this.player.druidKingofbeasts = Math.min(3, (this.player.druidKingofbeasts || 0) + 1);
          this.petManager?.refreshPetStats?.();
          break;
        case 'druid_naturefusion':
          this.player.druidNaturefusion = Math.min(3, (this.player.druidNaturefusion || 0) + 1);
          break;
        case 'druid_astralstorm':
          this.player.druidAstralstormLevel = Math.min(3, (this.player.druidAstralstormLevel || 0) + 1);
          break;

        // === 第三天赋：双职业专精 ===
        case 'dual_mage_druid_arcanebear':
          this.player.dualArcanebear = true;
          this.petManager?.refreshPetStats?.();
          break;
        case 'dual_mage_druid_starwisdom':
          this.player.dualStarwisdomLevel = Math.min(3, (this.player.dualStarwisdomLevel || 0) + 1);
          break;
        case 'dual_mage_druid_natureoverflow':
          this.player.dualNatureoverflow = true;
          break;
        case 'dual_scatter_mage_enchantedarrow':
          this.player.dualEnchantedarrow = true;
          break;
        case 'dual_scatter_mage_hastefocus':
          this.player.dualHastefocusLevel = Math.min(3, (this.player.dualHastefocusLevel || 0) + 1);
          break;
        case 'dual_scatter_mage_archercircle':
          this.player.dualArchercircle = true;
          break;
        case 'dual_warrior_paladin_crusade':
          this.player.dualCrusade = true;
          break;
        case 'dual_warrior_paladin_righteousrage':
          this.player.dualRighteousrageLevel = Math.min(3, (this.player.dualRighteousrageLevel || 0) + 1);
          break;
        case 'dual_warrior_paladin_sacredspin':
          this.player.dualSacredspin = true;
          break;
        case 'dual_warlock_druid_decay':
          this.player.dualDecay = true;
          this.petManager?.refreshPetStats?.();
          break;
        case 'dual_warlock_druid_witheringroar':
          this.player.dualWitheringroar = true;
          this.petManager?.refreshPetStats?.();
          break;
        case 'dual_warlock_druid_soulbloom':
          this.player.dualSoulbloomLevel = Math.min(3, (this.player.dualSoulbloomLevel || 0) + 1);
          this.petManager?.refreshPetStats?.();
          break;
        case 'dual_paladin_scatter_holyrain':
          this.player.dualHolyrain = true;
          break;
        case 'dual_paladin_scatter_blessedquiver':
          this.player.dualBlessedquiverLevel = Math.min(3, (this.player.dualBlessedquiverLevel || 0) + 1);
          break;
        case 'dual_paladin_scatter_retribution':
          this.player.dualRetribution = true;
          break;
        case 'dual_druid_warrior_ironbark':
          this.player.dualIronbark = true;
          this.petManager?.refreshPetStats?.();
          break;
        case 'dual_druid_warrior_predator':
          this.player.dualPredatorLevel = Math.min(3, (this.player.dualPredatorLevel || 0) + 1);
          this.petManager?.refreshPetStats?.();
          break;
        case 'dual_druid_warrior_ancestral':
          this.player.dualAncestral = true;
          this.petManager?.refreshPetStats?.();
          break;

        default: {
          const genericDualBonus = DUAL_SPEC_GENERIC_BONUS_BY_ID[normalizedUpgradeId] || null;
          if (genericDualBonus) {
            applyThirdSpecBonusPackage(this.player, genericDualBonus);
          }
          break;
        }
      }

      this.installPassiveCooldownSkills?.();

      // (tutorialAwaitingFirstCore 机制已移除 —— 核心在起始房间选武器时确定)
    },

    recordSkillTreeProgress(upgrade) {
      recordSkillTreeProgressToRegistry(this.registry, upgrade);

      if (this.isReactUiMode() && this.viewMenuOpen) {
        this.emitUiSnapshot();
      }
    },

    getPrimaryTarget() {
      const decoy = this.getEnemyAggroTarget?.();
      if (decoy) return decoy;
      const tank = this.petManager?.getTankPet?.();
      if (tank) return tank;
      return this.player;
    },

    getEnemyAggroTarget(source = null) {
      const decoys = this.getHittableDecoys?.() || [];
      if (decoys.length > 0 && source && Number.isFinite(source.x) && Number.isFinite(source.y)) {
        let best = null;
        let bestDistSq = Number.POSITIVE_INFINITY;
        for (let i = 0; i < decoys.length; i += 1) {
          const decoy = decoys[i];
          const radius = Math.max(1, Number(decoy.tauntRadius || 0));
          const dx = decoy.x - source.x;
          const dy = decoy.y - source.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > radius * radius) continue;
          if (distSq < bestDistSq) {
            best = decoy;
            bestDistSq = distSq;
          }
        }
        if (best) return best;
      }

      const tank = this.petManager?.getTankPet?.();
      if (tank) return tank;
      return this.player || null;
    },

    getHittableDecoys() {
      const traps = Array.isArray(this._rangerTraps) ? this._rangerTraps : [];
      return traps.filter((trap) => trap && trap.active !== false && trap.isAlive !== false && (trap.currentHp || 0) > 0 && !trap._consumed);
    },

    switchBuildCore(nextCore) {
      const prevCore = this.buildState?.core;
      if (prevCore && prevCore !== nextCore) {
        this.disableBuildCore(prevCore);
      }
      this.buildState.core = nextCore;
    },

    disableBuildCore(core) {
      switch (normalizeCoreKey(core)) {
        case 'warrior':
          this.disableWarriorBuild();
          break;
        case 'archer':
          if (this.player?.disableArcherBuild) this.player.disableArcherBuild();
          break;
        case 'mage':
          this.laserEnabled = false;
          if (this.player?.disableLaserBuild) this.player.disableLaserBuild();
          break;
        case 'druid':
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

      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;

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
        const er = Number.isFinite(e?.bossSize)
          ? e.bossSize
          : (Number.isFinite(e?.radius) ? e.radius : 0);
        const effectiveMax = Number.isFinite(maxDist)
          ? Math.max(0, maxDist + Math.max(0, er))
          : Infinity;
        const maxD2 = Number.isFinite(effectiveMax) ? (effectiveMax * effectiveMax) : Infinity;
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

    getPendingLevelUpPoints() {
      return Math.max(0, Math.floor(Number(this._pendingLevelUpPoints || 0)));
    },

    getCurrentLevelUpOffer() {
      return this._currentLevelUpOffer || null;
    },

    markLevelUpInteraction() {
      this._levelUpLastInteractionMs = Number(this._gameplayNowMs || 0);
    },

    rollLevelUpOffer(levelOverride = null) {
      if (this.getPendingLevelUpPoints() <= 0) {
        this._currentLevelUpOffer = null;
        this._levelUpActive = false;
        return null;
      }

      const options = this.getLevelUpOptions();
      const offer = {
        id: Math.max(1, Math.floor(Number(this._levelUpOfferSequence || 0)) + 1),
        level: Math.max(1, Math.floor(Number(levelOverride || this.playerData?.level || 1))),
        options: Array.isArray(options) ? options : []
      };

      this._levelUpOfferSequence = offer.id;
      this._currentLevelUpOffer = offer;
      this._levelUpActive = true;
      return offer;
    },

    rerollCurrentLevelUpOffer() {
      if (this.getPendingLevelUpPoints() <= 0) return null;
      if ((this.getRunConsumableCount?.('reroll_dice') || 0) <= 0) return null;

      const currentOffer = this.getCurrentLevelUpOffer?.() || null;
      const level = Math.max(1, Math.floor(Number(currentOffer?.level || this.playerData?.level || 1)));
      const previousSignature = (currentOffer?.options || []).map((opt) => opt?.id || '').join('|');

      let nextOptions = [];
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const candidate = this.getLevelUpOptions();
        if (!Array.isArray(candidate) || candidate.length <= 0) continue;

        nextOptions = candidate;
        const nextSignature = candidate.map((opt) => opt?.id || '').join('|');
        if (nextSignature !== previousSignature) break;
      }

      if (!Array.isArray(nextOptions) || nextOptions.length <= 0) return null;
      if (!this.consumeRunConsumable?.('reroll_dice', 1, { emitUi: false })) return null;

      const offer = {
        id: Math.max(1, Math.floor(Number(this._levelUpOfferSequence || 0)) + 1),
        level,
        options: nextOptions
      };

      this._levelUpOfferSequence = offer.id;
      this._currentLevelUpOffer = offer;
      this._levelUpActive = true;
      this.markLevelUpInteraction?.();
      this.emitUiSnapshot?.();
      return offer;
    },

    ensureLevelUpOffer(levelOverride = null) {
      if (this._currentLevelUpOffer?.options?.length) return this._currentLevelUpOffer;
      return this.rollLevelUpOffer(levelOverride);
    },

    setLevelUpPanelOpen(open) {
      const nextOpen = !!open && this.getPendingLevelUpPoints() > 0;
      this._levelUpPanelOpen = nextOpen;

      if (nextOpen) {
        this.markLevelUpInteraction();
        this.ensureLevelUpOffer();
      }

      this.emitUiSnapshot?.();
      return nextOpen;
    },

    openPendingLevelUpScene() {
      if (this.getPendingLevelUpPoints() <= 0) return false;
      if (this.viewMenuOpen || this.viewMenuClosing) return false;
      if (this.scene?.isActive?.('LevelUpScene')) return false;

      const offer = this.ensureLevelUpOffer();
      if (!offer) return false;

      this._levelUpPanelOpen = true;
      this.markLevelUpInteraction();
      this.clearLevelUpPresentation();
      this.resetTouchJoystickInput?.();
      this.player?.clearAnalogMove?.();
      this.player?.clearTransientCombatEffects?.();
      this.levelUpHudContainer?.setVisible?.(false);

      this.scene.pause('GameScene');
      this.scene.launch('LevelUpScene', {
        level: offer.level || this.playerData?.level || 1,
        choices: offer.options?.length || this.levelUpChoiceCount || 3,
        options: offer.options || [],
        pendingPoints: this.getPendingLevelUpPoints()
      });
      return true;
    },

    consumeLevelUpSelection(selection) {
      if (this._levelUpSelectionLocked) return false;

      const offer = this.getCurrentLevelUpOffer();
      const chosen = typeof selection === 'string'
        ? (offer?.options || []).find((opt) => opt?.id === selection)
        : selection;

      if (!offer || !chosen || this.getPendingLevelUpPoints() <= 0) return false;

      this._levelUpSelectionLocked = true;

      try {
        this.markLevelUpInteraction();
        this.buildState.levelUps += 1;

        const shownEntryIds = (offer?.options || [])
          .map((opt) => normalizeSkillId(opt?.id))
          .filter((id) => OFF_FACTION_ENTRY_OPTIONS.some((opt) => opt.id === id));
        const chosenId = normalizeSkillId(chosen.id);
        const rejectedEntryIds = shownEntryIds.filter((id) => id !== chosenId);

        if (shownEntryIds.length > 0) {
          if (OFF_FACTION_ENTRY_OPTIONS.some((opt) => opt.id === chosenId)) {
            this.registry.set('rejectedOffFactionEntries', []);
          } else if (rejectedEntryIds.length > 0 && !(this.registry.get('offFaction') || null)) {
            const existingRejected = this.registry.get('rejectedOffFactionEntries') || [];
            const mergedRejected = Array.from(new Set([...(Array.isArray(existingRejected) ? existingRejected : []), ...rejectedEntryIds]));
            this.registry.set('rejectedOffFactionEntries', mergedRejected);
          }
        }

        this.applyUpgrade(chosen);

        this._pendingLevelUpPoints = Math.max(0, this.getPendingLevelUpPoints() - 1);
        this._currentLevelUpOffer = null;
        this._levelUpActive = false;

        if (this._pendingLevelUpPoints > 0) {
          this._levelUpPanelOpen = true;
          this.rollLevelUpOffer();
        } else {
          this._levelUpPanelOpen = false;
          this._levelUpPendingSinceMs = 0;
          this._levelUpLastInteractionMs = 0;
        }

        this.events.emit('updatePlayerInfo');
        this.emitUiSnapshot?.();
        return true;
      } finally {
        this._levelUpSelectionLocked = false;
      }
    },

    triggerLevelUp() {
      let levelOverride = null;
      if (arguments && arguments.length > 0 && typeof arguments[0] === 'object') {
        levelOverride = arguments[0]?.levelOverride ?? null;
      }

      if (this.getPendingLevelUpPoints() <= 0) return;

      const offer = this.ensureLevelUpOffer(levelOverride);
      if (!offer) return;

      this.emitUiSnapshot?.();

      this.playLevelUpPresentation({
        level: levelOverride || offer.level || this.playerData.level,
        pendingPoints: this.getPendingLevelUpPoints()
      });
    },

    ensureLevelUpFxTexture() {
      const textureKey = 'levelup_gold_particle';
      if (this.textures.exists(textureKey)) return textureKey;

      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(6, 6, 5);
      g.lineStyle(2, 0xfff6cc, 0.95);
      g.strokeCircle(6, 6, 5);
      g.generateTexture(textureKey, 12, 12);
      g.destroy();
      return textureKey;
    },

    clearLevelUpPresentation() {
      if (this._levelUpPresentationTimer) {
        this._levelUpPresentationTimer.remove(false);
        this._levelUpPresentationTimer = null;
      }

      if (this._levelUpParticleEmitter) {
        this._levelUpParticleEmitter.stop();
        this._levelUpParticleEmitter = null;
      }

      if (this._levelUpParticleManager) {
        this._levelUpParticleManager.destroy();
        this._levelUpParticleManager = null;
      }

      if (Array.isArray(this._levelUpPresentationObjects)) {
        this._levelUpPresentationObjects.forEach((obj) => obj?.destroy?.());
      }
      this._levelUpPresentationObjects = [];
      this._levelUpPresentationFollowState = null;
      this._levelUpCinematicActive = false;
    },

    updateLevelUpPresentationFollow() {
      if (!this._levelUpCinematicActive || !this._levelUpPresentationFollowState || !this.player) return;

      const nextX = Number(this.player.x || 0);
      const nextY = Number(this.player.y || 0);
      const dx = nextX - Number(this._levelUpPresentationFollowState.x || 0);
      const dy = nextY - Number(this._levelUpPresentationFollowState.y || 0);
      if (!dx && !dy) return;

      const objects = Array.isArray(this._levelUpPresentationObjects) ? this._levelUpPresentationObjects : [];
      for (let i = 0; i < objects.length; i += 1) {
        const obj = objects[i];
        if (!obj?.active) continue;
        obj.x += dx;
        obj.y += dy;
      }

      this._levelUpParticleManager?.setPosition?.(nextX, nextY + 10);
      this._levelUpParticleEmitter?.setPosition?.(nextX, nextY + 10);
      this._levelUpPresentationFollowState = { x: nextX, y: nextY };
    },

    playLevelUpPresentation(payload = {}) {
      const level = payload.level || this.playerData?.level || 1;
      const duration = 2000;

      this.clearLevelUpPresentation();
      this.player?.clearTransientCombatEffects?.();

      this._levelUpCinematicActive = true;

      const playerX = this.player?.x ?? this.cameras.main.centerX;
      const playerY = this.player?.y ?? this.cameras.main.centerY;
      const beamHeight = Math.max(620, Math.round(this.cameras.main.height * 1.45));
      const beamCenterY = playerY - Math.round(beamHeight * 0.48);
      const objects = [];
      this._levelUpPresentationFollowState = { x: playerX, y: playerY };

      const pillar = this.add.rectangle(playerX, beamCenterY, 132, beamHeight, 0xf2b63d, 0.10);
      pillar.setBlendMode(Phaser.BlendModes.ADD);
      pillar.setDepth(21);
      objects.push(pillar);

      const pillarMid = this.add.rectangle(playerX, beamCenterY, 84, beamHeight, 0xffdd72, 0.15);
      pillarMid.setBlendMode(Phaser.BlendModes.ADD);
      pillarMid.setDepth(22);
      objects.push(pillarMid);

      const pillarCore = this.add.rectangle(playerX, beamCenterY, 34, beamHeight + 40, 0xfffbef, 0.34);
      pillarCore.setBlendMode(Phaser.BlendModes.ADD);
      pillarCore.setDepth(23);
      objects.push(pillarCore);

      const pillarEdgeLeft = this.add.ellipse(playerX - 26, beamCenterY + 18, 26, beamHeight - 120, 0xffefb4, 0.14);
      pillarEdgeLeft.setBlendMode(Phaser.BlendModes.ADD);
      pillarEdgeLeft.setDepth(22);
      objects.push(pillarEdgeLeft);

      const pillarEdgeRight = this.add.ellipse(playerX + 26, beamCenterY - 12, 22, beamHeight - 160, 0xffcf63, 0.12);
      pillarEdgeRight.setBlendMode(Phaser.BlendModes.ADD);
      pillarEdgeRight.setDepth(22);
      objects.push(pillarEdgeRight);

      const pillarTopGlow = this.add.ellipse(playerX, beamCenterY - Math.round(beamHeight * 0.48), 166, 54, 0xfff4c6, 0.26);
      pillarTopGlow.setStrokeStyle(3, 0xfffff2, 0.68);
      pillarTopGlow.setBlendMode(Phaser.BlendModes.ADD);
      pillarTopGlow.setDepth(24);
      objects.push(pillarTopGlow);

      const pillarTopFlare = this.add.ellipse(playerX, beamCenterY - Math.round(beamHeight * 0.48) + 8, 84, 180, 0xfff9dc, 0.14);
      pillarTopFlare.setBlendMode(Phaser.BlendModes.ADD);
      pillarTopFlare.setDepth(24);
      objects.push(pillarTopFlare);

      const haloOuter = this.add.ellipse(playerX, playerY + 18, 118, 42, 0xffd34d, 0.10);
      haloOuter.setStrokeStyle(4, 0xffd34d, 0.72);
      haloOuter.setBlendMode(Phaser.BlendModes.ADD);
      haloOuter.setDepth(23);
      objects.push(haloOuter);

      const haloInner = this.add.ellipse(playerX, playerY + 16, 72, 24, 0xfff3b0, 0.14);
      haloInner.setStrokeStyle(3, 0xfff8d9, 0.78);
      haloInner.setBlendMode(Phaser.BlendModes.ADD);
      haloInner.setDepth(24);
      objects.push(haloInner);

      const flashCore = this.add.circle(playerX, playerY - 8, 22, 0xfffcf0, 0.88);
      flashCore.setBlendMode(Phaser.BlendModes.ADD);
      flashCore.setDepth(25);
      objects.push(flashCore);

      const flashGlow = this.add.circle(playerX, playerY - 8, 34, 0xffefb4, 0.36);
      flashGlow.setBlendMode(Phaser.BlendModes.ADD);
      flashGlow.setDepth(24);
      objects.push(flashGlow);

      const flashMist = this.add.container(playerX, playerY + 2);
      flashMist.setDepth(23);
      const flashMistPuffs = [
        this.add.ellipse(-18, 6, 68, 42, 0xffd977, 0.13),
        this.add.ellipse(22, -6, 74, 48, 0xffc95a, 0.11),
        this.add.ellipse(6, 18, 92, 38, 0xffefb4, 0.09),
        this.add.ellipse(-2, -18, 58, 30, 0xfff6d8, 0.07)
      ];
      flashMistPuffs.forEach((puff) => {
        puff.setBlendMode(Phaser.BlendModes.ADD);
      });
      flashMist.add(flashMistPuffs);
      objects.push(flashMist);

      const crown = this.add.ellipse(playerX, playerY - 92, 120, 30, 0xffe07a, 0.18);
      crown.setStrokeStyle(3, 0xfff1ba, 0.75);
      crown.setBlendMode(Phaser.BlendModes.ADD);
      crown.setDepth(24);
      objects.push(crown);

      this.tweens.add({
        targets: pillar,
        alpha: { from: 0.02, to: 0.18 },
        scaleX: { from: 0.18, to: 1.22 },
        scaleY: { from: 0.5, to: 1.02 },
        duration: 300,
        ease: 'Sine.easeOut',
        yoyo: true,
        hold: 1220
      });

      this.tweens.add({
        targets: pillarMid,
        alpha: { from: 0.04, to: 0.26 },
        scaleX: { from: 0.22, to: 1.08 },
        scaleY: { from: 0.45, to: 1.03 },
        duration: 260,
        ease: 'Quad.easeOut',
        yoyo: true,
        hold: 1240
      });

      this.tweens.add({
        targets: pillarCore,
        alpha: { from: 0.12, to: 0.46 },
        scaleX: { from: 0.3, to: 1.04 },
        scaleY: { from: 0.22, to: 1.04 },
        duration: 220,
        ease: 'Quad.easeOut',
        yoyo: true,
        hold: 1260
      });

      this.tweens.add({
        targets: [pillarEdgeLeft, pillarEdgeRight],
        alpha: { from: 0.03, to: 0.24 },
        scaleY: { from: 0.4, to: 1.08 },
        duration: 280,
        ease: 'Sine.easeOut',
        yoyo: true,
        hold: 1180
      });

      this.tweens.add({
        targets: pillarEdgeLeft,
        x: playerX - 40,
        duration: 760,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut'
      });

      this.tweens.add({
        targets: pillarEdgeRight,
        x: playerX + 38,
        duration: 680,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut'
      });

      this.tweens.add({
        targets: pillarTopGlow,
        alpha: { from: 0.08, to: 0.42 },
        scaleX: { from: 0.45, to: 1.2 },
        scaleY: { from: 0.35, to: 1.05 },
        duration: 260,
        ease: 'Quad.easeOut',
        yoyo: true,
        hold: 1080
      });

      this.tweens.add({
        targets: pillarTopFlare,
        alpha: { from: 0.04, to: 0.22 },
        scaleY: { from: 0.35, to: 1.15 },
        y: pillarTopFlare.y - 30,
        duration: 320,
        ease: 'Cubic.easeOut',
        yoyo: true,
        hold: 980
      });

      this.tweens.add({
        targets: haloOuter,
        alpha: { from: 0.95, to: 0 },
        scaleX: { from: 0.42, to: 2.8 },
        scaleY: { from: 0.55, to: 1.9 },
        y: playerY + 28,
        duration: 920,
        ease: 'Cubic.easeOut'
      });

      this.tweens.add({
        targets: haloInner,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 0.55, to: 2.2 },
        scaleY: { from: 0.7, to: 1.55 },
        y: playerY + 24,
        duration: 760,
        ease: 'Sine.easeOut'
      });

      this.tweens.add({
        targets: flashCore,
        alpha: { from: 0.88, to: 0 },
        scale: { from: 0.45, to: 2.8 },
        y: playerY - 28,
        duration: 620,
        ease: 'Sine.easeOut'
      });

      this.tweens.add({
        targets: flashGlow,
        alpha: { from: 0.36, to: 0 },
        scale: { from: 0.55, to: 4.6 },
        y: playerY - 42,
        duration: 820,
        ease: 'Quad.easeOut'
      });

      this.tweens.add({
        targets: flashMist,
        alpha: { from: 1, to: 0 },
        scaleX: { from: 0.75, to: 4.9 },
        scaleY: { from: 0.68, to: 2.4 },
        y: playerY - 58,
        angle: 18,
        duration: 980,
        ease: 'Cubic.easeOut'
      });

      this.tweens.add({
        targets: crown,
        alpha: { from: 0.1, to: 0.42 },
        scaleX: { from: 0.5, to: 1.15 },
        scaleY: { from: 0.6, to: 1.05 },
        y: playerY - 116,
        duration: 380,
        yoyo: true,
        hold: 1040,
        ease: 'Sine.easeInOut'
      });

      const textureKey = this.ensureLevelUpFxTexture();
      const particleManager = this.add.particles(playerX, playerY + 10, textureKey, {
        speedX: { min: -90, max: 90 },
        speedY: { min: -280, max: -90 },
        lifespan: { min: 450, max: 980 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 0.95, end: 0 },
        quantity: 3,
        frequency: 45,
        emitting: true,
        tint: [0xffc94e, 0xffe8a3, 0xfffcf2],
        blendMode: 'ADD',
        gravityY: -18
      });
      particleManager.setDepth(26);
      this._levelUpParticleManager = particleManager;
      this._levelUpParticleEmitter = particleManager.emitters?.list?.[0] || null;

      this._levelUpPresentationObjects = objects;

      this.cameras.main.shake(180, 0.010);
      if (this.time) {
        this.time.delayedCall(260, () => {
          if (this._levelUpCinematicActive) this.cameras.main.shake(220, 0.006);
        });
      }

      this._levelUpPresentationTimer = this.time.delayedCall(duration, () => {
        this._levelUpPresentationTimer = null;
        this.clearLevelUpPresentation();
        this._levelUpCinematicActive = false;
        this.emitUiSnapshot?.();
        if (this.time) {
          this.time.delayedCall(0, () => this.startNextPendingLevelUp?.());
        } else {
          this.startNextPendingLevelUp?.();
        }
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
      const offFactionEntryIds = new Set(OFF_FACTION_ENTRY_OPTIONS.map((opt) => opt.id));
      const rejectedOffFactionEntries = new Set(this.registry.get('rejectedOffFactionEntries') || []);

      const skillTreeLevels = this.registry.get('skillTreeLevels') || {};
      const getSkillLevelValue = (id) => {
        const normalizedId = normalizeSkillId(id);
        return skillTreeLevels[normalizedId] || skillTreeLevels[id] || 0;
      };
      const isMaxed = (id) => getSkillLevelValue(id) >= getMaxLevel(id);
      // 这里按“升级次数阶段”控制候选池，而不是继续固定第二次升级只出副职业。
      const stage = getTalentOfferStage(this.buildState.levelUps);

      const mainCore = normalizeCoreKey(this.registry.get('mainCore') || this.buildState.core);
      const offFaction = this.registry.get('offFaction') || null;

      let thirdSpecType = this.registry.get('thirdSpecType') || null;
      if (!thirdSpecType && mainCore && offFaction) {
        thirdSpecType = getThirdSpecTypeForMainOff({ mainCoreKey: mainCore, offFaction });
        if (thirdSpecType) this.registry.set('thirdSpecType', thirdSpecType);
      }

      let pendingThirdPrepOption = null;
      let hasThirdPrep = false;

      let combinedPool = [];

      if (mainCore) {
        combinedPool = combinedPool.concat(pools[mainCore] || []);
      }

      if (offFaction && stage !== 'main_only') {
        combinedPool = combinedPool.concat(universalPools[offFaction] || []);
      }

      if (stage === 'all' && mainCore && offFaction && thirdSpecType) {
        const accentCoreKey = getAccentCoreKeyForOffFaction(offFaction);

        pendingThirdPrepOption = getThirdSpecPrepOption({ specType: thirdSpecType, mainCoreKey: mainCore, offFaction })
          || (thirdSpecType === 'depth' ? THIRD_SPEC_PREP_OPTIONS.depth : THIRD_SPEC_PREP_OPTIONS.dual);
        hasThirdPrep = !!pendingThirdPrepOption && getSkillLevelValue(pendingThirdPrepOption.id) >= getMaxLevel(pendingThirdPrepOption.id);

        if (thirdSpecType === 'depth') {
          if (hasThirdPrep) {
            combinedPool = combinedPool.concat(DEPTH_SPEC_POOLS[mainCore] || []);
          }
        } else if (thirdSpecType === 'dual') {
          if (hasThirdPrep && accentCoreKey && DUAL_SPEC_POOLS[mainCore] && DUAL_SPEC_POOLS[mainCore][accentCoreKey]) {
            combinedPool = combinedPool.concat(DUAL_SPEC_POOLS[mainCore][accentCoreKey] || []);
          }
        }
      }

      combinedPool = combinedPool.filter((opt) => {
        if (!opt?.requiredSkillId) return true;
        return getSkillLevelValue(opt.requiredSkillId) >= getMaxLevel(opt.requiredSkillId);
      });

      combinedPool = combinedPool.filter(opt => !isMaxed(opt.id));
      combinedPool = combinedPool.filter((opt, index, arr) => arr.findIndex((item) => item?.id === opt?.id) === index);

      const weightContext = {
        stage,
        mainCore,
        offFaction,
        skillTreeLevels,
        offFactionEntryIds,
      };

      let options = this.pickWeightedUpgrades(combinedPool, choiceCount, (opt) => this.getUpgradeOfferWeight(opt, weightContext));

      if (!offFaction && stage !== 'main_only') {
        let entryOptions = OFF_FACTION_ENTRY_OPTIONS.filter((opt) => !rejectedOffFactionEntries.has(opt.id));
        if (entryOptions.length <= 0) {
          this.registry.set('rejectedOffFactionEntries', []);
          entryOptions = [...OFF_FACTION_ENTRY_OPTIONS];
        }
        const desiredCount = choiceCount + 1;
        options = this.appendWeightedUniqueUpgrades(
          options,
          entryOptions,
          Math.max(0, desiredCount - options.length),
          (opt) => this.getUpgradeOfferWeight(opt, weightContext)
        );
      }

      if (offFaction && stage === 'all' && pendingThirdPrepOption && !hasThirdPrep) {
        const desiredCount = choiceCount + 1;
        options = this.appendWeightedUniqueUpgrades(
          options,
          [pendingThirdPrepOption],
          Math.max(0, desiredCount - options.length),
          (opt) => this.getUpgradeOfferWeight(opt, weightContext)
        );
      }

      options = options.map((option) => {
        const currentLevel = getSkillLevelValue(option.id);
        return getUpgradeOfferPresentation(option, currentLevel, getMaxLevel(option.id));
      });

      return options;
    },

    getUpgradeOfferWeight(option, context = {}) {
      if (!option?.id) return 0;

      const cfg = TALENT_OFFER_WEIGHT_CONFIG || {};
      const stage = context.stage || 'main_only';
      const mainCore = context.mainCore || null;
      const offFaction = context.offFaction || null;
      const skillTreeLevels = context.skillTreeLevels || {};
      const offFactionEntryIds = context.offFactionEntryIds || new Set();
      const currentLevel = skillTreeLevels[normalizeSkillId(option.id)] || skillTreeLevels[option.id] || 0;
      const maxLevel = getMaxLevel(option.id);
      const isRepeatableTalent = maxLevel > 1;
      const treeId = getTreeIdForSkill(option.id) || null;
      const baseWeight = Math.max(0.01, Number(option.weight) || 1);

      let weight = baseWeight;

      if (treeId && mainCore && treeId === mainCore) {
        weight *= Number(cfg.mainCoreWeightByStage?.[stage]) || 1;
      }

      if (!offFaction && offFactionEntryIds.has(option.id)) {
        weight *= Number(cfg.offFactionEntryWeight) || 1;
      }

      if (offFaction && treeId === offFaction) {
        weight *= Number(cfg.ownedOffFactionWeight) || 1;
      }

      if (treeId === 'third') {
        weight *= Number(cfg.thirdSpecWeight) || 1;
      }

      if (currentLevel > 0) {
        if (isRepeatableTalent) {
          weight *= Number(cfg.repeatableTalentWeight) || 1;
          weight *= Math.pow(Number(cfg.repeatableTalentDecay) || 1, currentLevel);
        } else {
          weight *= Math.pow(Number(cfg.repeatLevelDecay) || 1, currentLevel);
        }
      }

      const testing = cfg.testing || {};
      if (testing.enabled) {
        const favoredTree = testing.favoredTree || null;
        const favoredIds = testing.favoredIds || {};
        const isFavoredId = favoredIds[option.id] != null;

        if (favoredTree && treeId === favoredTree) {
          weight *= Number(testing.favoredTreeMultiplier) || 1;
        }

        if (!offFaction && favoredTree && offFactionEntryIds.has(option.id) && treeId === favoredTree) {
          weight *= Number(testing.favoredOffFactionEntryMultiplier) || 1;
        }

        if (isFavoredId) {
          weight *= Math.max(1, Number(favoredIds[option.id]) || 1);
          if (isRepeatableTalent && testing.favoredRepeatableNoDecay && currentLevel > 0) {
            weight /= Math.pow(Number(cfg.repeatableTalentDecay) || 1, currentLevel);
          }
        }
      }

      return Math.max(0.01, weight);
    },

    pickWeightedUpgrades(options, count, getWeight) {
      const pool = [...options]
        .map((option) => ({ option, weight: Math.max(0, Number(getWeight?.(option)) || 0) }))
        .filter((entry) => entry.option && entry.weight > 0);

      const result = [];

      while (pool.length > 0 && result.length < count) {
        const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
        if (totalWeight <= 0) break;

        let roll = Math.random() * totalWeight;
        let pickedIndex = pool.length - 1;

        for (let index = 0; index < pool.length; index += 1) {
          roll -= pool[index].weight;
          if (roll <= 0) {
            pickedIndex = index;
            break;
          }
        }

        const [picked] = pool.splice(pickedIndex, 1);
        if (picked?.option) result.push(picked.option);
      }

      return result;
    },

    appendWeightedUniqueUpgrades(existingOptions, candidatePool, count, getWeight) {
      if (count <= 0) return [...(existingOptions || [])];

      const takenIds = new Set((existingOptions || []).map((option) => option?.id).filter(Boolean));
      const uniquePool = (candidatePool || []).filter((option) => option?.id && !takenIds.has(option.id));
      if (uniquePool.length === 0) return [...(existingOptions || [])];

      const picks = this.pickWeightedUpgrades(uniquePool, count, getWeight);
      return [...(existingOptions || []), ...picks];
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
      const dir = this.player?.lastDirection || 'south';
      switch (dir) {
        // 8-direction (archer)
        case 'north':
          return { x: 0, y: 1 };
        case 'north-east':
          return { x: -1, y: 1 };
        case 'east':
          return { x: -1, y: 0 };
        case 'south-east':
          return { x: -1, y: -1 };
        case 'south':
          return { x: 0, y: -1 };
        case 'south-west':
          return { x: 1, y: -1 };
        case 'west':
          return { x: 1, y: 0 };
        case 'north-west':
          return { x: 1, y: 1 };

        // 4-direction (legacy)
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
      if (!this.droneEnabled || !this.player || this.player.isAlive === false) return;
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
            const bullet = this.createManagedPlayerBullet?.(
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
      // 初始索敌/攻击范围更小（从近到远排序最短）
      this.player.warriorRangeBase = 220;
      this.meleeRange = this.player.warriorRangeBase;
      this.meleeLifesteal = 0;
      this.player.canFire = false;
      this.player.baseFireRate = 700;
      this.player.baseMaxHp += 30;
      this.player.maxHp += 30;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);

      this.slashFan = null;
      this.slashGraphics = [];
      this.meleeCooldown = 2000;
      this.slashFacingAngle = null;
      this.slashSwingDir = 1;
      this.slashSwingStartTime = 0;
      this.slashSwingDuration = 420;
      this.warriorBladeCycleMs = 2000;
      this.warriorBladeBurstCount = 5;
      this.warriorBladeNextCycleAt = 0;
      this.warriorBladeCycleSeq = 0;
      // 每一挥开始时只生成一次命中判定（用于修复“第一挥只出动画不出判定”）
      this.slashLastHitSwingStartTime = null;
      // 保证一次挥砍完整性：挥砍进行中不因击杀/重选目标而重置或瞬间改向
      this.slashLockedFacingAngle = null;
      this.slashLockUntil = 0;
      this.slashArcSpan = Math.PI;
      this.slashTailLength = 0.32;
      this.slashEllipseYScale = 0.78;

      this.slashParticleManager = null;
      this.slashParticleEmitter = null;

      if (this._warriorTargetRing) this._warriorTargetRing.destroy();
      this.ensureUnifiedRangeRing('_warriorTargetRing', 'warrior');

      this.player.applyStatMultipliers?.(this.player.equipmentMods || {});

      this.events.emit('updatePlayerInfo');
    },

    upgradeWarriorHp() {
      this.player.baseMaxHp += 20;
      this.player.maxHp += 20;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
      this.events.emit('updatePlayerInfo');
    },

    upgradeWarriorThorns() {
      this.thornsPercent = Math.min(0.35, this.thornsPercent + 0.08);
    },

    upgradeWarriorRange() {
      this.player.warriorArcLevel = Math.min(3, (this.player.warriorArcLevel || 0) + 1);
    },

    getWarriorArcSpanDeg() {
      const level = Math.max(0, Math.min(3, Math.round(this.player?.warriorArcLevel || 0)));
      return [90, 120, 180, 270][level] || 90;
    },

    getWarriorBladeComboPattern(swordQiLevel = 0) {
      const spreadScale = Phaser.Math.Clamp(this.getWarriorArcSpanDeg() / 120, 0.85, 2.1);
      const pattern = [
        { delayMs: 0, angleDeg: -22 * spreadScale, swingDir: 1 },
        { delayMs: 72, angleDeg: -8 * spreadScale, swingDir: -1 },
        { delayMs: 144, angleDeg: 10 * spreadScale, swingDir: 1 },
        { delayMs: 216, angleDeg: 24 * spreadScale, swingDir: -1 },
        { delayMs: 288, angleDeg: 2 * spreadScale, swingDir: 1 }
      ];

      if (swordQiLevel >= 2) {
        pattern.push({ delayMs: 360, angleDeg: -14 * spreadScale, swingDir: -1 });
      }

      return pattern;
    },

    triggerWarriorSwingHit(facingAngle, swingDir) {
      const swordQiLevel = Math.max(0, Math.min(3, Math.round(this.player?.warriorSwordQiLevel || 0)));
      const berserkgodLevel = Math.max(0, Math.min(3, Math.round(this.player?.warriorBerserkgodLevel || 0)));
      const bladestormLevel = Math.max(0, Math.min(3, Math.round(this.player?.warriorBladestorm || 0)));
      const unyieldingLevel = Math.max(0, Math.min(3, Math.round(this.player?.warriorUnyielding || 0)));
      const lowHpRatio = (this.player?.maxHp || 0) > 0 ? ((this.player?.hp || 0) / this.player.maxHp) : 1;

      const comboSeq = (this.warriorBladeCycleSeq || 0) + 1;
      this.warriorBladeCycleSeq = comboSeq;
      const comboPattern = this.getWarriorBladeComboPattern(swordQiLevel);
      const comboSign = swingDir >= 0 ? 1 : -1;

      this.player?.playAttackAnimation?.();

      comboPattern.forEach((shot) => {
        this.time?.delayedCall?.(shot.delayMs, () => {
          if (!this.player || this.player.isAlive === false || !this.meleeEnabled) return;
          if (this.warriorBladeCycleSeq !== comboSeq) return;
          const shotAngle = facingAngle + Phaser.Math.DegToRad(shot.angleDeg || 0);
          this.spawnWarriorCrescentProjectile(shotAngle, (shot.swingDir || 1) * comboSign);
        });
      });

      if (swordQiLevel >= 3) {
        this.time?.delayedCall?.(440, () => {
          if (!this.player || this.player.isAlive === false || !this.meleeEnabled) return;
          if (this.warriorBladeCycleSeq !== comboSeq) return;
          this.spawnWarriorCrescentProjectile(facingAngle + Phaser.Math.DegToRad(6 * comboSign), -comboSign);
        });
      }

      if (bladestormLevel > 0 && berserkgodLevel > 0) {
        const extraShots = Math.min(3, berserkgodLevel + Math.max(0, bladestormLevel - 1) + (lowHpRatio <= 0.35 ? unyieldingLevel : 0));
        for (let i = 0; i < extraShots; i++) {
          this.time?.delayedCall?.(120 + i * 70, () => {
            if (!this.player || this.player.isAlive === false || !this.meleeEnabled) return;
            const offsetDeg = (i % 2 === 0 ? 1 : -1) * (18 + i * 8);
            this.spawnWarriorCrescentProjectile(facingAngle + Phaser.Math.DegToRad(offsetDeg), swingDir);
          });
        }
      }
    },

    applyWarriorMainHitEffects(target, now, bullet) {
      const player = this.player;
      if (!player || !target || player.mainCoreKey !== 'warrior') return;

      const tags = Array.isArray(bullet?.tags) ? bullet.tags : [];
      const isWarriorHit = tags.includes('warrior_melee') || tags.includes('warrior_crescent');
      if (!isWarriorHit) return;

      const endureLevel = Math.max(0, Math.min(3, Math.round(player.warriorEndureLevel || 0)));
      if (endureLevel <= 0) return;

      const reductionByLevel = [0, 0.08, 0.12, 0.16];
      const durationByLevel = [0, 1400, 1600, 1800];
      player.warriorGuardReduction = reductionByLevel[endureLevel] || 0;
      player.warriorGuardUntil = Math.max(Number(player.warriorGuardUntil || 0), Number(now || 0) + (durationByLevel[endureLevel] || 1400));
    },

    upgradeWarriorLifesteal() {
      this.meleeLifesteal = Math.min(0.18, (this.meleeLifesteal || 0) + 0.03);
    },

    updateWarriorRangeRing(time) {
      if (!this.player || this.player.isAlive === false) {
        if (this._warriorTargetRing) this._warriorTargetRing.setVisible(false);
        return;
      }

      if (!this.meleeEnabled || !this.isRangeIndicatorEnabled()) {
        if (this._warriorTargetRing) this._warriorTargetRing.setVisible(false);
        return;
      }

      this.ensureUnifiedRangeRing('_warriorTargetRing', 'warrior');

      const range = this.player?.warriorRange || this.meleeRange || 150;
      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;

      const halfMoonR = Phaser.Math.Clamp(Math.floor(range * 0.60), 46, 260);
      const r = this.player.warriorSpin
        ? Phaser.Math.Clamp(range, 90, 420)
        : Phaser.Math.Clamp(halfMoonR, 46, 220);

      this._warriorTargetRing.setRadius(r);
      this._warriorTargetRing.setPosition(px, py);
      this._warriorTargetRing.setVisible(true);
    },

    updateMelee(time) {
      if (!this.meleeEnabled || !this.player || this.player.isAlive === false) return;

      const range = this.player?.warriorRange || this.meleeRange || 150;

      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;

      const cycleDuration = Math.max(1600, Math.round((this.player?.fireRate || 700) * 2.85));

      // 索敌范围（用于“找目标开始挥砍”）：初始更短
      const acquireRange = Math.max(220, range * 1.6);
      const target = this.getNearestEnemy(acquireRange);

      this.updateWarriorRangeRing(time);

      if (!target || !target.isAlive) {
        this.destroySlashFan();
        this.slashLockedFacingAngle = null;
        this.slashLockUntil = 0;
        return;
      }

      const dist = Phaser.Math.Distance.Between(px, py, target.x, target.y);
      const bladeStartRange = Phaser.Math.Clamp(Math.floor(range * 0.92), 90, 320);
      const attackStartRange = this.player.warriorSpin || this.player?.warriorBladestorm ? range : bladeStartRange;
      const targetR = Number.isFinite(target?.bossSize)
        ? target.bossSize
        : (Number.isFinite(target?.radius) ? target.radius : 0);
      const inAttackRange = dist <= (attackStartRange + Math.max(0, targetR));

      if (!inAttackRange) {
        this.destroySlashFan();
        this.slashLockedFacingAngle = null;
        this.slashLockUntil = 0;
        return;
      }

      const computedFacingAngle = Math.atan2(target.y - py, target.x - px);
      const facingAngle = computedFacingAngle;
      this.slashFacingAngle = facingAngle;
      this.destroySlashFan();

      if (!Number.isFinite(this.warriorBladeNextCycleAt) || this.warriorBladeNextCycleAt <= 0) {
        this.warriorBladeNextCycleAt = time;
      }

      if (time >= this.warriorBladeNextCycleAt) {
        this.slashSwingDir *= -1;
        this.warriorBladeNextCycleAt = time + cycleDuration;
        this.triggerWarriorSwingHit(facingAngle, this.slashSwingDir);
      }
    },

    spawnWarriorMeleeHit(facingAngle) {
      _spawnWarriorMeleeHit(this, facingAngle);
    },

    spawnWarriorCrescentProjectile(facingAngle, swingDir) {
      _spawnWarriorCrescentProjectile(this, facingAngle, swingDir);
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
      this.player.archerEnabled = false;
      this.player.setWeapon('mage_frostbolt');
      this.player.baseFireRate = 460;
      this.player.applyStatMultipliers({ damageMult: 1, fireRateMult: 1, speedMult: 1 });
    },

    upgradeMageCrit() {
      this.player.critChance = Math.min(0.5, this.player.critChance + 0.06);
    },

    upgradeMageCritDamage() {
      this.player.critMultiplier = Math.min(3.2, this.player.critMultiplier + 0.25);
    },

    enablePaladinBuild() {
      this.paladinEnabled = true;
      this.player.canFire = true;
      this.player.archerEnabled = true;
      this.player.archerVolleyCount = 1;
      this.player.archerVolleySpread = 0;

      if (this._paladinTargetRing) this._paladinTargetRing.destroy();
      const paladinColor = getBaseColorForCoreKey('paladin');
      this._paladinTargetRing = this.add.circle(0, 0, 28, paladinColor, 0.05);
      this._paladinTargetRing.setStrokeStyle(3, paladinColor, 0.55);
      this._paladinTargetRing.setDepth(60);
      this._paladinTargetRing.setVisible(false);
    },

    updatePaladinTargetingRing(time) {
      if (!this.player || this.player.isAlive === false) {
        if (this._paladinTargetRing) this._paladinTargetRing.setVisible(false);
        return;
      }

      if (!this.isRangeIndicatorEnabled()) {
        if (this._paladinTargetRing) this._paladinTargetRing.setVisible(false);
        return;
      }

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

      this.ensureUnifiedRangeRing('_paladinTargetRing', 'paladin');

      // 常显：不依赖是否找到目标
      // 初始更短：保证“战士 < 圣骑 < 法师 < 德鲁伊 < 猎人”
      // 圣骑锤击：索敌范围内才出手，范围圈显示“索敌半径”
      // 具体落点/伤害在 firePaladinHammer() 内处理
      const acquireRange = getPaladinHammerAcquireRange(this.player);

      const r = Phaser.Math.Clamp(acquireRange, 120, 520);
      this._paladinTargetRing.setRadius(r);
      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;
      this._paladinTargetRing.setPosition(px, py);
      this._paladinTargetRing.setVisible(true);
    },

    updateArcherRangeRing(time) {
      if (!this.player || this.player.isAlive === false) {
        if (this._archerRangeRing) this._archerRangeRing.setVisible(false);
        return;
      }

      if (!this.isRangeIndicatorEnabled()) {
        if (this._archerRangeRing) this._archerRangeRing.setVisible(false);
        return;
      }

      const mainCore = normalizeCoreKey(this.registry?.get?.('mainCore') || this.buildState?.core);
      const playerMainCore = normalizeCoreKey(this.player.mainCoreKey);
      const active = mainCore === 'archer' || playerMainCore === 'archer' || this.player.weaponType === 'archer_arrow';
      if (!active) {
        if (this._archerRangeRing) this._archerRangeRing.setVisible(false);
        return;
      }

      this.ensureUnifiedRangeRing('_archerRangeRing', 'archer');

      const r = Phaser.Math.Clamp(
        Math.round(this.player.archerArrowRange || this.player.archerArrowRangeBase || 330),
        240,
        this.player.archerArrowRangeMax || 420
      );

      this._archerRangeRing.setRadius(r);
      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;
      this._archerRangeRing.setPosition(px, py);
      this._archerRangeRing.setVisible(true);
    },

    updateMageRangeRing(time) {
      if (!this.player || this.player.isAlive === false) {
        if (this._mageRangeRing) this._mageRangeRing.setVisible(false);
        return;
      }

      if (!this.isRangeIndicatorEnabled()) {
        if (this._mageRangeRing) this._mageRangeRing.setVisible(false);
        return;
      }

      const mainCore = this.registry?.get?.('mainCore') || this.buildState?.core;
      const active = mainCore === 'mage' || this.player.mainCoreKey === 'mage'
        || this.player.weaponType === 'mage_frostbolt';
      if (!active) {
        if (this._mageRangeRing) this._mageRangeRing.setVisible(false);
        return;
      }

      this.ensureUnifiedRangeRing('_mageRangeRing', 'mage');

      // 冰法基础技能使用单发冰弹，范围圈对齐冰弹索敌范围
      const r = Math.max(80, Math.round(this.player.mageMissileRange || this.player.mageMissileRangeBase || 280));

      this._mageRangeRing.setRadius(r);
      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;
      this._mageRangeRing.setPosition(px, py);
      this._mageRangeRing.setVisible(true);
    },

    updateDruidRangeRing(time) {
      if (!this.player || this.player.isAlive === false) {
        if (this._druidRangeRing) this._druidRangeRing.setVisible(false);
        return;
      }

      if (!this.isRangeIndicatorEnabled()) {
        if (this._druidRangeRing) this._druidRangeRing.setVisible(false);
        return;
      }

      const mainCore = this.registry?.get?.('mainCore') || this.buildState?.core;
      const active = mainCore === 'druid' || this.player.mainCoreKey === 'druid'
        || this.player.weaponType === 'starfall';
      if (!active) {
        if (this._druidRangeRing) this._druidRangeRing.setVisible(false);
        return;
      }

      this.ensureUnifiedRangeRing('_druidRangeRing', 'druid');

      // 德鲁伊基础技能已经统一为星落，范围圈只反映星落索敌范围
      const starfall = Math.round(this.player.druidStarfallRange || this.player.druidStarfallRangeBase || 310);
      const range = Math.max(120, starfall);
      const r = Phaser.Math.Clamp(range, 200, 980);

      this._druidRangeRing.setRadius(r);
      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;
      this._druidRangeRing.setPosition(px, py);
      this._druidRangeRing.setVisible(true);
    },

    updateWarlockRangeRing(time) {
      if (!this.player || this.player.isAlive === false) {
        if (this._warlockRangeRing) this._warlockRangeRing.setVisible(false);
        return;
      }

      if (!this.isRangeIndicatorEnabled()) {
        if (this._warlockRangeRing) this._warlockRangeRing.setVisible(false);
        return;
      }

      const mainCore = this.registry?.get?.('mainCore') || this.buildState?.core;
      const active = mainCore === 'warlock' || this.player.mainCoreKey === 'warlock'
        || this.player.weaponType === 'warlock_poisonnova';
      if (!active) {
        if (this._warlockRangeRing) this._warlockRangeRing.setVisible(false);
        return;
      }

      this.ensureUnifiedRangeRing('_warlockRangeRing', 'warlock');

      // 术士：剧毒新星是“脚下施放”，这里提示的是毒圈影响半径
      const baseRadius = Math.max(10, Math.round(this.player.warlockPoisonNovaRadius || this.player.warlockPoisonNovaRadiusBase || 96));
      const spreadStacks = Math.max(0, Math.floor(this.player.warlockPoisonSpreadStacks || 0));
      const radius = Math.round(baseRadius * (1 + 0.2 * spreadStacks));
      const r = Phaser.Math.Clamp(radius, 60, 360);

      this._warlockRangeRing.setRadius(r);
      const hp = this.player.getHitboxPosition?.();
      const px = (hp && Number.isFinite(hp.x)) ? hp.x : this.player.x;
      const py = (hp && Number.isFinite(hp.y)) ? hp.y : this.player.y;
      this._warlockRangeRing.setPosition(px, py);
      this._warlockRangeRing.setVisible(true);
    },

    upgradePaladinCooldown() {
      this.paladinCooldown = Math.max(2600, Math.floor(this.paladinCooldown * 0.88));
    },

    upgradePaladinPulse() {
      // 第一次点出时启用基础值；后续升级在此基础上叠加
      if (!Number.isFinite(this.paladinPulseRadius) || this.paladinPulseRadius <= 0) this.paladinPulseRadius = 130;
      if (!Number.isFinite(this.paladinPulseDamage) || this.paladinPulseDamage <= 0) this.paladinPulseDamage = 70;
      this.paladinPulseDamage += 24;
      this.paladinPulseRadius += 16;
    },

    upgradePaladinShield() {
      this.player.shieldCharges += 1;
      this.player.updateShieldIndicator();
    },

    getOffclassCombatTargets() {
      const targets = [];
      const boss = this.bossManager?.getCurrentBoss?.();
      if (boss && boss.isAlive) targets.push(boss);

      const minions = this.bossManager?.getMinions?.() || this.bossManager?.minions || [];
      for (let i = 0; i < minions.length; i++) {
        const minion = minions[i];
        if (minion && minion.isAlive) targets.push(minion);
      }

      return targets;
    },

    updateOffclassTargetDebuffs(now) {
      const player = this.player;
      if (!player) return;

      const targets = this.getOffclassCombatTargets();
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const debuffs = target?.debuffs;
        if (!target || !target.isAlive || !debuffs) continue;

        if ((debuffs.rangerSpikeDotUntil || 0) > now && now >= (debuffs.rangerSpikeDotTickAt || 0)) {
          debuffs.rangerSpikeDotTickAt = now + (debuffs.rangerSpikeDotInterval || 700);
          const damageResult = calculateResolvedDamage({
            attacker: player,
            target,
            baseDamage: Math.max(1, Math.round(debuffs.rangerSpikeDotDamage || 1)),
            now,
            canCrit: false
          });
          target.takeDamage?.(damageResult.amount, { attacker: player, source: 'ranger_spike_dot', suppressHitReaction: true });
          player.onDealDamage?.(damageResult.amount);
          this.applyWarriorOffclassHitEffects?.(target, now);
          this.showDamageNumber?.(target.x, target.y - 24, damageResult.amount, { color: '#b7f27f', fontSize: 20, whisper: true });
        }

        if ((debuffs.arcaneBurnUntil || 0) > now && now >= (debuffs.arcaneBurnTickAt || 0)) {
          debuffs.arcaneBurnTickAt = now + (debuffs.arcaneBurnInterval || 800);
          const damageResult = calculateResolvedDamage({
            attacker: player,
            target,
            baseDamage: Math.max(1, Math.round(debuffs.arcaneBurnDamage || 1)),
            now,
            canCrit: false
          });
          target.takeDamage?.(damageResult.amount, { attacker: player, source: 'arcane_circle_burn', suppressHitReaction: true });
          player.onDealDamage?.(damageResult.amount);
          this.applyWarriorOffclassHitEffects?.(target, now);
          this.showDamageNumber?.(target.x, target.y - 26, damageResult.amount, { color: '#ff9b5f', fontSize: 20, whisper: true });
        }

        if ((debuffs.mageFrost?.expiresAt || 0) > 0 && now >= (debuffs.mageFrost?.expiresAt || 0)) {
          debuffs.mageFrost.stacks = 0;
          debuffs.mageFrost.expiresAt = 0;
          target.setDebuffStacks?.('mageFrost', 0, { label: '冰', color: '#8fdcff' });
        }
      }
    },

    updateOffclassSystems(time, delta) {
      if (!this.player || this.player.isAlive === false) {
        if (Array.isArray(this._offArcaneTurrets) && this._offArcaneTurrets.length > 0) {
          this._offArcaneTurrets.forEach((turret) => this.destroyArcaneTurret?.(turret));
          this._offArcaneTurrets = [];
        }
        if (Array.isArray(this._rangerTraps) && this._rangerTraps.length > 0) {
          this._rangerTraps.forEach((trap) => {
            [trap?.base, trap?.body, trap?.head, trap?.lure, trap?.tauntRing, trap?.shotRing, trap?.hpBarBg, trap?.hpBarFill].forEach((node) => {
              try { node?.destroy?.(); } catch (_) { /* ignore */ }
            });
          });
          this._rangerTraps = [];
        }
        return;
      }
      const now = this.time?.now ?? time ?? 0;
      this.updateOffclassTargetDebuffs(now);
      this.updateWarriorOffclassState(time, delta);
      this.updateArcaneCircleOffclassEffects(time, delta);
      this.updateRangerTrapSystem(time, delta);

      if ((this.player.guardianSealStacks || 0) > 0 && (this.player.guardianSealUntil || 0) <= now) {
        this.player.guardianSealStacks = 0;
      }
    },

    triggerNatureBearGuardQuake(bear) {
      const player = this.player;
      const now = this.time?.now ?? 0;
      if (!player || !bear || !bear.active) return;
      if ((bear.lastGuardQuakeAt || 0) + 2200 > now) return;
      if (Math.random() >= 0.4) return;

      bear.lastGuardQuakeAt = now;
      const radius = 96;
      const ring = this.add.circle(bear.x, bear.y, 22, 0xc5a36d, 0.14);
      ring.setDepth(49);
      ring.setStrokeStyle(3, 0xe3c48d, 0.82);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 2.8,
        scaleY: 2.8,
        duration: 260,
        onComplete: () => ring.destroy()
      });

      const targets = this.getOffclassCombatTargets();
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive) continue;
        const dx = target.x - bear.x;
        const dy = target.y - bear.y;
        if ((dx * dx + dy * dy) > (radius * radius)) continue;
        if (typeof target.applyFreeze === 'function') {
          target.applyFreeze(550, { source: 'nature_bear_guard', player, radius });
        }
      }
    },

    updateWarriorOffclassState(time, delta) {
      const player = this.player;
      if (!player) return;

      if ((player.unyieldingStandfastLevel || 0) <= 0) {
        player.unyieldingStandfastActive = false;
        return;
      }

      const targets = this.getOffclassCombatTargets();
      const radius = Math.max(96, Math.min(170, Math.round((player.warriorRange || player.warriorRangeBase || 220) * 0.6)));
      const radiusSq = radius * radius;

      player.unyieldingStandfastActive = targets.some((target) => {
        if (!target || !target.isAlive) return false;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        return (dx * dx + dy * dy) <= radiusSq;
      });
    },

    applyWarriorOffclassHitEffects(target, now) {
      const player = this.player;
      if (!player || !target || !target.isAlive) return;

      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const closeRange = Math.max(90, Math.min(150, Math.round((player.warriorRange || player.warriorRangeBase || 220) * 0.55)));
      const inCloseRange = (dx * dx + dy * dy) <= (closeRange * closeRange);

      if (inCloseRange && (player.unyieldingHamstringLevel || 0) > 0 && typeof target.applyFreeze === 'function') {
        const freezeMs = [0, 260, 360, 480][Math.max(0, Math.min(3, player.unyieldingHamstringLevel || 0))] || 0;
        if (freezeMs > 0) {
          target.applyFreeze(freezeMs, { source: 'unyielding_hamstring', player, radius: closeRange });
        }
      }

      if ((player.unyieldingSunderLevel || 0) > 0) {
        const sunderMult = [1, 1.06, 1.12, 1.18][Math.max(0, Math.min(3, player.unyieldingSunderLevel || 0))] || 1.06;
        target.debuffs = target.debuffs || {};
        target.debuffs.warriorSunderUntil = now + 2400;
        target.debuffs.warriorSunderMult = sunderMult;
      }
    },

    applyMageFrostHitEffects(target, context = {}) {
      const player = this.player;
      const allowDeadFinisher = !!context.killedByHit;
      if (!player || !target) return;
      if (!target.isAlive && !allowDeadFinisher) return;

      const sourceBullet = context.bullet;
      const isMageCore = player.mainCoreKey === 'mage' || player.weaponType === 'mage_frostbolt';
      if (!isMageCore) return;
      if (!context.fromSpread && !sourceBullet?.frostSpell) return;

      const now = Number(context.now || this.time?.now || 0);
      const slowLevel = Math.max(0, Math.min(3, player.mageFrostbiteLevel || 0));
      const slowPct = [0.22, 0.30, 0.38, 0.48][slowLevel] || 0.22;
      const slowMs = [1500, 1900, 2300, 2700][slowLevel] || 1500;

      if (!context.skipSlow && target.isAlive && typeof target.applySlow === 'function') {
        target.applySlow(slowPct, slowMs);
      }

      this.applyMageFrostStacks(target, 1, now, { fromSpread: !!context.fromSpread, killedByHit: allowDeadFinisher });
    },

    applyMageFrostStacks(target, amount, now, context = {}) {
      const player = this.player;
      const allowDeadFinisher = !!context.killedByHit;
      if (!player || !target) return;
      if (!target.isAlive && !allowDeadFinisher) return;
      const showEnemyOverlays = this.registry?.get?.('showEnemyOverlays') === true;

      target.debuffs = target.debuffs || {};
      const frost = target.debuffs.mageFrost || { stacks: 0, expiresAt: 0 };
      if ((frost.expiresAt || 0) <= now) frost.stacks = 0;

      if (target.isAlive) target.syncOverheadUiVisibility?.();
      frost.stacks = Math.min(5, Math.max(0, Math.round(frost.stacks || 0)) + Math.max(0, Math.round(amount || 0)));
      frost.expiresAt = now + 2600;
      target.debuffs.mageFrost = frost;
      if (target.isAlive) {
        target.setDebuffStacks?.('mageFrost', frost.stacks, { label: '冰', color: '#8fdcff' });
      }

      if (target.isAlive && showEnemyOverlays && !context.fromSpread) {
        this.showDamageNumber?.(target.x, target.y - Math.max(8, (target.bossSize || target.radius || 18) + 40), `冰${frost.stacks}`, {
          color: '#dff7ff',
          fontSize: 14,
          whisper: true
        });
      }

      if (frost.stacks < 5) return;

      frost.stacks = 0;
      frost.expiresAt = 0;
      if (target.isAlive) {
        target.setDebuffStacks?.('mageFrost', 0, { label: '冰', color: '#8fdcff' });
      }
      this.triggerMageShatter(target, now, { allowSpread: !context.fromSpread });
    },

    triggerMageShatter(originTarget, now, options = {}) {
      const player = this.player;
      const level = Math.max(0, Math.min(3, player?.mageShatterLevel || 0));
      if (!player || !originTarget) return;

      const radius = [92, 120, 150, 185][level] || 92;
      const damageScale = [0.45, 0.7, 1.0, 1.35][level] || 0.45;
      const freezeMs = [0, 800, 1200, 1700][Math.max(0, Math.min(3, player?.mageDeepFreezeLevel || 0))] || 0;
      const spreadStacks = level >= 3 ? 2 : 1;
      const startRadius = Math.max(20, Math.round(radius * 0.26));
      this.cameras?.main?.shake?.(100, level >= 2 ? 0.0036 : 0.0024);

      const frostMist = this.add.circle(originTarget.x, originTarget.y, Math.max(26, radius * 0.32), 0xa7ecff, 0.22);
      frostMist.setDepth(55);
      frostMist.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: frostMist,
        alpha: 0,
        scaleX: 1.85,
        scaleY: 1.7,
        duration: 280,
        ease: 'Sine.Out',
        onComplete: () => frostMist.destroy()
      });

      const burst = this.add.circle(originTarget.x, originTarget.y, startRadius, 0xb9ecff, 0.30);
      burst.setDepth(56);
      burst.setStrokeStyle(4, 0xe5f7ff, 0.98);
      this.tweens.add({
        targets: burst,
        alpha: 0,
        scaleX: radius / startRadius,
        scaleY: radius / startRadius,
        duration: 320,
        onComplete: () => burst.destroy()
      });

      const shockRing = this.add.circle(originTarget.x, originTarget.y, Math.max(10, startRadius * 0.72), 0xdff9ff, 0);
      shockRing.setDepth(56);
      shockRing.setStrokeStyle(8, 0xdff9ff, 0.9);
      shockRing.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: shockRing,
        alpha: 0,
        scaleX: radius / Math.max(1, shockRing.radius),
        scaleY: radius / Math.max(1, shockRing.radius),
        duration: 180,
        ease: 'Cubic.Out',
        onComplete: () => shockRing.destroy()
      });

      const iceBloom = this.add.star(originTarget.x, originTarget.y, 8, Math.max(10, radius * 0.12), Math.max(18, radius * 0.42), 0xe9feff, 0.22);
      iceBloom.setDepth(56);
      iceBloom.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: iceBloom,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        angle: 24,
        duration: 220,
        ease: 'Cubic.Out',
        onComplete: () => iceBloom.destroy()
      });

      const coreFlash = this.add.circle(originTarget.x, originTarget.y, Math.max(16, radius * 0.14), 0xffffff, 0.55);
      coreFlash.setDepth(57);
      this.tweens.add({
        targets: coreFlash,
        alpha: 0,
        scaleX: 2.4,
        scaleY: 2.4,
        duration: 180,
        onComplete: () => coreFlash.destroy()
      });

      const shardCount = 8 + level * 2;
      for (let i = 0; i < shardCount; i++) {
        const angle = (Math.PI * 2 * i) / shardCount + (now * 0.0015);
        const shard = this.add.rectangle(originTarget.x, originTarget.y, 8 + (i % 3), 24 + (i % 4) * 6, 0xcff6ff, 0.88);
        shard.setDepth(57);
        shard.setRotation(angle);
        shard.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: shard,
          x: originTarget.x + Math.cos(angle) * (radius * (0.55 + (i % 2) * 0.12)),
          y: originTarget.y + Math.sin(angle) * (radius * (0.55 + (i % 2) * 0.12)),
          alpha: 0,
          scaleX: 0.82,
          scaleY: 1.9,
          duration: 260 + (i % 3) * 30,
          ease: 'Cubic.Out',
          onComplete: () => shard.destroy()
        });
      }

      for (let i = 0; i < 10; i++) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const spark = this.add.circle(originTarget.x, originTarget.y, Phaser.Math.Between(3, 5), 0xf4ffff, 0.95);
        spark.setDepth(58);
        spark.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: spark,
          x: originTarget.x + Math.cos(angle) * Phaser.Math.Between(Math.round(radius * 0.28), Math.round(radius * 0.92)),
          y: originTarget.y + Math.sin(angle) * Phaser.Math.Between(Math.round(radius * 0.28), Math.round(radius * 0.92)),
          alpha: 0,
          scale: 0.1,
          duration: Phaser.Math.Between(180, 280),
          ease: 'Quad.Out',
          onComplete: () => spark.destroy()
        });
      }

      this.vfxSystem?.playHit?.(originTarget.x, originTarget.y, {
        color: 0xd8f7ff,
        radius: Math.max(16, Math.round(radius * 0.3)),
        durationMs: 180
      });

      const originDamage = calculateResolvedDamage({
        attacker: player,
        target: originTarget,
        baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * damageScale)),
        now,
        canCrit: false
      });
      originTarget.takeDamage?.(originDamage.amount, { attacker: player, source: 'mage_shatter_origin', suppressHitReaction: true });
      player.onDealDamage?.(originDamage.amount);
      this.showDamageNumber?.(originTarget.x, originTarget.y - Math.max(28, (originTarget.bossSize || originTarget.radius || 18) + 22), originDamage.amount, {
        color: '#b8f2ff',
        fontSize: 24,
        whisper: true
      });
      this.createHitEffect?.(originTarget.x, originTarget.y, 0xcff6ff);

      if (freezeMs > 0 && typeof originTarget.applyFreeze === 'function') {
        originTarget.applyFreeze(freezeMs, { source: 'mage_deep_freeze', player });
        this.showDamageNumber?.(originTarget.x, originTarget.y - Math.max(24, (originTarget.bossSize || originTarget.radius || 18) + 16), '冻结', {
          color: '#9be7ff',
          fontSize: 18,
          whisper: true
        });
      }

      const targets = this.getOffclassCombatTargets();
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive || target === originTarget || target.isInvincible) continue;
        const dx = target.x - originTarget.x;
        const dy = target.y - originTarget.y;
        if ((dx * dx + dy * dy) > (radius * radius)) continue;

        const damageResult = calculateResolvedDamage({
          attacker: player,
          target,
          baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * damageScale)),
          now,
          canCrit: false
        });
        target.takeDamage?.(damageResult.amount, { attacker: player, source: 'mage_shatter', suppressHitReaction: true });
        player.onDealDamage?.(damageResult.amount);
        this.applyWarriorOffclassHitEffects?.(target, now);
        this.showDamageNumber?.(target.x, target.y - 26, damageResult.amount, { color: '#8fdcff', whisper: true });
        this.createHitEffect?.(target.x, target.y, 0x8fdcff);
        this.showDamageNumber?.(target.x, target.y - Math.max(10, (target.bossSize || target.radius || 18) + 38), `传染+${spreadStacks}`, {
          color: '#dff7ff',
          fontSize: 14,
          whisper: true
        });

        if (options.allowSpread !== false) {
          this.applyMageFrostStacks(target, spreadStacks, now, { fromSpread: true });
        }
      }
    },

    triggerGuardianHolyRebuke(context = {}) {
      const player = this.player;
      if (!player || (player.guardianHolyRebukeLevel || 0) <= 0) return;
      if ((player.guardianSealStacks || 0) < Math.max(1, player.guardianSealMaxStacks || 0)) return;

      const level = Math.max(0, Math.min(3, player.guardianHolyRebukeLevel || 0));
      const now = this.time?.now ?? 0;
      const radius = [0, 120, 135, 150][level] || 120;
      const damageScale = [0, 1.0, 1.5, 2.0][level] || 1;
      const freezeMs = level >= 3 ? 500 : 0;
      const targets = this.getOffclassCombatTargets();

      player.guardianSealStacks = 0;
      player.guardianSealUntil = 0;

      const burst = this.add.circle(player.x, player.y, radius * 0.3, 0xfff0a6, 0.20);
      burst.setDepth(58);
      burst.setStrokeStyle(3, 0xffd36b, 0.95);
      this.tweens.add({
        targets: burst,
        alpha: 0,
        scaleX: 2.8,
        scaleY: 2.8,
        duration: 260,
        onComplete: () => burst.destroy()
      });

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive || target.isInvincible) continue;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        if ((dx * dx + dy * dy) > (radius * radius)) continue;

        const damageResult = calculateResolvedDamage({
          attacker: player,
          target,
          baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * damageScale)),
          now,
          canCrit: false
        });
        target.takeDamage?.(damageResult.amount, { attacker: player, source: 'guardian_holy_rebuke', suppressHitReaction: false });
        player.onDealDamage?.(damageResult.amount);
        this.showDamageNumber?.(target.x, target.y - 30, damageResult.amount, { color: '#ffd36b', whisper: true });
        if (freezeMs > 0 && typeof target.applyFreeze === 'function') {
          target.applyFreeze(freezeMs, { source: 'guardian_holy_rebuke', player, radius });
        }

        if ((player.paladinDivine || 0) > 0) {
          target.debuffs = target.debuffs || {};
          target.debuffs.divineJudgementLevel = Math.max(0, Math.min(3, Math.round(player.paladinDivine || 0)));
          target.debuffs.divineJudgementUntil = now + 2200 + target.debuffs.divineJudgementLevel * 400;
        }
      }

      if ((player.paladinDivine || 0) > 0) {
        this.triggerPaladinDivinePulse?.({ blocked: false, damage: Math.round((player.bulletDamage || 1) * damageScale), level: player.paladinDivine || 0, source: 'guardian_holy_rebuke' });
      }
    },

    triggerPaladinSacredShield(context = {}) {
      const player = this.player;
      const level = Math.max(0, Math.min(3, Math.round(context.level || player?.paladinSacredshield || 0)));
      if (!player || level <= 0) return;

      const now = this.time?.now ?? 0;
      const radius = [0, 112, 136, 164][level] || 112;
      const baseDamage = Math.max(1, Math.round((context.incomingDamage || 0) * ([0, 0.45, 0.62, 0.82][level] || 0.45) + (context.absorbedDamage || 0) * 0.35 + (player.bulletDamage || 1) * 0.35));
      const targets = this.getOffclassCombatTargets();

      const ring = this.add.circle(player.x, player.y, radius * 0.3, 0xfff4b0, 0.14);
      ring.setDepth(58);
      ring.setStrokeStyle(2, 0xffd36b, 0.92);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 2.2,
        scaleY: 2.2,
        duration: 180,
        onComplete: () => ring.destroy()
      });

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive || target.isInvincible) continue;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        if ((dx * dx + dy * dy) > radius * radius) continue;

        const damageResult = calculateResolvedDamage({
          attacker: player,
          target,
          baseDamage,
          now,
          canCrit: false
        });
        target.takeDamage?.(damageResult.amount, { attacker: player, source: 'paladin_sacredshield', suppressHitReaction: false });
        player.onDealDamage?.(damageResult.amount);
        this.showDamageNumber?.(target.x, target.y - 28, damageResult.amount, { color: '#ffe28a', whisper: true });
      }
    },

    triggerPaladinDivinePulse(context = {}) {
      const player = this.player;
      const level = Math.max(0, Math.min(3, Math.round(context.level || player?.paladinDivine || 0)));
      if (!player || level <= 0) return;

      const now = this.time?.now ?? 0;
      const radius = [0, 138, 166, 198][level] || 138;
      const damageScale = [0, 0.70, 0.95, 1.25][level] || 0.70;
      const stunChance = level >= 3 ? 0.35 : (level >= 2 ? 0.18 : 0);
      const targets = this.getOffclassCombatTargets();

      const shock = this.add.circle(player.x, player.y, radius * 0.25, 0xfff0a6, 0.12);
      shock.setDepth(59);
      shock.setStrokeStyle(3, 0xffd36b, 0.96);
      this.tweens.add({
        targets: shock,
        alpha: 0,
        scaleX: 3,
        scaleY: 3,
        duration: 240,
        onComplete: () => shock.destroy()
      });

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive || target.isInvincible) continue;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        if ((dx * dx + dy * dy) > radius * radius) continue;

        target.debuffs = target.debuffs || {};
        target.debuffs.divineJudgementLevel = level;
        target.debuffs.divineJudgementUntil = now + 2200 + level * 500;

        const damageResult = calculateResolvedDamage({
          attacker: player,
          target,
          baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * damageScale + (context.damage || 0) * 0.20)),
          now,
          canCrit: false
        });
        target.takeDamage?.(damageResult.amount, { attacker: player, source: context.source || 'paladin_divine', suppressHitReaction: false });
        player.onDealDamage?.(damageResult.amount);
        this.showDamageNumber?.(target.x, target.y - 30, damageResult.amount, { color: '#ffd36b', whisper: true });

        if (stunChance > 0 && Math.random() < stunChance && typeof target.applyStun === 'function') {
          target.applyStun(380 + level * 80);
        }
      }
    },

    triggerWarlockSouleaterBurst(originX, originY) {
      const player = this.player;
      const level = Math.max(0, Math.min(3, Math.round(player?.warlockSouleaterLevel || 0)));
      if (!player || level <= 0) return;

      const now = this.time?.now ?? 0;
      const radius = [0, 116, 148, 188][level] || 116;
      const targets = this.getOffclassCombatTargets();
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive || target.isInvincible) continue;
        const dx = target.x - originX;
        const dy = target.y - originY;
        if ((dx * dx + dy * dy) > radius * radius) continue;

        target.debuffs = target.debuffs || {};
        const pz = target.debuffs.poisonZone || { stacks: 0, inZoneUntil: 0, nextGainAt: 0, nextDecayAt: 0, nextTickAt: 0 };
        pz.stacks = Math.min(6 + level, Math.max((pz.stacks || 0) + level, level + 1));
        pz.inZoneUntil = now + 1600 + level * 300;
        pz.nextTickAt = Math.min(pz.nextTickAt || 0, now);
        target.debuffs.poisonZone = pz;

        const damageResult = calculateResolvedDamage({
          attacker: player,
          target,
          baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * ([0, 0.45, 0.62, 0.82][level] || 0.45))),
          now,
          canCrit: false
        });
        target.takeDamage?.(damageResult.amount, { attacker: player, source: 'warlock_souleater', suppressHitReaction: false });
        player.onDealDamage?.(damageResult.amount);
        this.showDamageNumber?.(target.x, target.y - 26, damageResult.amount, { color: '#7dff7a', whisper: true });
      }

      const ring = this.add.circle(originX, originY, radius * 0.3, 0x66ff99, 0.10);
      ring.setDepth(57);
      ring.setStrokeStyle(3, 0x7dff7a, 0.92);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 2.6,
        scaleY: 2.6,
        duration: 220,
        onComplete: () => ring.destroy()
      });
    },

    destroyArcaneTurret(turret) {
      if (!turret) return;
      [turret.aura, turret.ring, turret.innerRing, turret.crystal, turret.core].forEach((node) => {
        try { node?.destroy?.(); } catch (_) { /* ignore */ }
      });
      turret._consumed = true;
    },

    spawnArcaneTurret(x, y, now) {
      const player = this.player;
      if (!player) return null;

      const aura = this.add.circle(x, y + 10, 34, 0x73bfff, 0.06);
      aura.setDepth(46);
      aura.setStrokeStyle(2, 0x73bfff, 0.18);

      const ring = this.add.circle(x, y + 10, 18, 0x7bc6ff, 0.09);
      ring.setDepth(47);
      ring.setStrokeStyle(2, 0x7bc6ff, 0.76);

      const innerRing = this.add.circle(x, y + 10, 9, 0xb7ebff, 0.08);
      innerRing.setDepth(48);
      innerRing.setStrokeStyle(1, 0xdff6ff, 0.54);

      const crystal = this.add.rectangle(x, y - 8, 16, 28, 0x8de4ff, 0.92);
      crystal.setDepth(49);
      crystal.setAngle(45);
      crystal.setBlendMode(Phaser.BlendModes.ADD);

      const core = this.add.circle(x, y - 8, 4, 0xf4fdff, 0.95);
      core.setDepth(50);
      core.setBlendMode(Phaser.BlendModes.ADD);

      const level = Math.max(0, player.arcaneCircleLevel || 0);
      const fireLevel = Math.max(0, player.arcaneFireCircleLevel || 0);
      const durationLevel = Math.max(0, player.arcaneFrostCircleLevel || 0);
      const rangeLevel = Math.max(0, player.arcaneCircleRangeLevel || 0);
      const flowLevel = Math.max(0, player.arcaneFlowcastingLevel || 0);

      return {
        x,
        y,
        aura,
        ring,
        innerRing,
        crystal,
        core,
        spawnedAt: now,
        expiresAt: now + (15000 + durationLevel * 1800),
        nextShotAt: now + 900,
        bobSeed: Math.random() * Math.PI * 2,
        range: 380 + rangeLevel * 80,
        fireIntervalMs: Math.max(1800, 3000 - level * 220),
        damageScale: 0.62 + fireLevel * 0.24 + level * 0.08,
        beamWidth: 30 + level * 10 + fireLevel * 3,
        windupMs: Math.max(120, 210 - level * 18),
        exposureMult: [1, 1.06, 1.12, 1.18][Math.max(0, Math.min(3, player.arcaneResonanceMarkLevel || 0))] || 1
      };
    },

    beginArcaneTurretPulse(turret, target, now) {
      if (!turret || turret._consumed || !target || !target.isAlive || target.isInvincible) return;

      const originX = turret.core?.x ?? turret.x;
      const originY = turret.core?.y ?? (turret.y - 10);
      const aimAngle = Phaser.Math.Angle.Between(originX, originY, target.x, target.y);
      const windupMs = Math.max(90, turret.windupMs || 180);

      const flash = this.add.circle(originX, originY, Math.max(12, (turret.beamWidth || 30) * 0.42), 0xe3fbff, 0.2);
      flash.setDepth(52);
      flash.setBlendMode(Phaser.BlendModes.ADD);

      const spark = this.add.rectangle(originX, originY, Math.max(18, (turret.beamWidth || 30) * 0.9), Math.max(10, (turret.beamWidth || 30) * 0.22), 0xb7efff, 0.36);
      spark.setDepth(53);
      spark.setAngle(Phaser.Math.RadToDeg(aimAngle));
      spark.setBlendMode(Phaser.BlendModes.ADD);

      this.tweens.add({
        targets: [flash, spark],
        alpha: { from: 0.18, to: 0.95 },
        scaleX: { from: 0.75, to: 1.9 },
        scaleY: { from: 0.75, to: 1.25 },
        duration: windupMs,
        ease: 'Sine.Out',
        onComplete: () => {
          try { flash.destroy(); } catch (_) { /* ignore */ }
          try { spark.destroy(); } catch (_) { /* ignore */ }
        }
      });

      this.time.delayedCall(windupMs, () => {
        if (!turret || turret._consumed || !target || !target.isAlive || target.isInvincible) return;
        this.fireArcaneTurretPulse(turret, target, this.time?.now ?? now + windupMs);
      });
    },

    fireArcaneTurretPulse(turret, target, now) {
      const player = this.player;
      if (!player || !turret || !target || !target.isAlive || target.isInvincible) return;

      const startX = turret.core?.x ?? turret.x;
      const startY = turret.core?.y ?? (turret.y - 8);
      const beamAngle = Phaser.Math.Angle.Between(startX, startY, target.x, target.y);
      const beamLength = Math.max(40, turret.range || 280);
      const fadeTailLength = Math.max(140, beamLength * 0.42);
      const visualLength = beamLength + fadeTailLength;
      const dirX = Math.cos(beamAngle);
      const dirY = Math.sin(beamAngle);
      const endX = startX + dirX * visualLength;
      const endY = startY + dirY * visualLength;
      const beamWidth = Math.max(20, turret.beamWidth || 30);

      const bodyLength = beamLength;
      const tailLength = fadeTailLength;
      const segments = [];
      const segmentDefs = [
        {
          length: bodyLength,
          offset: bodyLength * 0.5,
          glowAlpha: 0.18,
          shellAlpha: 0.32,
          coreAlpha: 0.96,
          widthMult: 1
        },
        {
          length: tailLength * 0.38,
          offset: bodyLength + (tailLength * 0.19),
          glowAlpha: 0.13,
          shellAlpha: 0.18,
          coreAlpha: 0.28,
          widthMult: 0.92
        },
        {
          length: tailLength * 0.34,
          offset: bodyLength + (tailLength * 0.55),
          glowAlpha: 0.08,
          shellAlpha: 0.1,
          coreAlpha: 0.12,
          widthMult: 0.74
        },
        {
          length: tailLength * 0.28,
          offset: bodyLength + (tailLength * 0.86),
          glowAlpha: 0.03,
          shellAlpha: 0.04,
          coreAlpha: 0.04,
          widthMult: 0.54
        }
      ];
      for (let i = 0; i < segmentDefs.length; i++) {
        const segment = segmentDefs[i];
        const centerX = startX + dirX * segment.offset;
        const centerY = startY + dirY * segment.offset;
        const width = beamWidth * segment.widthMult;

        const glow = this.add.rectangle(centerX, centerY, segment.length, width * 1.7, 0x6ed8ff, segment.glowAlpha);
        glow.setDepth(48);
        glow.setAngle(Phaser.Math.RadToDeg(beamAngle));
        glow.setBlendMode(Phaser.BlendModes.ADD);

        const shell = this.add.rectangle(centerX, centerY, segment.length, width, 0x93ebff, segment.shellAlpha);
        shell.setDepth(49);
        shell.setAngle(Phaser.Math.RadToDeg(beamAngle));
        shell.setBlendMode(Phaser.BlendModes.ADD);

        const core = this.add.rectangle(centerX, centerY, segment.length, Math.max(6, width * 0.42), 0xf6feff, segment.coreAlpha);
        core.setDepth(50);
        core.setAngle(Phaser.Math.RadToDeg(beamAngle));
        core.setBlendMode(Phaser.BlendModes.ADD);

        segments.push(glow, shell, core);
      }

      const muzzle = this.add.circle(startX, startY, Math.max(12, beamWidth * 0.48), 0xc8f6ff, 0.52);
      muzzle.setDepth(51);
      muzzle.setBlendMode(Phaser.BlendModes.ADD);

      const beamFx = [...segments, muzzle];
      this.tweens.add({
        targets: beamFx,
        alpha: 0,
        duration: 170,
        ease: 'Quad.Out',
        onComplete: () => {
          for (let i = 0; i < beamFx.length; i++) {
            try { beamFx[i].destroy(); } catch (_) { /* ignore */ }
          }
        }
      });

      const targets = this.getOffclassCombatTargets();
      const beamHalfWidth = beamWidth * 0.5;
      const pierced = [];
      for (let i = 0; i < targets.length; i++) {
        const enemy = targets[i];
        if (!enemy || !enemy.isAlive || enemy.isInvincible) continue;
        const relX = enemy.x - startX;
        const relY = enemy.y - startY;
        const projected = relX * dirX + relY * dirY;
        const targetRadius = Math.max(10, Number(enemy.bossSize ?? enemy.radius ?? 18));
        if (projected < -targetRadius || projected > beamLength + targetRadius) continue;
        const perpendicular = Math.abs(relX * dirY - relY * dirX);
        if (perpendicular > beamHalfWidth + targetRadius) continue;
        pierced.push({ enemy, projected });
      }

      pierced.sort((a, b) => a.projected - b.projected);
      for (let i = 0; i < pierced.length; i++) {
        const enemy = pierced[i].enemy;
        const frostStacks = Math.max(0, enemy.debuffs?.mageFrost?.stacks || 0);
        const synergyMult = frostStacks > 0 ? (1 + Math.min(0.18, frostStacks * 0.04)) : 1;
        const damageResult = calculateResolvedDamage({
          attacker: player,
          target: enemy,
          baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * turret.damageScale * synergyMult)),
          now,
          canCrit: true
        });
        enemy.takeDamage?.(damageResult.amount, { attacker: player, source: 'arcane_turret_beam', suppressHitReaction: i > 0 });
        player.onDealDamage?.(damageResult.amount);
        this.applyWarriorOffclassHitEffects?.(enemy, now);
        if (turret.exposureMult > 1) {
          enemy.debuffs = enemy.debuffs || {};
          enemy.debuffs.arcaneCircleExposureUntil = now + 1200;
          enemy.debuffs.arcaneCircleExposureMult = turret.exposureMult;
        }
        this.showDamageNumber?.(enemy.x, enemy.y - Math.max(20, (enemy.bossSize || enemy.radius || 18) + 14), damageResult.amount, {
          color: '#96ddff',
          isCrit: damageResult.isCrit,
          whisper: true
        });
        this.createHitEffect?.(enemy.x, enemy.y, 0xc9f4ff);
      }
    },

    triggerArcaneCircleExpiration(state, now) {
      if (!state) return;
      this.destroyArcaneTurret(state);
    },

    updateArcaneCircleOffclassEffects(time, delta) {
      const player = this.player;
      const now = this.time?.now ?? time ?? 0;
      if (!player) return;

      player.arcaneCircleState = null;
      player.setArcaneCircleBuffActive?.(false);

      if (!player.arcaneCircleEnabled) {
        const turrets = Array.isArray(this._offArcaneTurrets) ? this._offArcaneTurrets : [];
        turrets.forEach((turret) => this.destroyArcaneTurret(turret));
        this._offArcaneTurrets = [];
        return;
      }

      const level = Math.max(0, player?.arcaneCircleLevel || 0);
      const flowLevel = Math.max(0, Math.min(3, player.arcaneFlowcastingLevel || 0));
      const maxTurrets = 1 + (flowLevel >= 2 ? 1 : 0) + (flowLevel >= 3 ? 1 : 0);
      const cooldownMs = Math.max(6500, 10000 - level * 700 - flowLevel * 900);

      this._offArcaneTurrets = (this._offArcaneTurrets || []).filter((turret) => turret && !turret._consumed);
      for (let i = this._offArcaneTurrets.length - 1; i >= 0; i--) {
        const turret = this._offArcaneTurrets[i];
        if (!turret) continue;
        if (now >= (turret.expiresAt || 0)) {
          this.triggerArcaneCircleExpiration(turret, now);
          this._offArcaneTurrets.splice(i, 1);
        }
      }

      if (!player._arcaneTurretLastPos) {
        player._arcaneTurretLastPos = { x: player.x, y: player.y };
      }
      if (!Number.isFinite(player._arcaneTurretNextAt)) player._arcaneTurretNextAt = 0;

      if (now >= player._arcaneTurretNextAt) {
        const turret = this.spawnArcaneTurret(player.x, player.y, now);
        if (turret) {
          this._offArcaneTurrets.push(turret);
          while (this._offArcaneTurrets.length > maxTurrets) {
            const oldest = this._offArcaneTurrets.shift();
            if (oldest) this.triggerArcaneCircleExpiration(oldest, now);
          }
          player._arcaneTurretLastPos = { x: player.x, y: player.y };
          player._arcaneTurretNextAt = now + cooldownMs;
        }
      }

      const targets = this.getOffclassCombatTargets();
      for (let i = 0; i < this._offArcaneTurrets.length; i++) {
        const turret = this._offArcaneTurrets[i];
        if (!turret || turret._consumed) continue;

        const bob = Math.sin((now * 0.0055) + turret.bobSeed);
        turret.crystal?.setPosition?.(turret.x, turret.y - 10 + bob * 3.5);
        turret.core?.setPosition?.(turret.x, turret.y - 10 + bob * 3.5);
        turret.ring?.setAlpha?.(0.16 + Math.sin((now * 0.007) + turret.bobSeed) * 0.06);
        turret.innerRing?.setScale?.(1 + Math.sin((now * 0.0065) + turret.bobSeed) * 0.08);
        turret.aura?.setAlpha?.(0.08 + Math.sin((now * 0.0048) + turret.bobSeed) * 0.03);

        if (now < (turret.nextShotAt || 0)) continue;

        let target = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (let t = 0; t < targets.length; t++) {
          const enemy = targets[t];
          if (!enemy || !enemy.isAlive || enemy.isInvincible) continue;
          const dx = enemy.x - turret.x;
          const dy = enemy.y - turret.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > (turret.range * turret.range)) continue;
          const frostStacks = Math.max(0, enemy.debuffs?.mageFrost?.stacks || 0);
          const score = distSq - frostStacks * 2400;
          if (score < bestScore) {
            bestScore = score;
            target = enemy;
          }
        }

        if (!target) {
          turret.nextShotAt = now + 120;
          continue;
        }

        turret.nextShotAt = now + turret.fireIntervalMs;
        this.beginArcaneTurretPulse(turret, target, now);
      }
    },

    applyRangerTrapMark(target, now) {
      const markLevel = Math.max(0, this.player?.rangerHuntmarkLevel || 0);
      if (!target || markLevel <= 0) return;

      target.debuffs = target.debuffs || {};
      target.debuffs.huntMarkEnd = now + 3500 + markLevel * 400;
      target.debuffs.huntMarkMult = [1, 1.1, 1.16, 1.22][markLevel] || 1.1;
    },

    spawnRangerTrap(time) {
      const player = this.player;
      if (!player) return;

      const hasBeacon = !!player.rangerBeaconEnabled || (player.rangerSnareTrapLevel || 0) > 0;
      if (!hasBeacon) return;

      const target = this.getNearestEnemy(Math.max(180, player.archerArrowRange || 300));
      const angle = target ? Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y) : 0;
      const placeDist = 70;
      const x = player.x + Math.cos(angle) * placeDist;
      const y = player.y + Math.sin(angle) * placeDist;

      const base = this.add.circle(x, y + 12, 18, 0xa6ff7b, 0.16);
      base.setDepth(52);
      base.setStrokeStyle(2, 0xc9ff9a, 0.85);
      const body = this.add.rectangle(x, y - 2, 16, 28, 0x85d95f, 0.86);
      body.setDepth(53);
      const head = this.add.circle(x, y - 22, 8, 0xe8ffd6, 0.9);
      head.setDepth(54);
      const lure = this.add.circle(x, y - 2, 28, 0xc3ff85, 0.06);
      lure.setDepth(51);
      lure.setStrokeStyle(2, 0xdfffaa, 0.26);
      const tauntRing = this.add.circle(x, y, 1, 0xb7ff84, 0.025);
      tauntRing.setDepth(50);
      tauntRing.setStrokeStyle(2, 0xdfffaa, 0.28);
      tauntRing.setVisible(this.isRangeIndicatorEnabled());
      const shotRing = this.add.circle(x, y, 1, 0xf3ffe1, 0.012);
      shotRing.setDepth(49);
      shotRing.setStrokeStyle(1, 0xf3ffe1, 0.24);
      shotRing.setVisible(this.isRangeIndicatorEnabled());
      const hpBarBg = this.add.rectangle(x, y - 34, 30, 3, 0x091109, 0.68);
      hpBarBg.setOrigin(0.5, 0.5);
      hpBarBg.setDepth(55);
      hpBarBg.setStrokeStyle(1, 0xe8ffd6, 0.16);
      const hpBarFill = this.add.rectangle(x - 14, y - 34, 28, 1.5, 0xb7ff84, 0.96);
      hpBarFill.setOrigin(0, 0.5);
      hpBarFill.setDepth(56);

      const tauntRadius = 172 + (player.rangerSnareTrapLevel || 0) * 22 + (player.rangerTrapcraftLevel || 0) * 18;
      const shotRange = Math.max(
        tauntRadius + 28,
        228 + (player.rangerSnareTrapLevel || 0) * 26 + (player.rangerTrapcraftLevel || 0) * 22 + (player.rangerSpikeTrapLevel || 0) * 12
      );

      const trap = {
        type: 'decoy',
        active: true,
        isAlive: true,
        isDecoy: true,
        x,
        y,
        radius: 20,
        hitRadius: 22,
        maxHp: Math.round((player.maxHp || 100) * 0.45),
        currentHp: Math.round((player.maxHp || 100) * 0.45),
        damageTakenMult: 1,
        base,
        body,
        head,
        lure,
        tauntRing,
        shotRing,
        hpBarBg,
        hpBarFill,
        tauntRadius,
        effectRadius: 96 + (player.rangerBlastTrapLevel || 0) * 22,
        shotRange,
        expiresAt: (this.time?.now ?? time ?? 0) + 15000,
        nextShotAt: (this.time?.now ?? time ?? 0) + 1200,
        bobSeed: Math.random() * Math.PI * 2,
        _consumed: false,
        getHitboxPosition() {
          return { x: this.x, y: this.y, radius: this.hitRadius || this.radius || 20 };
        }
      };
      const updateTrapHpBar = () => {
        const pct = Phaser.Math.Clamp((trap.currentHp || 0) / Math.max(1, trap.maxHp || 1), 0, 1);
        const width = 28;
        trap.hpBarBg?.setPosition?.(trap.x, trap.y - 34);
        trap.hpBarFill?.setPosition?.(trap.x - 14, trap.y - 34);
        trap.hpBarFill?.setSize?.(Math.max(1.2, width * pct), 1.5);
        trap.hpBarFill?.setFillStyle?.(pct >= 0.55 ? 0xb7ff84 : (pct >= 0.25 ? 0xffd36e : 0xff8a6e), 0.96);
      };
      updateTrapHpBar();
      trap.takeDamage = (damage) => {
        if (trap._consumed || trap.isAlive === false) return true;
        const incoming = Math.max(1, Math.round(Number(damage) || 0));
        trap.currentHp = Math.max(0, (trap.currentHp || 0) - incoming);

        const alphaPct = Phaser.Math.Clamp((trap.currentHp || 0) / Math.max(1, trap.maxHp || 1), 0.25, 1);
        trap.body?.setAlpha?.(0.45 + alphaPct * 0.41);
        trap.head?.setAlpha?.(0.55 + alphaPct * 0.35);
        trap.base?.setAlpha?.(0.08 + alphaPct * 0.18);
        updateTrapHpBar();

        const hitFlash = this.add.circle(trap.x, trap.y - 12, 10, 0xf6ffe8, 0.18);
        hitFlash.setDepth(57);
        this.tweens.add({
          targets: hitFlash,
          alpha: 0,
          scaleX: 1.6,
          scaleY: 1.6,
          duration: 140,
          onComplete: () => hitFlash.destroy()
        });

        if (trap.currentHp <= 0) {
          trap.isAlive = false;
          this.triggerRangerTrap(trap, null, this.time?.now ?? time ?? 0);
          return true;
        }
        return false;
      };
      this._rangerTraps = this._rangerTraps || [];
      this._rangerTraps.push(trap);
    },

    fireRangerTrapArrow(trap, target, now) {
      const player = this.player;
      if (!trap || !target || !player || !target.isAlive || target.isInvincible) return false;

      const snareLevel = Math.max(0, Math.min(3, player.rangerSnareTrapLevel || 0));
      const spikeLevel = Math.max(0, Math.min(3, player.rangerSpikeTrapLevel || 0));
      const arrowScale = ([0.18, 0.24, 0.32, 0.42][snareLevel] || 0.18) + ([0, 0.05, 0.08, 0.12][spikeLevel] || 0);
      const aimAngle = Phaser.Math.Angle.Between(trap.x, trap.y - 8, target.x, target.y);
      const speed = 520;
      const rangeLifeMs = Math.max(260, Math.round((Math.max(120, trap.shotRange || trap.tauntRadius || 180) / speed) * 1000));
      const arrow = this.createManagedPlayerBullet(
        trap.x + Math.cos(aimAngle) * 18,
        trap.y - 12 + Math.sin(aimAngle) * 18,
        0x9dff72,
        {
          radius: 6,
          speed,
          damage: Math.max(1, Math.round((player.bulletDamage || 1) * arrowScale)),
          angleOffset: aimAngle,
          isAbsoluteAngle: true,
          type: 'arrow',
          hasGlow: true,
          glowRadius: 15,
          glowColor: 0xdcffb2,
          strokeColor: 0xf6ffe8,
          arrowLenMult: 1.45,
          arrowThickMult: 0.88,
          arrowHighlightColor: 0xf6ffe8,
          arrowFeatherColor: 0x88dd63,
          trailColor: 0xa8ff7f,
          trailIntervalMs: 44,
          trailLifeMs: 180,
          trailAlpha: 0.72,
          trailMode: 'streak',
          trailScaleX: 3.8,
          trailScaleY: 0.2,
          noCrit: true,
          maxLifeMs: rangeLifeMs,
          tags: ['off_ranger_decoy_arrow']
        }
      );
      if (!arrow) return false;

      arrow.hitEffectColor = 0xdfffaa;
      arrow.visualCoreColor = 0x9dff72;
      arrow.visualAccentColor = 0xf6ffe8;

      this.applyRangerTrapMark(target, now);
      this.showDamageNumber?.(trap.x, trap.y - 34, '射', { color: '#dcffb2', fontSize: 14, whisper: true });
      return true;
    },

    triggerRangerTrap(trap, triggerTarget, now) {
      const player = this.player;
      if (!trap || !player) return;

      const targets = this.getOffclassCombatTargets();
      const snareMs = [0, 260, 380, 520][Math.max(0, Math.min(3, player.rangerSnareTrapLevel || 0))] || 0;
      const blastDamageBase = [0.55, 0.78, 1.02, 1.35][Math.max(0, Math.min(3, player.rangerBlastTrapLevel || 0))] || 0.55;
      const spikeLevel = Math.max(0, Math.min(3, player.rangerSpikeTrapLevel || 0));
      const spikeDamageBase = [0.08, 0.18, 0.26, 0.36][spikeLevel] || 0.08;
      const spikeSlowMs = [0, 180, 260, 360][spikeLevel] || 0;
      const spikeDotDuration = [0, 2200, 3000, 3800][spikeLevel] || 0;
      const spikeDotScale = [0, 0.08, 0.12, 0.18][spikeLevel] || 0;

      const burst = this.add.circle(trap.x, trap.y, Math.max(18, trap.radius), 0xffcc7a, 0.2);
      burst.setDepth(53);
      burst.setStrokeStyle(2, 0xffa25a, 0.9);
      this.tweens.add({
        targets: burst,
        alpha: 0,
        scaleX: 2.6,
        scaleY: 2.6,
        duration: 240,
        onComplete: () => burst.destroy()
      });

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        if (!target || !target.isAlive || target.isInvincible) continue;
        const dx = target.x - trap.x;
        const dy = target.y - trap.y;
        if ((dx * dx + dy * dy) > (trap.effectRadius * trap.effectRadius)) continue;

        this.applyRangerTrapMark(target, now);

        if (snareMs > 0 && typeof target.applyFreeze === 'function') {
          target.applyFreeze(snareMs, { source: 'off_ranger_decoy', player, radius: trap.effectRadius });
        }
        if (spikeSlowMs > 0 && typeof target.applyFreeze === 'function') {
          target.applyFreeze(spikeSlowMs, { source: 'ranger_decoy_field', player, radius: trap.effectRadius });
        }

        const damageScale = blastDamageBase + spikeDamageBase;
        if (damageScale > 0) {
          const damageResult = calculateResolvedDamage({
            attacker: player,
            target,
            baseDamage: Math.max(1, Math.round((player.bulletDamage || 1) * damageScale)),
            now,
            canCrit: true
          });
          target.takeDamage?.(damageResult.amount, { attacker: player, source: 'ranger_decoy_explosion' });
          player.onDealDamage?.(damageResult.amount);
          this.applyWarriorOffclassHitEffects?.(target, now);
          this.showDamageNumber?.(target.x, target.y - 28, damageResult.amount, { color: '#ffe082', isCrit: damageResult.isCrit });
        }

        if (spikeDotDuration > 0 && spikeDotScale > 0) {
          target.debuffs = target.debuffs || {};
          target.debuffs.rangerSpikeDotUntil = now + spikeDotDuration;
          target.debuffs.rangerSpikeDotTickAt = now + 700;
          target.debuffs.rangerSpikeDotInterval = 700;
          target.debuffs.rangerSpikeDotDamage = Math.max(1, Math.round((player.bulletDamage || 1) * spikeDotScale));
        }
      }

      [trap.base, trap.body, trap.head, trap.lure, trap.tauntRing, trap.shotRing, trap.hpBarBg, trap.hpBarFill].forEach((node) => {
        try { node?.destroy?.(); } catch (_) { /* ignore */ }
      });
      trap.active = false;
      trap.isAlive = false;
      trap._consumed = true;
    },

    updateRangerTrapSystem(time, delta) {
      const player = this.player;
      if (!player) return;

      const hasTrapKit = !!player.rangerBeaconEnabled || (player.rangerSnareTrapLevel || 0) > 0;
      if (!hasTrapKit) {
        if (Array.isArray(this._rangerTraps)) {
          this._rangerTraps.forEach((trap) => {
            [trap?.base, trap?.body, trap?.head, trap?.lure, trap?.tauntRing, trap?.shotRing, trap?.hpBarBg, trap?.hpBarFill].forEach((node) => {
              try { node?.destroy?.(); } catch (_) { /* ignore */ }
            });
          });
        }
        this._rangerTraps = [];
        return;
      }

      const now = this.time?.now ?? time ?? 0;
      const cooldownMs = Math.max(6500, 10000 - (player.rangerTrapcraftLevel || 0) * 1200);
      const maxTrapCount = 1 + ((player.rangerTrapcraftLevel || 0) >= 2 ? 1 : 0);
      this._rangerTraps = (this._rangerTraps || []).filter((trap) => trap && !trap._consumed);

      for (let i = this._rangerTraps.length - 1; i >= 0; i--) {
        const trap = this._rangerTraps[i];
        if (!trap) continue;
        if ((trap.expiresAt || 0) <= now) {
          this.triggerRangerTrap(trap, null, now);
          this._rangerTraps.splice(i, 1);
        }
      }

      if (!Number.isFinite(this._rangerTrapNextAt)) this._rangerTrapNextAt = 0;
      if (now >= this._rangerTrapNextAt && this._rangerTraps.length < maxTrapCount) {
        this.spawnRangerTrap(now);
        this._rangerTrapNextAt = now + cooldownMs;
      }

      const targets = this.getOffclassCombatTargets();
      for (let i = 0; i < this._rangerTraps.length; i++) {
        const trap = this._rangerTraps[i];
        if (!trap || trap._consumed) continue;

        const bob = Math.sin((now * 0.006) + (trap.bobSeed || i));
        trap.head?.setPosition?.(trap.x, trap.y - 22 + bob * 2.5);
        trap.body?.setPosition?.(trap.x, trap.y - 2 + bob * 1.5);
        trap.base?.setAlpha?.(0.18 + Math.sin((time || 0) * 0.01 + i) * 0.06);
        trap.lure?.setScale?.(1 + Math.sin((time || 0) * 0.008 + i) * 0.08);
        trap.lure?.setAlpha?.(0.08 + Math.sin((time || 0) * 0.008 + i) * 0.04);
        trap.tauntRing?.setPosition?.(trap.x, trap.y);
        trap.tauntRing?.setRadius?.(trap.tauntRadius);
        trap.tauntRing?.setVisible?.(this.isRangeIndicatorEnabled());
        trap.tauntRing?.setAlpha?.(0.1 + Math.sin((now * 0.004) + i) * 0.03);
        trap.shotRing?.setPosition?.(trap.x, trap.y);
        trap.shotRing?.setRadius?.(trap.shotRange);
        trap.shotRing?.setVisible?.(this.isRangeIndicatorEnabled());
        trap.shotRing?.setAlpha?.(0.08 + Math.sin((now * 0.0032) + i) * 0.025);
        trap.hpBarBg?.setPosition?.(trap.x, trap.y - 34 + bob * 1.4);
        trap.hpBarFill?.setPosition?.(trap.x - 14, trap.y - 34 + bob * 1.4);

        let tauntedTarget = null;
        let bestTauntedDistSq = Number.POSITIVE_INFINITY;
        let shotTarget = null;
        let bestShotDistSq = Number.POSITIVE_INFINITY;
        for (let t = 0; t < targets.length; t++) {
          const target = targets[t];
          if (!target || !target.isAlive || target.isInvincible) continue;
          const dx = target.x - trap.x;
          const dy = target.y - trap.y;
          const distSq = dx * dx + dy * dy;

          if (distSq <= (trap.tauntRadius * trap.tauntRadius)) {
            this.applyRangerTrapMark(target, now);
            if (distSq < bestTauntedDistSq) {
              bestTauntedDistSq = distSq;
              tauntedTarget = target;
            }

            const dist = Math.sqrt(distSq) || 0.0001;
            const desiredDist = trap.radius + (target.bossSize || target.radius || 18) + 10;
            if (dist > desiredDist) {
              const force = target.bossSize ? 32 : 72;
              const step = Math.min(dist - desiredDist, force * (delta / 1000));
              target.x -= (dx / dist) * step;
              target.y -= (dy / dist) * step;
            }

            const slowMs = [0, 110, 150, 200][Math.max(0, Math.min(3, player.rangerSpikeTrapLevel || 0))] || 0;
            if (slowMs > 0 && typeof target.applyFreeze === 'function') {
              target.applyFreeze(slowMs, { source: 'ranger_decoy_pull', player, radius: trap.tauntRadius });
            }
          }

          if (distSq <= (trap.shotRange * trap.shotRange) && distSq < bestShotDistSq) {
            bestShotDistSq = distSq;
            shotTarget = target;
          }
        }

        const resolvedShotTarget = tauntedTarget || shotTarget;
        if (resolvedShotTarget && now >= (trap.nextShotAt || 0)) {
          this.fireRangerTrapArrow(trap, resolvedShotTarget, now);
          trap.nextShotAt = now + 1100;

          const pulse = this.add.circle(trap.x, trap.y - 18, 10, 0xdfffaa, 0.16);
          pulse.setDepth(54);
          pulse.setStrokeStyle(2, 0xf2ffd6, 0.75);
          this.tweens.add({
            targets: pulse,
            alpha: 0,
            scaleX: 1.55,
            scaleY: 1.55,
            duration: 180,
            onComplete: () => pulse.destroy()
          });
        }
      }

      this._rangerTraps = this._rangerTraps.filter((trap) => trap && !trap._consumed);
    },

    updatePaladinPulse(time) {
      if (!this.paladinEnabled || !this.player || this.player.isAlive === false) return;
      if (time - this.paladinLastTime < this.paladinCooldown) return;

      const radius = this.paladinPulseRadius;
      const damage = this.paladinPulseDamage;
      if (!Number.isFinite(radius) || radius <= 0) return;
      if (!Number.isFinite(damage) || damage <= 0) return;

      const boss = this.bossManager.getCurrentBoss();
      const bullets = this.getBossBullets();
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
            // 圣骑脉冲属于非弹道直接伤害，也统一接入标准伤害链
            const damageResult = calculateResolvedDamage({ attacker: this.player, target: boss, baseDamage: damage, now: this.time?.now ?? 0, canCrit: false });
            boss.takeDamage(damageResult.amount);
            this.player?.onDealDamage?.(damageResult.amount);
            this.applyWarriorOffclassHitEffects?.(boss, this.time?.now ?? 0);
            this.showDamageNumber(boss.x, boss.y - 50, damageResult.amount);
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
      if (this.player) {
        this.player.canFire = true;
        this.player.baseFireRate = 2000;
        this.player.applyStatMultipliers?.(this.player.equipmentMods || {});
      }
    },

    refreshWarlockPoisonNovaState(options = {}) {
      if (!this.player) return;

      const clearExistingZones = options.clearExistingZones !== false;
      const respawnImmediately = options.respawnImmediately !== false;

      this.player.applyStatMultipliers?.(this.player.equipmentMods || {});

      if (clearExistingZones) {
        const poisonZones = (this.getManagedBullets?.('player') || [])
          .filter((bullet) => bullet && bullet.active && !bullet.markedForRemoval && bullet.isPoisonZone);

        for (let i = 0; i < poisonZones.length; i++) {
          this.destroyManagedBullet?.(poisonZones[i], 'player', 'cleanup');
        }

        if (Array.isArray(this.player.bullets)) {
          this.player.bullets = this.player.bullets.filter(
            (bullet) => bullet && bullet.active && !bullet.markedForRemoval && !bullet.isPoisonZone
          );
        }
      }

      this.player._warlockPoisonNovaLastAt = 0;
      this.player._warlockPoisonNovaForceRefresh = !!respawnImmediately;
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
      if (!this.player || this.player.isAlive === false) return;
      const now = this.time?.now ?? time;
      const boss = this.bossManager?.getCurrentBoss?.() || null;
      const minions = this.bossManager?.getMinions?.() || [];
      const targets = [boss, ...(Array.isArray(minions) ? minions : [])].filter(t => t && t.isAlive);
      if (targets.length === 0) return;

      const poisonZones = this.getManagedBullets?.('player')
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
        const smokeActive = boss.debuffs.smokeEnd && time < boss.debuffs.smokeEnd;
        if (!smokeActive) {
          boss.damageDealtMult = 1;
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
            const netherlordLevel = Math.max(0, Math.min(3, Math.round(this.player?.warlockNetherlord || 0)));
            const poisonDamage = Math.max(1, Math.round((baseAt1 + (pz.stacks - 1) * incPerStack) * ([1, 1.10, 1.22, 1.38][netherlordLevel] || 1)));

            // 毒圈跳伤统一吃玩家增伤、暴击和目标当前承伤状态
            const damageResult = calculateResolvedDamage({ attacker: this.player, target, baseDamage: poisonDamage, now });

            target.takeDamage(damageResult.amount);
            this.player?.onDealDamage?.(damageResult.amount);
            this.applyWarriorOffclassHitEffects?.(target, now);
            this.showDamageNumber(target.x, target.y - 30, damageResult.amount, { color: '#66ff99', isCrit: damageResult.isCrit });
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

        // Boss 中毒 DOT 统一走同一结算链，保证与毒圈体系一致
        const damageResult = calculateResolvedDamage({ attacker: this.player, target: boss, baseDamage: poisonDamage, now: time });

        boss.takeDamage(damageResult.amount);
        this.player?.onDealDamage?.(damageResult.amount);
        this.applyWarriorOffclassHitEffects?.(boss, time);
        this.showDamageNumber(boss.x, boss.y - 30, damageResult.amount, { color: '#66ff99', isCrit: damageResult.isCrit });
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
