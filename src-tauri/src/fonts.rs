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
    /// `std::env::consts::OS`: `windows`, `macos` or `linux`. The frontend uses
    /// it to advertise the Chinese families that ship with that platform.
    pub platform: &'static str,
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
///
/// Chinese government documents also name the GB2312 cuts (`仿宋_GB2312`,
/// `楷体_GB2312`) and Founder's `方正小标宋简体` title face. Those files are
/// not part of a stock Windows or macOS install, so the names sit next to the
/// modern faces they are interchangeable with: the resolver then serves the
/// installed cut under the name the document authored, and saving keeps that
/// name intact.
const FAMILY_GROUPS: &[&[&str]] = &[
    &[
        "宋体",
        "simsun",
        "nsimsun",
        "songti",
        "songtisc",
        "宋体简",
        "songtijian",
        "华文宋体",
        "stsong",
        "stsongti",
    ],
    &["微软雅黑", "microsoftyahei", "microsoftyaheiui", "msyh"],
    &[
        "黑体",
        "simhei",
        "stheiti",
        "黑体简",
        "heitijian",
        "heiti",
        "heitisc",
        "华文黑体",
    ],
    &[
        "楷体",
        "kaiti",
        "kaitisc",
        "楷体gb2312",
        "kaitigb2312",
        "楷体简",
        "kaitijian",
        "华文楷体",
        "stkaiti",
    ],
    &[
        "仿宋",
        "fangsong",
        "仿宋gb2312",
        "fangsonggb2312",
        "仿宋简",
        "fangsongjian",
        "华文仿宋",
        "stfangsong",
    ],
    &["等线", "dengxian"],
    &["思源黑体", "sourcehansanssc", "notosanssc", "notosanscjksc"],
    &[
        "思源宋体",
        "sourcehanserifsc",
        "notoserifsc",
        "notoserifcjksc",
    ],
    &["苹方", "pingfang", "pingfangsc", "苹方简", "pingfangjian"],
    &["华文中宋", "stzhongsong", "zhongsong"],
    &["华文细黑", "stxihei", "xihei"],
    &[
        "冬青黑体简体中文",
        "hiraginosansgb",
        "hiraginosansgbw3",
        "hiraginosansgbw6",
    ],
    &[
        "方正小标宋简体",
        "方正小标宋",
        "fzxiaobiaosong",
        "fzxiaobiaosongb05",
        "fzxiaobiaosongb05s",
        "fzxbsjw",
        "fzxbsjwgb10",
    ],
];

/// Substitutes tried in order when none of a family's own names is installed.
/// These are deliberately one-way: a document asking for 宋体 must never land
/// on the 小标宋 title face, but a title whose own font is missing should keep
/// a serif voice instead of dropping to the default sans fallback.
const FAMILY_FALLBACKS: &[(&str, &[&str])] = &[
    // Founder's title face: the medium-weight 华文中宋 is the closest cut that
    // ships with Office; 宋体 is the last readable serif resort.
    ("方正小标宋简体", &["华文中宋", "宋体"]),
    // FangSong / KaiTi are not system faces on macOS. Songti keeps the page in
    // the same serif family rather than switching to the sans fallback.
    ("仿宋", &["宋体"]),
    ("楷体", &["宋体"]),
    // Apple's optional display cuts: if one is missing, the system Heiti keeps
    // the same sans voice instead of dropping to the default fallback.
    ("苹方", &["黑体"]),
    ("华文细黑", &["黑体"]),
    ("冬青黑体简体中文", &["黑体"]),
];

