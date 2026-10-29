use std::path::PathBuf;

use serde_json::{json, Value};
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

#[tauri::command]
pub async fn agent_chat(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<Value>,
) -> Result<String, String> {
    let base = base_url.trim().trim_end_matches('/');
    if !(base.starts_with("https://") || base.starts_with("http://")) {
        return Err("Base URL 必须以 http:// 或 https:// 开头".into());
    }
    if model.trim().is_empty() {
        return Err("请先设置模型名称".into());
    }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let mut request = client
        .post(format!("{base}/chat/completions"))
        .json(&json!({ "model": model, "messages": messages }));
    if !api_key.trim().is_empty() {
        request = request.bearer_auth(api_key.trim());
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("无法连接模型服务：{e}"))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("模型响应解析失败：{e}"))?;
    if !status.is_success() {
        return Err(body
            .get("error")
            .and_then(|v| v.get("message"))
            .and_then(Value::as_str)
            .map(str::to_owned)
            .unwrap_or_else(|| format!("模型请求失败（{status}）")));
    }
    body.pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "模型没有返回文本内容".into())
}
