"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

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

type Prop = {
  id: string;
  player: string;
  team: string | null;
  market: string;
  line: number;
  odds: number;
  book: string;
};

const TEAM_LOGOS: Record<string, string> = {
  LAL: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
  NYK: "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
  BOS: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
  GSW: "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
  ATL: "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
};

const PLAYER_HEADSHOTS: Record<string, string> = {
  "josh-hart": "https://cdn.nba.com/headshots/nba/latest/260x190/1628404.png",
  "luka-doncic": "https://cdn.nba.com/headshots/nba/latest/260x190/1629029.png",
  "jalen-brunson": "https://cdn.nba.com/headshots/nba/latest/260x190/1628973.png",
  "lebron-james": "https://cdn.nba.com/headshots/nba/latest/260x190/2544.png",
  "stephen-curry": "https://cdn.nba.com/headshots/nba/latest/260x190/201939.png",
  "karl-anthony-towns": "https://cdn.nba.com/headshots/nba/latest/260x190/1626157.png",
  "jayson-tatum": "https://cdn.nba.com/headshots/nba/latest/260x190/1628369.png",
  "jaylen-brown": "https://cdn.nba.com/headshots/nba/latest/260x190/1627759.png",
};

function cleanSlug(text: string) {
  return decodeURIComponent(text)
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll("'", "")
    .replaceAll("’", "")
    .replaceAll(",", "")
    .replaceAll(" ", "-");
}

