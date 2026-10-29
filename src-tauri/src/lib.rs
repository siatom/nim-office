mod commands;
mod document;
mod error;
mod fonts;
mod recent;

use tauri::{Emitter, Manager};

pub fn run() {
    let mut context = tauri::generate_context!();

    // `tauri build` enables the `custom-protocol` feature, `tauri dev` does not.
    // Dev builds get their own bundle identifier, and with it their own
    // single-instance lock and app-data directory, so a dev session can run
    // alongside an installed build. Two builds of the same kind still collide.
    if tauri::is_dev() {
        let identifier = context.config().identifier.clone();
        context.config_mut().identifier = format!("{identifier}.dev");
    }

    tauri::Builder::default()
        // Registered first: a second launch is rejected during setup, before the
        // remaining plugins get a chance to run.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // The second instance exits on its own; surface the window the user
            // already has instead of silently doing nothing.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }

            // argv[0] is the executable path. Anything after it can be a document
            // handed over through a file association or the command line.
            let paths: Vec<String> = argv
                .into_iter()
                .skip(1)
                .filter(|path| std::path::Path::new(path).is_file())
                .collect();
            if !paths.is_empty() {
                let _ = app.emit("open-files", paths);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // Windows and Linux run fully undecorated and draw their own title
                // bar. macOS keeps its native traffic lights and only hides the
                // title, so the app still feels native there.
                #[cfg(target_os = "macos")]
                {
                    use tauri::TitleBarStyle;
                    let _ = window.set_decorations(true);
                    let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
                }
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_document,
            commands::describe_document,
            commands::write_document,
            commands::list_recent,
            commands::push_recent,
            commands::remove_recent,
            commands::clear_recent,
            commands::path_exists,
            fonts::load_system_fonts,
        ])
        .run(context)
        .expect("error while running tauri application");
}