fn normalize(name: &str) -> String {
    name.chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

/// Every name belonging to the family's equivalence group. The requested name
/// stays first so an exact install always beats its aliases.
fn with_group(family: &str) -> Vec<String> {
    let wanted = normalize(family);
    let mut names = vec![wanted.clone()];
    for group in FAMILY_GROUPS {
        if group.iter().any(|name| normalize(name) == wanted) {
            names.extend(group.iter().map(|name| normalize(name)));
        }
    }
    names
}

/// Names to try in priority order: the family and its aliases, then the
/// one-way fallbacks. Order is significant, so dedupe without sorting.
fn candidates(family: &str) -> Vec<String> {
    let mut names = with_group(family);
    for (source, fallbacks) in FAMILY_FALLBACKS {
        let source_names = with_group(source);
        if source_names.iter().any(|name| names.contains(name)) {
            for fallback in *fallbacks {
                names.extend(with_group(fallback));
            }
        }
    }

    let mut seen = HashSet::new();
    names.retain(|name| seen.insert(name.clone()));
    names
}

fn matching_faces<'a>(db: &'a Database, family: &str) -> Vec<&'a FaceInfo> {
    // Rank every requested, alias and fallback name, then keep only the faces
    // whose best match is the highest-ranked name actually installed. This is
    // one pass over the database, and it stops a fallback from contributing
    // when a better face exists.
    let ranked: HashMap<String, usize> = candidates(family)
        .into_iter()
        .enumerate()
        .map(|(index, name)| (name, index))
        .collect();

    let mut best: Option<usize> = None;
    let mut matched = Vec::new();
    for face in db.faces() {
        let rank = face
            .families
            .iter()
            .filter_map(|(name, _)| ranked.get(&normalize(name)).copied())
            .min();
        let Some(rank) = rank else { continue };
        match best {
            Some(current) if rank > current => continue,
            Some(current) if rank < current => {
                matched.clear();
                best = Some(rank);
            }
            None => best = Some(rank),
            _ => {}
        }
        matched.push(face);
    }
    matched
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
    let mut payload = SystemFontPayload {
        platform: std::env::consts::OS,
        ..SystemFontPayload::default()
    };
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
    fn groups_gb2312_cuts_with_modern_faces() {
        let fangsong = candidates("仿宋_GB2312");
        assert!(fangsong.contains(&"仿宋".to_string()));
        assert!(fangsong.contains(&"fangsong".to_string()));

        let kaiti = candidates("KaiTi_GB2312");
        assert!(kaiti.contains(&"楷体".to_string()));
        assert!(kaiti.contains(&"kaiti".to_string()));
    }

    #[test]
    fn groups_apple_localized_names() {
        let heiti = candidates("黑体-简");
        assert!(heiti.contains(&"heitisc".to_string()));
        assert!(heiti.contains(&"stheiti".to_string()));

        assert!(candidates("Songti SC").contains(&"宋体".to_string()));
        assert!(candidates("STFangsong").contains(&"仿宋".to_string()));

        // Optional Apple cuts fall back to the system Heiti.
        assert!(candidates("冬青黑体简体中文").contains(&"黑体".to_string()));
        assert!(candidates("苹方").contains(&"黑体".to_string()));
    }

    #[test]
    fn falls_back_for_missing_title_face() {
        let names = candidates("方正小标宋简体");
        let position = |name: &str| {
            names
                .iter()
                .position(|candidate| candidate == name)
                .unwrap()
        };
        assert!(position("方正小标宋简体") < position("华文中宋"));
        assert!(position("华文中宋") < position("宋体"));

        // The fallback is one-way: a Song request must not borrow the title face.
        assert!(!candidates("宋体").contains(&"方正小标宋简体".to_string()));
    }

    #[test]
    #[ignore = "depends on fonts installed on the host"]
    fn resolves_installed_fonts() {
        let payload = load_system_fonts(vec![
            "宋体".to_string(),
            "Calibri".to_string(),
            // The GB2312 cuts are usually absent; these must still resolve
            // through their modern equivalents and the title-face fallback.
            "仿宋_GB2312".to_string(),
            "楷体_GB2312".to_string(),
            "方正小标宋简体".to_string(),
        ]);
        assert!(!payload.faces.is_empty(), "no installed face matched");
        assert_eq!(payload.platform, std::env::consts::OS);
        assert!(
            payload.files.iter().any(|file| !file.data.is_empty()),
            "matched faces carried no bytes"
        );
        assert!(payload.faces.iter().any(|face| face.style == "normal"));
        for family in ["仿宋_GB2312", "楷体_GB2312", "方正小标宋简体"] {
            assert!(
                payload.faces.iter().any(|face| face.family == family),
                "{family} did not resolve to an installed face"
            );
        }
    }
}
