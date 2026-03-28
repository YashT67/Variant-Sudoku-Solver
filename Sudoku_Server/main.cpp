#include <iostream>
#include <vector>
#include <memory>
#include <cmath>
#include <string>
#include <fstream>
#include <cstring>
#include <chrono>

using namespace std;

// --- Global Size Variables ---
int GRID_SIZE = 9;
int BOX_R = 3;
int BOX_C = 3;
uint16_t ALL_DIGITS = 0x1FF;

// ==========================================
// BITMASK HELPER FUNCTIONS
// ==========================================
inline int getMinVal(uint16_t mask) { return mask == 0 ? 0 : __builtin_ctz(mask) + 1; }
inline int getMaxVal(uint16_t mask) { return mask == 0 ? 0 : 32 - __builtin_clz(mask); }
inline int countVals(uint16_t mask) { return __builtin_popcount(mask); }

struct Point { int r, c; };

// ==========================================
// CONSTRAINT INTERFACES
// ==========================================
class Constraint {
public:
    virtual ~Constraint() = default;
    virtual bool reduce(uint16_t domains[9][9], bool& changed) const = 0;
};

class EvenOddConstraint : public Constraint {
    Point cell;
    bool mustBeEven; 
public:
    EvenOddConstraint(Point p, bool isEven) : cell(p), mustBeEven(isEven) {}
    bool reduce(uint16_t domains[9][9], bool& changed) const override {
        uint16_t allowed = mustBeEven ? 0x0AA : 0x155; // 0x0AA = evens, 0x155 = odds
        if ((domains[cell.r][cell.c] & allowed) != domains[cell.r][cell.c]) {
            domains[cell.r][cell.c] &= allowed;
            changed = true;
            if (domains[cell.r][cell.c] == 0) return false;
        }
        return true;
    }
};

class ThermoConstraint : public Constraint {
    vector<Point> thermo;
public:
    ThermoConstraint(const vector<Point>& t) : thermo(t) {}
    bool reduce(uint16_t dom[9][9], bool& changed) const override {
        for(size_t i = 0; i < thermo.size() - 1; ++i) {
            int min_prev = getMinVal(dom[thermo[i].r][thermo[i].c]);
            uint16_t mask = 0;
            for(int v = min_prev + 1; v <= GRID_SIZE; ++v) mask |= (1 << (v-1));
            if ((dom[thermo[i+1].r][thermo[i+1].c] & mask) != dom[thermo[i+1].r][thermo[i+1].c]) {
                dom[thermo[i+1].r][thermo[i+1].c] &= mask;
                changed = true;
                if(dom[thermo[i+1].r][thermo[i+1].c] == 0) return false;
            }
        }
        for(int i = thermo.size() - 2; i >= 0; --i) {
            int max_next = getMaxVal(dom[thermo[i+1].r][thermo[i+1].c]);
            uint16_t mask = 0;
            for(int v = 1; v <= max_next - 1; ++v) mask |= (1 << (v-1));
            if ((dom[thermo[i].r][thermo[i].c] & mask) != dom[thermo[i].r][thermo[i].c]) {
                dom[thermo[i].r][thermo[i].c] &= mask;
                changed = true;
                if(dom[thermo[i].r][thermo[i].c] == 0) return false;
            }
        }
        return true;
    }
};

class CageConstraint : public Constraint {
    int targetSum;
    vector<Point> cage;
public:
    CageConstraint(int target, const vector<Point>& cells) : targetSum(target), cage(cells) {}
    bool reduce(uint16_t dom[9][9], bool& changed) const override {
        int sumMin = 0, sumMax = 0;
        for(auto p : cage) {
            sumMin += getMinVal(dom[p.r][p.c]);
            sumMax += getMaxVal(dom[p.r][p.c]);
        }
        for(auto p : cage) {
            int othersMin = sumMin - getMinVal(dom[p.r][p.c]);
            int othersMax = sumMax - getMaxVal(dom[p.r][p.c]);
            int min_allowed = targetSum - othersMax;
            int max_allowed = targetSum - othersMin;
            uint16_t mask = 0;
            for(int v = max(1, min_allowed); v <= min(GRID_SIZE, max_allowed); ++v) mask |= (1 << (v-1));
            if ((dom[p.r][p.c] & mask) != dom[p.r][p.c]) {
                dom[p.r][p.c] &= mask;
                changed = true;
                if (dom[p.r][p.c] == 0) return false;
            }
        }
        for(auto p : cage) {
            if(countVals(dom[p.r][p.c]) == 1) {
                uint16_t val_mask = dom[p.r][p.c];
                for(auto p2 : cage) {
                    if (p.r != p2.r || p.c != p2.c) {
                        if (dom[p2.r][p2.c] & val_mask) {
                            dom[p2.r][p2.c] &= ~val_mask;
                            changed = true;
                            if (dom[p2.r][p2.c] == 0) return false;
                        }
                    }
                }
            }
        }
        return true;
    }
};

