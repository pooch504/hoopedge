import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Prop = {
  id: string;
  player: string;
  market: string;
  line: number;
  implied_prob: number | null;
};

type PlayerStat = {
  id: string;
  player: string;
  game_date: string;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  threes: number | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

function cleanSlug(text: string) {
  return text
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll("'", "")
    .replaceAll("’", "")
    .replaceAll(",", "")
    .replaceAll(" ", "-");
}

function getStatValue(log: PlayerStat, market: string) {
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

export async function GET() {
  try {
    const { data: propsData, error: propsError } = await supabase
      .from("props")
      .select("id, player, market, line, implied_prob");

    if (propsError) {
      return NextResponse.json(
        { error: "Failed to load props.", details: propsError.message },
        { status: 500 }
      );
    }

    const { data: statsData, error: statsError } = await supabase
      .from("player_stats")
      .select("id, player, game_date, points, rebounds, assists, threes")
      .order("game_date", { ascending: false });

    if (statsError) {
      return NextResponse.json(
        { error: "Failed to load player stats.", details: statsError.message },
        { status: 500 }
      );
    }

    const props = (propsData as Prop[]) || [];
    const stats = (statsData as PlayerStat[]) || [];

    const updates = props
      .map((prop) => {
        const playerLogs = stats
          .filter((log) => cleanSlug(log.player) === cleanSlug(prop.player))
          .slice(0, 10);

        if (playerLogs.length === 0) return null;

        const hits = playerLogs.filter(
          (log) => getStatValue(log, prop.market) >= prop.line
        ).length;

        const modelProb = Number(((hits / playerLogs.length) * 100).toFixed(1));
        const impliedProb = prop.implied_prob ?? 0;
        const edge = Number((modelProb - impliedProb).toFixed(1));

        return {
          id: prop.id,
          model_prob: modelProb,
          edge,
        };
      })
      .filter(Boolean);

    if (updates.length === 0) {
      return NextResponse.json({
        message: "No matching player stats found for props.",
        updated: 0,
      });
    }

    const { error: updateError } = await supabase.from("props").upsert(updates, {
      onConflict: "id",
    });

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update prop edges.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Edges calculated successfully.",
      updated: updates.length,
      sample: updates[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected edge engine error.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}