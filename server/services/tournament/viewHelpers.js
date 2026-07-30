function countGamesWon(completedGames) {
  let gamesA = 0;
  let gamesB = 0;
  for (const g of completedGames || []) {
    if (g.a > g.b) gamesA += 1;
    else if (g.b > g.a) gamesB += 1;
  }
  return { gamesA, gamesB };
}

module.exports = { countGamesWon };
