import {
  migrateBackgroundPositionToFocal,
  TAB_PANEL_REFERENCE_WIDTH,
  TAB_PANEL_REFERENCE_HEIGHT,
} from './background-image-layout.js';

export const THEME_MODES = ['system', 'light', 'dark'];

export const THEME_COLOR_DEFS = {
  tabBarBackground: { cssVars: ['--bg', '--bg-elevated'] },
  menuTextColor: { cssVars: ['--text', '--text-secondary'] },
  tabActiveBg: { cssVars: ['--bg-active'] },
  tabHoverBg: { cssVars: ['--bg-hover'] },
  tabCloseColor: { cssVars: ['--tab-close-color'] },
  tabCloseHoverColor: { cssVars: ['--tab-close-hover-color'] },
};

export const THEME_PRESETS = {
  light: {
    tabBarBackground: '#ffffff',
    menuTextColor: '#202124',
    menuTextSecondary: '#5f6368',
    accent: '#1a73e8',
    tabActiveBg: '#dce8fc',
    tabHoverBg: '#e8eaed',
    tabCloseColor: '#5f6368',
    tabCloseHoverColor: '#d93025',
    accentHover: '#1557b0',
    danger: '#d93025',
    border: 'rgba(0, 0, 0, 0.08)',
    bgGroup: 'rgba(0, 0, 0, 0.04)',
    shadow: '0 4px 16px rgba(0, 0, 0, 0.16)',
  },
  dark: {
    tabBarBackground: '#202124',
    menuTextColor: '#e8eaed',
    menuTextSecondary: '#9aa0a6',
    accent: '#8ab4f8',
    tabActiveBg: '#394457',
    tabHoverBg: '#35363a',
    tabCloseColor: '#9aa0a6',
    tabCloseHoverColor: '#f28b82',
    accentHover: '#aecbfa',
    danger: '#f28b82',
    border: 'rgba(255, 255, 255, 0.1)',
    bgGroup: 'rgba(255, 255, 255, 0.05)',
    shadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
};

export const SCHEME_COLOR_KEYS = [
  'tabBarBackground',
  'settingsBackground',
  'menuTextColor',
  'tabActiveBg',
  'tabHoverBg',
  'tabCloseColor',
  'tabCloseHoverColor',
];

export function createEmptySchemeColors() {
  return Object.fromEntries(SCHEME_COLOR_KEYS.map((key) => [key, '']));
}

export function createDefaultSchemeColors() {
  return {
    light: createEmptySchemeColors(),
    dark: createEmptySchemeColors(),
  };
}

export const DEFAULT_THEME_SETTINGS = {
  mode: 'system',
  settingsFollowTabBarBg: true,
  schemeColors: createDefaultSchemeColors(),
  backgroundImage: '',
  backgroundImageMeta: null,
  backgroundImageFocal: { x: 0.5, y: 0.5 },
  backgroundImageScale: 1,
};

export function normalizeThemeColorValue(value) {
  if (!value || typeof value !== 'string') return '';
  const hex = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '';
}

function applyLegacyColorMap(rawColors, target) {
  const legacyTabBarBg = rawColors.tabBarBackground
    || rawColors.backgroundColor
    || rawColors.panelBg
    || rawColors.panelElevatedBg;
  if (legacyTabBarBg) target.tabBarBackground = normalizeThemeColorValue(legacyTabBarBg);

  if (rawColors.settingsBackground) {
    target.settingsBackground = normalizeThemeColorValue(rawColors.settingsBackground);
  }

  const legacyMenuText = rawColors.menuTextColor
    || rawColors.textPrimary
    || rawColors.textSecondary;
  if (legacyMenuText) target.menuTextColor = normalizeThemeColorValue(legacyMenuText);

  SCHEME_COLOR_KEYS.forEach((key) => {
    if (key === 'tabBarBackground' || key === 'menuTextColor' || key === 'settingsBackground') return;
    if (rawColors[key]) target[key] = normalizeThemeColorValue(rawColors[key]);
  });
}

function mergeSchemeColorSource(source, target) {
  if (!source || typeof source !== 'object') return;
  SCHEME_COLOR_KEYS.forEach((key) => {
    if (source[key]) target[key] = normalizeThemeColorValue(source[key]);
  });
}

export function normalizeThemeSettings(raw = {}) {
  const mode = THEME_MODES.includes(raw.mode) ? raw.mode : DEFAULT_THEME_SETTINGS.mode;
  const settingsFollowTabBarBg = raw.settingsFollowTabBarBg !== undefined
    ? Boolean(raw.settingsFollowTabBarBg)
    : DEFAULT_THEME_SETTINGS.settingsFollowTabBarBg;

  const schemeColors = createDefaultSchemeColors();

  if (raw.schemeColors && typeof raw.schemeColors === 'object') {
    mergeSchemeColorSource(raw.schemeColors.light, schemeColors.light);
    mergeSchemeColorSource(raw.schemeColors.dark, schemeColors.dark);
  }

  if (raw.colors && typeof raw.colors === 'object') {
    applyLegacyColorMap(raw.colors, schemeColors.light);
  }

  const backgroundImage = typeof raw.backgroundImage === 'string' ? raw.backgroundImage : '';
  const backgroundImageMeta = normalizeThemeBackgroundImageMeta(raw.backgroundImageMeta);
  const backgroundImageScale = normalizeThemeBackgroundImageScale(raw.backgroundImageScale);
  const backgroundImageFocal = resolveThemeBackgroundImageFocal(
    raw,
    backgroundImageMeta,
    backgroundImageScale,
  );

  if (!backgroundImage) {
    return {
      mode,
      settingsFollowTabBarBg,
      schemeColors,
      backgroundImage: '',
      backgroundImageMeta: null,
      backgroundImageFocal: { x: 0.5, y: 0.5 },
      backgroundImageScale: 1,
    };
  }

  return {
    mode,
    settingsFollowTabBarBg,
    schemeColors,
    backgroundImage,
    backgroundImageMeta,
    backgroundImageFocal,
    backgroundImageScale,
  };
}

function resolveThemeBackgroundImageFocal(raw, meta, scale) {
  const focalX = Number(raw.backgroundImageFocal?.x);
  const focalY = Number(raw.backgroundImageFocal?.y);
  if (Number.isFinite(focalX) && Number.isFinite(focalY)) {
    return { x: focalX, y: focalY };
  }

  if (raw.backgroundImagePosition && meta) {
    return migrateBackgroundPositionToFocal(
      normalizeThemeBackgroundImagePosition(raw.backgroundImagePosition),
      meta,
      scale,
      TAB_PANEL_REFERENCE_WIDTH,
      TAB_PANEL_REFERENCE_HEIGHT,
    );
  }

  return { x: 0.5, y: 0.5 };
}

function normalizeThemeBackgroundImageMeta(raw) {
  const width = Number(raw?.width);
  const height = Number(raw?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function normalizeThemeBackgroundImageFocal(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  return {
    x: Number.isFinite(x) ? x : 0.5,
    y: Number.isFinite(y) ? y : 0.5,
  };
}

function normalizeThemeBackgroundImagePosition(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  return {
    x: Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50,
    y: Number.isFinite(y) ? Math.min(100, Math.max(0, y)) : 50,
  };
}

function normalizeThemeBackgroundImageScale(raw) {
  const scale = Number(raw);
  if (!Number.isFinite(scale)) return 1;
  return Math.min(3, Math.max(0.5, scale));
}

export function getEffectiveColorScheme(themeSettings) {
  const mode = themeSettings?.mode ?? 'system';
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function getThemePresetColor(themeSettings, key) {
  return THEME_PRESETS[getEffectiveColorScheme(themeSettings)][key];
}

export function getSchemeThemeColors(themeSettings) {
  const scheme = getEffectiveColorScheme(themeSettings);
  return themeSettings.schemeColors?.[scheme] ?? createEmptySchemeColors();
}

export function getThemeColorValue(themeSettings, key) {
  const custom = getSchemeThemeColors(themeSettings)[key];
  if (custom) return custom;
  return getThemePresetColor(themeSettings, key);
}

export function getMenuTextColor(themeSettings) {
  const custom = getSchemeThemeColors(themeSettings).menuTextColor;
  if (custom) return custom;
  return THEME_PRESETS[getEffectiveColorScheme(themeSettings)].menuTextColor;
}

export function mergeThemeSettingsPatch(themeSettings, patch = {}) {
  const nextMode = patch.mode ?? themeSettings.mode;
  const scheme = getEffectiveColorScheme({ ...themeSettings, mode: nextMode });
  let schemeColors = {
    light: { ...themeSettings.schemeColors.light },
    dark: { ...themeSettings.schemeColors.dark },
  };

  if (patch.schemeColors) {
    schemeColors = normalizeThemeSettings({ schemeColors: patch.schemeColors }).schemeColors;
  } else if (patch.colors) {
    schemeColors[scheme] = {
      ...schemeColors[scheme],
      ...patch.colors,
    };
    SCHEME_COLOR_KEYS.forEach((key) => {
      if (patch.colors[key] !== undefined) {
        schemeColors[scheme][key] = normalizeThemeColorValue(patch.colors[key]);
      }
    });
  }

  const backgroundImage = patch.backgroundImage !== undefined
    ? patch.backgroundImage
    : themeSettings.backgroundImage;
  const backgroundImageMeta = patch.backgroundImageMeta !== undefined
    ? normalizeThemeBackgroundImageMeta(patch.backgroundImageMeta)
    : themeSettings.backgroundImageMeta;
  const backgroundImageScale = patch.backgroundImageScale !== undefined
    ? normalizeThemeBackgroundImageScale(patch.backgroundImageScale)
    : themeSettings.backgroundImageScale;
  const backgroundImageFocal = patch.backgroundImageFocal !== undefined
    ? normalizeThemeBackgroundImageFocal(patch.backgroundImageFocal)
    : themeSettings.backgroundImageFocal;

  return normalizeThemeSettings({
    mode: nextMode,
    settingsFollowTabBarBg: patch.settingsFollowTabBarBg ?? themeSettings.settingsFollowTabBarBg,
    schemeColors,
    backgroundImage,
    backgroundImageMeta,
    backgroundImageFocal,
    backgroundImageScale,
  });
}
