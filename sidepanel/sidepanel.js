import { openSettingsInNewTab } from './settings-page.js';
import { applyBackgroundImageToElement } from './background-image-layout.js';
import {
  DEFAULT_THEME_SETTINGS,
  THEME_COLOR_DEFS,
  THEME_PRESETS,
  getEffectiveColorScheme,
  getMenuTextColor as getThemeMenuTextColor,
  getThemeColorValue as getStoredThemeColorValue,
  getThemePresetColor as getStoredThemePresetColor,
  normalizeThemeSettings,
} from './theme-colors.js';
import {
  TAB_SPACING_DEFAULT,
  getTabSpacingCssVars,
  normalizeTabSpacing,
} from './tab-layout.js';
import {
  getTabNote,
  addTabTag,
  removeTabTag,
  updateTabNote,
  deleteTabNote,
  cleanupTabNotes,
} from './tab-notes.js';

const GROUP_COLORS = {
  grey: '#9aa0a6',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#1e8e3e',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#e8710a',
};

const GROUP_COLOR_KEYS = Object.keys(GROUP_COLORS);

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 10l5 5 5-5H7z"/></svg>',
};

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

const THEME_STATIC_VARS = {
  accent: '--accent',
  accentHover: '--accent-hover',
  danger: '--danger',
  border: '--border',
  bgGroup: '--bg-group',
  shadow: '--shadow',
};

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

const state = {
  tabs: [],
  groups: [],
  collapsedGroups: new Set(),
  collapsedVirtual: new Set(),
  searchQuery: '',
  currentWindowId: null,
  dragType: null,
  dragTabId: null,
  dragGroupId: null,
  dragLock: false,
  contextTabId: null,
  groupEditor: null,
  appearance: { ...DEFAULT_APPEARANCE },
  tabSettings: { ...DEFAULT_TAB_SETTINGS },
  themeSettings: structuredClone(DEFAULT_THEME_SETTINGS),
  displayMode: DEFAULT_DISPLAY_MODE,
  tabNotes: {},
  activeTagFilter: null,
};

const tabListEl = document.getElementById('tab-list');
const appShellEl = document.getElementById('app-shell');
const tabPanelEl = document.querySelector('.tab-panel');
const footerEl = document.querySelector('.footer');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('btn-clear-search');
const tabCountEl = document.getElementById('tab-count');
const contextMenuEl = document.getElementById('context-menu');
const settingsBtnEl = document.getElementById('btn-settings');
const newTabRowEl = document.getElementById('btn-new-tab-row');
const searchBoxEl = document.querySelector('.search-box');
const footerToolbarEl = document.querySelector('.footer-toolbar');
const appHeaderEl = document.getElementById('app-header');

let clickTimer = null;
let lastClickedTabId = null;
let backgroundImageResizeObserver = null;

function setupBackgroundImageResizeObserver() {
  const target = tabPanelEl || appShellEl;
  if (!target || backgroundImageResizeObserver) return;

  backgroundImageResizeObserver = new ResizeObserver(() => {
    if (state.themeSettings.backgroundImage) {
      applyTabPanelBackground(target);
    }
  });
  backgroundImageResizeObserver.observe(target);
}

async function init() {
  await loadCollapsedGroups();
  await loadThemeSettings();
  await loadAppearanceSettings();
  await loadTabSettings();
  await loadTabNotes();
  await loadDisplaySettings();
  applyTabLayoutSettings();
  applyToolbarVisibility();
  bindEvents();
  setupBackgroundImageResizeObserver();
  await refresh();
  setupListeners();
}

function createNewTab() {
  chrome.tabs.create({ active: true, windowId: state.currentWindowId ?? undefined });
}

function bindEvents() {
  document.getElementById('btn-new-tab').addEventListener('click', createNewTab);
  document.getElementById('btn-new-tab-row').addEventListener('click', createNewTab);
  document.getElementById('new-tab-shortcut').textContent =
    navigator.platform.includes('Mac') ? '⌘T' : 'Ctrl+T';

  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    const allCollapsed = state.groups.every((g) => state.collapsedGroups.has(g.id));
    if (allCollapsed) {
      state.collapsedGroups.clear();
    } else {
      state.groups.forEach((g) => state.collapsedGroups.add(g.id));
    }
    saveCollapsedGroups();
    render();
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    render();
    searchInput.focus();
  });

  tabListEl.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.tab-item, .group-header, .group-editor, .context-menu')) return;
    e.preventDefault();
    showPanelContextMenu(e.clientX, e.clientY);
  });

  bindDropZones();

  settingsBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettingsInNewTab();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.themeSettings.mode === 'system') {
      applyThemeSettings();
    }
  });

  document.addEventListener('click', (e) => {
    hideContextMenu();
    if (state.groupEditor && !e.target.closest('.group-editor')) {
      closeGroupEditor();
    }
    if (!e.target.closest('#tag-filter-container')) {
      document.getElementById('tag-filter-dropdown')?.classList.add('hidden');
    }
    if (state.activeTagFilter && !e.target.closest('.tab-item') && !e.target.closest('#tag-filter-container')) {
      state.activeTagFilter = null;
      render();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
      closeGroupEditor();
      document.getElementById('tag-filter-dropdown')?.classList.add('hidden');
      if (state.activeTagFilter) {
        state.activeTagFilter = null;
        render();
      }
    }
  });

  const tagFilterToggle = document.getElementById('btn-tag-filter-toggle');
  const tagFilterDropdown = document.getElementById('tag-filter-dropdown');
  const tagFilterList = document.getElementById('tag-filter-list');

  tagFilterToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.tabSettings.enableTabTags) return;
    tagFilterDropdown.classList.toggle('hidden');
    if (!tagFilterDropdown.classList.contains('hidden')) {
      renderTagFilterDropdown();
    }
  });

  tagFilterList?.addEventListener('click', (e) => {
    const item = e.target.closest('.tag-filter-item');
    if (!item) return;
    const tag = item.dataset.tag;
    if (tag === state.activeTagFilter) {
      state.activeTagFilter = null;
    } else {
      state.activeTagFilter = tag;
    }
    tagFilterDropdown.classList.add('hidden');
    render();
  });
}

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

function getThemeColorValue(key) {
  return getStoredThemeColorValue(state.themeSettings, key);
}

async function loadThemeSettings() {
  const { themeSettings = {} } = await chrome.storage.local.get('themeSettings');
  state.themeSettings = normalizeThemeSettings({ ...DEFAULT_THEME_SETTINGS, ...themeSettings });
  applyThemeSettings();
}

function applyThemeColorVars(target, key) {
  const def = THEME_COLOR_DEFS[key];
  if (!def) return;

  if (key === 'menuTextColor') {
    const scheme = getActiveColorScheme();
    const preset = THEME_PRESETS[scheme];
    const custom = state.themeSettings.schemeColors?.[scheme]?.menuTextColor;
    target.style.setProperty('--text', custom || preset.menuTextColor);
    target.style.setProperty('--text-secondary', preset.menuTextSecondary);
    return;
  }

  const value = getThemeColorValue(key);
  def.cssVars.forEach((cssVar) => {
    target.style.setProperty(cssVar, value);
  });
}

function applyTabPanelBackground(target = tabPanelEl || appShellEl) {
  applyBackgroundImageToElement(
    target,
    state.themeSettings.backgroundImage,
    {
      focal: state.themeSettings.backgroundImageFocal,
      scale: state.themeSettings.backgroundImageScale,
    },
    state.themeSettings.backgroundImageMeta,
  );
}

function applyFooterTheme() {
  if (!footerEl) return;

  const scheme = getActiveColorScheme();
  const preset = THEME_PRESETS[scheme];
  const bg = getTabBarBackground();
  footerEl.style.backgroundColor = bg;
  footerEl.style.setProperty('--bg', bg);
  footerEl.style.setProperty('--bg-elevated', bg);
  footerEl.style.setProperty('--text', getMenuTextColor());
  footerEl.style.setProperty('--text-secondary', preset.menuTextSecondary);
  footerEl.style.setProperty('--border', preset.border);
  footerEl.style.setProperty('--bg-hover', getThemeColorValue('tabHoverBg'));
  footerEl.style.setProperty('--bg-active', getThemeColorValue('tabActiveBg'));
  footerEl.style.setProperty('--accent', preset.accent);
}

function applyThemeVarsToElement(target, scheme, { paintBackground = true } = {}) {
  if (!target) return;

  target.setAttribute('data-color-scheme', scheme);
  target.style.colorScheme = scheme;

  const preset = THEME_PRESETS[scheme];

  Object.entries(THEME_STATIC_VARS).forEach(([key, cssVar]) => {
    target.style.setProperty(cssVar, preset[key]);
  });

  Object.keys(THEME_COLOR_DEFS).forEach((key) => {
    if (key === 'settingsBackground') return;
    applyThemeColorVars(target, key);
  });

  const tabBarBg = getTabBarBackground();
  target.style.setProperty('--bg', tabBarBg);
  target.style.setProperty('--bg-elevated', tabBarBg);
  if (paintBackground) {
    target.style.backgroundColor = tabBarBg;
  }
}

function applyThemeSettings() {
  const scheme = getActiveColorScheme();
  const targets = [appShellEl, document.documentElement, document.body];

  targets.forEach((target, index) => {
    applyThemeVarsToElement(target, scheme, { paintBackground: index === 0 });
  });

  if (tabPanelEl || appShellEl) applyTabPanelBackground();
  applyFooterTheme();
  applyAppearanceSettings();
}

