const socket = io();
const app = document.getElementById('app');
let state = window.__INITIAL__;
let isAdmin = app.dataset.admin === '1';
let activeTab = '1';

const el = (id) => document.getElementById(id);
const fmtTeam = (team) => team === 'Avila Camacho' ? 'Ávila Camacho' : team;

function pairLabel(p) {
  if (!p) return 'Pendiente';
  return `${p.name}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function renderPairs() {
  const list = el('pairsList');
  if (!state.pairs.length) {
    list.innerHTML = `<div class="small">Aún no hay parejas registradas.</div>`;
    return;
  }
  
  const sortedPairs = [...state.pairs].sort((a, b) => {
    // Primero por equipo (Atlas Chapalita antes que Avila Camacho)
    if (a.team !== b.team) {
      return a.team === 'Atlas Chapalita' ? -1 : 1;
    }
    // Segundo por grupo si existe
    if (a.group && b.group && a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    return 0;
  });

  list.innerHTML = sortedPairs.map((p, idx) => `
    <div class="pair-chip fade-in">
      <div>
        <div class="team-badge">${fmtTeam(p.team)} ${p.group ? `· ${p.group}` : ''}</div>
        <div style="font-weight:800;font-size:1.05rem">${escapeHtml(p.name)}</div>
      </div>
      <div class="pair-side">
        <div class="badge">#${idx + 1}</div>
        ${isAdmin && !state.tournament ? `
          <div class="pair-actions">
            <button class="btn ghost" type="button" data-edit-pair="${escapeHtml(p.id)}"><span class="material-symbols-outlined">edit</span> Editar</button>
            <button class="btn ghost" type="button" data-delete-pair="${escapeHtml(p.id)}"><span class="material-symbols-outlined">delete</span> Eliminar</button>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit-pair]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pair = state.pairs.find((item) => item.id === btn.dataset.editPair);
      if (pair) openPairDialog(pair);
    });
  });

  list.querySelectorAll('[data-delete-pair]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pairId = btn.dataset.deletePair;
      const pair = state.pairs.find((item) => item.id === pairId);
      if (!pair) return;
      if (!confirm(`¿Eliminar la pareja \"${pair.name}\"?`)) return;
      await api('/pairs/delete', { id: pairId });
    });
  });
}

