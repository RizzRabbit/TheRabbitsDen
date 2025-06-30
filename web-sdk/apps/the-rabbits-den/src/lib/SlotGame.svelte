<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import * as PIXI from 'pixi.js';
  import { initPixi, getSymbolTexture, app, spritesheet } from './pixi';
  import { animateSpin, animateCascade } from './pixi/animations';
  import { grid, message, betAmount, winAmount, totalSpinWin, showTotalWin, balance, spinning, freeGamesRemaining, currentMultiplier, spin as performSpin, initializeGame, minBet, maxBet, stepBet, betLevels, gameInitialized } from './game-logic';

  let gridContainer: PIXI.Container;
  let symbols: PIXI.Sprite[][] = [];
  let reusableSprites: PIXI.Sprite[] = [];

  const cell_size = 50; // Assuming a base size for each cell
  const grid_gap = 10;

  

  onMount(async () => {
    try {
      await initPixi('pixi-container', '/background.png', '/therabbitsden.json', '/l1.png');

      gridContainer = new PIXI.Container();
      app.stage.addChild(gridContainer);
      console.log('gridContainer added to stage. Stage children count:', app.stage.children.length);

      // Add background
      const background = PIXI.Sprite.from('/background.png');
      background.width = app.screen.width;
      background.height = app.screen.height;
      app.stage.addChildAt(background, 0); // Add background at the bottom layer

      
      await initializeGame(); // Initialize game with RGS authentication

      // Initial drawing of the grid
      drawGrid(get(grid));
    } catch (error) {
      console.error('Error loading PixiJS assets or initializing PixiJS:', error);
    }
  });

  onDestroy(() => {
    app?.destroy(true);
  });

  async function handleSpin() {
    console.log('Spin button clicked. Calling performSpin...');
    await performSpin(symbols, gridContainer, reusableSprites);
  }

  function drawGrid(currentGrid: string[][]) {
    // Clear existing symbols if any
    symbols.forEach(row => {
      row.forEach(symbol => {
        if (symbol) {
          gridContainer.removeChild(symbol);
          symbol.destroy();
        }
      });
    });
    symbols = []; // Reset symbols array

    for (let col = 0; col < currentGrid[0].length; col++) {
      symbols[col] = [];
      for (let row = 0; row < currentGrid.length; row++) {
        const symbolType = currentGrid[row][col];
        console.log(`Drawing symbol: row=${row}, col=${col}, type=${symbolType}`);
        const texture = getSymbolTexture(symbolType);
        if (!texture) {
          console.error(`Texture is null or undefined for symbolType: ${symbolType}`);
          continue; // Skip this symbol if texture is invalid
        }
        const symbol = new PIXI.Sprite(texture);

        symbol.width = cell_size;
        symbol.height = cell_size;
        symbol.x = col * (cell_size + grid_gap);
        symbol.y = row * (cell_size + grid_gap);

        console.log(`Symbol position and size: x=${symbol.x}, y=${symbol.y}, width=${symbol.width}, height=${symbol.height}`);

        gridContainer.addChild(symbol);
        symbols[col][row] = symbol;
      }
    }

    // Center the grid container
    const gridWidth = currentGrid[0].length * (cell_size + grid_gap) - grid_gap;
    const gridHeight = currentGrid.length * (cell_size + grid_gap) - grid_gap;
    gridContainer.x = (app.screen.width - gridWidth) / 2;
    gridContainer.y = (app.screen.height - gridHeight) / 2;

    console.log('Grid drawn with symbols.');
  }

  // Subscribe to grid changes to redraw
  grid.subscribe(currentGrid => {
    if (app && gridContainer) {
      drawGrid(currentGrid);
    }
  });

</script>

