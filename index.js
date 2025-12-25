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

/* ===================== TABS ===================== */
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
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
    const div = document.createElement("div");
    div.className = "show";

    const isInList = myList.some(s => s.id === show.id);

    div.innerHTML = `
      ${show.iconUrl ? `<img src="${show.iconUrl}">` : ""}
      <h2>${show.title}</h2>
      <p>By ${show.author}</p>
      <a href="${show.link}">Watch</a>
      <button class="${isInList ? "remove-from-list" : "add-to-list"}" data-id="${show.id}">
        ${isInList ? "Remove from My List" : "Add to My List"}
      </button>
    `;

    container.appendChild(div);
  });

  // Add
  container.querySelectorAll(".add-to-list").forEach(btn => {
    btn.onclick = () => {
      const list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
      const show = allShows.find(s => s.id === btn.dataset.id);
      if (!list.some(s => s.id === show.id)) {
        list.push(show);
        localStorage.setItem("vizion4_mylist", JSON.stringify(list));
        btn.textContent = "✔ Added";
        btn.disabled = true;
      }
    };
  });

  // Remove
  container.querySelectorAll(".remove-from-list").forEach(btn => {
    btn.onclick = () => {
      let list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
      list = list.filter(s => s.id !== btn.dataset.id);
      localStorage.setItem("vizion4_mylist", JSON.stringify(list));
      renderMyList(container);
    };
  });
}

/* ===================== MY LIST / RECENT ===================== */
function renderMyList(c) {
  const list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
  if (!list.length) c.innerHTML = "<p>No shows in your list yet.</p>";
  else renderShows(list, c);
}

function renderRecent(c) {
  const list = JSON.parse(localStorage.getItem("vizion4_recent_shows") || "[]");
  if (!list.length) c.innerHTML = "<p>No recently watched shows.</p>";
  else renderShows(list, c);
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

/* ===================== PRELOAD DURATIONS ===================== */
function preloadDurations(i) {
  if (i >= liveEpisodes.length) {
    startLiveFromClock();
    return;
  }

  const ep = liveEpisodes[i];
  const v = document.createElement("video");
  v.src = ep.url;
  v.preload = "metadata";

  v.onloadedmetadata = () => {
    ep.duration = v.duration;
    preloadDurations(i + 1);
  };

  v.onerror = () => {
    ep.duration = 0;
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
        max-width:260px;
      ">
        <strong>Up Next</strong>
        <p>${next.label}</p>
        <span id="countdown"></span>
      </div>
    </div>
    <p>Now Playing: ${ep.label}</p>
  `;

  const video = document.getElementById("livePlayer");
  const upNext = document.getElementById("upNext");
  const countdown = document.getElementById("countdown");

  video.onloadedmetadata = () => {
    video.currentTime = Math.min(offset, video.duration - 1);
    video.play();
  };

  video.ontimeupdate = () => {
    const remaining = Math.floor(video.duration - video.currentTime);
    if (remaining <= UP_NEXT_SECONDS && !upNextShown) {
      upNextShown = true;
      upNext.style.display = "block";
    }
    if (upNextShown) countdown.textContent = `Starting in ${remaining}s`;
  };

  video.onended = () => {
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
