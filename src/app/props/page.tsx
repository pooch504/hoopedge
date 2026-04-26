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

type PlayerStat = {
  id: string;
  player: string;
  team: string | null;
  game_date: string;
  opponent: string | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  threes: number | null;
};

type Game = {
  id: string;
  away_team: string;
  home_team: string;
  game_time: string;
};

function cleanSlug(text: string) {
  return decodeURIComponent(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

function getStatForMarket(log: PlayerStat, market: string) {
  const normalized = market.toLowerCase();

  if (normalized.includes("pra")) {
    return (log.points ?? 0) + (log.rebounds ?? 0) + (log.assists ?? 0);
  }

  if (normalized.includes("point")) return log.points ?? 0;
  if (normalized.includes("rebound")) return log.rebounds ?? 0;
  if (normalized.includes("assist")) return log.assists ?? 0;
  if (normalized.includes("3pm")) return log.threes ?? 0;
  if (normalized.includes("three")) return log.threes ?? 0;

  return 0;
}

function calculateEdge(avg: number, line: number) {
  if (!line || line <= 0) return null;
  return ((avg - line) / line) * 100;
}

function getEdgeLabel(edge: number | null) {
  if (edge === null) return "Pending";
  if (edge >= 50) return "Elite";
  if (edge >= 20) return "Strong";
  if (edge >= 5) return "Lean";
  if (edge > -5) return "Neutral";
  return "Fade";
}

function getEdgeColor(edge: number | null) {
  if (edge === null) return "text-zinc-400";
  if (edge >= 50) return "text-emerald-400";
  if (edge >= 20) return "text-green-400";
  if (edge >= 5) return "text-yellow-400";
  if (edge > -5) return "text-zinc-300";
  return "text-red-400";
}

function getBadgeStyle(edge: number | null) {
  if (edge === null) return "border-zinc-700 bg-zinc-800 text-zinc-300";
  if (edge >= 50) return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (edge >= 20) return "border-green-500/40 bg-green-500/15 text-green-300";
  if (edge >= 5) return "border-yellow-500/40 bg-yellow-500/15 text-yellow-300";
  if (edge > -5) return "border-zinc-700 bg-zinc-800 text-zinc-300";
  return "border-red-500/40 bg-red-500/15 text-red-300";
}

export default function PropsPage() {
  const [props, setProps] = useState<Prop[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [marketFilter, setMarketFilter] = useState("All");
  const [bookFilter, setBookFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const { data: propsData } = await supabase
      .from("props")
      .select("*")
      .order("player", { ascending: true });

    const { data: statsData } = await supabase
      .from("player_stats")
      .select("*")
      .order("game_date", { ascending: false });

    const { data: gamesData } = await supabase
      .from("games")
      .select("id, away_team, home_team, game_time");

    setProps((propsData as Prop[]) || []);
    setStats((statsData as PlayerStat[]) || []);
    setGames((gamesData as Game[]) || []);
    setLoading(false);
  }

  const enrichedProps = useMemo(() => {
    return props.map((prop) => {
      const playerLogs = stats
        .filter((log) => cleanSlug(log.player) === cleanSlug(prop.player))
        .slice(0, 10);

      const values = playerLogs.map((log) => getStatForMarket(log, prop.market));
      const total = values.length;
      const hits = values.filter((value) => value >= prop.line).length;
      const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
      const recentAvg =
        total > 0
          ? Number((values.reduce((sum, value) => sum + value, 0) / total).toFixed(1))
          : 0;

      const calculatedEdge = calculateEdge(recentAvg, prop.line);
      const tier = getEdgeLabel(calculatedEdge);
      const game = games.find((g) => g.id === prop.game_id);

      return {
        ...prop,
        recentAvg,
        hits,
        total,
        hitRate,
        calculatedEdge,
        tier,
        matchup: game ? `${game.away_team} @ ${game.home_team}` : "Unknown Game",
      };
    });
  }, [props, stats, games]);

  const markets = useMemo(() => {
    return ["All", ...Array.from(new Set(props.map((p) => p.market))).sort()];
  }, [props]);

  const books = useMemo(() => {
    return ["All", ...Array.from(new Set(props.map((p) => p.book))).sort()];
  }, [props]);

  const filteredProps = useMemo(() => {
    return enrichedProps
      .filter((prop) =>
        search.trim()
          ? prop.player.toLowerCase().includes(search.toLowerCase())
          : true
      )
      .filter((prop) =>
        marketFilter === "All" ? true : prop.market === marketFilter
      )
      .filter((prop) => (bookFilter === "All" ? true : prop.book === bookFilter))
      .filter((prop) => (tierFilter === "All" ? true : prop.tier === tierFilter))
      .sort((a, b) => {
        const aEdge = a.calculatedEdge ?? -999;
        const bEdge = b.calculatedEdge ?? -999;
        return bEdge - aEdge;
      });
  }, [enrichedProps, search, marketFilter, bookFilter, tierFilter]);

  const topPlays = useMemo(() => {
    return filteredProps
      .filter((prop) => (prop.calculatedEdge ?? -999) >= 20)
      .slice(0, 5);
  }, [filteredProps]);

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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              Props Intelligence
            </h1>
            <p className="mt-2 text-zinc-400">
              Market lines ranked by recent player performance, hit rate, and calculated edge.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800"
          >
            ← Back to Slate
          </Link>
        </div>

        <section className="mb-8 grid gap-5 md:grid-cols-4">
          <Card label="Total Records" value={props.length} />
          <Card label="Filtered" value={filteredProps.length} />
          <Card label="Top Plays" value={topPlays.length} />
          <Card label="Players" value={new Set(props.map((p) => p.player)).size} />
        </section>

        <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Search Player
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Josh Hart..."
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Market
              </label>
              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                {markets.map((market) => (
                  <option key={market}>{market}</option>
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
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                {books.map((book) => (
                  <option key={book}>{book}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">
                Edge Tier
              </label>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              >
                {["All", "Elite", "Strong", "Lean", "Neutral", "Fade", "Pending"].map(
                  (tier) => (
                    <option key={tier}>{tier}</option>
                  )
                )}
              </select>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-2 text-2xl font-bold">Top Plays by Calculated Edge</h2>
          <p className="mb-5 text-zinc-400">
            Ranked using recent average versus current market line.
          </p>

          <div className="grid gap-5 md:grid-cols-5">
            {topPlays.map((prop, index) => (
              <Link
                key={prop.id}
                href={`/players/${cleanSlug(prop.player)}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-1 hover:border-emerald-500/60"
              >
                <p className="text-sm text-zinc-500">#{index + 1} Edge</p>
                <h3 className="mt-2 font-black text-white">{prop.player}</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  {prop.market} {prop.line}
                </p>

                <p className={`mt-4 text-2xl font-black ${getEdgeColor(prop.calculatedEdge)}`}>
                  {prop.calculatedEdge !== null
                    ? `${prop.calculatedEdge > 0 ? "+" : ""}${prop.calculatedEdge.toFixed(1)}%`
                    : "-"}
                </p>

                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getBadgeStyle(
                    prop.calculatedEdge
                  )}`}
                >
                  {prop.tier}
                </span>

                <p className="mt-3 text-xs text-zinc-500">
                  Hit Rate: {prop.hits}/{prop.total} ({prop.hitRate}%)
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="text-2xl font-bold">Full Props Edge Table</h2>
            <p className="mt-1 text-zinc-400">
              Sorted from strongest calculated edge to weakest.
            </p>
          </div>

          <div className="max-h-[760px] overflow-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="sticky top-0 z-20 bg-zinc-950 text-zinc-400 shadow-lg shadow-black/30">
                <tr>
                  <th className="p-4 text-left">Player</th>
                  <th className="p-4 text-center">Matchup</th>
                  <th className="p-4 text-center">Market</th>
                  <th className="p-4 text-center">Line</th>
                  <th className="p-4 text-center">Odds</th>
                  <th className="p-4 text-center">Book</th>
                  <th className="p-4 text-center">Recent Avg</th>
                  <th className="p-4 text-center">Hit Rate</th>
                  <th className="p-4 text-center">Calc Edge</th>
                  <th className="p-4 text-center">Tier</th>
                </tr>
              </thead>

              <tbody>
                {filteredProps.map((prop, index) => (
                  <tr
                    key={prop.id}
                    className={`border-t border-zinc-800 transition hover:bg-blue-500/10 ${
                      index % 2 === 0 ? "bg-zinc-900" : "bg-zinc-950/40"
                    }`}
                  >
                    <td className="p-4 font-bold">
                      <Link
                        href={`/players/${cleanSlug(prop.player)}`}
                        className="hover:text-blue-400"
                      >
                        {prop.player}
                      </Link>
                    </td>

                    <td className="p-4 text-center text-zinc-400">
                      {prop.matchup}
                    </td>

                    <td className="p-4 text-center">{prop.market}</td>

                    <td className="p-4 text-center font-bold">{prop.line}</td>

                    <td className="p-4 text-center font-bold text-blue-400">
                      {formatOdds(prop.odds)}
                    </td>

                    <td className="p-4 text-center text-zinc-400">{prop.book}</td>

                    <td className="p-4 text-center font-bold">
                      {prop.recentAvg}
                    </td>

                    <td className="p-4 text-center text-zinc-300">
                      {prop.hits}/{prop.total} ({prop.hitRate}%)
                    </td>

                    <td
                      className={`p-4 text-center font-black ${getEdgeColor(
                        prop.calculatedEdge
                      )}`}
                    >
                      {prop.calculatedEdge !== null
                        ? `${prop.calculatedEdge > 0 ? "+" : ""}${prop.calculatedEdge.toFixed(1)}%`
                        : "-"}
                    </td>

                    <td className="p-4 text-center">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getBadgeStyle(
                          prop.calculatedEdge
                        )}`}
                      >
                        {prop.tier}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredProps.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-zinc-400">
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

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-zinc-400">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
    </div>
  );
}