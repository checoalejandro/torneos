function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitBalancedByTeam(pairs) {
  const groups = [[], []];
  const teams = [...new Set(pairs.map(p => p.team))];
  const teamMap = new Map();
  for (const pair of pairs) {
    const key = pair.team;
    if (!teamMap.has(key)) teamMap.set(key, []);
    teamMap.get(key).push(pair);
  }

  // Barajamos cada equipo individualmente
  for (const team of teams) {
    teamMap.set(team, shuffle(teamMap.get(team)));
  }

  // Distribuimos alternando: una de Atlas a G1, una de Atlas a G2, 
  // luego una de Avila a G1, una de Avila a G2, y repetimos.
  let gIdx = 0;
  for (const team of teams) {
    const list = teamMap.get(team);
    while (list.length > 0) {
      const pair = list.shift();
      groups[gIdx % 2].push(pair);
      gIdx += 1;
    }
  }

  return groups;
}

function roundRobin(pairIds) {
  let ids = [...pairIds];
  const bye = null;
  if (ids.length % 2 === 1) ids.push(bye);

  const n = ids.length;
  const rounds = [];
  let arr = [...ids];

  for (let round = 0; round < n - 1; round += 1) {
    const matches = [];
    for (let i = 0; i < n / 2; i += 1) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        matches.push({
          id: uid('m'),
          a,
          b,
          scoreA: null,
          scoreB: null,
          winnerId: null,
          finished: false,
          phase: 'groups'
        });
      }
    }
    rounds.push(matches);

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }

  return rounds;
}

function createStandings(group) {
  const map = new Map();
  group.pairs.forEach((p) => {
    map.set(p.id, {
      pairId: p.id,
      name: p.name,
      team: p.team,
      played: 0,
      wins: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      h2h: new Map(),
    });
  });

  for (const match of group.matches.flat()) {
    if (!match.finished) continue;
    const a = map.get(match.a);
    const b = map.get(match.b);
    if (!a || !b) continue;
    a.played += 1; b.played += 1;
    a.pointsFor += match.scoreA; a.pointsAgainst += match.scoreB;
    b.pointsFor += match.scoreB; b.pointsAgainst += match.scoreA;
    a.diff = a.pointsFor - a.pointsAgainst;
    b.diff = b.pointsFor - b.pointsAgainst;
    if (match.winnerId === match.a) {
      a.wins += 1;
      a.h2h.set(match.b, 1);
      b.h2h.set(match.a, -1);
    } else if (match.winnerId === match.b) {
      b.wins += 1;
      b.h2h.set(match.a, 1);
      a.h2h.set(match.b, -1);
    }
  }

  return [...map.values()].sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.diff !== x.diff) return y.diff - x.diff;
    const h2h = x.h2h.get(y.pairId);
    if (h2h === 1) return -1;
    if (h2h === -1) return 1;
    return x.name.localeCompare(y.name, 'es');
  });
}

function buildTournament(pairs) {
  const groupsRaw = splitBalancedByTeam(pairs);
  const groups = groupsRaw.map((groupPairs, idx) => ({
    id: idx + 1,
    name: `Grupo ${idx + 1}`,
    court: idx + 1,
    pairs: groupPairs,
    matches: roundRobin(groupPairs.map((p) => p.id))
  }));

  return {
    startedAt: new Date().toISOString(),
    phase: 'groups',
    groups,
    semis: [],
    final: null,
    champion: null,
  };
}

function findMatchById(tournament, matchId) {
  for (const group of tournament.groups) {
    for (const round of group.matches) {
      const match = round.find((m) => m.id === matchId);
      if (match) return { group, match };
    }
  }
  if (tournament.semis) {
    const match = tournament.semis.find((m) => m.id === matchId);
    if (match) return { group: null, match };
  }
  if (tournament.final && tournament.final.id === matchId) return { group: null, match: tournament.final };
  return null;
}

function allGroupMatchesFinished(tournament) {
  return tournament.groups.every((group) => group.matches.flat().every((m) => m.finished));
}

function computeAdvancers(tournament) {
  const ranked = tournament.groups.map((group) => ({
    groupId: group.id,
    standings: createStandings(group)
  }));

  return ranked.map((r) => ({
    groupId: r.groupId,
    first: r.standings[0] || null,
    second: r.standings[1] || null,
    standings: r.standings
  }));
}

function ensureKnockout(tournament) {
  if (tournament.phase === 'groups' && !allGroupMatchesFinished(tournament)) {
    return tournament;
  }

  const advancers = computeAdvancers(tournament);
  const g1 = advancers.find((g) => g.groupId === 1);
  const g2 = advancers.find((g) => g.groupId === 2);
  if (!g1?.first || !g1?.second || !g2?.first || !g2?.second) return tournament;

  if (!tournament.semis || tournament.semis.length === 0) {
    tournament.semis = [
      {
        id: uid('semi'),
        label: 'Semifinal 1',
        a: g1.first.pairId,
        b: g2.second.pairId,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        finished: false,
        phase: 'semis',
      },
      {
        id: uid('semi'),
        label: 'Semifinal 2',
        a: g2.first.pairId,
        b: g1.second.pairId,
        scoreA: null,
        scoreB: null,
        winnerId: null,
        finished: false,
        phase: 'semis',
      }
    ];
  }

  const semisDone = tournament.semis.every((m) => m.finished);
  if (semisDone && !tournament.final) {
    tournament.final = {
      id: uid('final'),
      label: 'Final',
      a: tournament.semis[0].winnerId,
      b: tournament.semis[1].winnerId,
      scoreA: null,
      scoreB: null,
      winnerId: null,
      finished: false,
      phase: 'final',
    };
  }

  if (tournament.final && tournament.final.finished) {
    tournament.phase = 'done';
    tournament.champion = tournament.final.winnerId;
  } else if (tournament.final) {
    tournament.phase = 'final';
  } else if (semisDone) {
    tournament.phase = 'semis';
  } else {
    tournament.phase = 'groups';
  }

  return tournament;
}

