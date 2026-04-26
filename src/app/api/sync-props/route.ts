import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
};

type Outcome = {
  name: string;
  description?: string;
  price: number;
  point?: number;
};

type Market = {
  key: string;
  outcomes: Outcome[];
};

type Bookmaker = {
  title: string;
  markets: Market[];
};

type EventOdds = {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const oddsKey = process.env.ODDS_API_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

const MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_points_rebounds_assists",
];

function cleanSlug(text: string) {
  return text
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll("'", "")
    .replaceAll("’", "")
    .replaceAll(",", "")
    .replaceAll("+", "plus")
    .replaceAll(" ", "-");
}

function getGameId(event: OddsEvent) {
  const away = cleanSlug(event.away_team);
  const home = cleanSlug(event.home_team);
  const date = event.commence_time.slice(0, 10);

  return `${away}-${home}-${date}`;
}

function marketName(key: string) {
  const map: Record<string, string> = {
    player_points: "Points",
    player_rebounds: "Rebounds",
    player_assists: "Assists",
    player_threes: "3PM",
    player_points_rebounds_assists: "PRA",
  };

  return map[key] ?? key;
}

function impliedProbability(odds: number) {
  if (odds > 0) {
    return Number(((100 / (odds + 100)) * 100).toFixed(1));
  }

  return Number(((Math.abs(odds) / (Math.abs(odds) + 100)) * 100).toFixed(1));
}

export async function GET() {
  try {
    if (!supabaseUrl || !serviceKey || !oddsKey) {
      return NextResponse.json(
        {
          error: "Missing environment variables.",
          details:
            "Check NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ODDS_API_KEY.",
        },
        { status: 500 }
      );
    }

    const eventsResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${oddsKey}`,
      { cache: "no-store" }
    );

    if (!eventsResponse.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch NBA events.",
          details: await eventsResponse.text(),
        },
        { status: eventsResponse.status }
      );
    }

    const events = (await eventsResponse.json()) as OddsEvent[];
    const rows = [];

    for (const event of events) {
      const gameId = getGameId(event);

      const oddsUrl =
        `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${event.id}/odds` +
        `?apiKey=${oddsKey}` +
        `&regions=us` +
        `&markets=${MARKETS.join(",")}` +
        `&oddsFormat=american`;

      const oddsResponse = await fetch(oddsUrl, { cache: "no-store" });

      if (!oddsResponse.ok) {
        continue;
      }

      const oddsData = (await oddsResponse.json()) as EventOdds;

      for (const book of oddsData.bookmakers ?? []) {
        for (const market of book.markets ?? []) {
          for (const outcome of market.outcomes ?? []) {
            if (outcome.name.toLowerCase() !== "over") continue;
            if (!outcome.description || outcome.point === undefined) continue;

            const player = outcome.description;
            const marketLabel = marketName(market.key);
            const line = Number(outcome.point);
            const odds = Number(outcome.price);
            const side = outcome.name;

            rows.push({
              id: `${gameId}-${cleanSlug(player)}-${cleanSlug(
                marketLabel
              )}-${line}-${cleanSlug(book.title)}-${cleanSlug(side)}`,
              game_id: gameId,
              player,
              team: null,
              market: marketLabel,
              line,
              odds,
              book: book.title,
              implied_prob: impliedProbability(odds),
              model_prob: null,
              edge: null,
            });
          }
        }
      }
    }

    const uniqueRows = Array.from(
      new Map(rows.map((row) => [row.id, row])).values()
    );

    if (uniqueRows.length === 0) {
      return NextResponse.json({
        message: "No player props found from Odds API.",
        props_inserted: 0,
      });
    }

    const { error } = await supabase.from("props").upsert(uniqueRows, {
      onConflict: "id",
    });

    if (error) {
      return NextResponse.json(
        {
          error: "Supabase props upsert failed.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Props synced successfully.",
      props_inserted: uniqueRows.length,
      sample_prop: uniqueRows[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected sync-props error.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}