function renderBracket() {
  const bracket = el('bracket');
  const p = state.tournament;
  const phase = p ? p.phase : 'registration';
  el('phaseLabel').textContent = p ? ({ groups: 'Fase de grupos', semis: 'Semifinales', final: 'Final', done: 'Torneo concluido' }[phase] || 'Fase de grupos') : 'Registro de parejas';
  
  if (state.champion) {
    el('championPill').innerHTML = `<span class="material-symbols-outlined" style="color:inherit">trophy</span> Campeón: ${escapeHtml(state.champion.name)}`;
    el('championPill').className = 'pill gold fade-in';
  } else {
    el('championPill').textContent = 'Sin campeón';
    el('championPill').className = 'pill';
  }

  if (!p) {
    bracket.innerHTML = `<div class="small">El cuadro aparecerá al iniciar el torneo.</div>`;
    return;
  }

  const semiHtml = (p.semis || []).map((m) => `
    <div class="bracket-card">
      <div class="team-badge">${m.label}</div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <div class="${m.finished && m.winnerId === m.a ? 'winner-highlight' : ''}" style="padding:2px 6px;border-radius:4px"><strong>${escapeHtml(m.aName || 'Pendiente')}</strong> <span class="small" style="${m.finished && m.winnerId === m.a ? 'color:rgba(255,255,255,.8)' : ''}">(${escapeHtml(m.aTeam)})</span></div>
        <div class="${m.finished && m.winnerId === m.b ? 'winner-highlight' : ''}" style="padding:2px 6px;border-radius:4px"><strong>${escapeHtml(m.bName || 'Pendiente')}</strong> <span class="small" style="${m.finished && m.winnerId === m.b ? 'color:rgba(255,255,255,.8)' : ''}">(${escapeHtml(m.bTeam)})</span></div>
      </div>
      <div class="small" style="margin-top:10px">${m.finished ? `${m.scoreA} - ${m.scoreB} · ganador: ${escapeHtml(m.winnerId === m.a ? m.aName : m.bName)}` : 'Pendiente de resultado'}</div>
      ${isAdmin && !m.finished && m.a && m.b ? `<button class="btn primary" style="margin-top:10px;width:100%" data-capture="1" data-match='${escapeHtml(JSON.stringify(m))}'>Capturar</button>` : ''}
    </div>
  `).join('') || `<div class="bracket-card"><div class="small">Las semifinales aparecerán al cerrar la fase de grupos.</div></div>`;

  const finalHtml = p.final ? `
    <div class="bracket-card">
      <div class="team-badge">Final</div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <div class="${p.final.finished && p.final.winnerId === p.final.a ? 'winner-highlight' : ''}" style="padding:2px 6px;border-radius:4px"><strong>${escapeHtml(p.final.aName || 'Pendiente')}</strong> <span class="small" style="${p.final.finished && p.final.winnerId === p.final.a ? 'color:rgba(255,255,255,.8)' : ''}">(${escapeHtml(p.final.aTeam)})</span></div>
        <div class="${p.final.finished && p.final.winnerId === p.final.b ? 'winner-highlight' : ''}" style="padding:2px 6px;border-radius:4px"><strong>${escapeHtml(p.final.bName || 'Pendiente')}</strong> <span class="small" style="${p.final.finished && p.final.winnerId === p.final.b ? 'color:rgba(255,255,255,.8)' : ''}">(${escapeHtml(p.final.bTeam)})</span></div>
      </div>
      <div class="small" style="margin-top:10px">${p.final.finished ? `<span class="material-symbols-outlined" style="font-size:14px;vertical-align:middle;color:var(--gold)">trophy</span> Campeón: ${escapeHtml(state.champion?.name || '')}` : 'Pendiente de resultado'}</div>
      ${isAdmin && !p.final.finished && p.final.a && p.final.b ? `<button class="btn primary" style="margin-top:10px;width:100%" data-capture="1" data-match='${escapeHtml(JSON.stringify(p.final))}'>Capturar</button>` : ''}
    </div>
  ` : `<div class="bracket-card"><div class="small">La final aparecerá cuando se definan las semifinales.</div></div>`;

  bracket.innerHTML = `
    <div class="bracket-layout fade-in">
      <div class="match-list">${semiHtml}</div>
      <div class="connector"></div>
      <div class="match-list">${finalHtml}</div>
    </div>
  `;

  bracket.querySelectorAll('[data-capture]').forEach((btn) => {
    btn.addEventListener('click', () => openResultDialog(JSON.parse(btn.dataset.match)));
  });
}

function renderMatches() {
  const holder = el('matches');
  if (!state.tournament) {
    holder.innerHTML = `<div class="small">Aún no existe cuadro. Registra parejas y presiona iniciar.</div>`;
    return;
  }
  const groups = state.tournament.groups || [];
  holder.innerHTML = groups.map((group) => {
    const rounds = group.matches || [];
    const allMatches = rounds.flat();
    return `
      <div class="match-list" style="margin-bottom:22px">
        <div class="match-head"><div><strong>${group.name}</strong><div class="small">Resultados capturados en vivo</div></div><div class="badge">Cancha ${group.court}</div></div>
        <div class="match-card fade-in">
          <div class="match-head"><div class="small">${allMatches.filter(m => m.finished).length}/${allMatches.length} capturados</div></div>
          ${allMatches.map((m) => `
            <div class="pair-chip" style="align-items:center">
              <div>
                <div style="font-weight:800;display:inline-block;padding:2px 6px;border-radius:4px" class="${m.finished && m.winnerId === m.a ? 'winner-highlight' : ''}">${escapeHtml(m.aName)} <span class="small" style="${m.finished && m.winnerId === m.a ? 'color:rgba(255,255,255,.8)' : ''}">(${escapeHtml(m.aTeam)})</span></div>
                <div class="small">vs</div>
                <div style="font-weight:800;display:inline-block;padding:2px 6px;border-radius:4px" class="${m.finished && m.winnerId === m.b ? 'winner-highlight' : ''}">${escapeHtml(m.bName)} <span class="small" style="${m.finished && m.winnerId === m.b ? 'color:rgba(255,255,255,.8)' : ''}">(${escapeHtml(m.bTeam)})</span></div>
              </div>
              <div style="display:grid;justify-items:end;gap:8px">
                <div class="badge">${m.finished ? `${m.scoreA} - ${m.scoreB}` : 'Pendiente'}</div>
                ${m.finished ? (isAdmin && (state.tournament.phase === 'groups' || state.tournament.phase === 'semis') ? `<button class="btn ghost" data-edit-match='${escapeHtml(JSON.stringify(m))}'>Editar</button>` : `<div class="small">Ganador: ${escapeHtml((m.winnerId === m.a ? m.aName : m.bName) || '')}</div>`) : (isAdmin ? `<button class="btn primary" data-capture="1" data-match='${escapeHtml(JSON.stringify(m))}'>Capturar</button>` : '')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  holder.querySelectorAll('[data-capture]').forEach((btn) => {
    btn.addEventListener('click', () => openResultDialog(JSON.parse(btn.dataset.match)));
  });

  holder.querySelectorAll('[data-edit-match]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const match = JSON.parse(btn.dataset.editMatch);
      openResultDialog(match, true);
    });
  });
}

