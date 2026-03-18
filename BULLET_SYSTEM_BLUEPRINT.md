# Bullet System Blueprint

## Goal

Build a scene-scoped bullet system layer that sits above the current managers and below weapon or boss scripts.

This blueprint keeps the current runtime intact while defining clear integration points for future migration.

## Current Project Mapping

Existing modules already cover part of the needed behavior:

- `BulletCore`
  - Existing foundation: `src/managers/BulletManager.js`
  - Existing collision sink: `src/managers/CollisionManager.js`
  - Gap: unified descriptor format, spawn API, lifecycle hooks, metrics facade

- `PatternSystem`
  - Existing partial behavior: weapon files under `src/classes/attacks/weapons/`
  - Gap: reusable pattern emitters shared by player skills and bosses

- `MotionModifier`
  - Existing partial behavior: homing, bounce, speed ramp in `BulletManager` and `CollisionManager`
  - Gap: explicit motion metadata and reusable modifier composition

- `VfxSystem`
  - Existing partial behavior: trail pool in `BulletManager`, telegraphs in `Player`, hit flashes across weapon scripts
  - Gap: one place to request charge, cast, hit, burst, dissipate, and screen flash effects

- `AttackTimeline`
  - Existing partial behavior: `BossManager` and `BaseBoss.attackPatterns`
  - Gap: phase script scheduler, burst sequencing, and telegraph-to-fire orchestration

- `DebugOverlay`
  - Existing partial behavior: debug grid in `MapFogMixin`, range indicators in `GameScene`
  - Gap: bullet diagnostics, pool stats, hazard telegraphs, and per-system metrics overlay

## Target Layout

New files live under `src/systems/bullets/`.

- `BulletCore.js`
- `PatternSystem.js`
- `MotionModifier.js`
- `VfxSystem.js`
- `AttackTimeline.js`
- `DebugOverlay.js`
- `index.js`

## Responsibilities

### BulletCore

The compatibility layer over `BulletManager` and `CollisionManager`.

Owns:

- bullet descriptor normalization
- player and boss bullet spawn facade
- lifecycle hooks: spawn, expire, hit, destroy
- stats facade: active counts, pool counts, created and destroyed
- cleanup helpers for scene transitions and boss death

Does not own:

- pattern generation
- cosmetic effects orchestration
- boss phase logic

### PatternSystem

Reusable pattern emitters.

Owns:

- fan
- ring
- spiral
- aimed shot
- delayed burst
- returning shot
- laser
- ground telegraph

Design rule:

- pattern methods receive a single config object
- pattern methods return spawned bullet or hazard handles
- telegraph and fire timing stay data-driven

### MotionModifier

Reusable bullet behavior tags.

Owns:

- acceleration and deceleration curves
- sine drift
- homing metadata
- bounce metadata
- split metadata
- on-death spawn metadata

Design rule:

- modifiers should only annotate bullet metadata or provide pure update helpers
- collision and destruction remain centralized elsewhere

### VfxSystem

Scene-local combat presentation service.

Owns:

- charge indicators
- cast flashes
- trail presets
- hit sparks
- burst rings
- dissipate fades
- scene flash

Design rule:

- effect requests are semantic, not asset-specific
- effect methods should degrade gracefully if a texture is missing

### AttackTimeline

Boss encounter sequencing.

Owns:

- phase definitions
- ordered waves
- timed events
- telegraph windows
- timeline cancellation on death or scene shutdown

Design rule:

- boss scripts describe intent, not low-level timers
- each phase can be paused, resumed, or cancelled as a unit

### DebugOverlay

Live diagnostics for combat iteration.

Owns:

- collision circles
- targeting circles
- pool usage text
- bullet counts
- timeline state text
- optional hot spots and warnings

Design rule:

- overlay must be optional and cheap when hidden
- debug visuals should use the same centers and ranges as gameplay logic

## Suggested Integration Order

1. Route new boss skills through `PatternSystem` while still using the current `BulletManager` underneath.
2. Move new bullet behavior flags into `MotionModifier` instead of hardcoding them per weapon.
3. Centralize charge and impact visuals into `VfxSystem`.
4. Move boss attack sequencing from inline timers to `AttackTimeline`.
5. Enable `DebugOverlay` for tuning and performance checks.

## Scene Wiring Plan

Inside `GameScene.initGameSystems()` create the modules in this order:

1. `bulletCore`
2. `vfxSystem`
3. `patternSystem`
4. `attackTimeline`
5. `debugOverlay`

Recommended dependency graph:

- `PatternSystem -> BulletCore`
- `PatternSystem -> VfxSystem`
- `AttackTimeline -> PatternSystem`
- `DebugOverlay -> BulletCore`
- `DebugOverlay -> AttackTimeline`

## Migration Notes

- Keep `BulletManager` as the low-level bullet runtime for now.
- Keep `CollisionManager` as the authoritative hit resolver.
- Treat the new modules as a compatibility shell first, then gradually move weapon scripts onto them.
- Do not duplicate homing, bounce, or hit rules in two places during migration.

## First Practical Use Cases

- Boss fan volley with delayed ground warning
- Spiral phase that transitions into a ring burst on low HP
- Laser windup with shared telegraph and screen flash
- Debug overlay showing active player bullets, active boss bullets, trail particle pressure, and current boss phase