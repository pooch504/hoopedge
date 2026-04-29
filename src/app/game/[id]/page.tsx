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
  favorite_team?: string | null;
  spread?: number | null;
  home_moneyline?: number | null;
  away_moneyline?: number | null;
  home_team_total?: number | null;
  away_team_total?: number | null;
  league?: string | null;
};

type Prop = {
  id?: string;
  player: string;
  team: string | null;
  market: string;
  line: number | null;
  odds: number | null;
  edge: number | null;
  confidence?: number | null;
  hit_rate?: number | null;
  note?: string | null;
  league?: string | null;
  game_id?: string | null;
};

type RankedProp = Prop & {
  score: number;
};

const TEAM_LOGOS: Record<string, string> = {
  "Atlanta Hawks": "https://a.espncdn.com/i/teamlogos/nba/500/atl.png",
  "Boston Celtics": "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
  "Brooklyn Nets": "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png",
  "Charlotte Hornets": "https://a.espncdn.com/i/teamlogos/nba/500/cha.png",
  "Chicago Bulls": "https://a.espncdn.com/i/teamlogos/nba/500/chi.png",
  "Cleveland Cavaliers": "https://a.espncdn.com/i/teamlogos/nba/500/cle.png",
  "Dallas Mavericks": "https://a.espncdn.com/i/teamlogos/nba/500/dal.png",
  "Denver Nuggets": "https://a.espncdn.com/i/teamlogos/nba/500/den.png",
  "Detroit Pistons": "https://a.espncdn.com/i/teamlogos/nba/500/det.png",
  "Golden State Warriors": "https://a.espncdn.com/i/teamlogos/nba/500/gs.png",
  "Houston Rockets": "https://a.espncdn.com/i/teamlogos/nba/500/hou.png",
  "Indiana Pacers": "https://a.espncdn.com/i/teamlogos/nba/500/ind.png",
  "LA Clippers": "https://a.espncdn.com/i/teamlogos/nba/500/lac.png",
  "Los Angeles Clippers": "https://a.espncdn.com/i/teamlogos/nba/500/lac.png",
  "Los Angeles Lakers": "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
  "Memphis Grizzlies": "https://a.espncdn.com/i/teamlogos/nba/500/mem.png",
  "Miami Heat": "https://a.espncdn.com/i/teamlogos/nba/500/mia.png",
  "Milwaukee Bucks": "https://a.espncdn.com/i/teamlogos/nba/500/mil.png",
  "Minnesota Timberwolves": "https://a.espncdn.com/i/teamlogos/nba/500/min.png",
  "New Orleans Pelicans": "https://a.espncdn.com/i/teamlogos/nba/500/no.png",
  "New York Knicks": "https://a.espncdn.com/i/teamlogos/nba/500/ny.png",
  "Oklahoma City Thunder": "https://a.espncdn.com/i/teamlogos/nba/500/okc.png",
  "Orlando Magic": "https://a.espncdn.com/i/teamlogos/nba/500/orl.png",
  "Philadelphia 76ers": "https://a.espncdn.com/i/teamlogos/nba/500/phi.png",
  "Phoenix Suns": "https://a.espncdn.com/i/teamlogos/nba/500/phx.png",
  "Portland Trail Blazers": "https://a.espncdn.com/i/teamlogos/nba/500/por.png",
  "Sacramento Kings": "https://a.espncdn.com/i/teamlogos/nba/500/sac.png",
  "San Antonio Spurs": "https://a.espncdn.com/i/teamlogos/nba/500/sa.png",
  "Toronto Raptors": "https://a.espncdn.com/i/teamlogos/nba/500/tor.png",
  "Utah Jazz": "https://a.espncdn.com/i/teamlogos/nba/500/utah.png",
  "Washington Wizards": "https://a.espncdn.com/i/teamlogos/nba/500/wsh.png",

  "Las Vegas Aces": "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png",
  "New York Liberty": "https://a.espncdn.com/i/teamlogos/wnba/500/ny.png",
  "Indiana Fever": "https://a.espncdn.com/i/teamlogos/wnba/500/ind.png",
  "Phoenix Mercury": "https://a.espncdn.com/i/teamlogos/wnba/500/phx.png",
  "Seattle Storm": "https://a.espncdn.com/i/teamlogos/wnba/500/sea.png",
  "Chicago Sky": "https://a.espncdn.com/i/teamlogos/wnba/500/chi.png",
};

const TEAM_MAP: Record<string, string> = {
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "LA Clippers": "LAC",
  "Los Angeles Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",

  "Las Vegas Aces": "LVA",
  "New York Liberty": "NYL",
  "Indiana Fever": "IND",
  "Phoenix Mercury": "PHX",
  "Seattle Storm": "SEA",
  "Chicago Sky": "CHI",
};

