use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::document::{file_name, DocumentKind};
use crate::error::{AppError, AppResult};

const MAX_ENTRIES: usize = 20;
const STORE_FILE: &str = "recent.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentEntry {
    pub path: String,
    pub name: String,
    pub kind: DocumentKind,
    pub opened_at: u64,
}

fn store_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| AppError::Io(format!("无法定位配置目录：{err}")))?;
    Ok(dir.join(STORE_FILE))
}

pub fn load(app: &AppHandle) -> Vec<RecentEntry> {
    let Ok(path) = store_path(app) else {
        return Vec::new();
    };
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let mut entries: Vec<RecentEntry> = serde_json::from_str(&raw).unwrap_or_default();
    // Drop entries the user has since moved or deleted.
    entries.retain(|entry| std::path::Path::new(&entry.path).is_file());
    entries
}

fn save(app: &AppHandle, entries: &[RecentEntry]) -> AppResult<()> {
    let path = store_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(entries)
        .map_err(|err| AppError::Io(format!("序列化失败：{err}")))?;
    std::fs::write(path, raw)?;
    Ok(())
}

pub fn push(app: &AppHandle, path: &str) -> AppResult<Vec<RecentEntry>> {
    let file = std::path::Path::new(path);
    let mut entries = load(app);
    entries.retain(|entry| entry.path != path);
    entries.insert(
        0,
        RecentEntry {
            path: path.to_string(),
            name: file_name(file),
            kind: DocumentKind::from_path(file),
            opened_at: chrono::Utc::now().timestamp_millis() as u64,
        },
    );
    entries.truncate(MAX_ENTRIES);
    save(app, &entries)?;
    Ok(entries)
}

pub fn remove(app: &AppHandle, path: &str) -> AppResult<Vec<RecentEntry>> {
    let mut entries = load(app);
    entries.retain(|entry| entry.path != path);
    save(app, &entries)?;
    Ok(entries)
}

pub fn clear(app: &AppHandle) -> AppResult<()> {
    let mut entries = load(app);
    entries.clear();
    save(app, &entries)
}
