# NimOffice

A cross-platform, lightweight office suite built with Tauri 2.

NimOffice is guided by two principles: **lightweight** and **intelligent**. It keeps the desktop
shell small and fast, loads document editing capabilities on demand, and focuses on everyday office
tasks rather than recreating a full office suite. Intelligent assistance is an evolving direction:
the document agent is an initial step, with room to grow into richer AI-assisted office workflows
over time. The goal is to make useful assistance part of a focused, responsive desktop app.

## Status

`v0.1` — application shell + Word (`.docx`) editing.

| Format | Status |
| --- | --- |
| `.docx` | Open, edit, save, save-as (docx-editor) |
| `.xlsx` | Not implemented |
| `.pptx` | Not implemented |
| `.pdf` | Not implemented |

## Interface

A frameless workspace with a custom title bar, collapsible action sidebar, tab strip, and document
canvas:

```
┌──────────────────────────────────────────────────────┐
│ logo  NimOffice  · tab · tab · tab · +    ─  □  ×    │  custom title bar and tabs
├────────────┬─────────────────────────────────────────┤
│ New        │  formatting toolbar                     │
│ Open       ├─────────────────────────────────────────┤
│ Save       │                                         │
│ Agent      │             document page               │
│            │                                         │
│            │                                         │
│            │                                         │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
│ status: document · save state · layout · zoom         │
└──────────────────────────────────────────────────────┘
```

The sidebar can collapse to an icon rail and keeps New, Open, Save, and Agent actions close at hand.
Appearance controls for light / dark mode, accent colour, and settings sit at its bottom. The welcome
screen lists recent files when no document is active. The status bar shows the active document's
save state and size, with page layout, zoom, and fullscreen controls.

Shortcuts: `Ctrl+N` new, `Ctrl+O` open, `Ctrl+S` save, `Ctrl+Shift+S` save as,
`Ctrl+W` close tab, `Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom.

The **文档结构图** action at the end of the toolbar opens the document navigation pane over the
left gutter: a live headings outline (click a row to jump to it), Find (`Ctrl+F`), and Go to
bookmark (`Ctrl+G`). It opens on demand so documents start centred in the full editor viewport.

The **文档智能体** opens beside the editor and is the first step toward broader AI-assisted office
features. It currently answers questions about the active Word document using a configurable model;
it is read-only, and long documents use their outline and sampled text as context. The appearance
controls offer light / dark mode, eight accent presets, and a custom colour picker. The accent is
persisted locally and repaints buttons, selection highlights, the app mark, and the document editor's
toolbar chrome.

On macOS the native traffic lights are kept and only the title is hidden, so the app still
feels native there.

Implementation details and technical choices are documented in [Technical Decisions](docs/technical-decisions.md).

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

Build and silently install the Windows NSIS release locally (Git Bash):

```bash
bash ./scripts/deploy-release.sh
```

The installer snapshot is kept under `.local-cicd/releases/`. Pass `--debug` to build and install a debug bundle.

Requires Node 20+, Rust 1.77+, and the platform Tauri prerequisites.

## License

The editor core (`@docx-editor.dev/core`) is Apache-2.0. Commercial modules
(tracked changes, comments, collaboration, automation) are separate and not used here.
The application repository itself does not declare a license file yet.
