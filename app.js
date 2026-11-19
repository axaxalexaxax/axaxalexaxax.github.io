// Das Layout steht in styles.css. Eigene Medien kommen aus media/katalog.js.
"use strict";

const root = document.querySelector(".scroll-root");
const hero = document.querySelector(".hero-film");
const stage = document.querySelector(".hero-stage");
const contact = document.querySelector(".contact-strip");
const dialog = document.querySelector(".screen-dialog");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const settings = window.PORTFOLIO_DETAILS;
const samples = window.PORTFOLIO_MEDIA;
const files = window.PORTFOLIO_DATEIEN;
const players = [];
const sources = new Map();

function collection(folder, fallback) {
  if (!files[folder].length) {
    return fallback.map((item) => ({ ...item, sample: true }));
  }
  return files[folder].map((item) => {
    const name = decodeURIComponent(item.src.split("/").pop());
    return { ...item, ...settings.dateien[name] };
  });
}

const films = collection("videos", samples.videos);
const selectedPhotos = collection("fotos-display", samples.photos);
const galleryPhotos = collection("fotos-galerie", samples.gallery);

function addSource(item) {
  if (item.source) sources.set(item.source, item.credit || item.title);
  if (item.audioSource) sources.set(item.audioSource, item.audioTitle);
}

// Der Videorahmen hat immer dieselbe Fläche. Nur der Maßstab des Bildes ändert
// sich: Bei 1 ist das ganze Bild sichtbar; bei „Ausschnitt“ füllt es den Rahmen.
function measureCrop(player) {
  const { element, video } = player;
  if (!element.clientHeight || !element.clientWidth) return;
  const filmRatio = video.videoWidth
    ? video.videoWidth / video.videoHeight
    : 16 / 9;
  const boxRatio = element.clientWidth / element.clientHeight;
  const cover = Math.max(boxRatio / filmRatio, filmRatio / boxRatio);
  element.style.setProperty("--crop-scale", String(cover * 1.12));
}

const frameActions = {
  crop: { label: "Ganzes Bild", icon: "M3 8V5h5m8 0h5v3m0 8v3h-5M8 19H3v-3" },
  wide: { label: "Vollbild", icon: "M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6" },
  full: {
    label: "Verkleinern",
    icon: "M9 3v6H3m18 0h-6V3m0 18v-6h6m-18 0h6v6",
  },
};

function setView(player, view) {
  player.element.dataset.view = view;
  const action = frameActions[view];
  player.frame.querySelector("span").textContent = action.label;
  player.frame.querySelector("path").setAttribute("d", action.icon);
}

// Browser mit Element-Vollbild behalten den Player an seinem Platz im DOM.
// Auf Geräten ohne diese API übernimmt ein modaler Dialog das Fenster.
let fullscreenPlayer = null;

function restoreCrop() {
  if (!fullscreenPlayer) return;
  const player = fullscreenPlayer;
  fullscreenPlayer = null;
  if (player.element.parentElement === dialog) {
    const wasPlaying = !player.video.paused;
    player.host.prepend(player.element);
    if (dialog.open) dialog.close();
    if (wasPlaying) startVideo(player);
  }
  setView(player, "crop");
  measureCrop(player);
  player.frame.focus({ preventScroll: true });
  scheduleUpdate();
}

async function changeFrame(player) {
  switch (player.element.dataset.view) {
    case "crop":
      setView(player, "wide");
      break;
    case "wide": {
      const oldWidth = player.element.clientWidth;
      fullscreenPlayer = player;
      setView(player, "full");
      try {
        await player.element.requestFullscreen();
      } catch {
        if (fullscreenPlayer !== player) return;
        const wasPlaying = !player.video.paused;
        dialog.append(player.element);
        dialog.showModal();
        player.frame.focus();
        if (wasPlaying) startVideo(player);
      }
      if (!reducedMotion.matches && fullscreenPlayer === player) {
        const scale = oldWidth / player.element.clientWidth;
        player.video.animate(
          [{ transform: `scale(${scale})` }, { transform: "scale(1)" }],
          { duration: 360, easing: "ease-out" },
        );
      }
      break;
    }
    case "full":
      if (document.fullscreenElement) await document.exitFullscreen();
      else restoreCrop();
      break;
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && !dialog.open) restoreCrop();
});
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  restoreCrop();
});

