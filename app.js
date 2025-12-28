const inputCanvas = document.getElementById("input");
const outputCanvas = document.getElementById("output");
const inputCtx = inputCanvas.getContext("2d");
const outputCtx = outputCanvas.getContext("2d");
const inputWrap = document.getElementById("input-wrap");
const outputWrap = document.getElementById("output-wrap");
const emptyState = document.getElementById("empty-state");
const statusPill = document.getElementById("status");

const fileInput = document.getElementById("file-input");
const undoButton = document.getElementById("undo");

const brushSizeInput = document.getElementById("brush-size");
const brushSizeValue = document.getElementById("brush-size-value");
const pixelateStrengthInput = document.getElementById("pixelate-strength");
const pixelateStrengthValue = document.getElementById(
  "pixelate-strength-value"
);
const blurStrengthInput = document.getElementById("blur-strength");
const blurStrengthValue = document.getElementById("blur-strength-value");
const pixelateControls = document.getElementById("pixelate-controls");
const blurControls = document.getElementById("blur-controls");

const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");
const zoomFitButton = document.getElementById("zoom-fit");

const sourceCanvas = document.createElement("canvas");
const sourceCtx = sourceCanvas.getContext("2d");
const maskCanvas = document.createElement("canvas");
const maskCtx = maskCanvas.getContext("2d");
const previewMaskCanvas = document.createElement("canvas");
const previewMaskCtx = previewMaskCanvas.getContext("2d");
const strokeCanvas = document.createElement("canvas");
const strokeCtx = strokeCanvas.getContext("2d");
const overlayCanvas = document.createElement("canvas");
const overlayCtx = overlayCanvas.getContext("2d");
const censoredCanvas = document.createElement("canvas");
const censoredCtx = censoredCanvas.getContext("2d");
const effectCanvas = document.createElement("canvas");
const effectCtx = effectCanvas.getContext("2d");
const pixelCanvas = document.createElement("canvas");
const pixelCtx = pixelCanvas.getContext("2d");

const MASK_TINT = "rgba(36, 161, 94, 0.4)";
const OUTLINE_COLOR = "rgba(242, 107, 58, 0.9)";

const state = {
  tool: "brush",
  shape: "round",
  effect: "pixelate",
  brushSize: Number(brushSizeInput.value),
  pixelStrength: Number(pixelateStrengthInput.value),
  blurStrength: Number(blurStrengthInput.value),
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panOffsetX: 0,
  panOffsetY: 0,
  isDrawing: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  hoverX: 0,
  hoverY: 0,
  isHovering: false,
  history: [],
  historyLimit: 30,
  dpr: window.devicePixelRatio || 1,
};

let hasImage = false;
let rafId = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const setStatus = (message) => {
  statusPill.textContent = message;
};

const updateUndoState = () => {
  undoButton.disabled = state.history.length === 0;
};

const pushHistory = () => {
  if (!hasImage) return;
  const snapshot = maskCtx.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height
  );
  state.history.push(snapshot);
  if (state.history.length > state.historyLimit) {
    state.history.shift();
  }
  updateUndoState();
};

const undo = () => {
  if (!state.history.length || state.isDrawing) return;
  const previous = state.history.pop();
  maskCtx.putImageData(previous, 0, 0);
  updateUndoState();
  refreshDerivedCanvases();
  scheduleRender();
};

const updateOutputs = () => {
  brushSizeValue.textContent = `${state.brushSize} px`;
  pixelateStrengthValue.textContent = `${state.pixelStrength}`;
  blurStrengthValue.textContent = `${state.blurStrength}`;
};

const updateEffectUI = () => {
  pixelateControls.hidden = state.effect !== "pixelate";
  blurControls.hidden = state.effect !== "blur";
  document.querySelectorAll("[data-effect]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.effect === state.effect);
    button.setAttribute(
      "aria-pressed",
      button.dataset.effect === state.effect
    );
  });
};

const updateToolUI = () => {
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.tool);
    button.setAttribute("aria-pressed", button.dataset.tool === state.tool);
  });
};

const updateShapeUI = () => {
  document.querySelectorAll("[data-shape]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.shape === state.shape);
    button.setAttribute("aria-pressed", button.dataset.shape === state.shape);
  });
};

const resizeCanvasToWrap = (canvas, wrap) => {
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
};

