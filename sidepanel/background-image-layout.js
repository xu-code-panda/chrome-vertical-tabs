/** 侧栏标签区域典型尺寸，用于编辑器预览与旧数据迁移 */
export const TAB_PANEL_REFERENCE_WIDTH = 360;
export const TAB_PANEL_REFERENCE_HEIGHT = 520;

export const DEFAULT_BACKGROUND_IMAGE_FOCAL = { x: 0.5, y: 0.5 };
export const DEFAULT_BACKGROUND_IMAGE_SCALE = 1;
export const MIN_BACKGROUND_IMAGE_SCALE = 0.5;
export const MAX_BACKGROUND_IMAGE_SCALE = 3;

export function normalizeBackgroundImageFocal(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  return {
    x: Number.isFinite(x) ? x : DEFAULT_BACKGROUND_IMAGE_FOCAL.x,
    y: Number.isFinite(y) ? y : DEFAULT_BACKGROUND_IMAGE_FOCAL.y,
  };
}

export function normalizeBackgroundImageScale(raw) {
  const scale = Number(raw);
  if (!Number.isFinite(scale)) return DEFAULT_BACKGROUND_IMAGE_SCALE;
  return clamp(scale, MIN_BACKGROUND_IMAGE_SCALE, MAX_BACKGROUND_IMAGE_SCALE);
}

export function normalizeBackgroundImageMeta(raw) {
  const width = Number(raw?.width);
  const height = Number(raw?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

export function computeCoverScale(containerWidth, containerHeight, imageWidth, imageHeight) {
  if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) return 1;
  return Math.max(containerWidth / imageWidth, containerHeight / imageHeight);
}

export function computeDisplayedImageSize(meta, containerWidth, containerHeight, scale) {
  if (!meta) return { width: 0, height: 0 };
  const coverScale = computeCoverScale(containerWidth, containerHeight, meta.width, meta.height);
  const zoom = normalizeBackgroundImageScale(scale);
  return {
    width: meta.width * coverScale * zoom,
    height: meta.height * coverScale * zoom,
  };
}

export function clampImageOffset(offset, containerSize, imageSize) {
  if (imageSize <= containerSize) {
    return (containerSize - imageSize) / 2;
  }
  return Math.min(0, Math.max(containerSize - imageSize, offset));
}

export function focalToOffset(focal, containerWidth, containerHeight, displayWidth, displayHeight) {
  const point = normalizeBackgroundImageFocal(focal);
  let offsetX = containerWidth / 2 - point.x * displayWidth;
  let offsetY = containerHeight / 2 - point.y * displayHeight;
  offsetX = clampImageOffset(offsetX, containerWidth, displayWidth);
  offsetY = clampImageOffset(offsetY, containerHeight, displayHeight);
  return { offsetX, offsetY };
}

export function offsetToFocal(offsetX, offsetY, containerWidth, containerHeight, displayWidth, displayHeight) {
  if (!displayWidth || !displayHeight) {
    return { ...DEFAULT_BACKGROUND_IMAGE_FOCAL };
  }
  return {
    x: (containerWidth / 2 - offsetX) / displayWidth,
    y: (containerHeight / 2 - offsetY) / displayHeight,
  };
}

export function offsetToBackgroundPosition(offsetX, offsetY, containerWidth, containerHeight, displayWidth, displayHeight) {
  const x = displayWidth > containerWidth
    ? clamp((offsetX / (containerWidth - displayWidth)) * 100, 0, 100)
    : 50;
  const y = displayHeight > containerHeight
    ? clamp((offsetY / (containerHeight - displayHeight)) * 100, 0, 100)
    : 50;
  return { x, y };
}

export function backgroundPositionToOffset(position, containerWidth, containerHeight, displayWidth, displayHeight) {
  const x = Number(position?.x);
  const y = Number(position?.y);
  const posX = Number.isFinite(x) ? clamp(x, 0, 100) : 50;
  const posY = Number.isFinite(y) ? clamp(y, 0, 100) : 50;
  const offsetX = displayWidth > containerWidth
    ? (posX / 100) * (containerWidth - displayWidth)
    : (containerWidth - displayWidth) / 2;
  const offsetY = displayHeight > containerHeight
    ? (posY / 100) * (containerHeight - displayHeight)
    : (containerHeight - displayHeight) / 2;
  return { offsetX, offsetY };
}

export function migrateBackgroundPositionToFocal(position, meta, scale, containerWidth, containerHeight) {
  if (!meta) return { ...DEFAULT_BACKGROUND_IMAGE_FOCAL };
  const { width, height } = computeDisplayedImageSize(meta, containerWidth, containerHeight, scale);
  const { offsetX, offsetY } = backgroundPositionToOffset(
    position,
    containerWidth,
    containerHeight,
    width,
    height,
  );
  return offsetToFocal(offsetX, offsetY, containerWidth, containerHeight, width, height);
}

export function resolveBackgroundImageFocal(layout, meta) {
  if (layout?.focal) {
    return normalizeBackgroundImageFocal(layout.focal);
  }
  if (layout?.position && meta) {
    return migrateBackgroundPositionToFocal(
      layout.position,
      meta,
      layout?.scale ?? DEFAULT_BACKGROUND_IMAGE_SCALE,
      TAB_PANEL_REFERENCE_WIDTH,
      TAB_PANEL_REFERENCE_HEIGHT,
    );
  }
  return { ...DEFAULT_BACKGROUND_IMAGE_FOCAL };
}

export function computeBackgroundImageStyle(layout, meta, containerWidth, containerHeight) {
  if (!meta) {
    return {
      backgroundSize: 'cover',
      backgroundPosition: '50% 50%',
    };
  }

  const scale = normalizeBackgroundImageScale(layout?.scale);
  const focal = resolveBackgroundImageFocal(layout, meta);
  const { width, height } = computeDisplayedImageSize(meta, containerWidth, containerHeight, scale);

  if (!width || !height) {
    return {
      backgroundSize: 'cover',
      backgroundPosition: '50% 50%',
    };
  }

  const { offsetX, offsetY } = focalToOffset(focal, containerWidth, containerHeight, width, height);
  const position = offsetToBackgroundPosition(
    offsetX,
    offsetY,
    containerWidth,
    containerHeight,
    width,
    height,
  );

  return {
    backgroundSize: `${width}px ${height}px`,
    backgroundPosition: `${position.x}% ${position.y}%`,
  };
}

export function applyBackgroundImageToElement(element, imageUrl, layout, meta) {
  if (!element) return;

  if (!imageUrl) {
    element.style.backgroundImage = '';
    element.style.backgroundSize = '';
    element.style.backgroundPosition = '';
    element.style.backgroundRepeat = '';
    return;
  }

  const width = element.clientWidth;
  const height = element.clientHeight;
  const style = computeBackgroundImageStyle(layout, meta, width, height);

  element.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
  element.style.backgroundRepeat = 'no-repeat';
  element.style.backgroundSize = style.backgroundSize;
  element.style.backgroundPosition = style.backgroundPosition;
}

export function loadImageMetaFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error('无法读取图片'));
    img.src = dataUrl;
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
