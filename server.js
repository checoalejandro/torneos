const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { readState, writeState, ensureStore } = require('./lib/store');
const { uid, buildTournament, registerResult, resetTournament, publicState, shuffle, splitBalancedByTeam, ensureKnockout } = require('./lib/tournament');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'atlas-2025';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-railway';
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12,
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

function isAdmin(req) {
  return Boolean(req.session.admin);
}

async function getState() {
  await ensureStore();
  const state = await readState();
  if (state.tournament) {
    const before = JSON.stringify(state);
    ensureKnockout(state.tournament);
    if (before !== JSON.stringify(state)) await writeState(state);
  }
  return state;
}

async function setState(state) {
  await writeState(state);
  io.emit('state', publicState(state));
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ ok: false, error: 'No autorizado' });
  next();
}

app.get('/', async (req, res) => {
  const state = await getState();
  res.render('index', {
    initial: publicState(state),
    isAdmin: isAdmin(req),
    adminHint: !isAdmin(req)
  });
});

app.post('/login', async (req, res) => {
  const password = String(req.body.password || '').trim();
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
  }
  req.session.admin = true;
  res.json({ ok: true });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/pairs', requireAdmin, async (req, res) => {
  const { team, name } = req.body;
  if (!team || !name) return res.status(400).json({ ok: false, error: 'Faltan datos' });
  const state = await getState();
  if (state.tournament) return res.status(400).json({ ok: false, error: 'No puedes registrar parejas con el torneo iniciado' });
  state.pairs.push({ id: uid('pair'), team, name: name.trim() });
  await setState(state);
  res.json({ ok: true });
});

app.post('/start', requireAdmin, async (req, res) => {
  const state = await getState();
  if (state.tournament) return res.status(400).json({ ok: false, error: 'El torneo ya inició' });
  if (state.pairs.length < 4) return res.status(400).json({ ok: false, error: 'Se requieren al menos 4 parejas' });
  const teamCounts = state.pairs.reduce((acc, p) => ((acc[p.team] = (acc[p.team] || 0) + 1), acc), {});
  if (!teamCounts['Atlas Chapalita'] || !teamCounts['Avila Camacho']) {
    return res.status(400).json({ ok: false, error: 'Debe haber parejas de ambos equipos' });
  }
  state.tournament = buildTournament(state.pairs);
  await setState(state);
  res.json({ ok: true });
});

app.post('/reorder', requireAdmin, async (req, res) => {
  const state = await getState();
  if (state.tournament) return res.status(400).json({ ok: false, error: 'El torneo ya inició' });
  state.pairs = shuffle(state.pairs);
  await setState(state);
  res.json({ ok: true });
});

app.post('/reset', requireAdmin, async (req, res) => {
  const state = resetTournament();
  await setState(state);
  req.session.admin = true;
  res.json({ ok: true });
});

app.post('/result', requireAdmin, async (req, res) => {
  try {
    const { matchId, winnerId, loserScore } = req.body;
    const state = await getState();
    if (!state.tournament) return res.status(400).json({ ok: false, error: 'No hay torneo activo' });
    registerResult(state.tournament, matchId, winnerId, Number(loserScore));
    await setState(state);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/state', async (req, res) => {
  const state = await getState();
  res.json({ ok: true, state: publicState(state), isAdmin: isAdmin(req) });
});

io.on('connection', async (socket) => {
  try {
    const cookies = socket.request.headers.cookie || '';
    const sessionId = /connect.sid=s%3A([^.;]+)/.exec(cookies)?.[1];
    socket.emit('ready', { ok: true, connected: true });
    const state = await getState();
    socket.emit('state', publicState(state));
  } catch {
    socket.emit('ready', { ok: false });
  }
});

(async () => {
  await ensureStore();
  const state = await getState();
  if (!state.pairs) await setState({ pairs: [], tournament: null });
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
