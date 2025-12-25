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
  try {
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
  } catch (e) {
    homeContainer.innerHTML = "<p>Failed to load shows.</p>";
    console.error(e);
  }
}

/* -------------------- RENDER -------------------- */
function renderShows(shows, container) {
  container.innerHTML = "";

  shows.forEach(show => {
    const div = document.createElement("div");
    div.className = "show";

    const inList = currentTab === "mylist";

    div.innerHTML = `
      ${show.iconUrl ? `<img src="${show.iconUrl}">` : ""}
      <h2>${show.title}</h2>
      <p>By ${show.author}</p>
      <a href="${show.link}">Watch</a>
      <button class="${inList ? "remove" : "add"}" data-id="${show.id}">
        ${inList ? "Remove from My List" : "Add to My List"}
      </button>
    `;

    container.appendChild(div);
  });

  container.querySelectorAll(".add").forEach(b => {
    b.onclick = () => {
      const list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
      const show = allShows.find(s => s.id === b.dataset.id);
      if (!list.some(s => s.id === show.id)) {
        list.push(show);
        localStorage.setItem("vizion4_mylist", JSON.stringify(list));
        b.textContent = "✔ Added";
      }
    };
  });

  container.querySelectorAll(".remove").forEach(b => {
    b.onclick = () => {
      let list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
      list = list.filter(s => s.id !== b.dataset.id);
      localStorage.setItem("vizion4_mylist", JSON.stringify(list));
      renderMyList(container);
    };
  });
}

function renderMyList(c) {
  const list = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
  if (!list.length) return c.innerHTML = "<p>No shows yet.</p>";
  renderShows(list, c);
}

function renderRecent(c) {
  const list = JSON.parse(localStorage.getItem("vizion4_recent_shows") || "[]");
  if (!list.length) return c.innerHTML = "<p>No recent shows.</p>";
  renderShows(list, c);
}

/* -------------------- SEARCH -------------------- */
searchInput.oninput = () => {
  const q = searchInput.value.toLowerCase();
  renderShows(allShows.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.author.toLowerCase().includes(q)
  ), homeContainer);
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

  startLive();
}

function startLive() {
  const SLOT = 22 * 60;
  const now = Math.floor(Date.now() / 1000);

  const shuffled = [...liveEpisodes].sort((a, b) =>
    hash(a.url) - hash(b.url)
  );

  const index = Math.floor(now / SLOT) % shuffled.length;
  const offset = now % SLOT;
  const ep = shuffled[index];

  liveContainer.innerHTML = `
    <h2>🔴 Live Now</h2>
    <video id="livePlayer" autoplay controls playsinline>
      <source src="${ep.url}" type="video/mp4">
    </video>
    <p>Now Playing: ${ep.label}</p>
  `;

  const v = document.getElementById("livePlayer");
  v.onloadedmetadata = () => v.currentTime = offset;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

loadAllShows();
