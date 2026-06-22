import {
  DEFAULT_THEME_SETTINGS,
  THEME_COLOR_DEFS,
  THEME_PRESETS,
  createDefaultSchemeColors,
  getEffectiveColorScheme,
  getMenuTextColor as getThemeMenuTextColor,
  getThemeColorValue as getStoredThemeColorValue,
  getThemePresetColor as getStoredThemePresetColor,
  mergeThemeSettingsPatch,
  normalizeThemeSettings,
} from './theme-colors.js';

import {
  TAB_SPACING_DEFAULT,
  normalizeTabSpacing,
} from './tab-layout.js';

import {
  loadImageMetaFromDataUrl,
} from './background-image-layout.js';

import {
  openBackgroundImageEditor,
} from './background-image-editor.js';

const FONT_OPTIONS = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  pingfang: '"PingFang SC", "Microsoft YaHei", sans-serif',
  songti: '"Songti SC", SimSun, serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'Menlo, Monaco, "Courier New", monospace',
};

const TAB_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20];
const GROUP_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18];

const DEFAULT_APPEARANCE = {
  tabFontFamily: 'system',
  tabFontSize: 13,
  tabColors: { light: '', dark: '' },
  groupFontFamily: 'system',
  groupFontSize: 12,
  groupColor: '#ffffff',
};

const SETTINGS_UI_PRESETS = {
  light: {
    bg: '#eef1f5',
    bgElevated: '#f4f6f9',
    text: '#1f2937',
    textSecondary: '#64748b',
    border: 'rgba(15, 23, 42, 0.12)',
    bgHover: 'rgba(15, 23, 42, 0.06)',
    bgActive: 'rgba(26, 115, 232, 0.12)',
    accent: '#1a73e8',
  },
  dark: {
    bg: '#16181c',
    bgElevated: '#1e2128',
    text: '#e8eaed',
    textSecondary: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.1)',
    bgHover: 'rgba(255, 255, 255, 0.06)',
    bgActive: 'rgba(138, 180, 248, 0.15)',
    accent: '#8ab4f8',
  },
};

const MAX_BACKGROUND_IMAGE_BYTES = 2 * 1024 * 1024;

const DISPLAY_MODES = ['mixed', 'list', 'groups', 'site', 'tags', 'detailed'];
const DEFAULT_DISPLAY_MODE = 'mixed';

const DEFAULT_TAB_SETTINGS = {
  showFullUrl: false,
  hideTabIcons: false,
  coloredDotsInsteadOfIcons: false,
  showTabIndex: false,
  tabIndexPosition: 'right',
  tabSpacing: TAB_SPACING_DEFAULT,
  showNewTabRow: true,
  showSearchBox: true,
  showSettingsButton: true,
  showHeader: true,
  enableTabTags: true,
  // 拖拽指示器设置
  dragIndicatorWidth: 4,
  dragIndicatorColor: '',
  dragGroupOutlineWidth: 3,
  dragGroupOutlineColor: '',
};

const SETTINGS_NAV = {
  font: { title: '字体设置', elementId: 'settings-font-page' },
  tabs: { title: '标签页设置', elementId: 'settings-tabs-page' },
  theme: { title: '主题设置', elementId: 'settings-theme-page' },
  display: { title: '显示方式', elementId: 'settings-display-page' },
  sponsor: { title: '支持作者', elementId: 'settings-sponsor-page' },
};

const state = {
  appearance: { ...DEFAULT_APPEARANCE },
  tabSettings: { ...DEFAULT_TAB_SETTINGS },
  themeSettings: structuredClone(DEFAULT_THEME_SETTINGS),
  displayMode: DEFAULT_DISPLAY_MODE,
  settingsPage: null,
};

let settingsRootEl;
let settingsNavEl;
let settingsPageTitleEl;

function snapFontSize(size, allowed, fallback) {
  const n = Number(size);
  if (!Number.isFinite(n)) return fallback;
  if (allowed.includes(n)) return n;
  return allowed.reduce((best, value) =>
    Math.abs(value - n) < Math.abs(best - n) ? value : best, fallback);
}

