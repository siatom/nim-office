# one-office

A cross-platform, lightweight office suite built with Tauri 2.

The goal is a small, fast desktop app that opens and edits `docx` / `xlsx` / `pptx` / `pdf`
with a deliberately narrow, high-frequency feature set — not a Microsoft Office replacement.

## Status

`v0.1` — application shell + Word (`.docx`) editing.

| Format | Status |
| --- | --- |
| `.docx` | Open, edit, save, save-as (docx-editor) |
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
│ Appearance │                                         │
├────────────┴─────────────────────────────────────────┤
│ status: saved · size · zoom                          │
└──────────────────────────────────────────────────────┘
```

Shortcuts: `Ctrl+N` new, `Ctrl+O` open, `Ctrl+S` save, `Ctrl+Shift+S` save as,
`Ctrl+W` close tab, `Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom.

The appearance panel at the bottom of the sidebar offers light / dark / system mode, eight accent
presets, and a custom colour picker. The accent is persisted locally and repaints buttons,
selection highlights, the app mark, and the document editor's toolbar chrome.

On macOS the native traffic lights are kept and only the title is hidden, so the app still
feels native there.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Shell | Tauri 2 (Rust) | ~10 MB binaries vs ~150 MB for Electron, native file associations |
| UI | React 19 + TypeScript + Vite + Tailwind CSS 4 | |
| DOCX | [docx-editor](https://github.com/eigenpal/docx-editor) 2.x (Apache-2.0 core) | Canonical OOXML editing: unknown markup is preserved on save, so round-trips stay lossless without an HTML intermediate |
| XLSX (planned) | [Univer](https://github.com/dream-num/univer) + custom xlsx bridge | Univer's open-source core covers interaction and formulas; xlsx import/export lives in the commercial tier, so a bridge over ExcelJS is required |
| PDF (planned) | pdf.js + pdf-lib, PDFium in Rust | Matches [OpenPDFStudio](https://github.com/genspark-ai/genoffice)'s approach for text-level edits |
| PPTX (planned) | Custom canvas editor over OOXML | No usable open-source pptx editor exists; `slideN.xml` is edited directly |

### Why not the alternatives

- **Electron** — [GenOffice](https://github.com/genspark-ai/genoffice) is a complete Apache-2.0 office suite worth reading for architecture, but Electron's footprint contradicts the lightweight goal.
- **Luckysheet** — archived; Univer is its official successor.
- **docx-preview / mammoth** — read-only rendering; edits cannot be written back without losing formatting.
- **SuperDoc** — strong DOCX fidelity, but its engine (`@superdoc/docx-engine`) is closed source and the wrapper is AGPL-3.0.
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
  features/docx/           docx-editor mount, engine adapter, lifecycle, export
  lib/accents.ts           Accent presets and contrast-safe ink for custom colours
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

The Rust binary stays small, and the docx-editor engine keeps the frontend to roughly
5 MB of JS (~1.5 MB gzipped) plus a 420 KB HarfBuzz WASM module (~176 KB gzipped). That is
still the dominant cost of DOCX fidelity, but a fraction of the previous engine. Code
splitting the editor behind a dynamic import is an open follow-up.

## License

The editor core (`@docx-editor.dev/core`) is Apache-2.0. Commercial modules
(tracked changes, comments, collaboration, automation) are separate and not used here.
The application repository itself does not declare a license file yet.