function prepareVideo(player) {
  if (!player.video.hasAttribute("src") || player.video.error) {
    player.video.src = player.item.src;
    player.video.load();
  }
}

async function startVideo(player) {
  prepareVideo(player);
  try {
    await player.video.play();
  } catch (error) {
    if (error.name !== "AbortError" && player.video.error) {
      player.status.textContent =
        "Film konnte nicht geladen werden. Mit Abspielen erneut versuchen.";
    }
  }
}

function mute(player) {
  player.video.muted = true;
  player.audio?.pause();
  player.sound.setAttribute("aria-pressed", "false");
}

function stopVideo(player) {
  player.video.pause();
  mute(player);
  clearTimeout(player.titleTimer);
  player.element.classList.remove("is-described");
}

function showTitle(player) {
  player.element.classList.add("is-described");
  clearTimeout(player.titleTimer);
  player.titleTimer = setTimeout(
    () => player.element.classList.remove("is-described"),
    4200,
  );
}

function createPlayer(item, index) {
  const host = index === 0 ? stage : document.createElement("section");
  if (index > 0) {
    host.className = "film regular-film";
    host.setAttribute("aria-label", item.title);
    document
      .querySelector(index < 3 ? "#film-auswahl" : "#film-archiv")
      .append(host);
  }

  const template = document.querySelector("#film-vorlage");
  const element = template.content.firstElementChild.cloneNode(true);
  host.prepend(element);
  const video = element.querySelector("video");
  video.muted = true;
  video.setAttribute("aria-label", item.title);
  if (item.poster) video.poster = item.poster;
  if (item.captions) {
    const track = document.createElement("track");
    Object.assign(track, {
      kind: "captions",
      srclang: "de",
      label: "Deutsch",
      src: item.captions,
    });
    video.append(track);
  }

  const player = {
    item,
    host,
    element,
    video,
    audio: item.audio ? new Audio() : null,
    play: element.querySelector('[data-action="play"]'),
    frame: element.querySelector('[data-action="frame"]'),
    sound: element.querySelector('[data-action="sound"]'),
    status: element.querySelector(".media-message"),
    manualPause: false,
  };
  if (player.audio) {
    player.audio.preload = "none";
    player.audio.loop = true;
    player.audio.src = item.audio;
  }
  element.querySelector("h2").textContent = item.title;
  element.querySelector(".eyebrow").textContent = item.sample
    ? "Beispielfilm · " + (item.provider || "Mixkit")
    : "Film";
  player.play.addEventListener("click", () => {
    player.manualPause = !video.paused;
    if (player.manualPause) stopVideo(player);
    else startVideo(player);
    showTitle(player);
  });
  player.sound.addEventListener("click", async () => {
    if (player.sound.getAttribute("aria-pressed") === "true")
      return mute(player);
    players.forEach(mute);
    prepareVideo(player);
    player.manualPause = false;
    video.muted = Boolean(player.audio);
    player.sound.setAttribute("aria-pressed", "true");
    try {
      await Promise.all([video.play(), player.audio?.play()]);
      showTitle(player);
    } catch {
      mute(player);
      player.status.textContent =
        "Wiedergabe fehlgeschlagen. Bitte erneut versuchen.";
    }
  });
  video.addEventListener("playing", () => {
    player.status.textContent = "";
    player.play.textContent = "Pause";
  });
  video.addEventListener("pause", () => {
    player.play.textContent = "Abspielen";
    player.audio?.pause();
  });
  video.addEventListener("error", () => {
    mute(player);
    player.status.textContent =
      "Film nicht erreichbar. Mit Abspielen erneut versuchen.";
  });
  video.addEventListener("loadedmetadata", () => measureCrop(player));
  video.addEventListener("click", () => showTitle(player));
  player.frame.addEventListener("click", () => changeFrame(player));
  new ResizeObserver(() => measureCrop(player)).observe(element);
  players.push(player);
  addSource(item);
}

