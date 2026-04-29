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
  league?: string | null;
};

type Prop = {
  id?: string;
  game_id?: string | null;
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
};

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

function formatOdds(value: number | null | undefined) {
  if (value == null) return "—";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatNumber(value: number | null | undefined, fallback = "—") {
  if (value == null) return fallback;
  return value.toFixed(1);
}

function getScore(prop: Prop) {
  return (
    Number(prop.edge ?? 0) * 0.5 +
    Number(prop.hit_rate ?? 0) * 0.3 +
    Number(prop.confidence ?? 0) * 0.2
  );
}

export default function PlayerPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPlayer() {
      setLoading(true);

      const { data: statData } = await supabase
        .from("player_stats")
        .select("*")
        .order("game_date", { ascending: false });

      const { data: propData } = await supabase
        .from("props")
        .select("*")
        .order("updated_at", { ascending: false });

     const normalizedSlug = slug.replaceAll("-", " ").trim();

const matchedStats = ((statData as PlayerStat[]) || []).filter(
  (row) => normalizeName(row.player) === normalizedSlug
);

const matchedProps = ((propData as Prop[]) || []).filter(
  (row) => normalizeName(row.player) === normalizedSlug
);

      setStats(matchedStats);
      setProps(matchedProps);
      setLoading(false);
    }

    loadPlayer();
  }, [slug]);

  const playerName = stats[0]?.player || props[0]?.player || "Player";
  const team = stats[0]?.team || props[0]?.team || "Team TBD";
  const league = stats[0]?.league || props[0]?.league || "NBA";
  const isWnba = league === "WNBA";

 const recentFive = useMemo(() => {
  return [...stats]
    .sort(
      (a, b) =>
        new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
    )
    .slice(0, 5);
}, [stats]);

const averages = useMemo(() => {
  const total = recentFive.length || 1;

  return {
    points:
      recentFive.reduce((sum, row) => sum + (row.points ?? 0), 0) / total,
    rebounds:
      recentFive.reduce((sum, row) => sum + (row.rebounds ?? 0), 0) / total,
    assists:
      recentFive.reduce((sum, row) => sum + (row.assists ?? 0), 0) / total,
    threes:
      recentFive.reduce((sum, row) => sum + (row.threes ?? 0), 0) / total,
  };
}, [recentFive]);

  const rankedProps = useMemo(() => {
    return [...props]
      .map((prop) => ({ ...prop, score: getScore(prop) }))
      .sort((a, b) => b.score - a.score);
  }, [props]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Loading player profile...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className={`text-sm font-bold ${
            isWnba ? "text-orange-300" : "text-emerald-400"
          }`}
        >
          ← Back to Today’s Slate
        </Link>

        <section
          className={`mt-8 rounded-[2rem] border bg-zinc-950 p-8 shadow-2xl ${
            isWnba
              ? "border-orange-300/50 shadow-orange-500/10"
              : "border-emerald-500/40 shadow-emerald-950/20"
          }`}
        >
          <p
            className={`text-xs font-black uppercase tracking-[0.35em] ${
              isWnba ? "text-orange-300" : "text-emerald-400"
            }`}
          >
            {league} Player Profile
          </p>

          <div className="mt-4 flex items-center gap-5">
  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-zinc-900">
    <img
      src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${playerName
        .split(" ")
        .join("_")}.png`}
      alt={playerName}
      className="h-full w-full object-cover object-top"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  </div>

  <div>
    <h1 className="text-5xl font-black">{playerName}</h1>
    <p className="mt-1 text-lg text-zinc-400">{team}</p>
  </div>
</div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
  <Metric label="PTS Avg" value={averages.points.toFixed(1)} />
  <Metric label="REB Avg" value={averages.rebounds.toFixed(1)} />
  <Metric label="AST Avg" value={averages.assists.toFixed(1)} />
  <Metric label="3PM Avg" value={averages.threes.toFixed(1)} />
</div>

<div className="mt-8 rounded-3xl border border-zinc-800 bg-black/40 p-5">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
        Last 5 Trend
      </p>
      <h2 className="mt-1 text-xl font-black">Recent Scoring Form</h2>
    </div>

    <span
      className={`rounded-full px-3 py-1 text-xs font-black ${
        isWnba
          ? "bg-orange-300/20 text-orange-200"
          : "bg-emerald-500/20 text-emerald-400"
      }`}
    >
      Last {recentFive.length}
    </span>
  </div>

  <div className="grid gap-3 sm:grid-cols-5">
    {recentFive.map((game) => (
      <div
        key={game.id}
        className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
      >
        <p className="text-xs text-zinc-500">
          {new Date(game.game_date).toLocaleDateString()}
        </p>

        <p className="mt-2 text-2xl font-black">{game.points ?? "—"}</p>

        <p className="text-xs text-zinc-500">PTS vs {game.opponent ?? "—"}</p>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full ${
              isWnba ? "bg-orange-300" : "bg-emerald-400"
            }`}
            style={{
              width: `${Math.min((game.points ?? 0) * 3, 100)}%`,
            }}
          />
        </div>
      </div>
    ))}

    {recentFive.length === 0 && (
      <div className="col-span-full rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-500">
        No recent game logs available yet.
      </div>
    )}
  </div>
