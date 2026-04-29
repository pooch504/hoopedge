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
  favorite_team?: string | null;
  spread?: number | null;
  league?: string | null;
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
  league?: string | null;
};

type Prop = {
  id?: string;
  player: string;
  team: string | null;
  market: string;
  line: number | null;
  edge: number | null;
  confidence?: number | null;
  hit_rate?: number | null;
  note?: string | null;
  league?: string | null;
  game_id?: string | null;
};

type RankedSignal = Prop & {
  score: number;
  hit_rate: number;
  edge: number;
  confidence: number;
};

const TEAM_LOGOS: Record<string, string> = {
  "Atlanta Hawks": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
  "Boston Celtics": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
  "Brooklyn Nets": "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
  "Charlotte Hornets": "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
  "Chicago Bulls": "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
  "Cleveland Cavaliers": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
  "Dallas Mavericks": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
  "Denver Nuggets": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
  "Detroit Pistons": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
  "Golden State Warriors": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
  "Houston Rockets": "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
  "Indiana Pacers": "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg",
  "LA Clippers": "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
  "Los Angeles Clippers": "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
  "Los Angeles Lakers": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
  "Memphis Grizzlies": "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
  "Miami Heat": "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
  "Milwaukee Bucks": "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
  "Minnesota Timberwolves": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
  "New Orleans Pelicans": "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
  "New York Knicks": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
  "Oklahoma City Thunder": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
  "Orlando Magic": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
  "Philadelphia 76ers": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
  "Phoenix Suns": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
  "Portland Trail Blazers": "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
  "Sacramento Kings": "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
  "San Antonio Spurs": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
  "Toronto Raptors": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
  "Utah Jazz": "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
  "Washington Wizards": "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg",
  "Las Vegas Aces": "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png",
  "New York Liberty": "https://a.espncdn.com/i/teamlogos/wnba/500/ny.png",
  "Indiana Fever": "https://a.espncdn.com/i/teamlogos/wnba/500/ind.png",
  "Phoenix Mercury": "https://a.espncdn.com/i/teamlogos/wnba/500/phx.png",
  "Seattle Storm": "https://a.espncdn.com/i/teamlogos/wnba/500/sea.png",
  "Chicago Sky": "https://a.espncdn.com/i/teamlogos/wnba/500/chi.png",
};

function normalizeName(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(".", "").replaceAll("'", "").replaceAll("’", "").replaceAll(",", "").trim();
}

function cleanSlug(text: string) {
  return normalizeName(text).replaceAll(" ", "-");
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBD";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatNumber(value: number | null | undefined, fallback = "—") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return fallback;
  return Number(value).toFixed(1);
}

function getGrade(environment: number | null) {
  if (environment === null || environment === undefined) return "N/A";
  if (environment >= 9) return "Elite";
  if (environment >= 8) return "Strong";
  if (environment >= 7) return "Playable";
  return "Neutral";
}

function getDisplayPace(game: Game) {
  if (game.pace !== null && game.pace !== undefined) return game.pace.toFixed(1);
  if (game.environment !== null && game.environment !== undefined) return (96 + game.environment * 0.8).toFixed(1);
  return "N/A";
}

function getProjectionSplit(game: Game) {
  if (game.projected_total == null || game.spread == null || !game.favorite_team) return null;

  const total = Number(game.projected_total);
  const edge = Math.abs(Number(game.spread));
  const favoriteTotal = total / 2 + edge / 2;
  const underdogTotal = total / 2 - edge / 2;

  if (game.favorite_team === game.home_team) {
    return { homeProjection: favoriteTotal, awayProjection: underdogTotal };
  }

  if (game.favorite_team === game.away_team) {
    return { homeProjection: underdogTotal, awayProjection: favoriteTotal };
  }

  return null;
}

function getStatKeyFromMarket(market: string) {
  const text = market.toLowerCase();

  if (text.includes("point") || text === "pts") return "points";
  if (text.includes("rebound") || text === "reb") return "rebounds";
  if (text.includes("assist") || text === "ast") return "assists";
  if (text.includes("three") || text.includes("3pt") || text.includes("3-p") || text.includes("threes")) return "threes";

  return null;
}

