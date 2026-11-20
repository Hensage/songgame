import { ensurePlayerIdInUrl, goHome } from './identity.js';

const playerID = ensurePlayerIdInUrl();
const POLL_INTERVAL_MS = 1000;
const ERROR_VISIBLE_MS = 1000;

const byId = (id) => document.getElementById(id);

let searching = false;
let updating = false;
let audioPlaying = false;
let playlistLink = '';
let errorTimer;

const showModal = (id) => bootstrap.Modal.getOrCreateInstance(byId(id)).show();
const hideModal = (id) => bootstrap.Modal.getOrCreateInstance(byId(id)).hide();

function showAddError(message) {
  const alert = byId('addModalError');
  alert.textContent = message;
  alert.classList.remove('d-none');

  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => alert.classList.add('d-none'), ERROR_VISIBLE_MS);
}

function artistNames(song) {
  return song.artists?.map((artist) => artist.name).join(', ') ?? '';
}

function albumArt(song) {
  return song.album?.images?.[0]?.url ?? '';
}

function setAlbumArt(row, song) {
  const image = row.querySelector('img');
  const url = albumArt(song);
  if (url) image.src = url;
  else image.removeAttribute('src');
}

function setSongName(row, song) {
  const name = row.querySelector('.songname');
  name.textContent = song.name ?? '';

  if (!song.explicit) return;

  const badge = document.createElement('span');
  badge.className = 'explicit-badge';
  badge.textContent = 'E';
  badge.title = 'Explicit';
  badge.setAttribute('aria-label', 'Explicit');
  name.appendChild(badge);
}

function setSearchBusy(busy) {
  searching = busy;

  for (const id of ['songinput', 'searchbutton', 'addModalClose', 'addModalClose2']) {
    byId(id).disabled = busy;
  }
  byId('searchloader').classList.toggle('d-none', !busy);
}

function revealAdminControls() {
  for (const element of document.querySelectorAll('.adminonly')) {
    element.classList.remove('d-none');
    if (element.classList.contains('flexElement')) element.classList.add('d-flex');
  }
}

function buildCountRows(songsPerPerson) {
  const template = byId('countRow0');

  for (let count = 1; count <= songsPerPerson; count += 1) {
    const row = template.cloneNode(true);
    row.id = `countRow${count}`;
    row.querySelector('.countText').textContent = count;

    const bar = row.querySelector('.progress-bar');
    bar.id = `countBar${count}`;
    bar.querySelector('.progressText').id = `countNumber${count}`;

    template.parentElement.appendChild(row);
  }
}

function maybePlayLobbyAudio() {
  if (audioPlaying || !navigator.userAgent.includes('Pixel')) return;

  audioPlaying = true;
  const audio = new Audio('/Lobby.mp3');
  audio.loop = true;
  audio.play().catch(() => {
    // Browsers block autoplay until the user interacts; ignore.
  });
}

function createSongRow(song) {
  const row = byId('examplesong').cloneNode(true);
  row.removeAttribute('id');
  row.classList.add('yoursong');
  row.classList.remove('d-none');
  row.dataset.songId = song.id;

  setAlbumArt(row, song);
  setSongName(row, song);
  row.querySelector('.songartist').textContent = artistNames(song);

  row.querySelector('button').addEventListener('click', () => removeSong(song.id));
  return row;
}

function renderSongs(items) {
  const unseenIds = items.map((song) => song.id);
  const container = byId('yoursongs');

  for (const row of document.querySelectorAll('.yoursong')) {
    const index = unseenIds.indexOf(row.dataset.songId);
    if (index === -1) {
      row.remove();
    } else {
      unseenIds.splice(index, 1);
    }
  }

  for (const song of items) {
    const index = unseenIds.indexOf(song.id);
    if (index === -1) continue;

    unseenIds.splice(index, 1);
    container.appendChild(createSongRow(song));
  }
}

function renderCounts(state) {
  state.countCounts.forEach((count, index) => {
    const bar = byId(`countBar${index}`);
    const number = byId(`countNumber${index}`);
    if (!bar || !number) return;

    bar.style.width = state.playerCount > 0 ? `${(count / state.playerCount) * 100}%` : '0%';
    number.textContent = count;
  });

  byId('playlistcount').textContent = `${state.count} / ${state.playerCount * state.songsPerPerson}`;
  byId('playercount').textContent = state.playerCount;
  byId('yoursongcount').textContent = `${state.items.length} / ${state.songsPerPerson}`;
  byId('addSongButton').disabled = state.items.length >= state.songsPerPerson;
}

function showEndGame(state) {
  if (state.playlistURL) playlistLink = state.playlistURL;

  showModal('staticBackdrop');

  if (playlistLink) {
    byId('endGameText').textContent = 'The link to the playlist here';
    byId('spotLink').classList.remove('d-none');
  } else if (navigator.userAgent.includes('Pixel')) {
    byId('endGameText').textContent = "Game's done bitch";
    byId('domphoto').classList.remove('d-none');
  }
}

