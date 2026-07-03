// The 24 "offline mode excuse" squares, verbatim from the legacy bingo route.
export const BINGO_SQUARES: string[] = [
  "I use authme for added security",
  "My country's laws allow it",
  "My players are all young children with no money",
  "My country has bad economy and very poor",
  "Everyone pirate the game in my country",
  "My country has weak currency",
  "One of my player cannot afford the game, I dont want him to feel left out",
  "An old Notch tweet",
  "I can't get players without it",
  "I don't want to rely on Microsoft's servers",
  "There are bigger offline networks, so why not me?",
  "Microsoft is bad",
  "I'm actually using bungee (timings/Spark says otherwise)",
  "Stop being toxic and shut up if you dont want to help",
  "Minecraft is not available for sale in my country",
  "Culture in (region)",
  "I use SkinRestorer so my players can change skins",
  "Mojang provides it so it must be ok",
  "It promotes the game so when people get money they'll buy it",
  "But you have to fix this bug. (The bug is due to offline mode)",
  "Most of my players are too busy to justify buying the game",
  "Mojang makes enough money already",
  "I don't know what offline mode is, one of my friends told me to use it",
  'I own the "premium" version',
];

// Deterministic PRNG seeded by an integer. Note: this is NOT Python's Mersenne
// Twister, so a given ?seed= will not reproduce cards from the legacy site.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shuffle the squares deterministically and insert the Free space at index 12,
// producing the 25-cell card (matches the legacy shuffle-then-insert order).
export function generateCard(seed: number): string[] {
  const rng = mulberry32(seed);
  const squares = [...BINGO_SQUARES];
  for (let i = squares.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [squares[i], squares[j]] = [squares[j], squares[i]];
  }
  const wanted = squares.slice(0, 24);
  wanted.splice(12, 0, "Free");
  return wanted;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_001);
}
