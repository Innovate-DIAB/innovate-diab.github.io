# Leader setup guide

A gallery of member projects, grouped by workshop. It runs on GitHub Pages and rebuilds itself every 30 minutes.

## Set it up (about 10 minutes)

1. The GitHub organization is `Innovate-DIAB`.
2. In the org, create a public repo named `innovate-diab.github.io` and upload everything in this folder to it.
3. Check `config.json`: the org is already set to `Innovate-DIAB`. Change the club name and tagline if you like.
4. In the repo go to Settings, then Pages, and set Source to **GitHub Actions**.
5. Go to the Actions tab, open "Update gallery" and click Run workflow. After a minute your site is live at `https://innovate-diab.github.io`.

## Workshops (sections)

Each section in `config.json` is one workshop:

```json
{
  "id": "bakebuild",
  "title": "BakeBuild",
  "description": "Projects from the BakeBuild workshop.",
  "topic": "diab-hc-bakebuild",
  "mode": "auto"
}
```

To add a workshop, copy a block, give it a new `id`, `title` and `topic`, and add it to `approved.json` too (`"new-id": []`). Also add its name to the dropdown in `.github/ISSUE_TEMPLATE/submit-project.yml`.

Topics must be lowercase, with only letters, numbers and hyphens.

## Events

Edit `events.json` on GitHub (open the file, click the pencil, add a block, commit). Each event needs a `date` like `2026-12-01`; `time`, `location`, `description` and `link` are optional. Events show in date order and disappear after their date passes.

## Automatic or manual

Set `mode` on each section, or change `defaultMode` for all of them.

- `auto`: any public repo with that section's topic shows up within about 30 minutes. Remove a repo with the `blocked` list in `approved.json`.
- `manual`: nothing shows up until you add the repo to that section's list in `approved.json`. Repos waiting for approval are printed in the Action log ("waiting for approval").

Example `approved.json`:

```json
{
  "approved": {
    "bakebuild": [],
    "bakebuild": ["someone/their-cookie-cutter-project"]
  },
  "blocked": ["someone/not-allowed"]
}
```

Members can use the "Submit a project" button on the site, which opens an issue form. You review it, add the repo to `approved.json`, and the site updates on the next run.

## Keeping it limited to your club

By default anyone on GitHub can tag a repo with your topic. In auto mode you can restrict that by listing your members' usernames in `config.json`:

```json
"allowedOwners": ["aditya", "saikrish", "someone-else"]
```

Leave it empty to allow everyone. Because this is a school club with minors, it's worth filling in.

## For members

1. Make your project a public repo.
2. Add your workshop's topic (gear icon next to About on the repo page).
3. Optional: add `preview.png` to the repo root for a custom card image, and fill in the website link in About for a Live demo button.
4. Optional: add a type topic to control the filter: `type-web`, `type-game`, `type-hardware` or `type-code`. Otherwise it's guessed from your other topics and language (`pcb`, `esp32`, `3d-printing` count as hardware, `game` or `pygame` as games).

## Files

- `config.json`: club name, workshops, mode, allowed owners
- `approved.json`: approved and blocked repos
- `scripts/build-data.mjs`: collects repo info from GitHub into `data.json`
- `.github/workflows/update.yml`: runs the script and publishes the site every 30 minutes
- `index.html`, `style.css`, `app.js`: the page itself
