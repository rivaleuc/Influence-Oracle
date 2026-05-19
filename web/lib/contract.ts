"use client";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

// Filled in once we deploy on Bradbury.
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0xb7385882C5BB128BEBe7c7EA853599880980aE3b") as `0x${string}`;

export const FAUCET_URL = "https://testnet-faucet.genlayer.foundation/";
export const EXPLORER_URL = "https://explorer-bradbury.genlayer.com";

export type Score = {
  exists: boolean;
  twitter_handle?: string;
  github_handle?: string;
  website_url?: string;
  overall?: number;
  engagement?: number;
  content?: number;
  network?: number;
  integrity?: number;
  cross_platform?: number;
  reasoning?: string;
  sources_used?: string;
};

type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: InjectedProvider[];
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

const BRADBURY_CHAIN_ID_HEX = `0x${(4221).toString(16)}`;

function pickProvider(): InjectedProvider | null {
  if (typeof window === "undefined") return null;
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    const mm = eth.providers.find((p) => p.isMetaMask);
    if (mm) return mm;
    return eth.providers[0];
  }
  return eth;
}

const NO_WALLET_MSG =
  "No EVM wallet detected. Install MetaMask, Rabby, Coinbase Wallet, Brave Wallet, or any injected wallet to continue.";

async function ensureBradburyChain(provider: InjectedProvider) {
  const current = await provider.request({ method: "eth_chainId" });
  if (current === BRADBURY_CHAIN_ID_HEX) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BRADBURY_CHAIN_ID_HEX,
            chainName: "GenLayer Bradbury Testnet",
            rpcUrls: ["https://rpc-bradbury.genlayer.com"],
            nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
            blockExplorerUrls: ["https://explorer-bradbury.genlayer.com/"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  const provider = pickProvider();
  if (!provider) throw new Error(NO_WALLET_MSG);
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length) throw new Error("No accounts returned");
  await ensureBradburyChain(provider);
  return accounts[0] as `0x${string}`;
}

function client(account?: `0x${string}`) {
  const provider = pickProvider();
  if (!provider) throw new Error(NO_WALLET_MSG);
  return createClient({
    chain: testnetBradbury,
    account,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provider: provider as any,
  });
}

// ---------- Reads ----------
export async function getScore(twitter: string): Promise<Score> {
  return (await client().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_score",
    args: [twitter],
  })) as Score;
}

export async function getTotal(): Promise<number> {
  const n = (await client().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "total",
    args: [],
  })) as number | bigint;
  return Number(n);
}

// ---------- Writes ----------
export async function analyze(
  account: `0x${string}`,
  twitter: string,
  github: string,
  website: string,
): Promise<string> {
  const hash = (await client(account).writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "analyze",
    args: [twitter, github, website],
    value: BigInt(0),
  })) as string;
  return hash;
}

export async function waitForReceipt(
  account: `0x${string}`,
  hash: string,
  opts: { interval?: number; retries?: number } = {},
) {
  return await client(account).waitForTransactionReceipt({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hash: hash as any,
    interval: opts.interval ?? 3000,
    retries: opts.retries ?? 100,
  });
}
