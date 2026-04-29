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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatOdds(odds: number | null | undefined) {
  if (odds == null) return "-";
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(1)}%`;
}

function hasValidEdge(prop: Prop) {
  return prop.edge != null && prop.model_prob != null && prop.implied_prob != null;
}

function propKey(prop: Prop) {
  return `${normalizeName(prop.player)}-${prop.market}-${prop.line}`;
}

function signalTier(edge: number | null | undefined) {
  if (edge == null) return "Market Watch";
  if (edge >= 20) return "Elite";
  if (edge >= 10) return "Strong";
  if (edge >= 5) return "Lean";
  if (edge > 0) return "Small Edge";
  return "Neutral";
}

function signalColor(edge: number | null | undefined) {
  if (edge == null) return "text-zinc-400";
  if (edge >= 20) return "text-emerald-400";
  if (edge >= 10) return "text-green-400";
  if (edge >= 5) return "text-yellow-400";
  if (edge > 0) return "text-blue-400";
  return "text-zinc-400";
}

function signalBadge(edge: number | null | undefined) {
  if (edge == null) return "border-zinc-700 bg-zinc-900 text-zinc-300";
  if (edge >= 20) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (edge >= 10) return "border-green-500/40 bg-green-500/10 text-green-300";
  if (edge >= 5) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (edge > 0) return "border-blue-500/40 bg-blue-500/10 text-blue-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

function bestBookLabel(book: string | null | undefined) {
  return book || "Best Book";
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

  const markets = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(props.map((p) => p.market).filter(Boolean))).sort(),
    ];
  }, [props]);

  const books = useMemo(() => {
    return [
      "All",
      ...Array.from(new Set(props.map((p) => p.book).filter(Boolean))).sort(),
    ];
  }, [props]);

  const filteredProps = useMemo(() => {
    let rows = [...props];

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

    return rows.sort((a, b) => {
      const edgeA = a.edge ?? -999;
      const edgeB = b.edge ?? -999;

      if (edgeA !== edgeB) return edgeB - edgeA;

      return (b.implied_prob ?? 0) - (a.implied_prob ?? 0);
    });
  }, [props, marketFilter, bookFilter, search]);

  const validFilteredProps = useMemo(() => {
    return filteredProps.filter(hasValidEdge);
  }, [filteredProps]);

  const groupedBestProps = useMemo(() => {
    const map = new Map<string, Prop>();

    validFilteredProps.forEach((prop) => {
      const key = propKey(prop);
      const current = map.get(key);

      if (!current || (prop.edge ?? -999) > (current.edge ?? -999)) {
        map.set(key, prop);
      }
    });

    return Array.from(map.values()).sort((a, b) => (b.edge ?? -999) - (a.edge ?? -999));
  }, [validFilteredProps]);

  const fallbackMarketWatch = useMemo(() => {
    const map = new Map<string, Prop>();

    filteredProps.forEach((prop) => {
      const key = propKey(prop);
      const current = map.get(key);

      if (!current || (prop.implied_prob ?? 0) > (current.implied_prob ?? 0)) {
        map.set(key, prop);
      }
    });

    return Array.from(map.values()).slice(0, 8);
  }, [filteredProps]);

  const bestSignals =
    groupedBestProps.filter((p) => (p.edge ?? 0) > 0).slice(0, 8).length > 0
      ? groupedBestProps.filter((p) => (p.edge ?? 0) > 0).slice(0, 8)
      : fallbackMarketWatch;

  const eliteSignals = groupedBestProps.filter((p) => (p.edge ?? 0) >= 20).length;
  const strongSignals = groupedBestProps.filter((p) => (p.edge ?? 0) >= 10).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] p-8 text-white">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl shadow-black/40">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              HoopEdge
            </p>
            <h1 className="mt-3 text-2xl font-black">Loading Props Board...</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Pulling player cards, headshots, markets, books, and edges.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] px-5 py-8 text-white md:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              HoopEdge Props Intelligence
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
              Props Board
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400 md:text-base">
              Live sportsbook prop board with player headshots, books, lines, implied
              probability, and edge fields ready for the model layer.
            </p>
          </div>

          <button
            onClick={loadProps}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200 shadow-lg shadow-black/30 transition hover:-translate-y-0.5 hover:border-emerald-500/60 hover:bg-zinc-800"
          >
            Refresh Board
          </button>
        </div>

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Loaded Props" value={props.length} />
          <StatCard label="Filtered Props" value={filteredProps.length} />
          <StatCard label="Valid Edges" value={validFilteredProps.length} />
          <StatCard label="Strong+ Signals" value={strongSignals} color="text-emerald-400" />
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-black shadow-2xl shadow-emerald-950/20">
          <div className="border-b border-emerald-500/20 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                  {validFilteredProps.length > 0 ? "Best Bets UI" : "Market Watch"}
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {validFilteredProps.length > 0
                    ? "Top Unique Performance Edges"
                    : "Top Available Prop Markets"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                  {validFilteredProps.length > 0
                    ? "Duplicates are grouped by player, market, and line. Highest edge wins the card."
                    : "Your odds sync is working. Edge cards will activate once model probabilities are added."}
                </p>
              </div>

              <div className="rounded-full border border-emerald-500/40 bg-black/40 px-4 py-2 text-sm font-bold text-emerald-300">
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
                <div className="relative h-32 border-b border-zinc-800 bg-gradient-to-br from-zinc-900 via-black to-emerald-950/40">
                  <div className="absolute left-4 top-4 z-10">
                    <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                      #{index + 1} {validFilteredProps.length > 0 ? "Signal" : "Market"}
                    </p>

                    <span
                      className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${signalBadge(
                        prop.edge
                      )}`}
                    >
                      {signalTier(prop.edge)}
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

                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    {prop.team ?? "Team pending"}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <MiniStat label="Model" value={formatPercent(prop.model_prob)} />
                    <MiniStat label="Implied" value={formatPercent(prop.implied_prob)} />
                    <MiniStat label="Odds" value={formatOdds(prop.odds)} />
                    <MiniStat label="Book" value={bestBookLabel(prop.book)} />
                  </div>

                  <p className={`mt-5 text-3xl font-black ${signalColor(prop.edge)}`}>
                    {prop.edge != null
                      ? `${prop.edge > 0 ? "+" : ""}${prop.edge.toFixed(1)}%`
                      : "Pending"}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-zinc-500">
                    Edge = model probability minus implied probability.
                  </p>
                </div>
              </Link>
            ))}

            {bestSignals.length === 0 && (
              <div className="col-span-full rounded-2xl border border-zinc-800 bg-black/40 p-8 text-center text-zinc-400">
                No props found yet. Run the sync route again.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl shadow-black/30">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Search Player / Team
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Josh Hart..."
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Market
              </label>
              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
              >
                {markets.map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Book
              </label>
              <select
                value={bookFilter}
                onChange={(e) => setBookFilter(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
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
                className="w-full rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-zinc-700"
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
              Full market table. Model and edge columns will populate once the projection engine is added.
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
                      <span className="rounded-full border border-zinc-700 bg-black px-3 py-1 text-xs font-bold text-zinc-300">
                        {prop.market}
                      </span>
                    </Td>

                    <Td bold>{prop.line}</Td>
                    <Td className="font-bold text-blue-400">{formatOdds(prop.odds)}</Td>
                    <Td>{prop.book || "-"}</Td>
                    <Td bold>{formatPercent(prop.model_prob)}</Td>
                    <Td>{formatPercent(prop.implied_prob)}</Td>

                    <Td className={`font-black ${signalColor(prop.edge)}`}>
                      {prop.edge != null
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

function PlayerAvatar({ player }: { player: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-950">
      <PlayerHeadshot player={player} size="sm" />
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