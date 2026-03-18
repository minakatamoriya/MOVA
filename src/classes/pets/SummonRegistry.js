/**
 * SummonRegistry —— 全局召唤物统一注册表
 * ════════════════════════════════════════════
 * PetManager（熊/鹰/树精）与 UndeadSummonManager（骷髅卫士/法师/地狱火）
 * 各自保留内部 AI 逻辑，但都将存活单位注册到此表。
 *
 * 上层系统（CollisionManager、HUD、DebugOverlay）只需通过 SummonRegistry
 * 获取"全部友方召唤物"列表，无需分别查询两个管理器。
 */

export default class SummonRegistry {
  constructor() {
    /** @type {Map<string, Set<object>>} 管理器ID -> 注册的单位集合 */
    this._pools = new Map();
  }

  /**
   * 管理器在创建/销毁单位时调用
   * @param {string} managerId 'pet' | 'undead' | 自定义
   * @param {object} unit  必须有 active 属性
   */
  register(managerId, unit) {
    if (!unit) return;
    if (!this._pools.has(managerId)) this._pools.set(managerId, new Set());
    this._pools.get(managerId).add(unit);
  }

  unregister(managerId, unit) {
    this._pools.get(managerId)?.delete(unit);
  }

  /**
   * 获取指定管理器下的存活单位
   * @param {string} managerId
   * @returns {object[]}
   */
  getAlive(managerId) {
    const pool = this._pools.get(managerId);
    if (!pool) return [];
    const alive = [];
    for (const unit of pool) {
      if (unit?.active !== false) alive.push(unit);
    }
    return alive;
  }

  /**
   * 获取所有管理器下的全部存活召唤物（合并列表）
   * @returns {object[]}
   */
  getAllAlive() {
    const result = [];
    for (const pool of this._pools.values()) {
      for (const unit of pool) {
        if (unit?.active !== false) result.push(unit);
      }
    }
    return result;
  }

  /** 获取所有存活召唤物的数量 */
  get aliveCount() {
    let count = 0;
    for (const pool of this._pools.values()) {
      for (const unit of pool) {
        if (unit?.active !== false) count++;
      }
    }
    return count;
  }

  /**
   * 找离给定坐标最近的存活坦克型召唤物（用于仇恨重定向）
   * @param {number} x
   * @param {number} y
   * @returns {object|null}
   */
  getNearestTank(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const pool of this._pools.values()) {
      for (const unit of pool) {
        if (!unit?.active || !unit.isTank) continue;
        const dx = (unit.x || 0) - x;
        const dy = (unit.y || 0) - y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = unit;
        }
      }
    }
    return best;
  }

  /** 清理所有池（用于关卡重置） */
  clear() {
    for (const pool of this._pools.values()) pool.clear();
  }

  destroy() {
    this._pools.clear();
  }
}
