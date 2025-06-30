
// src/lib/rgsApi.ts

interface RGSResponse {
  balance?: {
    amount: number;
    currency: string;
  };
  config?: {
    minBet: number;
    maxBet: number;
    stepBet: number;
    defaultBetLevel: number;
    betLevels: number[];
    jurisdiction: {
      socialCasino: boolean;
      disabledFullscreen: boolean;
      disabledTurbo: boolean;
      // ... other jurisdiction properties
    };
  };
  round?: any; // Define a more specific type for round if needed
  event?: string;
  error?: {
    statusCode: number;
    message: string;
  };
}

// Monetary values in the Stake Engine are integers with six decimal places of precision.
export const toStakeEngineAmount = (displayAmount: number): number => {
  return Math.round(displayAmount * 1_000_000);
};

export const fromStakeEngineAmount = (engineAmount: number): number => {
  return engineAmount / 1_000_000;
};

export const getUrlParams = (): { [key: string]: string } => {
  const params: { [key: string]: string } = {};
  const queryString = window.location.search.substring(1);
  const regex = /([^&=]+)=([^&]*)/g;
  let m;
  while ((m = regex.exec(queryString))) {
    params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
  }
  return params;
};

const getRgsUrl = (): string => {
  const params = getUrlParams();
  if (!params.rgs_url) {
    console.warn("rgs_url not found in URL parameters. Falling back to http://localhost:3000.");
    // Fallback or throw an error, depending on desired behavior
    return "http://localhost:3000"; // Placeholder for development
  }
  return params.rgs_url;
};

const makeRgsRequest = async (endpoint: string, payload: any): Promise<RGSResponse> => {
  const rgsUrl = getRgsUrl();
  const url = `${rgsUrl}${endpoint}`;
  console.log(`Making RGS request to: ${url} with payload:`, payload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: RGSResponse = await response.json();

    if (!response.ok) {
      console.error(`RGS API Error (${response.status}):`, data);
      return { error: { statusCode: response.status, message: data.error?.message || 'Unknown error' } };
    }

    return data;
  } catch (error) {
    console.error('Network or parsing error:', error);
    return { error: { statusCode: 0, message: 'Network or parsing error' } };
  }
};

export const authenticate = async (sessionID: string): Promise<RGSResponse> => {
  return makeRgsRequest('/wallet/authenticate', { sessionID });
};

export const getBalance = async (sessionID: string): Promise<RGSResponse> => {
  return makeRgsRequest('/wallet/balance', { sessionID });
};

export const play = async (sessionID: string, amount: number, mode: string = "BASE"): Promise<RGSResponse> => {
  return makeRgsRequest('/wallet/play', { sessionID, amount, mode });
};

export const endRound = async (sessionID: string): Promise<RGSResponse> => {
  return makeRgsRequest('/wallet/endround', { sessionID });
};

export const sendEvent = async (sessionID: string, event: string): Promise<RGSResponse> => {
  return makeRgsRequest('/bet/event', { sessionID, event });
};
