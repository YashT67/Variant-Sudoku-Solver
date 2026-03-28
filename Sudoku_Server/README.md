# 🧩 Grid Rush: Advanced Sudoku Variant Solver

Welcome to the **Grid Rush Sudoku Solver**, a high-performance, full-stack application designed to solve complex Sudoku variants with multiple overlapping constraints.

Built to exceed the *Grid Rush* problem-statement specifications, this solver doesn't just find the answers—it physically walks you through its own logical deductions, animating the backtracking algorithm right before your eyes in a premium glassmorphic UI.

## ✨ Key Features

* **Real-time Logic Playback:** The backend streams its algorithmic brute-force steps, allowing the frontend to animate the search process cell-by-cell (including backtracks) even for puzzles with no solution!
* **Uniqueness Validation:** Confirms if the board has exactly one solution, flagging ambiguous geometries or invalid constraints.
* **Blazing Fast C++ Engine:** A heavily optimized bitmask Constraint Satisfaction Problem (CSP) core that cuts through complex constraints in milliseconds.
* **Extensible Schema:** Built on top of a highly extensible JSON REST bridging interface. See [SCHEMA.md](SCHEMA.md) for details on how the system translates data to the core solver.
* **Premium Dashboard:** Features an animated frosted-glass layout that visualizes constraint bounding-boxes, thermometer stems, killer cages, and Kropki dots out-of-the-box.

## 🛠 Supported Variants

Our generalized constraint modeling currently supports any hybrid combination of the following variant rules:

1. **Classic Sudoku** (9x9, 6x6, and 4x4)
2. **Killer Sudoku**: Cages with specified target sums.
3. **Thermo Sudoku**: Digits must strictly increase out from the bulb.
4. **Arrow Sudoku**: Digits on the arrow stem must sum to the bulb value.
5. **Kropki Black (Multiple)**: Adjoining cells must have a 1:2 ratio.
6. **Kropki White (Consecutive)**: Adjoining cells must be mathematically consecutive. 
7. **Square (Even)** & **Circle (Odd)** Formats.

## 🚀 How to Run

### 1. Prerequisites
Ensure you have Node.js installed on your machine.
If you plan to modify or re-compile the solver, you will also need the `g++` compiler on your system path.

### 2. Startup
Navigate to the `sudoku-server` directory and install any missing dependencies via NPM (if `package.json` relies on custom modules like express or cors).
```bash
npm install
node server.js
```

### 3. Usage
- Open **http://localhost:3000** in your web browser.
- Use the sidebar to overlay constraint rules (like dragging over cells and hitting **➕ Add Constraint**).
- Once your puzzle is drafted, hit **▶ Solve Puzzle** and watch the logical deduction pipeline tackle the board!
- Use the **🧹 Clear Solution** button to erase the solver's answers while preserving your initial clues.

---

### Rebuilding the C++ Solver
If you make changes to `main.cpp`, recompile the core using generic `O3` optimization flags:
```bash
# Windows
g++ -O3 main.cpp -o solver.exe

# Linux / MacOS (Requires updating server.js exec bridge)
g++ -O3 main.cpp -o solver
```