function standingsRows(standings) {
  return standings.map((s, idx) => `
    <tr class="${idx === 0 ? 'row-top-1' : idx === 1 ? 'row-top-2' : ''}">
      <td><div><strong>${escapeHtml(s.name)}</strong></div><div class="small">${fmtTeam(s.team)}</div></td>
      <td>${s.played}</td>
      <td>${s.wins}</td>
      <td>${s.pointsFor}</td>
      <td>${s.pointsAgainst}</td>
      <td><strong>${s.diff}</strong></td>
    </tr>
  `).join('');
}

function renderStandings() {
  const holder = el('standings');
  if (!state.tournament) {
    holder.innerHTML = `<div class="small">La tabla aparecerá al iniciar el torneo.</div>`;
    return;
  }
  const group = (state.groupStandings || []).find((g) => String(g.id) === activeTab) || state.groupStandings[0];
  if (!group) return;
  holder.innerHTML = `
    <div class="standing-card fade-in">
      <div class="standing-head"><div><strong>Tabla ${group.name}</strong><div class="small">Se actualiza en tiempo real</div></div><div class="badge">Orden automático</div></div>
      <table class="table">
        <thead>
          <tr><th>Pareja</th><th>PJ</th><th>PG</th><th>PGanados</th><th>PPerdidos</th><th>Diferencia</th></tr>
        </thead>
        <tbody>${standingsRows(group.standings || [])}</tbody>
      </table>
    </div>
  `;
}

function refreshVisibility() {
  const admin = isAdmin;
  const p = state.tournament;
  el('loginBtn').classList.toggle('hidden', admin);
  el('logoutBtn').classList.toggle('hidden', !admin);
  el('reorderBtn').classList.toggle('hidden', !admin || !!p);
  el('startBtn').classList.toggle('hidden', !admin || !!p);
  el('finishGroupsBtn').classList.toggle('hidden', !admin || !p || p.phase !== 'groups');
  el('resetBtn').classList.toggle('hidden', !admin);
  el('registerCard').classList.toggle('hidden', !admin || !!p);
}

function renderAll() {
  refreshVisibility();
  renderPairs();
  renderBracket();
  renderMatches();
  renderStandings();
}

function openLogin() {
  el('loginError').textContent = '';
  el('loginDialog').showModal();
}

