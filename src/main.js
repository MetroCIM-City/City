import "./styles.css";
import { CATEGORIES, findItem } from "./data/campus.js";
import { CampusViewer } from "./campus/CampusViewer.js";

const canvas = document.getElementById("view");
const nav = document.getElementById("nav");
const accordion = document.getElementById("accordion");
const dialog = document.getElementById("article-dialog");
const dialogTitle = document.getElementById("article-title");
const dialogBody = document.getElementById("article-body");

const viewer = new CampusViewer(canvas, {
  onSelect: (id) => openArticle(id),
});

accordion.innerHTML = CATEGORIES.map(
  (cat) => `
  <section class="panel" data-cat="${cat.id}">
    <div class="panel__color" style="background:${cat.color}"></div>
    <button type="button" class="panel__header" data-toggle="${cat.id}">
      <span>${cat.title}</span>
    </button>
    <button type="button" class="panel__eye" data-eye="${cat.id}" title="Toggle Category" aria-label="Toggle Category">
      <span class="material-icons">visibility</span>
    </button>
    <span class="panel__chevron material-icons">expand_more</span>
    <div class="panel__body">
      ${cat.items
        .map(
          (item) => `<a class="panel__item" href="#${item.id}" data-item="${item.id}">
            <span class="material-icons">chevron_right</span>${item.title}
          </a>`,
        )
        .join("")}
    </div>
  </section>`,
).join("");

accordion.addEventListener("click", (e) => {
  const eye = e.target.closest("[data-eye]");
  if (eye) {
    e.preventDefault();
    e.stopPropagation();
    const id = eye.dataset.eye;
    const hidden = eye.classList.toggle("is-off");
    eye.querySelector(".material-icons").textContent = hidden ? "visibility_off" : "visibility";
    viewer.setCategoryVisible(id, !hidden);
    return;
  }
  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    toggle.closest(".panel").classList.toggle("is-open");
    return;
  }
  const item = e.target.closest("[data-item]");
  if (item) {
    e.preventDefault();
    openArticle(item.dataset.item);
    viewer.select(item.dataset.item);
  }
});

document.getElementById("menu-btn").addEventListener("click", () => {
  nav.classList.toggle("is-collapsed");
});

document.getElementById("back-btn").addEventListener("click", () => {
  closeArticle();
  viewer.resetCamera();
});

document.getElementById("article-close").addEventListener("click", closeArticle);
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closeArticle();
});

function openArticle(id) {
  const item = findItem(id);
  if (!item) return;
  dialogTitle.textContent = item.heading || item.title;
  dialogBody.textContent = item.body;
  dialog.hidden = false;
  document.querySelectorAll(".panel__item").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.item === id);
  });
}

function closeArticle() {
  dialog.hidden = true;
  document.querySelectorAll(".panel__item").forEach((el) => el.classList.remove("is-active"));
}

viewer.ready
  .then(() => {
    document.getElementById("loader").hidden = true;
  })
  .catch((err) => {
    const loader = document.getElementById("loader");
    loader.hidden = false;
    loader.textContent = `Could not load campus model. ${err?.message || err}`;
    console.error(err);
  });
