import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OddsApiGame = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const oddsApiKey = process.env.ODDS_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getGameId(game: OddsApiGame) {
  const away = game.away_team.toLowerCase().replaceAll(" ", "-");
  const home = game.home_team.toLowerCase().replaceAll(" ", "-");
  const date = game.commence_time.slice(0, 10);

  return `${away}-${home}-${date}`;
}

function estimateEnvironment() {
  return Number((7 + Math.random() * 2).toFixed(1));
}

function estimatePace() {
  return Number((97 + Math.random() * 7).toFixed(1));
}

function estimateTotal() {
  return Number((218 + Math.random() * 20).toFixed(1));
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey || !oddsApiKey) {
      return NextResponse.json(
        {
          error:
            "Missing env variables. Check NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ODDS_API_KEY.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${oddsApiKey}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      const text = await response.text();

      return NextResponse.json(
        {
          error: "Failed to fetch NBA games from Odds API.",
          details: text,
        },
        { status: response.status }
      );
    }

    const games = (await response.json()) as OddsApiGame[];

    const rows = games.map((game) => ({
      id: getGameId(game),
      away_team: game.away_team,
      home_team: game.home_team,
      game_time: game.commence_time,
      projected_total: estimateTotal(),
      pace: estimatePace(),
      environment: estimateEnvironment(),
    }));

    if (rows.length === 0) {
      return NextResponse.json({
        message: "No NBA games found.",
        inserted: 0,
      });
    }

    const { error } = await supabase.from("games").upsert(rows, {
      onConflict: "id",
    });

    if (error) {
      return NextResponse.json(
        {
          error: "Supabase upsert failed.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Games synced successfully.",
      inserted: rows.length,
      games: rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected sync-games error.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}