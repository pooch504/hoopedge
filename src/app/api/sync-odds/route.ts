import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const oddsApiKey = process.env.ODDS_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type OddsOutcome = {
  name: string;
  price: number;
  point?: number;
};

type OddsMarket = {
  key: string;
  outcomes: OddsOutcome[];
};

type Bookmaker = {
  key: string;
  title: string;
  markets: OddsMarket[];
};

type OddsGame = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
};

function normalizeTeam(name: string) {
  return name.trim().toLowerCase();
}

function findBestBookmaker(game: OddsGame) {
  const preferredBooks = [
    "draftkings",
    "fanduel",
    "betmgm",
    "caesars",
    "espnbet",
    "betrivers",
  ];

  for (const bookKey of preferredBooks) {
    const book = game.bookmakers.find((b) => b.key === bookKey);
    if (book) return book;
  }

  return game.bookmakers[0];
}

function getMarket(book: Bookmaker | undefined, key: string) {
  return book?.markets.find((market) => market.key === key);
}

function getMoneylines(h2hMarket: OddsMarket | undefined, home: string, away: string) {
  const homeOutcome = h2hMarket?.outcomes.find(
    (outcome) => normalizeTeam(outcome.name) === normalizeTeam(home)
  );

  const awayOutcome = h2hMarket?.outcomes.find(
    (outcome) => normalizeTeam(outcome.name) === normalizeTeam(away)
  );

  return {
    home_moneyline: homeOutcome?.price ?? null,
    away_moneyline: awayOutcome?.price ?? null,
  };
}

function getSpread(spreadMarket: OddsMarket | undefined) {
  const outcomes = spreadMarket?.outcomes ?? [];

  const favorite = outcomes.find(
    (outcome) => typeof outcome.point === "number" && outcome.point < 0
  );

  if (!favorite) {
    return {
      favorite_team: null,
      spread: null,
    };
  }

  return {
    favorite_team: favorite.name,
    spread: favorite.point ?? null,
  };
}

function getProjectedTotal(totalMarket: OddsMarket | undefined) {
  const over = totalMarket?.outcomes.find(
    (outcome) => outcome.name.toLowerCase() === "over"
  );

  return over?.point ?? null;
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey || !oddsApiKey) {
      return NextResponse.json(
        {
          error:
            "Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or ODDS_API_KEY.",
        },
        { status: 500 }
      );
    }

    const oddsUrl =
      `https://api.the-odds-api.com/v4/sports/basketball_nba/odds` +
      `?apiKey=${oddsApiKey}` +
      `&regions=us` +
      `&markets=h2h,spreads,totals` +
      `&oddsFormat=american`;

    const response = await fetch(oddsUrl, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "The Odds API request failed.",
          status: response.status,
          details: errorText,
        },
        { status: 500 }
      );
    }

    const oddsGames = (await response.json()) as OddsGame[];

    let updated = 0;
    let skipped = 0;

    for (const oddsGame of oddsGames) {
      const book = findBestBookmaker(oddsGame);

      const h2hMarket = getMarket(book, "h2h");
      const spreadMarket = getMarket(book, "spreads");
      const totalMarket = getMarket(book, "totals");

      const moneylines = getMoneylines(
        h2hMarket,
        oddsGame.home_team,
        oddsGame.away_team
      );

      const spreadData = getSpread(spreadMarket);
      const projectedTotal = getProjectedTotal(totalMarket);

      const { data: matchingGames, error: matchError } = await supabase
        .from("games")
        .select("id, away_team, home_team")
        .eq("away_team", oddsGame.away_team)
        .eq("home_team", oddsGame.home_team)
        .limit(1);

      if (matchError) {
        console.error("Match error:", matchError);
        skipped++;
        continue;
      }

      const localGame = matchingGames?.[0];

      if (!localGame) {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("games")
        .update({
          favorite_team: spreadData.favorite_team,
          spread: spreadData.spread,
          home_moneyline: moneylines.home_moneyline,
          away_moneyline: moneylines.away_moneyline,
          projected_total: projectedTotal,
        })
        .eq("id", localGame.id);

      if (updateError) {
        console.error("Update error:", updateError);
        skipped++;
        continue;
      }

      updated++;
    }

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      message: "NBA spreads, moneylines, and totals synced.",
    });
  } catch (error) {
    console.error("Sync odds error:", error);

    return NextResponse.json(
      {
        error: "Unexpected sync odds error.",
      },
      { status: 500 }
    );
  }
}