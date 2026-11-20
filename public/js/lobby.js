import { ensurePlayerIdInUrl } from './identity.js';

const playerID = ensurePlayerIdInUrl();
const POLL_INTERVAL_MS = 1000;
const DEFAULT_SONG_COUNT = '3';
const CURRENT_YEAR = new Date().getFullYear();

const byId = (id) => document.getElementById(id);

let genres = [];
let polling = false;
let yourGameID = null;

function populateGenreDropdown(items) {
  const menu = byId('dropdownMenu');
  menu.replaceChildren(
    ...items.map((item) => {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'dropdown-item';
      link.href = '#';
      link.textContent = item;
      listItem.appendChild(link);
      return listItem;
    }),
  );
}

function toggleGenreDropdown(show) {
  byId('dropdownMenu').classList.toggle('show', show);
}

async function loadGenres() {
  try {
    const response = await fetch('/spotifyGenres.json');
    genres = await response.json();
    populateGenreDropdown(genres);
  } catch (error) {
    console.error('Could not load genres', error);
  }
}

function startLogin() {
  const selected = document.querySelector('input[name="songcount"]:checked');
  const searchTerm = byId('searchInput').value.trim().toLowerCase();
  const params = new URLSearchParams({
    playerID,
    songCount: selected?.value ?? DEFAULT_SONG_COUNT,
    era: `${byId('afterRange').value}-${byId('beforeRange').value}`,
    genre: genres.includes(searchTerm) ? searchTerm : '',
  });

  byId('loginSpinner').classList.remove('d-none');
  byId('login').disabled = true;
  window.location = `/login?${params}`;
}

async function joinGame(gameID) {
  try {
    await fetch(`/joinGame?playerID=${encodeURIComponent(playerID)}&gameID=${encodeURIComponent(gameID)}`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Could not join game', error);
  }

  window.location = `/?playerID=${encodeURIComponent(playerID)}`;
}

function createGameRow(game) {
  const row = byId('exampleGame').cloneNode(true);
  row.removeAttribute('id');
  row.dataset.gameId = game.gameid;
  row.classList.add('games');
  row.classList.remove('d-none');

  row.querySelector('.gamelabel').textContent = `${game.hostName}'s Game`;
  row.querySelector('button').addEventListener('click', () => joinGame(game.gameid));
  return row;
}

function renderYourGame(game) {
  const container = byId('yourgame');
  const loginButton = byId('login');

  if (!game) {
    yourGameID = null;
    container.classList.add('d-none');
    loginButton.classList.remove('d-none');
    return;
  }

  yourGameID = game.gameid;
  container.classList.remove('d-none');
  loginButton.classList.add('d-none');
}

function renderOtherGames(games) {
  const container = byId('joingames');
  const existing = new Map(
    Array.from(container.querySelectorAll('.games'), (row) => [row.dataset.gameId, row]),
  );

  for (const [gameID, row] of existing) {
    if (!games.some((game) => game.gameid === gameID)) row.remove();
  }

  for (const game of games) {
    if (!existing.has(game.gameid)) container.appendChild(createGameRow(game));
  }

  byId('nogames').classList.toggle('d-none', games.length > 0);
}

async function checkForGames() {
  if (polling) return;
  polling = true;

  try {
    const response = await fetch(`/getGames?playerID=${encodeURIComponent(playerID)}`);
    if (!response.ok) return;

    const games = await response.json();
    renderYourGame(games.yourGame);
    renderOtherGames(games.otherGames);
  } catch (error) {
    console.error('Could not load games', error);
  } finally {
    polling = false;
  }
}

function configureYearRange() {
  const after = byId('afterRange');
  const before = byId('beforeRange');

  after.max = String(CURRENT_YEAR);
  before.max = String(CURRENT_YEAR);
  before.value = String(CURRENT_YEAR);

  byId('afterYear').textContent = after.value;
  byId('beforeYear').textContent = before.value;
}

function syncYearRanges() {
  const after = byId('afterRange');
  const before = byId('beforeRange');

  after.addEventListener('input', () => {
    if (Number(after.value) > Number(before.value)) before.value = after.value;
    byId('afterYear').textContent = after.value;
  });

  before.addEventListener('input', () => {
    if (Number(before.value) < Number(after.value)) after.value = before.value;
    byId('beforeYear').textContent = before.value;
  });
}

function bindGenrePicker() {
  const searchInput = byId('searchInput');
  const menu = byId('dropdownMenu');

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    populateGenreDropdown(genres.filter((genre) => genre.toLowerCase().includes(searchTerm)));
    toggleGenreDropdown(searchTerm.length > 0);
  });

  menu.addEventListener('click', (event) => {
    if (!event.target.classList.contains('dropdown-item')) return;

    event.preventDefault();
    searchInput.value = event.target.textContent;
    toggleGenreDropdown(false);
  });

  document.addEventListener('click', (event) => {
    if (event.target !== searchInput) toggleGenreDropdown(false);
  });
}

byId('createGameButton').addEventListener('click', startLogin);
byId('rejoinButton').addEventListener('click', () => {
  if (yourGameID) joinGame(yourGameID);
});

bindGenrePicker();
configureYearRange();
syncYearRanges();
loadGenres();

checkForGames();
setInterval(checkForGames, POLL_INTERVAL_MS);