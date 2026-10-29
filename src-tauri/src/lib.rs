mod commands;
mod document;
mod error;
mod fonts;
mod recent;

#[cfg(target_os = "macos")]
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Windows and Linux run fully undecorated and draw their own title
            // bar. macOS keeps its native traffic lights and only hides the
            // title, so the app still feels native there.
            #[cfg(target_os = "macos")]
            if let Some(window) = _app.get_webview_window("main") {
                use tauri::TitleBarStyle;
                let _ = window.set_decorations(true);
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_document,
            commands::write_document,
            commands::list_recent,
            commands::push_recent,
            commands::remove_recent,
            commands::clear_recent,
            commands::path_exists,
            fonts::load_system_fonts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