class ArrowConstraint : public Constraint {
    Point bulb;
    vector<Point> stem;
public:
    ArrowConstraint(Point b, const vector<Point>& s) : bulb(b), stem(s) {}
    bool reduce(uint16_t dom[9][9], bool& changed) const override {
        int stemMinSum = 0, stemMaxSum = 0;
        for(auto p : stem) {
            stemMinSum += getMinVal(dom[p.r][p.c]);
            stemMaxSum += getMaxVal(dom[p.r][p.c]);
        }
        uint16_t bulb_mask = 0;
        for(int v = max(1, stemMinSum); v <= min(GRID_SIZE, stemMaxSum); ++v) bulb_mask |= (1 << (v-1));
        if ((dom[bulb.r][bulb.c] & bulb_mask) != dom[bulb.r][bulb.c]) {
            dom[bulb.r][bulb.c] &= bulb_mask;
            changed = true;
            if (dom[bulb.r][bulb.c] == 0) return false;
        }
        int bulbMin = getMinVal(dom[bulb.r][bulb.c]);
        int bulbMax = getMaxVal(dom[bulb.r][bulb.c]);
        for(auto p : stem) {
            int othersMin = stemMinSum - getMinVal(dom[p.r][p.c]);
            int othersMax = stemMaxSum - getMaxVal(dom[p.r][p.c]);
            int min_allowed = bulbMin - othersMax;
            int max_allowed = bulbMax - othersMin;
            uint16_t mask = 0;
            for(int v = max(1, min_allowed); v <= min(GRID_SIZE, max_allowed); ++v) mask |= (1 << (v-1));
            if ((dom[p.r][p.c] & mask) != dom[p.r][p.c]) {
                dom[p.r][p.c] &= mask;
                changed = true;
                if (dom[p.r][p.c] == 0) return false;
            }
        }
        return true;
    }
};

class KropkiConstraint : public Constraint {
    Point p1, p2;
    bool isBlackDot; 
public:
    KropkiConstraint(Point a, Point b, bool blackDot) : p1(a), p2(b), isBlackDot(blackDot) {}
    bool reduce(uint16_t dom[9][9], bool& changed) const override {
        uint16_t d1 = dom[p1.r][p1.c], d2 = dom[p2.r][p2.c];
        uint16_t new_d1 = 0, new_d2 = 0;
        for(int v1 = 1; v1 <= GRID_SIZE; ++v1) {
            if (d1 & (1 << (v1-1))) {
                bool supported = false;
                for(int v2 = 1; v2 <= GRID_SIZE; ++v2) {
                    if (d2 & (1 << (v2-1))) {
                        if (isBlackDot && (v1 == 2*v2 || v2 == 2*v1)) supported = true;
                        if (!isBlackDot && (abs(v1 - v2) == 1)) supported = true;
                    }
                }
                if (supported) new_d1 |= (1 << (v1-1));
            }
        }
        for(int v2 = 1; v2 <= GRID_SIZE; ++v2) {
            if (d2 & (1 << (v2-1))) {
                bool supported = false;
                for(int v1 = 1; v1 <= GRID_SIZE; ++v1) {
                    if (d1 & (1 << (v1-1))) {
                        if (isBlackDot && (v1 == 2*v2 || v2 == 2*v1)) supported = true;
                        if (!isBlackDot && (abs(v1 - v2) == 1)) supported = true;
                    }
                }
                if (supported) new_d2 |= (1 << (v2-1));
            }
        }
        if (d1 != new_d1) { dom[p1.r][p1.c] = new_d1; changed = true; if (new_d1 == 0) return false; }
        if (d2 != new_d2) { dom[p2.r][p2.c] = new_d2; changed = true; if (new_d2 == 0) return false; }
        return true;
    }
};

// ==========================================
// CSP SUDOKU SOLVER ENGINE
// ==========================================
class SudokuSolver {
private:
    uint16_t initial_domains[9][9];
    vector<unique_ptr<Constraint>> constraints;