films.forEach(createPlayer);

// Beim Start liegt die Kontaktleiste oberhalb des sichtbaren Bereichs.
// Der erste Film bleibt beim Scrollen stehen, während das Signet verschwindet.
const clamp = (value) => Math.max(0, Math.min(1, value));
let currentPlayer = null;
let animationFrame = 0;
let previousContactHeight = 0;

function scrollToPosition(top) {
  root.scrollTo({
    top,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  });
}

function update() {
  animationFrame = 0;
  if (document.hidden) return;
  const offset = root.scrollTop - contact.offsetHeight;
  const travel = Math.max(1, hero.offsetHeight - stage.offsetHeight);
  const progress = clamp(offset / travel);
  const pull = clamp(-offset / contact.offsetHeight);
  stage.style.setProperty("--white-opacity", 1 - clamp(progress / 0.56));
  stage.style.setProperty("--logo-opacity", 1 - clamp((progress - 0.48) / 0.3));
  stage.style.setProperty(
    "--logo-brightness",
    clamp(progress / 0.38) || pull * 0.4,
  );
  stage.style.setProperty("--logo-scale", 1 - progress * 0.17 - pull * 0.08);
  stage.style.setProperty(
    "--pull-offset",
    (-pull * contact.offsetHeight) / 2 + "px",
  );
  stage.style.setProperty("--cues-opacity", 1 - clamp(progress / 0.13));
  const revealed = progress > 0.65;
  const firstPlayer = players[0];
  const firstVisible = revealed || fullscreenPlayer === firstPlayer;
  stage.classList.toggle("is-revealed", firstVisible);
  if (firstPlayer) firstPlayer.element.inert = !firstVisible;
  stage.querySelector(".hero-cues").inert = progress > 0.15;
  contact.inert = root.scrollTop >= contact.offsetHeight - 1;

  let next = null;
  let best = 0.34;
  for (const player of players) {
    if (player === firstPlayer && !revealed) continue;
    const rect = player.host.getBoundingClientRect();
    if (!rect.height) continue;
    const visible =
      Math.min(root.clientHeight, rect.bottom) - Math.max(0, rect.top);
    const ratio = visible / Math.min(root.clientHeight, rect.height);
    if (ratio > best) {
      best = ratio;
      next = player;
    }
  }
  next = fullscreenPlayer || next;
  if (currentPlayer === next) return;
  if (currentPlayer) stopVideo(currentPlayer);
  currentPlayer = next;
  if (next) {
    showTitle(next);
    if (!reducedMotion.matches && !next.manualPause) startVideo(next);
  }
}

function scheduleUpdate() {
  if (!animationFrame) animationFrame = requestAnimationFrame(update);
}

function measurePage() {
  if (Math.abs(root.scrollTop - previousContactHeight) < 4) {
    root.scrollTop = contact.offsetHeight;
  }
  previousContactHeight = contact.offsetHeight;
  scheduleUpdate();
}

document.querySelector(".contact-trigger").onclick = () => scrollToPosition(0);
document.querySelector(".close-contact").onclick = () =>
  scrollToPosition(contact.offsetHeight);
document.querySelector(".back-top").onclick = () =>
  scrollToPosition(contact.offsetHeight);
document.querySelector(".work-trigger").onclick = () =>
  scrollToPosition(
    contact.offsetHeight + hero.offsetHeight - stage.offsetHeight,
  );

const archiveButton = document.querySelector(".archive-control button");
const archive = document.querySelector("#film-archiv");
archiveButton.parentElement.hidden = films.length <= 3;
archiveButton.addEventListener("click", () => {
  archive.hidden = !archive.hidden;
  archiveButton.setAttribute("aria-expanded", String(!archive.hidden));
  archiveButton.textContent = archive.hidden
    ? "Weitere Filme zeigen"
    : "Weniger Filme zeigen";
  if (!archive.hidden) {
    archive.scrollIntoView({
      block: "start",
      behavior: reducedMotion.matches ? "instant" : "smooth",
    });
    archive.querySelector("button").focus({ preventScroll: true });
  }
  scheduleUpdate();
});

