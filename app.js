// Gallery front end. Reads config.json and data.json, builds the page.
// All text that comes from GitHub is added with textContent, never innerHTML.

const TYPE_LABELS = { all: "All", website: "Websites", game: "Games", code: "Coding", hardware: "Hardware" };
const TYPE_BADGE = { website: "Website", game: "Game", code: "Code", hardware: "Hardware" };
const state = { type: "all", q: "" };
let config, data;

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

function pretty(name) {
  const s = name.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

function modeOf(section) {
  return section.mode || config.defaultMode || "auto";
}

function matches(p) {
  if (state.type !== "all" && p.type !== state.type) return false;
  const q = state.q.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.owner, p.description, p.language, ...(p.topics || [])]
    .filter(Boolean).join(" ").toLowerCase().includes(q);
}

function card(p) {
  const thumb = h("img", {
    class: "thumb", loading: "lazy", alt: "",
    src: `https://raw.githubusercontent.com/${p.full_name}/HEAD/preview.png`,
  });
  // No preview.png in the repo? Fall back to the club logo.
  thumb.addEventListener("error", () => {
    // No preview.png: show the club logo as a placeholder.
    thumb.src = config.club.logo || `https://opengraph.githubassets.com/1/${p.full_name}`;
    thumb.classList.add("placeholder");
  }, { once: true });

  const live = safeUrl(p.homepage);
  return h("article", { class: "card" },
    thumb,
    h("div", { class: "card-body" },
      h("h3", {}, h("a", { href: p.url, target: "_blank", rel: "noopener" }, pretty(p.name))),
      h("a", { class: "author", href: `https://github.com/${p.owner}`, target: "_blank", rel: "noopener" },
        h("img", { src: p.avatar, alt: "", loading: "lazy" }), "@" + p.owner),
      h("p", {}, p.description || "No description yet."),
      h("div", { class: "meta" },
        h("span", { class: "badge" }, TYPE_BADGE[p.type] || "Code"),
        p.language && h("span", {}, p.language),
        p.stars > 0 && h("span", {}, "★ " + p.stars)),
      h("div", { class: "links" },
        h("a", { href: p.url, target: "_blank", rel: "noopener" }, "Repo"),
        live && h("a", { href: live, target: "_blank", rel: "noopener" }, "Live demo"))));
}

function sectionEl(s) {
  const all = data.sections?.[s.id] || [];
  const shown = all.filter(matches);
  const filtering = state.type !== "all" || state.q.trim();
  if (filtering && shown.length === 0) return null;

  const mode = modeOf(s);
  return h("section", { class: "section", id: s.id },
    h("div", { class: "section-head" },
      h("h2", { text: s.title }),
      h("span", { class: "mode", title: mode === "auto" ? "Shows up automatically" : "Approved by a club leader" },
        mode === "auto" ? "Auto" : "Approved")),
    s.description && h("p", { class: "desc", text: s.description }),
    shown.length
      ? h("div", { class: "grid" }, shown.map(card))
      : h("div", { class: "empty" },
          config.club.logo && h("img", { class: "empty-logo", src: config.club.logo, alt: "" }),
          h("p", {}, "Nothing here yet. Add the topic ", h("span", { class: "topic" }, s.topic),
            " to your repo to be the first.")));
}

function meetEl() {
  const url = safeUrl(config.club.signupUrl);
  if (!config.club.meeting && !url) return null;
  return h("section", { class: "meet" },
    h("div", {},
      h("h2", { text: "When we meet" }),
      h("p", { text: config.club.meeting })),
    url && h("a", { class: "btn", href: url, target: "_blank", rel: "noopener" }, "Sign up"));
}

