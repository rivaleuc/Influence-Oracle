"use client";

import { useEffect, useState } from "react";
import {
  CONTRACT_ADDRESS,
  EXPLORER_URL,
  FAUCET_URL,
  Score,
  analyze,
  connectWallet,
  getScore,
  getTotal,
  waitForReceipt,
} from "../lib/contract";

type Status =
  | { kind: "idle" }
  | { kind: "busy"; msg: string }
  | { kind: "error"; msg: string }
  | { kind: "ok"; msg: string };

export default function Oracle() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [twitter, setTwitter] = useState("");
  const [github, setGithub] = useState("");
  const [website, setWebsite] = useState("");
  const [score, setScore] = useState<Score | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    getTotal().then(setTotal).catch(() => setTotal(null));
  }, []);

  const handleConnect = async () => {
    try {
      setStatus({ kind: "busy", msg: "Connecting wallet…" });
      const addr = await connectWallet();
      setAccount(addr);
      setStatus({ kind: "ok", msg: `Connected: ${short(addr)}` });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  const handleLookup = async () => {
    if (!twitter.trim()) return;
    try {
      setStatus({ kind: "busy", msg: "Looking up cached score…" });
      const s = await getScore(twitter.trim());
      setScore(s);
      if (s.exists) {
        setStatus({ kind: "ok", msg: "Found cached score." });
        if (s.github_handle) setGithub(s.github_handle);
        if (s.website_url) setWebsite(s.website_url);
      } else {
        setStatus({ kind: "ok", msg: "No cached score — click Analyze to compute one." });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  const handleAnalyze = async () => {
    if (!account) {
      setStatus({ kind: "error", msg: "Connect your wallet first." });
      return;
    }
    if (!twitter.trim()) {
      setStatus({ kind: "error", msg: "Twitter/X handle is required." });
      return;
    }
    try {
      setStatus({
        kind: "busy",
        msg: "Analyzing (multi-LLM consensus on Bradbury — usually 1–4 min)…",
      });
      const tx = await analyze(account, twitter.trim(), github.trim(), website.trim());
      await waitForReceipt(account, tx);
      const [s, t] = await Promise.all([
        getScore(twitter.trim()),
        getTotal().catch(() => total ?? 0),
      ]);
      setScore(s);
      setTotal(t);
      setStatus({ kind: "ok", msg: "Score computed." });
    } catch (e) {
      setStatus({ kind: "error", msg: msg(e) });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BgGrid />

      <div className="relative mx-auto max-w-3xl px-6 py-16 space-y-10">
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Live on GenLayer Bradbury Testnet
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-br from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
            Influence Oracle
          </h1>
          <p className="text-zinc-400 leading-relaxed max-w-xl">
            Paste any X/Twitter handle. A panel of validators running diverse LLMs reads the
            public profile, optionally cross-checks GitHub and the linked website, and reaches
            consensus on a 0–100 authenticity score — engagement, content, network, integrity,
            cross-platform.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <a
              className="font-mono hover:text-zinc-300 transition"
              target="_blank"
              rel="noreferrer"
              href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
            >
              Contract: {short(CONTRACT_ADDRESS)}
            </a>
            {total !== null && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400">
                  <span className="font-semibold text-zinc-200">{total.toLocaleString()}</span> handles analyzed
                </span>
              </>
            )}
          </div>
        </header>

        {!account ? (
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Connect a wallet to analyze</h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Works with MetaMask, Rabby, Coinbase Wallet, Brave Wallet, and any injected EVM wallet.
                  Need testnet GEN? Grab some from the{" "}
                  <a className="underline" target="_blank" rel="noreferrer" href={FAUCET_URL}>faucet</a>.
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="shrink-0 rounded-md bg-violet-500 hover:bg-violet-400 px-5 py-2.5 text-sm font-semibold text-white transition"
              >
                Connect Wallet
              </button>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wider text-zinc-500">Wallet</div>
                <div className="font-mono text-zinc-200 mt-0.5">{account}</div>
              </div>
              <div className="text-right text-xs text-zinc-500">
                <div>Status</div>
                <div className="text-emerald-400 font-medium">Connected</div>
              </div>
            </div>
          </Card>
        )}

        <Card title="Analyze a creator">
          <div className="space-y-4">
            <Field
              label="X / Twitter handle"
              prefix="@"
              placeholder="vitalikbuterin"
              value={twitter}
              onChange={setTwitter}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="GitHub handle (optional)"
                prefix="github.com/"
                placeholder="vbuterin"
                value={github}
                onChange={setGithub}
              />
              <Field
                label="Website (optional)"
                prefix="https://"
                placeholder="example.com"
                value={website}
                onChange={setWebsite}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleLookup}
                disabled={!twitter.trim() || status.kind === "busy"}
                className="rounded-md border border-zinc-700 hover:border-zinc-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-zinc-200 transition"
              >
                Look up cached
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!twitter.trim() || status.kind === "busy" || !account}
                className="flex-1 rounded-md bg-violet-500 hover:bg-violet-400 disabled:bg-zinc-800 disabled:text-zinc-500 px-4 py-2 text-sm font-semibold text-white transition"
              >
                Analyze (multi-LLM consensus)
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Twitter/X profile fetching is best-effort — public pages are increasingly restricted.
              When that source is unavailable, the score is weighted toward GitHub and website,
              and the LLM flags lower confidence in its reasoning.
            </p>
          </div>
        </Card>

        {score?.exists && <ScoreCard s={score} />}

        <footer className="pt-8 border-t border-zinc-900 text-xs text-zinc-600 flex flex-wrap items-center justify-between gap-2">
          <div>
            Built on{" "}
            <a className="hover:text-zinc-400" href="https://genlayer.com">GenLayer</a>
            {" · "}
            <a className="hover:text-zinc-400" href="https://github.com/rivaleuc/Influence-Oracle">Source</a>
            {" · "}
            <a className="hover:text-zinc-400" target="_blank" rel="noreferrer" href={FAUCET_URL}>Faucet</a>
          </div>
          <div className="font-mono">
            <a
              className="hover:text-zinc-400"
              target="_blank"
              rel="noreferrer"
              href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
            >
              {short(CONTRACT_ADDRESS)}
            </a>
          </div>
        </footer>
      </div>

      {status.kind !== "idle" && (
        <div
          className={[
            "fixed bottom-4 right-4 max-w-sm rounded-md border px-4 py-3 text-sm shadow-2xl backdrop-blur",
            status.kind === "busy" && "bg-zinc-900/90 border-zinc-700 text-zinc-200",
            status.kind === "error" && "bg-red-950/90 border-red-800 text-red-200",
            status.kind === "ok" && "bg-emerald-950/90 border-emerald-800 text-emerald-200",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-start gap-2">
            {status.kind === "busy" && (
              <svg className="h-4 w-4 animate-spin mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            )}
            <div>{status.msg}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 backdrop-blur p-6 space-y-4 shadow-xl shadow-black/40">
      {title && (
        <h2 className="text-xs uppercase tracking-[0.18em] text-zinc-500 font-medium">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  prefix,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  prefix: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-500 mb-1.5 font-medium">{label}</div>
      <div className="flex rounded-md bg-zinc-900/60 border border-zinc-800 focus-within:border-violet-500 transition overflow-hidden">
        <span className="px-3 py-2.5 text-zinc-500 text-sm border-r border-zinc-800 select-none whitespace-nowrap">
          {prefix}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none min-w-0"
        />
      </div>
    </label>
  );
}

function ScoreCard({ s }: { s: Score }) {
  const v = s.overall ?? 0;
  const tone = toneFor(v);
  const sources = (s.sources_used ?? "").split(",").filter(Boolean);
  return (
    <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 backdrop-blur p-6 space-y-5 shadow-xl shadow-black/40">
      <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-6">
        <div className={`absolute -top-20 -right-10 h-40 w-40 rounded-full blur-3xl bg-gradient-to-br ${tone.glow}`} />
        <div className="relative flex items-end gap-4">
          <ScoreRing value={v} />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Authenticity</div>
            <div className={`text-6xl font-bold tabular-nums leading-none ${tone.text}`}>{v}</div>
            <div className="text-xs text-zinc-500 mt-1">/ 100</div>
          </div>
          {s.twitter_handle && (
            <div className="text-right text-xs text-zinc-500 font-mono">@{s.twitter_handle}</div>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <SubScore label="Engagement" value={s.engagement ?? 0} />
        <SubScore label="Content" value={s.content ?? 0} />
        <SubScore label="Network" value={s.network ?? 0} />
        <SubScore label="Integrity" value={s.integrity ?? 0} />
        <SubScore label="Cross-platform" value={s.cross_platform ?? 0} />
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((src) => (
            <span
              key={src}
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-400"
            >
              {src.replace("_", " ")}
            </span>
          ))}
        </div>
      )}

      {s.reasoning && (
        <p className="text-sm text-zinc-300 leading-relaxed border-l-2 border-zinc-800 pl-3">
          {s.reasoning}
        </p>
      )}
    </section>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const tone = toneFor(value);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className={`font-mono font-semibold ${tone.text}`}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
        <div
          className={`h-full rounded-full ${tone.bg}`}
          style={{ width: `${value}%`, transition: "width 0.8s ease-out" }}
        />
      </div>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const stroke = value >= 75 ? "#34d399" : value >= 50 ? "#fbbf24" : "#fb7185";
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} stroke="#27272a" strokeWidth="6" fill="none" />
      <circle
        cx="36" cy="36" r={r} stroke={stroke} strokeWidth="6" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
      />
    </svg>
  );
}

function BgGrid() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.14),transparent_55%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </>
  );
}

function toneFor(v: number) {
  if (v >= 75) return { text: "text-emerald-400", bg: "bg-emerald-400", glow: "from-emerald-400/20" };
  if (v >= 50) return { text: "text-amber-400", bg: "bg-amber-400", glow: "from-amber-400/20" };
  return { text: "text-rose-400", bg: "bg-rose-400", glow: "from-rose-400/20" };
}

function short(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function msg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.shortMessage === "string") return obj.shortMessage;
    if (typeof obj.reason === "string") return obj.reason;
    try { return JSON.stringify(e, null, 2); } catch { return "Unknown error"; }
  }
  return String(e);
}
