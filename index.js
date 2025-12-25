const repo = "Kaytheprogrammingidiot/vizion4-videos";
const baseApi = `https://api.github.com/repos/${repo}/contents/shows`;

const homeContainer = document.getElementById("home-list");
const liveContainer = document.getElementById("live-container");
const myListContainer = document.getElementById("mylist-list");
const recentContainer = document.getElementById("recent-list");
const searchInput = document.getElementById("search");
const tabs = document.querySelectorAll("#tabs button");

let allShows = [];
let currentTab = "home";

let liveEpisodes = [];
let liveIndex = 0;
let liveLoaded = false;

/* -------------------- TABS -------------------- */
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

/* -------------------- LOAD SHOWS -------------------- */
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

/* -------------------- RENDER -------------------- */
function renderShows(shows, container) {
  container.innerHTML = "";

  shows.forEach(show => {
    const div = document.createElement("div");
    div.className = "show";

    div.innerHTML = `
      ${show.iconUrl ? `<img src="${show.iconUrl}">` : ""}
      <h2>${show.title}</h2>
      <p>By ${show.author}</p>
      <a href="${show.link}">Watch</a>
    `;

    container.appendChild(div);
  });
}

function renderMyList(c) {
  const list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
  if (!list.length) c.innerHTML = "<p>No shows yet.</p>";
  else renderShows(list, c);
}

function renderRecent(c) {
  const list = JSON.parse(localStorage.getItem("vizion4_recent_shows") || "[]");
  if (!list.length) c.innerHTML = "<p>No recent shows.</p>";
  else renderShows(list, c);
}

/* -------------------- SEARCH -------------------- */
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

/* -------------------- LIVE TV -------------------- */
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
          label: `${show.name} – ${f.name}`
        });
      });
    }
  }

  // deterministic shuffle
  liveEpisodes.sort((a, b) => hash(a.url) - hash(b.url));

  // determine starting index from time
  liveIndex = Math.floor(Date.now() / 1000) % liveEpisodes.length;

  playLiveEpisode();
}

function playLiveEpisode() {
  const ep = liveEpisodes[liveIndex];

  liveContainer.innerHTML = `
    <h2>🔴 Live Now</h2>
    <video id="livePlayer" autoplay controls playsinline>
      <source src="${ep.url}" type="video/mp4">
    </video>
    <p>Now Playing: ${ep.label}</p>
  `;

  const video = document.getElementById("livePlayer");

  video.onloadedmetadata = () => {
    const now = Math.floor(Date.now() / 1000);
    const offset = now % Math.floor(video.duration || 1);

    video.currentTime = offset;
    video.play();
  };

  video.onended = () => {
    liveIndex = (liveIndex + 1) % liveEpisodes.length;
    playLiveEpisode();
  };
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

loadAllShows();