const PLAYER_HEADSHOTS: Record<string, string> = {
  "LeBron James": "https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png",
  "Anthony Davis": "https://cdn.nba.com/headshots/nba/latest/1040x760/203076.png",
  "Jalen Brunson": "https://cdn.nba.com/headshots/nba/latest/1040x760/1628973.png",
  "Luka Doncic": "https://cdn.nba.com/headshots/nba/latest/1040x760/1629029.png",
  "Jayson Tatum": "https://cdn.nba.com/headshots/nba/latest/1040x760/1628369.png",
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time TBD";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNumber(value: number | null | undefined, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  return value.toFixed(1);
}

function formatOdds(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${value}` : `${value}`;
}

function environmentLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not Available";
  if (value >= 8.3) return "Strong";
  if (value >= 7.5) return "Playable";
  return "Neutral";
}

function edgeLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return "Watch";
  if (value >= 7.5) return "Strong Edge";
  if (value >= 5) return "Playable";
  return "Lean";
}

function getScore(prop: Prop) {
  return (
    Number(prop.edge ?? 0) * 0.5 +
    Number(prop.hit_rate ?? 0) * 0.3 +
    Number(prop.confidence ?? 0) * 0.2
  );
}

function playerImageUrl(player: string) {
  return PLAYER_HEADSHOTS[player] || "";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params?.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGame() {
      if (!gameId) return;

      setLoading(true);

      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError || !gameData) {
        console.error("Game load error:", gameError);
        setGame(null);
        setLoading(false);
        return;
      }

      setGame(gameData);

      const teams = [
        gameData.away_team,
        gameData.home_team,
        TEAM_MAP[gameData.away_team],
        TEAM_MAP[gameData.home_team],
      ].filter(Boolean);

const { data: propData, error: propError } = await supabase
  .from("props")
  .select("*")
  .eq("game_id", gameData.id)
  .order("edge", { ascending: false });

      if (propError) {
        console.error("Props load error:", propError);

        const { data: fallbackProps } = await supabase
          .from("props")
          .select("*")
          .in("team", teams)
          .order("edge", { ascending: false });

        setProps((fallbackProps as Prop[]) || []);
      } else {
        setProps((propData as Prop[]) || []);
      }

      setLoading(false);
    }

    loadGame();
  }, [gameId]);

  const isWnba = game?.league === "WNBA";

  const bestBets = useMemo<RankedProp[]>(() => {
    return [...props]
      .filter((prop) => prop.player && prop.market)
      .map((prop) => ({
        ...prop,
        edge: prop.edge ?? 0,
        hit_rate: prop.hit_rate ?? 0,
        confidence: prop.confidence ?? 0,
        score: getScore(prop),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [props]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <p className="text-zinc-400">Loading game breakdown...</p>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-white">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300">
          ← Back to slate
        </Link>
        <h1 className="mt-8 text-4xl font-black">Game not found</h1>
      </main>
    );
  }

  const awayLogo = TEAM_LOGOS[game.away_team];
  const homeLogo = TEAM_LOGOS[game.home_team];

  const accentText = isWnba ? "text-orange-300" : "text-emerald-400";
  const accentSoftText = isWnba ? "text-orange-200" : "text-emerald-400";
  const accentBorder = isWnba ? "border-orange-300/60" : "border-emerald-500/60";
  const accentBg = isWnba ? "bg-orange-300/10" : "bg-emerald-500/10";
  const accentShadow = isWnba ? "shadow-orange-500/10" : "shadow-emerald-950/20";

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className={`text-sm font-bold ${
            isWnba
              ? "text-orange-300 hover:text-orange-200"
              : "text-emerald-400 hover:text-emerald-300"
          }`}
        >
          ← Back to Today’s Slate
        </Link>

        <section
          className={`mt-8 rounded-[2rem] border bg-zinc-950 p-6 shadow-2xl ${
            isWnba ? "border-orange-300/40" : "border-zinc-800"
          } ${accentShadow}`}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-4">
                {awayLogo ? (
                  <img
                    src={awayLogo}
                    alt={game.away_team}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <LogoFallback name={game.away_team} isWnba={isWnba} />
                )}

                {homeLogo ? (
                  <img
                    src={homeLogo}
                    alt={game.home_team}
                    className="h-12 w-12 object-contain"
                  />
                ) : (
                  <LogoFallback name={game.home_team} isWnba={isWnba} />
                )}

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    isWnba
                      ? "bg-orange-300/20 text-orange-200"
                      : "bg-emerald-500/20 text-emerald-400"
                  }`}
                >
                  {game.league || "NBA"}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                {game.away_team} @ {game.home_team}
              </h1>

              <p className="mt-3 text-lg text-zinc-400">
                {formatTime(game.game_time)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <MetricCard label="Projected Total" value={formatNumber(game.projected_total)} />
              <MetricCard label="Pace" value={formatNumber(game.pace, "N/A")} />

              <div className={`rounded-2xl border ${accentBorder} ${accentBg} p-4`}>
                <p className={`text-sm ${accentText}`}>Environment</p>
                <p className={`mt-1 text-3xl font-black ${accentText}`}>
                  {formatNumber(game.environment)}
                </p>
                <p className={`text-sm font-bold ${accentText}`}>
                  {environmentLabel(game.environment)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-4">
          <InfoCard
            label="Spread"
            value={`${game.favorite_team || "Favorite TBD"} ${
              game.spread !== null && game.spread !== undefined
                ? Number(game.spread).toFixed(1)
                : "—"
            }`}
          />

          <InfoCard label="Away Team Total" value={formatNumber(game.away_team_total)} />

          <InfoCard label="Home Team Total" value={formatNumber(game.home_team_total)} />

          <InfoCard
            label="Moneyline"
            value={`Away ${formatOdds(game.away_moneyline)} / Home ${formatOdds(
              game.home_moneyline
            )}`}
            small
          />
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-sm font-bold uppercase tracking-[0.3em] ${accentText}`}>
                HoopEdge Signals
              </p>
              <h2 className="mt-2 text-3xl font-black">
                {isWnba ? "WNBA Best Bets" : "Best Bets"}
              </h2>
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {bestBets.length > 0 ? (
              bestBets.map((prop, index) => (
                <PropCard
                  key={`${prop.player}-${prop.market}-${index}`}
                  prop={prop}
                  isWnba={isWnba}
                  accentSoftText={accentSoftText}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-400">
                No props loaded for this game yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function LogoFallback({ name, isWnba }: { name: string; isWnba: boolean }) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-full text-xs font-black ${
        isWnba
          ? "bg-orange-300/15 text-orange-200"
          : "bg-emerald-500/15 text-emerald-300"
      }`}
    >
      {initials(name)}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/50 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 font-black ${small ? "text-lg" : "text-2xl"}`}>
        {value}
      </p>
    </div>
  );
}

function PropCard({
  prop,
  isWnba,
  accentSoftText,
}: {
  prop: RankedProp;
  isWnba: boolean;
  accentSoftText: string;
}) {
  const image = playerImageUrl(prop.player);

  const accentBorder = isWnba
    ? "hover:border-orange-300/70"
    : "hover:border-emerald-500/60";

  const badge = isWnba
    ? "bg-orange-300/20 text-orange-200"
    : "bg-emerald-500/20 text-emerald-400";

  return (
    <div
      className={`group rounded-3xl border border-zinc-800 bg-zinc-950 p-5 transition hover:-translate-y-1 ${accentBorder} hover:bg-zinc-900`}
    >
      <div>
        {prop.score >= 40 && (
          <div className={`mb-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${badge}`}>
            {isWnba ? "🧡 TOP PLAY" : "🔥 TOP PLAY"}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-zinc-900">
            {image ? (
              <img
                src={image}
                alt={prop.player}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center text-lg font-black ${
                  isWnba
                    ? "bg-orange-300/15 text-orange-200"
                    : "bg-emerald-500/15 text-emerald-300"
                }`}
              >
                {initials(prop.player)}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-black">{prop.player}</h3>
            <p className="text-sm text-zinc-400">{prop.team || "Team TBD"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-black/50 p-4">
        <p className="text-sm text-zinc-500">Market</p>
        <p className="text-xl font-black">
          {prop.market} {prop.line ?? "—"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <Stat label="Odds" value={formatOdds(prop.odds)} />
        <Stat label="Edge" value={`${formatNumber(prop.edge)}%`} accent={accentSoftText} />
        <Stat label="Signal" value={edgeLabel(prop.edge)} accent={accentSoftText} />
        <Stat label="Hit" value={`${formatNumber(prop.hit_rate)}%`} accent={accentSoftText} />
        <Stat label="Score" value={prop.score.toFixed(1)} accent={accentSoftText} />
      </div>

      {prop.note && (
        <p className="mt-4 text-sm leading-6 text-zinc-400">{prop.note}</p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className={`font-black ${accent}`}>{value}</p>
    </div>
  );
}