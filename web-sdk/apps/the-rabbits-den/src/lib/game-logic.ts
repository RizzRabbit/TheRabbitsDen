import { writable, get } from 'svelte/store';
import type * as PIXI from 'pixi.js';
import { animateSpin, animateCascade } from './pixi/animations';
import { authenticate, getBalance, play, endRound, sendEvent, toStakeEngineAmount, fromStakeEngineAmount, getUrlParams } from './rgsApi';

// Game state
export const grid = writable<string[][]>(Array(7).fill(null).map(() => Array(7).fill('l1')));
export const message = writable<string>('Welcome to The Rabbits Den!');
export const betAmount = writable<number>(1);
export const winAmount = writable<number>(0);
export const totalSpinWin = writable<number>(0);
export const showTotalWin = writable<boolean>(false);
export const balance = writable<number>(0); // Initialize balance to 0
export const spinning = writable<boolean>(false);
export const freeGamesRemaining = writable<number>(0);
export const currentMultiplier = writable<number>(1);
export const gameInitialized = writable<boolean>(false); // New store for game initialization status

// RGS Configuration
export const sessionID = writable<string | null>(null);
export const minBet = writable<number>(0);
export const maxBet = writable<number>(0);
export const stepBet = writable<number>(0);
export const betLevels = writable<number[]>([]);

export async function initializeGame() {
  const params = getUrlParams();
  const sID = params.sessionID;
  if (sID) {
    sessionID.set(sID);
    message.set('Authenticating...');
    try {
      const authResponse = await authenticate(sID);
      if (authResponse.balance && authResponse.config) {
        balance.set(fromStakeEngineAmount(authResponse.balance.amount));
        minBet.set(fromStakeEngineAmount(authResponse.config.minBet));
        maxBet.set(fromStakeEngineAmount(authResponse.config.maxBet));
        stepBet.set(fromStakeEngineAmount(authResponse.config.stepBet));
        betLevels.set(authResponse.config.betLevels.map(fromStakeEngineAmount));
        message.set('Authentication successful!');
        console.log('Authentication successful. Balance:', authResponse.balance.amount, 'Config:', authResponse.config);
        gameInitialized.set(true); // Set to true on successful authentication
        console.log('Session ID after authentication:', sID);
        // Set initial bet amount to defaultBetLevel if available, otherwise minBet
        if (authResponse.config.defaultBetLevel) {
          betAmount.set(fromStakeEngineAmount(authResponse.config.defaultBetLevel));
        } else {
          betAmount.set(fromStakeEngineAmount(authResponse.config.minBet));
        }
      } else if (authResponse.error) {
        message.set(`Authentication failed: ${authResponse.error.message}`);
        console.error('Authentication failed:', authResponse.error.message);
      }
    } catch (error) {
      console.error('Error during authentication:', error);
      message.set('Failed to connect to Stake Engine.');
    }
  } else {
    message.set('No sessionID found in URL. Cannot authenticate.');
    console.warn('No sessionID found in URL.');
  }
  console.log('initializeGame completed. Game Initialized:', get(gameInitialized));
}