function getMenuTextColor() {
  return getThemeMenuTextColor(state.themeSettings);
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

async function loadAppearanceSettings() {
  const { appearanceSettings = {} } = await chrome.storage.local.get('appearanceSettings');
  state.appearance = normalizeAppearance({ ...DEFAULT_APPEARANCE, ...appearanceSettings });
  applyAppearanceSettings();
}

function applyAppearanceSettings() {
  const { appearance } = state;
  const target = appShellEl;
  if (!target) return;

  const scheme = getActiveColorScheme();
  const customTabColor = getCustomTabColorForScheme(appearance, scheme);

  target.style.setProperty('--tab-title-font-family', FONT_OPTIONS[appearance.tabFontFamily] || FONT_OPTIONS.system);
  target.style.setProperty('--tab-title-font-size', `${appearance.tabFontSize}px`);
  if (customTabColor) {
    target.style.setProperty('--tab-title-color', customTabColor);
  } else {
    target.style.removeProperty('--tab-title-color');
  }
  target.style.setProperty('--group-title-font-family', FONT_OPTIONS[appearance.groupFontFamily] || FONT_OPTIONS.system);
  target.style.setProperty('--group-title-font-size', `${appearance.groupFontSize}px`);
  target.style.setProperty('--group-title-color', normalizeHexColor(appearance.groupColor));
  target.style.setProperty('--tab-height', `${Math.max(32, appearance.tabFontSize + 20)}px`);
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

function clearSearchIfHidden() {
  if (!state.tabSettings.showSearchBox && state.searchQuery) {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    render();
  }
}

function applyToolbarVisibility() {
  const { tabSettings } = state;

  appHeaderEl?.classList.toggle('hidden', !tabSettings.showHeader);
  newTabRowEl?.classList.toggle('hidden', !tabSettings.showNewTabRow);
  searchBoxEl?.classList.toggle('hidden', !tabSettings.showSearchBox);
  settingsBtnEl?.classList.toggle('hidden', !tabSettings.showSettingsButton);

  const tagFilterContainer = document.getElementById('tag-filter-container');
  if (tagFilterContainer) {
    tagFilterContainer.classList.toggle('hidden', !tabSettings.enableTabTags);
  }
  if (!tabSettings.enableTabTags) {
    state.activeTagFilter = null;
  }

  if (footerToolbarEl) {
    const hideToolbar = !tabSettings.showSearchBox && !tabSettings.showSettingsButton;
    footerToolbarEl.classList.toggle('hidden', hideToolbar);
  }

  clearSearchIfHidden();
}

function applyTabLayoutSettings() {
  const target = appShellEl;
  if (!target) return;

  const spacing = getTabSpacingCssVars(state.tabSettings.tabSpacing);
  target.style.setProperty('--tab-spacing', spacing.tabSpacing);
  target.style.setProperty('--tab-list-padding', spacing.listPadding);
  
  // 拖拽指示器设置
  const { tabSettings } = state;
  target.style.setProperty('--drag-indicator-width', `${tabSettings.dragIndicatorWidth}px`);
  target.style.setProperty('--drag-indicator-color', tabSettings.dragIndicatorColor || 'var(--accent)');
  target.style.setProperty('--drag-group-outline-width', `${tabSettings.dragGroupOutlineWidth}px`);
  target.style.setProperty('--drag-group-outline-color', tabSettings.dragGroupOutlineColor || 'var(--accent)');
}

async function loadTabSettings() {
  const { tabSettings = {} } = await chrome.storage.local.get('tabSettings');
  state.tabSettings = normalizeTabSettings({ ...DEFAULT_TAB_SETTINGS, ...tabSettings });
}

async function loadTabNotes() {
  const { tabNotes = {} } = await chrome.storage.local.get('tabNotes');
  state.tabNotes = tabNotes || {};
}

async function loadDisplaySettings() {
  const { displayMode } = await chrome.storage.local.get('displayMode');
  if (DISPLAY_MODES.includes(displayMode)) {
    state.displayMode = displayMode;
  }
}

function isDetailedDisplay() {
  return shouldShowTabUrlLine();
}

function getTabDomain(url) {
  if (!url) return '未知站点';
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return '本地页面';
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '本地页面';
  }
}

function getDisplayUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:') {
      return parsed.href;
    }
    const path = `${parsed.pathname}${parsed.search}`;
    return path && path !== '/' ? `${parsed.hostname}${path}` : parsed.hostname;
  } catch {
    return url;
  }
}

function getFullUrl(url) {
  if (!url) return '';
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

function shouldShowTabUrlLine() {
  return state.tabSettings.showFullUrl || state.displayMode === 'detailed';
}

function getTabUrlForDisplay(url) {
  if (state.tabSettings.showFullUrl) return getFullUrl(url);
  if (state.displayMode === 'detailed') return getDisplayUrl(url);
  return '';
}

function getDomainGroupColor(domain) {
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GROUP_COLOR_KEYS[Math.abs(hash) % GROUP_COLOR_KEYS.length];
}

function setupListeners() {
  const events = [
    'onCreated',
    'onUpdated',
    'onRemoved',
    'onActivated',
    'onMoved',
    'onAttached',
    'onDetached',
    'onReplaced',
  ];

  events.forEach((event) => {
    chrome.tabs[event].addListener(() => {
      if (state.dragLock) return;
      refresh();
    });
  });

  chrome.tabGroups.onCreated.addListener(() => {
    if (state.dragLock) return;
    refresh();
  });
  chrome.tabGroups.onUpdated.addListener(() => {
    if (state.dragLock) return;
    refresh();
  });
  chrome.tabGroups.onRemoved.addListener(() => {
    if (state.dragLock) return;
    refresh();
  });
  chrome.tabGroups.onMoved.addListener(() => {
    if (state.dragLock) return;
    refresh();
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
      refresh();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.themeSettings) {
      state.themeSettings = normalizeThemeSettings(
        changes.themeSettings.newValue ?? DEFAULT_THEME_SETTINGS,
      );
      applyThemeSettings();
      if (!state.dragLock) render();
    }

    if (changes.appearanceSettings) {
      state.appearance = normalizeAppearance({
        ...DEFAULT_APPEARANCE,
        ...(changes.appearanceSettings.newValue ?? {}),
      });
      applyAppearanceSettings();
      if (!state.dragLock) render();
    }

    if (changes.tabSettings) {
      state.tabSettings = normalizeTabSettings({
        ...DEFAULT_TAB_SETTINGS,
        ...(changes.tabSettings.newValue ?? {}),
      });
      applyTabLayoutSettings();
      applyToolbarVisibility();
      if (!state.dragLock) render();
    }

    if (changes.tabNotes) {
      state.tabNotes = changes.tabNotes.newValue || {};
      if (!state.dragLock) render();
    }

    if (changes.displayMode) {
      const mode = changes.displayMode.newValue;
      if (DISPLAY_MODES.includes(mode)) {
        state.displayMode = mode;
        if (!state.dragLock) render();
      }
    }
  });
}

async function refresh() {
  const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.currentWindowId = currentTab?.windowId ?? null;

  const query = state.currentWindowId
    ? { windowId: state.currentWindowId }
    : { currentWindow: true };

  const [tabs, groups] = await Promise.all([
    chrome.tabs.query(query),
    chrome.tabGroups.query({ windowId: state.currentWindowId ?? undefined }),
  ]);

  state.tabs = tabs.sort((a, b) => a.index - b.index);
  state.groups = sortGroupsByTabOrder(groups, tabs);

  // 清理已关闭标签页的标签/备注数据（异步，不阻塞渲染）
  cleanupClosedTabNotes();

  render();
}

async function cleanupClosedTabNotes() {
  try {
    const allTabs = await chrome.tabs.query({});
    const activeTabIds = allTabs.map((t) => t.id);
    await cleanupTabNotes(activeTabIds);
    const { tabNotes = {} } = await chrome.storage.local.get('tabNotes');
    if (JSON.stringify(tabNotes) !== JSON.stringify(state.tabNotes)) {
      state.tabNotes = tabNotes;
    }
  } catch (e) {
    console.error('清理已关闭标签页数据失败', e);
  }
}

function sortGroupsByTabOrder(groups, tabs) {
  return [...groups].sort((a, b) => {
    const aFirst = getGroupFirstIndex(a.id, tabs);
    const bFirst = getGroupFirstIndex(b.id, tabs);
    return aFirst - bFirst;
  });
}

function getGroupById(groupId) {
  return state.groups.find((g) => g.id === groupId);
}

function getGroupTabs(groupId) {
  return state.tabs.filter((t) => t.groupId === groupId && !t.pinned).sort((a, b) => a.index - b.index);
}

function getGroupFirstIndex(groupId, tabs = state.tabs) {
  const groupTabs = tabs.filter((t) => t.groupId === groupId && !t.pinned);
  if (!groupTabs.length) return Infinity;
  return Math.min(...groupTabs.map((t) => t.index));
}

function buildMixedSegments(unpinned) {
  const segments = [];
  let currentGroup = null;

  for (const tab of unpinned) {
    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      currentGroup = null;
      segments.push({ type: 'tab', tab });
    } else if (!currentGroup || currentGroup.id !== tab.groupId) {
      currentGroup = { type: 'group', id: tab.groupId, tabs: [tab] };
      segments.push(currentGroup);
    } else {
      currentGroup.tabs.push(tab);
    }
  }

  return segments;
}

