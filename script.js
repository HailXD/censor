const canvas = document.getElementById('censor-canvas');
const ctx = canvas.getContext('2d');
const imageLoader = document.getElementById('image-loader');
const addRectBtn = document.getElementById('add-rect-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const pixelateBtn = document.getElementById('pixelate-btn');

let img = new Image();
let rectangles = [];
let history = [];
let historyIndex = -1;
let isDrawing = false;
let isMoving = false;
let isResizing = false;
let resizeHandle = '';
const handleSize = 8;
let selectedRectangle = null;
let startX, startY;
let offsetX, offsetY;

imageLoader.addEventListener('change', handleImage, false);
canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);
canvas.addEventListener('mouseout', onMouseUp); // Use onMouseUp to stop any action
canvas.addEventListener('contextmenu', removeRectangle);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
pixelateBtn.addEventListener('click', pixelateAndDownload);
addRectBtn.addEventListener('click', () => {
    // This button will be used for a different drawing mode later
    // For now, it can serve as a placeholder or be used for mobile-specific actions
    alert("Click and drag on the canvas to draw a rectangle.");
});


function handleImage(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            rectangles = [];
            history = [];
            historyIndex = -1;
            saveState();
            redrawCanvas();
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    drawRectangles();
}

function drawRectangles() {
    rectangles.forEach(rect => {
        ctx.strokeStyle = (rect === selectedRectangle) ? 'blue' : 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        if (rect === selectedRectangle) {
            drawResizeHandles(rect);
        }
    });
}

function drawResizeHandles(rect) {
    ctx.fillStyle = 'blue';
    const halfHandle = handleSize / 2;
    // Corners
    ctx.fillRect(rect.x - halfHandle, rect.y - halfHandle, handleSize, handleSize); // TL
    ctx.fillRect(rect.x + rect.width - halfHandle, rect.y - halfHandle, handleSize, handleSize); // TR
    ctx.fillRect(rect.x - halfHandle, rect.y + rect.height - halfHandle, handleSize, handleSize); // BL
    ctx.fillRect(rect.x + rect.width - halfHandle, rect.y + rect.height - halfHandle, handleSize, handleSize); // BR
    // Edges
    ctx.fillRect(rect.x + rect.width / 2 - halfHandle, rect.y - halfHandle, handleSize, handleSize); // T
    ctx.fillRect(rect.x + rect.width / 2 - halfHandle, rect.y + rect.height - halfHandle, handleSize, handleSize); // B
    ctx.fillRect(rect.x - halfHandle, rect.y + rect.height / 2 - halfHandle, handleSize, handleSize); // L
    ctx.fillRect(rect.x + rect.width - halfHandle, rect.y + rect.height / 2 - halfHandle, handleSize, handleSize); // R
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getResizeHandle(x, y, rect) {
    if (!rect) return '';
    const halfHandle = handleSize / 2;
    // Corners
    if (x > rect.x - halfHandle && x < rect.x + halfHandle && y > rect.y - halfHandle && y < rect.y + halfHandle) return 'top-left';
    if (x > rect.x + rect.width - halfHandle && x < rect.x + rect.width + halfHandle && y > rect.y - halfHandle && y < rect.y + halfHandle) return 'top-right';
    if (x > rect.x - halfHandle && x < rect.x + halfHandle && y > rect.y + rect.height - halfHandle && y < rect.y + rect.height + halfHandle) return 'bottom-left';
    if (x > rect.x + rect.width - halfHandle && x < rect.x + rect.width + halfHandle && y > rect.y + rect.height - halfHandle && y < rect.y + rect.height + halfHandle) return 'bottom-right';
    // Edges
    if (x > rect.x + rect.width / 2 - halfHandle && x < rect.x + rect.width / 2 + halfHandle && y > rect.y - halfHandle && y < rect.y + halfHandle) return 'top';
    if (x > rect.x + rect.width / 2 - halfHandle && x < rect.x + rect.width / 2 + halfHandle && y > rect.y + rect.height - halfHandle && y < rect.y + rect.height + halfHandle) return 'bottom';
    if (x > rect.x - halfHandle && x < rect.x + halfHandle && y > rect.y + rect.height / 2 - halfHandle && y < rect.y + rect.height / 2 + halfHandle) return 'left';
    if (x > rect.x + rect.width - halfHandle && x < rect.x + rect.width + halfHandle && y > rect.y + rect.height / 2 - halfHandle && y < rect.y + rect.height / 2 + halfHandle) return 'right';
    return '';
}

function getClickedRectangle(x, y) {
    for (let i = rectangles.length - 1; i >= 0; i--) {
        const rect = rectangles[i];
        if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
            return rect;
        }
    }
    return null;
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    const { x: mouseX, y: mouseY } = getMousePos(e);

    const handle = getResizeHandle(mouseX, mouseY, selectedRectangle);

    if (handle) {
        isResizing = true;
        resizeHandle = handle;
        startX = mouseX;
        startY = mouseY;
    } else {
        selectedRectangle = getClickedRectangle(mouseX, mouseY);
        if (selectedRectangle) {
            isMoving = true;
            offsetX = mouseX - selectedRectangle.x;
            offsetY = mouseY - selectedRectangle.y;
        } else {
            isDrawing = true;
            startX = mouseX;
            startY = mouseY;
        }
    }
    redrawCanvas();
}

