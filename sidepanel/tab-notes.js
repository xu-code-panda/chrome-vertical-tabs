/**
 * 标签页标签/备注管理模块
 */

/**
 * 加载标签页备注数据
 */
export async function loadTabNotes() {
  const { tabNotes = {} } = await chrome.storage.local.get('tabNotes');
  return tabNotes || {};
}

/**
 * 保存标签页备注数据
 */
export async function saveTabNotes(tabNotes) {
  await chrome.storage.local.set({ tabNotes });
}

/**
 * 获取标签页备注信息
 */
export async function getTabNote(tabId) {
  const tabNotes = await loadTabNotes();
  return tabNotes[tabId] || { tags: [], note: '' };
}

/**
 * 设置标签页备注信息
 */
export async function setTabNote(tabId, noteData) {
  const tabNotes = await loadTabNotes();
  tabNotes[tabId] = {
    tags: Array.isArray(noteData.tags) ? noteData.tags : [],
    note: String(noteData.note || ''),
  };
  await saveTabNotes(tabNotes);
}

/**
 * 添加标签页标签
 */
export async function addTabTag(tabId, tag) {
  const noteData = await getTabNote(tabId);
  if (!noteData.tags.includes(tag)) {
    noteData.tags.push(tag);
    await setTabNote(tabId, noteData);
  }
  return noteData.tags;
}

/**
 * 移除标签页标签
 */
export async function removeTabTag(tabId, tag) {
  const noteData = await getTabNote(tabId);
  noteData.tags = noteData.tags.filter(t => t !== tag);
  await setTabNote(tabId, noteData);
  return noteData.tags;
}

/**
 * 更新标签页备注
 */
export async function updateTabNote(tabId, note) {
  const noteData = await getTabNote(tabId);
  noteData.note = String(note || '');
  await setTabNote(tabId, noteData);
  return noteData.note;
}

/**
 * 删除标签页备注信息
 */
export async function deleteTabNote(tabId) {
  const tabNotes = await loadTabNotes();
  delete tabNotes[tabId];
  await saveTabNotes(tabNotes);
}

/**
 * 获取所有包含指定标签的标签页ID
 */
export async function getTabIdsByTag(tag) {
  const tabNotes = await loadTabNotes();
  const tabIds = [];
  for (const [tabId, noteData] of Object.entries(tabNotes)) {
    if (noteData.tags && noteData.tags.includes(tag)) {
      tabIds.push(Number(tabId));
    }
  }
  return tabIds;
}

/**
 * 获取所有使用过的标签
 */
export async function getAllTags() {
  const tabNotes = await loadTabNotes();
  const tagSet = new Set();
  for (const noteData of Object.values(tabNotes)) {
    if (noteData.tags) {
      noteData.tags.forEach(tag => tagSet.add(tag));
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * 批量删除标签页备注（用于清理已关闭的标签页）
 */
export async function cleanupTabNotes(activeTabIds) {
  const tabNotes = await loadTabNotes();
  const activeTabIdSet = new Set(activeTabIds);
  let hasChanges = false;

  for (const tabId of Object.keys(tabNotes)) {
    if (!activeTabIdSet.has(Number(tabId))) {
      delete tabNotes[tabId];
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await saveTabNotes(tabNotes);
  }
}