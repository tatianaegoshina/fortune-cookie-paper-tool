const framePresets = [
  { label: "1200x630", width: 1200, height: 630, textSize: 60 },
  { label: "1280x1710", width: 1280, height: 1710, textSize: 140 },
  { label: "1080x1920", width: 1080, height: 1920, textSize: 120 },
  { label: "2000x2000", width: 2000, height: 2000, textSize: 200 },
];

const palette = [
  { name: "White", hex: "#ffffff" },
  { name: "Light grey", hex: "#DBDBDB" },
  { name: "Grey", hex: "#919191" },
  { name: "Almost black", hex: "#242424" },
  { name: "Black", hex: "#000000" },
  { name: "Orange", hex: "#FF7214" },
  { name: "Red", hex: "#F82D2D" },
  { name: "Pink", hex: "#FBB1CC" },
  { name: "Plum", hex: "#BC008D" },
  { name: "Blue", hex: "#289BFF" },
  { name: "Green", hex: "#05A95E" },
];

const backgroundPalette = [...palette, { name: "Transparent", hex: "transparent" }];
const corners = ["tl", "tr", "br", "bl"];
const minFoldRatio = 0.018;
const maxFoldReachShare = 2.2;
const maxFoldAspect = 7;
const foldEdgeGapRatio = 0.012;
const defaultPaperWidth = 1100;
const defaultPaperHeight = 250;
const textDarkColors = new Set(["White", "Light grey", "Pink", "Orange", "Green"]);
const fortunes = [
  "Buy new shoes. The story needs them.",
  "Don’t confuse rest with failure.",
  "Don’t be afraid of being slow. Be afraid of stagnation.",
  "A random conversation will open the right door.",
  "Your taste will take you further than strategy.",
  "Beauty is not a distraction from your path. It is the path.",
  "Buy the flowers. They’re part of the plan.",
  "Someone is about to say exactly what you needed to hear.",
  "Stop asking for permission.",
  "An ordinary Tuesday will surprise you.",
  "A coincidence is preparing its entrance.",
  "Trust your first instinct more often.",
  "Someone will mention your name in the right room.",
  "An unexpected invitation is coming.",
  "Stop polishing. Start showing.",
  "A door opens because you knocked.",
  "Beauty is never a waste of time.",
  "The best part hasn’t happened yet.",
  "You cannot lose what has already changed you.",
  "What you seek is also seeking you.",
  "The answer arrives after the question is forgotten.",
  "A closed door protects you from the wrong room.",
  "A new friendship hides in a familiar place.",
  "The moon favors those who stay curious.",
  "What seems delayed is being prepared.",
  "The seed does not fear the dark.",
  "A smile will open a locked gate.",
  "The mountain becomes smaller with each step.",
  "The longest wait is almost over.",
  "Two paths are preparing to cross.",
  "The heart recognizes before the eyes do.",
  "Someone is thinking of you with warmth.",
  "Your heart will soon have new material for poetry.",
];

function getRandomFortune() {
  return fortunes[Math.floor(Math.random() * fortunes.length)];
}

function getRandomRange(min, max) {
  return min + Math.random() * (max - min);
}

function getRandomPaperRotation() {
  const direction = Math.random() < 0.5 ? -1 : 1;
  return direction * Math.round(getRandomRange(5, 20));
}

function getRandomFolds() {
  const cornerSets = [
    ["tl"],
    ["tr"],
    ["br"],
    ["bl"],
    ["tl", "br"],
    ["tr", "bl"],
  ];
  const activeCorners = cornerSets[Math.floor(Math.random() * cornerSets.length)];

  return Object.fromEntries(
    corners.map((corner) => {
      const enabled = activeCorners.includes(corner);
      return [
        corner,
        {
          enabled,
          x: enabled ? getRandomRange(0.08, 0.42) : 0.24,
          y: enabled ? getRandomRange(0.14, 0.66) : 0.24,
        },
      ];
    }),
  );
}

function getDefaultPaperForFrame(frame) {
  const aspectRatio = defaultPaperWidth / defaultPaperHeight;
  const width = Math.min(defaultPaperWidth, frame.width * 0.92, frame.height * 0.42 * aspectRatio);

  return {
    mode: "custom",
    width: Math.round(width),
    height: Math.round(width / aspectRatio),
    rotation: getRandomPaperRotation(),
  };
}

function createDefaultState() {
  return {
    frame: framePresets[0],
    paper: getDefaultPaperForFrame(framePresets[0]),
    background: palette[6],
    front: palette[7],
    back: palette[8],
    text: getRandomFortune(),
    textSize: framePresets[0].textSize,
    folds: getRandomFolds(),
  };
}

let state = createDefaultState();
let loadedImage = null;
let imageSrc = null;
let backgroundImage = null;
let backgroundImageSrc = null;
let imageUploadTarget = "paper";
let dragHandle = null;
let hoverHandle = null;
let history = [];
let textEditSaved = false;

