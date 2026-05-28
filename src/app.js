const framePresets = [
  { label: "1280x1710", width: 1280, height: 1710 },
  { label: "1200x630", width: 1200, height: 630 },
  { label: "1080x1920", width: 1080, height: 1920 },
  { label: "2000x2000", width: 2000, height: 2000 },
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
  { name: "green", hex: "#046840" },
];

const backgroundPalette = [...palette, { name: "transparent", hex: "transparent" }];
const corners = ["tl", "tr", "br", "bl"];
const textDarkColors = new Set(["white", "light grey", "pink"]);

const defaultState = {
  frame: framePresets[0],
  paper: { mode: "fill", width: 900, height: 1200 },
  background: palette[0],
  front: palette[0],
  back: palette[6],
  rotation: 0,
  text: "Text may be\nhere",
  textSize: 108,
  folds: {
    tl: { enabled: true, x: 0.36, y: 0.22 },
    tr: { enabled: false, x: 0.22, y: 0.26 },
    br: { enabled: true, x: 0.28, y: 0.18 },
    bl: { enabled: false, x: 0.22, y: 0.24 },
  },
};

let state = cloneState(defaultState);
let loadedImage = null;
let imageSrc = null;
let dragHandle = null;

const canvas = document.querySelector("#preview-canvas");
const frameOptions = document.querySelector("[data-frame-options]");
const paperModeOptions = document.querySelector("[data-paper-mode-options]");
const backgroundOptions = document.querySelector("[data-background-options]");
const frontOptions = document.querySelector("[data-front-options]");
const backOptions = document.querySelector("[data-back-options]");
const foldOptions = document.querySelector("[data-fold-options]");
const paperWidthInput = document.querySelector("#paper-width");
const paperHeightInput = document.querySelector("#paper-height");
const imageInput = document.querySelector("#image-input");
const removeImageButton = document.querySelector("[data-action='remove-image']");
const textInput = document.querySelector("#text-input");
const textSizeInput = document.querySelector("#text-size");
const textSizeLabel = document.querySelector("[data-text-size-label]");
const rotateInput = document.querySelector("#rotate-input");
const rotationLabel = document.querySelector("[data-rotation-label]");

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
  const offsetX = clamp(fold.x * width, 12, width * 0.78);
  const offsetY = clamp(fold.y * height, 12, height * 0.78);

  if (corner === "tl") {
    return { corner: { x: 0, y: 0 }, xPoint: { x: offsetX, y: 0 }, yPoint: { x: 0, y: offsetY } };
  }
  if (corner === "tr") {
    return {
      corner: { x: width, y: 0 },
      xPoint: { x: width - offsetX, y: 0 },
      yPoint: { x: width, y: offsetY },
    };
  }
  if (corner === "br") {
    return {
      corner: { x: width, y: height },
      xPoint: { x: width - offsetX, y: height },
      yPoint: { x: width, y: height - offsetY },
    };
  }

  return {
    corner: { x: 0, y: height },
    xPoint: { x: offsetX, y: height },
    yPoint: { x: 0, y: height - offsetY },
  };
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
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.translate(-paperWidth / 2, -paperHeight / 2);

  for (const corner of corners) {
    const fold = state.folds[corner];
    if (!fold.enabled) continue;
    const points = getFoldPoints(corner, fold, paperWidth, paperHeight);
    ctx.beginPath();
    ctx.moveTo(points.corner.x, points.corner.y);
    ctx.lineTo(points.xPoint.x, points.xPoint.y);
    ctx.lineTo(points.yPoint.x, points.yPoint.y);
    ctx.closePath();
    ctx.fillStyle = state.back.hex;
    ctx.fill();
  }

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
    const lineHeight = fontSize * 1.02;
    const startY = paperHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => ctx.fillText(line, paperWidth / 2, startY + index * lineHeight));
  }
  ctx.restore();

  if (showGuides) drawGuides(ctx, paperWidth, paperHeight);
  ctx.restore();
}