function buildListSegments(unpinned) {
  return unpinned.map((tab) => ({ type: 'tab', tab }));
}

function buildGroupsLayoutSegments(unpinned) {
  const segments = [];

  state.groups.forEach((group) => {
    const tabs = unpinned.filter((t) => t.groupId === group.id);
    if (tabs.length > 0) {
      segments.push({ type: 'group', id: group.id, tabs });
    }
  });

  const ungrouped = unpinned.filter((t) => t.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE);
  if (ungrouped.length > 0) {
    segments.push({
      type: 'virtual-group',
      key: 'ungrouped',
      title: '未分组',
      color: 'grey',
      tabs: ungrouped,
    });
  }

  return segments;
}

function buildSiteSegments(unpinned) {
  const domainMap = new Map();
  const domainOrder = [];

  unpinned.forEach((tab) => {
    const domain = getTabDomain(tab.url);
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
      domainOrder.push(domain);
    }
    domainMap.get(domain).push(tab);
  });

  return domainOrder.map((domain) => ({
    type: 'virtual-group',
    key: `site:${domain}`,
    title: domain,
    color: getDomainGroupColor(domain),
    tabs: domainMap.get(domain),
  }));
}

function buildTagSegments(unpinned) {
  if (!state.tabSettings.enableTabTags) {
    return buildMixedSegments(unpinned);
  }

  const tagMap = new Map();
  const tagOrder = [];
  const untaggedTabs = [];

  unpinned.forEach((tab) => {
    const tabNote = state.tabNotes[tab.id] || { tags: [], note: '' };
    if (tabNote.tags && tabNote.tags.length > 0) {
      for (const tag of tabNote.tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
          tagOrder.push(tag);
        }
        tagMap.get(tag).push(tab);
      }
    } else {
      untaggedTabs.push(tab);
    }
  });

  const segments = tagOrder.map((tag) => ({
    type: 'virtual-group',
    key: `tag:${tag}`,
    title: tag,
    color: 'blue',
    tabs: [...new Set(tagMap.get(tag))],
  }));

  if (untaggedTabs.length > 0) {
    segments.push({
      type: 'virtual-group',
      key: 'untagged',
      title: '未标记',
      color: 'grey',
      tabs: untaggedTabs,
    });
  }

  return segments;
}

function buildRenderSegments() {
  const unpinned = state.tabs.filter((t) => !t.pinned).sort((a, b) => a.index - b.index);

  switch (state.displayMode) {
    case 'list':
      return buildListSegments(unpinned);
    case 'groups':
      return buildGroupsLayoutSegments(unpinned);
    case 'site':
      return buildSiteSegments(unpinned);
    case 'tags':
      return buildTagSegments(unpinned);
    case 'detailed':
    case 'mixed':
    default:
      return buildMixedSegments(unpinned);
  }
}

function isDragEnabled() {
  return !state.searchQuery;
}


function clearDragIndicators() {
  tabListEl.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-into, .drag-over-group').forEach((n) => {
    n.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-into', 'drag-over-group');
  });
}

/**
 * 三区域拖放判断：
 * - 上方 30%：插入到该标签页前面（排序）
 * - 中间 40%：拖到一起创建分组
 * - 下方 30%：插入到该标签页后面（排序）
 * @returns {'before'|'group'|'after'}
 */
function getDropZone(e, el) {
  const rect = el.getBoundingClientRect();
  const ratio = (e.clientY - rect.top) / rect.height;
  if (ratio < 0.3) return 'before';
  if (ratio > 0.7) return 'after';
  return 'group';
}

function setDropIndicator(el, zone) {
  el.classList.toggle('drag-over-top', zone === 'before');
  el.classList.toggle('drag-over-bottom', zone === 'after');
  el.classList.toggle('drag-over-group', zone === 'group');
  el.classList.toggle('drag-over-into', zone === 'into');
}

async function moveTabToIndex(tabId, newIndex, groupId = chrome.tabGroups.TAB_GROUP_ID_NONE) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  let index = newIndex;
  if (tab.index < index) index -= 1;

  await chrome.tabs.move(tabId, { index, windowId: tab.windowId });

  if (groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    await chrome.tabs.group({ tabIds: tabId, groupId });
  } else if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
    await chrome.tabs.ungroup(tabId);
  }
}

function getGroupLastIndex(groupId, fallbackIndex) {
  const groupTabs = getGroupTabs(groupId);
  return groupTabs[groupTabs.length - 1]?.index ?? fallbackIndex;
}

async function moveTabRelativeToTab(sourceId, targetTabId, insertBefore, wantsGroup) {
  const sourceTab = state.tabs.find((t) => t.id === sourceId);
  const targetTab = state.tabs.find((t) => t.id === targetTabId);
  if (!sourceTab || !targetTab || sourceId === targetTabId) return;

  let newIndex = insertBefore ? targetTab.index : targetTab.index + 1;

  if (!wantsGroup) {
    await moveTabToIndex(sourceId, newIndex, targetTab.groupId);
    return;
  }

  const sourceInGroup = sourceTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE;
  const targetInGroup = targetTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE;

  if (!sourceInGroup && !targetInGroup) {
    await chrome.tabs.move([sourceId, targetTabId], { index: newIndex, windowId: sourceTab.windowId });
    try {
      await chrome.tabs.group({ tabIds: [sourceId, targetTabId] });
    } catch (err) {
      console.error('[VerticalTabs] 创建分组失败:', err);
    }
  } else if (targetInGroup) {
    // 目标在分组中 → 源加入目标的分组，放到分组末尾
    newIndex = getGroupLastIndex(targetTab.groupId, targetTab.index) + 1;
    await moveTabToIndex(sourceId, newIndex, targetTab.groupId);
  } else {
    // 源在分组中、目标不在 → 目标加入源的分组，放到分组末尾
    newIndex = getGroupLastIndex(sourceTab.groupId, sourceTab.index) + 1;
    await moveTabToIndex(targetTabId, newIndex, sourceTab.groupId);
  }
}

async function moveTabIntoGroup(tabId, groupId, atStart) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  let newIndex;
  if (atStart) {
    newIndex = getGroupFirstIndex(groupId);
    if (!Number.isFinite(newIndex)) newIndex = state.tabs.filter((t) => !t.pinned).length;
  } else {
    newIndex = getGroupLastIndex(groupId, state.tabs.filter((t) => !t.pinned).length) + 1;
  }

  await moveTabToIndex(tabId, newIndex, groupId);
}

async function moveGroupTabsToIndex(sourceGroupId, targetIndex) {
  const sourceTabs = getGroupTabs(sourceGroupId);
  if (!sourceTabs.length) return;

  let index = targetIndex;
  const firstSourceIndex = sourceTabs[0].index;
  if (firstSourceIndex < index) {
    index -= sourceTabs.length;
  }

  const tabIds = sourceTabs.map((t) => t.id);
  await chrome.tabs.move(tabIds, { index, windowId: sourceTabs[0].windowId });

  try {
    await chrome.tabs.group({ tabIds, groupId: sourceGroupId });
  } catch {
    // 分组可能已被 Chrome 保留，忽略重复归组错误
  }
}

async function moveGroupBlock(sourceGroupId, targetGroupId, insertBefore) {
  if (sourceGroupId === targetGroupId) return;

  const sourceTabs = getGroupTabs(sourceGroupId);
  const targetTabs = getGroupTabs(targetGroupId);
  if (!sourceTabs.length || !targetTabs.length) return;

  const targetIndex = insertBefore
    ? targetTabs[0].index
    : targetTabs[targetTabs.length - 1].index + 1;

  await moveGroupTabsToIndex(sourceGroupId, targetIndex);
}

async function moveTabIntoVirtualSegment(tabId, segment, atStart) {
  if (!segment?.tabs?.length) {
    const unpinned = state.tabs.filter((t) => !t.pinned);
    const lastIndex = unpinned.length ? unpinned[unpinned.length - 1].index + 1 : state.tabs.length;
    await moveTabToIndex(tabId, lastIndex, chrome.tabGroups.TAB_GROUP_ID_NONE);
    return;
  }

  const newIndex = atStart
    ? segment.tabs[0].index
    : segment.tabs[segment.tabs.length - 1].index + 1;
  await moveTabToIndex(tabId, newIndex, chrome.tabGroups.TAB_GROUP_ID_NONE);
}

function findVirtualSegmentByKey(key) {
  return buildRenderSegments().find((segment) => segment.type === 'virtual-group' && segment.key === key);
}

function canDragChromeGroups() {
  return ['mixed', 'groups', 'detailed'].includes(state.displayMode);
}

async function moveGroupRelativeToTab(sourceGroupId, targetTabId, insertBefore) {
  const sourceTabs = getGroupTabs(sourceGroupId);
  let targetTab = state.tabs.find((t) => t.id === targetTabId);
  if (!sourceTabs.length || !targetTab || targetTab.pinned) return;

  if (sourceTabs.some((t) => t.id === targetTabId)) return;

  if (targetTab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && targetTab.groupId !== sourceGroupId) {
    const targetGroupTabs = getGroupTabs(targetTab.groupId);
    if (!targetGroupTabs.length) return;
    targetTab = insertBefore ? targetGroupTabs[0] : targetGroupTabs[targetGroupTabs.length - 1];
  }

  const targetIndex = insertBefore ? targetTab.index : targetTab.index + 1;
  await moveGroupTabsToIndex(sourceGroupId, targetIndex);
}

