import * as PIXI from 'pixi.js';

export let app: PIXI.Application;
export let spritesheet: PIXI.Spritesheet;
export let questionTexture: PIXI.Texture;

const cell_size = 50;
const grid_gap = 10;

export async function initPixi(containerId: string, backgroundUrl: string, spritesheetUrl: string, questionTextureUrl: string) {
  app = new PIXI.Application();
  await app.init({
    width: (cell_size + grid_gap) * 9 - grid_gap,
    height: 480,
    
    antialias: true,
  });
  console.log('PixiJS app initialized with dimensions:', app.canvas.width, 'x', app.canvas.height);

  const pixiContainer = document.getElementById(containerId);
  if (pixiContainer) {
    pixiContainer.appendChild(app.canvas as HTMLCanvasElement);
    console.log('PixiJS canvas appended successfully to:', containerId);
    console.log('PixiJS canvas element:', app.canvas);
  } else {
    console.error('Could not find pixi-container with ID:', containerId);
  }

  // Load assets
  try {
    await PIXI.Assets.load(backgroundUrl);
    console.log('Background asset loaded:', backgroundUrl);
  } catch (e) {
    console.error('Failed to load background asset:', backgroundUrl, e);
  }

  try {
    spritesheet = await PIXI.Assets.load({ src: spritesheetUrl, data: { premultipliedAlpha: false } });
    console.log('Spritesheet asset loaded:', spritesheetUrl);
  } catch (e) {
    console.error('Failed to load spritesheet asset:', spritesheetUrl, e);
  }

  try {
    questionTexture = await PIXI.Assets.load({ src: questionTextureUrl, data: { premultipliedAlpha: false } });
    console.log('Question texture asset loaded:', questionTextureUrl);
  } catch (e) {
    console.error('Failed to load question texture asset:', questionTextureUrl, e);
  }

  // Check if anything is on stage after initialization
  if (app.stage.children.length > 0) {
    console.log('Pixi stage has children after init:', app.stage.children.length);
  } else {
    console.log('Pixi stage is empty after init.');
  }
}

export function getSymbolTexture(symbolType: string): PIXI.Texture {
  console.log('Attempting to get texture for symbolType:', symbolType);
  if (symbolType === 'question') {
    console.log('Returning questionTexture.');
    return questionTexture;
  } else {
    const texture = spritesheet.textures[symbolType + '.png'];
    if (!texture) {
      console.error(`Texture for symbolType '${symbolType}' not found in spritesheet.textures. Falling back to questionTexture.`);
      return questionTexture; // Fallback to questionTexture
    }
    console.log('Returning texture from spritesheet for:', symbolType + '.png');
    return texture;
  }
}