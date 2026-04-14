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
  list.innerHTML = state.pairs.map((p, idx) => `
    <div class="pair-chip fade-in">
      <div>
        <div class="team-badge">${fmtTeam(p.team)}</div>
        <div style="font-weight:800;font-size:1.05rem">${escapeHtml(p.name)}</div>
      </div>
      <div class="badge">#${idx + 1}</div>
    </div>
  `).join('');
}

function renderBracket() {
  const bracket = el('bracket');
  const p = state.tournament;
  const phase = p ? p.phase : 'registration';
  el('phaseLabel').textContent = p ? ({ groups: 'Fase de grupos', semis: 'Semifinales', final: 'Final', done: 'Torneo concluido' }[phase] || 'Fase de grupos') : 'Registro de parejas';
  el('championPill').textContent = state.champion ? `Campeón: ${state.champion.name}` : 'Sin campeón';

  if (!p) {
    bracket.innerHTML = `<div class="small">El cuadro aparecerá al iniciar el torneo.</div>`;
    return;
  }

  const groupsHtml = p.groups.map((group, i) => `
    <div class="bracket-card">
      <div class="match-head"><div><strong>${group.name}</strong><div class="small">Cancha ${group.court}</div></div><div class="badge">${group.matches.flat().length} partidos</div></div>
      <div class="small">${group.pairs.map(x => escapeHtml(x.name)).join(' · ')}</div>
    </div>
  `).join('');

  const semiHtml = (p.semis || []).map((m) => `
    <div class="bracket-card">
      <div class="team-badge">${m.label}</div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <div><strong>${escapeHtml(m.aName || 'Pendiente')}</strong></div>
        <div><strong>${escapeHtml(m.bName || 'Pendiente')}</strong></div>
      </div>
      <div class="small" style="margin-top:10px">${m.finished ? `${m.scoreA} - ${m.scoreB} · ganador: ${escapeHtml(m.winnerId === m.a ? m.aName : m.bName)}` : 'Pendiente de resultado'}</div>
    </div>
  `).join('') || `<div class="bracket-card"><div class="small">Semifinales se activan al cerrar la fase de grupos.</div></div>`;

  const finalHtml = p.final ? `
    <div class="bracket-card">
      <div class="team-badge">Final</div>
      <div style="display:grid;gap:8px;margin-top:10px">
        <div><strong>${escapeHtml(p.final.aName || 'Pendiente')}</strong></div>
        <div><strong>${escapeHtml(p.final.bName || 'Pendiente')}</strong></div>
      </div>
      <div class="small" style="margin-top:10px">${p.final.finished ? `Campeón: ${escapeHtml(state.champion?.name || '')}` : 'Pendiente de resultado'}</div>
    </div>
  ` : `<div class="bracket-card"><div class="small">La final aparecerá cuando se definan las semifinales.</div></div>`;

  bracket.innerHTML = `
    <div class="bracket-layout fade-in">
      <div class="match-list">${groupsHtml}</div>
      <div class="connector"></div>
      <div class="match-list">${semiHtml}${finalHtml}</div>
    </div>
  `;
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
    return `
      <div class="match-list" style="margin-bottom:22px">
        <div class="match-head"><div><strong>${group.name}</strong><div class="small">Resultados capturados en vivo</div></div><div class="badge">Cancha ${group.court}</div></div>
        ${rounds.map((round, ri) => `
          <div class="match-card fade-in">
            <div class="match-head"><div class="team-badge">Ronda ${ri + 1}</div><div class="small">${round.filter(m => m.finished).length}/${round.length} capturados</div></div>
            ${round.map((m) => `
              <div class="pair-chip" style="align-items:center">
                <div>
                  <div style="font-weight:800">${escapeHtml(m.aName)} <span class="small">(${escapeHtml(m.aTeam)})</span></div>
                  <div class="small">vs</div>
                  <div style="font-weight:800">${escapeHtml(m.bName)} <span class="small">(${escapeHtml(m.bTeam)})</span></div>
                </div>
                <div style="display:grid;justify-items:end;gap:8px">
                  <div class="badge ${m.finished ? 'inverse' : ''}">${m.finished ? `${m.scoreA} - ${m.scoreB}` : 'Pendiente'}</div>
                  ${m.finished ? `<div class="small">Ganador: ${escapeHtml((m.winnerId === m.a ? m.aName : m.bName) || '')}</div>` : `<button class="btn primary" data-capture="1" data-match='${escapeHtml(JSON.stringify(m))}'>Capturar</button>`}
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }).join('');

  holder.querySelectorAll('[data-capture]').forEach((btn) => {
    btn.addEventListener('click', () => openResultDialog(JSON.parse(btn.dataset.match)));
  });
}

function standingsRows(standings) {
  return standings.map((s, idx) => `
    <tr class="${idx === 0 ? 'row-top-1' : idx === 1 ? 'row-top-2' : ''}">
      <td><strong>${escapeHtml(s.name)}</strong><div class="small">${fmtTeam(s.team)}</div></td>
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
  el('loginBtn').classList.toggle('hidden', admin);
  el('logoutBtn').classList.toggle('hidden', !admin);
  el('reorderBtn').classList.toggle('hidden', !admin);
  el('startBtn').classList.toggle('hidden', !admin);
  el('resetBtn').classList.toggle('hidden', !admin);
  el('registerCard').classList.toggle('hidden', !admin);
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

function openResultDialog(match) {
  const dialog = el('resultDialog');
  const form = el('resultForm');
  const preview = el('resultPreview');
  const winnerInput = form.elements.winnerId;
  const matchInput = form.elements.matchId;
  const scoreInput = form.elements.loserScore;
  matchInput.value = match.id;
  scoreInput.value = 0;
  const a = `${match.aName} (${match.aTeam})`;
  const b = `${match.bName} (${match.bTeam})`;
  el('resultMatchTitle').textContent = `${match.phase === 'final' ? 'Final' : match.phase === 'semis' ? 'Semifinal' : 'Partido'} · ${a} vs ${b}`;
  preview.innerHTML = `
    <div><strong>Partido</strong><div class="small">${a} vs ${b}</div></div>
    <div class="row"><button type="button" class="btn ghost" id="winA">Ganador: ${escapeHtml(match.aName)}</button><button type="button" class="btn ghost" id="winB">Ganador: ${escapeHtml(match.bName)}</button></div>
    <div class="small">Se registrará 11 para el ganador y el número indicado para el perdedor.</div>
  `;
  const setWinner = (id) => {
    winnerInput.value = id;
    preview.querySelectorAll('button').forEach((b) => b.classList.remove('primary'));
  };
  dialog.showModal();
  preview.querySelector('#winA').onclick = () => setWinner(match.a);
  preview.querySelector('#winB').onclick = () => setWinner(match.b);
  setWinner(match.a);
}

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
el('resetBtn').addEventListener('click', async () => {
  if (!confirm('Este proceso elimina el torneo actual y deja el registro vacío. ¿Continuar?')) return;
  await api('/reset');
});

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

el('resultForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('/result', {
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