</div>
        </section>

        <section className="mt-10">
          <h2 className="text-3xl font-black">Active Props</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rankedProps.length > 0 ? (
              rankedProps.map((prop, index) => (
                <Link
                  key={`${prop.player}-${prop.market}-${index}`}
                  href={prop.game_id ? `/game/${prop.game_id}` : "#"}
                  className={`rounded-3xl border bg-zinc-950 p-5 transition hover:-translate-y-1 hover:bg-zinc-900 ${
                    isWnba
                      ? "border-zinc-800 hover:border-orange-300/70"
                      : "border-zinc-800 hover:border-emerald-500/60"
                  }`}
                >
                  <p
                    className={`text-xs font-black uppercase tracking-wide ${
                      isWnba ? "text-orange-300" : "text-emerald-400"
                    }`}
                  >
                    Signal #{index + 1}
                  </p>

                  <div className="mt-3 flex items-start justify-between gap-4">
  <div>
    <h3 className="text-xl font-black">
      {prop.market} {prop.line ?? "—"}
    </h3>

    <p className="mt-1 text-sm text-zinc-500">
      HoopEdge Score:{" "}
      <span className={isWnba ? "font-black text-orange-300" : "font-black text-emerald-400"}>
        {prop.score.toFixed(1)}
      </span>
    </p>
  </div>

  <span
    className={`rounded-full px-3 py-1 text-xs font-black ${
      prop.score >= 40
        ? isWnba
          ? "bg-orange-300/20 text-orange-200"
          : "bg-emerald-500/20 text-emerald-400"
        : "bg-zinc-800 text-zinc-300"
    }`}
  >
    {prop.score >= 40 ? "TOP SIGNAL" : "WATCH"}
  </span>
</div>

                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
  <MiniStat label="Odds" value={formatOdds(prop.odds)} />
  <MiniStat label="Edge" value={`${formatNumber(prop.edge)}%`} />
  <MiniStat label="Hit Rate" value={`${formatNumber(prop.hit_rate)}%`} />
  <MiniStat label="Confidence" value={prop.confidence ?? "—"} />
</div>

<div className="mt-5">
  <div className="mb-2 flex items-center justify-between text-xs">
    <span className="font-bold uppercase tracking-wide text-zinc-500">
      Confidence Meter
    </span>
    <span
      className={`font-black ${
        isWnba ? "text-orange-300" : "text-emerald-400"
      }`}
    >
      {prop.confidence ?? 0}/100
    </span>
  </div>

  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
    <div
      className={`h-full rounded-full ${
        isWnba ? "bg-orange-300" : "bg-emerald-400"
      }`}
      style={{
        width: `${Math.min(Number(prop.confidence ?? 0), 100)}%`,
      }}
    />
  </div>
</div>

                  {prop.note && (
                    <p className="mt-4 text-sm leading-6 text-zinc-400">
                      {prop.note}
                    </p>
                  )}
                </Link>
              ))
            ) : (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-400">
                No active props found for this player yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-3xl font-black">Recent Game Log</h2>

          <div className="mt-5 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4">Opponent</th>
                  <th className="p-4">PTS</th>
                  <th className="p-4">REB</th>
                  <th className="p-4">AST</th>
                  <th className="p-4">3PM</th>
                </tr>
              </thead>

              <tbody>
                {stats.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800">
                    <td className="p-4 text-left font-bold">
                      {new Date(row.game_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">{row.opponent ?? "—"}</td>
                    <td className="p-4 text-center font-black">{row.points ?? "—"}</td>
                    <td className="p-4 text-center font-black">{row.rebounds ?? "—"}</td>
                    <td className="p-4 text-center font-black">{row.assists ?? "—"}</td>
                    <td className="p-4 text-center font-black">{row.threes ?? "—"}</td>
                  </tr>
                ))}

                {stats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                      No game logs loaded for this player yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-zinc-500">{label}</p>
      <p className="font-black text-white">{value}</p>
    </div>
  );
}