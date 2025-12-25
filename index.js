const repo = "Kaytheprogrammingidiot/vizion4-videos";
const baseApi = `https://api.github.com/repos/${repo}/contents/shows`;

// ===== CHANNEL CONFIG =====
const CHANNEL_START = 1704067200; // Jan 1 2024 UTC
const UP_NEXT_SECONDS = 10;

// ===== DOM =====
const homeContainer = document.getElementById("home-list");
const liveContainer = document.getElementById("live-container");
const myListContainer = document.getElementById("mylist-list");
const recentContainer = document.getElementById("recent-list");
const searchInput = document.getElementById("search");
const tabs = document.querySelectorAll("#tabs button");

// ===== STATE =====
let allShows = [];
let currentTab = "home";

let liveEpisodes = [];
let liveIndex = 0;
let liveLoaded = false;
let upNextShown = false;
let liveVideo = null;

/* ===================== TABS ===================== */
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    // stop live audio if leaving live tab
    if (currentTab === "live" && tab.dataset.tab !== "live") {
      stopLivePlayback();
    }

    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    currentTab = tab.dataset.tab;

    homeContainer.style.display = currentTab === "home" ? "grid" : "none";
    liveContainer.style.display = currentTab === "live" ? "block" : "none";
    myListContainer.style.display = currentTab === "mylist" ? "grid" : "none";
    recentContainer.style.display = currentTab === "recent" ? "grid" : "none";

    if (currentTab === "mylist") renderMyList(myListContainer);
    if (currentTab === "recent") renderRecent(recentContainer);
    if (currentTab === "live") loadLiveTV();
    if (currentTab === "home") renderShows(allShows, homeContainer);
  });
});

/* ===================== LOAD SHOWS ===================== */
async function loadAllShows() {
  const authors = await fetch(baseApi).then(r => r.json());

  for (const author of authors) {
    if (author.type !== "dir") continue;

    const shows = await fetch(`${baseApi}/${author.name}`).then(r => r.json());

    for (const show of shows) {
      if (show.type !== "dir") continue;

      const files = await fetch(`${baseApi}/${author.name}/${show.name}`).then(r => r.json());
      const infoMeta = files.find(f => f.name === "info.json");
      if (!infoMeta) continue;

      const info = await fetch(infoMeta.download_url).then(r => r.json());
      const icon = files.find(f => /\.(png|jpg|jpeg)$/i.test(f.name));

      allShows.push({
        title: info.title,
        author: info.author || author.name,
        iconUrl: icon ? icon.download_url : null,
        link: `show.html?author=${author.name}&name=${show.name}`,
        id: `${author.name}_${info.title}`
      });
    }
  }

  renderShows(allShows, homeContainer);
}

/* ===================== RENDER SHOWS ===================== */
function renderShows(shows, container) {
  container.innerHTML = "";
  const myList = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");

  shows.forEach(show => {
    const isInList = myList.some(s => s.id === show.id);
    const div = document.createElement("div");
    div.className = "show";

    div.innerHTML = `
      ${show.iconUrl ? `<img src="${show.iconUrl}">` : ""}
      <h2>${show.title}</h2>
      <p>By ${show.author}</p>
      <a href="${show.link}">Watch</a>
      <button data-id="${show.id}">
        ${isInList ? "Remove from My List" : "Add to My List"}
      </button>
    `;

    const button = div.querySelector("button");
    button.onclick = () => toggleMyList(show.id);

    container.appendChild(div);
  });
}

/* ===================== MY LIST ===================== */
function toggleMyList(id) {
  let list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
  const show = allShows.find(s => s.id === id);

  if (list.some(s => s.id === id)) {
    list = list.filter(s => s.id !== id);
  } else {
    list.push(show);
  }

  localStorage.setItem("vizion4_mylist", JSON.stringify(list));

  // refresh visible views
  if (currentTab === "home") renderShows(allShows, homeContainer);
  if (currentTab === "mylist") renderMyList(myListContainer);
}

function renderMyList(container) {
  const list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
  if (!list.length) {
    container.innerHTML = "<p>No shows in your list yet.</p>";
  } else {
    renderShows(list, container);
  }
}

