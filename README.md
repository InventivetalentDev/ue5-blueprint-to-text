# ue5-blueprint-to-text

Convert UE5 Blueprint and Material graph nodes into LLM-friendly text.

## What it does

When you select nodes in the Unreal Engine 5 Blueprint or Material editor and
press **Ctrl+C**, Unreal serializes them to your clipboard as **T3D** — a
plain-text format. This app accepts that pasted text and re-renders it as:

- **Markdown pseudo-code** — compact, readable, ideal for pasting into an LLM
  chat: `1. Event ReceiveBeginPlay` → `KismetSystemLibrary.PrintString(InString="Hello", ...)`.
- **Structured YAML / JSON** — lossless representation of nodes, pins, and
  edges. Each node also carries its original T3D `raw` block so future
  versions can round-trip LLM edits back into a valid Blueprint paste.

Everything runs client-side. No backend, no uploads.

## Usage

```bash
npm install
npm run dev
```

Open http://localhost:3000, paste your copied nodes into the left pane, and
read the output on the right. Use the **Format** dropdown to switch between
Markdown / YAML / JSON. Use the **Kind** dropdown to override the auto
Blueprint/Material detection if needed.

## Scope (v1)

- Blueprint event/function graphs
- Material expression graphs
- Auto-detect graph kind from node class prefixes

## Not yet (planned)

- Whole-asset export (would require a UE5 editor plugin, since the clipboard
  only carries the selected nodes — not variables, components, or other
  graphs in the asset)
- YAML → T3D emitter (the schema already keeps each node's `raw` block to
  make this tractable)
- Anim Graph / Niagara renderers (the parser already accepts them; just no
  pretty-printer yet — they fall back to YAML/JSON cleanly)
- `.uasset` file upload (binary format, version-dependent, not officially
  documented; the clipboard route avoids all of that)

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — static export to `out/`
- `npm test` — vitest unit tests for parser + renderers

## Deploying to Cloudflare

The app builds to a fully static bundle (`next.config.mjs` sets
`output: "export"`), so it deploys as Cloudflare static assets — no Workers
runtime, no OpenNext adapter needed.

`wrangler.jsonc` points at `./out`. After `npm run build`:

```bash
npx wrangler deploy
```

For Cloudflare's web build pipeline, set the build command to `npm run build`
and the output directory to `out`.
