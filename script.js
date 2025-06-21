const canvas = document.getElementById("censor-canvas");
const ctx = canvas.getContext("2d");
const imageLoader = document.getElementById("image-loader");
const addRectBtn = document.getElementById("add-rect-btn");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const pixelateBtn = document.getElementById("pixelate-btn");

let img = new Image();
let rectangles = [];
let history = [];
let historyIndex = -1;

let isDrawing = false;
let isMoving = false;
let isResizing = false;
let isPanning = false;
let resizeHandle = "";
const handleSize = 14;
let selectedRectangle = null;
let startX, startY;
let offsetX, offsetY;
let touchTimer = null;

let scale = 1;
let originX = 0;
let originY = 0;
let panStartX, panStartY;
let initialPinchDistance = null;

imageLoader.addEventListener("change", handleImage, false);
canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
canvas.addEventListener("mouseup", onMouseUp);
canvas.addEventListener("mouseout", onMouseUp);
canvas.addEventListener("wheel", onWheel, { passive: false });
canvas.addEventListener("contextmenu", removeRectangle);

canvas.addEventListener("touchstart", onTouchStart, { passive: false });
canvas.addEventListener("touchmove", onTouchMove, { passive: false });
canvas.addEventListener("touchend", onTouchEnd);
canvas.addEventListener("touchcancel", onTouchEnd);

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
pixelateBtn.addEventListener("click", pixelateAndOpenInTab);
addRectBtn.addEventListener("click", addCenterRectangle);

function handleImage(e) {
    const reader = new FileReader();
    reader.onload = function (event) {
        img = new Image();
        img.onload = function () {
            resetCanvasState();
            rectangles = [];
            history = [];
            historyIndex = -1;
            saveState();
            redrawCanvas();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
}

function resetCanvasState() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;

    const canvasAspect = canvas.width / canvas.height;
    const imageAspect = img.width / img.height;

    if (imageAspect > canvasAspect) {
        scale = canvas.width / img.width;
        originX = 0;
        originY = (canvas.height - img.height * scale) / 2;
    } else {
        scale = canvas.height / img.height;
        originY = 0;
        originX = (canvas.width - img.width * scale) / 2;
    }
}

function redrawCanvas() {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);

    if (img.src) {
        ctx.drawImage(img, 0, 0);
    }
    drawRectangles();

    ctx.restore();
}

function drawRectangles() {
    rectangles.forEach((rect) => {
        ctx.lineWidth = rect === selectedRectangle ? 3 / scale : 1.5 / scale;
        ctx.strokeStyle = rect === selectedRectangle ? "cyan" : "white";
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        if (rect === selectedRectangle) {
            drawResizeHandles(rect);
        }
    });
}

