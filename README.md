# one-office

A cross-platform, lightweight office suite built with Tauri 2.

Goal: read, write and edit `docx` / `xlsx` / `pptx` / `pdf` with a deliberately small,
high-frequency feature set — not a full Microsoft Office replacement.

## Status

Early development. `v0.1` targets the application shell plus Word (`.docx`) editing.

## Tech stack

- **Shell**: Tauri 2 (Rust) — small binaries, native file dialogs, OS file associations
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **DOCX**: [SuperDoc](https://github.com/superdoc-dev/superdoc) — OOXML-native editor (AGPL-3.0)
- **XLSX** (planned): [Univer](https://github.com/dream-num/univer) + custom xlsx bridge
- **PDF** (planned): pdf.js + pdf-lib, heavy operations offloaded to PDFium in Rust
- **PPTX** (planned): custom canvas editor operating on OOXML directly

## License

AGPL-3.0 (inherited from the SuperDoc dependency).