function onMouseMove(e) {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    if (isResizing && selectedRectangle) {
        const oldX = selectedRectangle.x;
        const oldY = selectedRectangle.y;
        const oldW = selectedRectangle.width;
        const oldH = selectedRectangle.height;

        switch (resizeHandle) {
            case 'top-left':
                selectedRectangle.width += oldX - mouseX;
                selectedRectangle.height += oldY - mouseY;
                selectedRectangle.x = mouseX;
                selectedRectangle.y = mouseY;
                break;
            case 'top-right':
                selectedRectangle.width = mouseX - oldX;
                selectedRectangle.height += oldY - mouseY;
                selectedRectangle.y = mouseY;
                break;
            case 'bottom-left':
                selectedRectangle.width += oldX - mouseX;
                selectedRectangle.height = mouseY - oldY;
                selectedRectangle.x = mouseX;
                break;
            case 'bottom-right':
                selectedRectangle.width = mouseX - oldX;
                selectedRectangle.height = mouseY - oldY;
                break;
            case 'top':
                selectedRectangle.height += oldY - mouseY;
                selectedRectangle.y = mouseY;
                break;
            case 'bottom':
                selectedRectangle.height = mouseY - oldY;
                break;
            case 'left':
                selectedRectangle.width += oldX - mouseX;
                selectedRectangle.x = mouseX;
                break;
            case 'right':
                selectedRectangle.width = mouseX - oldX;
                break;
        }
        redrawCanvas();
    } else if (isMoving && selectedRectangle) {
        selectedRectangle.x = mouseX - offsetX;
        selectedRectangle.y = mouseY - offsetY;
        redrawCanvas();
    } else if (isDrawing) {
        redrawCanvas();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, mouseX - startX, mouseY - startY);
    } else {
        const handle = getResizeHandle(mouseX, mouseY, selectedRectangle);
        canvas.style.cursor = handle ? 'pointer' : 'default';
    }
}

function onMouseUp(e) {
    if (isResizing && selectedRectangle) {
        // Normalize rectangle
        if (selectedRectangle.width < 0) {
            selectedRectangle.x += selectedRectangle.width;
            selectedRectangle.width *= -1;
        }
        if (selectedRectangle.height < 0) {
            selectedRectangle.y += selectedRectangle.height;
            selectedRectangle.height *= -1;
        }
    } else if (isDrawing) {
        const { x: endX, y: endY } = getMousePos(e);
        const newRect = {
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
            width: Math.abs(endX - startX),
            height: Math.abs(endY - startY)
        };
        if (newRect.width > 5 && newRect.height > 5) {
            rectangles.push(newRect);
            selectedRectangle = newRect;
        }
    }
    isDrawing = false;
    isMoving = false;
    isResizing = false;
    resizeHandle = '';
    saveState();
    redrawCanvas();
}

function removeRectangle(e) {
    e.preventDefault(); // Prevent context menu
    const { x: clickX, y: clickY } = getMousePos(e);

    let removed = false;
    for (let i = rectangles.length - 1; i >= 0; i--) {
        const rect = rectangles[i];
        if (
            clickX >= rect.x &&
            clickX <= rect.x + rect.width &&
            clickY >= rect.y &&
            clickY <= rect.y + rect.height
        ) {
            rectangles.splice(i, 1);
            removed = true;
            break; // Remove only the top-most rectangle
        }
    }

    if (removed) {
        saveState();
        redrawCanvas();
    }
}

function saveState() {
    // Clear future history
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }
    // Deep copy of rectangles array
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

function pixelateAndDownload() {
    if (!img.src) {
        alert("Please load an image first.");
        return;
    }

    // Create a temporary canvas to apply pixelation
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Draw the original image
    tempCtx.drawImage(img, 0, 0);

    // Apply pixelation for each rectangle
    const pixelationLevel = 20; // Larger number = more pixelated
    rectangles.forEach(rect => {
        const imageData = tempCtx.getImageData(rect.x, rect.y, rect.width, rect.height);
        const data = imageData.data;
        for (let y = 0; y < rect.height; y += pixelationLevel) {
            for (let x = 0; x < rect.width; x += pixelationLevel) {
                // Get the color of the top-left pixel of the block
                const pixelIndex = (y * rect.width + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const a = data[pixelIndex + 3];

                // Apply this color to the entire block
                for (let blockY = 0; blockY < pixelationLevel; blockY++) {
                    for (let blockX = 0; blockX < pixelationLevel; blockX++) {
                        if (x + blockX < rect.width && y + blockY < rect.height) {
                            const i = ((y + blockY) * rect.width + (x + blockX)) * 4;
                            data[i] = r;
                            data[i + 1] = g;
                            data[i + 2] = b;
                            data[i + 3] = a;
                        }
                    }
                }
            }
        }
        tempCtx.putImageData(imageData, rect.x, rect.y);
    });

    // Trigger download
    const link = document.createElement('a');
    link.download = 'censored-image.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}