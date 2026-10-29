# one-office

A cross-platform, lightweight office suite built with Tauri 2.

The goal is a small, fast desktop app that opens and edits `docx` / `xlsx` / `pptx` / `pdf`
with a deliberately narrow, high-frequency feature set — not a Microsoft Office replacement.

## Status

`v0.1` — application shell + Word (`.docx`) editing.

| Format | Status |
| --- | --- |
| `.docx` | Open, edit, save, save-as (SuperDoc) |
| `.xlsx` | Not implemented |
| `.pptx` | Not implemented |
| `.pdf` | Not implemented |

## Interface

A frameless window with a custom title bar and a left sidebar instead of a native menu bar:

```
┌──────────────────────────────────────────────────────┐
│ logo  one-office  <file>              ─  □  ×        │  custom title bar (drag region)
├────────────┬─────────────────────────────────────────┤
│ New        │  tab · tab · tab                     +  │
│ Open       ├─────────────────────────────────────────┤
│ Save       │  formatting toolbar                     │
│            ├─────────────────────────────────────────┤
│ Recent     │                                         │
│  · file    │            document page                │
│  · file    │                                         │
│            │                                         │
│ Dark mode  │                                         │
├────────────┴─────────────────────────────────────────┤
│ status: saved · size · zoom                          │
└──────────────────────────────────────────────────────┘
```

Shortcuts: `Ctrl+N` new, `Ctrl+O` open, `Ctrl+S` save, `Ctrl+Shift+S` save as,
`Ctrl+W` close tab, `Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom.

On macOS the native traffic lights are kept and only the title is hidden, so the app still
feels native there.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Shell | Tauri 2 (Rust) | ~10 MB binaries vs ~150 MB for Electron, native file associations |
| UI | React 19 + TypeScript + Vite + Tailwind CSS 4 | |
| DOCX | [SuperDoc](https://github.com/superdoc-dev/superdoc) 2.x | OOXML-native editing, so saves round-trip without HTML conversion loss |
| XLSX (planned) | [Univer](https://github.com/dream-num/univer) + custom xlsx bridge | Univer's open-source core covers interaction and formulas; xlsx import/export lives in the commercial tier, so a bridge over ExcelJS is required |
| PDF (planned) | pdf.js + pdf-lib, PDFium in Rust | Matches [OpenPDFStudio](https://github.com/genspark-ai/genoffice)'s approach for text-level edits |
| PPTX (planned) | Custom canvas editor over OOXML | No usable open-source pptx editor exists; `slideN.xml` is edited directly |

### Why not the alternatives

- **Electron** — [GenOffice](https://github.com/genspark-ai/genoffice) is a complete Apache-2.0 office suite worth reading for architecture, but Electron's footprint contradicts the lightweight goal.
- **Luckysheet** — archived; Univer is its official successor.
- **docx-preview / mammoth** — read-only rendering; edits cannot be written back without losing formatting.
- **LibreOffice / ONLYOFFICE** — full-fidelity but hundreds of MB, and they require an external process.

## Architecture

```
src-tauri/                 Rust backend
  src/document.rs          Read/write with atomic temp-file replace
  src/recent.rs            Recent-file store (JSON in the app config dir)
  src/commands.rs          IPC surface
src/
  App.tsx                  Tab workspace, open/save/close orchestration, shortcuts
  components/              Title bar, sidebar, tab bar, status bar, dialogs, toasts
  features/docx/           SuperDoc mount, lifecycle, export
  lib/superdoc-theme.ts    Light/dark themes mapped onto the app's design tokens
  lib/ipc.ts               Typed wrappers around invoke()
```

Documents travel over IPC as base64. File writes go to a sibling `.tmp` file and are then
renamed, so an interrupted save cannot truncate the original.

## Development

```bash
pnpm install
pnpm tauri dev
```

The dev server runs on port **1430** (Tauri's default 1420 is frequently taken when several
Tauri projects run side by side).

Release build:

```bash
pnpm tauri build
```

Requires Node 20+, Rust 1.77+, and the platform Tauri prerequisites.

## Bundle size

The Rust binary stays small, but the SuperDoc document engine dominates the frontend bundle
(~30 MB of JS, ~8 MB gzipped). This is the cost of DOCX fidelity — a lighter editor would mean
a lossy DOCX round-trip. Code splitting and a leaner build of SuperDoc are open follow-ups.

## License

AGPL-3.0, inherited from the SuperDoc dependency.