function formatName(slug: string) {
  return slug
    .replaceAll("-", " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeTeam(team: string | null) {
  if (!team) return "NBA";

  const map: Record<string, string> = {
    NY: "NYK",
    NYK: "NYK",
    Knicks: "NYK",
    "New York Knicks": "NYK",
    LAL: "LAL",
    Lakers: "LAL",
    "Los Angeles Lakers": "LAL",
    BOS: "BOS",
    Celtics: "BOS",
    "Boston Celtics": "BOS",
    GSW: "GSW",
    Warriors: "GSW",
    "Golden State Warriors": "GSW",
    ATL: "ATL",
    Hawks: "ATL",
    "Atlanta Hawks": "ATL",
  };

  return map[team] || team;
}

function formatOdds(odds: number) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function getStat(log: PlayerStat, market: string) {
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

function calcEdge(avg: number, line: number) {
  if (!line || line <= 0) return null;
  return ((avg - line) / line) * 100;
}

function signalTier(edge: number | null) {
  if (edge === null) return "Pending";
  if (edge >= 50) return "Elite";
  if (edge >= 20) return "Strong";
  if (edge >= 5) return "Lean";
  if (edge > -5) return "Neutral";
  return "Fade";
}

function signalColor(edge: number | null) {
  if (edge === null) return "text-zinc-400";
  if (edge >= 50) return "text-emerald-400";
  if (edge >= 20) return "text-green-400";
  if (edge >= 5) return "text-yellow-400";
  if (edge > -5) return "text-zinc-300";
  return "text-red-400";
}

function signalBadge(edge: number | null) {
  if (edge === null) return "border-zinc-700 bg-zinc-900 text-zinc-300";
  if (edge >= 50) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (edge >= 20) return "border-green-500/40 bg-green-500/10 text-green-300";
  if (edge >= 5) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (edge > -5) return "border-zinc-700 bg-zinc-900 text-zinc-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function trendTag(delta: number) {
  if (delta >= 3) return "Hot";
  if (delta >= 1) return "Trending Up";
  if (delta <= -3) return "Cold";
  if (delta <= -1) return "Cooling";
  return "Stable";
}

function trendIcon(delta: number) {
  if (delta >= 3) return "🔥";
  if (delta >= 1) return "↗";
  if (delta <= -3) return "❄️";
  if (delta <= -1) return "↘";
  return "➖";
}

function deltaColor(delta: number) {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-zinc-300";
}

function trendBadge(delta: number) {
  if (delta > 0) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (delta < 0) return "border-red-500/40 bg-red-500/10 text-red-300";
  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export default function PlayerPage() {
  const params = useParams();
  const slug = cleanSlug(String(params.id));

  const [logs, setLogs] = useState<PlayerStat[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [slug]);

  async function load() {
    setLoading(true);

    const { data: stats } = await supabase
      .from("player_stats")
      .select("*")
      .order("game_date", { ascending: false });

    const { data: propData } = await supabase.from("props").select("*");

    const playerLogs =
      (stats as PlayerStat[] | null)?.filter(
        (s) => cleanSlug(s.player) === slug
      ) ?? [];

    const playerProps =
      (propData as Prop[] | null)?.filter(
        (p) => cleanSlug(p.player) === slug
      ) ?? [];

    setLogs(playerLogs.slice(0, 10));
    setProps(playerProps);
    setLoading(false);
  }

  const name = logs[0]?.player || props[0]?.player || formatName(slug);
  const rawTeam = logs[0]?.team || props[0]?.team || "NBA";
  const team = normalizeTeam(rawTeam);
  const logo = TEAM_LOGOS[team] || "";
  const headshot = PLAYER_HEADSHOTS[slug] || "";

  const averages = useMemo(() => {
    if (!logs.length) return { pts: 0, reb: 0, ast: 0, threes: 0 };

    return {
      pts: Number((logs.reduce((a, b) => a + (b.points ?? 0), 0) / logs.length).toFixed(1)),
      reb: Number((logs.reduce((a, b) => a + (b.rebounds ?? 0), 0) / logs.length).toFixed(1)),
      ast: Number((logs.reduce((a, b) => a + (b.assists ?? 0), 0) / logs.length).toFixed(1)),
      threes: Number((logs.reduce((a, b) => a + (b.threes ?? 0), 0) / logs.length).toFixed(1)),
    };
  }, [logs]);

  const trend = useMemo(() => {
    if (!logs.length) return null;

    const last5 = logs.slice(0, 5);
    const last10 = logs.slice(0, 10);

    function avg(arr: PlayerStat[], stat: "points" | "rebounds" | "assists") {
      if (!arr.length) return 0;
      return Number(
        (arr.reduce((sum, game) => sum + (game[stat] ?? 0), 0) / arr.length).toFixed(1)
      );
    }

    const pts5 = avg(last5, "points");
    const pts10 = avg(last10, "points");
    const reb5 = avg(last5, "rebounds");
    const reb10 = avg(last10, "rebounds");
    const ast5 = avg(last5, "assists");
    const ast10 = avg(last10, "assists");

    const ptsDelta = Number((pts5 - pts10).toFixed(1));
    const rebDelta = Number((reb5 - reb10).toFixed(1));
    const astDelta = Number((ast5 - ast10).toFixed(1));

    const strongest = [
      { label: "points", delta: ptsDelta },
      { label: "rebounds", delta: rebDelta },
      { label: "assists", delta: astDelta },
    ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

    return {
      pts5,
      pts10,
      ptsDelta,
      reb5,
      reb10,
      rebDelta,
      ast5,
      ast10,
      astDelta,
      strongest,
    };
  }, [logs]);

  const enriched = useMemo(() => {
    return props.map((p) => {
      const vals = logs.map((l) => getStat(l, p.market));
      const avg =
        vals.length > 0
          ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
          : 0;

      const hits = vals.filter((v) => v >= p.line).length;
      const pct = vals.length ? Math.round((hits / vals.length) * 100) : 0;

      return {
        ...p,
        avg,
        hits,
        total: vals.length,
        pct,
        edge: calcEdge(avg, p.line),
      };
    });
  }, [props, logs]);

  const top = [...enriched].sort((a, b) => (b.edge ?? -999) - (a.edge ?? -999))[0];

  if (loading) {
    return <main className="min-h-screen bg-black p-10 text-white">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <Link href="/" className="text-blue-400 hover:text-blue-300">
        ← Back
      </Link>

      <section className="mt-6 flex items-center gap-6">
        <div className="relative">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
            {headshot ? (
              <img
                src={headshot}
                alt={name}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl font-black">
                {name[0]}
              </div>
            )}
          </div>

          {logo && (
            <img
              src={logo}
              alt={team}
              className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full border border-zinc-700 bg-black p-1"
            />
          )}
        </div>

        <div>
          <p className="text-sm text-zinc-400">{team} • Player Profile</p>
          <h1 className="text-4xl font-black tracking-tight">{name}</h1>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Card label="PTS Avg" value={averages.pts} />
        <Card label="REB Avg" value={averages.reb} />
        <Card label="AST Avg" value={averages.ast} />
      </section>

      {trend && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-blue-500/40 bg-blue-500/10">
          <div className="border-b border-blue-500/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-300">
                  Player Trend Engine
                </p>
                <h2 className="mt-1 text-2xl font-black">Last 5 vs Last 10</h2>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${trendBadge(
                  trend.strongest.delta
                )}`}
              >
                {trendIcon(trend.strongest.delta)} {trendTag(trend.strongest.delta)}{" "}
                {trend.strongest.label}
              </span>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-300">
              {name} is showing his strongest recent movement in{" "}
              <span className="font-bold text-white">{trend.strongest.label}</span>, with a{" "}
              <span className={`font-bold ${deltaColor(trend.strongest.delta)}`}>
                {trend.strongest.delta > 0 ? "+" : ""}
                {trend.strongest.delta}
              </span>{" "}
              change from his last 10-game average to his last 5-game average.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            <TrendCard label="Points Trend" last5={trend.pts5} last10={trend.pts10} delta={trend.ptsDelta} />
            <TrendCard label="Rebounds Trend" last5={trend.reb5} last10={trend.reb10} delta={trend.rebDelta} />
            <TrendCard label="Assists Trend" last5={trend.ast5} last10={trend.ast10} delta={trend.astDelta} />
          </div>
        </section>
      )}

      {top && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/10">
          <div className="border-b border-emerald-500/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                  Performance Signal
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  Recent Production vs Current Market
                </h2>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-sm font-bold ${signalBadge(
                  top.edge
                )}`}
              >
                {top.edge !== null && top.edge >= 50 ? "🔥 " : ""}
                {signalTier(top.edge)}
              </span>
            </div>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-300">
              {name} is averaging{" "}
              <span className="font-bold text-white">{top.avg}</span> in the{" "}
              <span className="font-bold text-white">{top.market}</span> market
              against a current line of{" "}
              <span className="font-bold text-white">{top.line}</span>. This creates a{" "}
              <span className={`font-bold ${signalColor(top.edge)}`}>
                {top.edge !== null
                  ? `${top.edge > 0 ? "+" : ""}${top.edge.toFixed(1)}%`
                  : "pending"}
              </span>{" "}
              performance edge based on recent logs.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-4">
            <Card label="Market" value={top.market} />
            <Card label="Line" value={top.line} />
            <Card label="Recent Avg" value={top.avg} />
            <Card
              label="Performance Edge"
              value={
                top.edge !== null
                  ? `${top.edge > 0 ? "+" : ""}${top.edge.toFixed(1)}%`
                  : "-"
              }
              valueClass={signalColor(top.edge)}
            />
          </div>

          <div className="border-t border-emerald-500/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-400">Recent Hit Rate</p>
                <p className="mt-1 text-2xl font-black">
                  {top.hits}/{top.total}{" "}
                  <span className="text-sm text-zinc-400">({top.pct}%)</span>
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-zinc-400">Market Context</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {formatOdds(top.odds)} • {top.book}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.min(top.pct, 100)}%` }}
              />
            </div>
          </div>
        </section>
      )}

      <DataTable title="Recent Logs" emptyText="No recent logs found for this player.">
        <thead className="sticky top-0 bg-zinc-950 text-zinc-400">
          <tr>
            <Th align="left">Date</Th>
            <Th>Opponent</Th>
            <Th>PTS</Th>
            <Th>REB</Th>
            <Th>AST</Th>
            <Th>3PM</Th>
          </tr>
        </thead>

        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-6 text-center text-zinc-400">
                No recent logs found for this player.
              </td>
            </tr>
          ) : (
            logs.map((l, index) => (
              <tr
                key={l.id}
                className={`border-t border-zinc-800 transition hover:bg-blue-500/10 ${
                  index % 2 === 0 ? "bg-zinc-900/40" : "bg-black"
                }`}
              >
                <Td align="left">{l.game_date}</Td>
                <Td>{l.opponent ?? "-"}</Td>
                <Td bold>{l.points ?? 0}</Td>
                <Td bold>{l.rebounds ?? 0}</Td>
                <Td bold>{l.assists ?? 0}</Td>
                <Td bold>{l.threes ?? 0}</Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <DataTable title="Market Lines" emptyText="No market lines found for this player.">
        <thead className="sticky top-0 bg-zinc-950 text-zinc-400">
          <tr>
            <Th align="left">Market</Th>
            <Th>Line</Th>
            <Th>Odds</Th>
            <Th>Book</Th>
            <Th>Recent Avg</Th>
            <Th>Hit Rate</Th>
            <Th>Edge</Th>
            <Th>Tier</Th>
          </tr>
        </thead>

        <tbody>
          {enriched.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-6 text-center text-zinc-400">
                No market lines found for this player.
              </td>
            </tr>
          ) : (
            enriched.map((p, index) => (
              <tr
                key={p.id}
                className={`border-t border-zinc-800 transition hover:bg-emerald-500/10 ${
                  index % 2 === 0 ? "bg-zinc-900/40" : "bg-black"
                }`}
              >
                <Td align="left">{p.market}</Td>
                <Td bold>{p.line}</Td>
                <Td className="text-blue-400">{formatOdds(p.odds)}</Td>
                <Td>{p.book}</Td>
                <Td bold>{p.avg}</Td>
                <Td>
                  {p.hits}/{p.total} ({p.pct}%)
                </Td>
                <Td className={`font-bold ${signalColor(p.edge)}`}>
                  {p.edge !== null
                    ? `${p.edge > 0 ? "+" : ""}${p.edge.toFixed(1)}%`
                    : "-"}
                </Td>
                <Td>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${signalBadge(
                      p.edge
                    )}`}
                  >
                    {signalTier(p.edge)}
                  </span>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>
    </main>
  );
}

function Card({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function TrendCard({
  label,
  last5,
  last10,
  delta,
}: {
  label: string;
  last5: number;
  last10: number;
  delta: number;
}) {
  const max = Math.max(last5, last10, 1);
  const last5Width = Math.min((last5 / max) * 100, 100);
  const last10Width = Math.min((last10 / max) * 100, 100);

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="mt-1 text-xl font-black">
            {last5} vs {last10}
          </p>
        </div>

        <span className={`rounded-full border px-2 py-1 text-xs font-bold ${trendBadge(delta)}`}>
          {trendIcon(delta)} {trendTag(delta)}
        </span>
      </div>

      <p className={`mt-2 text-sm font-bold ${deltaColor(delta)}`}>
        Δ {delta > 0 ? "+" : ""}
        {delta}
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Last 5</span>
            <span>{last5}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-blue-400"
              style={{ width: `${last5Width}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Last 10</span>
            <span>{last10}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-zinc-500"
              style={{ width: `${last10Width}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DataTable({
  title,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 p-5">
        <h2 className="text-xl font-black">{title}</h2>
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[850px] text-sm">{children}</table>
      </div>
    </section>
  );
}

function Th({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <th className={`p-4 font-semibold ${align === "left" ? "text-left" : "text-center"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = "center",
  bold = false,
  className = "",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
  bold?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`p-4 ${align === "left" ? "text-left" : "text-center"} ${
        bold ? "font-bold" : "text-zinc-300"
      } ${className}`}
    >
      {children}
    </td>
  );
}