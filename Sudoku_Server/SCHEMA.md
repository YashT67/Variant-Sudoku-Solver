# Sudoku Variant Solver - Data Schema

This document outlines the standard schema used to represent Sudoku puzzles, state, and complex constraint variants.

The solver system uses a highly extensible **JSON Input Schema** for the frontend-to-backend API wrapper, which is further serialized into a **Text-Based Interface Format** for optimal performance inside the C++ Core Engine. 

---

## 1. JSON REST API Schema (Frontend <-> Backend)

The JSON schema sent via HTTP `POST /solve` is designed to be easily readable, scriptable, and extendable for new variants.

### Base Puzzle Object

```json
{
  "size": 9,
  "grid": [
    [0, 5, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 8, 0, 0, 0, 0, 0],
    ... (9 total rows of 9 integers) 
  ],
  "constraints": [
    ... // Array of Constraint Objects
  ]
}
```

* **`size`** *(integer)*: Size of the Grid (Accepts `4`, `6`, `9`).
* **`grid`** *(array of array of integers)*: The starting clues of the puzzle. Empty spaces are represented natively by `0`.
* **`constraints`** *(array of objects)*: A list of dynamic rules to overlay onto the grid.

### Constraint Objects Overview

Constraints require a `constraintType` string ID and an array of `cells` defined by 0-indexed `{ row, col }` objects.

#### A. Killer / Cage
The sum of digits in the designated cells must equal the target `sum` without any repeating digits.
```json
{
  "constraintType": "killer",
  "sum": "15",
  "cells": [
    {"row": 0, "col": 0}, 
    {"row": 0, "col": 1}, 
    {"row": 1, "col": 0}
  ]
}
```

#### B. Thermometer
Digits must strictly increase as they move along the line, starting from the first element (the bulb).
```json
{
  "constraintType": "thermo",
  "cells": [
    {"row": 2, "col": 3}, // Bulb
    {"row": 2, "col": 4}, 
    {"row": 3, "col": 4}  // Tip
  ]
}
```

#### C. Arrow
The sum of the digits along the arrow line must equal the number situated in the first element (the bulb).
```json
{
  "constraintType": "arrow",
  "cells": [
    {"row": 5, "col": 5}, // Bulb (The Sum)
    {"row": 6, "col": 6}, // Stem
    {"row": 7, "col": 7}  // Stem
  ]
}
```

#### D. Kropki Dots (Black / White)
Evaluates ratios or adjacencies between exactly two adjacent cells.
* `kropki_black`: Indicates one cell must be exactly double the other (Ratio 1:2).
* `kropki_white`: Indicates the cells must be consecutive mathematically.
```json
{
  "constraintType": "kropki_black", 
  "cells": [
    {"row": 8, "col": 8},
    {"row": 8, "col": 7}
  ]
}
```

#### E. Even (Square) / Odd (Circle) Formats
Requires target squares to only contain even or odd integers.
```json
{
  "constraintType": "square",
  "cells": [ {"row": 4, "col": 4} ]
}
```

---

## 2. Textual Flat Interface (Backend <-> C++ Core)
To strip JSON overhead in the C++ layer, the data array is flattened securely into `input.txt` right before execution.

```text
9                     // 1. Grid Size N
0 5 0 0 0 0 0 0 0     // 2. N lines of Grid Numbers
...                   // ...
CAGE 15 3 0 0 0 1 1 0 // 3. Constraints (Format: TYPE [PARAMS...] [ROW] [COL] ...)
THERMO 3 2 3 2 4 3 4  
SOLVE                 // 4. End of file execution flag
```

### Extensibility Guide for Developers:
Adding a new variant (e.g., *Palindromes*, *Diagonals*) requires only 3 minor steps without ripping apart the architecture:
1. **Frontend**: Add a radio-button and push the selection to `activeConstraints` array pointing to `constraintType: "diagonal"`.
2. **Node Parser**: Translate the JSON object inside `server.js` loop into a single flat line `DIAGONAL ... (Params)`.
3. **C++ constraint registration**: Create a lightweight `<DiagonalConstraint>` class that implements the base `<Constraint>` engine inheritance, dropping it onto the board registry in `main.cpp`.