function normalizeHexColor(color, fallback = '#ffffff') {
  if (!color || typeof color !== 'string') return fallback;
  const hex = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(hex)) return hex;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function getActiveColorScheme() {
  return getEffectiveColorScheme(state.themeSettings);
}

function getThemePresetColor(key) {
  return getStoredThemePresetColor(state.themeSettings, key);
}

function getTabBarBackground() {
  return getStoredThemeColorValue(state.themeSettings, 'tabBarBackground');
}

function getSettingsUiPreset(scheme = getActiveColorScheme()) {
  const preset = SETTINGS_UI_PRESETS[scheme];
  return {
    ...preset,
  };
}

function getThemeColorValue(key) {
  return getStoredThemeColorValue(state.themeSettings, key);
}

function getMenuTextColor() {
  return getThemeMenuTextColor(state.themeSettings);
}

function getThemeTabColor() {
  return getMenuTextColor();
}

function normalizeTabColorValue(value) {
  if (!value || typeof value !== 'string' || !value.trim()) return '';
  return normalizeHexColor(value, '') || '';
}

function getCustomTabColorForScheme(appearance, scheme) {
  const colors = appearance?.tabColors;
  if (!colors) return '';
  const value = colors[scheme];
  return value && typeof value === 'string' ? value : '';
}

function normalizeAppearance(raw = {}) {
  const tabColors = { light: '', dark: '' };
  if (raw.tabColors && typeof raw.tabColors === 'object') {
    tabColors.light = normalizeTabColorValue(raw.tabColors.light);
    tabColors.dark = normalizeTabColorValue(raw.tabColors.dark);
  }
  if (typeof raw.tabColor === 'string' && raw.tabColor.trim() && !tabColors.light) {
    tabColors.light = normalizeTabColorValue(raw.tabColor);
  }

  return {
    tabFontFamily: FONT_OPTIONS[raw.tabFontFamily] ? raw.tabFontFamily : DEFAULT_APPEARANCE.tabFontFamily,
    tabFontSize: snapFontSize(raw.tabFontSize, TAB_FONT_SIZES, DEFAULT_APPEARANCE.tabFontSize),
    tabColors,
    groupFontFamily: FONT_OPTIONS[raw.groupFontFamily] ? raw.groupFontFamily : DEFAULT_APPEARANCE.groupFontFamily,
    groupFontSize: snapFontSize(raw.groupFontSize, GROUP_FONT_SIZES, DEFAULT_APPEARANCE.groupFontSize),
    groupColor: normalizeHexColor(raw.groupColor, DEFAULT_APPEARANCE.groupColor),
  };
}

function normalizeTabSettings(raw = {}) {
  const tabIndexPosition = raw.tabIndexPosition === 'left' ? 'left' : 'right';
  
  // 拖拽指示器粗细验证（1-8px）
  const dragIndicatorWidth = Math.max(1, Math.min(8, Number(raw.dragIndicatorWidth) || 4));
  const dragGroupOutlineWidth = Math.max(1, Math.min(8, Number(raw.dragGroupOutlineWidth) || 3));
  
  return {
    showFullUrl: Boolean(raw.showFullUrl),
    hideTabIcons: Boolean(raw.hideTabIcons),
    coloredDotsInsteadOfIcons: Boolean(raw.coloredDotsInsteadOfIcons),
    showTabIndex: Boolean(raw.showTabIndex),
    tabIndexPosition,
    tabSpacing: normalizeTabSpacing(raw.tabSpacing),
    showNewTabRow: raw.showNewTabRow !== false,
    showSearchBox: raw.showSearchBox !== false,
    showSettingsButton: raw.showSettingsButton !== false,
    showHeader: raw.showHeader !== false,
    enableTabTags: raw.enableTabTags !== false,
    // 拖拽指示器设置
    dragIndicatorWidth,
    dragIndicatorColor: normalizeHexColor(raw.dragIndicatorColor, ''),
    dragGroupOutlineWidth,
    dragGroupOutlineColor: normalizeHexColor(raw.dragGroupOutlineColor, ''),
  };
}

function formatTabSpacingLabel(spacingPx) {
  const value = normalizeTabSpacing(spacingPx);
  if (value < 0) return `${value}px（更紧密）`;
  if (value === 0) return '0px（紧凑）';
  return `${value}px`;
}

