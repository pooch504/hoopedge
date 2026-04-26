"use client";

import { useParams } from "next/navigation";

export default function GamePage() {
  const params = useParams();
  const id = params.id;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold mb-6">
        Game #{id}
      </h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <p className="text-lg font-semibold mb-2">
          Game Breakdown Coming Soon
        </p>

        <p className="text-zinc-400">
          This will show player stats, matchup data, and prop edges.
        </p>
      </div>
    </div>
  );
}