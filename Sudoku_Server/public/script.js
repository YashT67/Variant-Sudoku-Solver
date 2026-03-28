document.addEventListener("DOMContentLoaded", () => {
    // --- DOM Elements ---
    const gridContainer = document.getElementById('sudoku-grid');
    const gridSizeSelect = document.getElementById('grid-size');
    const resetBtn = document.getElementById('reset-btn');
    const radioButtons = document.querySelectorAll('input[name="constraint"]');
    const sumContainer = document.getElementById('sum-container');
    const sumInput = document.getElementById('sum-input');
    const addBtn = document.getElementById('add-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const svgLayer = document.getElementById('svg-layer');

    // --- State Variables ---
    let isDragging = false;
    let activeCell = null;
    let currentSize = 9;
    
    // History Stacks & Drawing Data
    let undoStack = [];
    let redoStack = [];
    let activeConstraints = []; 
    let cellValueBeforeEdit = ""; 

    // --- Generate grid dynamically ---
    function buildGrid(size) {
        currentSize = size;
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${size}, 1fr)`;

        // Clear history and constraints when grid changes size
        undoStack = [];
        redoStack = [];
        activeConstraints = [];
        updateUndoRedoUI();
        renderSVG();

        let blockWidth, blockHeight;
        if (size === 9) { blockWidth = 3; blockHeight = 3; }
        else if (size === 6) { blockWidth = 3; blockHeight = 2; }
        else if (size === 4) { blockWidth = 2; blockHeight = 2; }

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = '1';
                input.max = size.toString();
                input.className = 'cell';
                input.dataset.row = row;
                input.dataset.col = col;

                if (col % blockWidth === blockWidth - 1 && col !== size - 1) {
                    input.classList.add('border-right');
                }
                if (row % blockHeight === blockHeight - 1 && row !== size - 1) {
                    input.classList.add('border-bottom');
                }

                gridContainer.appendChild(input);
            }
        }
    }

    buildGrid(9); // Initialize

    // --- Helper Functions ---
    function clearSelection() {
        document.querySelectorAll('.cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
    }

    function updateUndoRedoUI() {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
    }

    // --- SVG Drawing Engine ---
    function renderSVG() {
        svgLayer.innerHTML = ''; // Clear old drawings

        // Define arrowhead marker
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "arrowhead");
        marker.setAttribute("markerWidth", "6");
        marker.setAttribute("markerHeight", "6");
        marker.setAttribute("refX", "3");
        marker.setAttribute("refY", "3");
        marker.setAttribute("orient", "auto");
        const arrowPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        arrowPolygon.setAttribute("points", "0 0, 6 3, 0 6");
        arrowPolygon.setAttribute("fill", "#cccccc");
        marker.appendChild(arrowPolygon);
        defs.appendChild(marker);
        svgLayer.appendChild(defs);
        
        const rect = gridContainer.getBoundingClientRect();
        const cellW = rect.width / currentSize;
        const cellH = rect.height / currentSize;

        const getCenter = (row, col) => ({
            x: col * cellW + (cellW / 2),
            y: row * cellH + (cellH / 2)
        });

        activeConstraints.forEach(constraint => {
            const cells = constraint.cells;
            if (cells.length === 0) return;

            const hasCell = (r, c) => cells.some(cell => parseInt(cell.row) === r && parseInt(cell.col) === c);

            // --- THERMOMETER & ARROW ---
            if (constraint.constraintType === 'thermo' || constraint.constraintType === 'arrow') {
                const isThermo = constraint.constraintType === 'thermo';
                const bulbCenter = getCenter(cells[0].row, cells[0].col);

                // Draw line FIRST so the bulb renders on top
                if (cells.length > 1) {
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    let d = `M ${bulbCenter.x} ${bulbCenter.y}`;
                    for (let i = 1; i < cells.length; i++) {
                        let pt = getCenter(cells[i].row, cells[i].col);
                        d += ` L ${pt.x} ${pt.y}`;
                    }
                    path.setAttribute("d", d);
                    path.setAttribute("class", isThermo ? "svg-thermo-line" : "svg-arrow-line");
                    if (!isThermo) path.setAttribute("marker-end", "url(#arrowhead)");
                    svgLayer.appendChild(path);
                }

                // Draw bulb AFTER so it sits on top of the line
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", bulbCenter.x);
                circle.setAttribute("cy", bulbCenter.y);
                circle.setAttribute("r", cellW * 0.35);
                circle.setAttribute("class", isThermo ? "svg-thermo-bulb" : "svg-arrow-bulb");
                svgLayer.appendChild(circle);
            }

            // --- SQUARE & CIRCLE ---
            else if (constraint.constraintType === 'square' || constraint.constraintType === 'circle') {
                cells.forEach(c => {
                    const center = getCenter(c.row, c.col);
                    const size = cellW * 0.6;
                    
                    if (constraint.constraintType === 'square') {
                        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                        rect.setAttribute("x", center.x - size/2);
                        rect.setAttribute("y", center.y - size/2);
                        rect.setAttribute("width", size);
                        rect.setAttribute("height", size);
                        rect.setAttribute("rx", 5);
                        rect.setAttribute("class", "svg-even-square");
                        svgLayer.appendChild(rect);
                    } else {
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute("cx", center.x);
                        circle.setAttribute("cy", center.y);
                        circle.setAttribute("r", size/2);
                        circle.setAttribute("class", "svg-odd-circle");
                        svgLayer.appendChild(circle);
                    }
                });
            }

            // --- KROPKI DOTS ---
            else if (constraint.constraintType === 'kropki_white' || constraint.constraintType === 'kropki_black') {
                if (cells.length === 2) {
                    const c1 = getCenter(cells[0].row, cells[0].col);
                    const c2 = getCenter(cells[1].row, cells[1].col);
                    
                    const midX = (c1.x + c2.x) / 2;
                    const midY = (c1.y + c2.y) / 2;

                    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute("cx", midX);
                    circle.setAttribute("cy", midY);
                    circle.setAttribute("r", cellW * 0.15); 
                    circle.setAttribute("class", constraint.constraintType === 'kropki_white' ? 'svg-kropki-white' : 'svg-kropki-black');
                    svgLayer.appendChild(circle);
                }
            }

            // --- KILLER CAGE ---
            else if (constraint.constraintType === 'killer') {
                const inset = 4; 
                let minRow = Infinity;
                let minCol = Infinity;

                cells.forEach(c => {
                    const r = parseInt(c.row);
                    const col = parseInt(c.col);
                    const x = col * cellW;
                    const y = r * cellH;

                    if (r < minRow || (r === minRow && col < minCol)) {
                        minRow = r;
                        minCol = col;
                    }

                    if (!hasCell(r - 1, col)) {
                        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", x + inset); line.setAttribute("y1", y + inset);
                        line.setAttribute("x2", x + cellW - inset); line.setAttribute("y2", y + inset);
                        line.setAttribute("class", "svg-cage-line");
                        svgLayer.appendChild(line);
                    }
                    if (!hasCell(r + 1, col)) {
                        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", x + inset); line.setAttribute("y1", y + cellH - inset);
                        line.setAttribute("x2", x + cellW - inset); line.setAttribute("y2", y + cellH - inset);
                        line.setAttribute("class", "svg-cage-line");
                        svgLayer.appendChild(line);
                    }
                    if (!hasCell(r, col - 1)) {
                        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", x + inset); line.setAttribute("y1", y + inset);
                        line.setAttribute("x2", x + inset); line.setAttribute("y2", y + cellH - inset);
                        line.setAttribute("class", "svg-cage-line");
                        svgLayer.appendChild(line);
                    }
                    if (!hasCell(r, col + 1)) {
                        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                        line.setAttribute("x1", x + cellW - inset); line.setAttribute("y1", y + inset);
                        line.setAttribute("x2", x + cellW - inset); line.setAttribute("y2", y + cellH - inset);
                        line.setAttribute("class", "svg-cage-line");
                        svgLayer.appendChild(line);
                    }
                });

                if (constraint.sum) {
                    const textX = (minCol * cellW) + inset + 2;
                    const textY = (minRow * cellH) + inset + 12; 
                    
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute("x", textX);
                    text.setAttribute("y", textY);
                    text.setAttribute("class", "svg-cage-text");
                    text.textContent = constraint.sum;
                    svgLayer.appendChild(text);
                }
            }
        });
    }

    // Keep SVG perfectly aligned if window changes size
    window.addEventListener('resize', renderSVG);

    // --- Digit Tracking Logic ---
    gridContainer.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('cell')) {
            cellValueBeforeEdit = e.target.value;
        }
    });

    gridContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('cell')) {
            // Clamp value to valid digit range
            const val = parseInt(e.target.value);
            if (e.target.value !== '' && (!Number.isInteger(val) || val < 1 || val > currentSize)) {
                e.target.value = cellValueBeforeEdit;
                return;
            }
            const newValue = e.target.value;
            if (newValue !== cellValueBeforeEdit) {
                undoStack.push({
                    type: 'digit',
                    row: e.target.dataset.row,
                    col: e.target.dataset.col,
                    oldVal: cellValueBeforeEdit,
                    newVal: newValue
                });
                redoStack = []; 
                updateUndoRedoUI();
                cellValueBeforeEdit = newValue; 
            }
        }
    });

    // --- Undo / Redo Execution Logic ---
    undoBtn.addEventListener('click', () => {
        if (undoStack.length === 0) return;
        
        const action = undoStack.pop();
        
        if (action.type === 'digit') {
            const cell = document.querySelector(`.cell[data-row="${action.row}"][data-col="${action.col}"]`);
            if (cell) cell.value = action.oldVal; 
        } 
        else if (action.type === 'constraint_add') {
            activeConstraints = activeConstraints.filter(c => c.id !== action.constraint.id);
            renderSVG();
        }

        redoStack.push(action);
        updateUndoRedoUI();
    });

    redoBtn.addEventListener('click', () => {
        if (redoStack.length === 0) return;
        
        const action = redoStack.pop();
        
        if (action.type === 'digit') {
            const cell = document.querySelector(`.cell[data-row="${action.row}"][data-col="${action.col}"]`);
            if (cell) cell.value = action.newVal; 
        } 
        else if (action.type === 'constraint_add') {
            activeConstraints.push(action.constraint);
            renderSVG();
        }

        undoStack.push(action);
        updateUndoRedoUI();
    });

    // --- Keyboard Shortcuts (Ctrl+Z / Ctrl+Y & Arrows) ---
    document.addEventListener('keydown', (e) => {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
            e.preventDefault(); 
            if (!undoBtn.disabled) undoBtn.click();
        }
        if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
            e.preventDefault(); 
            if (!redoBtn.disabled) redoBtn.click();
        }

        if (!activeCell) return;
        const key = e.key;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            e.preventDefault(); 
            let row = parseInt(activeCell.dataset.row);
            let col = parseInt(activeCell.dataset.col);

            if (key === 'ArrowUp') row--;
            if (key === 'ArrowDown') row++;
            if (key === 'ArrowLeft') col--;
            if (key === 'ArrowRight') col++;

            if (row >= 0 && row < currentSize && col >= 0 && col < currentSize) {
                const nextCell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                if (nextCell) {
                    if (!e.shiftKey) clearSelection();
                    nextCell.classList.add('selected');
                    nextCell.focus();
                    activeCell = nextCell; 
                }
            }
        }
    });

    // --- Mouse Drag Logic ---
    gridContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('cell')) {
            isDragging = true;
            if (!e.shiftKey && !e.ctrlKey) clearSelection();
            e.target.classList.add('selected');
            activeCell = e.target;
            e.target.focus();
            e.preventDefault(); 
        }
    });

    gridContainer.addEventListener('mouseover', (e) => {
        if (isDragging && e.target.classList.contains('cell')) {
            e.target.classList.add('selected');
            activeCell = e.target;
            e.target.focus();
        }
    });

    document.addEventListener('mouseup', () => isDragging = false);

    // --- UI Controls ---
    gridSizeSelect.addEventListener('change', (e) => {
        buildGrid(parseInt(e.target.value));
    });

    resetBtn.addEventListener('click', () => {
        document.querySelectorAll('.cell').forEach(cell => {
            cell.value = '';
            cell.classList.remove('selected');
        });
        activeCell = null;
        undoStack = [];
        redoStack = [];
        activeConstraints = [];
        updateUndoRedoUI();
        renderSVG();
    });

    radioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'killer') {
                sumContainer.style.display = 'block';
                sumInput.focus();
            } else {
                sumContainer.style.display = 'none';
                sumInput.value = ''; 
            }
        });
    });

    addBtn.addEventListener('click', () => {
        const selectedRadio = document.querySelector('input[name="constraint"]:checked');
        const selectedCells = document.querySelectorAll('.cell.selected');

        if (!selectedRadio) { alert("Please select a constraint first!"); return; }
        if (selectedCells.length === 0) { alert("Please highlight at least one cell on the grid first!"); return; }

        const constraintType = selectedRadio.value;

        // Kropki check
        if ((constraintType === 'kropki_white' || constraintType === 'kropki_black') && selectedCells.length !== 2) {
            alert("For Kropki dots, please select exactly 2 adjacent cells!");
            return;
        }

        // Killer cage sum check
        if (constraintType === 'killer') {
            const sumVal = parseInt(sumInput.value);
            if (!sumInput.value || isNaN(sumVal) || sumVal <= 0) {
                alert("Please enter a valid positive sum for the Killer cage!");
                return;
            }
        }

        const cellData = Array.from(selectedCells).map(c => ({ row: c.dataset.row, col: c.dataset.col }));
        
        const newConstraint = {
            id: Date.now(),
            constraintType: constraintType,
            cells: cellData,
            sum: constraintType === 'killer' ? sumInput.value : null
        };

        activeConstraints.push(newConstraint);
        undoStack.push({ type: 'constraint_add', constraint: newConstraint });
        
        redoStack = [];
        updateUndoRedoUI();
        clearSelection(); 
        renderSVG();
    });

    const solveBtn = document.getElementById('solve-btn');
    const clearSolBtn = document.getElementById('clear-sol-btn');

    if (clearSolBtn) {
        clearSolBtn.addEventListener('click', () => {
            document.querySelectorAll('.cell.solved-pop').forEach(cell => {
                cell.value = '';
                cell.classList.remove('solved-pop');
            });
            const badge = document.getElementById('uniqueness-badge');
            if (badge) badge.classList.add('hidden');
            
            const logsBox = document.getElementById('logs-container');
            if (logsBox) logsBox.innerHTML = '<p class="placeholder-log">Waiting for solver...</p>';
        });
    }

    solveBtn.addEventListener('click', async () => {
        solveBtn.textContent = "Solving...";
        solveBtn.disabled = true;
        if (clearSolBtn) clearSolBtn.disabled = true;
        resetBtn.disabled = true;

        // 1. Extract Current Grid Numbers
        const gridData = [];
        for (let r = 0; r < currentSize; r++) {
            const row = [];
            for (let c = 0; c < currentSize; c++) {
                const val = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`).value;
                row.push(val ? parseInt(val) : 0);
            }
            gridData.push(row);
        }

        // 2. Send to Node.js Backend
        try {
            const response = await fetch('/solve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    size: currentSize,
                    grid: gridData,
                    constraints: activeConstraints
                })
            });

            const result = await response.json();

            if (result.status === "success" || result.status === "failed") {
                // 1. Show Uniqueness Badge
                const badge = document.getElementById('uniqueness-badge');
                if (badge) {
                    badge.classList.remove('hidden', 'unique', 'multiple');
                    if (result.unique) {
                        badge.classList.add('unique');
                        badge.textContent = 'UNIQUE SOLUTION';
                    } else if (result.status !== "failed") {
                        badge.classList.add('multiple');
                        badge.textContent = 'MULTIPLE SOLUTIONS';
                    } else {
                        badge.classList.add('multiple');
                        badge.textContent = 'NO SOLUTION';
                    }
                }

                // 2. Clear old logs & prep DOM
                const logsBox = document.getElementById('logs-container');
                if (logsBox) logsBox.innerHTML = '';

                // Find empty cells to animate
                const emptyCells = [];
                for (let r = 0; r < currentSize; r++) {
                    for (let c = 0; c < currentSize; c++) {
                        const cell = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                        if (!cell.value) {
                            emptyCells.push({r, c, val: result.grid[r][c], cell});
                        }
                    }
                }

                // 3. Step-by-step visual animation processor
                let stepDelay = 80; // Speed of animation 
                let stepIdx = 0;
                
                // Remove previous pop classes
                document.querySelectorAll('.cell.solved-pop').forEach(c => c.classList.remove('solved-pop'));

                const triggerVictory = () => {
                    if (result.status === "failed") {
                        alert("Failed! The puzzle has no valid solution. You can review the solver's attempts in the logical deductions panel.");
                    } else {
                        emptyCells.forEach(item => {
                            if (!item.cell.value) {
                                item.cell.value = item.val;
                                item.cell.classList.add('solved-pop');
                            }
                        });

                        confetti({
                            particleCount: 150,
                            spread: 80,
                            origin: { y: 0.6 },
                            colors: ['#6366f1', '#a855f7', '#4ade80']
                        });
                    }
                    
                    setTimeout(() => {
                        solveBtn.textContent = "▶ Solve Puzzle";
                        solveBtn.disabled = false;
                        if (clearSolBtn) clearSolBtn.disabled = false;
                        resetBtn.disabled = false;
                    }, 500);
                };

                const animateStep = () => {
                    if (result.steps && stepIdx < result.steps.length) {
                        const stepText = result.steps[stepIdx];
                        
                        if (logsBox) {
                            const logDiv = document.createElement('div');
                            logDiv.className = 'log-entry';
                            logDiv.textContent = stepText;
                            logsBox.appendChild(logDiv);
                            logsBox.scrollTop = logsBox.scrollHeight;
                        }

                        // Parse "Trying value V at cell (R,C)"
                        const matchTry = stepText.match(/Trying value (\d+) at cell \((\d+),(\d+)\)/);
                        if (matchTry) {
                            const v = matchTry[1];
                            const r = parseInt(matchTry[2]);
                            const c = parseInt(matchTry[3]);
                            const tgt = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                            if (tgt && !tgt.value) {
                                tgt.value = v;
                                tgt.classList.add('solved-pop');
                            }
                        }

                        // Parse "Backtracking from cell (R,C)"
                        const matchBack = stepText.match(/Backtracking from cell \((\d+),(\d+)\)/);
                        if (matchBack) {
                            const r = parseInt(matchBack[1]);
                            const c = parseInt(matchBack[2]);
                            const tgt = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
                            if (tgt) {
                                tgt.value = '';
                                tgt.classList.remove('solved-pop');
                            }
                        }

                        stepIdx++;
                        setTimeout(animateStep, stepDelay);
                    } else {
                        triggerVictory();
                    }
                };

                animateStep();

            } else {
                alert("Failed! The puzzle has no valid solution with these constraints.");
                solveBtn.textContent = "▶ Solve Puzzle";
                solveBtn.disabled = false;
                if (clearSolBtn) clearSolBtn.disabled = false;
                resetBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            alert("Error connecting to backend server.");
            solveBtn.textContent = "▶ Solve Puzzle";
            solveBtn.disabled = false;
            if (clearSolBtn) clearSolBtn.disabled = false;
            resetBtn.disabled = false;
        }
    });
});