async function loadCollapsedGroups() {
  const { collapsedGroups = [], collapsedVirtual = [] } = await chrome.storage.local.get([
    'collapsedGroups',
    'collapsedVirtual',
  ]);
  state.collapsedGroups = new Set(collapsedGroups);
  state.collapsedVirtual = new Set(collapsedVirtual);
}

async function saveCollapsedGroups() {
  await chrome.storage.local.set({ collapsedGroups: [...state.collapsedGroups] });
}

async function saveCollapsedVirtual() {
  await chrome.storage.local.set({ collapsedVirtual: [...state.collapsedVirtual] });
}

function openGroupEditor(mode, groupId = null) {
  if (mode === 'edit' && groupId) {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return;
    state.groupEditor = {
      mode: 'edit',
      groupId,
      title: group.title || '',
      color: group.color || 'grey',
    };
  } else {
    state.groupEditor = {
      mode: 'create',
      groupId: null,
      title: '',
      color: 'purple',
    };
  }
  render();
  const input = tabListEl.querySelector('.group-editor-input');
  input?.focus();
}

function closeGroupEditor() {
  if (!state.groupEditor) return;
  state.groupEditor = null;
  render();
}

async function confirmGroupEditor() {
  const editor = state.groupEditor;
  if (!editor) return;

  const title = editor.title.trim() || '新分组';
  const color = GROUP_COLOR_KEYS.includes(editor.color) ? editor.color : 'grey';

  if (editor.mode === 'create') {
    await createNewGroup(title, color);
  } else if (editor.groupId) {
    await chrome.tabGroups.update(editor.groupId, { title, color });
  }

  state.groupEditor = null;
  await refresh();
}

async function createNewGroup(title, color) {
  const tab = await chrome.tabs.create({
    active: true,
    windowId: state.currentWindowId ?? undefined,
  });
  const groupId = await chrome.tabs.group({ tabIds: tab.id });
  await chrome.tabGroups.update(groupId, { title, color });
}

async function addTabToGroup(groupId) {
  const tab = await chrome.tabs.create({
    active: true,
    windowId: state.currentWindowId ?? undefined,
  });
  await chrome.tabs.group({ tabIds: tab.id, groupId });
}

function highlightTitle(title, query) {
  if (!query) return escapeHtml(title);
  const lower = title.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return escapeHtml(title);
  const before = escapeHtml(title.slice(0, idx));
  const match = escapeHtml(title.slice(idx, idx + query.length));
  const after = escapeHtml(title.slice(idx + query.length));
  return `${before}<mark>${match}</mark>${after}`;
}

function matchesSearch(tab) {
  if (!state.searchQuery && !state.activeTagFilter) return true;
  
  const tabNote = state.tabNotes[tab.id] || { tags: [] };
  
  if (state.activeTagFilter) {
    if (!tabNote.tags || !tabNote.tags.includes(state.activeTagFilter)) {
      return false;
    }
  }
  
  if (!state.searchQuery) return true;
  
  const query = state.searchQuery.toLowerCase();

  const title = String(tab.title || '').toLowerCase();
  const url = String(tab.url || '').toLowerCase();

  const matchesTitle = title.includes(query);
  const matchesUrl = url.includes(query);

  let matchesTags = false;
  if (state.tabSettings.enableTabTags && tabNote.tags) {
    matchesTags = tabNote.tags.some(tag => tag.toLowerCase().includes(query));
  }
  
  return matchesTitle || matchesUrl || matchesTags;
}

function renderTagFilterDropdown() {
  const tagFilterList = document.getElementById('tag-filter-list');
  if (!tagFilterList) return;
  
  const tagCounts = {};
  for (const tab of state.tabs) {
    const tabNote = state.tabNotes[tab.id] || { tags: [], note: '' };
    if (tabNote.tags) {
      for (const tag of tabNote.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }
  
  const tags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);
  
  if (tags.length === 0) {
    tagFilterList.innerHTML = '<div class="tag-filter-empty">暂无标签</div>';
    return;
  }
  
  tagFilterList.innerHTML = tags.map(tag => `
    <div class="tag-filter-item ${state.activeTagFilter === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">
      <span class="tag-filter-item-tag">${escapeHtml(tag)}</span>
      <span class="tag-filter-item-count">${tagCounts[tag]}</span>
    </div>
  `).join('');
}

function getFaviconUrl(tab) {
  if (tab.favIconUrl) return tab.favIconUrl;
  return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=32`;
}

function renderGroupEditor() {
  const editor = state.groupEditor;
  if (!editor) return '';

  const swatches = GROUP_COLOR_KEYS.map((key) => {
    const selected = editor.color === key ? ' selected' : '';
    return `<button type="button" class="color-swatch${selected}" data-color="${key}" style="background:${GROUP_COLORS[key]}" aria-label="${key}"></button>`;
  }).join('');

  const heading = editor.mode === 'create' ? '新建分组' : '编辑分组';

  return `
    <div class="group-editor" data-editor-mode="${editor.mode}" ${editor.groupId ? `data-group-id="${editor.groupId}"` : ''}>
      <div class="group-editor-heading">${heading}</div>
      <input class="group-editor-input" type="text" placeholder="分组名称" value="${escapeHtml(editor.title)}" maxlength="64" />
      <div class="color-picker">${swatches}</div>
      <div class="group-editor-actions">
        <button type="button" class="group-editor-btn cancel" data-action="cancel">取消</button>
        <button type="button" class="group-editor-btn confirm" data-action="confirm">确定</button>
      </div>
    </div>`;
}

function renderGroupHeader(group, collapsed, tabCount) {
  const color = GROUP_COLORS[group.color] || GROUP_COLORS.grey;
  const isEditing = state.groupEditor?.mode === 'edit' && state.groupEditor.groupId === group.id;

  if (isEditing) {
    return `
      <div class="group-block" data-group-id="${group.id}" style="--group-color:${color}">
        <div class="group-header editing" data-group-id="${group.id}">
          ${renderGroupEditor()}
        </div>
        <div class="group-children ${collapsed ? 'collapsed' : ''}" data-group-id="${group.id}">`;
  }

  return `
    <div class="group-block" data-group-id="${group.id}" style="--group-color:${color}">
      <div class="group-header ${collapsed ? 'collapsed' : ''} ${isDragEnabled() ? 'draggable-group' : ''}" data-group-id="${group.id}" ${isDragEnabled() ? 'draggable="true"' : ''}>
        <button type="button" class="group-badge" style="background:${color}" data-action="toggle" title="折叠/展开">
          <span class="group-chevron">${ICONS.chevron}</span>
          <span class="group-title">${escapeHtml(group.title || '未命名分组')}</span>
          <span class="group-count">${tabCount}</span>
        </button>
        <div class="group-actions">
          <button type="button" class="group-action-btn" data-action="add-tab" title="在此分组新建标签页" aria-label="新建标签页">${ICONS.plus}</button>
          <button type="button" class="group-action-btn" data-action="edit" title="编辑分组" aria-label="编辑分组">${ICONS.edit}</button>
        </div>
      </div>
      <div class="group-children ${collapsed ? 'collapsed' : ''}" data-group-id="${group.id}">`;
}

function renderVirtualGroupHeader(segment, collapsed) {
  const color = GROUP_COLORS[segment.color] || GROUP_COLORS.grey;
  const key = segment.key;

  return `
    <div class="group-block virtual-group" data-virtual-key="${escapeHtml(key)}" style="--group-color:${color}">
      <div class="group-header virtual ${collapsed ? 'collapsed' : ''}" data-virtual-key="${escapeHtml(key)}">
        <button type="button" class="group-badge" style="background:${color}" data-action="toggle" title="折叠/展开">
          <span class="group-chevron">${ICONS.chevron}</span>
          <span class="group-title">${escapeHtml(segment.title)}</span>
          <span class="group-count">${segment.tabs.length}</span>
        </button>
      </div>
      <div class="group-children ${collapsed ? 'collapsed' : ''}" data-virtual-key="${escapeHtml(key)}">`;
}

function renderSegment(segment, activeTab) {
  if (segment.type === 'tab') {
    return renderTabItem(segment.tab, activeTab);
  }

  const visibleInSegment = segment.tabs.filter(matchesSearch).length;
  const hiddenBySearch = (state.searchQuery || state.activeTagFilter) && visibleInSegment === 0;
  if (hiddenBySearch) return '';

  if (state.activeTagFilter) {
    return segment.tabs.filter(matchesSearch).map((tab) => renderTabItem(tab, activeTab)).join('');
  }

  if (segment.type === 'virtual-group') {
    const collapsed = state.collapsedVirtual.has(segment.key);
    let html = renderVirtualGroupHeader(segment, collapsed);
    html += segment.tabs.map((tab) => renderTabItem(tab, activeTab)).join('');
    html += '</div></div>';
    return html;
  }

  const group = getGroupById(segment.id);
  if (!group) return '';

  const collapsed = state.collapsedGroups.has(group.id);
  let html = renderGroupHeader(group, collapsed, segment.tabs.length);
  html += segment.tabs.map((tab) => renderTabItem(tab, activeTab)).join('');
  html += '</div></div>';
  return html;
}

function render() {
  const pinned = state.tabs.filter((t) => t.pinned);
  const activeTab = state.tabs.find((t) => t.active);
  const segments = buildRenderSegments();
  const visibleCount = state.tabs.filter(matchesSearch).length;
  const visiblePinned = pinned.filter(matchesSearch);

  tabCountEl.textContent = state.searchQuery
    ? `找到 ${visibleCount} / ${state.tabs.length} 个标签页`
    : `共 ${state.tabs.length} 个标签页`;

  if (state.tabs.length === 0 && !state.groupEditor) {
    tabListEl.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path fill="currentColor" d="M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H5V8h14v10z"/>
        </svg>
        <p>暂无标签页</p>
        <p class="empty-hint">右键可新建标签页或分组</p>
      </div>`;
    return;
  }

  let html = '';

  if (pinned.length > 0 && (!state.searchQuery || visiblePinned.length > 0)) {
    html += `<div class="section-label">已固定</div>`;
    html += pinned.map((tab) => renderTabItem(tab, activeTab)).join('');
  }

  if (state.groupEditor?.mode === 'create' && ['mixed', 'groups', 'detailed'].includes(state.displayMode)) {
    html += renderGroupEditor();
  }

  segments.forEach((segment) => {
    html += renderSegment(segment, activeTab);
  });

  tabListEl.innerHTML = html;
  bindTabEvents();
  bindGroupEvents();
  bindGroupEditorEvents();
}

