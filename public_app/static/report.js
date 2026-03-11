const report = window.__REPORT__;
const movieList = document.getElementById("movie-list");
const selectedCard = document.getElementById("selected-card");
const searchInput = document.getElementById("search-input");
const listCount = document.getElementById("list-count");
const copyLinkBtn = document.getElementById("copy-link-btn");
const downloadJsonBtn = document.getElementById("download-json-btn");
const toggleSidebarBtn = document.getElementById("toggle-sidebar-btn");
const zoomInBtn = document.getElementById("zoom-in-btn");
const zoomOutBtn = document.getElementById("zoom-out-btn");
const posterSizeSlider = document.getElementById("poster-size-slider");
const posterSizeValue = document.getElementById("poster-size-value");

document.getElementById("movie-count-pill").textContent = `${report.movie_count} movies`;
document.getElementById("point-count-pill").textContent = `${report.point_count} mapped pins`;
document.getElementById("avg-douban").textContent = report.avg_douban ?? "N/A";
document.getElementById("avg-imdb").textContent = report.avg_imdb ?? "N/A";
document.getElementById("top-countries").textContent =
  report.top_countries.slice(0, 3).map((item) => `${item.name} (${item.count})`).join(", ") || "N/A";
document.getElementById("top-locations").textContent =
  report.top_locations.slice(0, 2).map((item) => `${item.name} (${item.count})`).join(", ") || "N/A";

const globeContainer = document.getElementById("globe-view");
const globe = Globe()(globeContainer)
  .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-night.jpg")
  .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
  .backgroundImageUrl("https://unpkg.com/three-globe/example/img/night-sky.png")
  .showAtmosphere(true)
  .atmosphereColor("#6ea8fe")
  .atmosphereAltitude(0.18);

globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.45;
globe.controls().enableDamping = true;
globe.controls().minDistance = 140;
globe.controls().maxDistance = 420;

let activeMovieId = null;
let filteredMovies = report.movies.slice();
let currentAltitude = 2.2;
let posterScale = 1;

function resizeGlobe() {
  globe.width(globeContainer.clientWidth);
  globe.height(globeContainer.clientHeight);
}

window.addEventListener("resize", resizeGlobe);
resizeGlobe();

function showMovie(movie) {
  activeMovieId = movie.id;
  selectedCard.classList.remove("hidden");
  selectedCard.innerHTML = `
    <img src="${movie.cover_url || ""}" alt="${movie.title}" class="selected-cover">
    <div class="selected-content">
      <h3>${movie.title}</h3>
      <p>${movie.year || "N/A"} · ${movie.location_name || "Unknown location"}</p>
      <div class="rating-row">
        <span>Douban ${movie.douban_rating ?? "N/A"}</span>
        <span>IMDb ${movie.imdb_rating ?? "N/A"}</span>
      </div>
      <div class="location-pill">${movie.location_name || "Unknown location"}</div>
      <div class="link-row">
        ${movie.douban_id ? `<a href="https://movie.douban.com/subject/${movie.douban_id}/" target="_blank" rel="noreferrer">Douban</a>` : ""}
        ${movie.imdb_id ? `<a href="https://www.imdb.com/title/${movie.imdb_id}/" target="_blank" rel="noreferrer">IMDb</a>` : ""}
      </div>
    </div>
  `;
  globe.pointOfView({ lat: movie.lat, lng: movie.lng, altitude: currentAltitude }, 800);
  globe
    .ringsData([movie])
    .ringLat((item) => item.lat)
    .ringLng((item) => item.lng)
    .ringColor(() => ["rgba(133,255,212,0.9)", "rgba(100,168,255,0.1)"])
    .ringMaxRadius(5)
    .ringPropagationSpeed(1.4)
    .ringRepeatPeriod(900);
  updatePointStyles();
  renderMovieList(filteredMovies);
}

