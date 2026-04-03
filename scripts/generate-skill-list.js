const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'SKILL_LIST.md');
const moduleCache = new Map();

function resolveModulePath(specifier, fromFile) {
  if (!specifier.startsWith('.')) return specifier;

  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.js`,
    path.join(basePath, 'index.js')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  throw new Error(`Cannot resolve module: ${specifier} from ${fromFile}`);
}

function loadSourceModule(filePath) {
  if (!filePath.startsWith(ROOT)) {
    return require(filePath);
  }

  if (moduleCache.has(filePath)) {
    return moduleCache.get(filePath).exports;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const transformed = babel.transformSync(source, {
    filename: filePath,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
    sourceType: 'module',
    babelrc: false,
    configFile: false
  });

  const module = { exports: {} };
  moduleCache.set(filePath, module);

  const localRequire = (specifier) => {
    const resolved = resolveModulePath(specifier, filePath);
    return resolved.startsWith(ROOT) ? loadSourceModule(resolved) : require(resolved);
  };

  const wrapper = new Function('require', 'module', 'exports', '__dirname', '__filename', transformed.code);
  wrapper(localRequire, module, module.exports, path.dirname(filePath), filePath);
  return module.exports;
}

function getAllPoolOptions(pools) {
  return Object.values(pools).flatMap((items) => items || []);
}

function formatNodeLine(node, optionById, levelDescById) {
  const option = optionById.get(node.id) || {};
  const maxLevel = node.maxLevel || option.maxLevel || 1;
  const parts = [`${node.id}`,
    `${maxLevel}级`
  ];

  if (option.requiredSkillId) {
    parts.push(`前置 ${option.requiredSkillId}${option.requiredSkillLevel ? ` Lv${option.requiredSkillLevel}` : ''}`);
  }

  let line = `- ${parts.join('，')}：${node.desc || option.desc || ''}`;
  const levelDescriptions = (levelDescById[node.id] || []).slice(0, maxLevel);
  if (levelDescriptions.length > 0) {
    const levelText = levelDescriptions
      .map((desc, index) => `Lv${index + 1} ${desc}`)
      .join('；');
    if (levelText && !line.includes(levelText)) {
      line += ` 升级：${levelText}`;
    }
  }

  return line;
}

function buildSkillListMarkdown() {
  const classesDir = path.join(ROOT, 'src', 'classes');
  const { TREE_DEFS } = loadSourceModule(path.join(classesDir, 'talentTrees.js'));
  const { UPGRADE_POOLS, UNIVERSAL_POOLS, DEPTH_SPEC_POOLS } = loadSourceModule(path.join(classesDir, 'upgradePools.js'));
  const { TALENT_LEVEL_DESC_BY_ID } = loadSourceModule(path.join(classesDir, 'talentNodeText.js'));

  const optionById = new Map(
    [
      ...getAllPoolOptions(UPGRADE_POOLS),
      ...getAllPoolOptions(UNIVERSAL_POOLS),
      ...getAllPoolOptions(DEPTH_SPEC_POOLS)
    ].map((option) => [option.id, option])
  );

  const mainTreeIds = new Set(['archer', 'druid', 'warrior', 'mage', 'paladin', 'warlock']);
  const depthIdsByTree = new Map(
    Object.entries(DEPTH_SPEC_POOLS).map(([treeId, options]) => [treeId, new Set((options || []).map((option) => option.id))])
  );

  const lines = [
    '# MOVA 天赋与成长总表',
    '',
    '本文档由 scripts/generate-skill-list.js 直接从当前节点元数据生成。',
    '',
    '当前文案来源：',
    '- src/classes/talentNodeText.js：逐级卡面文案与统一摘要',
    '- src/classes/talentTrees.js：树结构、归属、最大等级',
    '- src/classes/upgradePools.js：前置关系与池内配置',
    '',
    '> 如需更新本文件，请运行 npm run generate:skills。',
    ''
  ];

  for (const treeDef of TREE_DEFS) {
    const isMainTree = mainTreeIds.has(treeDef.id);
    const depthIds = depthIdsByTree.get(treeDef.id) || new Set();
    const regularNodes = (treeDef.nodes || []).filter((node) => !depthIds.has(node.id));
    const depthNodes = (treeDef.nodes || []).filter((node) => depthIds.has(node.id));

    lines.push(`## ${treeDef.name}`);
    lines.push('');
    lines.push(isMainTree ? '### 主职业核心' : '### 副职业入口');
    lines.push('');
    lines.push(`- ${treeDef.core.id}，${treeDef.core.maxLevel || 1}级：${treeDef.core.desc}`);
    lines.push('');

    if (regularNodes.length > 0) {
      lines.push(isMainTree ? '### 主职业专精' : '### 分支节点');
      lines.push('');
      for (const node of regularNodes) {
        lines.push(formatNodeLine(node, optionById, TALENT_LEVEL_DESC_BY_ID));
      }
      lines.push('');
    }

    if (depthNodes.length > 0) {
      lines.push('### 深度专精');
      lines.push('');
      for (const node of depthNodes) {
        lines.push(formatNodeLine(node, optionById, TALENT_LEVEL_DESC_BY_ID));
      }
      lines.push('');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

const output = buildSkillListMarkdown();
fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
console.log(`Generated ${path.relative(ROOT, OUTPUT_PATH)}`);