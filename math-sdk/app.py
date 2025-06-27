from flask import Flask, jsonify, request
from flask_cors import CORS
import random

app = Flask(__name__)
CORS(app)

def find_clusters(grid):
    rows = len(grid)
    cols = len(grid[0])
    visited = [[False for _ in range(cols)] for _ in range(rows)]
    clusters = []

    # Define all symbols, including multipliers, for reference
    all_symbols = ['l1', 'l2', 'l3', 'l4', 'h1', 'h2', 'h3', 'h4', 's', 'w', '2X', '4X', '5X', '7X', '10X']
    multiplier_symbols = ['2X', '4X', '5X', '7X', '10X']

    def dfs(r, c, symbol_to_match, current_cluster):
        if r < 0 or r >= rows or c < 0 or c >= cols or visited[r][c]:
            return

        current_symbol = grid[r][c]

        # If the current symbol is a multiplier, it cannot be part of a cluster formed by other symbols
        # and it cannot form a cluster itself (handled by initial loop)
        if current_symbol in multiplier_symbols:
            return

        # Wild symbol 'w' matches any symbol except 's' (scatter) and multipliers
        if current_symbol == 'w':
            if symbol_to_match == 's': # Wild does not substitute for scatter
                return
            # Wild can substitute for any non-multiplier, non-scatter symbol
            # If symbol_to_match is a regular symbol, wild can join.
            # If symbol_to_match is 'w', then it's a cluster of wilds.
            pass # Allow wild to join
        elif current_symbol != symbol_to_match:
            return

        visited[r][c] = True
        current_cluster.append((r, c))

        dfs(r + 1, c, symbol_to_match, current_cluster)
        dfs(r - 1, c, symbol_to_match, current_cluster)
        dfs(r, c + 1, symbol_to_match, current_cluster)
        dfs(r, c - 1, symbol_to_match, current_cluster)

    for r in range(rows):
        for c in range(cols):
            if not visited[r][c]:
                symbol = grid[r][c]
                # Skip scatters and multipliers for initial cluster search
                if symbol == 's' or symbol in multiplier_symbols:
                    continue
                
                current_cluster = []
                dfs(r, c, symbol, current_cluster)
                if len(current_cluster) >= 5: # Cluster size of 5 or more
                    clusters.append(current_cluster)

    # Also find clusters of only wild symbols
    visited = [[False for _ in range(cols)] for _ in range(rows)] # Reset visited for wild clusters
    for r in range(rows):
        for c in range(cols):
            if not visited[r][c] and grid[r][c] == 'w':
                current_cluster = []
                dfs(r, c, 'w', current_cluster)
                if len(current_cluster) >= 5:
                    clusters.append(current_cluster)

    return clusters

def apply_cascade(grid, winning_cells, symbols_for_grid):
    rows = len(grid)
    cols = len(grid[0])

    # 1. Mark winning cells as empty (e.g., None or a special placeholder)
    for r, c in winning_cells:
        grid[r][c] = None

    # 2. Drop symbols down and fill new symbols at the top
    new_grid = [[None for _ in range(cols)] for _ in range(rows)]
    for c in range(cols):
        current_row_in_col = rows - 1
        for r in range(rows - 1, -1, -1):
            if grid[r][c] is not None:
                new_grid[current_row_in_col][c] = grid[r][c]
                current_row_in_col -= 1
        # Fill remaining (empty) cells at the top with new random symbols
        for r in range(current_row_in_col, -1, -1):
            new_grid[r][c] = random.choice(symbols_for_grid)
    
    return new_grid

@app.route('/spin', methods=['POST'])
def spin():
    data = request.get_json()
    bet_amount = data.get('bet_amount', 0)
    free_games_remaining = data.get('free_games_remaining', 0)
    current_multiplier = data.get('current_multiplier', 1)

    # Decrement free games remaining if this is a free game spin
    if free_games_remaining > 0:
        free_games_remaining -= 1

    # Symbols for the 7x7 cluster game, INCLUDING multipliers now
    symbols_for_grid = ['l1', 'l2', 'l3', 'l4', 'h1', 'h2', 'h3', 'h4', 's', 'w', '2X', '4X', '5X', '7X', '10X']
    multiplier_symbols = ['2X', '4X', '5X', '7X', '10X']

    grid = []
    for _ in range(7):
        row = [random.choice(symbols_for_grid) for _ in range(7)]
        grid.append(row)
    
    total_win_amount = 0
    all_winning_cells = []
    cascade_results = []

    # Count scatters on the initial grid
    scatters_found = 0
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] == 's': # Using 's' for scatter
                scatters_found += 1

    current_grid = grid
    cascade_count = 0

    while True:
        clusters = find_clusters(current_grid)
        if not clusters:
            break # No more clusters, stop cascading

        cascade_count += 1
        current_cascade_win = 0
        current_winning_cells = []
        
        # Collect all winning cells for this cascade first
        for cluster in clusters:
            current_winning_cells.extend(cluster)

        # Calculate win for this cascade, considering multipliers within the winning cells
        for cluster in clusters:
            cluster_base_win = len(cluster) * bet_amount
            cluster_multiplier_sum = 0
            has_multiplier_in_cluster = False

            for r, c in cluster:
                symbol = current_grid[r][c]
                if symbol in multiplier_symbols:
                    has_multiplier_in_cluster = True
                    # Extract multiplier value (e.g., '2X' -> 2)
                    multiplier_value = int(symbol.replace('X', ''))
                    cluster_multiplier_sum += multiplier_value

            if has_multiplier_in_cluster:
                current_cascade_win += cluster_base_win * cluster_multiplier_sum
            else:
                current_cascade_win += cluster_base_win

        total_win_amount += current_cascade_win

        # Apply cascade and get the new grid
        next_grid_state = apply_cascade(current_grid, current_winning_cells, symbols_for_grid)

        cascade_results.append({
            "grid": next_grid_state, # This is the grid *after* the cascade
            "winning_cells": current_winning_cells,
            "win_amount": current_cascade_win
        })

        current_grid = next_grid_state # Update current_grid for the next iteration
    
    # Apply overall free games multiplier at the end
    total_win_amount *= current_multiplier

    # Check for free games trigger
    if scatters_found >= 3: # Example: 3 or more scatters trigger free games
        free_games_gained = 10 # Example: 10 free games
        free_games_remaining += free_games_gained
        current_multiplier += 1 # Example: Multiplier increases by 1
        message = f"Spin complete! You won {free_games_gained} free games! Multiplier is now {current_multiplier}x"
    else:
        message = f"Spin complete! Total cascades: {cascade_count}"

    return jsonify({
        "initial_grid": grid, # The very first grid generated
        "final_grid": current_grid, # The grid after all cascades
        "total_win_amount": total_win_amount,
        "message": message,
        "cascade_results": cascade_results, # Sequence of grid states and wins
        "free_games_remaining": free_games_remaining,
        "current_multiplier": current_multiplier
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)