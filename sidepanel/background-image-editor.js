import {
  focalToOffset,
  computeDisplayedImageSize,
  offsetToFocal,
  normalizeBackgroundImageFocal,
  normalizeBackgroundImageScale,
  clampImageOffset,
  TAB_PANEL_REFERENCE_WIDTH,
  TAB_PANEL_REFERENCE_HEIGHT,
  MIN_BACKGROUND_IMAGE_SCALE,
  MAX_BACKGROUND_IMAGE_SCALE,
} from './background-image-layout.js';

const PREVIEW_WIDTH = 300;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH * (TAB_PANEL_REFERENCE_HEIGHT / TAB_PANEL_REFERENCE_WIDTH));

let activeOverlay = null;

export function closeBackgroundImageEditor() {
  if (!activeOverlay) return;
  activeOverlay.remove();
  activeOverlay = null;
}

export function openBackgroundImageEditor({
  imageUrl,
  focal,
  scale,
  meta,
  previewBg = '#ffffff',
  onApply,
  onCancel,
}) {
  closeBackgroundImageEditor();

  const editorState = {
    focal: normalizeBackgroundImageFocal(focal),
    scale: normalizeBackgroundImageScale(scale),
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  };

  const overlay = document.createElement('div');
  overlay.className = 'bg-image-editor-overlay';
  overlay.innerHTML = `
    <div class="bg-image-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="bg-image-editor-title">
      <h3 id="bg-image-editor-title" class="bg-image-editor-title">调整背景图片</h3>
      <p class="bg-image-editor-hint">拖拽图片选择要显示的区域（预览比例与侧栏标签区域一致）</p>
      <div class="bg-image-editor-preview-wrap">
        <div class="bg-image-editor-preview" data-role="preview" style="width:${PREVIEW_WIDTH}px;height:${PREVIEW_HEIGHT}px">
          <img data-role="image" alt="" draggable="false" />
        </div>
      </div>
      <div class="bg-image-editor-zoom">
        <label for="bg-image-editor-zoom">缩放</label>
        <input id="bg-image-editor-zoom" data-role="zoom" type="range"
          min="${MIN_BACKGROUND_IMAGE_SCALE * 100}"
          max="${MAX_BACKGROUND_IMAGE_SCALE * 100}"
          step="5" value="100" />
        <span data-role="zoom-value">100%</span>
      </div>
      <div class="bg-image-editor-actions">
        <button type="button" class="settings-default-btn" data-action="cancel">取消</button>
        <button type="button" class="settings-default-btn bg-image-editor-apply" data-action="apply">应用</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  const previewEl = overlay.querySelector('[data-role="preview"]');
  const imageEl = overlay.querySelector('[data-role="image"]');
  const zoomInput = overlay.querySelector('[data-role="zoom"]');
  const zoomValueEl = overlay.querySelector('[data-role="zoom-value"]');

  previewEl.style.backgroundColor = previewBg;
  imageEl.src = imageUrl;

  function getDisplaySize() {
    return computeDisplayedImageSize(
      meta,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      editorState.scale,
    );
  }

  function syncImageLayout() {
    const { width, height } = getDisplaySize();

    imageEl.style.width = `${width}px`;
    imageEl.style.height = `${height}px`;

    const { offsetX, offsetY } = focalToOffset(
      editorState.focal,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      width,
      height,
    );

    editorState.offsetX = offsetX;
    editorState.offsetY = offsetY;
    imageEl.style.left = `${offsetX}px`;
    imageEl.style.top = `${offsetY}px`;
  }

  function updateZoomLabel() {
    zoomValueEl.textContent = `${Math.round(editorState.scale * 100)}%`;
    zoomInput.value = String(Math.round(editorState.scale * 100));
  }

  editorState.scale = normalizeBackgroundImageScale(scale);
  editorState.focal = normalizeBackgroundImageFocal(focal);
  updateZoomLabel();
  syncImageLayout();

  function finishDrag() {
    editorState.dragging = false;
    editorState.pointerId = null;
    previewEl.classList.remove('dragging');
  }

  previewEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    editorState.dragging = true;
    editorState.pointerId = e.pointerId;
    editorState.lastX = e.clientX;
    editorState.lastY = e.clientY;
    previewEl.classList.add('dragging');
    previewEl.setPointerCapture(e.pointerId);
  });

  previewEl.addEventListener('pointermove', (e) => {
    if (!editorState.dragging || editorState.pointerId !== e.pointerId) return;

    const dx = e.clientX - editorState.lastX;
    const dy = e.clientY - editorState.lastY;
    editorState.lastX = e.clientX;
    editorState.lastY = e.clientY;

    const { width, height } = getDisplaySize();

    editorState.offsetX = clampImageOffset(editorState.offsetX + dx, PREVIEW_WIDTH, width);
    editorState.offsetY = clampImageOffset(editorState.offsetY + dy, PREVIEW_HEIGHT, height);
    editorState.focal = offsetToFocal(
      editorState.offsetX,
      editorState.offsetY,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      width,
      height,
    );

    imageEl.style.left = `${editorState.offsetX}px`;
    imageEl.style.top = `${editorState.offsetY}px`;
  });

  previewEl.addEventListener('pointerup', (e) => {
    if (editorState.pointerId !== e.pointerId) return;
    finishDrag();
    previewEl.releasePointerCapture(e.pointerId);
  });

  previewEl.addEventListener('pointercancel', (e) => {
    if (editorState.pointerId !== e.pointerId) return;
    finishDrag();
  });

  zoomInput.addEventListener('input', (e) => {
    editorState.scale = normalizeBackgroundImageScale(Number(e.target.value) / 100);
    updateZoomLabel();
    syncImageLayout();
  });

  overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    closeBackgroundImageEditor();
    onCancel?.();
  });

  overlay.querySelector('[data-action="apply"]').addEventListener('click', () => {
    const result = {
      focal: { ...editorState.focal },
      scale: editorState.scale,
    };
    closeBackgroundImageEditor();
    onApply?.(result);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeBackgroundImageEditor();
      onCancel?.();
    }
  });
}
