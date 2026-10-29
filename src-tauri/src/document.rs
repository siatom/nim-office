use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// The document families the application understands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentKind {
    Docx,
    Xlsx,
    Pptx,
    Pdf,
    Unknown,
}

impl DocumentKind {
    pub fn from_path(path: &Path) -> Self {
        match path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref()
        {
            Some("docx") | Some("doc") => DocumentKind::Docx,
            Some("xlsx") | Some("xls") | Some("csv") => DocumentKind::Xlsx,
            Some("pptx") | Some("ppt") => DocumentKind::Pptx,
            Some("pdf") => DocumentKind::Pdf,
            _ => DocumentKind::Unknown,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub path: String,
    pub name: String,
    pub kind: DocumentKind,
    pub size: u64,
    /// Milliseconds since the Unix epoch, if the platform reports a mtime.
    pub modified: Option<u64>,
}

/// The document metadata plus its contents. Kept separate from `DocumentSummary`
/// because inspecting a path must stay cheap enough to paint an opening tab first.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPayload {
    #[serde(flatten)]
    pub summary: DocumentSummary,
    /// Raw file contents, base64 encoded for transport over IPC.
    pub data: String,
}

pub fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

pub fn modified_millis(path: &Path) -> Option<u64> {
    std::fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
}

pub fn describe_document(path: &Path) -> AppResult<DocumentSummary> {
    if !path.exists() {
        return Err(AppError::Invalid(format!("文件不存在：{}", path.display())));
    }
    if !path.is_file() {
        return Err(AppError::Invalid(format!("不是文件：{}", path.display())));
    }

    let metadata = std::fs::metadata(path)?;
    Ok(DocumentSummary {
        path: path.to_string_lossy().into_owned(),
        name: file_name(path),
        kind: DocumentKind::from_path(path),
        size: metadata.len(),
        modified: modified_millis(path),
    })
}

pub fn read_document(path: &Path) -> AppResult<DocumentPayload> {
    let summary = describe_document(path)?;
    let bytes = std::fs::read(path)?;
    Ok(DocumentPayload {
        summary,
        data: STANDARD.encode(bytes),
    })
}

pub fn write_document(path: &Path, data_base64: &str) -> AppResult<()> {
    let bytes = STANDARD
        .decode(data_base64)
        .map_err(|err| AppError::Invalid(format!("数据解码失败：{err}")))?;

    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }

    // Write to a sibling temp file first so a crash mid-write cannot truncate
    // the user's document.
    let temp: PathBuf = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or_default()
    ));
    std::fs::write(&temp, &bytes)?;
    std::fs::rename(&temp, path).map_err(|err| {
        let _ = std::fs::remove_file(&temp);
        AppError::Io(format!("保存失败：{err}"))
    })?;
    Ok(())
}