async function update() {
  if (updating) return;
  updating = true;

  try {
    const response = await fetch(`/update?playerID=${encodeURIComponent(playerID)}`);
    const state = await response.json();

    if (!state.validGame) {
      goHome(playerID);
      return;
    }

    if (!state.isPlaying) {
      showEndGame(state);
      return;
    }

    renderSongs(state.items);
    renderCounts(state);
  } catch (error) {
    console.error('Could not refresh game state', error);
  } finally {
    updating = false;
  }
}

function createSuggestion(song) {
  const row = byId('exampleaddsong').cloneNode(true);
  row.removeAttribute('id');
  row.classList.remove('d-none');

  setAlbumArt(row, song);
  setSongName(row, song);
  row.querySelector('.songartist').textContent = artistNames(song);

  row.addEventListener('click', () => {
    byId('suggestions').replaceChildren();
    byId('songinput').value = '';
    addSong(song);
  });

  return row;
}

async function searchSongs() {
  if (searching) return;

  const suggestions = byId('suggestions');
  setSearchBusy(true);
  suggestions.replaceChildren();
  byId('addModalError').classList.add('d-none');

  try {
    const query = encodeURIComponent(byId('songinput').value);
    const response = await fetch(`/search?playerID=${encodeURIComponent(playerID)}&query=${query}`);

    if (!response.ok) {
      showAddError(await response.text());
      return;
    }

    const songs = await response.json();
    if (!Array.isArray(songs)) {
      showAddError('Game not found');
      return;
    }

    for (const song of songs) {
      suggestions.appendChild(createSuggestion(song));
    }
  } catch (error) {
    console.error('Song search failed', error);
    showAddError('Could not search for songs');
  } finally {
    setSearchBusy(false);
  }
}

async function addSong(song) {
  try {
    const response = await fetch(`/add?playerID=${encodeURIComponent(playerID)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    const message = await response.text();

    if (!response.ok) {
      showAddError(message);
      return;
    }

    hideModal('addModal');
    byId('suggestions').replaceChildren();
    byId('songinput').value = '';
    await update();
  } catch (error) {
    console.error('Could not add song', error);
    showAddError('Could not add song');
  }
}

async function removeSong(songID) {
  try {
    await fetch(`/remove?playerID=${encodeURIComponent(playerID)}&songID=${encodeURIComponent(songID)}`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Could not remove song', error);
  }

  await update();
}

async function clearSongs() {
  try {
    await fetch(`/clear?playerID=${encodeURIComponent(playerID)}`, { method: 'POST' });
  } catch (error) {
    console.error('Could not clear songs', error);
  }

  await update();
}

async function submitGame() {
  try {
    const response = await fetch(`/submit?playerID=${encodeURIComponent(playerID)}`, { method: 'POST' });
    const body = await response.text();

    if (!response.ok) {
      alert(body);
      return;
    }

    playlistLink = body;
  } catch (error) {
    console.error('Could not submit playlist', error);
    alert('Could not submit playlist');
  }

  await update();
}

async function leaveGame() {
  try {
    await fetch(`/leaveGame?playerID=${encodeURIComponent(playerID)}`, { method: 'POST' });
  } catch (error) {
    console.error('Could not leave game', error);
  }

  goHome(playerID);
}

async function closeGame() {
  try {
    await fetch(`/closeGame?playerID=${encodeURIComponent(playerID)}`, { method: 'POST' });
  } catch (error) {
    console.error('Could not close game', error);
  }

  goHome(playerID);
}

function closeAddModal() {
  if (!searching) hideModal('addModal');
}

function bindEvents() {
  byId('searchbutton').addEventListener('click', searchSongs);
  byId('songinput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchSongs();
  });

  byId('addModalClose').addEventListener('click', closeAddModal);
  byId('addModalClose2').addEventListener('click', closeAddModal);

  for (const button of document.querySelectorAll('[data-action="submit-game"]')) {
    button.addEventListener('click', submitGame);
  }
  for (const button of document.querySelectorAll('[data-action="clear-songs"]')) {
    button.addEventListener('click', clearSongs);
  }
  for (const button of document.querySelectorAll('[data-action="leave-game"]')) {
    button.addEventListener('click', leaveGame);
  }
  for (const button of document.querySelectorAll('[data-action="close-game"]')) {
    button.addEventListener('click', closeGame);
  }

  byId('spotLink').addEventListener('click', () => {
    if (playlistLink) window.open(playlistLink, '_blank', 'noopener');
  });
}

async function init() {
  let info;
  try {
    const response = await fetch(`/loadinfo?playerID=${encodeURIComponent(playerID)}`);
    info = await response.json();
  } catch (error) {
    console.error('Could not load game info', error);
    return;
  }

  if (!info.validGame) {
    goHome(playerID);
    return;
  }

  byId('hostname').textContent = `The host is ${info.hostName}`;
  if (info.isPlayerHost) revealAdminControls();

  buildCountRows(info.songsPerPerson);
  bindEvents();
  maybePlayLobbyAudio();

  await update();
  setInterval(update, POLL_INTERVAL_MS);
}

init().catch((error) => console.error('Could not start the game page', error));