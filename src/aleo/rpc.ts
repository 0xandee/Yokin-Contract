"use client";
import { JSONRPCClient } from 'json-rpc-2.0';
import { ProgramId } from './program';
// import { Hasher } from '@doko-js/wasm';

export const ALEO_URL = 'https://mainnet.aleorpc.com/';
export const ALEOSCAN_URL = 'https://aleoscan.io/api/v1/';

export async function getHeight(): Promise<number> {
  const client = getClient();
  const height = await client.request('getHeight', {});
  return height;
}

export async function getTransactionsForProgram(programId: string, functionName: string): Promise<any> {
  const client = getClient();
  const transaction = await client.request('transactionsForProgram', {
    programId,
    functionName,
    "page": 0,
    "maxTransactions": 1000
  });
  return transaction;
}

export const getClient = () => {
  const client = new JSONRPCClient((jsonRPCRequest: any) =>
    fetch(ALEO_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ ...jsonRPCRequest })
    }).then((response: any) => {
      if (response.status === 200) {
        // Use client.receive when you received a JSON-RPC response.
        return response.json().then((jsonRPCResponse: any) => client.receive(jsonRPCResponse));
      } else if (jsonRPCRequest.id !== undefined) {
        return Promise.reject(new Error(response.statusText));
      }
    })
  );
  return client;
};

export async function getJSON(url: string): Promise<any> {
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Getters

export async function getPoolCount(): Promise<any> {
  const response = await fetch(`${ALEOSCAN_URL}mapping/get_value/${ProgramId}/pool_count/0`);
  const poolCount = await response.json();
  // returns 2u64
  return parseInt(poolCount.slice(0, -3));
}

export async function getPoolDetails(poolId: number): Promise<any> {
  const response = await fetch(`${ALEOSCAN_URL}mapping/get_value/${ProgramId}/pools/${poolId}`);
  // According to your description, you get back a single string like "{pool_id: 1u64, ...}"
  const rawPoolString = await response.json();
  // If your response is indeed just a string, then parse it:
  const poolObject = parseAleoPoolString(rawPoolString);
  return poolObject;
}

export async function getPoolPaleo(poolId: number): Promise<any> {
  const response = await fetch(`${ALEOSCAN_URL}mapping/get_value/${ProgramId}/pools/${poolId}`);
  // According to your description, you get back a single string like "{pool_id: 1u64, ...}"
  const rawPoolString = await response.json();
  // If your response is indeed just a string, then parse it:
  const poolObject = parseAleoPoolString(rawPoolString);
  return poolObject.total_paleo;
}

export async function getAllPoolDetails(): Promise<any[]> {
  const poolCount = await getPoolCount();
  const pools = Array.from({ length: poolCount }, (_, i) => i + 1);

  // Grab details of each pool in parallel
  const poolDetails = await Promise.all(
    pools.map(async (poolId) => {
      const poolString = await getPoolDetails(poolId);
      // poolString is now already parsed by parseAleoPoolString
      // If getPoolDetails returns the final object, just return it
      return poolString;
    })
  );

  return poolDetails;
}

export async function getAleoPaleoRate(): Promise<any> {
  const url = "https://mainnet.aleorpc.com/";

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "getPrices",
    params: null,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();

  const exchangeRate = parseFloat((data.result['ALEO'] / data.result['pALEO']).toFixed(5)) - 0.00001;
  return exchangeRate;
}

export async function getUserBalanceInPool(player: string, poolId: number): Promise<number> {
  try {
    const response = await fetch('/api/hash', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        player: player,
        pool_id: poolId ? poolId.toString() : "1"
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log("Hash result:", data.hash);
      const response = await fetch(`${ALEOSCAN_URL}mapping/get_value/yokin_pool_4_test.aleo/balances/${data.hash}`);
      const balanceInPool = await response.json();
      return balanceInPool;
    } else {
      console.error("Hash error:", data.error);
      return 0;
    }
  } catch (error) {
    console.error("API call error:", error);
    return 0;
  }
}

// Implement getPoolDetails function based on already defined functions
export async function getPlayerIsWinner(player: string, poolId: number): Promise<boolean> {
  try {
    const pool = await getPoolDetails(poolId);
    return pool && pool.winner === player;
  } catch (error) {
    console.error("Error checking if player is winner:", error);
    return false;
  }
}

// 1. Go to https://aleoscan.io/program?id=pondo_protocol.aleo 
// 2. Call withdrawals (address -> withdrawal_state) with admin address
// 3. Copy the values for microcredits and claim_block (e.g. {microcredits: 999501u64, claim_block: 5584153u32})
// 4. Call claim_withdraw_public with the microcredits as `paleo_burn_amount`
export async function getWithdrawalState(address: string): Promise<any> {
  const response = await fetch(`${ALEOSCAN_URL}mapping/get_value/pondo_protocol.aleo/withdrawals/${address}`);
  const withdrawalState = await response.json();
  return withdrawalState;
}

// Parser

export function parseMicrocreditsToCredits(microcredits: number): number {
  // Divide by 1,000,000 to get credits without rounding
  return microcredits / 1_000_000;
}

export function parseTimestampToDate(timestamp: number): Date {
  // Check if the timestamp is in seconds (Unix standard) or milliseconds
  // A typical Unix timestamp for recent dates (2023) would be around 1.6 billion
  // If it's much smaller, it might be incorrectly formatted or a test value

  // If timestamp is very small (like 0-100), it might be a test value
  // In this case, create a future date for testing purposes
  if (timestamp < 100) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days in the future
    return futureDate;
  }

  // If timestamp is already in milliseconds (13 digits), use it directly
  // Otherwise, convert from seconds to milliseconds
  const timestampInMs = timestamp > 9999999999 ? timestamp : timestamp * 1000;

  return new Date(timestampInMs);
}

