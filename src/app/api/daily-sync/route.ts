import { NextResponse } from "next/server";

async function runStep(name: string, url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();

  return {
    name,
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function GET(request: Request) {
  try {
    const baseUrl = new URL(request.url).origin;

    const games = await runStep("sync-games", `${baseUrl}/api/sync-games`);

    if (!games.ok) {
      return NextResponse.json(
        {
          error: "Daily sync stopped at sync-games.",
          results: [games],
        },
        { status: 500 }
      );
    }

    const props = await runStep("sync-props", `${baseUrl}/api/sync-props`);

    if (!props.ok) {
      return NextResponse.json(
        {
          error: "Daily sync stopped at sync-props.",
          results: [games, props],
        },
        { status: 500 }
      );
    }

    const edges = await runStep(
      "calculate-edges",
      `${baseUrl}/api/calculate-edges`
    );

    if (!edges.ok) {
      return NextResponse.json(
        {
          error: "Daily sync stopped at calculate-edges.",
          results: [games, props, edges],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Daily sync completed successfully.",
      results: [games, props, edges],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected daily-sync error.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}