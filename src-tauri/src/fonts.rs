use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use fontdb::{Database, FaceInfo, Source, Style};
use serde::Serialize;

/// Raw font file, base64 encoded so it can travel over IPC once even when
/// several faces share the same collection (e.g. `simsun.ttc`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontFile {
    pub id: String,
    pub data: String,
}

/// One face inside a file, addressed by `fontdb`'s collection index.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontFace {
    pub family: String,
    pub weight: u16,
    pub style: String,
    pub file_id: String,
    pub face_index: u32,
}

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontPayload {
    pub files: Vec<SystemFontFile>,
    pub faces: Vec<SystemFontFace>,
}

/// Loading every installed font's name table takes a moment; the database is
/// process-wide so a second document only pays for the bytes it needs.
static DATABASE: OnceLock<Database> = OnceLock::new();

fn database() -> &'static Database {
    DATABASE.get_or_init(|| {
        let mut db = Database::new();
        db.load_system_fonts();
        db
    })
}

/// Family groups that Word documents mix between localized and English names.
/// Matching normalizes case and strips spaces/punctuation, so "Times New Roman"
/// and "timesnewroman" are the same request.
const FAMILY_GROUPS: &[&[&str]] = &[
    &["宋体", "simsun", "nsimsun", "songti", "songtisc"],
    &["微软雅黑", "microsoftyahei", "microsoftyaheiui", "msyh"],
    &["黑体", "simhei", "stheiti"],
    &["楷体", "kaiti", "kaitisc"],
    &["仿宋", "fangsong"],
    &["等线", "dengxian"],
    &["思源黑体", "sourcehansanssc", "notosanssc", "notosanscjksc"],
    &["思源宋体", "sourcehanserifsc", "notoserifsc", "notoserifcjksc"],
    &["苹方", "pingfang", "pingfangsc"],
];

fn normalize(name: &str) -> String {
    name.chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn candidates(family: &str) -> Vec<String> {
    let wanted = normalize(family);
    let mut names = vec![wanted.clone()];
    for group in FAMILY_GROUPS {
        if group.iter().any(|name| normalize(name) == wanted) {
            names.extend(group.iter().map(|name| normalize(name)));
        }
    }
    names.sort();
    names.dedup();
    names
}

fn matching_faces<'a>(db: &'a Database, family: &str) -> Vec<&'a FaceInfo> {
    let wanted = candidates(family);
    db.faces()
        .filter(|face| {
            face.families
                .iter()
                .any(|(name, _)| wanted.contains(&normalize(name)))
        })
        .collect()
}

/// Closest face to the requested weight/style. Word asks for regular, bold and
/// italic separately, so one representative per slot is enough.
fn pick<'a>(faces: &[&'a FaceInfo], weight: u16, style: Style) -> Option<&'a FaceInfo> {
    faces
        .iter()
        .filter(|face| face.style == style)
        .min_by_key(|face| (i32::from(face.weight.0) - i32::from(weight)).abs())
        .copied()
}

fn source_key(source: &Source) -> String {
    match source {
        Source::File(path) | Source::SharedFile(path, _) => path.to_string_lossy().into_owned(),
        Source::Binary(data) => format!("bin:{:p}", std::sync::Arc::as_ptr(data)),
    }
}

fn source_bytes(source: &Source) -> Option<Vec<u8>> {
    match source {
        Source::File(path) => std::fs::read(path).ok(),
        Source::SharedFile(_, data) | Source::Binary(data) => Some(data.as_ref().as_ref().to_vec()),
    }
}

/// Resolve the families a document actually names to installed font bytes.
///
/// Returning nothing is valid: the editor then keeps its canvas measurement
/// fallback instead of blocking the document on a missing font.
#[tauri::command]
pub fn load_system_fonts(families: Vec<String>) -> SystemFontPayload {
    // A document can declare a large `fontTable`; the editor itself caps this
    // at 64 families, and resolving more would blow the IPC payload.
    let mut wanted: Vec<String> = Vec::new();
    for family in families {
        let family = family.trim().to_string();
        if family.is_empty() {
            continue;
        }
        if wanted
            .iter()
            .any(|existing| normalize(existing) == normalize(&family))
        {
            continue;
        }
        wanted.push(family);
        if wanted.len() >= 64 {
            break;
        }
    }

    let db = database();
    let mut payload = SystemFontPayload::default();
    let mut file_ids: HashMap<String, String> = HashMap::new();
    let mut seen_faces: HashSet<String> = HashSet::new();
    let mut total_bytes = 0usize;
    // Base64 inflates by ~33%; keep the encoded payload around 64 MB.
    const MAX_RAW_BYTES: usize = 48 * 1024 * 1024;

    for family in &wanted {
        let matched = matching_faces(db, family);
        if matched.is_empty() {
            continue;
        }

        for face in [
            pick(&matched, 400, Style::Normal),
            pick(&matched, 700, Style::Normal),
            pick(&matched, 400, Style::Italic),
        ]
        .into_iter()
        .flatten()
        {
            let key = source_key(&face.source);
            let face_key = format!("{key}#{}", face.index);
            if !seen_faces.insert(face_key) {
                continue;
            }

            let file_id = if let Some(id) = file_ids.get(&key) {
                id.clone()
            } else {
                let Some(bytes) = source_bytes(&face.source) else {
                    continue;
                };
                if total_bytes + bytes.len() > MAX_RAW_BYTES {
                    continue;
                }
                total_bytes += bytes.len();

                // The path is stable across documents and unique per file, so
                // the frontend can cache decoded bytes without colliding.
                let id = key.clone();
                payload.files.push(SystemFontFile {
                    id: id.clone(),
                    data: STANDARD.encode(bytes),
                });
                file_ids.insert(key, id.clone());
                id
            };

            payload.faces.push(SystemFontFace {
                family: family.clone(),
                weight: face.weight.0,
                style: match face.style {
                    Style::Normal => "normal",
                    _ => "italic",
                }
                .to_string(),
                file_id,
                face_index: face.index,
            });
        }
    }

    payload
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_family_names() {
        assert_eq!(normalize("Times New Roman"), "timesnewroman");
        assert_eq!(normalize("微软 雅黑"), "微软雅黑");
    }

    #[test]
    fn groups_localized_and_english_names() {
        let names = candidates("宋体");
        assert!(names.contains(&"simsun".to_string()));
        assert!(names.contains(&"nsimsun".to_string()));
        assert!(candidates("Microsoft YaHei").contains(&"微软雅黑".to_string()));
    }

    #[test]
    #[ignore = "depends on fonts installed on the host"]
    fn resolves_installed_fonts() {
        let payload = load_system_fonts(vec!["宋体".to_string(), "Calibri".to_string()]);
        assert!(!payload.faces.is_empty(), "no installed face matched");
        assert!(
            payload.files.iter().any(|file| !file.data.is_empty()),
            "matched faces carried no bytes"
        );
        assert!(payload.faces.iter().any(|face| face.style == "normal"));
    }
}
