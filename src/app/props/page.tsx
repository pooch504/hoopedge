"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";
import PlayerHeadshot from "@/components/PlayerHeadshot";

type Prop = {
  id: string;
  game_id: string;
  player: string;
  team: string | null;
  market: string;
  line: number;
  odds: number;
  book: string;
  implied_prob: number | null;
  model_prob: number | null;
  edge: number | null;
};

type EnrichedProp = Prop & {
  edgePct: number | null;
  modelPct: number | null;
  impliedPct: number | null;
  evPct: number | null;
  hoopScore: number;
};

function normalizeName(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("'", "")
    .replaceAll("’", "")
    .replaceAll(".", "")
    .replaceAll(",", "")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanSlug(text: string) {
  return normalizeName(text).replaceAll(" ", "-");
}

function toPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function toDecimalProb(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.abs(value) <= 1 ? value : value / 100;
}

function decimalOdds(odds: number) {
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

function calculateEV(modelProb: number | null, odds: number) {
  if (modelProb == null) return null;
  return (modelProb * decimalOdds(odds) - 1) * 100;
}

function formatOdds(odds: number | null | undefined) {
  if (odds == null) return "-";
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatPlainPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function propKey(prop: Prop) {
  return `${normalizeName(prop.player)}-${normalizeName(prop.market)}-${prop.line}`;
}

function signalTier(score: number) {
  if (score >= 85) return "Elite";
  if (score >= 72) return "Strong";
  if (score >= 60) return "Playable";
  if (score >= 45) return "Watch";
  return "Neutral";
}

function signalBadge(score: number) {
  if (score >= 85) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (score >= 72) return "border-green-500/40 bg-green-500/10 text-green-300";
  if (score >= 60) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (score >= 45) return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function scoreColor(score: number) {
  if (score >= 85) return "text-emerald-400";
  if (score >= 72) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 45) return "text-blue-400";
  return "text-zinc-400";
}

function enrichProp(prop: Prop): EnrichedProp {
  const modelPct = toPct(prop.model_prob);
  const impliedPct = toPct(prop.implied_prob);
  const edgePct = prop.edge != null ? toPct(prop.edge) : modelPct != null && impliedPct != null ? modelPct - impliedPct : null;
  const modelProb = toDecimalProb(prop.model_prob);
  const evPct = calculateEV(modelProb, prop.odds);

  const edgeScore = Math.max(0, Math.min(45, (edgePct ?? 0) * 1.4));
  const evScore = Math.max(0, Math.min(35, (evPct ?? 0) * 1.1));
  const modelScore = Math.max(0, Math.min(20, ((modelPct ?? 0) - 45) * 0.6));
  const hoopScore = Math.max(0, Math.min(100, edgeScore + evScore + modelScore));

  return {
    ...prop,
    edgePct,
    modelPct,
    impliedPct,
    evPct,
    hoopScore,
  };
}

export default function PropsPage() {
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketFilter, setMarketFilter] = useState("All");
  const [bookFilter, setBookFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProps();
  }, []);

  async function loadProps() {
    setLoading(true);

    const { data, error } = await supabase
      .from("props")
      .select("*")
      .order("edge", { ascending: false, nullsFirst: false })
      .limit(1000);

    if (error) {
      console.error("Props load error:", error.message);
      setProps([]);
    } else {
      setProps((data as Prop[]) || []);
    }

    setLoading(false);
  }

  const enrichedProps = useMemo(() => props.map(enrichProp), [props]);

  const markets = useMemo(() => {
    return ["All", ...Array.from(new Set(enrichedProps.map((p) => p.market).filter(Boolean))).sort()];
  }, [enrichedProps]);

  const books = useMemo(() => {
    return ["All", ...Array.from(new Set(enrichedProps.map((p) => p.book).filter(Boolean))).sort()];
  }, [enrichedProps]);

  const filteredProps = useMemo(() => {
    let rows = [...enrichedProps];

    if (marketFilter !== "All") rows = rows.filter((p) => p.market === marketFilter);
    if (bookFilter !== "All") rows = rows.filter((p) => p.book === bookFilter);

    if (search.trim()) {
      const query = search.toLowerCase().trim();

      rows = rows.filter(
        (p) =>
          p.player.toLowerCase().includes(query) ||
          p.team?.toLowerCase().includes(query) ||
          p.market.toLowerCase().includes(query) ||
          p.book.toLowerCase().includes(query)
      );
    }

    return rows.sort((a, b) => b.hoopScore - a.hoopScore);
  }, [enrichedProps, marketFilter, bookFilter, search]);

  const groupedBestProps = useMemo(() => {
    const map = new Map<string, EnrichedProp>();

    filteredProps.forEach((prop) => {
      const key = propKey(prop);
      const current = map.get(key);

      if (!current || prop.hoopScore > current.hoopScore) {
        map.set(key, prop);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.hoopScore - a.hoopScore);
  }, [filteredProps]);

  const bestSignals = groupedBestProps.filter((p) => p.hoopScore >= 45).slice(0, 8);
  const eliteSignals = groupedBestProps.filter((p) => p.hoopScore >= 85).length;
  const strongSignals = groupedBestProps.filter((p) => p.hoopScore >= 72).length;
  const positiveEV = groupedBestProps.filter((p) => (p.evPct ?? -999) > 0).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] p-8 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl shadow-black/40">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">
              HoopEdge
            </p>
            <h1 className="mt-3 text-2xl font-black">Loading Best Bets Engine...</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Ranking edges, EV, books, and unique prop cards.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050607] px-5 py-8 text-white md:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400">
              HoopEdge Props Intelligence
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Best Bets Engine
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
              Unique prop cards ranked by HoopEdge Score, combining model probability,
              implied probability, edge, and expected value.
            </p>
          </div>

          <button
            onClick={loadProps}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-black text-zinc-200 shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:border-emerald-500/60 hover:bg-zinc-800"
          >
            Refresh Board
          </button>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Loaded Props" value={props.length} />
          <StatCard label="Unique Cards" value={groupedBestProps.length} />
          <StatCard label="Positive EV" value={positiveEV} color="text-emerald-400" />
          <StatCard label="Strong+ Signals" value={strongSignals} color="text-emerald-400" />
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-black shadow-2xl shadow-emerald-950/20">
          <div className="border-b border-emerald-500/20 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
                  Auto-Ranked
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Top Unique Prop Signals
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                  Duplicate books are grouped by player, market, and line. The card with
                  the highest HoopEdge Score wins.
                </p>
              </div>

              <div className="rounded-full border border-emerald-500/40 bg-black/40 px-4 py-2 text-sm font-black text-emerald-300">
                Elite Signals: {eliteSignals}
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6 xl:grid-cols-4">
            {bestSignals.map((prop, index) => (
              <Link
                key={`${prop.id}-${index}`}
                href={`/players/${cleanSlug(prop.player)}`}
                className="group overflow-hidden rounded-2xl border border-zinc-800 bg-black/50 shadow-xl shadow-black/30 transition hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-zinc-950"
              >
                <div className="relative h-36 border-b border-zinc-800 bg-gradient-to-br from-zinc-900 via-black to-emerald-950/40">
                  <div className="absolute left-4 top-4 z-10">
                    <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                      #{index + 1} Signal
                    </p>

                    <span
                      className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${signalBadge(
                        prop.hoopScore
                      )}`}
                    >
                      {signalTier(prop.hoopScore)}
                    </span>
                  </div>

                  <div className="absolute bottom-0 right-0">
                    <PlayerHeadshot player={prop.player} size="lg" />
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-black transition group-hover:text-emerald-300">
                    {prop.player}
                  </h3>

                  <p className="mt-1 text-sm text-zinc-400">
                    {prop.market} {prop.line}
                  </p>

                  <p className="mt-1 text-xs font-black uppercase tracking-wide text-zinc-500">
                    {prop.team ?? "Team pending"}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <MiniStat label="Model" value={formatPlainPercent(prop.modelPct)} />
                    <MiniStat label="Implied" value={formatPlainPercent(prop.impliedPct)} />
                    <MiniStat label="Edge" value={formatPercent(prop.edgePct)} />
                    <MiniStat label="EV" value={formatPercent(prop.evPct)} />
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          HoopEdge Score
                        </p>
                        <p className={`mt-1 text-3xl font-black ${scoreColor(prop.hoopScore)}`}>
                          {prop.hoopScore.toFixed(1)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-zinc-500">Best Book</p>
                        <p className="text-sm font-black">{prop.book || "-"}</p>
                        <p className="text-sm font-black text-blue-400">{formatOdds(prop.odds)}</p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.min(100, prop.hoopScore)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {bestSignals.length === 0 && (
              <div className="col-span-full rounded-2xl border border-zinc-800 bg-black/40 p-8 text-center text-zinc-400">
                No ranked props yet. Run your sync route again.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl shadow-black/30">
          <div className="grid gap-4 md:grid-cols-4">
            <FilterTextInput value={search} onChange={setSearch} />

            <FilterSelect label="Market" value={marketFilter} onChange={setMarketFilter} options={markets} />

            <FilterSelect label="Book" value={bookFilter} onChange={setBookFilter} options={books} />

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setMarketFilter("All");
                  setBookFilter("All");
                }}
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-black text-zinc-200 transition hover:bg-zinc-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/80 shadow-2xl shadow-black/40">
          <div className="border-b border-zinc-800 p-5 md:p-6">
            <h2 className="text-xl font-black">Full Props Intelligence Table</h2>
            <p className="mt-1 text-sm text-zinc-400">
              All props with EV, edge, book, model probability, implied probability, and HoopEdge Score.
            </p>
          </div>

          <div className="max-h-[700px] overflow-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-950 text-zinc-400 shadow-lg shadow-black/30">
                <tr>
                  <Th align="left">Player</Th>
                  <Th>Team</Th>
                  <Th>Market</Th>
                  <Th>Line</Th>
                  <Th>Odds</Th>
                  <Th>Book</Th>
                  <Th>Model</Th>
                  <Th>Implied</Th>
                  <Th>Edge</Th>
                  <Th>EV</Th>
                  <Th>Score</Th>
                  <Th>Tier</Th>
                </tr>
              </thead>

              <tbody>
                {filteredProps.map((prop, index) => (
                  <tr
                    key={prop.id}
                    className={`border-t border-zinc-800 transition hover:bg-emerald-500/10 ${
                      index % 2 === 0 ? "bg-zinc-900/40" : "bg-black/40"
                    }`}
                  >
                    <Td align="left" bold>
                      <Link
                        href={`/players/${cleanSlug(prop.player)}`}
                        className="flex items-center gap-3 transition hover:text-emerald-400"
                      >
                        <PlayerAvatar player={prop.player} />
                        <span>{prop.player}</span>
                      </Link>
                    </Td>

                    <Td>{prop.team ?? "-"}</Td>
                    <Td>
                      <span className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-black text-zinc-300">
                        {prop.market}
                      </span>
                    </Td>
                    <Td bold>{prop.line}</Td>
                    <Td className="font-black text-blue-400">{formatOdds(prop.odds)}</Td>
                    <Td>{prop.book || "-"}</Td>
                    <Td bold>{formatPlainPercent(prop.modelPct)}</Td>
                    <Td>{formatPlainPercent(prop.impliedPct)}</Td>
                    <Td className="font-black text-emerald-400">{formatPercent(prop.edgePct)}</Td>
                    <Td className="font-black text-emerald-400">{formatPercent(prop.evPct)}</Td>
                    <Td className={`font-black ${scoreColor(prop.hoopScore)}`}>
                      {prop.hoopScore.toFixed(1)}
                    </Td>
                    <Td>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-black ${signalBadge(
                          prop.hoopScore
                        )}`}
                      >
                        {signalTier(prop.hoopScore)}
                      </span>
                    </Td>
                  </tr>
                ))}

                {filteredProps.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-zinc-400">
                      No props match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function PlayerAvatar({ player }: { player: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
      <PlayerHeadshot player={player} size="sm" />
    </div>
  );
}

function FilterTextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-wide text-zinc-500">
        Search Player / Team
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jalen Brunson..."
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-wide text-zinc-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-zinc-700">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Th({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <th
      className={`p-4 font-semibold ${
        align === "left" ? "text-left" : "text-center"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "center",
  bold = false,
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  bold?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`p-4 ${
        align === "left" ? "text-left" : "text-center"
      } ${bold ? "font-bold text-white" : "text-zinc-300"} ${className}`}
    >
      {children}
    </td>
  );
}