function drawResizeHandles(rect) {
    ctx.fillStyle = "cyan";
    const scaledHandleSize = handleSize / scale;
    const halfHandle = scaledHandleSize / 2;

    ctx.fillRect(
        rect.x - halfHandle,
        rect.y - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
    ctx.fillRect(
        rect.x + rect.width - halfHandle,
        rect.y - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
    ctx.fillRect(
        rect.x - halfHandle,
        rect.y + rect.height - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
    ctx.fillRect(
        rect.x + rect.width - halfHandle,
        rect.y + rect.height - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );

    ctx.fillRect(
        rect.x + rect.width / 2 - halfHandle,
        rect.y - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
    ctx.fillRect(
        rect.x + rect.width / 2 - halfHandle,
        rect.y + rect.height - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
    ctx.fillRect(
        rect.x - halfHandle,
        rect.y + rect.height / 2 - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
    ctx.fillRect(
        rect.x + rect.width - halfHandle,
        rect.y + rect.height / 2 - halfHandle,
        scaledHandleSize,
        scaledHandleSize
    );
}

function handleDown(x, y) {
    const handle = getResizeHandle(x, y, selectedRectangle);
    if (handle) {
        isResizing = true;
        resizeHandle = handle;
    } else {
        selectedRectangle = getClickedRectangle(x, y);
        if (selectedRectangle) {
            isMoving = true;
            offsetX = x - selectedRectangle.x;
            offsetY = y - selectedRectangle.y;
        } else {
            isDrawing = true;
        }
    }
    startX = x;
    startY = y;
    redrawCanvas();
}

function handleMove(x, y) {
    if (isResizing && selectedRectangle) {
        const oldX = selectedRectangle.x;
        const oldY = selectedRectangle.y;
        switch (resizeHandle) {
            case "top-left":
                selectedRectangle.width += oldX - x;
                selectedRectangle.height += oldY - y;
                selectedRectangle.x = x;
                selectedRectangle.y = y;
                break;
            case "top-right":
                selectedRectangle.width = x - oldX;
                selectedRectangle.height += oldY - y;
                selectedRectangle.y = y;
                break;
            case "bottom-left":
                selectedRectangle.width += oldX - x;
                selectedRectangle.height = y - oldY;
                selectedRectangle.x = x;
                break;
            case "bottom-right":
                selectedRectangle.width = x - oldX;
                selectedRectangle.height = y - oldY;
                break;
            case "top":
                selectedRectangle.height += oldY - y;
                selectedRectangle.y = y;
                break;
            case "bottom":
                selectedRectangle.height = y - oldY;
                break;
            case "left":
                selectedRectangle.width += oldX - x;
                selectedRectangle.x = x;
                break;
            case "right":
                selectedRectangle.width = x - oldX;
                break;
        }
    } else if (isMoving && selectedRectangle) {
        selectedRectangle.x = x - offsetX;
        selectedRectangle.y = y - offsetY;
    } else if (isDrawing) {
        redrawCanvas();
        ctx.save();
        ctx.translate(originX, originY);
        ctx.scale(scale, scale);
        ctx.lineWidth = 2 / scale;
        ctx.strokeStyle = "red";
        ctx.strokeRect(startX, startY, x - startX, y - startY);
        ctx.restore();
        return;
    } else {
        const handle = getResizeHandle(x, y, selectedRectangle);
        canvas.style.cursor = handle ? "pointer" : "default";
    }
    redrawCanvas();
}

function handleUp(x, y) {
    if (isResizing && selectedRectangle) {
        if (selectedRectangle.width < 0) {
            selectedRectangle.x += selectedRectangle.width;
            selectedRectangle.width *= -1;
        }
        if (selectedRectangle.height < 0) {
            selectedRectangle.y += selectedRectangle.height;
            selectedRectangle.height *= -1;
        }
    } else if (isDrawing) {
        const newRect = {
            x: Math.min(startX, x),
            y: Math.min(startY, y),
            width: Math.abs(x - startX),
            height: Math.abs(y - startY),
        };
        if (newRect.width > 5 / scale && newRect.height > 5 / scale) {
            rectangles.push(newRect);
            selectedRectangle = newRect;
        }
    }
    isDrawing = false;
    isMoving = false;
    isResizing = false;
    isPanning = false;
    resizeHandle = "";
    saveState();
    redrawCanvas();
}

function onMouseDown(e) {
    if (e.button === 1 || e.ctrlKey) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        return;
    }
    if (e.button !== 0) return;
    const { x, y } = getTransformedPoint(e.clientX, e.clientY);
    handleDown(x, y);
}

function onMouseMove(e) {
    if (isPanning) {
        originX += e.clientX - panStartX;
        originY += e.clientY - panStartY;
        panStartX = e.clientX;
        panStartY = e.clientY;
        redrawCanvas();
        return;
    }
    const { x, y } = getTransformedPoint(e.clientX, e.clientY);
    handleMove(x, y);
}

function onMouseUp(e) {
    if (isPanning) {
        isPanning = false;
        return;
    }
    const { x, y } = getTransformedPoint(e.clientX, e.clientY);
    handleUp(x, y);
}

function onTouchStart(e) {
    e.preventDefault();
    clearTimeout(touchTimer);

    if (e.touches.length === 1) {
        const { x, y } = getTransformedPoint(
            e.touches[0].clientX,
            e.touches[0].clientY
        );
        handleDown(x, y);
        touchTimer = setTimeout(() => {
            const currentPos = getClickedRectangle(x, y);
            if (currentPos && currentPos === selectedRectangle) {
                removeRectangleAt(x, y);
            }
        }, 1000);
    } else if (e.touches.length === 2) {
        isPanning = true;
        panStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        panStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        initialPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
}

function onTouchMove(e) {
    e.preventDefault();
    clearTimeout(touchTimer);

    if (e.touches.length === 1 && !isPanning) {
        const { x, y } = getTransformedPoint(
            e.touches[0].clientX,
            e.touches[0].clientY
        );
        handleMove(x, y);
    } else if (e.touches.length === 2) {
        const newPinchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const pinchRatio = newPinchDistance / initialPinchDistance;
        const newScale = Math.min(Math.max(0.1, scale * pinchRatio), 10);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        originX = midX - (midX - originX) * (newScale / scale);
        originY = midY - (midY - originY) * (newScale / scale);
        scale = newScale;
        initialPinchDistance = newPinchDistance;

        const newPanX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const newPanY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        originX += newPanX - panStartX;
        originY += newPanY - panStartY;
        panStartX = newPanX;
        panStartY = newPanY;

        redrawCanvas();
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    clearTimeout(touchTimer);
    initialPinchDistance = null;
    isPanning = false;

    if (e.changedTouches.length === 1) {
        const { x, y } = getTransformedPoint(
            e.changedTouches[0].clientX,
            e.changedTouches[0].clientY
        );
        handleUp(x, y);
    }
}

function getTransformedPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left - originX) / scale,
        y: (clientY - rect.top - originY) / scale,
    };
}

function getResizeHandle(x, y, rect) {
    if (!rect) return "";
    const scaledHandleSize = handleSize / scale;
    const halfHandle = scaledHandleSize / 2;

    if (
        x > rect.x - halfHandle &&
        x < rect.x + halfHandle &&
        y > rect.y - halfHandle &&
        y < rect.y + halfHandle
    )
        return "top-left";
    if (
        x > rect.x + rect.width - halfHandle &&
        x < rect.x + rect.width + halfHandle &&
        y > rect.y - halfHandle &&
        y < rect.y + halfHandle
    )
        return "top-right";
    if (
        x > rect.x - halfHandle &&
        x < rect.x + halfHandle &&
        y > rect.y + rect.height - halfHandle &&
        y < rect.y + rect.height + halfHandle
    )
        return "bottom-left";
    if (
        x > rect.x + rect.width - halfHandle &&
        x < rect.x + rect.width + halfHandle &&
        y > rect.y + rect.height - halfHandle &&
        y < rect.y + rect.height + halfHandle
    )
        return "bottom-right";

    if (
        x > rect.x + rect.width / 2 - halfHandle &&
        x < rect.x + rect.width / 2 + halfHandle &&
        y > rect.y - halfHandle &&
        y < rect.y + halfHandle
    )
        return "top";
    if (
        x > rect.x + rect.width / 2 - halfHandle &&
        x < rect.x + rect.width / 2 + halfHandle &&
        y > rect.y + rect.height - halfHandle &&
        y < rect.y + rect.height + halfHandle
    )
        return "bottom";
    if (
        x > rect.x - halfHandle &&
        x < rect.x + halfHandle &&
        y > rect.y + rect.height / 2 - halfHandle &&
        y < rect.y + rect.height / 2 + halfHandle
    )
        return "left";
    if (
        x > rect.x + rect.width - halfHandle &&
        x < rect.x + rect.width + halfHandle &&
        y > rect.y + rect.height / 2 - halfHandle &&
        y < rect.y + rect.height / 2 + halfHandle
    )
        return "right";
    return "";
}

function getClickedRectangle(x, y) {
    for (let i = rectangles.length - 1; i >= 0; i--) {
        const rect = rectangles[i];
        if (
            x >= rect.x &&
            x <= rect.x + rect.width &&
            y >= rect.y &&
            y <= rect.y + rect.height
        ) {
            return rect;
        }
    }
    return null;
}

function removeRectangle(e) {
    e.preventDefault();
    const { x: clickX, y: clickY } = getTransformedPoint(e.clientX, e.clientY);
    removeRectangleAt(clickX, clickY);
}

function removeRectangleAt(x, y) {
    let removed = false;
    for (let i = rectangles.length - 1; i >= 0; i--) {
        const rect = rectangles[i];
        if (
            x >= rect.x &&
            x <= rect.x + rect.width &&
            y >= rect.y &&
            y <= rect.y + rect.height
        ) {
            rectangles.splice(i, 1);
            removed = true;
            break;
        }
    }
    if (removed) {
        saveState();
        redrawCanvas();
    }
}

function addCenterRectangle() {
    if (!img.src) {
        alert("Please load an image first.");
        return;
    }
    const rectWidth = img.width * 0.1;
    const rectHeight = img.height * 0.1;
    const newRect = {
        x: (img.width - rectWidth) / 2,
        y: (img.height - rectHeight) / 2,
        width: rectWidth,
        height: rectHeight,
    };
    rectangles.push(newRect);
    selectedRectangle = newRect;
    saveState();
    redrawCanvas();
}

function pixelateAndOpenInTab() {
    if (!img.src) {
        alert("Please load an image first.");
        return;
    }

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    tempCtx.drawImage(img, 0, 0);

    const pixelationLevel = 20;
    rectangles.forEach((rect) => {
        if (rect.width <= 0 || rect.height <= 0) return;

        for (let y = rect.y; y < rect.y + rect.height; y += pixelationLevel) {
            for (
                let x = rect.x;
                x < rect.x + rect.width;
                x += pixelationLevel
            ) {
                const pixelData = tempCtx.getImageData(x, y, 1, 1).data;
                tempCtx.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${
                    pixelData[2]
                }, ${pixelData[3] / 255})`;

                const blockWidth = Math.min(
                    pixelationLevel,
                    rect.x + rect.width - x
                );
                const blockHeight = Math.min(
                    pixelationLevel,
                    rect.y + rect.height - y
                );
                tempCtx.fillRect(x, y, blockWidth, blockHeight);
            }
        }
    });

    const dataUrl = tempCanvas.toDataURL("image/png");
    const newTab = window.open();
    newTab.document.body.innerHTML = `<img src="${dataUrl}" style="max-width: 100%; background-color: #333;">`;
}

function onWheel(e) {
    e.preventDefault();

    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, scale + scaleAmount), 10);
    const scaleRatio = newScale / scale;

    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;

    originX = mouseX - (mouseX - originX) * scaleRatio;
    originY = mouseY - (mouseY - originY) * scaleRatio;
    scale = newScale;

    redrawCanvas();
}

function saveState() {
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }
    const newState = JSON.parse(JSON.stringify(rectangles));
    history.push(newState);
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        rectangles = JSON.parse(JSON.stringify(history[historyIndex]));
        selectedRectangle = null;
        redrawCanvas();
        updateUndoRedoButtons();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        rectangles = JSON.parse(JSON.stringify(history[historyIndex]));
        selectedRectangle = null;
        redrawCanvas();
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
}