function renderTabItem(tab, activeTab) {
  const isActive = activeTab?.id === tab.id;
  const isMatch = matchesSearch(tab);
  const detailed = isDetailedDisplay();
  const { tabSettings } = state;
  const audibleIcon = tab.audible && !tab.mutedInfo?.muted
    ? `<svg class="tab-audible" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`
    : '';

  const tabNote = state.tabNotes[tab.id] || { tags: [], note: '' };
  
  let tagsHtml = '';
  if (tabSettings.enableTabTags && tabNote.tags && tabNote.tags.length > 0) {
    tagsHtml = `<div class="tab-tags">${tabNote.tags.map(tag => `<span class="tab-tag">${escapeHtml(tag)}</span>`).join('')}</div>`;
  }

  const urlText = detailed ? getTabUrlForDisplay(tab.url) : '';
  const titleHtml = detailed
    ? `<div class="tab-text">
         <span class="tab-title">${highlightTitle(tab.title || tab.url, state.searchQuery)}</span>
         <span class="tab-url">${highlightTitle(urlText, state.searchQuery)}</span>
       </div>`
    : `<span class="tab-title">${highlightTitle(tab.title || tab.url, state.searchQuery)}</span>`;

  const indexLabel = tabSettings.showTabIndex ? `<span class="tab-index">${tab.index + 1}</span>` : '';
  let iconHtml = '';
  if (!tabSettings.hideTabIcons) {
    if (tabSettings.coloredDotsInsteadOfIcons) {
      const dotColor = GROUP_COLORS[getDomainGroupColor(getTabDomain(tab.url))] || GROUP_COLORS.grey;
      iconHtml = `<span class="tab-favicon-dot" style="background:${dotColor}"></span>`;
    } else {
      iconHtml = `<img class="tab-favicon" src="${getFaviconUrl(tab)}" alt="" onerror="this.classList.add('placeholder');this.removeAttribute('src')" />`;
    }
  }

  const indexLeft = tabSettings.showTabIndex && tabSettings.tabIndexPosition === 'left' ? indexLabel : '';
  const indexRight = tabSettings.showTabIndex && tabSettings.tabIndexPosition === 'right' ? indexLabel : '';

  const tooltipText = escapeHtml(tab.title);

  const layoutClasses = [
    detailed ? 'detailed' : '',
    isActive ? 'active' : '',
    tab.pinned ? 'pinned' : '',
    isMatch ? '' : 'hidden-by-search',
    tabSettings.hideTabIcons ? 'no-icon' : '',
    tabSettings.showTabIndex ? `index-${tabSettings.tabIndexPosition}` : '',
    tabSettings.enableTabTags && tabNote.tags && tabNote.tags.length > 0 ? 'has-tags' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="tab-item ${layoutClasses}"
         data-tab-id="${tab.id}" ${isDragEnabled() ? 'draggable="true"' : ''} title="${tooltipText}">
      ${indexLeft}
      ${iconHtml}
      ${indexRight}
      ${titleHtml}
      ${tagsHtml}
      ${audibleIcon}
      ${tabSettings.enableTabTags ? `<button class="tab-edit" data-action="edit" aria-label="编辑标签">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.19-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>
      </button>` : ''}
      <button class="tab-close" data-action="close" aria-label="关闭">×</button>
    </div>`;
}

function bindTabEvents() {
  tabListEl.querySelectorAll('.tab-item').forEach((el) => {
    const tabId = Number(el.dataset.tabId);

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) return;
      handleTabClick(tabId, e);
    });

    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      clearTimeout(clickTimer);
      clickTimer = null;
      chrome.tabs.remove(tabId);
    });

    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        chrome.tabs.remove(tabId);
      }
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, tabId);
    });

    el.querySelector('[data-action="close"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tabId);
    });

    el.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openTagEditor(tabId);
    });

    if (!isDragEnabled()) return;

    el.addEventListener('dragstart', (e) => {
      state.dragType = 'tab';
      state.dragTabId = tabId;
      state.dragGroupId = null;
      state.dragLock = true;
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(tabId));
      
      // 创建自定义拖拽图像，减少对指示器的遮挡
      const dragImage = document.createElement('div');
      dragImage.style.cssText = `
        position: fixed;
        top: -1000px;
        left: -1000px;
        width: 120px;
        height: 24px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 4px;
        opacity: 0.7;
        font-size: 11px;
        color: var(--text);
        padding: 4px 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: flex;
        align-items: center;
        gap: 4px;
      `;
      const tab = state.tabs.find(t => t.id === tabId);
      if (tab) {
        dragImage.textContent = tab.title || tab.url || '标签页';
      }
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 60, 12);
      
      // 拖拽结束后移除临时元素
      setTimeout(() => dragImage.remove(), 0);
    });

    el.addEventListener('dragend', () => {
      if (!state.dragType) return; // drop 已处理
      resetDragState();
      el.classList.remove('dragging');
      clearDragIndicators();
      refresh();
    });

    el.addEventListener('dragover', (e) => {
      if (!state.dragType) return;
      e.preventDefault();
      clearDragIndicators();
      if (state.dragType === 'tab' && state.dragTabId === tabId) return;
      if (state.dragType === 'group' && state.dragGroupId) {
        const sourceTabs = getGroupTabs(state.dragGroupId);
        if (sourceTabs.some((t) => t.id === tabId)) return;
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab?.groupId === state.dragGroupId) return;
      }
      setDropIndicator(el, getDropZone(e, el));
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-group');
      }
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();
      const zone = getDropZone(e, el);
      const insertBefore = zone === 'before';
      const wantsGroup = zone === 'group';

      if (state.dragType === 'tab' && state.dragTabId) {
        await moveTabRelativeToTab(state.dragTabId, tabId, insertBefore, wantsGroup);
      } else if (state.dragType === 'group' && state.dragGroupId) {
        const sourceTabs = getGroupTabs(state.dragGroupId);
        if (!sourceTabs.some((t) => t.id === tabId)) {
          await moveGroupRelativeToTab(state.dragGroupId, tabId, insertBefore);
        }
      }

      resetDragState();
      await refresh();
    });
  });
}

function bindGroupEvents() {
  tabListEl.querySelectorAll('.group-header[data-group-id]').forEach((el) => {
    const groupId = Number(el.dataset.groupId);

    el.querySelector('[data-action="toggle"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.collapsedGroups.has(groupId)) {
        state.collapsedGroups.delete(groupId);
      } else {
        state.collapsedGroups.add(groupId);
      }
      await saveCollapsedGroups();
      render();
    });

    el.querySelector('[data-action="add-tab"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await addTabToGroup(groupId);
    });

    el.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openGroupEditor('edit', groupId);
    });

    el.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.group-action-btn')) return;
      e.preventDefault();
      e.stopPropagation();
      showGroupContextMenu(e.clientX, e.clientY, groupId);
    });

    if (!isDragEnabled() || el.classList.contains('editing')) return;

    el.addEventListener('dragstart', (e) => {
      if (!canDragChromeGroups()) {
        e.preventDefault();
        return;
      }
      if (e.target.closest('.group-action-btn')) {
        e.preventDefault();
        return;
      }
      state.dragType = 'group';
      state.dragGroupId = groupId;
      state.dragTabId = null;
      state.dragLock = true;
      el.closest('.group-block')?.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `group:${groupId}`);
    });

    el.addEventListener('dragend', () => {
      if (!state.dragType) return; // drop 已处理
      resetDragState();
      el.closest('.group-block')?.classList.remove('dragging');
      clearDragIndicators();
      refresh();
    });

    el.addEventListener('dragover', (e) => {
      if (!state.dragType) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();
      if (state.dragType === 'group' && state.dragGroupId === groupId) return;

      if (state.dragType === 'tab') {
        // 拖标签页到分组头：上边缘=排前面，中间=加入分组，下边缘=排后面
        setDropIndicator(el, getDropZone(e, el));
      } else {
        // 拖分组到分组头：上=排前面，下=排后面
        const zone = getDropZone(e, el);
        setDropIndicator(el, zone === 'group' ? 'before' : zone);
      }
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-into', 'drag-over-group');
      }
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();

      if (state.dragType === 'tab' && state.dragTabId) {
        const zone = getDropZone(e, el);
        if (zone === 'group') {
          await moveTabIntoGroup(state.dragTabId, groupId, false);
        } else {
          // 排到分组前面或后面，不加入分组
          // 使用最新标签数据计算位置
          const latestTabs = await chrome.tabs.query({ windowId: state.currentWindowId ?? undefined });
          const groupTabs = latestTabs
            .filter((t) => t.groupId === groupId && !t.pinned)
            .sort((a, b) => a.index - b.index);
          const index = zone === 'before'
            ? groupTabs[0]?.index ?? 0
            : (groupTabs[groupTabs.length - 1]?.index ?? 0) + 1;
          await moveTabToIndex(state.dragTabId, index, chrome.tabGroups.TAB_GROUP_ID_NONE);
        }
      } else if (state.dragType === 'group' && state.dragGroupId) {
        const zone = getDropZone(e, el);
        await moveGroupBlock(state.dragGroupId, groupId, zone !== 'after');
      }

      resetDragState();
      await refresh();
    });
  });

  tabListEl.querySelectorAll('.group-header[data-virtual-key]').forEach((el) => {
    const virtualKey = el.dataset.virtualKey;

    el.querySelector('[data-action="toggle"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (state.collapsedVirtual.has(virtualKey)) {
        state.collapsedVirtual.delete(virtualKey);
      } else {
        state.collapsedVirtual.add(virtualKey);
      }
      await saveCollapsedVirtual();
      render();
    });

    if (!isDragEnabled()) return;

    el.addEventListener('dragover', (e) => {
      if (state.dragType !== 'tab') return;
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();
      // 上边缘=排前面，中间=加入，下边缘=排后面
      setDropIndicator(el, getDropZone(e, el));
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-into', 'drag-over-group');
      }
    });

    el.addEventListener('drop', async (e) => {
      if (state.dragType !== 'tab' || !state.dragTabId) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();
      const zone = getDropZone(e, el);
      const segment = findVirtualSegmentByKey(virtualKey);
      if (!segment) { resetDragState(); return; }
      if (zone === 'group') {
        await moveTabIntoVirtualSegment(state.dragTabId, segment, false);
      } else {
        // 排到虚拟分组前面或后面，不加入（segment.tabs 来自渲染时快照，可能有轻微偏移）
        const index = zone === 'before'
          ? segment.tabs[0]?.index ?? 0
          : (segment.tabs[segment.tabs.length - 1]?.index ?? 0) + 1;
        await moveTabToIndex(state.dragTabId, index, chrome.tabGroups.TAB_GROUP_ID_NONE);
      }
      resetDragState();
    });
  });

  tabListEl.querySelectorAll('.group-children[data-group-id]').forEach((el) => {
    const groupId = Number(el.dataset.groupId);
    if (!isDragEnabled()) return;

    el.addEventListener('dragover', (e) => {
      if (state.dragType !== 'tab') return;
      e.preventDefault();
      const tabItem = e.target.closest('.tab-item');
      if (tabItem) return;
      clearDragIndicators();
      el.classList.add('drag-over-into');
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-into');
      }
    });

    el.addEventListener('drop', async (e) => {
      if (state.dragType !== 'tab' || !state.dragTabId) return;
      if (e.target.closest('.tab-item')) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();
      await moveTabIntoGroup(state.dragTabId, groupId, false);
      resetDragState();
    });
  });

  tabListEl.querySelectorAll('.group-children[data-virtual-key]').forEach((el) => {
    const virtualKey = el.dataset.virtualKey;
    if (!isDragEnabled()) return;

    el.addEventListener('dragover', (e) => {
      if (state.dragType !== 'tab') return;
      e.preventDefault();
      const tabItem = e.target.closest('.tab-item');
      if (tabItem) return;
      clearDragIndicators();
      el.classList.add('drag-over-into');
    });

    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) {
        el.classList.remove('drag-over-into');
      }
    });

    el.addEventListener('drop', async (e) => {
      if (state.dragType !== 'tab' || !state.dragTabId) return;
      if (e.target.closest('.tab-item')) return;
      e.preventDefault();
      e.stopPropagation();
      clearDragIndicators();
      const segment = findVirtualSegmentByKey(virtualKey);
      if (segment) {
        await moveTabIntoVirtualSegment(state.dragTabId, segment, false);
      }
      resetDragState();
    });
  });
}

function bindDropZones() {
  tabListEl.addEventListener('dragover', (e) => {
    if (!isDragEnabled() || !state.dragType) return;
    if (e.target.closest('.tab-item, .group-header, .group-children')) return;
    e.preventDefault();
    clearDragIndicators();
    tabListEl.classList.add('drag-over-end');
  });

  tabListEl.addEventListener('dragleave', (e) => {
    if (!tabListEl.contains(e.relatedTarget)) {
      tabListEl.classList.remove('drag-over-end');
    }
  });

  tabListEl.addEventListener('drop', async (e) => {
    if (e.target.closest('.tab-item, .group-header, .group-children')) return;
    if (!state.dragType) return;
    e.preventDefault();
    tabListEl.classList.remove('drag-over-end');

    if (state.dragType === 'tab' && state.dragTabId) {
      const unpinned = state.tabs.filter((t) => !t.pinned);
      const lastIndex = unpinned.length ? unpinned[unpinned.length - 1].index + 1 : state.tabs.length;
      await moveTabToIndex(state.dragTabId, lastIndex, chrome.tabGroups.TAB_GROUP_ID_NONE);
    }

    resetDragState();
  });
}

function resetDragState() {
  state.dragType = null;
  state.dragTabId = null;
  state.dragGroupId = null;
  state.dragLock = false;
  tabListEl.classList.remove('drag-over-end');
}

function bindGroupEditorEvents() {
  tabListEl.querySelectorAll('.group-editor').forEach((el) => {
    const input = el.querySelector('.group-editor-input');

    input?.addEventListener('input', (e) => {
      if (state.groupEditor) state.groupEditor.title = e.target.value;
    });

    input?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') confirmGroupEditor();
    });

    el.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.groupEditor) return;
        state.groupEditor.color = btn.dataset.color;
        el.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    el.querySelector('[data-action="cancel"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeGroupEditor();
    });

    el.querySelector('[data-action="confirm"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.groupEditor) state.groupEditor.title = input?.value ?? '';
      confirmGroupEditor();
    });

    el.addEventListener('click', (e) => e.stopPropagation());
  });
}

function handleTabClick(tabId) {
  if (clickTimer && lastClickedTabId === tabId) {
    clearTimeout(clickTimer);
    clickTimer = null;
    return;
  }

  lastClickedTabId = tabId;
  clickTimer = setTimeout(async () => {
    clickTimer = null;
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId !== state.currentWindowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  }, 200);
}

function showPanelContextMenu(x, y) {
  const items = [
    { label: '新建标签页', action: createNewTab },
    { label: '重新打开关闭的标签页', action: () => reopenClosedTab() },
    { label: '创建分组', action: () => showTagGroupCreator() },
    { separator: true },
    { label: '设置', action: () => openSettingsInNewTab() },
  ];
  showMenu(items, x, y);
}

function showContextMenu(x, y, tabId) {
  state.contextTabId = tabId;
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const { tabSettings } = state;
  const tabNote = state.tabNotes[tabId] || { tags: [], note: '' };
  const hasTags = tabNote.tags && tabNote.tags.length > 0;

  const groupItems = state.groups.map((g) => ({
    label: g.title || '未命名分组',
    action: async () => {
      await chrome.tabs.group({ tabIds: tabId, groupId: g.id });
    },
  }));

  const items = [
    { label: '重新加载', action: () => chrome.tabs.reload(tabId) },
    { label: '复制标签页', action: () => chrome.tabs.duplicate(tabId) },
    { label: tab.pinned ? '取消固定' : '固定标签页', action: () => chrome.tabs.update(tabId, { pinned: !tab.pinned }) },
    { separator: true },
    ...(tab.audible ? [{ label: tab.mutedInfo?.muted ? '取消静音' : '静音标签页', action: () => chrome.tabs.update(tabId, { muted: !tab.mutedInfo?.muted }) }] : []),
    { separator: true },
    ...(groupItems.length > 0 ? [
      { label: '添加到分组', submenu: groupItems },
    ] : []),
    ...(tab.groupId !== undefined && tab.groupId !== -1 ? [
      {
        label: '从分组中移除',
        action: async () => {
          try {
            await chrome.tabs.ungroup(tabId);
          } catch (err) {
            console.error('从分组移除失败:', err);
          }
        },
      },
    ] : []),
    ...(groupItems.length > 0 || (tab.groupId !== undefined && tab.groupId !== -1) ? [{ separator: true }] : []),
    ...(tabSettings.enableTabTags ? [
      { label: '添加标签', action: () => openTagEditor(tabId) },
      ...(hasTags ? [{ label: '管理标签', action: () => openTagEditor(tabId) }] : []),
    ] : []),
    { separator: true },
    { label: '关闭标签页', action: () => chrome.tabs.remove(tabId), danger: true },
    { label: '关闭其他标签页', action: () => closeOtherTabs(tabId) },
    { label: '关闭下方标签页', action: () => closeTabsToRight(tabId) },
  ];

  showMenu(items, x, y);
}

function showGroupContextMenu(x, y, groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;

  const items = [
    { label: '修改名称和颜色', action: () => openGroupEditor('edit', groupId) },
    { label: '在此分组新建标签页', action: () => addTabToGroup(groupId) },
    {
      label: state.collapsedGroups.has(groupId) ? '展开分组' : '折叠分组',
      action: async () => {
        if (state.collapsedGroups.has(groupId)) {
          state.collapsedGroups.delete(groupId);
        } else {
          state.collapsedGroups.add(groupId);
        }
        await saveCollapsedGroups();
        render();
      },
    },
    { separator: true },
    {
      label: '解散分组',
      action: async () => {
        const tabIds = state.tabs.filter((t) => t.groupId === groupId).map((t) => t.id);
        if (tabIds.length > 0) {
          await chrome.tabs.ungroup(tabIds);
        }
      },
    },
    ...(state.tabSettings.enableTabTags ? [{
      label: '批量添加标签',
      action: () => openGroupTagEditor(groupId),
    }] : []),
    {
      label: '删除分组',
      action: async () => {
        const tabIds = state.tabs.filter((t) => t.groupId === groupId).map((t) => t.id);
        if (tabIds.length === 0) return;
        const groupTitle = state.groups.find((g) => g.id === groupId)?.title || '该分组';
        const confirmed = window.confirm(
          `确定要删除分组「${groupTitle}」吗？\n\n` +
          `• 将关闭该分组下 ${tabIds.length} 个标签页\n` +
          `• 将删除这些标签页上已添加的所有标签\n` +
          `• 此操作不可恢复`
        );
        if (!confirmed) return;
        // 删除标签数据
        const newTabNotes = { ...state.tabNotes };
        for (const id of tabIds) {
          delete newTabNotes[id];
        }
        state.tabNotes = newTabNotes;
        await chrome.storage.local.set({ tabNotes: newTabNotes });
        // 关闭标签页
        await chrome.tabs.remove(tabIds);
      },
      danger: true,
    },
  ];

  showMenu(items, x, y);
}

function showMenu(items, x, y) {
  hideSubmenu();

  contextMenuEl.innerHTML = items.map((item) => {
    if (item.separator) return '<div class="context-menu-separator"></div>';
    const hasSub = Array.isArray(item.submenu) && item.submenu.length > 0;
    return `<button class="context-menu-item ${item.danger ? 'danger' : ''} ${hasSub ? 'has-submenu' : ''}" data-item-id="${items.indexOf(item)}">
      <span class="context-menu-label">${item.label}</span>
      ${hasSub ? '<span class="context-menu-arrow">›</span>' : ''}
    </button>`;
  }).join('');

  contextMenuEl.classList.remove('hidden');
  positionMenu(contextMenuEl, x, y);

  contextMenuEl.querySelectorAll('.context-menu-item').forEach((btn) => {
    const idx = Number(btn.dataset.itemId);
    const item = items[idx];
    if (!item) return;

    if (Array.isArray(item.submenu) && item.submenu.length > 0) {
      let submenuEl = null;
      const showSub = () => {
        hideSubmenu();
        submenuEl = buildSubmenu(item.submenu);
        document.body.appendChild(submenuEl);
        const rect = btn.getBoundingClientRect();
        const subRect = submenuEl.getBoundingClientRect();
        let left = rect.right - 4;
        let top = rect.top;
        if (left + subRect.width > window.innerWidth) {
          left = rect.left - subRect.width + 4;
        }
        if (top + subRect.height > window.innerHeight) {
          top = window.innerHeight - subRect.height - 8;
        }
        submenuEl.style.left = `${left}px`;
        submenuEl.style.top = `${top}px`;
        submenuEl.classList.remove('hidden');
      };
      const hide = (e) => {
        if (submenuEl && e && (submenuEl.contains(e.relatedTarget) || btn.contains(e.relatedTarget))) return;
        hideSubmenu();
      };
      btn.addEventListener('mouseenter', showSub);
      btn.addEventListener('mouseleave', hide);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSub();
      });
    } else {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        item?.action();
      });
    }
  });
}

function buildSubmenu(subItems) {
  const sub = document.createElement('div');
  sub.className = 'context-menu submenu hidden';
  sub.innerHTML = subItems.map((item, i) => {
    if (item.separator) return '<div class="context-menu-separator"></div>';
    return `<button class="context-menu-item" data-sub-id="${i}">${item.label}</button>`;
  }).join('');

  sub.querySelectorAll('.context-menu-item').forEach((btn) => {
    const i = Number(btn.dataset.subId);
    const item = subItems[i];
    if (!item) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideContextMenu();
      item.action();
    });
  });

  return sub;
}

function hideSubmenu() {
  document.querySelectorAll('.context-menu.submenu').forEach((el) => el.remove());
}

function positionMenu(menu, x, y) {
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 8}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 8}px`;
  }
}

