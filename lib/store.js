const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify({ pairs: [], tournament: null }, null, 2));
  }
}

async function readState() {
  await ensureStore();
  const raw = await fs.readFile(STATE_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeState(state) {
  await ensureStore();
  const tmp = STATE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.rename(tmp, STATE_FILE);
}

module.exports = { readState, writeState, ensureStore };