function renderMovieList(movies) {
  listCount.textContent = `${movies.length} visible`;
  movieList.innerHTML = "";
  movies.forEach((movie) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `movie-item ${activeMovieId === movie.id ? "active" : ""}`;
    item.innerHTML = `
      <img src="${movie.cover_url || ""}" alt="${movie.title}">
      <span>
        <strong>${movie.title}</strong>
        <small>${movie.location_name || "Unknown location"}</small>
      </span>
    `;
    item.addEventListener("click", () => showMovie(movie));
    movieList.appendChild(item);
  });
  updatePosterMarkers();
}

function updatePointStyles() {
  globe
    .pointColor((movie) => {
      if (movie.id === activeMovieId) {
        return "#85ffd4";
      }
      return "#64a8ff";
    })
    .pointAltitude((movie) => (movie.id === activeMovieId ? 0.12 : 0.04))
    .pointRadius((movie) => (movie.id === activeMovieId ? 0.32 : 0.18));
}

function updatePosterMarkers() {
  const posters = filteredMovies.slice();

  globe
    .htmlElementsData(posters)
    .htmlLat((movie) => movie.lat)
    .htmlLng((movie) => movie.lng)
    .htmlElement((movie) => {
      const el = document.createElement("button");
      el.className = `globe-marker ${movie.id === activeMovieId ? "active" : ""}`;
      el.type = "button";
      el.innerHTML = `<img src="${movie.cover_url || ""}" alt="${movie.title}">`;
      el.style.pointerEvents = "auto";
      el.style.cursor = "pointer";
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        showMovie(movie);
      });
      return el;
    });
}

function applyPosterScale() {
  document.documentElement.style.setProperty("--poster-scale", String(posterScale));
  posterSizeValue.textContent = `${Math.round(posterScale * 100)}%`;
}

searchInput.addEventListener("input", (event) => {
  const term = event.target.value.trim().toLowerCase();
  filteredMovies = report.movies.filter((movie) => {
    return (
      movie.title.toLowerCase().includes(term) ||
      (movie.location_name || "").toLowerCase().includes(term)
    );
  });
  renderMovieList(filteredMovies);
});

copyLinkBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(window.location.href);
  copyLinkBtn.textContent = "Copied";
  window.setTimeout(() => {
    copyLinkBtn.textContent = "Copy Link";
  }, 1200);
});

downloadJsonBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `movie-globe-${report.douban_id}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

toggleSidebarBtn.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  toggleSidebarBtn.textContent = collapsed ? "Show List" : "Focus Globe";
  window.setTimeout(resizeGlobe, 220);
});

zoomInBtn.addEventListener("click", () => {
  currentAltitude = Math.max(0.8, currentAltitude - 0.25);
  const movie = report.movies.find((item) => item.id === activeMovieId);
  if (movie) {
    globe.pointOfView({ lat: movie.lat, lng: movie.lng, altitude: currentAltitude }, 500);
  }
});

zoomOutBtn.addEventListener("click", () => {
  currentAltitude = Math.min(3.2, currentAltitude + 0.25);
  const movie = report.movies.find((item) => item.id === activeMovieId);
  if (movie) {
    globe.pointOfView({ lat: movie.lat, lng: movie.lng, altitude: currentAltitude }, 500);
  }
});

posterSizeSlider.addEventListener("input", (event) => {
  posterScale = Number(event.target.value) / 100;
  applyPosterScale();
});

globe
  .pointsData(report.movies)
  .pointLat((movie) => movie.lat)
  .pointLng((movie) => movie.lng)
  .pointResolution(16)
  .pointsMerge(false)
  .pointLabel((movie) => `${movie.title}<br/>${movie.location_name || ""}`)
  .onPointClick((movie) => {
    showMovie(movie);
  });

updatePointStyles();
applyPosterScale();
if (window.innerWidth < 960) {
  document.body.classList.add("sidebar-collapsed");
  toggleSidebarBtn.textContent = "Show List";
}

renderMovieList(filteredMovies);
if (report.movies.length > 0) {
  showMovie(report.movies[0]);
}
