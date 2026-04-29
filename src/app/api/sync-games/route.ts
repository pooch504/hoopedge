import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Game = {
  id: string;
  away_team: string;
  home_team: string;
  game_time: string;
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

type TeamGameLog = {
  team: string;
  date: string;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizeTeam(team: string | null | undefined) {
  return (team ?? "").trim().toLowerCase();
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRecentTeamLogs(stats: PlayerStat[]) {
  const grouped = new Map<string, TeamGameLog>();

  for (const row of stats) {
    if (!row.team || !row.game_date) continue;

    const team = row.team;
    const date = row.game_date.slice(0, 10);
    const key = `${normalizeTeam(team)}-${date}`;

    const current =
      grouped.get(key) ??
      ({
        team,
        date,
        points: 0,
        rebounds: 0,
        assists: 0,
        threes: 0,
      } satisfies TeamGameLog);

    current.points += Number(row.points ?? 0);
    current.rebounds += Number(row.rebounds ?? 0);
    current.assists += Number(row.assists ?? 0);
    current.threes += Number(row.threes ?? 0);

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

function getTeamProfile(team: string, logs: TeamGameLog[]) {
  const recent = logs
    .filter((log) => normalizeTeam(log.team) === normalizeTeam(team))
    .slice(0, 10);

  const pointsAvg = average(recent.map((log) => log.points)) ?? 110;
  const reboundsAvg = average(recent.map((log) => log.rebounds)) ?? 42;
  const assistsAvg = average(recent.map((log) => log.assists)) ?? 24;
  const threesAvg = average(recent.map((log) => log.threes)) ?? 12;

  return {
    gamesUsed: recent.length,
    pointsAvg,
    reboundsAvg,
    assistsAvg,
    threesAvg,
  };
}

function projectGame(game: Game, logs: TeamGameLog[]) {
  const away = getTeamProfile(game.away_team, logs);
  const home = getTeamProfile(game.home_team, logs);

  const awayProjected =
    away.pointsAvg * 0.62 +
    away.assistsAvg * 0.7 +
    away.threesAvg * 0.9 +
    12;

  const homeProjected =
    home.pointsAvg * 0.62 +
    home.assistsAvg * 0.7 +
    home.threesAvg * 0.9 +
    14;

  const projectedTotal = Number((awayProjected + homeProjected).toFixed(1));

  const projectedMargin = Number((homeProjected - awayProjected).toFixed(1));

  const favoriteTeam =
    projectedMargin >= 0 ? game.home_team : game.away_team;

  const spread = Number((-Math.abs(projectedMargin)).toFixed(1));

  const pace =
    94 +
    ((away.assistsAvg + home.assistsAvg) / 2) * 0.12 +
    ((away.threesAvg + home.threesAvg) / 2) * 0.08;

  let environment = 6.5;

  if (projectedTotal >= 235) environment += 1.5;
  else if (projectedTotal >= 225) environment += 1.0;
  else if (projectedTotal >= 215) environment += 0.5;

  if (Math.abs(projectedMargin) <= 4) environment += 0.8;
  else if (Math.abs(projectedMargin) <= 7) environment += 0.4;
  else if (Math.abs(projectedMargin) >= 12) environment -= 0.4;

  const dataQuality = Math.min(1, (away.gamesUsed + home.gamesUsed) / 12);
  environment = environment * dataQuality + 6.8 * (1 - dataQuality);

  return {
    projected_total: projectedTotal,
    pace: Number(pace.toFixed(1)),
    environment: Number(Math.max(5.5, Math.min(environment, 9.8)).toFixed(1)),
    favorite_team: favoriteTeam,
    spread,
    home_moneyline: null,
    away_moneyline: null,
  };
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          error:
            "Missing env variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const future = new Date(today);
    future.setDate(today.getDate() + 7);

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("*")
      .gte("game_time", today.toISOString())
      .lt("game_time", future.toISOString())
      .order("game_time", { ascending: true });

    if (gamesError) {
      return NextResponse.json(
        {
          error: "Could not load games.",
          details: gamesError.message,
        },
        { status: 500 }
      );
    }

    const { data: stats, error: statsError } = await supabase
      .from("player_stats")
      .select("*")
      .order("game_date", { ascending: false });

    if (statsError) {
      return NextResponse.json(
        {
          error: "Could not load player stats.",
          details: statsError.message,
        },
        { status: 500 }
      );
    }

    const existingGames = (games as Game[]) ?? [];
    const playerStats = (stats as PlayerStat[]) ?? [];

    if (existingGames.length === 0) {
      return NextResponse.json({
        message:
          "No upcoming games found in the games table. Add/sync schedule first, then run internal projections.",
        updated: 0,
      });
    }

    const teamLogs = getRecentTeamLogs(playerStats);

    const projectedRows = existingGames.map((game) => ({
      id: game.id,
      ...projectGame(game, teamLogs),
    }));

    const { error: updateError } = await supabase.from("games").upsert(
      projectedRows,
      {
        onConflict: "id",
      }
    );

    if (updateError) {
      return NextResponse.json(
        {
          error: "Projection update failed.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Internal HoopEdge projections updated successfully.",
      updated: projectedRows.length,
      games: projectedRows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected internal projection error.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}