function howTo() {
  const siteRepo = config.club.siteRepo;
  const submitUrl = `https://github.com/${siteRepo}/issues/new?template=submit-project.yml`;
  return h("section", { class: "howto", id: "submit" },
    h("h2", { text: "Add your project" }),
    h("ol", { class: "steps" },
      h("li", {}, "Put your project in a public GitHub repo."),
      h("li", {}, "On the repo page, click the gear next to About and add the topic for your workshop (listed below)."),
      h("li", {}, "Optional: add a file called ", h("code", {}, "preview.png"),
        " to the repo root and set a website link in About. They become your card image and Live demo button."),
      h("li", {}, "If your workshop is marked Approved, also fill in the submit form so a leader can review it.")),
    h("div", { class: "topics" },
      config.sections.map((s) => h("div", { class: "topic-card" },
        h("strong", { text: s.title }),
        h("span", { class: "topic" }, s.topic),
        h("small", { text: modeOf(s) === "auto"
          ? "Shows up on its own within about 30 minutes."
          : "Shows up after a club leader approves it." })))),
    h("p", {}, h("a", { class: "btn", href: submitUrl, target: "_blank", rel: "noopener" }, "Submit a project")));
}

function render() {
  const app = document.getElementById("app");
  const total = Object.values(data.sections || {}).reduce((n, list) => n + list.length, 0);
  document.title = `${config.club.name} project gallery`;

  const sections = config.sections.map(sectionEl).filter(Boolean);

  const search = h("input", {
    class: "search", type: "search", placeholder: "Search projects, people, languages",
    "aria-label": "Search projects", value: state.q,
    oninput: (e) => { state.q = e.target.value; renderBody(); },
  });
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Filter by type" },
    Object.entries(TYPE_LABELS).map(([key, label]) =>
      h("button", {
        class: "chip", type: "button", "aria-pressed": String(state.type === key),
        onclick: () => { state.type = key; renderBody(); },
      }, label)));
  const jump = h("nav", { class: "jump", "aria-label": "Workshops" },
    config.sections.map((s) => h("a", { href: "#" + s.id, text: s.title })));

  app.replaceChildren(...[
    h("header", { class: "hero" }, h("div", { class: "wrap" },
      config.club.logo && h("img", { class: "hero-logo", src: config.club.logo, alt: config.club.name + " logo" }),
      h("h1", {}, config.club.name, " ", h("span", {}, "projects")),
      h("p", { text: config.club.tagline }),
      h("div", { class: "hero-actions" },
        safeUrl(config.club.signupUrl) && h("a", { class: "btn", href: config.club.signupUrl, target: "_blank", rel: "noopener" }, "Sign up"),
        h("a", { class: "btn ghost", href: "#submit" }, "Add your project"),
        h("a", { class: "btn ghost", href: `https://github.com/${config.club.org}`, target: "_blank", rel: "noopener" }, "Our GitHub"),
        h("span", { class: "count", text: `${total} project${total === 1 ? "" : "s"}` })))),
    meetEl() && h("div", { class: "wrap" }, meetEl()),
    h("div", { class: "bar" }, h("div", { class: "wrap" }, search, chips, jump)),
    h("main", { class: "wrap", id: "sections" }, sections.length ? sections : h("div", { class: "empty" }, h("p", { text: "No projects match that." }))),
    h("div", { class: "wrap" }, howTo()),
    h("footer", {}, h("div", { class: "wrap" },
      data.generated ? `Updated ${new Date(data.generated).toLocaleString()}` : "Not built yet"))].filter(Boolean));
}

// Re-render only the project list so the search box keeps focus while typing.
function renderBody() {
  const main = document.getElementById("sections");
  const sections = config.sections.map(sectionEl).filter(Boolean);
  main.replaceChildren(...(sections.length ? sections : [h("div", { class: "empty" }, h("p", { text: "No projects match that." }))]));
  document.querySelectorAll(".chip").forEach((c, i) => {
    c.setAttribute("aria-pressed", String(Object.keys(TYPE_LABELS)[i] === state.type));
  });
}

async function boot() {
  try {
    const [c, d] = await Promise.all([
      fetch("config.json").then((r) => r.json()),
      fetch("data.json").then((r) => (r.ok ? r.json() : { sections: {} })).catch(() => ({ sections: {} })),
    ]);
    config = c; data = d;
    render();
  } catch (err) {
    document.getElementById("app").textContent = "Could not load the gallery. Check config.json for typos.";
    console.error(err);
  }
}
boot();