function applySettingsUiVars(target, preset) {
  if (!target || !preset) return;

  target.style.setProperty('--settings-bg', preset.bg);
  target.style.setProperty('--settings-bg-elevated', preset.bgElevated);
  target.style.setProperty('--settings-text', preset.text);
  target.style.setProperty('--settings-text-secondary', preset.textSecondary);
  target.style.setProperty('--settings-border', preset.border);
  target.style.setProperty('--settings-bg-hover', preset.bgHover);
  target.style.setProperty('--settings-bg-active', preset.bgActive);
  target.style.setProperty('--settings-accent', preset.accent);
  target.style.setProperty('--bg', preset.bg);
  target.style.setProperty('--bg-elevated', preset.bgElevated);
  target.style.setProperty('--text', preset.text);
  target.style.setProperty('--text-secondary', preset.textSecondary);
  target.style.setProperty('--border', preset.border);
  target.style.setProperty('--bg-hover', preset.bgHover);
  target.style.setProperty('--bg-active', preset.bgActive);
  target.style.setProperty('--accent', preset.accent);
}

function applySettingsPageTheme() {
  if (!settingsRootEl) return;

  const scheme = getActiveColorScheme();
  settingsRootEl.setAttribute('data-color-scheme', scheme);
  settingsRootEl.style.colorScheme = scheme;

  const ui = getSettingsUiPreset(scheme);
  applySettingsUiVars(settingsRootEl, ui);
  settingsRootEl.style.backgroundColor = ui.bg;
}

async function loadThemeSettings() {
  const { themeSettings = {} } = await chrome.storage.local.get('themeSettings');
  state.themeSettings = normalizeThemeSettings({ ...DEFAULT_THEME_SETTINGS, ...themeSettings });
  applySettingsPageTheme();
  syncThemeSettingsForm();
}

async function saveThemeSettings() {
  await chrome.storage.local.set({ themeSettings: state.themeSettings });
}

async function loadAppearanceSettings() {
  const { appearanceSettings = {} } = await chrome.storage.local.get('appearanceSettings');
  state.appearance = normalizeAppearance({ ...DEFAULT_APPEARANCE, ...appearanceSettings });
  syncSettingsForm();
}

async function saveAppearanceSettings() {
  await chrome.storage.local.set({ appearanceSettings: state.appearance });
}

async function loadTabSettings() {
  const { tabSettings = {} } = await chrome.storage.local.get('tabSettings');
  state.tabSettings = normalizeTabSettings({ ...DEFAULT_TAB_SETTINGS, ...tabSettings });
  syncTabPageSettingsForm();
}

async function saveTabSettings() {
  await chrome.storage.local.set({ tabSettings: state.tabSettings });
}

async function loadDisplaySettings() {
  const { displayMode } = await chrome.storage.local.get('displayMode');
  if (DISPLAY_MODES.includes(displayMode)) {
    state.displayMode = displayMode;
  }
  syncDisplaySettingsForm();
}

async function saveDisplayMode() {
  await chrome.storage.local.set({ displayMode: state.displayMode });
}

function syncThemeSettingsForm() {
  document.querySelectorAll('input[name="theme-mode"]').forEach((input) => {
    input.checked = input.value === state.themeSettings.mode;
  });

  document.querySelectorAll('[data-theme-color]').forEach((input) => {
    const key = input.dataset.themeColor;
    if (!THEME_COLOR_DEFS[key]) return;
    input.value = normalizeHexColor(getThemeColorValue(key), getThemePresetColor(key));
  });

  const clearBgBtn = document.getElementById('btn-theme-bg-image-clear');
  const adjustBgBtn = document.getElementById('btn-theme-bg-image-adjust');
  const hasBgImage = Boolean(state.themeSettings.backgroundImage);
  if (clearBgBtn) {
    clearBgBtn.classList.toggle('hidden', !hasBgImage);
  }
  if (adjustBgBtn) {
    adjustBgBtn.classList.toggle('hidden', !hasBgImage);
  }
}

