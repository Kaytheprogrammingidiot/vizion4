const repo = "Kaytheprogrammingidiot/vizion4-videos";
const baseApi = `https://api.github.com/repos/${repo}/contents/shows`;
const container = document.getElementById("show-list");
const searchInput = document.getElementById("search");

let allShows = []; // Store all show data for filtering

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

        allShows.push({
          title: info.title,
          author: info.author || author.name,
          iconUrl,
          link: `show.html?author=${author.name}&name=${show.name}`
        });
      }
    }

    renderShows(allShows);
  } catch (err) {
    console.error("Error loading shows:", err);
    container.innerHTML = `<p>Failed to load shows.</p>`;
  }
}

function renderShows(shows) {
  container.innerHTML = "";
  shows.forEach(show => {
    const div = document.createElement("div");
    div.className = "show";
    div.innerHTML = `
      ${show.iconUrl ? `<img src="${show.iconUrl}" alt="${show.title}" style="width:100%;border-radius:8px;">` : ""}
      <h2>${show.title}</h2>
      <p>By ${show.author}</p>
      <a href="${show.link}">▶ Watch</a>
    `;
    container.appendChild(div);
  });
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  const filtered = allShows.filter(show =>
    show.title.toLowerCase().includes(query) ||
    show.author.toLowerCase().includes(query)
  );
  renderShows(filtered);
});

loadAllShows();