function registerResult(tournament, matchId, winnerId, loserScore) {
  const hit = findMatchById(tournament, matchId);
  if (!hit) throw new Error('Partido no encontrado');
  const { match } = hit;
  if (match.finished) throw new Error('El partido ya fue capturado');

  const scoreA = match.a === winnerId ? 11 : Number(loserScore);
  const scoreB = match.b === winnerId ? 11 : Number(loserScore);
  const validLoserScore = Number(loserScore);
  if (!Number.isInteger(validLoserScore) || validLoserScore < 0 || validLoserScore > 10) {
    throw new Error('El puntaje del perdedor debe estar entre 0 y 10');
  }
  if (winnerId !== match.a && winnerId !== match.b) {
    throw new Error('Ganador inválido');
  }

  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.winnerId = winnerId;
  match.finished = true;

  ensureKnockout(tournament);
  if (tournament.final && tournament.final.a && tournament.final.b && tournament.final.finished) {
    tournament.phase = 'done';
    tournament.champion = tournament.final.winnerId;
  }

  return tournament;
}

function resetTournament(pairs = []) {
  return {
    pairs,
    tournament: null,
  };
}

function publicState(state) {
  const tournament = state.tournament;
  const pairMap = new Map(state.pairs.map((p) => [p.id, p]));

  if (!tournament) {
    return {
      pairs: state.pairs.map(p => ({ ...p, group: null })),
      tournament: null,
      groupStandings: [],
      liveMatches: [],
      semis: [],
      final: null,
      champion: null,
    };
  }

  const pairGroupMap = new Map();
  tournament.groups.forEach(g => {
    g.pairs.forEach(p => {
      pairGroupMap.set(p.id, g.name);
    });
  });

  const groupStandings = tournament.groups.map((group) => ({
    id: group.id,
    name: group.name,
    standings: createStandings(group),
    rounds: group.matches.map((round) => round.map((m) => {
      const pairA = pairMap.get(m.a);
      const pairB = pairMap.get(m.b);
      return {
        ...m,
        aName: pairA?.name || '—',
        bName: pairB?.name || '—',
        aTeam: pairA?.team || '—',
        bTeam: pairB?.team || '—',
      };
    }))
  }));

  return {
    pairs: state.pairs.map(p => ({
      ...p,
      group: pairGroupMap.get(p.id) || null
    })),
    tournament: {
      ...tournament,
      groups: tournament.groups.map((group) => {
        const groupMatches = group.matches.map((round) => round.map((m) => {
          const pairA = pairMap.get(m.a);
          const pairB = pairMap.get(m.b);
          return {
            ...m,
            aName: pairA?.name || '—',
            bName: pairB?.name || '—',
            aTeam: pairA?.team || '—',
            bTeam: pairB?.team || '—',
          };
        }));
        return {
          ...group,
          pairs: group.pairs.map((p) => ({ ...p })),
          matches: groupMatches
        };
      }),
      semis: tournament.semis?.map((m) => ({
        ...m,
        aName: pairMap.get(m.a)?.name || 'Pendiente',
        bName: pairMap.get(m.b)?.name || 'Pendiente',
        aTeam: pairMap.get(m.a)?.team || '',
        bTeam: pairMap.get(m.b)?.team || '',
      })) || [],
      final: tournament.final ? {
        ...tournament.final,
        aName: pairMap.get(tournament.final.a)?.name || 'Pendiente',
        bName: pairMap.get(tournament.final.b)?.name || 'Pendiente',
        aTeam: pairMap.get(tournament.final.a)?.team || '',
        bTeam: pairMap.get(tournament.final.b)?.team || '',
      } : null,
      champion: tournament.champion,
    },
    groupStandings,
    liveMatches: tournament.groups.flatMap((group) => group.matches.flat().map((m) => ({
      ...m,
      aName: pairMap.get(m.a)?.name || '—',
      bName: pairMap.get(m.b)?.name || '—',
      aTeam: pairMap.get(m.a)?.team || '—',
      bTeam: pairMap.get(m.b)?.team || '—',
    }))),
    semis: tournament.semis?.map((m) => ({
      ...m,
      aName: pairMap.get(m.a)?.name || 'Pendiente',
      bName: pairMap.get(m.b)?.name || 'Pendiente',
    })) || [],
    final: tournament.final ? {
      ...tournament.final,
      aName: pairMap.get(tournament.final.a)?.name || 'Pendiente',
      bName: pairMap.get(tournament.final.b)?.name || 'Pendiente',
    } : null,
    champion: tournament.champion ? pairMap.get(tournament.champion) || null : null,
  };
}

function forceSemis(tournament) {
  if (tournament.phase !== 'groups') return tournament;
  tournament.phase = 'semis';
  return ensureKnockout(tournament);
}

module.exports = {
  uid,
  shuffle,
  splitBalancedByTeam,
  roundRobin,
  buildTournament,
  registerResult,
  resetTournament,
  publicState,
  createStandings,
  computeAdvancers,
  ensureKnockout,
  forceSemis,
};