function calculateHitRate(signal: Prop, stats: PlayerStat[]) {
  if (!signal.player || signal.line == null || !signal.market) return Number(signal.hit_rate ?? 0);

  const statKey = getStatKeyFromMarket(signal.market);
  if (!statKey) return Number(signal.hit_rate ?? 0);

  const playerName = normalizeName(signal.player);

  const logs = stats
    .filter((row) => normalizeName(row.player) === playerName)
    .sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime())
    .slice(0, 10);

  if (logs.length === 0) return Number(signal.hit_rate ?? 0);

  const hits = logs.filter((log) => Number(log[statKey] ?? 0) >= Number(signal.line)).length;

  return Math.round((hits / logs.length) * 100);
}

function streakCount(logs: PlayerStat[], stat: "points" | "rebounds" | "assists", threshold: number) {
  const hit = logs.filter((log) => (log[stat] ?? 0) >= threshold).length;
  const total = logs.length;
  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;

  return { hit, total, pct };
}

function getPlayerStreakLeaders(stats: PlayerStat[], stat: "points" | "rebounds" | "assists", threshold: number) {
  const grouped = new Map<string, PlayerStat[]>();

  for (const row of stats) {
    const current = grouped.get(row.player) ?? [];
    current.push(row);
    grouped.set(row.player, current);
  }

  return Array.from(grouped.entries())
    .map(([player, logs]) => {
      const recent = logs.sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime()).slice(0, 10);
      const result = streakCount(recent, stat, threshold);

      return {
        player,
        team: recent[0]?.team ?? "HOOPS",
        ...result,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.pct - a.pct || b.hit - a.hit)
    .slice(0, 5);
}

function getHoopEdgeScore(signal: Pick<Prop, "edge" | "hit_rate" | "confidence">) {
  const edge = Number(signal.edge ?? 0);
  const hitRate = Number(signal.hit_rate ?? 0);
  const confidence = Number(signal.confidence ?? 0);

  return edge * 0.5 + hitRate * 0.3 + confidence * 0.2;
}

function rankSignals(props: Prop[], stats: PlayerStat[], limit = 3): RankedSignal[] {
  return [...props]
    .filter((signal) => signal.player && signal.market)
    .map((signal) => {
      const hitRate = calculateHitRate(signal, stats);

      const upgradedSignal = {
        ...signal,
        edge: Number(signal.edge ?? 0),
        hit_rate: hitRate,
        confidence: Number(signal.confidence ?? 0),
      };

      return {
        ...upgradedSignal,
        score: getHoopEdgeScore(upgradedSignal),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function uniqueByMatchup(games: Game[]) {
  const seen = new Set<string>();

  return games.filter((game) => {
    const key = [game.away_team, game.home_team, game.league ?? "NBA"].join("-").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const { data: gameData } = await supabase
      .from("games")
      .select("*")
      .gte("game_time", today.toISOString())
      .lt("game_time", tomorrow.toISOString())
      .order("game_time", { ascending: true });

    const { data: statData } = await supabase
      .from("player_stats")
      .select("*")
      .order("game_date", { ascending: false });

    const { data: propData, error: propError } = await supabase
      .from("props")
      .select("*")
      .order("updated_at", { ascending: false });

    if (propError) console.error("Signals load error:", propError);

    setGames((gameData as Game[]) || []);
    setStats((statData as PlayerStat[]) || []);
    setProps((propData as Prop[]) || []);
    setLoading(false);
  }

  const nbaProps = useMemo(() => props.filter((p) => (p.league ?? "NBA") === "NBA"), [props]);
  const wnbaProps = useMemo(() => props.filter((p) => p.league === "WNBA"), [props]);
  const nbaStats = useMemo(() => stats.filter((s) => (s.league ?? "NBA") === "NBA"), [stats]);
  const wnbaStats = useMemo(() => stats.filter((s) => s.league === "WNBA"), [stats]);

  const nbaGames = useMemo(() => uniqueByMatchup(games.filter((game) => (game.league ?? "NBA") === "NBA")), [games]);
  const wnbaGames = useMemo(() => uniqueByMatchup(games.filter((game) => game.league === "WNBA")), [games]);

  const overallTopSignals = useMemo<RankedSignal[]>(() => rankSignals(props, stats, 3), [props, stats]);
  const nbaTopSignals = useMemo<RankedSignal[]>(() => rankSignals(nbaProps, nbaStats, 3), [nbaProps, nbaStats]);
  const wnbaTopSignals = useMemo<RankedSignal[]>(() => rankSignals(wnbaProps, wnbaStats, 3), [wnbaProps, wnbaStats]);

  const nbaLeaderGroups = useMemo(() => {
    return [
      { title: "25+ Points", leaders: getPlayerStreakLeaders(nbaStats, "points", 25) },
      { title: "20+ Points", leaders: getPlayerStreakLeaders(nbaStats, "points", 20) },
    ];
  }, [nbaStats]);

  const wnbaLeaderGroups = useMemo(() => {
    return [
      { title: "20+ Points", leaders: getPlayerStreakLeaders(wnbaStats, "points", 20) },
      { title: "8+ Rebounds", leaders: getPlayerStreakLeaders(wnbaStats, "rebounds", 8) },
    ];
  }, [wnbaStats]);

  if (loading) {
    return <main className="min-h-screen bg-[#050607] p-8 text-white">Loading HoopEdge...</main>;
  }

  return (
    <main className="min-h-screen bg-[#050607] px-6 py-8 text-white lg:px-8">
      <section className="mx-auto grid max-w-[1800px] items-start gap-8 xl:grid-cols-[340px_minmax(0,1fr)_360px] 2xl:grid-cols-[380px_minmax(0,1fr)_400px]">
        <div className="space-y-6 xl:sticky xl:top-8">
          <SignalPanel title="🔥 Overall Top 3 Signals" subtitle="Best model signals across NBA and WNBA by HoopEdge Score." signals={overallTopSignals} variant="overall" />
          <SignalPanel title="🏀 NBA Top Signals" subtitle="Ranked by model edge, last-10 hit rate, and confidence." signals={nbaTopSignals} variant="nba" />
          <SignalPanel title="🧡 WNBA Top Signals" subtitle="Women’s hoops signals ranked with the same analytics model." signals={wnbaTopSignals} variant="wnba" />
        </div>

        <div className="min-w-0">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-emerald-400">HoopEdge</p>
            <h1 className="mt-2 text-5xl font-black tracking-tight">Today’s Slate</h1>
            <p className="mt-3 text-lg text-zinc-400">
              Live matchup intelligence, projection signals, player trends, and internal model grades across hoops.
            </p>
          </div>

          <SlateSection title="NBA Slate" games={nbaGames} variant="nba" />
          <SlateSection title="WNBA Slate" games={wnbaGames} variant="wnba" />
        </div>

        <div className="space-y-6 xl:sticky xl:top-8">
          <StreakPanel title="NBA Streak Leaders" subtitle="Top recent NBA hit-rate leaders by stat threshold." groups={nbaLeaderGroups} variant="nba" />
          <StreakPanel title="WNBA Streak Leaders" subtitle="Women’s hoops trend board with orange-pastel styling." groups={wnbaLeaderGroups} variant="wnba" />
        </div>
      </section>
    </main>
  );
}

function SlateSection({ title, games, variant }: { title: string; games: Game[]; variant: "nba" | "wnba" }) {
  const isWnba = variant === "wnba";

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`text-xl font-black ${isWnba ? "text-orange-300" : "text-emerald-400"}`}>{title}</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${isWnba ? "border-orange-300/40 bg-orange-300/10 text-orange-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
          {games.length} Games
        </span>
      </div>

      {games.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {games.map((game) => <GameCard key={game.id} game={game} isWnba={isWnba} />)}
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-500">
          No {title} games loaded for today.
        </div>
      )}
    </section>
  );
}

function GameCard({ game, isWnba = false }: { game: Game; isWnba?: boolean }) {
  const awayLogo = TEAM_LOGOS[game.away_team];
  const homeLogo = TEAM_LOGOS[game.home_team];
  const projectionSplit = getProjectionSplit(game);
  const hasProjectedEdge = game.favorite_team && game.spread != null;

  return (
    <Link href={`/game/${game.id}`} className={`group rounded-3xl border bg-zinc-900/80 p-6 shadow-xl transition duration-300 hover:-translate-y-1 hover:bg-zinc-900 ${isWnba ? "border-zinc-800 hover:border-orange-300/70 hover:shadow-orange-500/10" : "border-zinc-800 hover:border-emerald-500 hover:shadow-emerald-950/30"}`}>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {awayLogo ? <img src={awayLogo} alt={game.away_team} className="h-8 w-8 object-contain transition group-hover:scale-110" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-black">{initials(game.away_team)}</div>}
          {homeLogo ? <img src={homeLogo} alt={game.home_team} className="h-8 w-8 object-contain transition group-hover:scale-110" /> : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-black">{initials(game.home_team)}</div>}
        </div>

        <p className="text-sm font-bold text-zinc-300">{formatTime(game.game_time)}</p>
      </div>

      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${isWnba ? "bg-orange-300/15 text-orange-200" : "bg-emerald-500/15 text-emerald-300"}`}>
        {isWnba ? "WNBA" : "NBA"}
      </span>

      <h2 className="mt-3 text-xl font-black leading-tight">{game.away_team} @ {game.home_team}</h2>

      <p className="mt-4 text-2xl font-black">{formatNumber(game.projected_total)} projected total</p>

      <p className="mt-3 text-base text-zinc-400">
        Pace Factor: <span className="font-bold text-zinc-200">{getDisplayPace(game)}</span>
      </p>

      <p className={`text-base font-black ${isWnba ? "text-orange-300" : "text-emerald-400"}`}>
        Environment Grade: {formatNumber(game.environment)} • {getGrade(game.environment)}
      </p>

      {(hasProjectedEdge || projectionSplit) && (
        <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/30 p-4">
          {hasProjectedEdge && (
            <p className="text-base font-black text-zinc-100">
              Projected Edge: {game.favorite_team} by {Math.abs(Number(game.spread)).toFixed(1)}
            </p>
          )}

          {projectionSplit && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-500">Away Projection</p>
                <p className="text-lg font-black text-white">{projectionSplit.awayProjection.toFixed(1)}</p>
              </div>

              <div>
                <p className="text-zinc-500">Home Projection</p>
                <p className="text-lg font-black text-white">{projectionSplit.homeProjection.toFixed(1)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 h-2 rounded-full bg-zinc-800">
        <div className={`h-2 rounded-full transition-all ${isWnba ? "bg-orange-300" : "bg-emerald-400"}`} style={{ width: `${Math.min((game.environment ?? 0) * 10, 100)}%` }} />
      </div>

      <p className={`mt-4 text-sm font-bold opacity-0 transition group-hover:opacity-100 ${isWnba ? "text-orange-300" : "text-emerald-400"}`}>
        View matchup breakdown →
      </p>
    </Link>
  );
}

function SignalPanel({ title, subtitle, signals, variant }: { title: string; subtitle: string; signals: RankedSignal[]; variant: "overall" | "nba" | "wnba" }) {
  const isWnba = variant === "wnba";
  const isOverall = variant === "overall";

  const borderStyle = isOverall ? "border border-cyan-400/70 shadow-cyan-950/20" : isWnba ? "border border-orange-300/80 shadow-orange-500/10" : "border border-emerald-500/80 shadow-emerald-950/20";
  const accentText = isOverall ? "text-cyan-300" : isWnba ? "text-orange-300" : "text-emerald-400";

  return (
    <aside className={`w-full rounded-3xl bg-zinc-950 shadow-2xl ${borderStyle}`}>
      <div className="border-b border-zinc-800 p-5">
        <p className={`text-xs font-bold uppercase tracking-wide ${accentText}`}>Auto-Ranked</p>
        <h2 className="mt-1 text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm leading-5 text-zinc-400">{subtitle}</p>
      </div>

      <div className="space-y-4 p-4">
        {signals.length > 0 ? (
          signals.map((signal, index) => {
            const signalIsWnba = signal.league === "WNBA";

            return (
              <Link key={`${signal.player}-${signal.market}-${index}`} href={signal.game_id ? `/game/${signal.game_id}` : "#"} className={`block rounded-2xl border bg-zinc-900/90 p-4 transition hover:-translate-y-1 hover:bg-zinc-900 ${signalIsWnba ? "border-orange-200/20 hover:border-orange-300/70" : "border-zinc-800 hover:border-emerald-500/60"}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${signalIsWnba ? "bg-orange-300/20 text-orange-200" : "bg-emerald-500/20 text-emerald-400"}`}>#{index + 1}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${signalIsWnba ? "bg-orange-300/15 text-orange-200" : "bg-emerald-500/15 text-emerald-300"}`}>{signal.league || "NBA"}</span>
                </div>

                <h3 className="text-lg font-black">{signal.player}</h3>

                <p className="mt-1 text-sm text-zinc-400">
                  {signal.team || "HOOPS"} • {signal.market} {signal.line ?? "—"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <MiniStat label="Model Edge" value={`${formatNumber(signal.edge)}%`} accent={signalIsWnba ? "text-orange-200" : "text-emerald-400"} />
                  <MiniStat label="Hit Rate" value={`${formatNumber(signal.hit_rate)}%`} accent={signalIsWnba ? "text-orange-200" : "text-emerald-400"} />
                  <MiniStat label="Confidence" value={`${formatNumber(signal.confidence)}%`} />
                  <MiniStat label="Signal Score" value={signal.score.toFixed(1)} accent={signalIsWnba ? "text-orange-200" : "text-emerald-400"} />
                </div>

                {signal.note && <p className="mt-3 text-sm leading-5 text-zinc-400">{signal.note}</p>}
              </Link>
            );
          })
        ) : (
          <p className="text-sm text-zinc-500">No signals available yet.</p>
        )}
      </div>
    </aside>
  );
}

function MiniStat({ label, value, accent = "text-white" }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className={`font-black ${accent}`}>{value}</p>
    </div>
  );
}