function syncTabSettingsForm() {
  const { appearance } = state;
  const scheme = getActiveColorScheme();
  const customTabColor = getCustomTabColorForScheme(appearance, scheme);
  document.getElementById('setting-tab-font').value = appearance.tabFontFamily;
  document.getElementById('setting-tab-size').value = appearance.tabFontSize;
  document.getElementById('setting-tab-color').value = normalizeHexColor(
    customTabColor || getThemeTabColor(),
    getThemeTabColor(),
  );
}

function syncGroupSettingsForm() {
  const { appearance } = state;
  const groupColor = normalizeHexColor(appearance.groupColor);
  document.getElementById('setting-group-font').value = appearance.groupFontFamily;
  document.getElementById('setting-group-size').value = appearance.groupFontSize;
  document.getElementById('setting-group-color').value = groupColor;
  const groupColorValueEl = document.getElementById('setting-group-color-value');
  if (groupColorValueEl) groupColorValueEl.textContent = groupColor;
}

function syncSettingsForm() {
  syncTabSettingsForm();
  syncGroupSettingsForm();
  syncTabPageSettingsForm();
}

function syncTabPageSettingsForm() {
  const { tabSettings } = state;
  document.getElementById('setting-show-full-url').checked = tabSettings.showFullUrl;
  document.getElementById('setting-hide-tab-icons').checked = tabSettings.hideTabIcons;
  document.getElementById('setting-colored-dots').checked = tabSettings.coloredDotsInsteadOfIcons;
  document.getElementById('setting-show-tab-index').checked = tabSettings.showTabIndex;
  document.getElementById('setting-show-new-tab-row').checked = tabSettings.showNewTabRow;
  document.getElementById('setting-show-search-box').checked = tabSettings.showSearchBox;
  document.getElementById('setting-show-settings-button').checked = tabSettings.showSettingsButton;
  document.getElementById('setting-show-header').checked = tabSettings.showHeader;
  document.getElementById('setting-enable-tab-tags').checked = tabSettings.enableTabTags;

  const positionEl = document.getElementById('setting-tab-index-position');
  positionEl.querySelectorAll('.settings-segmented-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === tabSettings.tabIndexPosition);
  });
  positionEl.classList.toggle('disabled', !tabSettings.showTabIndex);

  const spacingInput = document.getElementById('setting-tab-spacing');
  const spacingValueEl = document.getElementById('setting-tab-spacing-value');
  if (spacingInput) {
    spacingInput.value = String(normalizeTabSpacing(tabSettings.tabSpacing));
  }
  if (spacingValueEl) {
    spacingValueEl.textContent = formatTabSpacingLabel(tabSettings.tabSpacing);
  }
  
  // 拖拽指示器设置
  const dragIndicatorWidthInput = document.getElementById('setting-drag-indicator-width');
  const dragIndicatorWidthValueEl = document.getElementById('setting-drag-indicator-width-value');
  if (dragIndicatorWidthInput) {
    dragIndicatorWidthInput.value = String(tabSettings.dragIndicatorWidth);
  }
  if (dragIndicatorWidthValueEl) {
    dragIndicatorWidthValueEl.textContent = `${tabSettings.dragIndicatorWidth}px`;
  }
  
  const dragIndicatorColorInput = document.getElementById('setting-drag-indicator-color');
  if (dragIndicatorColorInput) {
    dragIndicatorColorInput.value = tabSettings.dragIndicatorColor || '#1a73e8';
  }
  
  const dragGroupOutlineWidthInput = document.getElementById('setting-drag-group-outline-width');
  const dragGroupOutlineWidthValueEl = document.getElementById('setting-drag-group-outline-width-value');
  if (dragGroupOutlineWidthInput) {
    dragGroupOutlineWidthInput.value = String(tabSettings.dragGroupOutlineWidth);
  }
  if (dragGroupOutlineWidthValueEl) {
    dragGroupOutlineWidthValueEl.textContent = `${tabSettings.dragGroupOutlineWidth}px`;
  }
  
  const dragGroupOutlineColorInput = document.getElementById('setting-drag-group-outline-color');
  if (dragGroupOutlineColorInput) {
    dragGroupOutlineColorInput.value = tabSettings.dragGroupOutlineColor || '#1a73e8';
  }
}

function syncDisplaySettingsForm() {
  document.querySelectorAll('input[name="display-mode"]').forEach((input) => {
    input.checked = input.value === state.displayMode;
  });
}

