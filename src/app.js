const framePresets = [
  { label: "2000x500", width: 2000, height: 500, textSize: 120 },
  { label: "1280x1710", width: 1280, height: 1710, textSize: 140 },
  { label: "1200x630", width: 1200, height: 630, textSize: 100 },
  { label: "1080x1920", width: 1080, height: 1920, textSize: 120 },
  { label: "2000x2000", width: 2000, height: 2000, textSize: 200 },
];

const palette = [
  { name: "white", hex: "#ffffff" },
  { name: "light grey", hex: "#DBDBDB" },
  { name: "grey", hex: "#919191" },
  { name: "almost black", hex: "#242424" },
  { name: "black", hex: "#000000" },
  { name: "orange", hex: "#FF7214" },
  { name: "red", hex: "#F82D2D" },
  { name: "pink", hex: "#FBB1CC" },
  { name: "plum", hex: "#BC008D" },
  { name: "bright blue", hex: "#289BFF" },
  { name: "green", hex: "#05A95E" },
];

const backgroundPalette = [...palette, { name: "transparent", hex: "transparent" }];
const corners = ["tl", "tr", "br", "bl"];
const textDarkColors = new Set(["white", "light grey", "pink", "orange", "green"]);
const fortunes = [
  "The luck is already looking for you.",
  "Don’t confuse rest with failure.",
  "Buy the shoes. The story needs them.",
  "Someone remembers you more often than you think.",
  "Your life changes quietly before it changes loudly.",
  "Don’t be afraid of being slow. Be afraid of standing still.",
  "A random conversation will open the right door.",
  "Your taste will take you further than strategy.",
  "You are closer than your anxiety admits.",
  "Beauty is not a distraction from your path. It is the path.",
];

function getRandomFortune() {
  return fortunes[Math.floor(Math.random() * fortunes.length)];
}

const defaultState = {
  frame: framePresets[0],
  paper: { mode: "fill", width: 1480, height: 1480 },
  background: palette[4],
  front: palette[10],
  back: palette[0],
  text: getRandomFortune(),
  textSize: framePresets[0].textSize,
  folds: {
    tl: { enabled: false, x: 0.24, y: 0.24 },
    tr: { enabled: false, x: 0.24, y: 0.24 },
    br: { enabled: false, x: 0.24, y: 0.24 },
    bl: { enabled: false, x: 0.24, y: 0.24 },
  },
};

let state = cloneState(defaultState);
let loadedImage = null;
let imageSrc = null;
let dragHandle = null;
let history = [];

const canvas = document.querySelector("#preview-canvas");
const frameOptions = document.querySelector("[data-frame-options]");
const paperModeOptions = document.querySelector("[data-paper-mode-options]");
const backgroundOptions = document.querySelector("[data-background-options]");
const frontOptions = document.querySelector("[data-front-options]");
const backOptions = document.querySelector("[data-back-options]");
const paperWidthInput = document.querySelector("#paper-width");
const paperHeightInput = document.querySelector("#paper-height");
const imageInput = document.querySelector("#image-input");
const textInput = document.querySelector("#text-input");
const undoButton = document.querySelector("[data-action='undo']");

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

function snapshotState() {
  return {
    state: cloneState(state),
    imageSrc,
    loadedImage,
  };
}

function pushHistory() {
  history.push(snapshotState());
  if (history.length > 80) history.shift();
  syncUndoState();
}

