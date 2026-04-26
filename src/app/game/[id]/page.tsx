"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type Game = {
  id: string;
  away_team: string;
  home_team: string;
  game_time: string;
  projected_total: number | null;
  pace: number | null;
  environment: number | null;
};

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

const TEAM_LOGOS: Record<string, string> = {
  "Detroit Pistons": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
  "Orlando Magic": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
  "Oklahoma City Thunder": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
  "Phoenix Suns": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
  "New York Knicks": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
  "Atlanta Hawks": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
  "Denver Nuggets": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
  "Minnesota Timberwolves": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
  "Cleveland Cavaliers": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
  "Toronto Raptors": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
  "San Antonio Spurs": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
  "Portland Trail Blazers": "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
  "Boston Celtics": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
  "Philadelphia 76ers": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
  "Los Angeles Lakers": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
  "Houston Rockets": "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
};

const TEAM_SHORT: Record<string, string> = {
  "New York Knicks": "NYK",
  "Los Angeles Lakers": "LAL",
  "Boston Celtics": "BOS",
  "Golden State Warriors": "GSW",
  "Atlanta Hawks": "ATL",
  "Detroit Pistons": "DET",
  "Orlando Magic": "ORL",
  "Oklahoma City Thunder": "OKC",
  "Phoenix Suns": "PHX",
  "Denver Nuggets": "DEN",
  "Minnesota Timberwolves": "MIN",
  "Cleveland Cavaliers": "CLE",
  "Toronto Raptors": "TOR",
  "San Antonio Spurs": "SAS",
  "Portland Trail Blazers": "POR",
  "Philadelphia 76ers": "PHI",
  "Houston Rockets": "HOU",
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

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function getGrade(environment: number | null) {
  if (!environment) return "Pending";
  if (environment >= 9) return "Elite";
  if (environment >= 8) return "Strong";
  if (environment >= 7) return "Playable";
  return "Neutral";
}

function getGradeColor(environment: number | null) {
  if (!environment) return "text-zinc-400";
  if (environment >= 9) return "text-emerald-400";
  if (environment >= 8) return "text-green-400";
  if (environment >= 7) return "text-blue-400";
  return "text-zinc-400";
}

function getStat(log: PlayerStat, market: string) {
  const m = market.toLowerCase();

  if (m.includes("pra")) {
    return (log.points ?? 0) + (log.rebounds ?? 0) + (log.assists ?? 0);
  }

  if (m.includes("point")) return log.points ?? 0;
  if (m.includes("rebound")) return log.rebounds ?? 0;
  if (m.includes("assist")) return log.assists ?? 0;
  if (m.includes("3pm") || m.includes("three")) return log.threes ?? 0;

  return 0;
}

function calcEdge(avg: number, line: number) {
  if (!line || line <= 0) return null;
  return ((avg - line) / line) * 100;
}

function signalTier(edge: number | null) {
  if (edge === null) return "Pending";
  if (edge >= 50) return "Elite";
  if (edge >= 20) return "Strong";
  if (edge >= 5) return "Lean";
  if (edge > -5) return "Neutral";
  return "Fade";
}

function signalColor(edge: number | null) {
  if (edge === null) return "text-zinc-400";
  if (edge >= 50) return "text-emerald-400";
  if (edge >= 20) return "text-green-400";
  if (edge >= 5) return "text-yellow-400";
  if (edge > -5) return "text-zinc-300";
  return "text-red-400";
}

function signalBadge(edge: number | null) {
  if (edge === null) return "border-zinc-700 bg-zinc-900 text-zinc-300";
  if (edge >= 50) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (edge >= 20) return "border-green-500/40 bg-green-500/10 text-green-300";
  if (edge >= 5) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (edge > -5) return "border-zinc-700 bg-zinc-900 text-zinc-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

export default function GamePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [game, setGame] = useState<Game | null>(null);
  const [props, setProps] = useState<Prop[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGame();
  }, [id]);

  async function loadGame() {
    setLoading(true);

    const { data: gameData } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .single();

    const { data: propData } = await supabase
      .from("props")
      .select("*")
      .eq("game_id", id)
      .order("player", { ascending: true });

    const { data: statData } = await supabase
      .from("player_stats")
      .select("*")
      .order("game_date", { ascending: false });

    setGame((gameData as Game) || null);
    setProps((propData as Prop[]) || []);
    setStats((statData as PlayerStat[]) || []);
    setLoading(false);
  }

  const enrichedProps = useMemo(() => {
    return props
      .map((prop) => {
        const playerLogs = stats
          .filter((log) => cleanSlug(log.player) === cleanSlug(prop.player))
          .slice(0, 10);

        const values = playerLogs.map((log) => getStat(log, prop.market));
        const avg =
          values.length > 0
            ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
            : 0;

        const hits = values.filter((value) => value >= prop.line).length;
        const pct = values.length ? Math.round((hits / values.length) * 100) : 0;
        const calculatedEdge = calcEdge(avg, prop.line);

        return {
          ...prop,
          recentAvg: avg,
          hits,
          total: values.length,
          pct,
          calculatedEdge,
        };
      })
      .sort((a, b) => (b.calculatedEdge ?? -999) - (a.calculatedEdge ?? -999));
  }, [props, stats]);

  const topSignals = enrichedProps.slice(0, 5);

  const bestScoring = enrichedProps.find((p) =>
    p.market.toLowerCase().includes("point")
  );

  const bestRebounding = enrichedProps.find((p) =>
    p.market.toLowerCase().includes("rebound")
  );

  const bestAssisting = enrichedProps.find((p) =>
    p.market.toLowerCase().includes("assist")
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] p-8 text-white">
        Loading game intelligence...
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-[#050607] p-8 text-white">
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          ← Back to Today’s Slate
        </Link>
        <h1 className="mt-6 text-3xl font-black">Game not found</h1>
      </main>
    );
  }

  const awayLogo = TEAM_LOGOS[game.away_team];
  const homeLogo = TEAM_LOGOS[game.home_team];

  return (
    <main className="min-h-screen bg-[#050607] px-8 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          ← Back to Today’s Slate
        </Link>

        <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {awayLogo && (
                <img
                  src={awayLogo}
                  alt={game.away_team}
                  className="h-16 w-16 object-contain"
                />
              )}

              <div>
                <p className="text-sm text-zinc-400">
                  {formatTime(game.game_time)} • Game Intelligence
                </p>

                <h1 className="mt-1 text-4xl font-black tracking-tight">
                  {game.away_team} @ {game.home_team}
                </h1>

                <p className="mt-2 text-zinc-400">
                  Matchup context, player trends, performance signals, and market comparison.
                </p>
              </div>

              {homeLogo && (
                <img
                  src={homeLogo}
                  alt={game.home_team}
                  className="h-16 w-16 object-contain"
                />
              )}
            </div>

            <div className="rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-bold">
              Grade:{" "}
              <span className={getGradeColor(game.environment)}>
                {getGrade(game.environment)}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-4">
          <StatCard label="Projected Total" value={game.projected_total ?? "-"} />
          <StatCard label="Pace" value={game.pace ?? "Pending"} />
          <StatCard
            label="Environment"
            value={game.environment ?? "-"}
            valueClass={getGradeColor(game.environment)}
          />
          <StatCard label="Live Props" value={props.length} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-blue-500/40 bg-blue-500/10">
          <div className="border-b border-blue-500/20 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-300">
              Game Intelligence Engine
            </p>
            <h2 className="mt-1 text-2xl font-black">Environment Read</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-300">
              This game currently grades as{" "}
              <span className={`font-bold ${getGradeColor(game.environment)}`}>
                {getGrade(game.environment)}
              </span>{" "}
              with a projected total of{" "}
              <span className="font-bold text-white">
                {game.projected_total ?? "pending"}
              </span>
              . Use this page as a matchup hub before digging into individual player pages.
            </p>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-3">
            <MeterCard
              label="Scoring Environment"
              value={game.projected_total ?? 0}
              display={game.projected_total ?? "Pending"}
              max={240}
              note={
                (game.projected_total ?? 0) >= 225
                  ? "Scoring setup supports player production."
                  : "Lower total creates a more selective setup."
              }
            />

            <MeterCard
              label="Pace Profile"
              value={game.pace ?? 0}
              display={game.pace ?? "Pending"}
              max={105}
              note={
                (game.pace ?? 0) >= 100
                  ? "Possession volume is favorable."
                  : "Pace data pending or slower profile."
              }
            />

            <MeterCard
              label="Environment Score"
              value={(game.environment ?? 0) * 10}
              display={`${game.environment ?? "-"} / 10`}
              max={100}
              note={`${getGrade(game.environment)} matchup profile.`}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <TargetCard title="Best Scoring Signal" prop={bestScoring} />
          <TargetCard title="Best Rebound Signal" prop={bestRebounding} />
          <TargetCard title="Best Assist Signal" prop={bestAssisting} />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
          <div className="border-b border-emerald-500/20 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
              Top Game Signals
            </p>
            <h2 className="mt-1 text-2xl font-black">Player Performance Signals</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Ranked by recent average versus current line.
            </p>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-5">
            {topSignals.map((prop, index) => (
              <Link
                key={prop.id}
                href={`/players/${cleanSlug(prop.player)}`}
                className="rounded-xl border border-zinc-800 bg-black/40 p-4 transition hover:-translate-y-1 hover:border-emerald-500/60"
              >
                <p className="text-xs text-zinc-500">#{index + 1} Signal</p>

                <h3 className="mt-2 font-black">{prop.player}</h3>

                <p className="mt-2 text-sm text-zinc-400">
                  {prop.market} {prop.line}
                </p>

                <p className={`mt-3 text-xl font-black ${signalColor(prop.calculatedEdge)}`}>
                  {prop.calculatedEdge !== null
                    ? `${prop.calculatedEdge > 0 ? "+" : ""}${prop.calculatedEdge.toFixed(1)}%`
                    : "-"}
                </p>

                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${signalBadge(
                    prop.calculatedEdge
                  )}`}
                >
                  {signalTier(prop.calculatedEdge)}
                </span>

                <p className="mt-3 text-xs text-zinc-500">
                  Hit Rate: {prop.hits}/{prop.total} ({prop.pct}%)
                </p>
              </Link>
            ))}

            {topSignals.length === 0 && (
              <div className="col-span-full rounded-xl border border-zinc-800 bg-black/40 p-6 text-center text-zinc-400">
                No props found for this game yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="border-b border-zinc-800 p-5">
            <h2 className="text-xl font-black">Full Game Props Table</h2>
            <p className="mt-1 text-sm text-zinc-400">
              All live props connected to this game, sorted by performance edge.
            </p>
          </div>

          <div className="max-h-[620px] overflow-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 bg-zinc-950 text-zinc-400">
                <tr>
                  <th className="p-4 text-left">Player</th>
                  <th className="p-4 text-center">Team</th>
                  <th className="p-4 text-center">Market</th>
                  <th className="p-4 text-center">Line</th>
                  <th className="p-4 text-center">Odds</th>
                  <th className="p-4 text-center">Book</th>
                  <th className="p-4 text-center">Recent Avg</th>
                  <th className="p-4 text-center">Hit Rate</th>
                  <th className="p-4 text-center">Edge</th>
                  <th className="p-4 text-center">Tier</th>
                </tr>
              </thead>

              <tbody>
                {enrichedProps.map((prop, index) => (
                  <tr
                    key={prop.id}
                    className={`border-t border-zinc-800 transition hover:bg-emerald-500/10 ${
                      index % 2 === 0 ? "bg-zinc-900/40" : "bg-black"
                    }`}
                  >
                    <td className="p-4 text-left font-bold">
                      <Link
                        href={`/players/${cleanSlug(prop.player)}`}
                        className="hover:text-blue-400"
                      >
                        {prop.player}
                      </Link>
                    </td>
                    <td className="p-4 text-center text-zinc-300">
                      {prop.team ?? "-"}
                    </td>
                    <td className="p-4 text-center">{prop.market}</td>
                    <td className="p-4 text-center font-bold">{prop.line}</td>
                    <td className="p-4 text-center font-bold text-blue-400">
                      {formatOdds(prop.odds)}
                    </td>
                    <td className="p-4 text-center text-zinc-300">{prop.book}</td>
                    <td className="p-4 text-center font-bold">{prop.recentAvg}</td>
                    <td className="p-4 text-center text-zinc-300">
                      {prop.hits}/{prop.total} ({prop.pct}%)
                    </td>
                    <td
                      className={`p-4 text-center font-black ${signalColor(
                        prop.calculatedEdge
                      )}`}
                    >
                      {prop.calculatedEdge !== null
                        ? `${prop.calculatedEdge > 0 ? "+" : ""}${prop.calculatedEdge.toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${signalBadge(
                          prop.calculatedEdge
                        )}`}
                      >
                        {signalTier(prop.calculatedEdge)}
                      </span>
                    </td>
                  </tr>
                ))}

                {enrichedProps.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-zinc-400">
                      No live props found for this game.
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
  valueClass = "text-white",
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function MeterCard({
  label,
  value,
  display,
  max,
  note,
}: {
  label: string;
  value: number;
  display: string | number;
  max: number;
  note: string;
}) {
  const width = Math.min((value / max) * 100, 100);

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-black">{display}</p>

      <div className="mt-4 h-2 rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full bg-blue-400"
          style={{ width: `${width}%` }}
        />
      </div>

      <p className="mt-3 text-sm leading-5 text-zinc-400">{note}</p>
    </div>
  );
}

function TargetCard({
  title,
  prop,
}: {
  title: string;
  prop:
    | (Prop & {
        recentAvg: number;
        hits: number;
        total: number;
        pct: number;
        calculatedEdge: number | null;
      })
    | undefined;
}) {
  if (!prop) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-bold uppercase text-zinc-500">{title}</p>
        <p className="mt-3 text-zinc-400">No signal available yet.</p>
      </div>
    );
  }

  return (
    <Link
      href={`/players/${cleanSlug(prop.player)}`}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-1 hover:border-blue-500/60"
    >
      <p className="text-sm font-bold uppercase text-zinc-500">{title}</p>
      <h3 className="mt-3 text-xl font-black">{prop.player}</h3>
      <p className="mt-2 text-sm text-zinc-400">
        {prop.market} {prop.line}
      </p>

      <p className={`mt-4 text-2xl font-black ${signalColor(prop.calculatedEdge)}`}>
        {prop.calculatedEdge !== null
          ? `${prop.calculatedEdge > 0 ? "+" : ""}${prop.calculatedEdge.toFixed(1)}%`
          : "-"}
      </p>

      <p className="mt-2 text-sm text-zinc-400">
        Avg {prop.recentAvg} • {prop.hits}/{prop.total} hit rate
      </p>
    </Link>
  );
}