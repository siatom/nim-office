# Technical Decisions

This document records implementation details and technology choices that do not belong in the
product overview.

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
  features/docx/           lazy docx-editor mount, engine adapter, navigation pane, system fonts
  lib/accents.ts           Accent presets and contrast-safe ink for custom colours
  lib/ipc.ts               Typed wrappers around invoke()
```

Documents travel over IPC as base64. File writes go to a sibling `.tmp` file and are then renamed,
so an interrupted save cannot truncate the original.

## Single instance

NimOffice runs as a single instance: launching it again brings the existing window to the front
and opens any documents passed on the command line. Dev builds (`pnpm tauri dev`) use a
`.dev`-suffixed bundle identifier, which gives them their own lock and app-data directory, so a
dev session and an installed build can run side by side. `pnpm tauri build --debug` counts as a
build, not as a dev session.

## Bundle size

The editor is loaded on demand. The shell paints from a ~250 KB chunk (~78 KB gzipped); the editor
chunk (~4.6 MB, ~1.39 MB gzipped) and the 420 KB HarfBuzz WASM (~176 KB gzipped) arrive when the
first document tab mounts. CJK font files are read from the operating system on demand (SimSun's
TTC is ~17 MB), so Word-compatible measurement costs no bundle size; the per-face shaping ceiling
is raised to 64 MB to admit those collections.

## Fonts

Font bytes always come from the host, so the app ships no font files. Documents that name
`仿宋_GB2312`, `楷体_GB2312` or `方正小标宋简体` keep those names when saved; if the exact file is
not installed, the resolver serves the closest installed face (FangSong / KaiTi, and 华文中宋 for
the title face) under the authored name, and HarfBuzz measures with those bytes. The picker offers
宋体, 黑体, 楷体, 仿宋 and the government-document faces everywhere, adds 微软雅黑 / 等线 on
Windows and 苹方 plus the 华文 faces on macOS, all under a dedicated 中文字体 group. Apple-only
families are never listed on Windows.
