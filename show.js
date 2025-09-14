const repo = "Kaytheprogrammingidiot/vizion4-videos";
const params = new URLSearchParams(window.location.search);
const author = params.get("author");
const showName = params.get("name");
const baseApi = `https://api.github.com/repos/${repo}/contents/shows/${author}/${showName}`;

async function loadShow() {
  const container = document.getElementById("shows");
  const header = document.querySelector("header");

  try {
    const infoMeta = await fetch(`${baseApi}/info.json`).then(r => r.json());
    const info = await fetch(infoMeta.download_url).then(r => r.json());

    const episodesMeta = await fetch(`${baseApi}/episodes.json`).then(r => r.json());
    const episodeTitles = await fetch(episodesMeta.download_url).then(r => r.json());

    const filesMeta = await fetch(baseApi).then(r => r.json());
    const mp4Files = filesMeta.filter(f => f.name.endsWith(".mp4")).sort((a, b) => {
      return parseInt(a.name) - parseInt(b.name);
    });

    header.innerHTML = `<h1>${info.title}</h1><p>By ${info.author || author}</p>`;

    mp4Files.forEach((file, index) => {
      const title = episodeTitles[index] || `Episode ${index + 1}`;
      const div = document.createElement("div");
      div.className = "show";
      div.innerHTML = `
        <h2>${title}</h2>
        <video controls src="${file.download_url}" width="100%"></video>
      `;
      container.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading show:", err);
    container.innerHTML = `<p>Failed to load episodes.</p>`;
  }
}

loadShow();