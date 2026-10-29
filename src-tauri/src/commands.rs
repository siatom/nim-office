use std::path::PathBuf;

use tauri::AppHandle;

use crate::document::{self, DocumentPayload};
use crate::error::AppResult;
use crate::recent::{self, RecentEntry};

#[tauri::command]
pub fn read_document(path: String) -> AppResult<DocumentPayload> {
    document::read_document(&PathBuf::from(path))
}

#[tauri::command]
pub fn write_document(path: String, data: String) -> AppResult<()> {
    document::write_document(&PathBuf::from(path), &data)
}

#[tauri::command]
pub fn list_recent(app: AppHandle) -> AppResult<Vec<RecentEntry>> {
    Ok(recent::load(&app))
}

#[tauri::command]
pub fn push_recent(app: AppHandle, path: String) -> AppResult<Vec<RecentEntry>> {
    recent::push(&app, &path)
}

#[tauri::command]
pub fn remove_recent(app: AppHandle, path: String) -> AppResult<Vec<RecentEntry>> {
    recent::remove(&app, &path)
}

#[tauri::command]
pub fn clear_recent(app: AppHandle) -> AppResult<()> {
    recent::clear(&app)
}

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    std::path::Path::new(&path).is_file()
}