<div class="slot-machine-container">
  <div class="game-header">
    <h1 class="game-title">The Rabbits Den</h1>
    <div class="balance-info">Balance: ${$balance.toFixed(2)}</div>
  </div>

  {#if $freeGamesRemaining > 0}
    <div class="free-games-banner">
      Free Games: {$freeGamesRemaining} | Multiplier: {$currentMultiplier}x
    </div>
  {/if}

  <div class="game-area">
    <div id="pixi-container" class="pixi-canvas-container"></div>
  </div>

  <div class="game-messages">
    <span class="main-message">{$message}</span>
    {#if $winAmount > 0}
      <span class="win-display">You won ${$winAmount.toFixed(2)}!</span>
    {/if}
  </div>

  {#if $showTotalWin}
    <div class="total-win-overlay">+{$totalSpinWin.toFixed(2)}</div>
  {/if}

  <div class="game-controls">
    <div class="bet-input-group">
      <label for="bet" class="control-label">Bet Amount:</label>
      <input type="number" id="bet" bind:value={$betAmount} min={$minBet} max={$maxBet} step={$stepBet} disabled={$spinning || $freeGamesRemaining > 0} class="control-input" />
      {#if $betLevels.length > 0}
        <div class="bet-levels">
          {#each $betLevels as level}
            <button on:click={() => $betAmount = level} class="bet-level-button">${level.toFixed(2)}</button>
          {/each}
        </div>
      {/if}
    </div>
    <button on:click={handleSpin} disabled={$spinning || !$gameInitialized} class="spin-button">Spin</button>
  </div>
</div>

<style>
  .slot-machine-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    background-color: #2c2c2c; /* Darker background for the container */
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-dark);
    padding: var(--spacing-xl); /* More padding */
    max-width: 95%; /* Slightly wider */
    margin: var(--spacing-xl) auto;
    color: var(--text-color);
    font-family: var(--font-family-secondary); /* Use secondary font for general text */
    border: 2px solid var(--primary-color); /* A subtle border */
  }

  .game-header {
    width: 100%;
    display: flex;
    flex-direction: column; /* Stack title and balance */
    justify-content: center;
    align-items: center;
    margin-bottom: var(--spacing-large);
    padding-bottom: var(--spacing-medium);
    border-bottom: 2px solid var(--accent-color); /* Stronger separator */
  }

  .game-title {
    color: var(--accent-color); /* Title in accent color */
    margin: 0 0 var(--spacing-small) 0; /* Space below title */
    font-family: var(--font-family-primary); /* Primary font for title */
    font-size: var(--font-size-xxl); /* Larger title */
    text-transform: uppercase;
    letter-spacing: 2px;
    text-shadow: 0 0 10px rgba(231, 76, 60, 0.5); /* Glow effect */
  }

  .balance-info {
    font-size: var(--font-size-xl); /* Larger balance info */
    color: var(--secondary-color);
    font-weight: bold;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
  }

  .free-games-banner {
    background-color: var(--accent-color); /* Accent color for banner */
    color: #ffffff; /* White text on accent */
    padding: var(--spacing-medium);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-large);
    font-weight: bold;
    text-align: center;
    width: 100%;
    text-transform: uppercase;
    letter-spacing: 1px;
    box-shadow: var(--shadow-medium);
  }

  .game-area {
    margin-bottom: var(--spacing-large);
    border: 3px solid var(--primary-color); /* Thicker border for game area */
    border-radius: var(--border-radius);
    overflow: hidden;
    box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.7); /* Inner shadow for depth */
    min-width: 410px; /* Ensure enough space for the 7x7 grid */
    min-height: 480px; /* Ensure enough space for the 7x7 grid */
    /* background-color: #333; /* Temporary: to visualize the game area */
  }

  .pixi-canvas-container {
    /* PIXI canvas will take care of its own sizing */
    width: 100%;
    height: 100%;
  }

  .game-messages {
    min-height: 2.5em; /* More space for messages */
    text-align: center;
    margin-bottom: var(--spacing-large);
    font-size: var(--font-size-large);
    font-weight: bold;
    text-transform: uppercase;
  }

  .main-message {
    color: var(--text-color);
  }

  .win-display {
    color: var(--accent-color); /* Accent color for win display */
    font-weight: bold;
    margin-left: var(--spacing-small);
    text-shadow: 0 0 8px rgba(231, 76, 60, 0.7);
  }

  .total-win-overlay {
    font-size: var(--font-size-xxl);
    color: var(--accent-color);
    font-weight: bold;
    margin-bottom: var(--spacing-medium);
    animation: fadeOutUp 2s forwards;
    text-shadow: 0 0 15px rgba(231, 76, 60, 0.9); /* Stronger glow */
  }

  @keyframes fadeOutUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-50px); /* Move further up */
    }
  }

  .game-controls {
    display: flex;
    gap: var(--spacing-large); /* More space between controls */
    align-items: center;
    width: 100%;
    justify-content: center;
    padding-top: var(--spacing-medium);
    border-top: 1px solid var(--border-color);
  }

  .bet-input-group {
    display: flex;
    flex-direction: column; /* Stack label and input */
    align-items: center;
    gap: var(--spacing-small);
  }

  .control-label {
    font-size: var(--font-size-medium);
    color: var(--secondary-color); /* Lighter color for labels */
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .control-input {
    width: 100px; /* Wider input */
    padding: var(--spacing-small);
    border-radius: var(--border-radius);
    border: 2px solid var(--primary-color); /* Stronger border */
    background-color: #1a1a1a; /* Dark background */
    color: var(--text-color);
    font-size: var(--font-size-large); /* Larger text in input */
    text-align: center;
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.5);
  }

  .control-input:focus {
    outline: none;
    border-color: var(--accent-color); /* Accent on focus */
    box-shadow: inset 0 0 5px rgba(231, 76, 60, 0.5), 0 0 10px rgba(231, 76, 60, 0.3);
  }

  .spin-button {
    padding: var(--spacing-medium) var(--spacing-xl); /* Larger button */
    font-size: var(--font-size-xl); /* Larger font */
    background-color: var(--accent-color); /* Accent color for spin button */
    color: #ffffff;
    border: 2px solid var(--danger-color); /* Red border for intensity */
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    text-transform: uppercase;
    font-family: var(--font-family-primary); /* Primary font for button */
    letter-spacing: 1px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5); /* Lifted shadow */
  }

  .spin-button:hover:not(:disabled) {
    background-color: var(--danger-color); /* Darker red on hover */
    transform: translateY(-2px); /* Slight lift */
    box-shadow: 0 7px 20px rgba(0, 0, 0, 0.7);
  }

  .spin-button:disabled {
    background-color: #555;
    border-color: #333;
    color: #aaa;
    cursor: not-allowed;
    box-shadow: none;
  }

  .bet-levels {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 10px;
    justify-content: center;
  }

  .bet-level-button {
    padding: 8px 12px;
    background-color: #444;
    color: white;
    border: 1px solid #666;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.2s;
  }

  .bet-level-button:hover {
    background-color: #666;
  }
</style>