function drawGuides(ctx, paperWidth, paperHeight) {
  ctx.lineWidth = Math.max(1, Math.min(paperWidth, paperHeight) * 0.004);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
  ctx.setLineDash([Math.max(6, paperWidth * 0.012), Math.max(6, paperWidth * 0.012)]);

  for (const corner of corners) {
    const fold = state.folds[corner];
    if (!fold.enabled) continue;
    const points = getFoldPoints(corner, fold, paperWidth, paperHeight);
    ctx.beginPath();
    ctx.moveTo(points.xPoint.x, points.xPoint.y);
    ctx.lineTo(points.yPoint.x, points.yPoint.y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  for (const corner of corners) {
    const fold = state.folds[corner];
    if (!fold.enabled) continue;
    const points = getFoldPoints(corner, fold, paperWidth, paperHeight);
    [points.xPoint, points.yPoint].forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(10, Math.min(paperWidth, paperHeight) * 0.014), 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = Math.max(2, Math.min(paperWidth, paperHeight) * 0.003);
      ctx.strokeStyle = "#111111";
      ctx.stroke();
    });
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
  if (color.hex !== "transparent") button.style.backgroundColor = color.hex;
  button.title = `${color.name} ${color.hex}`;
  button.setAttribute("aria-label", color.name);
  button.addEventListener("click", onClick);
  return button;
}

function syncControls() {
  frameOptions.replaceChildren(
    ...framePresets.map((preset) =>
      makeButton(preset.label, state.frame.label === preset.label, () => {
        state.frame = preset;
        syncControls();
        renderComposition(canvas, true);
      }),
    ),
  );

  paperModeOptions.replaceChildren(
    makeButton("fill", state.paper.mode === "fill", () => {
      state.paper.mode = "fill";
      syncControls();
      renderComposition(canvas, true);
    }),
    makeButton("custom", state.paper.mode === "custom", () => {
      state.paper.mode = "custom";
      syncControls();
      renderComposition(canvas, true);
    }),
  );

  backgroundOptions.replaceChildren(
    ...backgroundPalette.map((color) =>
      makeSwatch(color, state.background.name === color.name, () => {
        state.background = color;
        syncControls();
        renderComposition(canvas, true);
      }),
    ),
  );

  frontOptions.replaceChildren(
    ...palette.map((color) =>
      makeSwatch(color, state.front.name === color.name, () => {
        state.front = color;
        syncControls();
        renderComposition(canvas, true);
      }),
    ),
  );

  backOptions.replaceChildren(
    ...palette.map((color) =>
      makeSwatch(color, state.back.name === color.name, () => {
        state.back = color;
        syncControls();
        renderComposition(canvas, true);
      }),
    ),
  );

  foldOptions.replaceChildren(
    ...corners.map((corner) =>
      makeButton(corner, state.folds[corner].enabled, () => {
        state.folds[corner].enabled = !state.folds[corner].enabled;
        syncControls();
        renderComposition(canvas, true);
      }),
    ),
  );

  const paperSize = getPaperSize();
  paperWidthInput.value = String(Math.round(state.paper.mode === "fill" ? paperSize.width : state.paper.width));
  paperHeightInput.value = String(Math.round(state.paper.mode === "fill" ? paperSize.height : state.paper.height));
  paperWidthInput.disabled = state.paper.mode === "fill";
  paperHeightInput.disabled = state.paper.mode === "fill";
  textInput.value = state.text;
  textSizeInput.value = String(state.textSize);
  textSizeLabel.textContent = `${state.textSize}px`;
  rotateInput.value = String(state.rotation);
  rotationLabel.textContent = `${state.rotation}°`;
  removeImageButton.hidden = !imageSrc;
}

function getLocalPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const canvasX = ((event.clientX - rect.left) / rect.width) * state.frame.width;
  const canvasY = ((event.clientY - rect.top) / rect.height) * state.frame.height;
  const paperSize = getPaperSize();
  const angle = (-state.rotation * Math.PI) / 180;
  const translatedX = canvasX - state.frame.width / 2;
  const translatedY = canvasY - state.frame.height / 2;
  const rotatedX = translatedX * Math.cos(angle) - translatedY * Math.sin(angle);
  const rotatedY = translatedX * Math.sin(angle) + translatedY * Math.cos(angle);

  return {
    x: rotatedX + paperSize.width / 2,
    y: rotatedY + paperSize.height / 2,
    paperWidth: paperSize.width,
    paperHeight: paperSize.height,
  };
}