    bool propagate(uint16_t dom[9][9]) const {
        bool changed = true;
        while (changed) {
            changed = false;
            for (int r = 0; r < GRID_SIZE; ++r) {
                for (int c = 0; c < GRID_SIZE; ++c) {
                    if (countVals(dom[r][c]) == 1) {
                        uint16_t remove_mask = ~dom[r][c];
                        for (int i = 0; i < GRID_SIZE; ++i) {
                            if (i != c && (dom[r][i] & ~remove_mask)) { 
                                dom[r][i] &= remove_mask; changed = true;
                                if (dom[r][i] == 0) return false; 
                            }
                            if (i != r && (dom[i][c] & ~remove_mask)) { 
                                dom[i][c] &= remove_mask; changed = true;
                                if (dom[i][c] == 0) return false; 
                            }
                        }
                        int sr = r - r % BOX_R, sc = c - c % BOX_C;
                        for (int i = 0; i < BOX_R; ++i) {
                            for (int j = 0; j < BOX_C; j++) {
                                int rr = sr + i, cc = sc + j;
                                if ((rr != r || cc != c) && (dom[rr][cc] & ~remove_mask)) {
                                    dom[rr][cc] &= remove_mask; changed = true;
                                    if (dom[rr][cc] == 0) return false; 
                                }
                            }
                        }
                    }
                }
            }
            for (const auto& constraint : constraints) {
                bool c_changed = false;
                if (!constraint->reduce(dom, c_changed)) return false; 
                if (c_changed) changed = true;
            }
        }
        return true;
    }

    void solveCSP(uint16_t current_domains[9][9], vector<vector<int>>& final_grid, int& solution_count, vector<string>& all_steps) const {
        if (solution_count >= 2) return; 

        int min_size = 10;
        int best_r = -1, best_c = -1;
        
        for (int r = 0; r < GRID_SIZE; ++r) {
            for (int c = 0; c < GRID_SIZE; ++c) {
                int size = countVals(current_domains[r][c]);
                if (size > 1 && size < min_size) {
                    min_size = size;
                    best_r = r;
                    best_c = c;
                }
            }
        }
        if (best_r == -1) {
            solution_count++;
            if (solution_count == 1) {
                for(int r=0; r<GRID_SIZE; ++r) {
                    for(int c=0; c<GRID_SIZE; ++c) {
                        final_grid[r][c] = getMinVal(current_domains[r][c]);
                    }
                }
            }
            if (all_steps.size() < 2000) all_steps.push_back("Found a valid solution!");
            return;
        }
        
        uint16_t domain = current_domains[best_r][best_c];
        for (int v = 1; v <= GRID_SIZE; ++v) {
            if (domain & (1 << (v - 1))) {
                if (all_steps.size() < 2000) {
                    all_steps.push_back("Trying value " + to_string(v) + " at cell (" + to_string(best_r) + "," + to_string(best_c) + ")");
                }
                
                uint16_t next_domains[9][9];
                memcpy(next_domains, current_domains, sizeof(next_domains));
                next_domains[best_r][best_c] = (1 << (v - 1));
                
                if (propagate(next_domains)) {
                    solveCSP(next_domains, final_grid, solution_count, all_steps);
                } else {
                    if (all_steps.size() < 2000) {
                        all_steps.push_back("Contradiction found when trying " + to_string(v) + " at cell (" + to_string(best_r) + "," + to_string(best_c) + ")");
                    }
                }
                
                if (all_steps.size() < 2000 && solution_count == 0) {
                    all_steps.push_back("Backtracking from cell (" + to_string(best_r) + "," + to_string(best_c) + ")");
                }
                if (solution_count >= 2) return;
            }
        }
    }

public:
    SudokuSolver() {
        for(int r=0; r<GRID_SIZE; ++r)
            for(int c=0; c<GRID_SIZE; ++c)
                initial_domains[r][c] = ALL_DIGITS;
    }

    void setGrid(const vector<vector<int>>& grid) {
        for(int r=0; r<GRID_SIZE; ++r) {
            for(int c=0; c<GRID_SIZE; ++c) {
                if(grid[r][c] != 0) {
                    initial_domains[r][c] = (1 << (grid[r][c] - 1));
                }
            }
        }
    }

    void addConstraint(unique_ptr<Constraint> c) { constraints.push_back(move(c)); }