function StreakPanel({
  title,
  subtitle,
  groups,
  variant,
}: {
  title: string;
  subtitle: string;
  groups: {
    title: string;
    leaders: {
      player: string;
      team: string;
      hit: number;
      total: number;
      pct: number;
    }[];
  }[];
  variant: "nba" | "wnba";
}) {
  const isWnba = variant === "wnba";

  return (
    <aside className={`w-full rounded-3xl bg-zinc-950 shadow-2xl ${isWnba ? "border border-orange-300/80 shadow-orange-500/10" : "border border-orange-500/80 shadow-orange-950/20"}`}>
      <div className="border-b border-zinc-800 p-5">
        <p className={`text-xs font-bold uppercase tracking-wide ${isWnba ? "text-orange-300" : "text-emerald-400"}`}>Player Trends</p>
        <h2 className="mt-1 text-2xl font-black">{title}</h2>
        <p className="mt-2 text-sm leading-5 text-zinc-400">{subtitle}</p>
      </div>

      <div className="max-h-[420px] space-y-4 overflow-y-auto p-4">
        {groups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-black">{group.title}</h3>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${isWnba ? "border-orange-300/40 bg-orange-300/10 text-orange-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>Top 5</span>
            </div>

            <div className="space-y-2">
              {group.leaders.map((leader, index) => (
                <Link key={`${group.title}-${leader.player}`} href={`/players/${cleanSlug(leader.player)}`} className={`block rounded-xl p-2 transition ${isWnba ? "hover:bg-orange-300/10" : "hover:bg-emerald-500/10"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{index + 1}. {leader.player}</p>
                      <p className="text-xs text-zinc-500">{leader.team}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black">{leader.hit}/{leader.total}</p>
                      <p className={`text-xs font-bold ${isWnba ? "text-orange-200" : "text-emerald-400"}`}>{leader.pct}%</p>
                    </div>
                  </div>
                </Link>
              ))}

              {group.leaders.length === 0 && <p className="text-sm text-zinc-500">No data available yet.</p>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}