const resizeDisplay = () => {
  state.dpr = window.devicePixelRatio || 1;
  resizeCanvasToWrap(inputCanvas, inputWrap);
  resizeCanvasToWrap(outputCanvas, outputWrap);
  if (hasImage) {
    fitToView();
  }
  scheduleRender();
};

const fitToView = () => {
  if (!hasImage) return;
  const rect = inputWrap.getBoundingClientRect();
  const scale = Math.min(
    rect.width / sourceCanvas.width,
    rect.height / sourceCanvas.height
  );
  state.scale = clamp(scale, 0.1, 8);
  state.offsetX = (rect.width - sourceCanvas.width * state.scale) / 2;
  state.offsetY = (rect.height - sourceCanvas.height * state.scale) / 2;
};

const scheduleRender = () => {
  if (rafId) return;
  rafId = requestAnimationFrame(render);
};

const imageToDisplay = (x, y) => ({
  x: x * state.scale + state.offsetX,
  y: y * state.scale + state.offsetY,
});

const displayToImage = (clientX, clientY) => {
  const rect = inputCanvas.getBoundingClientRect();
  const x = (clientX - rect.left - state.offsetX) / state.scale;
  const y = (clientY - rect.top - state.offsetY) / state.scale;
  return {
    x: clamp(x, 0, sourceCanvas.width),
    y: clamp(y, 0, sourceCanvas.height),
  };
};

const normalizeRect = (x1, y1, x2, y2) => {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  const x2Clamp = clamp(x + w, 0, sourceCanvas.width);
  const y2Clamp = clamp(y + h, 0, sourceCanvas.height);
  const xClamp = clamp(x, 0, sourceCanvas.width);
  const yClamp = clamp(y, 0, sourceCanvas.height);
  return {
    x: xClamp,
    y: yClamp,
    w: Math.max(0, x2Clamp - xClamp),
    h: Math.max(0, y2Clamp - yClamp),
  };
};

const resetStroke = () => {
  strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
  strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
  strokeCtx.fillStyle = "#fff";
};

const drawBrushStamp = (x, y) => {
  const size = state.brushSize;
  strokeCtx.beginPath();
  if (state.shape === "round") {
    strokeCtx.arc(x, y, size / 2, 0, Math.PI * 2);
  } else {
    strokeCtx.rect(x - size / 2, y - size / 2, size, size);
  }
  strokeCtx.fill();
};

const drawBrushLine = (x1, y1, x2, y2) => {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const step = Math.max(2, state.brushSize / 4);
  const steps = Math.max(1, Math.ceil(distance / step));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    drawBrushStamp(x, y);
  }
};

const drawRectStroke = (x1, y1, x2, y2) => {
  const rect = normalizeRect(x1, y1, x2, y2);
  strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
  strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
  strokeCtx.fillStyle = "#fff";
  strokeCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
};

const composePreviewMask = () => {
  previewMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
  previewMaskCtx.clearRect(0, 0, previewMaskCanvas.width, previewMaskCanvas.height);
  previewMaskCtx.drawImage(maskCanvas, 0, 0);
  previewMaskCtx.globalCompositeOperation =
    state.tool === "eraser" ? "destination-out" : "xor";
  previewMaskCtx.drawImage(strokeCanvas, 0, 0);
  previewMaskCtx.globalCompositeOperation = "source-over";
};

const commitStroke = () => {
  maskCtx.globalCompositeOperation =
    state.tool === "eraser" ? "destination-out" : "xor";
  maskCtx.drawImage(strokeCanvas, 0, 0);
  maskCtx.globalCompositeOperation = "source-over";
};

const rebuildOverlay = (mask) => {
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!mask) return;
  overlayCtx.fillStyle = MASK_TINT;
  overlayCtx.fillRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayCtx.globalCompositeOperation = "destination-in";
  overlayCtx.drawImage(mask, 0, 0);
  overlayCtx.globalCompositeOperation = "source-over";
};