function updateThemeSettings(patch) {
  state.themeSettings = mergeThemeSettingsPatch(state.themeSettings, patch);
  saveThemeSettings();
  applySettingsPageTheme();
  syncThemeSettingsForm();
  syncTabSettingsForm();
}

function resetThemeColors() {
  updateThemeSettings({
    settingsFollowTabBarBg: true,
    schemeColors: createDefaultSchemeColors(),
    backgroundImage: '',
    backgroundImageMeta: null,
    backgroundImageFocal: { x: 0.5, y: 0.5 },
    backgroundImageScale: 1,
  });
}

function openBackgroundImageAdjustEditor(imageUrl = state.themeSettings.backgroundImage) {
  if (!imageUrl) return;

  const openEditor = (meta) => {
    openBackgroundImageEditor({
      imageUrl,
      focal: state.themeSettings.backgroundImageFocal,
      scale: state.themeSettings.backgroundImageScale,
      meta,
      previewBg: getTabBarBackground(),
      onApply: (result) => {
        updateThemeSettings({
          backgroundImage: imageUrl,
          backgroundImageMeta: meta,
          backgroundImageFocal: result.focal,
          backgroundImageScale: result.scale,
        });
      },
    });
  };

  const meta = state.themeSettings.backgroundImageMeta;
  if (meta) {
    openEditor(meta);
    return;
  }

  loadImageMetaFromDataUrl(imageUrl)
    .then(openEditor)
    .catch(() => alert('无法读取图片，请重新上传'));
}

async function handleBackgroundImagePick(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    alert('图片不能超过 2MB');
    return;
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  if (typeof dataUrl !== 'string') return;

  try {
    const meta = await loadImageMetaFromDataUrl(dataUrl);
    openBackgroundImageEditor({
      imageUrl: dataUrl,
      focal: { x: 0.5, y: 0.5 },
      scale: 1,
      meta,
      previewBg: getTabBarBackground(),
      onApply: (result) => {
        updateThemeSettings({
          backgroundImage: dataUrl,
          backgroundImageMeta: meta,
          backgroundImageFocal: result.focal,
          backgroundImageScale: result.scale,
        });
      },
    });
  } catch {
    alert('无法读取图片，请换一张试试');
  }
}

function updateAppearance(patch) {
  const merged = { ...state.appearance, ...patch };
  if (patch.tabColors) {
    merged.tabColors = {
      ...state.appearance.tabColors,
      ...patch.tabColors,
    };
  }
  state.appearance = normalizeAppearance(merged);
  saveAppearanceSettings();
  syncSettingsForm();
}

function updateTabSettings(patch) {
  state.tabSettings = normalizeTabSettings({ ...state.tabSettings, ...patch });
  saveTabSettings();
  syncTabPageSettingsForm();
}

function setDisplayMode(mode) {
  if (!DISPLAY_MODES.includes(mode)) return;
  state.displayMode = mode;
  saveDisplayMode();
  syncDisplaySettingsForm();
}

function showSettingsHome() {
  state.settingsPage = null;
  settingsNavEl.querySelectorAll('.settings-nav-item').forEach((btn) => {
    btn.classList.remove('active');
  });
  settingsPageTitleEl.textContent = '设置';
  document.getElementById('settings-empty-page')?.classList.remove('hidden');
  Object.values(SETTINGS_NAV).forEach((nav) => {
    document.getElementById(nav.elementId)?.classList.add('hidden');
  });
}

function showSettingsPage(page) {
  if (!SETTINGS_NAV[page]) return;

  state.settingsPage = page;
  document.getElementById('settings-empty-page')?.classList.add('hidden');
  settingsNavEl.querySelectorAll('.settings-nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.settingsPage === page);
  });
  settingsPageTitleEl.textContent = SETTINGS_NAV[page].title;

  Object.entries(SETTINGS_NAV).forEach(([key, nav]) => {
    document.getElementById(nav.elementId)?.classList.toggle('hidden', key !== page);
  });

  if (page === 'font') syncSettingsForm();
  if (page === 'tabs') syncTabPageSettingsForm();
  if (page === 'theme') syncThemeSettingsForm();
  if (page === 'display') syncDisplaySettingsForm();
}

