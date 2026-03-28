const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path'); // <-- ADD THIS

const app = express();
// Allow the port to be set by your server environment, default to 3000
const PORT = process.env.PORT || 3000; 

app.use(cors());
app.use(express.json());

// --- ADD THIS LINE ---
// This tells Node.js to serve your index.html, style.css, and script.js 
// whenever someone visits the root URL of your server.
app.use(express.static(path.join(__dirname, 'public')));

app.post('/solve', (req, res) => {
    const { size, grid, constraints } = req.body;

    // 1. Build the input string
    let inputData = `${size}\n`;
    
    // Add grid
    for (let r = 0; r < size; r++) {
        inputData += grid[r].join(' ') + '\n';
    }

    // Add constraints
    constraints.forEach(c => {
        if (c.constraintType === 'thermo') {
            inputData += `THERMO ${c.cells.length} ${c.cells.map(pt => `${pt.row} ${pt.col}`).join(' ')}\n`;
        } else if (c.constraintType === 'arrow') {
            // Arrow needs bulb separate from stem
            inputData += `ARROW ${c.cells[0].row} ${c.cells[0].col} ${c.cells.length - 1} ${c.cells.slice(1).map(pt => `${pt.row} ${pt.col}`).join(' ')}\n`;
        } else if (c.constraintType === 'killer') {
            inputData += `CAGE ${c.sum} ${c.cells.length} ${c.cells.map(pt => `${pt.row} ${pt.col}`).join(' ')}\n`;
        } else if (c.constraintType === 'kropki_white') {
            inputData += `WHITE ${c.cells[0].row} ${c.cells[0].col} ${c.cells[1].row} ${c.cells[1].col}\n`;
        } else if (c.constraintType === 'kropki_black') {
            inputData += `BLACK ${c.cells[0].row} ${c.cells[0].col} ${c.cells[1].row} ${c.cells[1].col}\n`;
        } else if (c.constraintType === 'square') {
            c.cells.forEach(pt => inputData += `SQUARE ${pt.row} ${pt.col}\n`);
        } else if (c.constraintType === 'circle') {
            c.cells.forEach(pt => inputData += `CIRCLE ${pt.row} ${pt.col}\n`);
        }
    });

    inputData += "SOLVE\n";

    // 2. Write to input.txt
    fs.writeFileSync('input.txt', inputData);

    // 3. Execute C++ solver (update to './solver' if on Mac/Linux)
    const command = process.platform === 'win32' ? 'solver.exe' : './solver';
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error("Execution error:", error);
            return res.json({ status: "error" });
        }

        // 4. Read the answer — trim each line to handle \r\n on Windows
        const outputData = fs.readFileSync('output.txt', 'utf8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (outputData[0] === 'UNIQUE' || outputData[0] === 'MULTIPLE' || outputData[0] === 'FAILED') {
            const isUnique = outputData[0] === 'UNIQUE';
            const solverStatus = outputData[0] === 'FAILED' ? 'failed' : 'success';
            
            const solvedGrid = [];
            for (let i = 1; i <= size; i++) {
                solvedGrid.push(outputData[i].split(/\s+/).map(Number));
            }
            
            const steps = [];
            let readingSteps = false;
            for (let i = size + 1; i < outputData.length; i++) {
                if (outputData[i] === 'STEPS') {
                    readingSteps = true;
                    continue;
                }
                if (readingSteps) {
                    steps.push(outputData[i]);
                }
            }

            res.json({ status: solverStatus, unique: isUnique, grid: solvedGrid, steps: steps });
        } else {
            res.json({ status: "error" });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
});