const rebuildOutput = (mask) => {
  if (!hasImage) return;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  censoredCtx.setTransform(1, 0, 0, 1, 0, 0);
  censoredCtx.clearRect(0, 0, width, height);
  censoredCtx.drawImage(sourceCanvas, 0, 0);

  if (!mask) return;

  effectCtx.setTransform(1, 0, 0, 1, 0, 0);
  effectCtx.clearRect(0, 0, width, height);
  effectCtx.globalCompositeOperation = "source-over";
  effectCtx.filter = "none";
  effectCtx.imageSmoothingEnabled = true;

  if (state.effect === "black") {
    effectCtx.fillStyle = "#000";
    effectCtx.fillRect(0, 0, width, height);
  } else if (state.effect === "blur") {
    effectCtx.filter = `blur(${state.blurStrength}px)`;
    effectCtx.drawImage(sourceCanvas, 0, 0);
    effectCtx.filter = "none";
  } else {
    const strength = clamp(state.pixelStrength, 1, 60);
    const scaledW = Math.max(1, Math.floor(width / strength));
    const scaledH = Math.max(1, Math.floor(height / strength));
    pixelCanvas.width = scaledW;
    pixelCanvas.height = scaledH;
    pixelCtx.setTransform(1, 0, 0, 1, 0, 0);
    pixelCtx.imageSmoothingEnabled = true;
    pixelCtx.clearRect(0, 0, scaledW, scaledH);
    pixelCtx.drawImage(sourceCanvas, 0, 0, scaledW, scaledH);
    effectCtx.imageSmoothingEnabled = false;
    effectCtx.drawImage(
      pixelCanvas,
      0,
      0,
      scaledW,
      scaledH,
      0,
      0,
      width,
      height
    );
    effectCtx.imageSmoothingEnabled = true;
  }

  effectCtx.globalCompositeOperation = "destination-in";
  effectCtx.drawImage(mask, 0, 0);
  effectCtx.globalCompositeOperation = "source-over";

  censoredCtx.drawImage(effectCanvas, 0, 0);
};

const refreshDerivedCanvases = () => {
  if (!hasImage) return;
  const mask = state.isDrawing ? previewMaskCanvas : maskCanvas;
  rebuildOverlay(mask);
  rebuildOutput(mask);
};

const drawBrushOutline = () => {
  if (!hasImage || !state.isHovering) return;
  if (state.tool !== "brush" && state.tool !== "eraser") return;
  const pos = imageToDisplay(state.hoverX, state.hoverY);
  const size = state.brushSize * state.scale;

  inputCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  inputCtx.strokeStyle = OUTLINE_COLOR;
  inputCtx.lineWidth = 1.5;
  inputCtx.beginPath();
  if (state.shape === "round") {
    inputCtx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
  } else {
    inputCtx.rect(pos.x - size / 2, pos.y - size / 2, size, size);
  }
  inputCtx.stroke();
};

const renderInput = () => {
  const width = inputCanvas.width / state.dpr;
  const height = inputCanvas.height / state.dpr;
  inputCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  inputCtx.clearRect(0, 0, width, height);
  if (!hasImage) return;

  inputCtx.save();
  inputCtx.setTransform(
    state.dpr * state.scale,
    0,
    0,
    state.dpr * state.scale,
    state.dpr * state.offsetX,
    state.dpr * state.offsetY
  );
  inputCtx.imageSmoothingEnabled = true;
  inputCtx.drawImage(sourceCanvas, 0, 0);
  inputCtx.drawImage(overlayCanvas, 0, 0);
  inputCtx.restore();

  if (state.isDrawing && state.tool === "rect") {
    const start = imageToDisplay(state.startX, state.startY);
    const end = imageToDisplay(state.lastX, state.lastY);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(start.x - end.x);
    const h = Math.abs(start.y - end.y);
    inputCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    inputCtx.strokeStyle = OUTLINE_COLOR;
    inputCtx.lineWidth = 2;
    inputCtx.setLineDash([8, 6]);
    inputCtx.strokeRect(x, y, w, h);
    inputCtx.setLineDash([]);
  }

  drawBrushOutline();
};

const renderOutput = () => {
  const width = outputCanvas.width / state.dpr;
  const height = outputCanvas.height / state.dpr;
  outputCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  outputCtx.clearRect(0, 0, width, height);
  if (!hasImage) return;

  outputCtx.save();
  outputCtx.setTransform(
    state.dpr * state.scale,
    0,
    0,
    state.dpr * state.scale,
    state.dpr * state.offsetX,
    state.dpr * state.offsetY
  );
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.drawImage(censoredCanvas, 0, 0);
  outputCtx.restore();
};

