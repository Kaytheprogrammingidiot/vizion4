const repo = "Kaytheprogrammingidiot/vizion4-videos";
const baseApi = `https://api.github.com/repos/${repo}/contents/shows`;

const homeContainer = document.getElementById("home-list");
const myListContainer = document.getElementById("mylist-list");
const searchInput = document.getElementById("search");
const tabs = document.querySelectorAll("#tabs button");

let allShows = [];

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const selected = tab.dataset.tab;
    homeContainer.style.display = selected === "home" ? "grid" : "none";
    myListContainer.style.display = selected === "mylist" ? "grid" : "none";

    if (selected === "mylist") {
      renderMyList(myListContainer);
    }
  });
});

async function loadAllShows() {
  try {
    const authors = await fetch(baseApi).then(r => r.json());

    for (const author of authors) {
      if (author.type !== "dir") continue;

      const authorPath = `${baseApi}/${author.name}`;
      const shows = await fetch(authorPath).then(r => r.json());

      for (const show of shows) {
        if (show.type !== "dir") continue;

        const showPath = `${authorPath}/${show.name}`;
        const files = await fetch(showPath).then(r => r.json());

        const infoMeta = files.find(f => f.name === "info.json");
        if (!infoMeta) continue;

        const info = await fetch(infoMeta.download_url).then(r => r.json());

        const iconFile = files.find(f => /\.(png|jpg|jpeg)$/i.test(f.name));
        const iconUrl = iconFile ? iconFile.download_url : null;

        const showData = {
          title: info.title,
          author: info.author || author.name,
          iconUrl,
          link: `show.html?author=${author.name}&name=${show.name}`,
          id: `${author.name}_${info.title}`
        };

        allShows.push(showData);
      }
    }

    renderShows(allShows, homeContainer);
  } catch (err) {
    console.error("Error loading shows:", err);
    homeContainer.innerHTML = `<p>Failed to load shows.</p>`;
  }
}

function renderShows(shows, container) {
  container.innerHTML = "";
  shows.forEach(show => {
    const div = document.createElement("div");
    div.className = "show";
    div.innerHTML = `
      ${show.iconUrl ? `<img src="${show.iconUrl}" alt="${show.title}" style="width:100%;border-radius:8px;">` : ""}
      <h2>${show.title}</h2>
      <p>By ${show.author}</p>
      <a href="${show.link}">▶ Watch</a>
      <button class="add-to-list" data-id="${show.id}">➕ Add to My List</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(".add-to-list").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      const existing = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
      const alreadyAdded = existing.some(item => item.id === id);
      if (!alreadyAdded) {
        const show = allShows.find(s => s.id === id);
        existing.push(show);
        localStorage.setItem("vizion4_mylist", JSON.stringify(existing));
        button.textContent = "✔ Added";
      }
    });
  });
}

function renderMyList(container) {
  const saved = JSON.parse(localStorage.getItem("vizion4_mylist") || "[]");
  renderShows(saved, container);
}

// Search filtering
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  const filtered = allShows.filter(show =>
    show.title.toLowerCase().includes(query) ||
    show.author.toLowerCase().includes(query)
  );
  renderShows(filtered, homeContainer);
});

loadAllShows();