function hideContextMenu() {
  contextMenuEl.classList.add('hidden');
  hideSubmenu();
  state.contextTabId = null;
}

async function closeOtherTabs(keepTabId) {
  const toClose = state.tabs.filter((t) => t.id !== keepTabId).map((t) => t.id);
  if (toClose.length) await chrome.tabs.remove(toClose);
}

async function closeTabsToRight(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  const toClose = state.tabs.filter((t) => t.index > tab.index).map((t) => t.id);
  if (toClose.length) await chrome.tabs.remove(toClose);
}

async function reopenClosedTab() {
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 1 });
    if (sessions && sessions.length > 0) {
      const session = sessions[0];
      if (session.tab) {
        await chrome.sessions.restore(sessions[0].tab.sessionId);
      } else if (session.window) {
        await chrome.sessions.restore(sessions[0].window.sessionId);
      }
    }
  } catch (err) {
    console.error('重新打开关闭的标签页失败:', err);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 标签编辑器相关
function openTagEditor(tabId) {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;

  const tabNote = state.tabNotes[tabId] || { tags: [], note: '' };
  const currentTags = tabNote.tags || [];

  // 收集所有标签页中已使用的标签（排除当前标签页已有的）
  const allExistingTags = new Set();
  for (const t of state.tabs) {
    if (t.id === tabId) continue;
    const note = state.tabNotes[t.id];
    if (note?.tags) {
      note.tags.forEach((tag) => allExistingTags.add(tag));
    }
  }

  const dialog = document.createElement('div');
  dialog.className = 'tag-editor-dialog';
  dialog.innerHTML = `
    <div class="tag-editor-overlay"></div>
    <div class="tag-editor-content">
      <div class="tag-editor-header">
        <h3>管理标签</h3>
        <button class="tag-editor-close" aria-label="关闭">×</button>
      </div>
      <div class="tag-editor-body">
        <div class="tag-input-container">
          <input type="text" id="tag-input" placeholder="输入标签后按回车添加" maxlength="20" />
          <button id="add-tag-btn" class="add-tag-btn">添加</button>
        </div>
        <div class="current-tags" id="current-tags">
          ${currentTags.map(tag => `
            <span class="tag-item">
              <span class="tag-text">${escapeHtml(tag)}</span>
              <button class="tag-remove" data-tag="${escapeHtml(tag)}" aria-label="删除标签">×</button>
            </span>
          `).join('')}
        </div>
        ${allExistingTags.size > 0 ? `
          <div class="existing-tags-section">
            <div class="existing-tags-title">从已有标签选择</div>
            <div class="existing-tags-list" id="existing-tags"></div>
          </div>
        ` : ''}
      </div>
      <div class="tag-editor-footer">
        <button id="cancel-tags-btn" class="cancel-btn">取消</button>
        <button id="save-tags-btn" class="save-btn">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const tagInput = dialog.querySelector('#tag-input');
  const addTagBtn = dialog.querySelector('#add-tag-btn');
  const currentTagsContainer = dialog.querySelector('#current-tags');
  const existingTagsContainer = dialog.querySelector('#existing-tags');
  const saveBtn = dialog.querySelector('#save-tags-btn');
  const cancelBtn = dialog.querySelector('#cancel-tags-btn');
  const closeBtn = dialog.querySelector('.tag-editor-close');
  const overlay = dialog.querySelector('.tag-editor-overlay');

  let tags = [...currentTags];

  function renderTags() {
    currentTagsContainer.innerHTML = tags.map(tag => `
      <span class="tag-item">
        <span class="tag-text">${escapeHtml(tag)}</span>
        <button class="tag-remove" data-tag="${escapeHtml(tag)}" aria-label="删除标签">×</button>
      </span>
    `).join('');

    currentTagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const tagToRemove = btn.dataset.tag;
        tags = tags.filter(t => t !== tagToRemove);
        renderTags();
        renderExistingTags();
      });
    });
  }

  function renderExistingTags() {
    if (!existingTagsContainer) return;
    const tagsArr = Array.from(allExistingTags).sort();
    existingTagsContainer.innerHTML = tagsArr.map(tag => {
      const selected = tags.includes(tag);
      return `<button class="existing-tag-item ${selected ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
    }).join('');

    existingTagsContainer.querySelectorAll('.existing-tag-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (tags.includes(tag)) {
          tags = tags.filter(t => t !== tag);
        } else {
          tags.push(tag);
        }
        renderTags();
        renderExistingTags();
      });
    });
  }

  function addTag() {
    const newTag = tagInput.value.trim();
    if (newTag && !tags.includes(newTag)) {
      tags.push(newTag);
      allExistingTags.add(newTag);
      tagInput.value = '';
      renderTags();
      renderExistingTags();
    }
  }

  tagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  });

  addTagBtn.addEventListener('click', addTag);

  function closeDialog() {
    dialog.remove();
  }

  saveBtn.addEventListener('click', async () => {
    const noteData = state.tabNotes[tabId] || { tags: [], note: '' };
    noteData.tags = tags;

    await chrome.storage.local.set({
      tabNotes: {
        ...state.tabNotes,
        [tabId]: noteData
      }
    });

    closeDialog();
  });

  cancelBtn.addEventListener('click', closeDialog);
  closeBtn.addEventListener('click', closeDialog);
  overlay.addEventListener('click', closeDialog);

  renderTags();
  renderExistingTags();
  tagInput.focus();
}