    int solve(vector<vector<int>>& final_grid, vector<string>& all_steps) {
        if (!propagate(initial_domains)) {
            all_steps.push_back("Contradiction found in initial constraints.");
            return 0;
        }
        int solution_count = 0;
        solveCSP(initial_domains, final_grid, solution_count, all_steps);
        // If initial constraints completely solve the board without branching:
        if (all_steps.empty() && solution_count == 0) {
            bool solved = true;
            for(int r=0; r<GRID_SIZE; ++r) {
                for(int c=0; c<GRID_SIZE; ++c) {
                    if (countVals(initial_domains[r][c]) != 1) solved = false;
                    final_grid[r][c] = getMinVal(initial_domains[r][c]);
                }
            }
            if (solved) {
                solution_count = 1;
                all_steps.push_back("Logical deductions cleared the board natively without branching.");
            }
        }
        return solution_count;
    }
};

int main() {
    ifstream fin("input.txt");
    ofstream fout("output.txt");
    if (!fin.is_open()) return 1;

    fin >> GRID_SIZE;
    if (GRID_SIZE == 9) { BOX_R = 3; BOX_C = 3; ALL_DIGITS = 0x1FF; }
    else if (GRID_SIZE == 6) { BOX_R = 2; BOX_C = 3; ALL_DIGITS = 0x3F; }
    else if (GRID_SIZE == 4) { BOX_R = 2; BOX_C = 2; ALL_DIGITS = 0x0F; }

    SudokuSolver solver;
    vector<vector<int>> startingGrid(GRID_SIZE, vector<int>(GRID_SIZE, 0));

    for (int r = 0; r < GRID_SIZE; r++) {
        for (int c = 0; c < GRID_SIZE; c++) fin >> startingGrid[r][c];
    }
    solver.setGrid(startingGrid);

    string type;
    while (fin >> type && type != "SOLVE") {
        if (type == "SQUARE") {
            int x, y; fin >> x >> y;
            solver.addConstraint(make_unique<EvenOddConstraint>(Point{x, y}, true));
        } else if (type == "CIRCLE") {
            int x, y; fin >> x >> y;
            solver.addConstraint(make_unique<EvenOddConstraint>(Point{x, y}, false));
        } else if (type == "CAGE") {
            int sum, k; fin >> sum >> k;
            vector<Point> cells(k);
            for(int i=0; i<k; ++i) fin >> cells[i].r >> cells[i].c;
            solver.addConstraint(make_unique<CageConstraint>(sum, cells));
        } else if (type == "THERMO") {
            int k; fin >> k;
            vector<Point> cells(k);
            for(int i=0; i<k; ++i) fin >> cells[i].r >> cells[i].c;
            solver.addConstraint(make_unique<ThermoConstraint>(cells));
        } else if (type == "ARROW") {
            int bulb_x, bulb_y, k; fin >> bulb_x >> bulb_y >> k;
            vector<Point> cells(k);
            for(int i=0; i<k; ++i) fin >> cells[i].r >> cells[i].c;
            solver.addConstraint(make_unique<ArrowConstraint>(Point{bulb_x, bulb_y}, cells));
        } else if (type == "WHITE") {
            int x1, y1, x2, y2; fin >> x1 >> y1 >> x2 >> y2;
            solver.addConstraint(make_unique<KropkiConstraint>(Point{x1, y1}, Point{x2, y2}, false));
        } else if (type == "BLACK") {
            int x1, y1, x2, y2; fin >> x1 >> y1 >> x2 >> y2;
            solver.addConstraint(make_unique<KropkiConstraint>(Point{x1, y1}, Point{x2, y2}, true));
        }
    }

    vector<vector<int>> final_grid(GRID_SIZE, vector<int>(GRID_SIZE, 0));
    vector<string> steps;
    
    int solutions = solver.solve(final_grid, steps);
    
    if (solutions == 1) {
        fout << "UNIQUE\n";
    } else if (solutions > 1) {
        fout << "MULTIPLE\n";
    } else {
        fout << "FAILED\n";
    }

    if (solutions >= 1) {
        for (int r = 0; r < GRID_SIZE; r++) {
            for (int c = 0; c < GRID_SIZE; c++) fout << final_grid[r][c] << " ";
            fout << "\n";
        }
    } else {
        // Output empty grid to maintain line sync structure
        for (int r = 0; r < GRID_SIZE; r++) {
            for (int c = 0; c < GRID_SIZE; c++) fout << "0 ";
            fout << "\n";
        }
    }

    fout << "STEPS\n";
    if (steps.empty()) {
        fout << "Logical deductions cleared the board natively without branching.\n";
    } else {
        for (const auto& step : steps) {
            fout << step << "\n";
        }
    }

    fin.close(); fout.close();
    return 0;
}