use std::path::PathBuf;

use tauri::AppHandle;

use crate::document::{self, DocumentPayload, DocumentSummary};
use crate::error::AppResult;
use crate::recent::{self, RecentEntry};

#[tauri::command]
pub async fn read_document(path: String) -> AppResult<DocumentPayload> {
    tauri::async_runtime::spawn_blocking(move || document::read_document(&PathBuf::from(path)))
        .await
        .map_err(|error| crate::error::AppError::Io(format!("读取任务失败：{error}")))?
}

#[tauri::command]
pub fn describe_document(path: String) -> AppResult<DocumentSummary> {
    document::describe_document(&PathBuf::from(path))
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