function closeSettingsTab() {
  if (chrome.tabs?.getCurrent) {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      } else {
        window.close();
      }
    });
  } else {
    window.close();
  }
}

function bindSettingsEvents() {
  document.getElementById('btn-close-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettingsTab();
  });

  document.getElementById('btn-back-from-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettingsTab();
  });

  settingsNavEl.querySelectorAll('.settings-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.settingsPage;
      if (SETTINGS_NAV[page]) showSettingsPage(page);
    });
  });

  document.querySelectorAll('.settings-empty-quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.settingsPage;
      if (SETTINGS_NAV[page]) showSettingsPage(page);
    });
  });

  document.getElementById('setting-tab-font').addEventListener('change', (e) => {
    updateAppearance({ tabFontFamily: e.target.value });
  });

  document.getElementById('setting-tab-size').addEventListener('change', (e) => {
    updateAppearance({ tabFontSize: Number(e.target.value) });
  });

  document.getElementById('setting-tab-color').addEventListener('input', (e) => {
    const scheme = getActiveColorScheme();
    updateAppearance({ tabColors: { [scheme]: e.target.value } });
  });

  document.getElementById('setting-group-font').addEventListener('change', (e) => {
    updateAppearance({ groupFontFamily: e.target.value });
  });

  document.getElementById('setting-group-size').addEventListener('change', (e) => {
    updateAppearance({ groupFontSize: Number(e.target.value) });
  });

  document.getElementById('setting-group-color').addEventListener('input', (e) => {
    updateAppearance({ groupColor: normalizeHexColor(e.target.value) });
  });

  document.getElementById('setting-group-color').addEventListener('change', (e) => {
    updateAppearance({ groupColor: normalizeHexColor(e.target.value) });
  });

  document.getElementById('btn-tab-color-default').addEventListener('click', () => {
    const scheme = getActiveColorScheme();
    updateAppearance({ tabColors: { [scheme]: '' } });
  });

  document.getElementById('btn-reset-tab-appearance').addEventListener('click', () => {
    updateAppearance({
      tabFontFamily: DEFAULT_APPEARANCE.tabFontFamily,
      tabFontSize: DEFAULT_APPEARANCE.tabFontSize,
      tabColors: { light: '', dark: '' },
    });
  });

  document.getElementById('btn-reset-group-appearance').addEventListener('click', () => {
    updateAppearance({
      groupFontFamily: DEFAULT_APPEARANCE.groupFontFamily,
      groupFontSize: DEFAULT_APPEARANCE.groupFontSize,
      groupColor: DEFAULT_APPEARANCE.groupColor,
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themeSettings.mode === 'system') {
      applySettingsPageTheme();
      syncThemeSettingsForm();
    }
    syncTabSettingsForm();
  });

  document.querySelectorAll('input[name="theme-mode"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) updateThemeSettings({ mode: e.target.value });
    });
  });

  document.querySelectorAll('[data-theme-color]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.themeColor;
      if (!THEME_COLOR_DEFS[key]) return;
      updateThemeSettings({ colors: { [key]: e.target.value } });
    });
  });

  document.querySelectorAll('[data-theme-color-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.themeColorReset;
      if (!THEME_COLOR_DEFS[key]) return;
      updateThemeSettings({ colors: { [key]: '' } });
    });
  });

  document.getElementById('btn-reset-theme-colors').addEventListener('click', resetThemeColors);

  document.getElementById('btn-theme-bg-image-pick').addEventListener('click', () => {
    document.getElementById('setting-theme-bg-image').click();
  });

  document.getElementById('setting-theme-bg-image').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleBackgroundImagePick(file);
  });

  document.getElementById('btn-theme-bg-image-clear').addEventListener('click', () => {
    updateThemeSettings({
      backgroundImage: '',
      backgroundImageMeta: null,
      backgroundImageFocal: { x: 0.5, y: 0.5 },
      backgroundImageScale: 1,
    });
  });

  document.getElementById('btn-theme-bg-image-adjust').addEventListener('click', () => {
    openBackgroundImageAdjustEditor();
  });

  document.querySelectorAll('input[name="display-mode"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      if (e.target.checked) setDisplayMode(e.target.value);
    });
  });

  document.getElementById('setting-show-full-url').addEventListener('change', (e) => {
    updateTabSettings({ showFullUrl: e.target.checked });
  });

  document.getElementById('setting-hide-tab-icons').addEventListener('change', (e) => {
    updateTabSettings({ hideTabIcons: e.target.checked });
  });

  document.getElementById('setting-colored-dots').addEventListener('change', (e) => {
    updateTabSettings({ coloredDotsInsteadOfIcons: e.target.checked });
  });

  document.getElementById('setting-show-tab-index').addEventListener('change', (e) => {
    updateTabSettings({ showTabIndex: e.target.checked });
  });

  document.getElementById('setting-show-new-tab-row').addEventListener('change', (e) => {
    updateTabSettings({ showNewTabRow: e.target.checked });
  });

  document.getElementById('setting-show-header').addEventListener('change', (e) => {
    updateTabSettings({ showHeader: e.target.checked });
  });

  document.getElementById('setting-show-search-box').addEventListener('change', (e) => {
    updateTabSettings({ showSearchBox: e.target.checked });
  });

  document.getElementById('setting-show-settings-button').addEventListener('change', (e) => {
    updateTabSettings({ showSettingsButton: e.target.checked });
  });

  document.getElementById('setting-enable-tab-tags').addEventListener('change', (e) => {
    updateTabSettings({ enableTabTags: e.target.checked });
  });

  document.getElementById('setting-tab-index-position').addEventListener('click', (e) => {
    const btn = e.target.closest('.settings-segmented-btn');
    if (!btn || !state.tabSettings.showTabIndex) return;
    updateTabSettings({ tabIndexPosition: btn.dataset.value });
  });

  document.getElementById('setting-tab-spacing').addEventListener('input', (e) => {
    const spacing = normalizeTabSpacing(Number(e.target.value));
    const spacingValueEl = document.getElementById('setting-tab-spacing-value');
    if (spacingValueEl) spacingValueEl.textContent = formatTabSpacingLabel(spacing);
    updateTabSettings({ tabSpacing: spacing });
  });

  // 拖拽指示器设置事件
  document.getElementById('setting-drag-indicator-width').addEventListener('input', (e) => {
    const width = Math.max(1, Math.min(8, Number(e.target.value)));
    const widthValueEl = document.getElementById('setting-drag-indicator-width-value');
    if (widthValueEl) widthValueEl.textContent = `${width}px`;
    updateTabSettings({ dragIndicatorWidth: width });
  });

  document.getElementById('setting-drag-indicator-color').addEventListener('input', (e) => {
    updateTabSettings({ dragIndicatorColor: e.target.value });
  });

  document.getElementById('btn-drag-indicator-color-default').addEventListener('click', () => {
    document.getElementById('setting-drag-indicator-color').value = '#1a73e8';
    updateTabSettings({ dragIndicatorColor: '' });
  });

  document.getElementById('setting-drag-group-outline-width').addEventListener('input', (e) => {
    const width = Math.max(1, Math.min(8, Number(e.target.value)));
    const widthValueEl = document.getElementById('setting-drag-group-outline-width-value');
    if (widthValueEl) widthValueEl.textContent = `${width}px`;
    updateTabSettings({ dragGroupOutlineWidth: width });
  });

  document.getElementById('setting-drag-group-outline-color').addEventListener('input', (e) => {
    updateTabSettings({ dragGroupOutlineColor: e.target.value });
  });

  document.getElementById('btn-drag-group-outline-color-default').addEventListener('click', () => {
    document.getElementById('setting-drag-group-outline-color').value = '#1a73e8';
    updateTabSettings({ dragGroupOutlineColor: '' });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettingsTab();
  });
}

export async function initSettingsPage() {
  settingsRootEl = document.getElementById('settings-root');
  settingsNavEl = document.querySelector('.settings-nav');
  settingsPageTitleEl = document.getElementById('settings-page-title');

  await loadThemeSettings();
  await loadAppearanceSettings();
  await loadTabSettings();
  await loadDisplaySettings();

  bindSettingsEvents();
  showSettingsHome();
}

export function openSettingsInNewTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings/index.html') });
}