const render = () => {
  rafId = 0;
  renderInput();
  renderOutput();
};

const zoomAt = (mx, my, zoom) => {
  if (!hasImage) return;
  const prevScale = state.scale;
  const nextScale = clamp(prevScale * zoom, 0.1, 8);
  const worldX = (mx - state.offsetX) / prevScale;
  const worldY = (my - state.offsetY) / prevScale;
  state.scale = nextScale;
  state.offsetX = mx - worldX * nextScale;
  state.offsetY = my - worldY * nextScale;
  scheduleRender();
};

const zoomBy = (factor) => {
  const rect = inputCanvas.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, factor);
};

const loadImage = (file) => {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    maskCanvas.width = image.naturalWidth;
    maskCanvas.height = image.naturalHeight;
    previewMaskCanvas.width = image.naturalWidth;
    previewMaskCanvas.height = image.naturalHeight;
    strokeCanvas.width = image.naturalWidth;
    strokeCanvas.height = image.naturalHeight;
    overlayCanvas.width = image.naturalWidth;
    overlayCanvas.height = image.naturalHeight;
    censoredCanvas.width = image.naturalWidth;
    censoredCanvas.height = image.naturalHeight;
    effectCanvas.width = image.naturalWidth;
    effectCanvas.height = image.naturalHeight;

    sourceCtx.setTransform(1, 0, 0, 1, 0, 0);
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.drawImage(image, 0, 0);

    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    previewMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewMaskCtx.clearRect(
      0,
      0,
      previewMaskCanvas.width,
      previewMaskCanvas.height
    );
    resetStroke();

    hasImage = true;
    emptyState.hidden = true;
    state.history = [];
    state.isDrawing = false;
    state.isHovering = false;
    updateUndoState();
    fitToView();
    refreshDerivedCanvases();
    scheduleRender();
    setStatus(`Loaded ${file.name || "image"}.`);
    URL.revokeObjectURL(url);
  };
  image.onerror = () => {
    setStatus("Could not load that image.");
    URL.revokeObjectURL(url);
  };
  image.src = url;
};

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  loadImage(file);
});

document.addEventListener("paste", (event) => {
  if (!event.clipboardData) return;
  const items = Array.from(event.clipboardData.items);
  const imageItem = items.find((item) => item.type.startsWith("image/"));
  if (!imageItem) {
    setStatus("Clipboard has no image.");
    return;
  }
  const file = imageItem.getAsFile();
  if (file) {
    loadImage(file);
    event.preventDefault();
  }
});

const startStroke = (event) => {
  if (!hasImage) {
    setStatus("Load an image first.");
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) return;
  inputCanvas.setPointerCapture(event.pointerId);
  const { x, y } = displayToImage(event.clientX, event.clientY);
  state.isDrawing = true;
  state.startX = x;
  state.startY = y;
  state.lastX = x;
  state.lastY = y;
  state.hoverX = x;
  state.hoverY = y;
  state.isHovering = true;
  pushHistory();
  resetStroke();
  if (state.tool === "rect") {
    drawRectStroke(x, y, x, y);
  } else {
    drawBrushStamp(x, y);
  }
  composePreviewMask();
  refreshDerivedCanvases();
  scheduleRender();
};

const continueStroke = (event) => {
  if (!hasImage) return;
  if (state.isPanning) return;
  const { x, y } = displayToImage(event.clientX, event.clientY);
  state.hoverX = x;
  state.hoverY = y;
  state.isHovering = true;

  if (!state.isDrawing) {
    scheduleRender();
    return;
  }

  if (state.tool === "rect") {
    state.lastX = x;
    state.lastY = y;
    drawRectStroke(state.startX, state.startY, state.lastX, state.lastY);
  } else {
    drawBrushLine(state.lastX, state.lastY, x, y);
    state.lastX = x;
    state.lastY = y;
  }

  composePreviewMask();
  refreshDerivedCanvases();
  scheduleRender();
};

const endStroke = (event) => {
  if (state.isDrawing) {
    commitStroke();
    state.isDrawing = false;
    resetStroke();
    refreshDerivedCanvases();
    scheduleRender();
  }
  if (event?.pointerId !== undefined) {
    inputCanvas.releasePointerCapture(event.pointerId);
  }
};