async function openGroupTagEditor(groupId) {
  if (!state.tabSettings.enableTabTags) return;
  const groupTabs = state.tabs.filter((t) => t.groupId === groupId);
  if (groupTabs.length === 0) return;

  const group = state.groups.find((g) => g.id === groupId);
  const groupTitle = group?.title || '该分组';

  // 收集所有标签页中已使用的标签（用于建议）
  const allExistingTags = new Set();
  for (const tab of state.tabs) {
    const note = state.tabNotes[tab.id];
    if (note?.tags) {
      note.tags.forEach((tag) => allExistingTags.add(tag));
    }
  }

  const dialog = document.createElement('div');
  dialog.className = 'tag-editor-dialog';
  dialog.innerHTML = `
    <div class="tag-editor-overlay"></div>
    <div class="tag-editor-content">
      <div class="tag-editor-header">
        <h3>批量添加标签 - 「${escapeHtml(groupTitle)}」</h3>
        <button class="tag-editor-close" aria-label="关闭">×</button>
      </div>
      <div class="tag-editor-body">
        <p class="tag-editor-hint">将为分组下 ${groupTabs.length} 个标签页添加选中的标签</p>
        <div class="tag-input-container">
          <input type="text" id="group-tag-input" placeholder="输入新标签后按回车" maxlength="20" />
          <button id="add-group-tag-btn" class="add-tag-btn">添加</button>
        </div>
        <div class="current-tags" id="group-current-tags"></div>
        ${allExistingTags.size > 0 ? `
          <div class="existing-tags-section">
            <div class="existing-tags-title">从已有标签选择</div>
            <div class="existing-tags-list" id="group-existing-tags"></div>
          </div>
        ` : ''}
      </div>
      <div class="tag-editor-footer">
        <button id="cancel-group-tags-btn" class="cancel-btn">取消</button>
        <button id="save-group-tags-btn" class="save-btn">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const tagInput = dialog.querySelector('#group-tag-input');
  const addTagBtn = dialog.querySelector('#add-group-tag-btn');
  const currentTagsContainer = dialog.querySelector('#group-current-tags');
  const existingTagsContainer = dialog.querySelector('#group-existing-tags');
  const saveBtn = dialog.querySelector('#save-group-tags-btn');
  const cancelBtn = dialog.querySelector('#cancel-group-tags-btn');
  const closeBtn = dialog.querySelector('.tag-editor-close');
  const overlay = dialog.querySelector('.tag-editor-overlay');

  let tags = [];

  function renderTags() {
    currentTagsContainer.innerHTML = tags.map(tag => `
      <span class="tag-item">
        <span class="tag-text">${escapeHtml(tag)}</span>
        <button class="tag-remove" data-tag="${escapeHtml(tag)}" aria-label="删除标签">×</button>
      </span>
    `).join('');

    currentTagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const tagToRemove = btn.dataset.tag;
        tags = tags.filter(t => t !== tagToRemove);
        renderTags();
      });
    });
  }

  function renderExistingTags() {
    if (!existingTagsContainer) return;
    const tagsArr = Array.from(allExistingTags).sort();
    existingTagsContainer.innerHTML = tagsArr.map(tag => {
      const selected = tags.includes(tag);
      return `<button class="existing-tag-item ${selected ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`;
    }).join('');

    existingTagsContainer.querySelectorAll('.existing-tag-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (tags.includes(tag)) {
          tags = tags.filter(t => t !== tag);
        } else {
          tags.push(tag);
        }
        renderTags();
        renderExistingTags();
      });
    });
  }

  function addTag() {
    const newTag = tagInput.value.trim();
    if (newTag && !tags.includes(newTag)) {
      tags.push(newTag);
      tagInput.value = '';
      renderTags();
    }
  }

  tagInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  });

  addTagBtn.addEventListener('click', addTag);

  function closeDialog() {
    dialog.remove();
  }

  saveBtn.addEventListener('click', async () => {
    if (tags.length === 0) {
      closeDialog();
      return;
    }
    const newTabNotes = { ...state.tabNotes };
    for (const tab of groupTabs) {
      const noteData = newTabNotes[tab.id] || { tags: [] };
      const existingTags = noteData.tags || [];
      const merged = Array.from(new Set([...existingTags, ...tags]));
      newTabNotes[tab.id] = { ...noteData, tags: merged };
    }
    state.tabNotes = newTabNotes;
    await chrome.storage.local.set({ tabNotes: newTabNotes });
    closeDialog();
  });

  cancelBtn.addEventListener('click', closeDialog);
  closeBtn.addEventListener('click', closeDialog);
  overlay.addEventListener('click', closeDialog);

  renderTags();
  renderExistingTags();
  tagInput.focus();
}