function openResultDialog(match, isEdit = false) {
  const dialog = el('resultDialog');
  const form = el('resultForm');
  const preview = el('resultPreview');
  const winnerInput = form.elements.winnerId;
  const matchInput = form.elements.matchId;
  const scoreInput = form.elements.loserScore;
  
  form.dataset.isEdit = isEdit ? '1' : '0';
  matchInput.value = match.id;
  scoreInput.value = isEdit ? (match.winnerId === match.a ? match.scoreB : match.scoreA) : 0;
  
  const a = `${match.aName} (${match.aTeam})`;
  const b = `${match.bName} (${match.bTeam})`;
  el('resultMatchTitle').textContent = `${isEdit ? 'Editar' : 'Confirmar'} ${match.phase === 'final' ? 'Final' : match.phase === 'semis' ? 'Semifinal' : 'Partido'} · ${a} vs ${b}`;
  
  preview.innerHTML = `
    <div><strong>Partido</strong><div class="small">${a} vs ${b}</div></div>
    <div class="row"><button type="button" class="btn ghost" id="winA">Ganador: ${escapeHtml(match.aName)}</button><button type="button" class="btn ghost" id="winB">Ganador: ${escapeHtml(match.bName)}</button></div>
    <div class="small">Se registrará 11 para el ganador y el número indicado para el perdedor.</div>
  `;
  
  const setWinner = (id) => {
    winnerInput.value = id;
    preview.querySelectorAll('button').forEach((b) => {
      b.classList.remove('btn-winner');
      const icon = b.querySelector('.material-symbols-outlined');
      if (icon) icon.remove();
    });
    const selectedBtn = id === match.a ? preview.querySelector('#winA') : preview.querySelector('#winB');
    selectedBtn.classList.add('btn-winner');
    selectedBtn.insertAdjacentHTML('afterbegin', '<span class="material-symbols-outlined">check</span>');
  };
  
  dialog.showModal();
  preview.querySelector('#winA').onclick = () => setWinner(match.a);
  preview.querySelector('#winB').onclick = () => setWinner(match.b);
  setWinner(isEdit ? match.winnerId : match.a);
}

function openPairDialog(pair) {
  const dialog = el('pairDialog');
  const form = el('pairEditForm');
  el('pairError').textContent = '';
  form.elements.id.value = pair.id;
  form.elements.team.value = pair.team;
  form.elements.name.value = pair.name;
  dialog.showModal();
}

el('resultForm').querySelector('[value="cancel"][type="button"]').addEventListener('click', () => {
  el('resultDialog').close();
});

el('pairEditForm').querySelector('[value="cancel"][type="button"]').addEventListener('click', () => {
  el('pairDialog').close();
});

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

el('loginBtn').addEventListener('click', openLogin);
el('logoutBtn').addEventListener('click', async () => {
  await api('/logout');
  location.reload();
});
el('reorderBtn').addEventListener('click', async () => {
  await api('/reorder');
});
el('startBtn').addEventListener('click', async () => {
  await api('/start');
});
el('finishGroupsBtn').addEventListener('click', async () => {
  if (!confirm('¿Deseas cerrar la fase de grupos e iniciar las semifinales con los standings actuales?')) return;
  await api('/finish-groups');
});
el('resetBtn').addEventListener('click', async () => {
  if (!confirm('Este proceso elimina el progreso del torneo pero conserva el registro de parejas. ¿Continuar?')) return;
  await api('/reset');
});

el('rulesBtn').addEventListener('click', () => {
  el('rulesDialog').showModal();
});

el('closeRules').addEventListener('click', () => el('rulesDialog').close());
el('closeRulesBtn').addEventListener('click', () => el('rulesDialog').close());

el('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = e.target.password.value;
  try {
    await api('/login', { password });
    location.reload();
  } catch (err) {
    el('loginError').textContent = err.message;
  }
});

el('pairForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  await api('/pairs', Object.fromEntries(form.entries()));
  e.target.reset();
});

el('pairEditForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/pairs/update', Object.fromEntries(form.entries()));
    el('pairDialog').close();
  } catch (err) {
    el('pairError').textContent = err.message;
  }
});

el('resultForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const isEdit = form.dataset.isEdit === '1';
  try {
    await api(isEdit ? '/result/update' : '/result', {
      matchId: form.elements.matchId.value,
      winnerId: form.elements.winnerId.value,
      loserScore: form.elements.loserScore.value,
    });
    el('resultDialog').close();
  } catch (err) {
    el('resultError').textContent = err.message;
  }
});

el('standingsSection').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  activeTab = tab.dataset.tab;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
  renderStandings();
});

socket.on('state', (next) => {
  state = next;
  el('app').classList.add('fade-in');
  setTimeout(() => el('app').classList.remove('fade-in'), 200);
  renderAll();
});

renderAll();
