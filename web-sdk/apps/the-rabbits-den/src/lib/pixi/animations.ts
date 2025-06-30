import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { spritesheet, questionTexture, getSymbolTexture } from './index';

const cell_size = 50;
const grid_gap = 10;

export async function animateSpin(symbols: PIXI.Sprite[][], duration: number, finalGrid: string[][]) {
  console.log('animateSpin called.');
  const numRows = finalGrid.length;
  const numCols = finalGrid[0].length;

  const spinPromises: Promise<void>[] = [];

  for (let col = 0; col < numCols; col++) {
    for (let row = 0; row < numRows; row++) {
      const symbol = symbols[col][row];
      const finalTexture = getSymbolTexture(finalGrid[row][col]);
      console.log(`Animating symbol at col ${col}, row ${row}. Final texture:`, finalGrid[row][col]);

      // Create a timeline for each symbol
      const tl = gsap.timeline();

      // Spin animation
      tl.to(symbol, { duration: duration / 2000, y: symbol.y + 50, ease: "power1.in" })
        .to(symbol, { duration: duration / 2000, y: symbol.y, ease: "power1.out", onComplete: () => {
          symbol.texture = finalTexture; // Change texture at the peak of the bounce
        }});

      spinPromises.push(tl.then(() => {})); // Convert GSAP timeline to a promise
    }
  }

  await Promise.all(spinPromises);
  console.log('animateSpin completed all symbol animations.');
}

export async function animateCascade(symbols: PIXI.Sprite[][], gridContainer: PIXI.Container, newGrid: string[][], winningCells: [number, number][], highlightDuration: number, fadeOutDuration: number, updateDuration: number, reusableSprites: PIXI.Sprite[]) {
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
  const nextSymbols: PIXI.Sprite[][] = Array(7).fill(null).map(() => Array(numCols).fill(null));

  for (let c = 0; c < numCols; c++) {
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
                dropPromises.push(new Promise<void>(resolve => gsap.to(sprite, { y: targetY, duration: updateDuration / 1000, ease: "bounce.out", onComplete: resolve })));
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
              dropPromises.push(new Promise<void>(resolve => gsap.to(newSprite, { y: i * (cell_size + grid_gap), duration: updateDuration / 1000, ease: "bounce.out", onComplete: resolve })));
    }
  }
  await Promise.all(dropPromises);

  // 4. Update the main symbols array and ensure final state
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const sprite = nextSymbols[r][c];
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
      symbols[r][c] = sprite; // Update the original symbols array
    }
  }
}