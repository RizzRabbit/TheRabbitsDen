<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as PIXI from 'pixi.js';
  import { gsap } from 'gsap';

  let app: PIXI.Application;
  let gridContainer: PIXI.Container; // Container for all grid symbols
  let symbols: PIXI.Sprite[][] = []; // 2D array to hold PIXI.Sprite objects
  let spritesheet: PIXI.Spritesheet;
  let questionTexture: PIXI.Texture;
  let reusableSprites: PIXI.Sprite[] = [];

  let grid: string[][] = Array(7).fill(null).map(() => Array(7).fill('question'));
  let message: string = $state('Welcome to The Rabbits Den!');
  let betAmount: number = $state(1);
  let winAmount: number = $state(0);
  let totalSpinWin: number = $state(0); // New variable for total win of a spin
  let showTotalWin: boolean = $state(false); // Controls visibility of total win display
  let balance: number = $state(100); // Initial balance
  let spinning: boolean = $state(false);
  let freeGamesRemaining: number = $state(0);
  let currentMultiplier: number = $state(1);

  const cell_size = 80; // Fixed size for each grid cell
  const grid_gap = 5; // Gap between cells

  // Symbols for the game (excluding multipliers from grid generation, but including them for display)
  const gameSymbols = ['l1', 'l2', 'l3', 'l4', 'h1', 'h2', 'h3', 'h4', 's', 'w', '2X', '4X', '5X', '7X', '10X'];

  async function spin() {
    if (betAmount <= 0) {
      message = 'Bet amount must be positive!';
      return;
    }

    if (balance < betAmount && freeGamesRemaining === 0) {
      message = 'Not enough balance!';
      return;
    }

    spinning = true;
    message = 'Spinning...';
    winAmount = 0;
    
    if (freeGamesRemaining === 0) {
      balance -= betAmount; // Deduct bet immediately
    }

    try {
      const response = await fetch('http://localhost:5000/spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bet_amount: betAmount,
          free_games_remaining: freeGamesRemaining,
          current_multiplier: currentMultiplier
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Backend error: ${response.status}`);
      }

      const data = await response.json();

      // Update the Svelte `grid` variable with the initial grid from the backend
      grid = data.initial_grid;

      // Start the spin animation, passing the initial grid for the final state
      await animateSpin(1000, data.initial_grid);

      const cascadeResults = data.cascade_results; // Get all cascade steps
      let currentTotalWin = 0;

      // Use the initial grid for the first cascade step
      let currentGridState = data.initial_grid;

      for (let i = 0; i < cascadeResults.length; i++) {
        const cascade = cascadeResults[i];
        
        // Animate the cascade step
        await animateCascade(cascade.grid, cascade.winning_cells, 700, 500, 500); // Highlight, fade, update durations

        currentTotalWin += cascade.win_amount; 
        winAmount = currentTotalWin; 
        message = cascade.message || `Cascade ${i + 1} complete!`;

        // Update grid state for the next iteration
        currentGridState = cascade.grid; 
      }

      // After all cascades, ensure the Svelte `grid` variable reflects the final state
      grid = currentGridState;

      balance += data.total_win_amount; // Corrected balance update
      totalSpinWin = data.total_win_amount; // Set total spin win
      showTotalWin = totalSpinWin > 0; // Only show if there's a win
      if (showTotalWin) {
        setTimeout(() => showTotalWin = false, 3000); // Hide after 3 seconds
      }
      message = data.message; // Final message from backend
      freeGamesRemaining = data.free_games_remaining;
      currentMultiplier = data.current_multiplier;

      // TODO: Integrate with Stake-Engine for actual betting and result verification

    } catch (error) {
      console.error('Error during spin:', error);
      message = `Error during spin: ${error.message || 'Please try again.'}`;
      // If balance was deducted, and spin failed, consider refunding or handling appropriately
      // For now, we'll leave it deducted as per original logic, but this is a point for review.
    } finally {
      spinning = false;
      if (freeGamesRemaining > 0) {
        // Automatically spin during free games
        setTimeout(spin, 1000); // Spin again after 1 second
      }
    }
  }

  async function animateSpin(duration: number, finalGrid: string[][]) {
    const animationEndTime = Date.now() + duration;
    const availableSymbols = Object.keys(spritesheet.textures);
    let lastUpdateTime = 0;
    const updateInterval = 50; // Update textures every 50ms

    function update(currentTime: number) {
      if (Date.now() < animationEndTime) {
        if (currentTime - lastUpdateTime > updateInterval) {
          lastUpdateTime = currentTime;
          for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
              const randomSymbol = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
              symbols[r][c].texture = spritesheet.textures[randomSymbol];
            }
          }
        }
        requestAnimationFrame(update);
      } else {
        // Animation finished, set final textures
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 7; c++) {
            const sprite = symbols[r][c];
            if (!sprite) {
              console.error(`Error: Sprite at [${r}, ${c}] is null or undefined in animateSpin finalization.`);
              continue; // Skip this iteration if sprite is null
            }
            const symbolType = finalGrid[r][c];
            if (symbolType === 'question') {
              sprite.texture = questionTexture;
            } else {
              sprite.texture = spritesheet.textures[symbolType + '.png'];
            }
            sprite.alpha = 1; // Ensure visibility
            sprite.tint = 0xFFFFFF; // Reset tint
            let textureWidth, textureHeight;
            if (sprite.texture === questionTexture) {
              textureWidth = questionTexture.width;
              textureHeight = questionTexture.height;
            } else {
              textureWidth = sprite.texture.orig.width;
              textureHeight = sprite.texture.orig.height;
            }
            const scaleX = cell_size / textureWidth;
            const scaleY = cell_size / textureHeight;
            sprite.scale.set(scaleX, scaleY);
          }
        }
      }
    }

    requestAnimationFrame(update);
    await new Promise(resolve => setTimeout(resolve, duration));
  }

    async function animateCascade(newGrid: string[][], winningCells: [number, number][], highlightDuration: number, fadeOutDuration: number, updateDuration: number) {
    const getSymbolTexture = (symbolType: string) => {
      if (symbolType === 'question') {
        return questionTexture;
      } else {
        const texture = spritesheet.textures[symbolType + '.png'];
        if (!texture) {
          console.error(`Texture for symbolType '${symbolType}' not found in spritesheet.textures. Falling back to questionTexture.`);
          return questionTexture; // Fallback to questionTexture
        }
        return texture;
      }
    };

    // 1. Highlight winning symbols and scale them up slightly
    const highlightPromises = winningCells.map(([r, c]) => {
      const sprite = symbols[r][c];
      if (!sprite) {
        console.error(`Error: Sprite at [${r}, ${c}] is null or undefined during highlight.`);
        return Promise.resolve(); // Skip this sprite
      }
      sprite.tint = 0x4CAF50; // Green tint
      return gsap.to(sprite.scale, { x: 1.1, y: 1.1, duration: highlightDuration / 1000, ease: "power2.out" });
    });
    await Promise.all(highlightPromises);

    // 2. Fade out winning symbols
    const fadeOutPromises = winningCells.map(([r, c]) => {
      const sprite = symbols[r][c];
      if (!sprite) {
        console.error(`Error: Sprite at [${r}, ${c}] is null or undefined during fade out.`);
        return Promise.resolve(); // Skip this sprite
      }
      return gsap.to(sprite, { alpha: 0, duration: fadeOutDuration / 1000, ease: "power2.in" });
    });
    await Promise.all(fadeOutPromises);

    // Hide winning symbols and add them to a reusable pool
    for (const [r, c] of winningCells) {
      const sprite = symbols[r][c];
      if (sprite) {
        sprite.visible = false;
        sprite.alpha = 1; // Reset alpha for next use
        sprite.tint = 0xFFFFFF; // Reset tint
        reusableSprites.push(sprite);
      }
    }

    // 3. Animate symbols dropping and new symbols appearing
    const dropPromises: Promise<void>[] = [];
    const nextSymbols: PIXI.Sprite[][] = Array(7).fill(null).map(() => Array(7).fill(null));

    for (let c = 0; c < 7; c++) {
      let emptySlots = 0;
      // Drop existing symbols down
      for (let r = 6; r >= 0; r--) {
        if (winningCells.some(cell => cell[0] === r && cell[1] === c)) {
          emptySlots++;
        } else if (emptySlots > 0) {
          const sprite = symbols[r][c];
          if (!sprite) {
            console.error(`Error: Sprite at [${r}, ${c}] is null or undefined during drop animation.`);
            continue; // Skip this iteration if sprite is null
          }
          const targetY = (r + emptySlots) * (cell_size + grid_gap);
          nextSymbols[r + emptySlots][c] = sprite;
          dropPromises.push(gsap.to(sprite, { y: targetY, duration: updateDuration / 1000, ease: "bounce.out" }).then());
        } else {
          nextSymbols[r][c] = symbols[r][c];
        }
      }

      // Add new symbols at the top
      for (let i = 0; i < emptySlots; i++) {
        const symbolType = newGrid[i][c];
        let newSprite: PIXI.Sprite;

        if (reusableSprites.length > 0) {
          newSprite = reusableSprites.pop()!; // Reuse existing sprite
          newSprite.visible = true;
          newSprite.texture = getSymbolTexture(symbolType);
          newSprite.alpha = 1;
          newSprite.tint = 0xFFFFFF;
        } else {
          newSprite = new PIXI.Sprite(getSymbolTexture(symbolType));
          gridContainer.addChild(newSprite);
        }

        const newTexture = getSymbolTexture(symbolType);
        let textureWidth, textureHeight;
        if (newTexture === questionTexture) {
          textureWidth = questionTexture.width;
          textureHeight = questionTexture.height;
        } else {
          textureWidth = newTexture.orig.width;
          textureHeight = newTexture.orig.height;
        }
        const scaleX = cell_size / textureWidth;
        const scaleY = cell_size / textureHeight;
        newSprite.scale.set(scaleX, scaleY);
        newSprite.x = c * (cell_size + grid_gap);
        newSprite.y = -((emptySlots - i) * (cell_size + grid_gap)); // Start above the grid
        nextSymbols[i][c] = newSprite;
        dropPromises.push(gsap.to(newSprite, { y: i * (cell_size + grid_gap), duration: updateDuration / 1000, ease: "bounce.out" }).then());
      }
    }
    await Promise.all(dropPromises);

    // 4. Update the main symbols array and ensure final state
    symbols = nextSymbols;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const sprite = symbols[r][c];
        if (!sprite) {
          console.error(`Error: Sprite at [${r}, ${c}] is null or undefined in animateCascade finalization.`);
          continue; // Skip this iteration if sprite is null
        }
        // Update the texture based on the new grid state
        sprite.texture = getSymbolTexture(newGrid[r][c]);

        let textureWidth, textureHeight;
        if (sprite.texture === questionTexture) {
          textureWidth = questionTexture.width;
          textureHeight = questionTexture.height;
        } else {
          textureWidth = sprite.texture.orig.width;
          textureHeight = sprite.texture.orig.height;
        }
        const scaleX = cell_size / textureWidth;
        const scaleY = cell_size / textureHeight;
        sprite.alpha = 1;
        sprite.tint = 0xFFFFFF;
        sprite.scale.set(scaleX, scaleY);
        sprite.visible = true; // Ensure visibility
        sprite.x = c * (cell_size + grid_gap); // Ensure correct final position
        sprite.y = r * (cell_size + grid_gap); // Ensure correct final position
      }
    }
  }

  onMount(async () => {
    try {
      // Initialize PixiJS Application
      app = new PIXI.Application();
      await app.init({
        width: (cell_size + grid_gap) * 7 - grid_gap, // Calculate total grid width
        height: (cell_size + grid_gap) * 7 - grid_gap, // Calculate total grid height
        transparent: true, // Make background transparent
        antialias: true,
      });

      const pixiContainer = document.getElementById('pixi-container');
      if (pixiContainer) {
        pixiContainer.appendChild(app.canvas as HTMLCanvasElement);
        console.log('PixiJS canvas appended successfully.');
      } else {
        console.error('Could not find pixi-container.');
      }

      // Load assets
      const backgroundTexture = await PIXI.Assets.load('/background.png');
      spritesheet = await PIXI.Assets.load({ src: '/brspritesheet.json', data: { premultipliedAlpha: false } });
      questionTexture = await PIXI.Assets.load({ src: '/question.png', data: { premultipliedAlpha: false } });

      

      gridContainer = new PIXI.Container();
      app.stage.addChild(gridContainer);

      // Create initial sprites
      for (let r = 0; r < 7; r++) {
        symbols[r] = [];
        for (let c = 0; c < 7; c++) {
          const symbolType = grid[r][c];
          let texture;
          if (symbolType === 'question') {
            texture = questionTexture;
          } else {
            texture = spritesheet.textures[symbolType + '.png'];
          }
          
          const sprite = new PIXI.Sprite(texture);
          let textureWidth, textureHeight;
          if (texture === questionTexture) {
            textureWidth = questionTexture.width;
            textureHeight = questionTexture.height;
          } else {
            textureWidth = texture.orig.width;
            textureHeight = texture.orig.height;
          }
          const scaleX = cell_size / textureWidth;
          const scaleY = cell_size / textureHeight;
          sprite.scale.set(scaleX, scaleY);
          sprite.x = c * (cell_size + grid_gap);
          sprite.y = r * (cell_size + grid_gap);
          gridContainer.addChild(sprite);
          symbols[r][c] = sprite;
        }
      }

      

    } catch (error) {
      console.error('Error loading PixiJS assets or initializing PixiJS:', error);
    }
  });

  onDestroy(() => {
    app?.destroy(true);
  });
</script>

<style>
  .slot-machine {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Arial', sans-serif;
    background-color: #282c34;
    color: #fff;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
    width: 100%;
    max-width: 700px; /* Adjusted max-width for 7x7 grid */
    background-image: url('/background.png'); /* Path to background image in public folder */
    background-size: cover;
    background-position: center;
  }

  .header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .balance {
    font-size: 1.5em;
    font-weight: bold;
    color: #f0d94a;
  }

  .free-games-info {
    font-size: 1.2em;
    color: #61dafb;
    margin-top: 10px;
  }

  /* Remove grid-container and grid-cell CSS as PixiJS handles rendering */
  #pixi-container {
    border: 5px solid #f0d94a; /* Gold border for grid */
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 20px;
    background-color: transparent; /* Make the container background transparent */
  }

  .controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    align-items: center;
  }

  button {
    background-color: #61dafb;
    color: #282c34;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 1.1em;
    transition: background-color 0.3s ease;
  }

  button:hover:not(:disabled) {
    background-color: #21a1f1;
  }

  button:disabled {
    background-color: #555;
    cursor: not-allowed;
  }

  input[type="number"] {
    padding: 8px;
    border-radius: 5px;
    border: 1px solid #61dafb;
    background-color: #3a3f47;
    color: #fff;
    width: 80px;
    text-align: center;
  }

  .message {
    font-size: 1.2em;
    margin-bottom: 10px;
    color: #a0a0a0;
  }

  .win-message {
    color: #4CAF50; /* Green for win */
    font-weight: bold;
  }

  .total-win-display {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 4em;
    font-weight: bold;
    color: #f0d94a;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    animation: total-win-animation 3s forwards;
  }

  @keyframes total-win-animation {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.2);
    }
    80% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.2);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.5);
    }
  }
</style>

<div class="slot-machine">
  <div class="header">
    <h1>The Rabbits Den</h1>
    <div class="balance">Balance: ${balance}</div>
  </div>

  {#if freeGamesRemaining > 0}
    <div class="free-games-info">
      Free Games: {freeGamesRemaining} | Multiplier: {currentMultiplier}x
    </div>
  {/if}

  <div id="pixi-container"></div>

  <div class="message">
    {message}
    {#if winAmount > 0}
      <span class="win-message"> You won ${winAmount}!</span>
    {/if}
  </div>

  {#if showTotalWin}
    <div class="total-win-display">+${totalSpinWin}</div>
  {/if}

  <div class="controls">
    <label for="bet">Bet Amount:</label>
    <input type="number" id="bet" bind:value={betAmount} min="1" disabled={spinning || freeGamesRemaining > 0} />
    <button onclick={spin} disabled={spinning}>Spin</button>
  </div>
</div>