function syncUndoState() {
  if (undoButton) undoButton.disabled = history.length === 0;
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

function getFoldPoints(corner, fold, width, height) {
  const inwardX = clamp(fold.x * width, 0, width * 0.82);
  const inwardY = clamp(fold.y * height, 0, height * 0.82);
  const distance = (inwardX * inwardX + inwardY * inwardY) / 2;
  const offsetX = inwardX > 0 ? clamp(distance / inwardX, 12, width) : 12;
  const offsetY = inwardY > 0 ? clamp(distance / inwardY, 12, height) : 12;

  if (corner === "tl") {
    return {
      corner: { x: 0, y: 0 },
      tip: fold.enabled ? { x: inwardX, y: inwardY } : { x: 0, y: 0 },
      xPoint: { x: offsetX, y: 0 },
      yPoint: { x: 0, y: offsetY },
    };
  }
  if (corner === "tr") {
    return {
      corner: { x: width, y: 0 },
      tip: fold.enabled ? { x: width - inwardX, y: inwardY } : { x: width, y: 0 },
      xPoint: { x: width - offsetX, y: 0 },
      yPoint: { x: width, y: offsetY },
    };
  }
  if (corner === "br") {
    return {
      corner: { x: width, y: height },
      tip: fold.enabled ? { x: width - inwardX, y: height - inwardY } : { x: width, y: height },
      xPoint: { x: width - offsetX, y: height },
      yPoint: { x: width, y: height - offsetY },
    };
  }

  return {
    corner: { x: 0, y: height },
    tip: fold.enabled ? { x: inwardX, y: height - inwardY } : { x: 0, y: height },
    xPoint: { x: offsetX, y: height },
    yPoint: { x: 0, y: height - offsetY },
  };
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

function addFrontPath(ctx, width, height) {
  const { folds } = state;
  const tl = getFoldPoints("tl", folds.tl, width, height);
  const tr = getFoldPoints("tr", folds.tr, width, height);
  const br = getFoldPoints("br", folds.br, width, height);
  const bl = getFoldPoints("bl", folds.bl, width, height);

  ctx.beginPath();
  if (folds.tl.enabled) ctx.moveTo(tl.xPoint.x, tl.xPoint.y);
  else ctx.moveTo(0, 0);

  if (folds.tr.enabled) {
    ctx.lineTo(tr.xPoint.x, tr.xPoint.y);
    ctx.lineTo(tr.yPoint.x, tr.yPoint.y);
  } else {
    ctx.lineTo(width, 0);
  }

  if (folds.br.enabled) {
    ctx.lineTo(br.yPoint.x, br.yPoint.y);
    ctx.lineTo(br.xPoint.x, br.xPoint.y);
  } else {
    ctx.lineTo(width, height);
  }

  if (folds.bl.enabled) {
    ctx.lineTo(bl.xPoint.x, bl.xPoint.y);
    ctx.lineTo(bl.yPoint.x, bl.yPoint.y);
  } else {
    ctx.lineTo(0, height);
  }

  if (folds.tl.enabled) ctx.lineTo(tl.yPoint.x, tl.yPoint.y);
  else ctx.lineTo(0, 0);

  ctx.closePath();
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

function renderComposition(targetCanvas, showGuides) {
  const { frame } = state;
  const { width: paperWidth, height: paperHeight } = getPaperSize();
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return;

  targetCanvas.width = frame.width;
  targetCanvas.height = frame.height;
  ctx.clearRect(0, 0, frame.width, frame.height);

  if (state.background.hex !== "transparent") {
    ctx.fillStyle = state.background.hex;
    ctx.fillRect(0, 0, frame.width, frame.height);
  }

  ctx.save();
  ctx.translate(frame.width / 2, frame.height / 2);
  ctx.translate(-paperWidth / 2, -paperHeight / 2);

  ctx.save();
  addFrontPath(ctx, paperWidth, paperHeight);
  ctx.clip();
  ctx.fillStyle = state.front.hex;
  ctx.fillRect(0, 0, paperWidth, paperHeight);
  if (loadedImage) drawCoverImage(ctx, loadedImage, 0, 0, paperWidth, paperHeight);

  if (state.text.trim()) {
    const textColor = loadedImage || textDarkColors.has(state.front.name) ? "#000000" : "#ffffff";
    const fontSize = clamp(state.textSize, 12, Math.min(paperWidth, paperHeight) * 0.42);
    ctx.font = `${fontSize}px "GT Ultra Median", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;

    const lines = wrapText(ctx, state.text, paperWidth * 0.78);
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${fontSize * -0.006}px`;
    const lineHeight = fontSize * 0.98;
    const startY = paperHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => ctx.fillText(line, paperWidth / 2, startY + index * lineHeight));
  }
  ctx.restore();

  for (const corner of corners) {
    const fold = state.folds[corner];
    if (!fold.enabled) continue;
    const points = getFoldPoints(corner, fold, paperWidth, paperHeight);
    ctx.beginPath();
    ctx.moveTo(points.xPoint.x, points.xPoint.y);
    ctx.lineTo(points.tip.x, points.tip.y);
    ctx.lineTo(points.yPoint.x, points.yPoint.y);
    ctx.closePath();
    ctx.fillStyle = state.back.hex;
    ctx.fill();
  }

  if (showGuides) drawGuides(ctx, paperWidth, paperHeight);
  ctx.restore();
}

function drawGuides(ctx, paperWidth, paperHeight) {
  const radius = Math.max(12, Math.min(paperWidth, paperHeight) * 0.018);

  if (dragHandle) {
    ctx.lineWidth = Math.max(1, Math.min(paperWidth, paperHeight) * 0.003);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.setLineDash([Math.max(6, paperWidth * 0.012), Math.max(6, paperWidth * 0.012)]);

    const fold = state.folds[dragHandle.corner];
    if (fold.enabled) {
      const points = getFoldPoints(dragHandle.corner, fold, paperWidth, paperHeight);
      ctx.beginPath();
      ctx.moveTo(points.xPoint.x, points.xPoint.y);
      ctx.lineTo(points.yPoint.x, points.yPoint.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  for (const corner of corners) {
    const points = getFoldPoints(corner, state.folds[corner], paperWidth, paperHeight);
    ctx.beginPath();
    ctx.arc(points.tip.x, points.tip.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d0d0";
    ctx.fill();
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.strokeStyle = "#000000";
    ctx.stroke();
  }
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

function makeButton(label, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `select-button${active ? " is-active" : ""}`;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function makeSwatch(color, active, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `swatch${active ? " is-active" : ""}${color.hex === "transparent" ? " is-transparent" : ""}`;
  button.textContent = color.name;
  button.title = `${color.name} ${color.hex}`;
  button.setAttribute("aria-label", color.name);
  button.addEventListener("click", onClick);
  return button;
}

function syncControls() {
  frameOptions.replaceChildren(
    ...framePresets.map((preset) =>
      makeButton(preset.label, state.frame.label === preset.label, () => {
        applyChange(() => {
          state.frame = preset;
          state.textSize = preset.textSize;
        });
      }),
    ),
  );

  paperModeOptions.replaceChildren(
    makeButton("fill", state.paper.mode === "fill", () => {
      applyChange(() => {
        state.paper.mode = "fill";
      });
    }),
    makeButton("custom", state.paper.mode === "custom", () => {
      applyChange(() => {
        state.paper.mode = "custom";
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
  paperWidthInput.disabled = state.paper.mode === "fill";
  paperHeightInput.disabled = state.paper.mode === "fill";
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

  return {
    x: translatedX + paperSize.width / 2,
    y: translatedY + paperSize.height / 2,
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
  const minimum = 0.018;
  const maximum = 0.82;
  const fold = state.folds[handle.corner];
  const inward = getInwardFromLocal(handle.corner, local);
  const x = clamp(inward.x, 0, maximum);
  const y = clamp(inward.y, 0, maximum);

  if (x < minimum || y < minimum) {
    fold.enabled = false;
    fold.x = 0;
    fold.y = 0;
  } else {
    fold.enabled = true;
    fold.x = x;
    fold.y = y;
  }

  syncControls();
  renderComposition(canvas, true);
}

function exportPng() {
  const finish = () => {
    const exportCanvas = document.createElement("canvas");
    renderComposition(exportCanvas, false);
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fortune-cookie-paper-${state.frame.label}.png`;
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
  applyChange(() => {
    state = cloneState(defaultState);
    loadedImage = null;
    imageSrc = null;
  });
}

paperWidthInput.addEventListener("input", () => {
  pushHistory();
  state.paper.width = Number(paperWidthInput.value) || 80;
  renderComposition(canvas, true);
});

paperHeightInput.addEventListener("input", () => {
  pushHistory();
  state.paper.height = Number(paperHeightInput.value) || 80;
  renderComposition(canvas, true);
});

textInput.addEventListener("input", () => {
  pushHistory();
  state.text = textInput.value;
  renderComposition(canvas, true);
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  pushHistory();
  imageSrc = await readFileAsDataUrl(file);
  loadedImage = await loadImage(imageSrc);
  imageInput.value = "";
  syncControls();
  renderComposition(canvas, true);
});

document.querySelector("[data-action='load-image']").addEventListener("click", () => imageInput.click());
document.querySelectorAll("[data-action='reset']").forEach((button) => button.addEventListener("click", reset));
document.querySelector("[data-action='export']").addEventListener("click", exportPng);
undoButton.addEventListener("click", () => {
  const snapshot = history.pop();
  if (!snapshot) return;
  state = cloneState(snapshot.state);
  imageSrc = snapshot.imageSrc;
  loadedImage = snapshot.loadedImage;
  syncControls();
  renderComposition(canvas, true);
});

canvas.addEventListener("pointerdown", (event) => {
  const handle = findHandle(getLocalPointer(event));
  if (!handle) return;
  event.preventDefault();
  dragHandle = { ...handle, saved: false };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
  syncFoldStatus();
  renderComposition(canvas, true);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragHandle) return;
  moveHandle(dragHandle, getLocalPointer(event));
});

function endDrag() {
  dragHandle = null;
  canvas.classList.remove("is-dragging");
  syncFoldStatus();
  renderComposition(canvas, true);
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);


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

syncControls();
renderComposition(canvas, true);
if (document.fonts?.load) {
  document.fonts.load('80px "GT Ultra Median"').finally(() => renderComposition(canvas, true));
}
