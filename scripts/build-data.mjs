// Builds data.json for the gallery. Runs inside GitHub Actions (Node 20+).
//
// For each section in config.json:
//   mode "auto":   every public repo tagged with the section's topic, plus anything in approved.json
//   mode "manual": only repos listed in approved.json for that section
// Repos listed under "blocked" in approved.json never show up.
// If config.allowedOwners is not empty, only repos from those accounts show up.

import { readFile, writeFile } from "node:fs/promises";

const config = JSON.parse(await readFile("config.json", "utf8"));
const approvedFile = JSON.parse(await readFile("approved.json", "utf8"));
const approved = approvedFile.approved || {};
const blocked = new Set((approvedFile.blocked || []).map((s) => s.toLowerCase()));
const allowedOwners = new Set((config.allowedOwners || []).map((s) => s.toLowerCase()));

const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "club-gallery",
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function gh(path) {
  const res = await fetch("https://api.github.com" + path, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res.json();
}

const HARDWARE = ["hardware", "pcb", "kicad", "cad", "3d-printing", "3dprinting", "arduino", "esp32", "esp8266",
  "raspberry-pi", "raspberrypi", "robotics", "electronics", "iot", "fusion360", "onshape", "stm32", "rp2040"];
const GAME = ["game", "games", "gamedev", "game-dev", "pygame", "unity", "godot", "phaser", "scratch-game"];
const WEB = ["website", "web", "webapp", "web-app", "frontend", "html", "css", "nextjs", "react", "vue", "svelte", "portfolio"];

function classify(topics, language) {
  const explicit = topics.find((t) => t.startsWith("type-"));
  if (explicit) {
    const v = explicit.slice(5);
    if (v === "web") return "website";
    if (["website", "game", "code", "hardware"].includes(v)) return v;
  }
  if (topics.some((t) => HARDWARE.includes(t))) return "hardware";
  if (topics.some((t) => GAME.includes(t))) return "game";
  if (topics.some((t) => WEB.includes(t)) || ["HTML", "CSS"].includes(language)) return "website";
  return "code";
}

function shape(r) {
  const topics = r.topics || [];
  return {
    full_name: r.full_name,
    name: r.name,
    owner: r.owner.login,
    avatar: r.owner.avatar_url,
    url: r.html_url,
    description: r.description,
    homepage: r.homepage || null,
    language: r.language,
    stars: r.stargazers_count,
    topics,
    type: classify(topics, r.language),
    updated: r.pushed_at,
  };
}

function ok(r) {
  const full = r.full_name.toLowerCase();
  if (r.private || r.archived) return false;
  if (blocked.has(full)) return false;
  if (allowedOwners.size && !allowedOwners.has(r.owner.login.toLowerCase())) return false;
  return true;
}

const out = { generated: new Date().toISOString(), sections: {} };

for (const s of config.sections) {
  const mode = s.mode || config.defaultMode || "auto";
  const found = new Map();

  if (mode === "auto") {
    const res = await gh(`/search/repositories?q=${encodeURIComponent("topic:" + s.topic)}&per_page=100&sort=updated`);
    for (const r of res?.items || []) if (ok(r)) found.set(r.full_name.toLowerCase(), shape(r));
  } else {
    // Manual mode: log what is waiting so a leader can see it in the Action log.
    const res = await gh(`/search/repositories?q=${encodeURIComponent("topic:" + s.topic)}&per_page=100`);
    const okSet = new Set((approved[s.id] || []).map((x) => x.toLowerCase()));
    const waiting = (res?.items || []).filter((r) => !okSet.has(r.full_name.toLowerCase()) && !blocked.has(r.full_name.toLowerCase()));
    if (waiting.length) console.log(`[${s.id}] waiting for approval: ${waiting.map((r) => r.full_name).join(", ")}`);
  }

  for (const full of approved[s.id] || []) {
    if (found.has(full.toLowerCase())) continue;
    const r = await gh(`/repos/${full}`);
    if (!r) { console.warn(`[${s.id}] approved repo not found or private: ${full}`); continue; }
    if (ok(r)) found.set(full.toLowerCase(), shape(r));
  }

  out.sections[s.id] = [...found.values()].sort((a, b) => new Date(b.updated) - new Date(a.updated));
  console.log(`[${s.id}] ${mode}: ${out.sections[s.id].length} project(s)`);
}

await writeFile("data.json", JSON.stringify(out, null, 2) + "\n");