// 备注编辑器相关

function showTagGroupCreator() {
  const tagCounts = {};
  for (const tab of state.tabs) {
    const tabNote = state.tabNotes[tab.id] || { tags: [] };
    if (tabNote.tags) {
      for (const tag of tabNote.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
  }

  const tags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  const swatches = GROUP_COLOR_KEYS.map((key) => {
    const selected = key === 'blue' ? ' selected' : '';
    return `<button type="button" class="color-swatch${selected}" data-color="${key}" style="background:${GROUP_COLORS[key]}" aria-label="${key}"></button>`;
  }).join('');

  const dialog = document.createElement('div');
  dialog.className = 'tag-editor-dialog';
  dialog.innerHTML = `
    <div class="tag-editor-overlay"></div>
    <div class="tag-editor-content">
      <div class="tag-editor-header">
        <h3>创建分组</h3>
        <button class="tag-editor-close" aria-label="关闭">×</button>
      </div>
      <div class="tag-editor-body">
        <div class="group-editor-field">
          <label class="group-editor-label">分组名称</label>
          <input class="group-editor-input" id="group-title-input" type="text" placeholder="请输入分组名称" maxlength="64" />
        </div>
        <div class="group-editor-field">
          <label class="group-editor-label">颜色</label>
          <div class="color-picker" id="group-color-picker">${swatches}</div>
        </div>
        ${state.tabSettings.enableTabTags && tags.length > 0 ? `
        <div class="group-editor-field">
          <label class="group-editor-label">从已有标签选择（可选）</label>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 8px 0;">选择标签后，将自动归类该标签下的标签页到新分组</p>
          <div class="existing-tags-list" id="tag-group-list" style="max-height: 140px; overflow-y: auto;">
            ${tags.map(tag => `
              <button class="existing-tag-item" data-tag="${escapeHtml(tag)}">
                ${escapeHtml(tag)} <span style="opacity: 0.7;">(${tagCounts[tag]})</span>
              </button>
            `).join('')}
          </div>
        </div>` : ''}
      </div>
      <div class="tag-editor-footer">
        <button id="cancel-btn" class="cancel-btn">取消</button>
        <button id="confirm-btn" class="save-btn">创建</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const titleInput = dialog.querySelector('#group-title-input');
  const colorPicker = dialog.querySelector('#group-color-picker');
  const tagGroupList = dialog.querySelector('#tag-group-list');
  const cancelBtn = dialog.querySelector('#cancel-btn');
  const confirmBtn = dialog.querySelector('#confirm-btn');
  const closeBtn = dialog.querySelector('.tag-editor-close');
  const overlay = dialog.querySelector('.tag-editor-overlay');

  let selectedColor = 'blue';
  let selectedTag = null;

  colorPicker.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      colorPicker.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });

  tagGroupList?.querySelectorAll('[data-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (selectedTag === tag) {
        selectedTag = null;
        btn.classList.remove('selected');
      } else {
        tagGroupList.querySelectorAll('[data-tag]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTag = tag;
        if (!titleInput.value.trim()) {
          titleInput.value = tag;
        }
      }
    });
  });

  confirmBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim() || '新分组';
    const color = GROUP_COLOR_KEYS.includes(selectedColor) ? selectedColor : 'blue';

    if (selectedTag) {
      const tabsWithTag = state.tabs.filter(t => {
        const tabNote = state.tabNotes[t.id] || { tags: [] };
        return tabNote.tags && tabNote.tags.includes(selectedTag);
      });

      if (tabsWithTag.length > 0) {
        const tabIds = tabsWithTag.map(t => t.id);
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title, color });
      } else {
        await createNewGroup(title, color);
      }
    } else {
      await createNewGroup(title, color);
    }

    closeDialog();
    await refresh();
  });

  function closeDialog() {
    dialog.remove();
  }

  cancelBtn.addEventListener('click', closeDialog);
  closeBtn.addEventListener('click', closeDialog);
  overlay.addEventListener('click', closeDialog);

  titleInput.focus();
}

init();
