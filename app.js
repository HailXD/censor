const displayCanvas = document.getElementById("display");
const displayCtx = displayCanvas.getContext("2d");
const canvasWrap = document.getElementById("canvas-wrap");
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
const snapshotCanvas = document.createElement("canvas");
const snapshotCtx = snapshotCanvas.getContext("2d");
const pixelCanvas = document.createElement("canvas");
const pixelCtx = pixelCanvas.getContext("2d");

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
  isDrawing: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
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
  const snapshot = sourceCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );
  state.history.push(snapshot);
  if (state.history.length > state.historyLimit) {
    state.history.shift();
  }
  updateUndoState();
};

const undo = () => {
  if (!state.history.length) return;
  const previous = state.history.pop();
  sourceCtx.putImageData(previous, 0, 0);
  updateUndoState();
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

const resizeDisplay = () => {
  const rect = canvasWrap.getBoundingClientRect();
  state.dpr = window.devicePixelRatio || 1;
  displayCanvas.width = Math.max(1, Math.floor(rect.width * state.dpr));
  displayCanvas.height = Math.max(1, Math.floor(rect.height * state.dpr));
  displayCanvas.style.width = `${rect.width}px`;
  displayCanvas.style.height = `${rect.height}px`;
  if (hasImage) {
    fitToView();
  }
  scheduleRender();
};

const fitToView = () => {
  if (!hasImage) return;
  const rect = canvasWrap.getBoundingClientRect();
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

const render = () => {
  rafId = 0;
  const width = displayCanvas.width / state.dpr;
  const height = displayCanvas.height / state.dpr;
  displayCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  displayCtx.clearRect(0, 0, width, height);
  if (!hasImage) return;

  displayCtx.save();
  displayCtx.setTransform(
    state.dpr * state.scale,
    0,
    0,
    state.dpr * state.scale,
    state.dpr * state.offsetX,
    state.dpr * state.offsetY
  );
  displayCtx.imageSmoothingEnabled = true;
  displayCtx.drawImage(sourceCanvas, 0, 0);
  displayCtx.restore();

  if (state.isDrawing && state.tool === "rect") {
    const start = imageToDisplay(state.startX, state.startY);
    const end = imageToDisplay(state.lastX, state.lastY);
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(start.x - end.x);
    const h = Math.abs(start.y - end.y);
    displayCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    displayCtx.strokeStyle = "rgba(242, 107, 58, 0.85)";
    displayCtx.lineWidth = 2;
    displayCtx.setLineDash([8, 6]);
    displayCtx.strokeRect(x, y, w, h);
    displayCtx.setLineDash([]);
  }
};

const imageToDisplay = (x, y) => ({
  x: x * state.scale + state.offsetX,
  y: y * state.scale + state.offsetY,
});

const displayToImage = (clientX, clientY) => {
  const rect = displayCanvas.getBoundingClientRect();
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

const clipBrush = (ctx, x, y, size) => {
  ctx.beginPath();
  if (state.shape === "round") {
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  } else {
    ctx.rect(x - size / 2, y - size / 2, size, size);
  }
  ctx.clip();
};

const applyEffect = (rect, clipFn) => {
  if (rect.w <= 0 || rect.h <= 0) return;
  if (state.effect === "black") {
    sourceCtx.save();
    clipFn(sourceCtx);
    sourceCtx.fillStyle = "#000";
    sourceCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    sourceCtx.restore();
    return;
  }

  if (state.effect === "blur") {
    sourceCtx.save();
    clipFn(sourceCtx);
    sourceCtx.filter = `blur(${state.blurStrength}px)`;
    sourceCtx.drawImage(
      snapshotCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      rect.x,
      rect.y,
      rect.w,
      rect.h
    );
    sourceCtx.restore();
    return;
  }

  const strength = clamp(state.pixelStrength, 1, 60);
  const scaledW = Math.max(1, Math.floor(rect.w / strength));
  const scaledH = Math.max(1, Math.floor(rect.h / strength));
  pixelCanvas.width = scaledW;
  pixelCanvas.height = scaledH;
  pixelCtx.imageSmoothingEnabled = true;
  pixelCtx.clearRect(0, 0, scaledW, scaledH);
  pixelCtx.drawImage(
    snapshotCanvas,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    0,
    0,
    scaledW,
    scaledH
  );
  sourceCtx.save();
  clipFn(sourceCtx);
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.drawImage(
    pixelCanvas,
    0,
    0,
    scaledW,
    scaledH,
    rect.x,
    rect.y,
    rect.w,
    rect.h
  );
  sourceCtx.restore();
};

const applyBrushAtPoint = (x, y) => {
  const size = state.brushSize;
  const rect = normalizeRect(
    x - size / 2,
    y - size / 2,
    x + size / 2,
    y + size / 2
  );
  applyEffect(rect, (ctx) => clipBrush(ctx, x, y, size));
};

const applyBrushLine = (x1, y1, x2, y2) => {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const step = Math.max(2, state.brushSize / 4);
  const steps = Math.max(1, Math.ceil(distance / step));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    applyBrushAtPoint(x, y);
  }
};

const applyRectangle = (x1, y1, x2, y2) => {
  const rect = normalizeRect(x1, y1, x2, y2);
  applyEffect(rect, (ctx) => {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
  });
};

const startStroke = (event) => {
  if (!hasImage) {
    setStatus("Load an image first.");
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) return;
  displayCanvas.setPointerCapture(event.pointerId);
  const { x, y } = displayToImage(event.clientX, event.clientY);
  state.isDrawing = true;
  state.startX = x;
  state.startY = y;
  state.lastX = x;
  state.lastY = y;
  pushHistory();
  snapshotCtx.clearRect(0, 0, snapshotCanvas.width, snapshotCanvas.height);
  snapshotCtx.drawImage(sourceCanvas, 0, 0);
  if (state.tool === "brush") {
    applyBrushAtPoint(x, y);
    scheduleRender();
  }
};

const continueStroke = (event) => {
  if (!state.isDrawing) return;
  const { x, y } = displayToImage(event.clientX, event.clientY);
  if (state.tool === "brush") {
    applyBrushLine(state.lastX, state.lastY, x, y);
    state.lastX = x;
    state.lastY = y;
  } else {
    state.lastX = x;
    state.lastY = y;
  }
  scheduleRender();
};

const endStroke = () => {
  if (!state.isDrawing) return;
  if (state.tool === "rect") {
    applyRectangle(state.startX, state.startY, state.lastX, state.lastY);
  }
  state.isDrawing = false;
  scheduleRender();
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
  const rect = displayCanvas.getBoundingClientRect();
  zoomAt(rect.width / 2, rect.height / 2, factor);
};

const loadImage = (file) => {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    snapshotCanvas.width = image.naturalWidth;
    snapshotCanvas.height = image.naturalHeight;
    sourceCtx.setTransform(1, 0, 0, 1, 0, 0);
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.drawImage(image, 0, 0);
    hasImage = true;
    emptyState.hidden = true;
    state.history = [];
    updateUndoState();
    fitToView();
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

displayCanvas.addEventListener("pointerdown", startStroke);
displayCanvas.addEventListener("pointermove", continueStroke);
displayCanvas.addEventListener("pointerup", endStroke);
displayCanvas.addEventListener("pointercancel", endStroke);
displayCanvas.addEventListener("pointerleave", endStroke);

displayCanvas.addEventListener(
  "wheel",
  (event) => {
    if (!hasImage) return;
    event.preventDefault();
    const rect = displayCanvas.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const zoom = event.deltaY < 0 ? 1.1 : 0.9;
    zoomAt(mx, my, zoom);
  },
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
  });
});

document.querySelectorAll("[data-shape]").forEach((button) => {
  button.addEventListener("click", () => {
    state.shape = button.dataset.shape;
    updateShapeUI();
  });
});

document.querySelectorAll("[data-effect]").forEach((button) => {
  button.addEventListener("click", () => {
    state.effect = button.dataset.effect;
    updateEffectUI();
  });
});

brushSizeInput.addEventListener("input", (event) => {
  state.brushSize = Number(event.target.value);
  updateOutputs();
});

pixelateStrengthInput.addEventListener("input", (event) => {
  state.pixelStrength = Number(event.target.value);
  updateOutputs();
});

blurStrengthInput.addEventListener("input", (event) => {
  state.blurStrength = Number(event.target.value);
  updateOutputs();
});

window.addEventListener("resize", resizeDisplay);

updateOutputs();
updateEffectUI();
updateToolUI();
updateShapeUI();
resizeDisplay();
