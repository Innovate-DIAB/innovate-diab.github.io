// Gallery front end. Reads config.json and data.json, builds the page.
// All text that comes from GitHub is added with textContent, never innerHTML.

const TYPE_LABELS = { all: "All", website: "Websites", game: "Games", code: "Coding", hardware: "Hardware" };
const TYPE_BADGE = { website: "Website", game: "Game", code: "Code", hardware: "Hardware" };
const state = { type: "all", q: "" };
let config, data, showcase = {};

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

function stlCard(p) {
  const box = h("div", { class: "viewer", "aria-label": `3D model of ${p.title}`, role: "img" },
    h("span", { class: "viewer-hint", text: "Loading 3D model..." }));
  import("./viewer.js").then((m) => m.mountStl(box, p.stl))
    .catch((err) => { console.error(err); box.querySelector(".viewer-hint").textContent = "3D preview not available in this browser."; });
  box.append(h("span", { class: "viewer-tip", text: "Drag to rotate" }));
  return h("article", { class: "card" },
    box,
    h("div", { class: "card-body" },
      h("h3", {}, h("a", { href: p.url, target: "_blank", rel: "noopener" }, p.title)),
      p.github
        ? h("a", { class: "author", href: `https://github.com/${p.github}`, target: "_blank", rel: "noopener" },
            h("img", { src: `https://github.com/${p.github}.png?size=40`, alt: "", loading: "lazy" }), p.author)
        : h("span", { class: "author" }, p.author),
      h("p", {}, p.description),
      h("div", { class: "meta" },
        h("span", { class: "badge" }, "3D print"),
        isApproved(p) ? h("span", { class: "badge bit" }, "+1 InnoBit") : h("span", { class: "badge pend" }, "Pending"),
        h("span", { class: "badge wip" }, "In progress")),
      h("div", { class: "links" },
        h("a", { href: p.url, target: "_blank", rel: "noopener" }, "View on GitHub"),
        h("a", { href: p.stl, download: "" }, "Download STL"))));
}

function card(p) {
  if (p.stl) return stlCard(p);
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
  const all = [...(showcase[s.id] || []), ...(data.sections?.[s.id] || [])];
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
  const ext = safeUrl(config.club.signupExternalUrl);
  if (!config.club.meeting && !url && !ext) return null;
  return h("section", { class: "meet" },
    h("div", {},
      h("h2", { text: "When we meet" }),
      h("p", { text: config.club.meeting })),
    h("div", { class: "meet-actions" },
      url && h("a", { class: "btn", href: url, target: "_blank", rel: "noopener" }, "DIAB students: sign up"),
      ext && h("a", { class: "btn ghost", href: ext, target: "_blank", rel: "noopener" }, "Other schools: sign up")));
}

// Only approved projects earn an InnoBit. Repo-based projects come from the approved list, so they count.
const isApproved = (p) => (p.status || "approved") === "approved";

// InnoBits: every project someone submits earns them 1 InnoBit. Counted from everything shown in the gallery.
function innoBits() {
  const people = new Map();
  const all = [...Object.values(showcase), ...Object.values(data.sections || {})].flat();
  for (const p of all) {
    const github = p.github || (p.stl ? null : p.owner) || null;
    const name = p.author || p.owner;
    if (!name) continue;
    const key = (github || name).toLowerCase();
    const e = people.get(key) || { name, github, avatar: p.avatar || null, count: 0, pending: 0, projects: [] };
    if (github && !e.github) e.github = github;
    if (isApproved(p)) e.count += 1; else e.pending += 1;
    e.projects.push((p.title || pretty(p.name)) + (isApproved(p) ? "" : " (pending)"));
    people.set(key, e);
  }
  return [...people.values()].sort((x, y) => y.count - x.count || y.pending - x.pending || x.name.localeCompare(y.name));
}

function innoBitsEl() {
  const board = innoBits();
  if (!board.length) return null;
  const total = board.reduce((n, e) => n + e.count, 0);
  const pendingTotal = board.reduce((n, e) => n + e.pending, 0);
  return h("section", { class: "innobits", id: "innobits" },
    h("div", { class: "section-head" },
      h("h2", { text: "InnoBits" }),
      h("span", { class: "mode", text: `${total} earned${pendingTotal ? `, ${pendingTotal} pending` : ""}` })),
    h("p", { class: "desc", text: "Every approved project earns you 1 InnoBit. Projects still waiting for approval show as pending until they are approved." }),
    h("ol", { class: "bits" }, board.map((e, i) => {
      const who = [
        (e.github || e.avatar) && h("img", { src: e.avatar || `https://github.com/${e.github}.png?size=40`, alt: "", loading: "lazy" }),
        h("span", { class: "bits-name", text: e.name })];
      return h("li", { title: e.projects.join(", ") },
        h("span", { class: "bits-rank", text: i + 1 }),
        e.github ? h("a", { href: `https://github.com/${e.github}`, target: "_blank", rel: "noopener" }, who) : h("span", { class: "bits-who" }, who),
        h("span", { class: "bits-count" + (e.count ? "" : " none"), text: `${e.count} InnoBit${e.count === 1 ? "" : "s"}` + (e.pending ? ` · ${e.pending} pending` : "") }));
    })));
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
  const total = [data.sections, showcase].reduce((n, o) => n + Object.values(o || {}).reduce((m, l) => m + l.length, 0), 0);
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
        safeUrl(config.club.tiktokUrl) && h("a", { class: "btn ghost", href: config.club.tiktokUrl, target: "_blank", rel: "noopener" }, "TikTok"),
        safeUrl(config.club.instagramUrl) && h("a", { class: "btn ghost", href: config.club.instagramUrl, target: "_blank", rel: "noopener" }, "Instagram"),
        safeUrl(config.club.youtubeUrl) && h("a", { class: "btn ghost", href: config.club.youtubeUrl, target: "_blank", rel: "noopener" }, "YouTube"),
        h("a", { class: "btn ghost", href: `https://github.com/${config.club.org}`, target: "_blank", rel: "noopener" }, "Our GitHub"),
        h("span", { class: "count", text: `${total} project${total === 1 ? "" : "s"}` })))),
    meetEl() && h("div", { class: "wrap" }, meetEl()),
    h("div", { class: "bar" }, h("div", { class: "wrap" }, search, chips, jump)),
    h("main", { class: "wrap", id: "sections" }, sections.length ? sections : h("div", { class: "empty" }, h("p", { text: "No projects match that." }))),
    innoBitsEl() && h("div", { class: "wrap" }, innoBitsEl()),
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
    const [c, d, sc] = await Promise.all([
      fetch("config.json", { cache: "no-cache" }).then((r) => r.json()),
      fetch("data.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : { sections: {} })).catch(() => ({ sections: {} })),
      fetch("showcase.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    config = c; data = d; showcase = sc;
    render();
  } catch (err) {
    document.getElementById("app").textContent = "Could not load the gallery. Check config.json for typos.";
    console.error(err);
  }
}
boot();
