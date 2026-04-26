"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

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

function cleanSlug(text: string) {
  return text
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll("'", "")
    .replaceAll("’", "")
    .replaceAll(",", "")
    .replaceAll(" ", "-");
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function signalTier(edge: number | null) {
  if (edge === null) return "Pending";
  if (edge >= 20) return "Elite";
  if (edge >= 10) return "Strong";
  if (edge >= 5) return "Lean";
  if (edge > 0) return "Small Edge";
  return "Neutral";
}

function signalColor(edge: number | null) {
  if (edge === null) return "text-zinc-400";
  if (edge >= 20) return "text-emerald-400";
  if (edge >= 10) return "text-green-400";
  if (edge >= 5) return "text-yellow-400";
  if (edge > 0) return "text-blue-400";
  return "text-zinc-400";
}

function signalBadge(edge: number | null) {
  if (edge === null) return "border-zinc-700 bg-zinc-900 text-zinc-300";
  if (edge >= 20) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (edge >= 10) return "border-green-500/40 bg-green-500/10 text-green-300";
  if (edge >= 5) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (edge > 0) return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
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
      .order("edge", { ascending: false })
      .limit(1000);

    if (error) {
      console.error(error.message);
      setProps([]);
    } else {
      setProps((data as Prop[]) || []);
    }

    setLoading(false);
  }

  const markets = useMemo(() => {
    return ["All", ...Array.from(new Set(props.map((p) => p.market))).sort()];
  }, [props]);

  const books = useMemo(() => {
    return ["All", ...Array.from(new Set(props.map((p) => p.book))).sort()];
  }, [props]);

  const filteredProps = useMemo(() => {
    let rows = [...props];

    if (marketFilter !== "All") {
      rows = rows.filter((p) => p.market === marketFilter);
    }

    if (bookFilter !== "All") {
      rows = rows.filter((p) => p.book === bookFilter);
    }

    if (search.trim()) {
      rows = rows.filter((p) =>
        p.player.toLowerCase().includes(search.toLowerCase())
      );
    }

    return rows.sort((a, b) => (b.edge ?? -999) - (a.edge ?? -999));
  }, [props, marketFilter, bookFilter, search]);

  const bestSignals = filteredProps.filter((p) => (p.edge ?? 0) > 0).slice(0, 8);
  const eliteSignals = filteredProps.filter((p) => (p.edge ?? 0) >= 20).length;
  const strongSignals = filteredProps.filter((p) => (p.edge ?? 0) >= 10).length;
  const totalWithEdges = filteredProps.filter((p) => p.edge !== null).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] p-8 text-white">
        Loading props intelligence...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] px-8 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
              HoopEdge Props Intelligence
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">
              Best Signals Board
            </h1>
            <p className="mt-2 max-w-3xl text-zinc-400">
              Analytics-first prop board ranked by calculated edge, model probability,
              recent hit-rate logic, and live market context.
            </p>
          </div>

          <button
            onClick={loadProps}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:border-emerald-500/60 hover:bg-zinc-800"
          >
            Refresh Board
          </button>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Loaded Props" value={props.length} />
          <StatCard label="Filtered Props" value={filteredProps.length} />
          <StatCard label="Edges Calculated" value={totalWithEdges} />
          <StatCard label="Strong+ Signals" value={strongSignals} color="text-emerald-400" />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
          <div className="border-b border-emerald-500/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                  Best Bets UI
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Top Performance Edges
                </h2>
                <p className="mt-2 text-sm text-zinc-300">
                  Ranked by model probability minus implied probability. Use as an
                  analytics signal board, not as a bet slip.
                </p>
              </div>

              <div className="rounded-full border border-emerald-500/40 bg-black/30 px-4 py-2 text-sm font-bold text-emerald-300">
                Elite Signals: {eliteSignals}
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">
            {bestSignals.map((prop, index) => (
              <Link
                key={prop.id}
                href={`/players/${cleanSlug(prop.player)}`}
                className="rounded-2xl border border-zinc-800 bg-black/40 p-5 transition hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-500">
                      #{index + 1} Signal
                    </p>
                    <h3 className="mt-2 text-lg font-black">{prop.player}</h3>
                    <p className="mt-1 text-sm text-zinc-400">
                      {prop.market} {prop.line}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${signalBadge(
                      prop.edge
                    )}`}
                  >
                    {signalTier(prop.edge)}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MiniStat label="Model" value={`${prop.model_prob ?? "-"}%`} />
                  <MiniStat label="Implied" value={`${prop.implied_prob ?? "-"}%`} />
                  <MiniStat label="Odds" value={formatOdds(prop.odds)} />
                  <MiniStat label="Book" value={prop.book} />
                </div>

                <p className={`mt-5 text-3xl font-black ${signalColor(prop.edge)}`}>
                  {prop.edge !== null
                    ? `${prop.edge > 0 ? "+" : ""}${prop.edge.toFixed(1)}%`
                    : "-"}
                </p>

                <p className="mt-2 text-xs text-zinc-500">
                  Edge = model probability minus implied probability.
                </p>
              </Link>
            ))}

            {bestSignals.length === 0 && (
              <div className="col-span-full rounded-xl border border-zinc-800 bg-black/40 p-8 text-center text-zinc-400">
                No positive edge signals found yet. Run daily sync and calculate edges.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Search Player
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Josh Hart..."
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Market
              </label>
              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500"
              >
                {markets.map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Book
              </label>
              <select
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none transition focus:border-emerald-500"
              >
                {books.map((book) => (
                  <option key={book} value={book}>
                    {book}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setMarketFilter("All");
                  setBookFilter("All");
                }}
                className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold text-zinc-200 transition hover:bg-zinc-700"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="text-xl font-black">Full Props Intelligence Table</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Sticky header, sorted by edge, with model and market context.
            </p>
          </div>

          <div className="max-h-[700px] overflow-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-950 text-zinc-400 shadow-lg shadow-black/30">
                <tr>
                  <Th align="left">Player</Th>
                  <Th>Team</Th>
                  <Th>Market</Th>
                  <Th>Line</Th>
                  <Th>Odds</Th>
                  <Th>Book</Th>
                  <Th>Model %</Th>
                  <Th>Implied %</Th>
                  <Th>Edge</Th>
                  <Th>Tier</Th>
                </tr>
              </thead>

              <tbody>
                {filteredProps.map((prop, index) => (
                  <tr
                    key={prop.id}
                    className={`border-t border-zinc-800 transition hover:bg-emerald-500/10 ${
                      index % 2 === 0 ? "bg-zinc-900/40" : "bg-black"
                    }`}
                  >
                    <Td align="left" bold>
                      <Link
                        href={`/players/${cleanSlug(prop.player)}`}
                        className="hover:text-blue-400"
                      >
                        {prop.player}
                      </Link>
                    </Td>
                    <Td>{prop.team ?? "-"}</Td>
                    <Td>
                      <span className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-bold text-zinc-300">
                        {prop.market}
                      </span>
                    </Td>
                    <Td bold>{prop.line}</Td>
                    <Td className="font-bold text-blue-400">
                      {formatOdds(prop.odds)}
                    </Td>
                    <Td>{prop.book}</Td>
                    <Td bold>{prop.model_prob ?? "-"}%</Td>
                    <Td>{prop.implied_prob ?? "-"}%</Td>
                    <Td className={`font-black ${signalColor(prop.edge)}`}>
                      {prop.edge !== null
                        ? `${prop.edge > 0 ? "+" : ""}${prop.edge.toFixed(1)}%`
                        : "-"}
                    </Td>
                    <Td>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${signalBadge(
                          prop.edge
                        )}`}
                      >
                        {signalTier(prop.edge)}
                      </span>
                    </Td>
                  </tr>
                ))}

                {filteredProps.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-zinc-400">
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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
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
      } ${bold ? "font-bold" : "text-zinc-300"} ${className}`}
    >
      {children}
    </td>
  );
}