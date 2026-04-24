import Phaser from 'phaser';

export function showDamageNumber(scene, x, y, damage, colorOrOptions = '#ffffff', maybeOptions) {
  if (!scene) return;

  let options = {};
  if (typeof colorOrOptions === 'string') {
    options.color = colorOrOptions;
    if (maybeOptions && typeof maybeOptions === 'object') options = { ...options, ...maybeOptions };
  } else if (typeof colorOrOptions === 'object' && colorOrOptions) {
    options = { ...colorOrOptions };
  }

  const isCrit = !!options.isCrit;
  const color = isCrit ? '#ff3333' : (options.color || '#ffee00');
  const fontSize = options.fontSize || (isCrit ? 40 : 30);
  const text = isCrit ? `暴击 ${damage}` : `${damage}`;

  const damageText = scene.add.text(x, y, text, {
    fontSize: `${fontSize}px`,
    fontFamily: 'Arial',
    color,
    fontStyle: 'bold',
    resolution: 2,
    letterSpacing: 1,
  }).setOrigin(0.5);

  damageText.setDepth(999);

  const whisper = !!options.whisper;
  damageText.setScale(whisper ? 0.82 : (isCrit ? 0.92 : 0.88));

  scene.tweens.add({
    targets: damageText,
    scale: whisper ? 1.02 : (isCrit ? 1.5 : 1.16),
    duration: whisper ? 180 : (isCrit ? 140 : 120),
    ease: 'Back.Out',
  });

  scene.tweens.add({
    targets: damageText,
    y: y - (whisper ? 42 : (isCrit ? 78 : 60)),
    duration: whisper ? 820 : (isCrit ? 920 : 720),
    ease: isCrit ? 'Cubic.Out' : 'Power2',
    onComplete: () => {
      damageText.destroy();
    },
  });

  if (isCrit) {
    scene.tweens.add({
      targets: damageText,
      x: x + Phaser.Math.Between(-10, 10),
      yoyo: true,
      repeat: 2,
      duration: 60,
      ease: 'Sine.InOut',
    });
  }
}