function findHandle(local) {
  const threshold = Math.max(local.paperWidth, local.paperHeight) * 0.035;
  let match = null;
  let bestDistance = Infinity;

  for (const corner of corners) {
    const fold = state.folds[corner];
    if (!fold.enabled) continue;
    const points = getFoldPoints(corner, fold, local.paperWidth, local.paperHeight);
    const candidates = [
      { point: points.xPoint, axis: "x" },
      { point: points.yPoint, axis: "y" },
    ];

    for (const candidate of candidates) {
      const distance = Math.hypot(local.x - candidate.point.x, local.y - candidate.point.y);
      if (distance < threshold && distance < bestDistance) {
        bestDistance = distance;
        match = { corner, axis: candidate.axis };
      }
    }
  }

  return match;
}

function moveHandle(handle, local) {
  const minimum = 0.03;
  const maximum = 0.78;
  const fold = state.folds[handle.corner];

  if (handle.axis === "x") {
    if (handle.corner === "tl" || handle.corner === "bl") {
      fold.x = clamp(local.x / local.paperWidth, minimum, maximum);
    } else {
      fold.x = clamp((local.paperWidth - local.x) / local.paperWidth, minimum, maximum);
    }
  } else if (handle.corner === "tl" || handle.corner === "tr") {
    fold.y = clamp(local.y / local.paperHeight, minimum, maximum);
  } else {
    fold.y = clamp((local.paperHeight - local.y) / local.paperHeight, minimum, maximum);
  }

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
  state = cloneState(defaultState);
  loadedImage = null;
  imageSrc = null;
  syncControls();
  renderComposition(canvas, true);
}

paperWidthInput.addEventListener("input", () => {
  state.paper.width = Number(paperWidthInput.value) || 80;
  renderComposition(canvas, true);
});

paperHeightInput.addEventListener("input", () => {
  state.paper.height = Number(paperHeightInput.value) || 80;
  renderComposition(canvas, true);
});

textInput.addEventListener("input", () => {
  state.text = textInput.value;
  renderComposition(canvas, true);
});

textSizeInput.addEventListener("input", () => {
  state.textSize = Number(textSizeInput.value);
  textSizeLabel.textContent = `${state.textSize}px`;
  renderComposition(canvas, true);
});

rotateInput.addEventListener("input", () => {
  state.rotation = Number(rotateInput.value);
  rotationLabel.textContent = `${state.rotation}°`;
  renderComposition(canvas, true);
});

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  imageSrc = await readFileAsDataUrl(file);
  loadedImage = await loadImage(imageSrc);
  imageInput.value = "";
  syncControls();
  renderComposition(canvas, true);
});

document.querySelector("[data-action='load-image']").addEventListener("click", () => imageInput.click());
document.querySelectorAll("[data-action='reset']").forEach((button) => button.addEventListener("click", reset));
document.querySelector("[data-action='export']").addEventListener("click", exportPng);
removeImageButton.addEventListener("click", () => {
  imageSrc = null;
  loadedImage = null;
  syncControls();
  renderComposition(canvas, true);
});

canvas.addEventListener("pointerdown", (event) => {
  const handle = findHandle(getLocalPointer(event));
  if (!handle) return;
  dragHandle = handle;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragHandle) return;
  moveHandle(dragHandle, getLocalPointer(event));
});

function endDrag() {
  dragHandle = null;
  canvas.classList.remove("is-dragging");
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

document.fonts?.load('80px "GT Ultra Median"').finally(() => renderComposition(canvas, true));
syncControls();
renderComposition(canvas, true);
