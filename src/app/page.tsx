"use client";

import Link from "next/link";
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

type Signal = {
  player: string;
  team: string;
  market: string;
  line: number;
  game: string;
  odds: number;
  edge: number;
  confidence: number;
  note: string;
  headshot: string;
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

const signals: Signal[] = [
  {
    player: "Luka Doncic",
    team: "LAL",
    market: "PRA",
    line: 45.5,
    game: "Warriors @ Lakers",
    odds: -110,
    edge: 14.6,
    confidence: 100,
    note: "elite environment + fast pace + high total",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/1629029.png",
  },
  {
    player: "Stephen Curry",
    team: "GSW",
    market: "Points",
    line: 24.5,
    game: "Warriors @ Lakers",
    odds: -110,
    edge: 8.6,
    confidence: 100,
    note: "elite environment + fast pace + high total",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/201939.png",
  },
  {
    player: "LeBron James",
    team: "LAL",
    market: "Assists",
    line: 7.5,
    game: "Warriors @ Lakers",
    odds: -105,
    edge: 6.8,
    confidence: 100,
    note: "elite environment + fast pace + high total",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/2544.png",
  },
  {
    player: "Karl-Anthony Towns",
    team: "NYK",
    market: "Rebounds",
    line: 8.5,
    game: "Knicks @ Celtics",
    odds: -105,
    edge: 6.8,
    confidence: 100,
    note: "strong environment + rebound path",
    headshot: "https://cdn.nba.com/headshots/nba/latest/260x190/1626157.png",
  },
];

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

function getGrade(environment: number | null) {
  if (!environment) return "Pending";
  if (environment >= 9) return "Elite";
  if (environment >= 8) return "Strong";
  if (environment >= 7) return "Playable";
  return "Neutral";
}

function streakCount(
  logs: PlayerStat[],
  stat: "points" | "rebounds" | "assists",
  threshold: number
) {
  const hit = logs.filter((log) => (log[stat] ?? 0) >= threshold).length;
  const total = logs.length;
  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;

  return { hit, total, pct };
}

function getPlayerStreakLeaders(
  stats: PlayerStat[],
  stat: "points" | "rebounds" | "assists",
  threshold: number
) {
  const grouped = new Map<string, PlayerStat[]>();

  for (const row of stats) {
    const current = grouped.get(row.player) ?? [];
    current.push(row);
    grouped.set(row.player, current);
  }

  return Array.from(grouped.entries())
    .map(([player, logs]) => {
      const recent = logs
        .sort(
          (a, b) =>
            new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
        )
        .slice(0, 10);

      const result = streakCount(recent, stat, threshold);

      return {
        player,
        team: recent[0]?.team ?? "NBA",
        ...result,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.pct - a.pct || b.hit - a.hit)
    .slice(0, 5);
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const { data: gameData } = await supabase
      .from("games")
      .select("*")
      .order("game_time", { ascending: true });

    const { data: statData } = await supabase
      .from("player_stats")
      .select("*")
      .order("game_date", { ascending: false });

    setGames((gameData as Game[]) || []);
    setStats((statData as PlayerStat[]) || []);
    setLoading(false);
  }

  const strongest = signals.filter((s) => s.edge >= 10);
  const positive = signals.filter((s) => s.edge >= 5 && s.edge < 10);

  const leaderGroups = useMemo(() => {
    return [
      { title: "25+ Points", leaders: getPlayerStreakLeaders(stats, "points", 25) },
      { title: "20+ Points", leaders: getPlayerStreakLeaders(stats, "points", 20) },
      { title: "10+ Rebounds", leaders: getPlayerStreakLeaders(stats, "rebounds", 10) },
      { title: "8+ Rebounds", leaders: getPlayerStreakLeaders(stats, "rebounds", 8) },
      { title: "6+ Rebounds", leaders: getPlayerStreakLeaders(stats, "rebounds", 6) },
      { title: "10+ Assists", leaders: getPlayerStreakLeaders(stats, "assists", 10) },
      { title: "8+ Assists", leaders: getPlayerStreakLeaders(stats, "assists", 8) },
      { title: "6+ Assists", leaders: getPlayerStreakLeaders(stats, "assists", 6) },
    ];
  }, [stats]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050607] p-8 text-white">
        Loading HoopEdge...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050607] px-6 py-8 text-white lg:px-8">
      <section className="mx-auto grid max-w-[1500px] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <h1 className="text-4xl font-black tracking-tight">Today’s Slate</h1>
          <p className="mt-2 text-zinc-400">
            Live NBA matchup intelligence, projection signals, and model-driven edges.
          </p>

          <section className="mt-8 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {games.map((game) => {
              const awayLogo = TEAM_LOGOS[game.away_team];
              const homeLogo = TEAM_LOGOS[game.home_team];

              return (
                <Link
                  key={game.id}
                  href={`/game/${game.id}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-1 hover:border-emerald-500/60"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {awayLogo && (
                        <img
                          src={awayLogo}
                          alt={game.away_team}
                          className="h-7 w-7 object-contain"
                        />
                      )}
                      {homeLogo && (
                        <img
                          src={homeLogo}
                          alt={game.home_team}
                          className="h-7 w-7 object-contain"
                        />
                      )}
                    </div>

                    <p className="text-sm text-zinc-300">
                      {formatTime(game.game_time)}
                    </p>
                  </div>

                  <h2 className="font-black">
                    {game.away_team} @ {game.home_team}
                  </h2>

                  <p className="mt-3 font-bold">
                    {game.projected_total ?? "-"} total
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    Pace: {game.pace ?? "Pending"}
                  </p>

                  <p className="text-sm font-bold text-emerald-400">
                    Environment: {game.environment ?? "-"} •{" "}
                    {getGrade(game.environment)}
                  </p>

                  <div className="mt-4 h-2 rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-emerald-400"
                      style={{
                        width: `${Math.min((game.environment ?? 0) * 10, 100)}%`,
                      }}
                    />
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="mt-12">
            <h2 className="mb-5 font-bold text-emerald-400">
              Strongest Signals (10%+)
            </h2>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {strongest.map((signal) => (
                <SignalCard key={signal.player} signal={signal} />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="mb-5 font-bold text-yellow-400">
              Positive Signals (5–10%)
            </h2>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {positive.map((signal) => (
                <SignalCard key={signal.player} signal={signal} />
              ))}
            </div>
          </section>
        </div>

        <aside className="w-full rounded-2xl border border-orange-500/80 bg-zinc-950 shadow-2xl shadow-orange-950/20 xl:sticky xl:top-8">
          <div className="border-b border-zinc-800 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
              Player Trends
            </p>

            <h2 className="mt-1 text-2xl font-black">Streak Leaders</h2>

            <p className="mt-2 text-sm leading-5 text-zinc-400">
              Top recent hit-rate leaders by stat threshold.
            </p>
          </div>

          <div className="max-h-[680px] space-y-4 overflow-y-auto p-4">
            {leaderGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-black">{group.title}</h3>

                  <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                    Top 5
                  </span>
                </div>

                <div className="space-y-2">
                  {group.leaders.map((leader, index) => (
                    <Link
                      key={`${group.title}-${leader.player}`}
                      href={`/players/${cleanSlug(leader.player)}`}
                      className="block rounded-lg p-2 transition hover:bg-emerald-500/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">
                            {index + 1}. {leader.player}
                          </p>
                          <p className="text-xs text-zinc-500">{leader.team}</p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black">
                            {leader.hit}/{leader.total}
                          </p>
                          <p className="text-xs font-bold text-emerald-400">
                            {leader.pct}%
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {group.leaders.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      No data available yet.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <Link
      href={`/players/${cleanSlug(signal.player)}`}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:-translate-y-1 hover:border-blue-500/60"
    >
      <div className="flex justify-between gap-4">
        <div>
          <h3 className="font-black">{signal.player}</h3>
          <p className="mt-2 text-sm text-zinc-400">
            {signal.team} • {signal.market} {signal.line}
          </p>
          <p className="mt-1 text-sm text-zinc-500">{signal.game}</p>
        </div>

        <img
          src={signal.headshot}
          alt={signal.player}
          className="h-16 w-16 rounded-full object-cover object-top"
        />
      </div>

      <p className="mt-4 text-sm text-blue-400">Odds: {signal.odds}</p>

      <p className="mt-2 font-black text-emerald-400">
        +{signal.edge}% Edge
      </p>

      <p className="mt-2 text-sm text-zinc-300">
        Confidence: {signal.confidence}
      </p>

      <p className="mt-3 text-sm leading-5 text-zinc-300">{signal.note}</p>
    </Link>
  );
}