// Die Auswahl wiederholt das versetzte Vierer-Raster. Die zweite Galerie
// nutzt natives horizontales Scrollen, sodass Wischen und Trackpad funktionieren.
function photoFigure(item, index, selected) {
  const figure = document.createElement("figure");
  figure.className = selected
    ? "photo photo-" + ((index % 4) + 1)
    : "gallery-slide";
  const image = document.createElement("img");
  image.loading = "lazy";
  image.decoding = "async";
  image.alt = item.alt || item.title;
  const caption = document.createElement("figcaption");
  const title = document.createElement("span");
  title.textContent = item.title;
  caption.append(title);
  if (item.category) {
    const category = document.createElement("span");
    category.className = "photo-category";
    category.textContent = item.category;
    caption.append(category);
  }
  image.addEventListener(
    "error",
    () => {
      const error = document.createElement("span");
      error.className = "photo-error";
      error.textContent = "Foto nicht erreichbar: " + image.alt;
      image.replaceWith(error);
    },
    { once: true },
  );
  image.src = item.src;
  figure.append(image, caption);
  addSource(item);
  return figure;
}

const selection = document.querySelector("#foto-auswahl");
selectedPhotos.forEach((item, index) =>
  selection.append(photoFigure(item, index, true)),
);
if (selectedPhotos[0]?.sample)
  document.querySelector(".gallery-note").textContent =
    "Auswahl · Beispielmotive";

if (galleryPhotos[0]?.sample) {
  document.querySelector("#archiv-titel").textContent =
    "Fotogalerie · Beispielmotive";
}

const track = document.querySelector("#fotostrecke");
const previous = document.querySelector("#zurueck");
const next = document.querySelector("#weiter");
const counter = document.querySelector("#bildnummer");
galleryPhotos.forEach((item, index) =>
  track.append(photoFigure(item, index, false)),
);
const slides = [...track.children];

function currentSlide() {
  return Math.round(track.scrollLeft / (track.clientWidth || 1));
}

function updateGallery() {
  const index = currentSlide();
  counter.textContent = index + 1 + " / " + slides.length;
  previous.disabled = index <= 0;
  next.disabled = index >= slides.length - 1;
}

function stepGallery(step) {
  const index = Math.max(0, Math.min(slides.length - 1, currentSlide() + step));
  track.scrollTo({
    left: index * track.clientWidth,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  });
}

previous.onclick = () => stepGallery(-1);
next.onclick = () => stepGallery(1);
track.addEventListener("scroll", updateGallery, { passive: true });
track.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  stepGallery(event.key === "ArrowRight" ? 1 : -1);
});
new ResizeObserver(updateGallery).observe(track);
updateGallery();

for (const container of document.querySelectorAll("[data-contact]")) {
  if (settings.email) {
    const link = document.createElement("a");
    link.href = "mailto:" + settings.email;
    link.textContent = settings.email;
    container.append(link);
  } else {
    const link = document.createElement("a");
    link.href = "https://github.com/axaxalexaxax";
    link.textContent = "GitHub-Profil";
    container.append(link);
  }
}

for (const [url, title] of sources) {
  const row = document.createElement("li");
  const link = document.createElement("a");
  link.href = url;
  link.textContent = title;
  row.append(link);
  document.querySelector("#quellen").append(row);
}
document.querySelector(".credits").hidden = sources.size === 0;

root.addEventListener("scroll", scheduleUpdate, { passive: true });
window.addEventListener("resize", measurePage);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    players.forEach(stopVideo);
    currentPlayer = null;
  } else scheduleUpdate();
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) players.forEach(stopVideo);
});
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
measurePage();
update();
document.documentElement.classList.add("is-ready");