function renderRecent(container) {
  const list = JSON.parse(localStorage.getItem("vizion4_recent_shows") || "[]");
  if (!list.length) {
    container.innerHTML = "<p>No recently watched shows.</p>";
  } else {
    renderShows(list, container);
  }
}

/* ===================== SEARCH ===================== */
searchInput.oninput = () => {
  const q = searchInput.value.toLowerCase();
  renderShows(
    allShows.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.author.toLowerCase().includes(q)
    ),
    homeContainer
  );
};

/* ===================== LIVE TV ===================== */
async function loadLiveTV() {
  if (liveLoaded) return;
  liveLoaded = true;

  liveContainer.innerHTML = "<p>Loading live broadcast…</p>";

  const authors = await fetch(baseApi).then(r => r.json());

  for (const author of authors) {
    if (author.type !== "dir") continue;

    const shows = await fetch(`${baseApi}/${author.name}`).then(r => r.json());

    for (const show of shows) {
      if (show.type !== "dir") continue;

      const files = await fetch(`${baseApi}/${author.name}/${show.name}`).then(r => r.json());

      files.filter(f => f.name.endsWith(".mp4")).forEach(f => {
        liveEpisodes.push({
          url: f.download_url,
          label: `${show.name} – ${f.name}`,
          duration: 0
        });
      });
    }
  }

  liveEpisodes.sort((a, b) => hash(a.url) - hash(b.url));
  preloadDurations(0);
}

function stopLivePlayback() {
  if (liveVideo) {
    liveVideo.pause();
    liveVideo.src = "";
    liveVideo.load();
    liveVideo = null;
  }
  liveContainer.innerHTML = "";
}

/* ===================== PRELOAD DURATIONS ===================== */
function preloadDurations(i) {
  if (i >= liveEpisodes.length) {
    startLiveFromClock();
    return;
  }

  const v = document.createElement("video");
  v.src = liveEpisodes[i].url;
  v.preload = "metadata";

  v.onloadedmetadata = () => {
    liveEpisodes[i].duration = v.duration;
    preloadDurations(i + 1);
  };
}

/* ===================== CHANNEL CLOCK ===================== */
function startLiveFromClock() {
  const now = Math.floor(Date.now() / 1000);
  let elapsed = now - CHANNEL_START;

  let index = 0;
  while (elapsed > liveEpisodes[index].duration) {
    elapsed -= liveEpisodes[index].duration;
    index = (index + 1) % liveEpisodes.length;
  }

  liveIndex = index;
  playLiveEpisodeAt(elapsed);
}

/* ===================== PLAYBACK ===================== */
function playLiveEpisodeAt(offset) {
  upNextShown = false;
  const ep = liveEpisodes[liveIndex];
  const next = liveEpisodes[(liveIndex + 1) % liveEpisodes.length];

  liveContainer.innerHTML = `
    <h2>🔴 Live Now</h2>
    <div style="position:relative">
      <video id="livePlayer" autoplay controls playsinline>
        <source src="${ep.url}" type="video/mp4">
      </video>
      <div id="upNext" style="
        display:none;
        position:absolute;
        right:16px;
        bottom:16px;
        background:#000c;
        padding:12px;
        border-radius:8px;
      ">
        <strong>Up Next</strong>
        <p>${next.label}</p>
        <span id="countdown"></span>
      </div>
    </div>
    <p>Now Playing: ${ep.label}</p>
  `;

  liveVideo = document.getElementById("livePlayer");
  const upNext = document.getElementById("upNext");
  const countdown = document.getElementById("countdown");

  liveVideo.onloadedmetadata = () => {
    liveVideo.currentTime = Math.min(offset, liveVideo.duration - 1);
    liveVideo.play();
  };

  liveVideo.ontimeupdate = () => {
    const remaining = Math.floor(liveVideo.duration - liveVideo.currentTime);
    if (remaining <= UP_NEXT_SECONDS && !upNextShown) {
      upNextShown = true;
      upNext.style.display = "block";
    }
    if (upNextShown) countdown.textContent = `Starting in ${remaining}s`;
  };

  liveVideo.onended = () => {
    liveIndex = (liveIndex + 1) % liveEpisodes.length;
    playLiveEpisodeAt(0);
  };
}

/* ===================== HASH ===================== */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/* ===================== INIT ===================== */
loadAllShows();
