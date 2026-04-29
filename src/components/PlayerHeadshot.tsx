"use client";

type PlayerHeadshotProps = {
  player: string;
  size?: "sm" | "md" | "lg";
};

const PLAYER_IDS: Record<string, string> = {
  "josh hart": "1628404",
  "jalen brunson": "1628973",
  "paolo banchero": "1631094",
  "luka doncic": "1629029",
  "tyler herro": "1629639",
  "bam adebayo": "1628389",
  "jayson tatum": "1628369",
  "jaylen brown": "1627759",
  "anthony edwards": "1630162",
  "shai gilgeous alexander": "1628983",
  "nikola jokic": "203999",
  "giannis antetokounmpo": "203507",
  "lebron james": "2544",
  "anthony davis": "203076",
  "kevin durant": "201142",
  "devin booker": "1626164",
  "stephen curry": "201939",
  "trae young": "1629027",
  "donovan mitchell": "1628378",
  "joel embiid": "203954",
  "james harden": "201935",
  "kawhi leonard": "202695",
  "paul george": "202331",
  "damian lillard": "203081",
  "ja morant": "1629630",
  "zion williamson": "1629627",
  "brandon ingram": "1627742",
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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PlayerHeadshot({
  player,
  size = "lg",
}: PlayerHeadshotProps) {
  const id = PLAYER_IDS[normalizeName(player)];

  const sizeClass =
    size === "sm"
      ? "h-10 w-10 text-xs"
      : size === "md"
      ? "h-20 w-20 text-lg"
      : "h-36 w-36 text-2xl";

  if (!id) {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded-full bg-zinc-900 font-black text-zinc-500`}
      >
        {initials(player)}
      </div>
    );
  }

  return (
    <img
      src={`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`}
      alt={`${player} headshot`}
      className={`${sizeClass} object-contain opacity-95 transition group-hover:scale-105`}
    />
  );
}