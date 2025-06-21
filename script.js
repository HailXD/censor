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
const handleSize = 20;
let selectedRectangle = null;
let startX, startY;
let offsetX, offsetY;
let touchTimer = null;

imageLoader.addEventListener('change', handleImage, false);
// Unified Input Events
canvas.addEventListener('mousedown', onMouseDown);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('mouseup', onMouseUp);
canvas.addEventListener('mouseout', onMouseUp); // Treat mouse out as mouse up

canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd);
canvas.addEventListener('touchcancel', onTouchEnd);

canvas.addEventListener('contextmenu', removeRectangle);
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);
pixelateBtn.addEventListener('click', pixelateAndDownload);
addRectBtn.addEventListener('click', () => {
    if (!img.src) {
        alert("Please load an image first.");
        return;
    }
    const rectWidth = canvas.width * 0.1;
    const rectHeight = canvas.height * 0.1;
    const newRect = {
        x: (canvas.width - rectWidth) / 2,
        y: (canvas.height - rectHeight) / 2,
        width: rectWidth,
        height: rectHeight
    };
    rectangles.push(newRect);
    selectedRectangle = newRect;
    saveState();
    redrawCanvas();
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
        if (rect === selectedRectangle) {
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 4;
        } else {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
        }
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        if (rect === selectedRectangle) {
            drawResizeHandles(rect);
        }
    });
}

function drawResizeHandles(rect) {
    ctx.fillStyle = 'cyan';
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
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
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
            case 'top-left':
                selectedRectangle.width += oldX - x;
                selectedRectangle.height += oldY - y;
                selectedRectangle.x = x;
                selectedRectangle.y = y;
                break;
            case 'top-right':
                selectedRectangle.width = x - oldX;
                selectedRectangle.height += oldY - y;
                selectedRectangle.y = y;
                break;
            case 'bottom-left':
                selectedRectangle.width += oldX - x;
                selectedRectangle.height = y - oldY;
                selectedRectangle.x = x;
                break;
            case 'bottom-right':
                selectedRectangle.width = x - oldX;
                selectedRectangle.height = y - oldY;
                break;
            case 'top':
                selectedRectangle.height += oldY - y;
                selectedRectangle.y = y;
                break;
            case 'bottom':
                selectedRectangle.height = y - oldY;
                break;
            case 'left':
                selectedRectangle.width += oldX - x;
                selectedRectangle.x = x;
                break;
            case 'right':
                selectedRectangle.width = x - oldX;
                break;
        }
    } else if (isMoving && selectedRectangle) {
        selectedRectangle.x = x - offsetX;
        selectedRectangle.y = y - offsetY;
    } else if (isDrawing) {
        redrawCanvas();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, x - startX, y - startY);
        return; // Return early to avoid redrawing again
    } else {
        const handle = getResizeHandle(x, y, selectedRectangle);
        canvas.style.cursor = handle ? 'pointer' : 'default';
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
            height: Math.abs(y - startY)
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

function onMouseDown(e) {
    if (e.button !== 0) return; // Only handle left-click
    const { x, y } = getMousePos(e);
    handleDown(x, y);
}

function onMouseMove(e) {
    const { x, y } = getMousePos(e);
    handleMove(x, y);
}

function onMouseUp(e) {
    const { x, y } = getMousePos(e);
    handleUp(x, y);
}

function removeRectangle(e) {
    e.preventDefault(); // Prevent context menu
    const { x: clickX, y: clickY } = getMousePos(e);
    removeRectangleAt(clickX, clickY);
}

function removeRectangleAt(x, y) {
    let removed = false;
    for (let i = rectangles.length - 1; i >= 0; i--) {
        const rect = rectangles[i];
        if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
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

function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const { x, y } = getMousePos(e.touches[0]);
        handleDown(x, y);

        // Start timer for long-press to delete
        clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
            // Check if still touching the same rectangle
            const currentPos = getClickedRectangle(x, y);
            if (currentPos && currentPos === selectedRectangle) {
                removeRectangleAt(x, y);
            }
        }, 1000); // 1 second
    }
}

function onTouchMove(e) {
    e.preventDefault();
    clearTimeout(touchTimer); // Cancel long press if finger moves
    if (e.touches.length === 1) {
        const { x, y } = getMousePos(e.touches[0]);
        handleMove(x, y);
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    clearTimeout(touchTimer);
    if (e.changedTouches.length === 1) {
        const { x, y } = getMousePos(e.changedTouches[0]);
        handleUp(x, y);
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

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    tempCtx.drawImage(img, 0, 0);

    const pixelationLevel = 20;
    rectangles.forEach(rect => {
        if (rect.width <= 0 || rect.height <= 0) return;

        for (let y = rect.y; y < rect.y + rect.height; y += pixelationLevel) {
            for (let x = rect.x; x < rect.x + rect.width; x += pixelationLevel) {
                // Get the color of the top-left pixel of the block from the clean temporary canvas
                const pixelData = tempCtx.getImageData(x, y, 1, 1).data;
                tempCtx.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
                
                // Draw a block of that color, ensuring it doesn't go outside the rectangle
                const blockWidth = Math.min(pixelationLevel, rect.x + rect.width - x);
                const blockHeight = Math.min(pixelationLevel, rect.y + rect.height - y);
                tempCtx.fillRect(x, y, blockWidth, blockHeight);
            }
        }
    });

    const link = document.createElement('a');
    link.download = 'censored-image.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}