export async function spin(symbols: PIXI.Sprite[][], gridContainer: PIXI.Container, reusableSprites: PIXI.Sprite[]) {
  console.log('Spin function called.');
  const currentSessionID = get(sessionID);
  const currentBetAmount = get(betAmount);
  console.log('Current Session ID:', currentSessionID);
  console.log('Current Bet Amount:', currentBetAmount);
  if (!currentSessionID) {
    message.set('No active session. Please refresh with a sessionID.');
    console.warn('Spin aborted: No sessionID.');
    return;
  }
  const currentBalance = get(balance);
  const currentFreeGames = get(freeGamesRemaining);
  const currentMultiplierValue = get(currentMultiplier);
  const currentMinBet = get(minBet);
  const currentMaxBet = get(maxBet);
  const currentStepBet = get(stepBet);

  console.log('Validation values:', {
    currentBetAmount: currentBetAmount,
    currentMinBet: currentMinBet,
    currentMaxBet: currentMaxBet,
    currentStepBet: currentStepBet,
    currentBalance: currentBalance,
    currentFreeGames: currentFreeGames
  });

  if (currentBetAmount <= 0) {
    message.set('Bet amount must be positive!');
    return;
  }

  if (currentBetAmount < currentMinBet || currentBetAmount > currentMaxBet) {
    message.set(`Bet amount must be between ${currentMinBet} and ${currentMaxBet}.`);
    return;
  }

  if (currentStepBet > 0 && (currentBetAmount * 1_000_000) % (currentStepBet * 1_000_000) !== 0) {
    message.set(`Bet amount must be divisible by ${currentStepBet}.`);
    return;
  }

  if (currentBalance < currentBetAmount && currentFreeGames === 0) {
    message.set('Not enough balance!');
    return;
  }

  spinning.set(true);
  message.set('Spinning...');
  winAmount.set(0);

  const betAmountInEngine = toStakeEngineAmount(currentBetAmount); // Moved declaration here

  try {
    console.log('Calling play API with bet amount:', betAmountInEngine);
    const playResponse = await play(currentSessionID, betAmountInEngine, "BASE"); // Assuming "BASE" mode for now
    console.log('Full Play API response:', playResponse);

    if (playResponse.error) {
      message.set(`Play failed: ${playResponse.error.message}`);
      spinning.set(false);
      return;
    }

    if (playResponse.balance) {
      balance.set(fromStakeEngineAmount(playResponse.balance.amount));
    }

    if (playResponse.round) {
      const roundData = playResponse.round;

      grid.set(roundData.initial_grid);
      console.log('Initial grid set. Calling animateSpin...');
      await animateSpin(symbols, 1000, get(grid));
      console.log('animateSpin completed.');

      let currentTotalWin = 0;
      if (roundData.cascade_results) {
        for (let i = 0; i < roundData.cascade_results.length; i++) {
          const cascade = roundData.cascade_results[i];
          await animateCascade(symbols, gridContainer, cascade.grid, cascade.winning_cells, 700, 500, 500, reusableSprites);
          currentTotalWin += fromStakeEngineAmount(cascade.win_amount);
          winAmount.set(currentTotalWin);
          message.set(cascade.message || `Cascade ${i + 1} complete!`);
          grid.set(cascade.grid);
        }
      }

      balance.update(b => b + fromStakeEngineAmount(roundData.total_win_amount));
      totalSpinWin.set(fromStakeEngineAmount(roundData.total_win_amount));
      showTotalWin.set(fromStakeEngineAmount(roundData.total_win_amount) > 0);

      if (get(showTotalWin)) {
        setTimeout(() => showTotalWin.set(false), 3000);
      }

      message.set(roundData.message);
      freeGamesRemaining.set(roundData.free_games_remaining);
      currentMultiplier.set(roundData.current_multiplier);
    } else {
      message.set('No round data received from Stake Engine.');
    }

  } catch (error) {
    console.error('Error during spin:', error);
    if (error instanceof Error) {
        message.set(`Error during spin: ${error.message}`);
    } else {
        message.set('An unknown error occurred during spin.');
    }
  } finally {
    spinning.set(false);
    if (get(freeGamesRemaining) > 0) {
      setTimeout(() => spin(symbols, gridContainer, reusableSprites), 1000);
    }
  }
}

export async function updateBalance() {
  const currentSessionID = get(sessionID);
  if (!currentSessionID) return;

  try {
    const balanceResponse = await getBalance(currentSessionID);
    if (balanceResponse.balance) {
      balance.set(fromStakeEngineAmount(balanceResponse.balance.amount));
    } else if (balanceResponse.error) {
      console.error('Failed to update balance:', balanceResponse.error.message);
    }
  } catch (error) {
    console.error('Error fetching balance:', error);
  }
}

// TODO: Implement client-side verification logic here using clientSeed, revealedServerSeed, and nonce
// This would involve hashing the seeds and nonce, and then using that hash to deterministically
// re-create the game outcome (e.g., the initial grid) and compare it with the received grid.
// This is a complex step and requires a clear understanding of the backend's random number generation.
// For now, this is a placeholder for future implementation.