const canvas = document.querySelector("#preview-canvas");
const frameOptions = document.querySelector("[data-frame-options]");
const paperModeOptions = document.querySelector("[data-paper-mode-options]");
const paperCustomFields = document.querySelector("[data-paper-custom-fields]");
const backgroundOptions = document.querySelector("[data-background-options]");
const frontOptions = document.querySelector("[data-front-options]");
const backOptions = document.querySelector("[data-back-options]");
const paperWidthInput = document.querySelector("#paper-width");
const paperHeightInput = document.querySelector("#paper-height");
const paperRotationInput = document.querySelector("#paper-rotation");
const textSizeInput = document.querySelector("#text-size");
const imageInput = document.querySelector("#image-input");
const textInput = document.querySelector("#text-input");
const undoButton = document.querySelector("[data-action='undo']");
const foldHandleLayer = document.querySelector(".fold-handle-layer");
const foldHandleButtons = Object.fromEntries(
  corners.map((corner) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "fold-handle";
    button.dataset.corner = corner;
    button.setAttribute("aria-label", `${corner} fold handle`);
    foldHandleLayer.append(button);
    return [corner, button];
  }),
);

function cloneState(source) {
  return {
    ...source,
    frame: { ...source.frame },
    paper: { ...source.paper },
    background: { ...source.background },
    front: { ...source.front },
    back: { ...source.back },
    folds: Object.fromEntries(Object.entries(source.folds).map(([corner, fold]) => [corner, { ...fold }])),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(degrees) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

function formatDegrees(degrees) {
  return Math.round(normalizeDegrees(degrees));
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function getPreviewRenderScale() {
  return Math.max(1, Math.min(3, window.devicePixelRatio || 1));
}

function snapshotState() {
  return {
    state: cloneState(state),
    imageSrc,
    loadedImage,
    backgroundImageSrc,
    backgroundImage,
  };
}

function pushHistory() {
  history.push(snapshotState());
  if (history.length > 80) history.shift();
  syncUndoState();
}

function syncUndoState() {
  if (!undoButton) return;
  const canUndo = history.length > 0;
  undoButton.disabled = !canUndo;
  undoButton.hidden = !canUndo;
}

function syncFoldStatus() {
}

function applyChange(mutator, options = {}) {
  pushHistory();
  mutator();
  if (options.sync !== false) syncControls();
  renderComposition(canvas, true);
}

function getPaperSize() {
  if (state.paper.mode === "fill") {
    return { width: state.frame.width, height: state.frame.height };
  }

  return {
    width: clamp(state.paper.width, 80, state.frame.width * 2),
    height: clamp(state.paper.height, 80, state.frame.height * 2),
  };
}

function getPaperRotation() {
  return normalizeDegrees(Number(state.paper.rotation) || 0);
}

function getRotatedPaperBounds(width, height, degrees) {
  const radians = degreesToRadians(degrees);
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

function canPaperRotationFit(degrees, width, height, frame = state.frame) {
  const bounds = getRotatedPaperBounds(width, height, degrees);
  const tolerance = 0.01;

  return bounds.width <= frame.width + tolerance && bounds.height <= frame.height + tolerance;
}

function constrainPaperRotation(degrees, width, height, frame = state.frame) {
  const normalized = normalizeDegrees(Number(degrees) || 0);
  if (canPaperRotationFit(normalized, width, height, frame)) return formatDegrees(normalized);

  for (let offset = 0.25; offset <= 180; offset += 0.25) {
    const lower = normalizeDegrees(normalized - offset);
    if (canPaperRotationFit(lower, width, height, frame)) return formatDegrees(lower);

    const upper = normalizeDegrees(normalized + offset);
    if (canPaperRotationFit(upper, width, height, frame)) return formatDegrees(upper);
  }

  return 0;
}

function constrainCurrentPaperRotation() {
  const { width, height } = getPaperSize();
  state.paper.rotation = constrainPaperRotation(getPaperRotation(), width, height);
}

function getFoldOffsets(inwardX, inwardY) {
  const distance = (inwardX * inwardX + inwardY * inwardY) / 2;

  return {
    x: inwardX > 0 ? distance / inwardX : 0,
    y: inwardY > 0 ? distance / inwardY : 0,
  };
}

function normalizeFoldRatios(xRatio, yRatio, width, height) {
  let inwardX = clamp(xRatio, 0, maxFoldReachShare) * width;
  let inwardY = clamp(yRatio, 0, maxFoldReachShare) * height;
  const minX = width * minFoldRatio;
  const minY = height * minFoldRatio;

  if (inwardX < minX || inwardY < minY) {
    return { enabled: false, x: 0, y: 0, inwardX: 0, inwardY: 0, offsetX: 0, offsetY: 0 };
  }

  for (let index = 0; index < 8; index += 1) {
    const aspect = inwardX / inwardY;
    if (aspect > maxFoldAspect) inwardX = inwardY * maxFoldAspect;
    if (aspect < 1 / maxFoldAspect) inwardY = inwardX * maxFoldAspect;
    break;
  }

  const offsets = getFoldOffsets(inwardX, inwardY);

  return {
    enabled: true,
    x: inwardX / width,
    y: inwardY / height,
    inwardX,
    inwardY,
    offsetX: clamp(offsets.x, 12, width * maxFoldReachShare),
    offsetY: clamp(offsets.y, 12, height * maxFoldReachShare),
  };
}

function getFoldPoints(corner, fold, width, height) {
  const normalized = fold.enabled ? normalizeFoldRatios(fold.x, fold.y, width, height) : null;
  const isEnabled = Boolean(normalized?.enabled);
  const inwardX = normalized?.inwardX ?? 0;
  const inwardY = normalized?.inwardY ?? 0;
  const offsetX = normalized?.offsetX ?? 12;
  const offsetY = normalized?.offsetY ?? 12;

  if (corner === "tl") {
    return {
      corner: { x: 0, y: 0 },
      tip: isEnabled ? { x: inwardX, y: inwardY } : { x: 0, y: 0 },
      xPoint: { x: offsetX, y: 0 },
      yPoint: { x: 0, y: offsetY },
    };
  }
  if (corner === "tr") {
    return {
      corner: { x: width, y: 0 },
      tip: isEnabled ? { x: width - inwardX, y: inwardY } : { x: width, y: 0 },
      xPoint: { x: width - offsetX, y: 0 },
      yPoint: { x: width, y: offsetY },
    };
  }
  if (corner === "br") {
    return {
      corner: { x: width, y: height },
      tip: isEnabled ? { x: width - inwardX, y: height - inwardY } : { x: width, y: height },
      xPoint: { x: width - offsetX, y: height },
      yPoint: { x: width, y: height - offsetY },
    };
  }

  return {
    corner: { x: 0, y: height },
    tip: isEnabled ? { x: inwardX, y: height - inwardY } : { x: 0, y: height },
    xPoint: { x: offsetX, y: height },
    yPoint: { x: 0, y: height - offsetY },
  };
}

function getRectanglePolygon(width, height) {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

function getCornerPoint(corner, width, height) {
  if (corner === "tl") return { x: 0, y: 0 };
  if (corner === "tr") return { x: width, y: 0 };
  if (corner === "br") return { x: width, y: height };
  return { x: 0, y: height };
}

function getFoldLine(corner, fold, width, height) {
  if (!fold.enabled) return null;
  const points = getFoldPoints(corner, fold, width, height);
  const cornerPoint = getCornerPoint(corner, width, height);
  const normal = {
    x: points.tip.x - cornerPoint.x,
    y: points.tip.y - cornerPoint.y,
  };
  const normalLengthSq = normal.x * normal.x + normal.y * normal.y;

  if (normalLengthSq < 1) return null;

  const midpoint = {
    x: (cornerPoint.x + points.tip.x) / 2,
    y: (cornerPoint.y + points.tip.y) / 2,
  };

  return {
    cornerPoint,
    midpoint,
    normal,
    normalLengthSq,
    cornerSign: -1,
  };
}

function getLineDistance(point, line) {
  return (point.x - line.midpoint.x) * line.normal.x + (point.y - line.midpoint.y) * line.normal.y;
}

function getLineIntersection(start, end, line) {
  const startDistance = getLineDistance(start, line);
  const endDistance = getLineDistance(end, line);
  const t = startDistance / (startDistance - endDistance);

  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function clipPolygonToFoldSide(polygon, line, keepFoldedSide) {
  if (polygon.length === 0) return [];
  const clipped = [];
  const isInside = (point) => {
    const side = getLineDistance(point, line) * line.cornerSign;
    return keepFoldedSide ? side >= -0.001 : side <= 0.001;
  };

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = isInside(current);
    const previousInside = isInside(previous);

    if (currentInside !== previousInside) clipped.push(getLineIntersection(previous, current, line));
    if (currentInside) clipped.push(current);
  }

  return clipped;
}

function reflectPointAcrossFold(point, line) {
  const distance = getLineDistance(point, line);
  const factor = (2 * distance) / line.normalLengthSq;

  return {
    x: point.x - factor * line.normal.x,
    y: point.y - factor * line.normal.y,
  };
}

function addPolygonPath(ctx, polygon) {
  ctx.beginPath();
  if (polygon.length === 0) {
    ctx.rect(0, 0, 0, 0);
    return;
  }

  ctx.moveTo(polygon[0].x, polygon[0].y);
  polygon.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
}

function isPointInPolygon(point, polygon) {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const intersectX = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;

    if (crossesY && point.x < intersectX) inside = !inside;
  }

  return inside;
}

function getFoldGeometry(corner, fold, width, height, sourcePolygon = getRectanglePolygon(width, height)) {
  const line = getFoldLine(corner, fold, width, height);
  if (!line) return null;

  const foldedPolygon = clipPolygonToFoldSide(sourcePolygon, line, true);
  if (foldedPolygon.length < 3) return null;

  return {
    line,
    foldedPolygon,
    reflectedPolygon: foldedPolygon.map((point) => reflectPointAcrossFold(point, line)),
  };
}

function getFoldGeometries(width, height) {
  let visiblePolygon = getRectanglePolygon(width, height);
  const geometries = [];

  corners.forEach((corner) => {
    const geometry = getFoldGeometry(corner, state.folds[corner], width, height, visiblePolygon);
    if (!geometry) return;

    geometries.push(geometry);
    visiblePolygon = clipPolygonToFoldSide(visiblePolygon, geometry.line, false);
  });

  return { geometries, visiblePolygon };
}

function getVisiblePaperPolygon(width, height) {
  return getFoldGeometries(width, height).visiblePolygon;
}

function getPointsOnEdge(polygon, edge, width, height) {
  const tolerance = 0.5;

  return polygon.filter((point) => {
    if (edge === "top") return Math.abs(point.y) <= tolerance;
    if (edge === "right") return Math.abs(point.x - width) <= tolerance;
    if (edge === "bottom") return Math.abs(point.y - height) <= tolerance;
    return Math.abs(point.x) <= tolerance;
  });
}

function getFoldEdgeUsage(corner, fold, width, height) {
  const geometry = getFoldGeometry(corner, fold, width, height);
  if (!geometry) return { top: 0, right: 0, bottom: 0, left: 0 };

  const getLength = (edge) => {
    const points = getPointsOnEdge(geometry.foldedPolygon, edge, width, height);
    if (points.length < 2) return 0;
    const values = points.map((point) => (edge === "top" || edge === "bottom" ? point.x : point.y));

    return Math.max(...values) - Math.min(...values);
  };

  return {
    top: corner === "tl" || corner === "tr" ? getLength("top") : 0,
    right: corner === "tr" || corner === "br" ? getLength("right") : 0,
    bottom: corner === "bl" || corner === "br" ? getLength("bottom") : 0,
    left: corner === "tl" || corner === "bl" ? getLength("left") : 0,
  };
}

function normalizeStateFold(corner, width, height) {
  const fold = state.folds[corner];
  const normalized = normalizeFoldRatios(fold.x, fold.y, width, height);

  fold.enabled = normalized.enabled;
  fold.x = normalized.x;
  fold.y = normalized.y;
}

function keepDraggedFoldInsideOpenEdges(corner, width, height) {
  const fold = state.folds[corner];
  if (!fold.enabled) return;

  const edgeRules = {
    tl: [
      { edge: "top", neighbor: "tr", length: width },
      { edge: "left", neighbor: "bl", length: height },
    ],
    tr: [
      { edge: "top", neighbor: "tl", length: width },
      { edge: "right", neighbor: "br", length: height },
    ],
    br: [
      { edge: "right", neighbor: "tr", length: height },
      { edge: "bottom", neighbor: "bl", length: width },
    ],
    bl: [
      { edge: "bottom", neighbor: "br", length: width },
      { edge: "left", neighbor: "tl", length: height },
    ],
  };

  for (let index = 0; index < 8; index += 1) {
    const currentUse = getFoldEdgeUsage(corner, fold, width, height);
    let scale = 1;

    edgeRules[corner].forEach(({ edge, neighbor, length }) => {
      const neighborUse = getFoldEdgeUsage(neighbor, state.folds[neighbor], width, height);
      const gap = Math.max(12, length * foldEdgeGapRatio);
      const available = Math.max(0, length - gap - neighborUse[edge]);
      if (currentUse[edge] > available && currentUse[edge] > 0) {
        scale = Math.min(scale, available / currentUse[edge]);
      }
    });

    if (scale > 0.999) break;
    fold.x *= scale;
    fold.y *= scale;
    normalizeStateFold(corner, width, height);
    if (!fold.enabled) break;
  }
}

function getInwardFromLocal(corner, local) {
  if (corner === "tl") {
    return { x: local.x / local.paperWidth, y: local.y / local.paperHeight };
  }
  if (corner === "tr") {
    return { x: (local.paperWidth - local.x) / local.paperWidth, y: local.y / local.paperHeight };
  }
  if (corner === "br") {
    return {
      x: (local.paperWidth - local.x) / local.paperWidth,
      y: (local.paperHeight - local.y) / local.paperHeight,
    };
  }

  return { x: local.x / local.paperWidth, y: (local.paperHeight - local.y) / local.paperHeight };
}

function getPaperPointViewport(point, paperWidth, paperHeight) {
  const rect = canvas.getBoundingClientRect();
  const stageRect = canvas.parentElement.getBoundingClientRect();
  const scaleX = rect.width / state.frame.width;
  const scaleY = rect.height / state.frame.height;
  const radians = degreesToRadians(getPaperRotation());
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centeredX = point.x - paperWidth / 2;
  const centeredY = point.y - paperHeight / 2;
  const canvasX = state.frame.width / 2 + centeredX * cos - centeredY * sin;
  const canvasY = state.frame.height / 2 + centeredX * sin + centeredY * cos;

  return {
    x: rect.left - stageRect.left + canvasX * scaleX,
    y: rect.top - stageRect.top + canvasY * scaleY,
  };
}

function syncFoldHandles() {
  const { width: paperWidth, height: paperHeight } = getPaperSize();

  for (const corner of corners) {
    const button = foldHandleButtons[corner];
    const points = getFoldPoints(corner, state.folds[corner], paperWidth, paperHeight);
    const position = getPaperPointViewport(points.tip, paperWidth, paperHeight);
    const isVisible = dragHandle?.corner === corner || hoverHandle?.corner === corner;

    button.style.left = `${position.x}px`;
    button.style.top = `${position.y}px`;
    button.classList.toggle("is-visible", isVisible);
  }
}

function addFrontPath(ctx, width, height) {
  addPolygonPath(ctx, getVisiblePaperPolygon(width, height));
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const rectRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;

  if (imageRatio > rectRatio) {
    drawHeight = height;
    drawWidth = height * imageRatio;
  } else {
    drawWidth = width;
    drawHeight = width / imageRatio;
  }

  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function wrapText(ctx, text, maxWidth) {
  return text.split("\n").flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [""];

    const lines = [];
    let line = words[0];

    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${line} ${words[index]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = words[index];
      }
    }

    lines.push(line);
    return lines;
  });
}

function setTextFont(ctx, fontSize) {
  ctx.font = `${fontSize}px "GT Ultra Median", Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${fontSize * -0.006}px`;
}

function measureTextLayout(ctx, fontSize, maxWidth) {
  setTextFont(ctx, fontSize);
  const lines = wrapText(ctx, state.text, maxWidth);
  const lineHeight = fontSize * 0.98;
  const textHeight = (lines.length - 1) * lineHeight + fontSize;
  const maxLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 0);

  return { fontSize, lines, lineHeight, textHeight, maxLineWidth };
}

function getPaperTextLayout(ctx, paperWidth, paperHeight) {
  const maxWidth = paperWidth * 0.78;
  const maxHeight = paperHeight * 0.74;
  const maxFontSize = clamp(state.textSize, 12, Math.min(paperWidth, paperHeight) * 0.42);
  let low = 12;
  let high = maxFontSize;
  let layout = measureTextLayout(ctx, low, maxWidth);

  for (let index = 0; index < 18; index += 1) {
    const candidateSize = (low + high) / 2;
    const candidate = measureTextLayout(ctx, candidateSize, maxWidth);
    const fits = candidate.textHeight <= maxHeight && candidate.maxLineWidth <= maxWidth;

    if (fits) {
      low = candidateSize;
      layout = candidate;
    } else {
      high = candidateSize;
    }
  }

  setTextFont(ctx, layout.fontSize);

  return {
    ...layout,
    startY: paperHeight / 2 - ((layout.lines.length - 1) * layout.lineHeight) / 2,
    maxWidth,
  };
}

function isTextHit(local) {
  if (!state.text.trim()) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const layout = getPaperTextLayout(ctx, local.paperWidth, local.paperHeight);
  const maxLineWidth = Math.max(...layout.lines.map((line) => ctx.measureText(line).width), 0);
  const left = local.paperWidth / 2 - maxLineWidth / 2;
  const right = local.paperWidth / 2 + maxLineWidth / 2;
  const top = layout.startY - layout.fontSize / 2;
  const bottom = layout.startY + (layout.lines.length - 1) * layout.lineHeight + layout.fontSize / 2;

  return local.x >= left && local.x <= right && local.y >= top && local.y <= bottom;
}

function isPaperHit(local) {
  return isPointInPolygon({ x: local.x, y: local.y }, getVisiblePaperPolygon(local.paperWidth, local.paperHeight));
}

function openTextEditor(selectText = true, closeMenus = true) {
  if (closeMenus) closeOpenMenus();
  const { width: paperWidth, height: paperHeight } = getPaperSize();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const layout = getPaperTextLayout(ctx, paperWidth, paperHeight);
  const canvasRect = canvas.getBoundingClientRect();
  const stageRect = canvas.parentElement.getBoundingClientRect();
  const scaleX = canvasRect.width / state.frame.width;
  const scaleY = canvasRect.height / state.frame.height;
  const editorWidth = layout.maxWidth * scaleX;
  const editorHeight = Math.max(layout.fontSize * 1.2, (layout.lines.length - 1) * layout.lineHeight + layout.fontSize) * scaleY;
  const centerX = canvasRect.left - stageRect.left + (state.frame.width / 2) * scaleX;
  const centerY = canvasRect.top - stageRect.top + (state.frame.height / 2) * scaleY;
  const textColor = loadedImage || textDarkColors.has(state.front.name) ? "#000000" : "#ffffff";

  if (selectText || !textInput.classList.contains("is-editing")) textInput.value = state.text;
  textInput.style.left = `${centerX - editorWidth / 2}px`;
  textInput.style.top = `${centerY - editorHeight / 2}px`;
  textInput.style.width = `${editorWidth}px`;
  textInput.style.height = `${editorHeight}px`;
  textInput.style.fontSize = `${layout.fontSize * scaleY}px`;
  textInput.style.letterSpacing = `${layout.fontSize * scaleY * -0.006}px`;
  textInput.style.color = textColor;
  textInput.style.transform = `rotate(${getPaperRotation()}deg)`;
  textInput.classList.add("is-editing");
  renderComposition(canvas, true);
  if (selectText) {
    textInput.focus();
    textInput.select();
  }
}

function closeTextEditor(render = true) {
  const wasEditing = textInput.classList.contains("is-editing");
  textInput.classList.remove("is-editing");
  textEditSaved = false;
  if (wasEditing && render) renderComposition(canvas, true);
}

function renderComposition(targetCanvas, showGuides, renderScale = targetCanvas === canvas ? getPreviewRenderScale() : 1) {
  const { frame } = state;
  const { width: paperWidth, height: paperHeight } = getPaperSize();
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  targetCanvas.width = Math.round(frame.width * renderScale);
  targetCanvas.height = Math.round(frame.height * renderScale);
  if (targetCanvas === canvas) {
    targetCanvas.style.setProperty("--frame-width", frame.width);
    targetCanvas.style.setProperty("--frame-height", frame.height);
    targetCanvas.style.setProperty("--frame-ratio", frame.width / frame.height);
    targetCanvas.style.aspectRatio = `${frame.width} / ${frame.height}`;
    targetCanvas.style.height = "auto";
  }
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, frame.width, frame.height);

  if (state.background.hex !== "transparent") {
    ctx.fillStyle = state.background.hex;
    ctx.fillRect(0, 0, frame.width, frame.height);
  }
  if (backgroundImage) drawCoverImage(ctx, backgroundImage, 0, 0, frame.width, frame.height);

  ctx.save();
  ctx.translate(frame.width / 2, frame.height / 2);
  ctx.rotate(degreesToRadians(getPaperRotation()));
  ctx.translate(-paperWidth / 2, -paperHeight / 2);

  const foldRender = getFoldGeometries(paperWidth, paperHeight);

  ctx.save();
  addPolygonPath(ctx, foldRender.visiblePolygon);
  ctx.clip();
  ctx.fillStyle = state.front.hex;
  ctx.fillRect(0, 0, paperWidth, paperHeight);
  if (loadedImage) drawCoverImage(ctx, loadedImage, 0, 0, paperWidth, paperHeight);

  const isEditingText = targetCanvas === canvas && textInput.classList.contains("is-editing");
  if (state.text.trim() && !isEditingText) {
    const textColor = loadedImage || textDarkColors.has(state.front.name) ? "#000000" : "#ffffff";
    ctx.fillStyle = textColor;
    const layout = getPaperTextLayout(ctx, paperWidth, paperHeight);
    layout.lines.forEach((line, index) => ctx.fillText(line, paperWidth / 2, layout.startY + index * layout.lineHeight));
  }
  ctx.restore();

  for (const geometry of foldRender.geometries) {
    addPolygonPath(ctx, geometry.reflectedPolygon);
    ctx.fillStyle = state.back.hex;
    ctx.fill();
  }

  if (showGuides && targetCanvas === canvas) syncFoldHandles();
  ctx.restore();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function capitalizeLabel(label) {
  return String(label).replace(/^(\s*)([a-zа-яё])/, (match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function makeButton(label, active, onClick) {
  const displayLabel = capitalizeLabel(label);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `select-button${active ? " is-active" : ""}`;
  button.textContent = displayLabel;
  button.addEventListener("click", onClick);
  return button;
}

function makeSwatch(color, active, onClick) {
  const displayName = capitalizeLabel(color.name);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `swatch${active ? " is-active" : ""}${color.hex === "transparent" ? " is-transparent" : ""}`;
  button.textContent = displayName;
  button.title = `${displayName} ${color.hex}`;
  button.setAttribute("aria-label", displayName);
  button.addEventListener("click", onClick);
  return button;
}

function syncControls() {
  frameOptions.replaceChildren(
    ...framePresets.map((preset) =>
      makeButton(preset.label, state.frame.label === preset.label, () => {
        applyChange(() => {
          state.frame = preset;
          state.paper = getDefaultPaperForFrame(preset);
          state.textSize = preset.textSize;
          state.folds = getRandomFolds();
          constrainCurrentPaperRotation();
        });
      }),
    ),
  );

  paperModeOptions.replaceChildren(
    makeButton("Fill", state.paper.mode === "fill", () => {
      applyChange(() => {
        state.paper.mode = "fill";
        state.paper.rotation = 0;
      });
    }),
    makeButton("Custom", state.paper.mode === "custom", () => {
      applyChange(() => {
        state.paper.mode = "custom";
        state.paper.width = state.frame.width;
        state.paper.height = state.frame.height;
        constrainCurrentPaperRotation();
      });
    }),
  );

  backgroundOptions.replaceChildren(
    ...backgroundPalette.map((color) =>
      makeSwatch(color, state.background.name === color.name, () => {
        applyChange(() => {
          state.background = color;
        });
      }),
    ),
  );

  frontOptions.replaceChildren(
    ...palette.map((color) =>
      makeSwatch(color, state.front.name === color.name, () => {
        applyChange(() => {
          state.front = color;
        });
      }),
    ),
  );

  backOptions.replaceChildren(
    ...palette.map((color) =>
      makeSwatch(color, state.back.name === color.name, () => {
        applyChange(() => {
          state.back = color;
        });
      }),
    ),
  );

  const paperSize = getPaperSize();
  paperWidthInput.value = String(Math.round(state.paper.mode === "fill" ? paperSize.width : state.paper.width));
  paperHeightInput.value = String(Math.round(state.paper.mode === "fill" ? paperSize.height : state.paper.height));
  paperCustomFields.hidden = state.paper.mode !== "custom";
  paperRotationInput.value = String(formatDegrees(getPaperRotation()));
  textSizeInput.value = String(Math.round(state.textSize));
  textInput.value = state.text;
  syncFoldStatus();
  syncUndoState();
}

function getLocalPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = ((event.clientX - rect.left) / rect.width) * state.frame.width;
  const canvasY = ((event.clientY - rect.top) / rect.height) * state.frame.height;
  const paperSize = getPaperSize();
  const translatedX = canvasX - state.frame.width / 2;
  const translatedY = canvasY - state.frame.height / 2;
  const radians = degreesToRadians(-getPaperRotation());
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const paperX = translatedX * cos - translatedY * sin;
  const paperY = translatedX * sin + translatedY * cos;

  return {
    x: paperX + paperSize.width / 2,
    y: paperY + paperSize.height / 2,
    paperWidth: paperSize.width,
    paperHeight: paperSize.height,
  };
}

function findHandle(local) {
  const threshold = Math.max(local.paperWidth, local.paperHeight) * 0.055;
  let match = null;
  let bestDistance = Infinity;

  for (const corner of corners) {
    const points = getFoldPoints(corner, state.folds[corner], local.paperWidth, local.paperHeight);
    const distance = Math.hypot(local.x - points.tip.x, local.y - points.tip.y);
    if (distance < threshold && distance < bestDistance) {
      bestDistance = distance;
      match = { corner };
    }
  }

  return match;
}

function moveHandle(handle, local) {
  if (!dragHandle.saved) {
    pushHistory();
    dragHandle.saved = true;
  }
  const fold = state.folds[handle.corner];
  const inward = getInwardFromLocal(handle.corner, local);
  const normalized = normalizeFoldRatios(inward.x, inward.y, local.paperWidth, local.paperHeight);

  if (!normalized.enabled) {
    fold.enabled = false;
    fold.x = 0;
    fold.y = 0;
  } else {
    fold.enabled = true;
    fold.x = normalized.x;
    fold.y = normalized.y;
    keepDraggedFoldInsideOpenEdges(handle.corner, local.paperWidth, local.paperHeight);
  }

  syncControls();
  renderComposition(canvas, true);
  syncFoldHandles();
}

function exportPng() {
  const finish = () => {
    closeTextEditor(false);
    const exportCanvas = document.createElement("canvas");
    renderComposition(exportCanvas, false, 2);
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fortune-cookie-paper-${state.frame.label}@2x.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(finish);
  } else {
    finish();
  }
}

function reset() {
  closeTextEditor(false);
  applyChange(() => {
    state = createDefaultState();
    loadedImage = null;
    imageSrc = null;
    backgroundImage = null;
    backgroundImageSrc = null;
  });
}

paperWidthInput.addEventListener("input", () => {
  pushHistory();
  state.paper.width = Number(paperWidthInput.value) || 80;
  constrainCurrentPaperRotation();
  syncControls();
  renderComposition(canvas, true);
});

paperHeightInput.addEventListener("input", () => {
  pushHistory();
  state.paper.height = Number(paperHeightInput.value) || 80;
  constrainCurrentPaperRotation();
  syncControls();
  renderComposition(canvas, true);
});

paperRotationInput.addEventListener("input", () => {
  const rawRotation = paperRotationInput.value.trim();
  if (rawRotation === "" || rawRotation === "-" || rawRotation === "." || rawRotation === "-.") return;

  const { width, height } = getPaperSize();
  const nextRotation = Math.round(Number(rawRotation));
  if (!Number.isFinite(nextRotation)) return;

  pushHistory();
  state.paper.rotation = constrainPaperRotation(nextRotation, width, height);
  syncControls();
  renderComposition(canvas, true);
});

textSizeInput.addEventListener("input", () => {
  pushHistory();
  state.textSize = clamp(Number(textSizeInput.value) || 1, 1, 999);
  if (textInput.classList.contains("is-editing")) openTextEditor(false, false);
  renderComposition(canvas, true);
});

textInput.addEventListener("input", () => {
  if (!textEditSaved) {
    pushHistory();
    textEditSaved = true;
  }
  state.text = textInput.value;
  openTextEditor(false);
});

textInput.addEventListener("blur", closeTextEditor);
textInput.addEventListener("pointerdown", (event) => event.stopPropagation());

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  pushHistory();
  const src = await readFileAsDataUrl(file);
  const image = await loadImage(src);
  if (imageUploadTarget === "background") {
    backgroundImageSrc = src;
    backgroundImage = image;
  } else {
    imageSrc = src;
    loadedImage = image;
  }
  imageInput.value = "";
  syncControls();
  renderComposition(canvas, true);
});

document.querySelectorAll("[data-action='load-image']").forEach((button) =>
  button.addEventListener("click", () => {
    imageUploadTarget = "paper";
    imageInput.click();
  }),
);
document.querySelectorAll("[data-action='load-background-image']").forEach((button) =>
  button.addEventListener("click", () => {
    imageUploadTarget = "background";
    imageInput.click();
  }),
);
document.querySelectorAll("[data-action='reset']").forEach((button) => button.addEventListener("click", reset));
document.querySelector("[data-action='export']").addEventListener("click", exportPng);
undoButton.addEventListener("click", () => {
  const snapshot = history.pop();
  if (!snapshot) return;
  state = cloneState(snapshot.state);
  imageSrc = snapshot.imageSrc;
  loadedImage = snapshot.loadedImage;
  backgroundImageSrc = snapshot.backgroundImageSrc;
  backgroundImage = snapshot.backgroundImage;
  syncControls();
  renderComposition(canvas, true);
});

canvas.addEventListener("pointerdown", (event) => {
  const local = getLocalPointer(event);
  const handle = findHandle(local);
  if (!handle) {
    if (isTextHit(local)) {
      event.preventDefault();
      openTextEditor();
    }
    return;
  }
  event.preventDefault();
  closeTextEditor();
  hoverHandle = handle;
  dragHandle = { ...handle, saved: false };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
  syncFoldStatus();
  renderComposition(canvas, true);
  syncFoldHandles();
});

canvas.addEventListener("dblclick", (event) => {
  const local = getLocalPointer(event);
  if (state.text.trim() || !isPaperHit(local)) return;

  event.preventDefault();
  openTextEditor();
});

canvas.addEventListener("pointermove", (event) => {
  const local = getLocalPointer(event);
  if (dragHandle) {
    moveHandle(dragHandle, local);
    return;
  }

  hoverHandle = findHandle(local);
  syncFoldHandles();
});

function endDrag() {
  dragHandle = null;
  hoverHandle = null;
  canvas.classList.remove("is-dragging");
  syncFoldStatus();
  renderComposition(canvas, true);
  syncFoldHandles();
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => {
  if (dragHandle) return;
  hoverHandle = null;
  syncFoldHandles();
});


function closeOpenMenus(except = null) {
  document.querySelectorAll(".menu-panel[open]").forEach((panel) => {
    if (panel !== except) panel.removeAttribute("open");
  });
}

document.querySelectorAll(".menu-panel").forEach((panel) => {
  panel.addEventListener("toggle", () => {
    if (panel.open) closeOpenMenus(panel);
  });
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".menu-panel")) closeOpenMenus();
});

window.addEventListener("resize", syncFoldHandles);

syncControls();
renderComposition(canvas, true);
if (document.fonts?.load) {
  document.fonts.load('80px "GT Ultra Median"').finally(() => {
    renderComposition(canvas, true);
    syncFoldHandles();
  });
}