const handlePointerLeave = () => {
  state.isHovering = false;
  if (!state.isDrawing) {
    scheduleRender();
  }
};

const startPan = (event) => {
  if (!hasImage) return;
  if (event.pointerType !== "mouse" || event.button !== 1) return;
  event.preventDefault();
  state.isPanning = true;
  state.isHovering = false;
  state.panStartX = event.clientX;
  state.panStartY = event.clientY;
  state.panOffsetX = state.offsetX;
  state.panOffsetY = state.offsetY;
  event.currentTarget.setPointerCapture(event.pointerId);
  inputWrap.classList.add("is-panning");
  outputWrap.classList.add("is-panning");
};

const continuePan = (event) => {
  if (!state.isPanning) return;
  const dx = event.clientX - state.panStartX;
  const dy = event.clientY - state.panStartY;
  state.offsetX = state.panOffsetX + dx;
  state.offsetY = state.panOffsetY + dy;
  scheduleRender();
};

const endPan = (event) => {
  if (!state.isPanning) return;
  state.isPanning = false;
  if (
    event?.pointerId !== undefined &&
    event.currentTarget.hasPointerCapture(event.pointerId)
  ) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  inputWrap.classList.remove("is-panning");
  outputWrap.classList.remove("is-panning");
  scheduleRender();
};

const blockAuxClick = (event) => {
  if (event.button === 1) {
    event.preventDefault();
  }
};

inputCanvas.addEventListener("pointerdown", startStroke);
inputCanvas.addEventListener("pointermove", continueStroke);
inputCanvas.addEventListener("pointerup", endStroke);
inputCanvas.addEventListener("pointercancel", endStroke);
inputCanvas.addEventListener("pointerleave", handlePointerLeave);

const panCanvases = [inputCanvas, outputCanvas];
panCanvases.forEach((canvas) => {
  canvas.addEventListener("pointerdown", startPan);
  canvas.addEventListener("pointermove", continuePan);
  canvas.addEventListener("pointerup", endPan);
  canvas.addEventListener("pointercancel", endPan);
  canvas.addEventListener("auxclick", blockAuxClick);
});

const handleWheel = (event, canvas) => {
  if (!hasImage) return;
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const zoom = event.deltaY < 0 ? 1.1 : 0.9;
  zoomAt(mx, my, zoom);
};

inputCanvas.addEventListener(
  "wheel",
  (event) => handleWheel(event, inputCanvas),
  { passive: false }
);
outputCanvas.addEventListener(
  "wheel",
  (event) => handleWheel(event, outputCanvas),
  { passive: false }
);

zoomInButton.addEventListener("click", () => zoomBy(1.1));
zoomOutButton.addEventListener("click", () => zoomBy(0.9));
zoomFitButton.addEventListener("click", () => {
  fitToView();
  scheduleRender();
});

undoButton.addEventListener("click", undo);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    undo();
  }
});

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    state.tool = button.dataset.tool;
    updateToolUI();
    scheduleRender();
  });
});

document.querySelectorAll("[data-shape]").forEach((button) => {
  button.addEventListener("click", () => {
    state.shape = button.dataset.shape;
    updateShapeUI();
    scheduleRender();
  });
});

document.querySelectorAll("[data-effect]").forEach((button) => {
  button.addEventListener("click", () => {
    state.effect = button.dataset.effect;
    updateEffectUI();
    rebuildOutput(state.isDrawing ? previewMaskCanvas : maskCanvas);
    scheduleRender();
  });
});

brushSizeInput.addEventListener("input", (event) => {
  state.brushSize = Number(event.target.value);
  updateOutputs();
  scheduleRender();
});

pixelateStrengthInput.addEventListener("input", (event) => {
  state.pixelStrength = Number(event.target.value);
  updateOutputs();
  rebuildOutput(state.isDrawing ? previewMaskCanvas : maskCanvas);
  scheduleRender();
});

blurStrengthInput.addEventListener("input", (event) => {
  state.blurStrength = Number(event.target.value);
  updateOutputs();
  rebuildOutput(state.isDrawing ? previewMaskCanvas : maskCanvas);
  scheduleRender();
});

window.addEventListener("resize", resizeDisplay);

updateOutputs();
updateEffectUI();
updateToolUI();
updateShapeUI();
resizeDisplay();
