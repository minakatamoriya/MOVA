import Phaser from 'phaser';
import { buildArenaMetrics } from '../config/arenaLayout';
import { getCoreDefenseClassOption } from '../config/classOptions';
import { CORE_DEFENSE_ENEMY_DEFS, getWaveProfileByMinute, rollEnemyType } from '../config/waveTimeline';

const ROUND_DURATION_MS = 20 * 60 * 1000;
const PRESSURE_TICK_MS = 500;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export default class CoreDefensePrototypeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoreDefensePrototypeScene' });
  }

  init(data = {}) {
    this.selectedClassId = data.selectedMainCore || this.registry.get('preferredMainCore') || 'warrior';
  }

  create() {
    this.cameras.main.setBackgroundColor('#07131e');
    this.metrics = buildArenaMetrics(this.scale.width, this.scale.height);
    this.classOption = getCoreDefenseClassOption(this.selectedClassId);
    this.roundStartedAt = this.time.now;
    this.roundEndsAt = this.roundStartedAt + ROUND_DURATION_MS;
    this.lastPressureTickAt = this.roundStartedAt;
    this.lastAttackAt = 0;
    this.score = 0;
    this.gameResolved = false;
    this.pointerTarget = null;
    this.enemies = [];

    this.createArena();
    this.createCore();
    this.createPlayer();
    this.createHud();
    this.createInput();

    this.spawnTimer = this.time.addEvent({
      delay: getWaveProfileByMinute(0).spawnIntervalMs,
      loop: true,
      callback: () => this.spawnEnemy(),
    });
  }

  createArena() {
    const { width, zones, laneCenters, laneWidth } = this.metrics;
    const zoneDefs = [
      ['入口带', zones.entrance, 0x163247],
      ['前线交战带', zones.frontline, 0x163f36],
      ['中段缓冲带', zones.mid, 0x21354d],
      ['核心守卫带', zones.core, 0x35234d],
    ];

    zoneDefs.forEach(([label, zone, color]) => {
      this.add.rectangle(width * 0.5, zone.y + zone.height * 0.5, width, zone.height, color, 0.66).setOrigin(0.5);
      this.add.text(22, zone.y + 14, label, {
        fontSize: '18px',
        color: '#d7e9ff',
        fontStyle: 'bold',
      }).setOrigin(0, 0);
    });

    [laneCenters.left, laneCenters.mid, laneCenters.right].forEach((centerX) => {
      this.add.rectangle(centerX, this.scale.height * 0.5, laneWidth, this.scale.height, 0xffffff, 0.03).setOrigin(0.5);
    });

    [zones.frontline.y, zones.mid.y, zones.core.y].forEach((lineY) => {
      this.add.rectangle(width * 0.5, lineY, width, 4, 0xffffff, 0.08).setOrigin(0.5);
    });
  }

  createCore() {
    const { core } = this.metrics;
    this.coreMaxHp = 1000;
    this.coreHp = this.coreMaxHp;
    this.core = this.add.circle(core.x, core.y, core.radius, 0x7c5cff, 0.95).setStrokeStyle(4, 0xe7dcff, 0.95);
    this.coreAura = this.add.circle(core.x, core.y, core.pressureRadius, 0x7c5cff, 0.08).setStrokeStyle(2, 0xb89cff, 0.34);
  }

  createPlayer() {
    const start = this.metrics.playerStart;
    this.player = this.add.circle(start.x, start.y, 20, this.classOption.color, 0.98).setStrokeStyle(3, 0xffffff, 0.9);
    this.playerMoveSpeed = this.classOption.moveSpeed;
  }

  createHud() {
    this.classText = this.add.text(20, 20, `职业：${this.classOption.name}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setScrollFactor(0);

    this.timerText = this.add.text(this.scale.width - 20, 20, '20:00', {
      fontSize: '28px',
      color: '#ffe18a',
      fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0);

    this.coreHpText = this.add.text(20, 56, `核心：${this.coreHp}/${this.coreMaxHp}`, {
      fontSize: '22px',
      color: '#ffd6ef',
    }).setScrollFactor(0);

    this.pressureText = this.add.text(20, 88, '当前施压：0', {
      fontSize: '20px',
      color: '#9ce6ff',
    }).setScrollFactor(0);

    this.scoreText = this.add.text(this.scale.width - 20, 56, '清除：0', {
      fontSize: '22px',
      color: '#cce7ff',
    }).setOrigin(1, 0).setScrollFactor(0);
  }

  createInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' });

    this.input.on('pointerdown', (pointer) => {
      this.pointerTarget = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      this.pointerTarget = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointerup', () => {
      this.pointerTarget = null;
    });
  }

  spawnEnemy() {
    if (this.gameResolved) return;
    const elapsedMinute = Math.floor((this.time.now - this.roundStartedAt) / 60000);
    const profile = getWaveProfileByMinute(elapsedMinute);
    if (this.spawnTimer) {
      this.spawnTimer.delay = profile.spawnIntervalMs;
    }

    const laneKeys = ['left', 'mid', 'right'];
    const laneKey = laneKeys[Phaser.Math.Between(0, laneKeys.length - 1)];
    const enemyType = rollEnemyType(Math.random(), elapsedMinute);
    const def = CORE_DEFENSE_ENEMY_DEFS[enemyType];
    const drift = Phaser.Math.Between(-Math.round(this.metrics.laneWidth * 0.28), Math.round(this.metrics.laneWidth * 0.28));
    const x = clamp(this.metrics.laneCenters[laneKey] + drift, def.radius + 6, this.scale.width - def.radius - 6);
    const y = this.metrics.spawnY;
    const body = this.add.circle(x, y, def.radius, def.color, 0.96).setStrokeStyle(2, 0x000000, 0.35);

    this.enemies.push({
      id: `${enemyType}_${this.time.now}_${Math.random().toString(16).slice(2, 6)}`,
      type: enemyType,
      laneKey,
      x,
      y,
      radius: def.radius,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      pressure: def.pressure,
      remotePressure: def.remotePressure || 0,
      score: def.score || 1,
      anchorY: enemyType === 'anchor' ? this.scale.height * def.anchorYRatio : null,
      stopped: false,
      display: body,
    });
  }

  update(time, delta) {
    if (this.gameResolved) return;

    this.updateTimer(time);
    this.updatePlayer(delta);
    this.updateEnemies(delta);
    this.updatePressure(time);
    this.updateAutoAttack(time);
    this.refreshHud();
  }

  updateTimer(time) {
    const remaining = Math.max(0, this.roundEndsAt - time);
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.timerText.setText(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    if (remaining <= 0) {
      this.resolveRound(true, '守住了 20 分钟，原型目标达成');
    }
  }

  updatePlayer(delta) {
    const dt = Math.max(0, Number(delta || 0)) / 1000;
    let dx = 0;
    let dy = 0;

    if (this.pointerTarget) {
      const tx = this.pointerTarget.x - this.player.x;
      const ty = this.pointerTarget.y - this.player.y;
      const dist = Math.hypot(tx, ty);
      if (dist > 6) {
        dx = tx / dist;
        dy = ty / dist;
      }
    } else {
      dx = (this.cursors.right.isDown || this.wasd.right.isDown ? 1 : 0) - (this.cursors.left.isDown || this.wasd.left.isDown ? 1 : 0);
      dy = (this.cursors.down.isDown || this.wasd.down.isDown ? 1 : 0) - (this.cursors.up.isDown || this.wasd.up.isDown ? 1 : 0);
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
      }
    }

    this.player.x = clamp(this.player.x + dx * this.playerMoveSpeed * dt, 24, this.scale.width - 24);
    this.player.y = clamp(this.player.y + dy * this.playerMoveSpeed * dt, this.metrics.zones.frontline.y + 12, this.scale.height - 24);
  }

  updateEnemies(delta) {
    const dt = Math.max(0, Number(delta || 0)) / 1000;
    const nextEnemies = [];

    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i];
      if (!enemy || enemy.hp <= 0) {
        enemy?.display?.destroy?.();
        continue;
      }

      if (enemy.type === 'anchor' && !enemy.stopped && enemy.anchorY != null && enemy.y >= enemy.anchorY) {
        enemy.stopped = true;
      }

      if (!enemy.stopped) {
        const targetX = this.metrics.core.x + this.getLaneBias(enemy);
        const targetY = this.metrics.core.y;
        const vx = targetX - enemy.x;
        const vy = targetY - enemy.y;
        const dist = Math.max(0.0001, Math.hypot(vx, vy));
        enemy.x += (vx / dist) * enemy.speed * dt;
        enemy.y += (vy / dist) * enemy.speed * dt;
      }

      enemy.display.x = enemy.x;
      enemy.display.y = enemy.y;
      nextEnemies.push(enemy);
    }

    this.enemies = nextEnemies;
  }

  getLaneBias(enemy) {
    if (!enemy) return 0;
    if (enemy.type === 'infiltrator') {
      return enemy.laneKey === 'left' ? -52 : (enemy.laneKey === 'right' ? 52 : 0);
    }
    return enemy.laneKey === 'left' ? -24 : (enemy.laneKey === 'right' ? 24 : 0);
  }

  updatePressure(time) {
    if ((time - this.lastPressureTickAt) < PRESSURE_TICK_MS) return;
    this.lastPressureTickAt = time;

    const { core } = this.metrics;
    let directPressure = 0;
    let remotePressure = 0;
    const pressureRadiusSq = core.pressureRadius * core.pressureRadius;

    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i];
      if (!enemy || enemy.hp <= 0) continue;
      if (distanceSq(enemy.x, enemy.y, core.x, core.y) <= pressureRadiusSq) {
        directPressure += Number(enemy.pressure || 0);
      } else if (enemy.type === 'anchor' && enemy.stopped) {
        remotePressure += Number(enemy.remotePressure || 0);
      }
    }

    const totalPressure = directPressure + remotePressure;
    this.currentPressure = totalPressure;
    const softenedPressure = totalPressure <= 10 ? totalPressure : (10 + Math.sqrt(totalPressure - 10) * 3.2);
    const damage = Math.round(softenedPressure * 3.5);

    if (damage > 0) {
      this.coreHp = Math.max(0, this.coreHp - damage);
      this.tweens.add({ targets: this.core, scaleX: 1.08, scaleY: 1.08, duration: 80, yoyo: true, ease: 'Sine.easeOut' });
    }

    if (this.coreHp <= 0) {
      this.resolveRound(false, '核心被怪潮压垮');
    }
  }

  updateAutoAttack(time) {
    if ((time - this.lastAttackAt) < this.classOption.fireIntervalMs) return;

    let best = null;
    let bestDistSq = Infinity;
    const maxRangeSq = this.classOption.attackRange * this.classOption.attackRange;

    for (let i = 0; i < this.enemies.length; i += 1) {
      const enemy = this.enemies[i];
      if (!enemy || enemy.hp <= 0) continue;
      const d2 = distanceSq(this.player.x, this.player.y, enemy.x, enemy.y);
      if (d2 > maxRangeSq) continue;
      if (d2 < bestDistSq) {
        best = enemy;
        bestDistSq = d2;
      }
    }

    if (!best) return;
    this.lastAttackAt = time;
    best.hp -= this.classOption.attackDamage;

    const line = this.add.line(0, 0, this.player.x, this.player.y, best.x, best.y, this.classOption.color, 0.9)
      .setOrigin(0, 0)
      .setLineWidth(3, 3);
    this.tweens.add({ targets: line, alpha: 0, duration: 100, onComplete: () => line.destroy() });

    if (best.hp <= 0) {
      this.score += Number(best.score || 1);
      const burst = this.add.circle(best.x, best.y, best.radius + 8, this.classOption.color, 0.4);
      this.tweens.add({ targets: burst, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 180, onComplete: () => burst.destroy() });
    }
  }

  refreshHud() {
    this.coreHpText.setText(`核心：${Math.max(0, Math.round(this.coreHp))}/${this.coreMaxHp}`);
    this.pressureText.setText(`当前施压：${(Number(this.currentPressure || 0)).toFixed(1)}`);
    this.scoreText.setText(`清除：${this.score}`);
  }

  resolveRound(victory, message) {
    if (this.gameResolved) return;
    this.gameResolved = true;
    this.spawnTimer?.remove?.();

    const title = victory ? '原型通关' : '原型失败';
    this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width * 0.82, 220, 0x000000, 0.72).setOrigin(0.5);
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 38, title, {
      fontSize: '46px',
      fontStyle: 'bold',
      color: victory ? '#ffe18a' : '#ff9aa2',
    }).setOrigin(0.5);
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 + 14, message, {
      fontSize: '24px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: this.scale.width * 0.72 },
    }).setOrigin(0.5);
    this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 + 72, '按 R 重新开始，按 ESC 返回菜单', {
      fontSize: '20px',
      color: '#c8d6e5',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-R', () => {
      this.scene.restart({ selectedMainCore: this.selectedClassId });
    });
    this.input.keyboard.once('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }
}
