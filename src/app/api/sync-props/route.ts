import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ================= TYPES ================= */

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
  commence_time?: string;
  bookmakers: Bookmaker[];
};

type PlayerStat = {
  player: string;
  game_date: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  threes: number | null;
};

type GameRow = {
  id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  projected_total: number | null;
  favorite_team: string | null;
  spread: number | null;
  home_moneyline: number | null;
  away_moneyline: number | null;
  pace: number | null;
  environment: number | null;
};

type PropRow = {
  id: string;
  game_id: string;
  player: string;
  team: string | null;
  market: string;
  line: number;
  odds: number;
  book: string;
  implied_prob: number;
  model_prob: number | null;
  edge: number | null;
};

/* ================= CONFIG ================= */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const oddsKey = process.env.ODDS_API_KEY;

const MARKETS = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_points_rebounds_assists",
];

const PREFERRED_BOOKS = ["fanduel", "draftkings", "caesars", "betmgm"];

/* ================= HELPERS ================= */

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

function getGameId(event: OddsEvent | EventOdds) {
  const away = cleanSlug(event.away_team);
  const home = cleanSlug(event.home_team);
  const date =
    event.commence_time?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

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

function statValue(stat: PlayerStat, market: string) {
  if (market === "Points") return stat.points ?? 0;
  if (market === "Rebounds") return stat.rebounds ?? 0;
  if (market === "Assists") return stat.assists ?? 0;
  if (market === "3PM") return stat.threes ?? 0;

  if (market === "PRA") {
    return (stat.points ?? 0) + (stat.rebounds ?? 0) + (stat.assists ?? 0);
  }

  return 0;
}

function modelFromLast10({
  player,
  market,
  line,
  stats,
}: {
  player: string;
  market: string;
  line: number;
  stats: PlayerStat[];
}) {
  const key = normalizeName(player);

  const games = stats
    .filter((s) => normalizeName(s.player) === key)
    .sort(
      (a, b) =>
        new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
    )
    .slice(0, 10);

  if (games.length < 3) return null;

  const hits = games.filter((g) => statValue(g, market) > line).length;
  const rate = (hits / games.length) * 100;

  return { model_prob: Number(rate.toFixed(1)) };
}

function getPreferredBook(bookmakers: Bookmaker[]) {
  return (
    bookmakers.find((b) =>
      PREFERRED_BOOKS.includes(b.title.toLowerCase())
    ) ?? bookmakers[0]
  );
}

function extractGameMarkets(game: EventOdds, event: OddsEvent) {
  const book = getPreferredBook(game.bookmakers ?? []);

  let projectedTotal: number | null = null;
  let favoriteTeam: string | null = null;
  let spread: number | null = null;
  let homeMoneyline: number | null = null;
  let awayMoneyline: number | null = null;

  for (const market of book?.markets ?? []) {
    if (market.key === "totals") {
      const over = market.outcomes.find(
        (o) => o.name.toLowerCase() === "over"
      );
      projectedTotal = over?.point ?? null;
    }

    if (market.key === "spreads") {
      const home = market.outcomes.find((o) => o.name === event.home_team);
      const away = market.outcomes.find((o) => o.name === event.away_team);

      if (home?.point !== undefined && away?.point !== undefined) {
        if (home.point < away.point) {
          favoriteTeam = event.home_team;
          spread = Math.abs(home.point);
        } else {
          favoriteTeam = event.away_team;
          spread = Math.abs(away.point);
        }
      }
    }

    if (market.key === "h2h") {
      homeMoneyline =
        market.outcomes.find((o) => o.name === event.home_team)?.price ?? null;

      awayMoneyline =
        market.outcomes.find((o) => o.name === event.away_team)?.price ?? null;
    }
  }

  return {
    projectedTotal,
    favoriteTeam,
    spread,
    homeMoneyline,
    awayMoneyline,
  };
}

function createFallbackGame(event: OddsEvent): GameRow {
  return {
    id: getGameId(event),
    home_team: event.home_team,
    away_team: event.away_team,
    game_time: event.commence_time,
    projected_total: null,
    favorite_team: null,
    spread: null,
    home_moneyline: null,
    away_moneyline: null,
    pace: null,
    environment: null,
  };
}

async function upsertInChunks<T extends { id: string }>(
  table: string,
  rows: T[],
  chunkSize = 500
) {
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict: "id",
    });

    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`);
    }
  }
}

/* ================= ROUTE ================= */

export async function GET() {
  try {
    if (!supabaseUrl || !serviceKey || !oddsKey) {
      return NextResponse.json(
        {
          error: "Missing environment variables.",
          required: [
            "NEXT_PUBLIC_SUPABASE_URL",
            "SUPABASE_SERVICE_ROLE_KEY",
            "ODDS_API_KEY",
          ],
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: playerStats, error: playerStatsError } = await supabase
      .from("player_stats")
      .select("player, game_date, points, rebounds, assists, threes")
      .order("game_date", { ascending: false })
      .limit(5000);

    if (playerStatsError) {
      return NextResponse.json(
        {
          error: "Could not load player_stats.",
          details: playerStatsError.message,
        },
        { status: 500 }
      );
    }

    const eventsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/events?apiKey=${oddsKey}`,
      { cache: "no-store" }
    );

    if (!eventsRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch NBA events.",
          status: eventsRes.status,
          details: await eventsRes.text(),
        },
        { status: eventsRes.status }
      );
    }

    const events = (await eventsRes.json()) as OddsEvent[];

    const games: GameRow[] = [];
    const props: PropRow[] = [];

    let skippedGame = 0;
    let skippedProps = 0;

    for (const event of events) {
      const gameId = getGameId(event);

      /* ===== GAME ODDS ===== */

      const gameRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${event.id}/odds` +
          `?apiKey=${oddsKey}` +
          `&regions=us` +
          `&markets=spreads,totals,h2h` +
          `&oddsFormat=american`,
        { cache: "no-store" }
      );

      if (gameRes.ok) {
        const data = (await gameRes.json()) as EventOdds;
        const m = extractGameMarkets(data, event);

        games.push({
          id: gameId,
          home_team: event.home_team,
          away_team: event.away_team,
          game_time: event.commence_time,
          projected_total: m.projectedTotal,
          favorite_team: m.favoriteTeam,
          spread: m.spread,
          home_moneyline: m.homeMoneyline,
          away_moneyline: m.awayMoneyline,
          pace: null,
          environment: m.projectedTotal
            ? Number(Math.min(10, m.projectedTotal / 24).toFixed(1))
            : null,
        });
      } else {
        skippedGame += 1;

        const details = await gameRes.text();

        console.error("Game odds failed. Using fallback game row.", {
          game: `${event.away_team} @ ${event.home_team}`,
          status: gameRes.status,
          details,
        });

        games.push(createFallbackGame(event));
      }

      /* ===== PLAYER PROP ODDS ===== */

      const propRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/basketball_nba/events/${event.id}/odds` +
          `?apiKey=${oddsKey}` +
          `&regions=us` +
          `&markets=${MARKETS.join(",")}` +
          `&oddsFormat=american`,
        { cache: "no-store" }
      );

      if (!propRes.ok) {
        skippedProps += 1;

        const details = await propRes.text();

        console.error("Player props failed.", {
          game: `${event.away_team} @ ${event.home_team}`,
          status: propRes.status,
          details,
        });

        continue;
      }

      const data = (await propRes.json()) as EventOdds;

      for (const book of data.bookmakers ?? []) {
        for (const market of book.markets ?? []) {
          const marketLabel = marketName(market.key);

          for (const outcome of market.outcomes ?? []) {
            const isOver = outcome.name.toLowerCase() === "over";

            if (!isOver) continue;
            if (!outcome.description) continue;
            if (outcome.point === undefined) continue;
            if (!Number.isFinite(outcome.price)) continue;

            const implied = impliedProbability(outcome.price);

            const model = modelFromLast10({
              player: outcome.description,
              market: marketLabel,
              line: outcome.point,
              stats: playerStats ?? [],
            });

            const modelProb = model?.model_prob ?? null;

            props.push({
              id: `${gameId}-${cleanSlug(outcome.description)}-${cleanSlug(
                marketLabel
              )}-${outcome.point}-${cleanSlug(book.title)}-over`,
              game_id: gameId,
              player: outcome.description,
              team: null,
              market: marketLabel,
              line: outcome.point,
              odds: outcome.price,
              book: book.title,
              implied_prob: implied,
              model_prob: modelProb,
              edge:
                modelProb === null
                  ? null
                  : Number((modelProb - implied).toFixed(1)),
            });
          }
        }
      }
    }

    const uniqueGames = Array.from(
      new Map(games.map((row) => [row.id, row])).values()
    );

    const uniqueProps = Array.from(
      new Map(props.map((row) => [row.id, row])).values()
    );

    if (uniqueGames.length > 0) {
      await upsertInChunks("games", uniqueGames);
    }

    if (uniqueProps.length > 0) {
      await upsertInChunks("props", uniqueProps);
    }

    return NextResponse.json({
      message:
        uniqueProps.length > 0
          ? "Full sync success. Games and props synced."
          : "Fallback sync complete. Games synced, but player props are not available yet.",
      events_checked: events.length,
      games_inserted: uniqueGames.length,
      props_inserted: uniqueProps.length,
      skipped_game_odds: skippedGame,
      skipped_prop_odds: skippedProps,
      sample_game: uniqueGames[0] ?? null,
      sample_prop: uniqueProps[0] ?? null,
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