export function parseAleoPoolString(poolString: string): any {
  // (Same as above) ...
  // 1. Strip leading/trailing braces
  let trimmed = poolString.trim();
  if (trimmed.startsWith('{')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('}')) trimmed = trimmed.slice(0, -1);

  // 2. Split on commas to get an array of "key: value"
  const pairs = trimmed.split(',');

  const jsonPairs = pairs.map((pair) => {
    // e.g. "pool_id: 1u64"
    const [rawKey, rawValue] = pair.split(':');
    const key = rawKey.trim();
    const value = rawValue.trim();

    // Check if it ends with "u64" or "u32" and parse the number
    if (value.endsWith('u64') || value.endsWith('u32')) {
      const numericValue = value.split('u')[0]; // everything before 'u64' or 'u32'
      return `"${key}": ${Number(numericValue)}`; // store it as a real number in JSON
    } else {
      // it might be a string like "aleo1qqqq..." or something else
      // just wrap it in quotes for now
      return `"${key}": "${value}"`;
    }
  });

  const jsonString = `{${jsonPairs.join(',')}}`;
  return JSON.parse(jsonString);
}

// // Hashing
// export async function hashPlayerPool(player: string, pool: string): Promise<string> {
//   // Dynamically import the WASM module so it only loads in the browser
//   const { Hasher } = await import('@doko-js/wasm');

//   const hashedField = Hasher.hash(
//     "bhp256", // algorithm
//     `{player: ${player}, pool: ${pool}}`, // input value
//     "field", // output type
//     "mainnet"
//   );
//   return hashedField;
// }

// Add a new function to get only the latest pool
export async function getLatestPoolDetails(): Promise<any> {
  const poolCount = await getPoolCount();

  // If there are no pools, return an empty array
  if (poolCount === 0) {
    return [];
  }

  // Get only the latest pool (highest ID)
  const latestPoolId = poolCount;
  const latestPool = await getPoolDetails(latestPoolId);

  return [latestPool]; // Return as array for consistency with getAllPoolDetails
}