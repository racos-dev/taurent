//! Wire normalization helpers for qBittorrent API fields.
//! No Tauri dependencies — pure Rust utilities.

/// Join tags with commas after trimming whitespace and filtering empties.
pub fn join_tags(tags: &[String]) -> String {
    tags.iter()
        .map(|t| t.trim())
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>()
        .join(",")
}

/// Split comma-separated tag string, trim each piece.
pub fn split_tags(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Join categories with newlines after trimming and filtering empties.
pub fn join_categories(categories: &[String]) -> String {
    categories
        .iter()
        .map(|c| c.trim())
        .filter(|c| !c.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Split newline-separated category string, trim each.
pub fn split_categories(raw: &str) -> Vec<String> {
    raw.split('\n')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// Build multipart form fields for add-torrent. Omits None options entirely (no empty strings or nulls).
/// Tags are comma-joined. Returns Vec<(String, String)> suitable for FormData construction.
#[allow(clippy::too_many_arguments)]
pub fn build_add_torrent_options(
    urls: &[String],
    save_path: Option<&str>,
    cookie: Option<&str>,
    category: Option<&str>,
    tags: Option<&[String]>,
    skip_checking: Option<bool>,
    paused: Option<bool>,
    root_folder: Option<bool>,
    rename: Option<&str>,
    upload_limit: Option<i64>,
    download_limit: Option<i64>,
    ratio_limit: Option<f64>,
    seeding_time_limit: Option<i64>,
    auto_tmm: Option<bool>,
    first_last_piece_prio: Option<bool>,
    sequential_download: Option<bool>,
    content_layout: Option<&str>,
    stop_condition: Option<&str>,
    add_to_top: Option<bool>,
) -> Vec<(String, String)> {
    let mut fields = Vec::new();

    // URLs are always required — join with newlines as a single field (qBittorrent API expects one "urls" key)
    if !urls.is_empty() {
        let joined_urls = urls.join("\n");
        fields.push(("urls".into(), joined_urls));
    }

    if let Some(v) = save_path {
        fields.push(("savepath".into(), v.to_string()));
    }
    if let Some(v) = cookie {
        fields.push(("cookie".into(), v.to_string()));
    }
    if let Some(v) = category {
        fields.push(("category".into(), v.to_string()));
    }
    if let Some(v) = tags {
        let joined = join_tags(v);
        if !joined.is_empty() {
            fields.push(("tags".into(), joined));
        }
    }
    if let Some(v) = skip_checking {
        fields.push((
            "skip_checking".into(),
            if v { "true" } else { "false" }.into(),
        ));
    }
    if let Some(v) = paused {
        fields.push(("paused".into(), if v { "true" } else { "false" }.into()));
    }
    if let Some(v) = root_folder {
        fields.push((
            "root_folder".into(),
            if v { "true" } else { "false" }.into(),
        ));
    }
    if let Some(v) = rename {
        fields.push(("rename".into(), v.to_string()));
    }
    if let Some(v) = upload_limit {
        fields.push(("upLimit".into(), v.to_string()));
    }
    if let Some(v) = download_limit {
        fields.push(("dlLimit".into(), v.to_string()));
    }
    if let Some(v) = ratio_limit {
        fields.push(("ratioLimit".into(), v.to_string()));
    }
    if let Some(v) = seeding_time_limit {
        fields.push(("seedingTimeLimit".into(), v.to_string()));
    }
    if let Some(v) = auto_tmm {
        fields.push(("autoTMM".into(), if v { "true" } else { "false" }.into()));
    }
    if let Some(v) = first_last_piece_prio {
        fields.push((
            "firstLastPiecePrio".into(),
            if v { "true" } else { "false" }.into(),
        ));
    }
    if let Some(v) = sequential_download {
        fields.push((
            "sequentialDownload".into(),
            if v { "true" } else { "false" }.into(),
        ));
    }

    if let Some(v) = content_layout {
        if !v.is_empty() {
            fields.push(("contentLayout".into(), v.to_string()));
        }
    }
    if let Some(v) = stop_condition {
        if !v.is_empty() {
            fields.push(("stopCondition".into(), v.to_string()));
        }
    }
    if let Some(v) = add_to_top {
        fields.push(("addToTop".into(), if v { "true" } else { "false" }.into()));
    }

    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    // join_tags tests
    #[test]
    fn test_join_tags_normal() {
        let tags = vec!["tag1".into(), "tag2".into(), "tag3".into()];
        assert_eq!(join_tags(&tags), "tag1,tag2,tag3");
    }

    #[test]
    fn test_join_tags_empty_array() {
        let tags: Vec<String> = vec![];
        assert_eq!(join_tags(&tags), "");
    }

    #[test]
    fn test_join_tags_whitespace_only() {
        let tags = vec!["  ".into(), "\t".into(), "   ".into()];
        assert_eq!(join_tags(&tags), "");
    }

    #[test]
    fn test_join_tags_mixed_empty_and_valid() {
        let tags = vec!["tag1".into(), "".into(), "  ".into(), "tag2".into()];
        assert_eq!(join_tags(&tags), "tag1,tag2");
    }

    // split_tags tests
    #[test]
    fn test_split_tags_normal() {
        let raw = "tag1, tag2, tag3";
        assert_eq!(split_tags(raw), vec!["tag1", "tag2", "tag3"]);
    }

    #[test]
    fn test_split_tags_empty_input() {
        let raw = "";
        assert_eq!(split_tags(raw), Vec::<String>::new());
    }

    #[test]
    fn test_split_tags_whitespace() {
        let raw = " ";
        assert_eq!(split_tags(raw), Vec::<String>::new());
    }

    #[test]
    fn test_split_tags_with_extra_spaces() {
        let raw = "  tag1  ,  tag2  ,  tag3  ";
        assert_eq!(split_tags(raw), vec!["tag1", "tag2", "tag3"]);
    }

    // join_categories tests
    #[test]
    fn test_join_categories_normal() {
        let cats = vec!["cat1".into(), "cat2".into(), "cat3".into()];
        assert_eq!(join_categories(&cats), "cat1\ncat2\ncat3");
    }

    #[test]
    fn test_join_categories_empty_array() {
        let cats: Vec<String> = vec![];
        assert_eq!(join_categories(&cats), "");
    }

    #[test]
    fn test_join_categories_whitespace_only() {
        let cats = vec!["  ".into(), "\t".into()];
        assert_eq!(join_categories(&cats), "");
    }

    #[test]
    fn test_join_categories_mixed() {
        let cats = vec!["cat1".into(), "".into(), "  ".into(), "cat2".into()];
        assert_eq!(join_categories(&cats), "cat1\ncat2");
    }

    // split_categories tests
    #[test]
    fn test_split_categories_normal() {
        let raw = "cat1\ncat2\ncat3";
        assert_eq!(split_categories(raw), vec!["cat1", "cat2", "cat3"]);
    }

    #[test]
    fn test_split_categories_empty_input() {
        let raw = "";
        assert_eq!(split_categories(raw), Vec::<String>::new());
    }

    #[test]
    fn test_split_categories_whitespace() {
        let raw = "  \n ";
        assert_eq!(split_categories(raw), Vec::<String>::new());
    }

    // build_add_torrent_options tests
    #[test]
    fn test_build_add_torrent_all_none() {
        let urls = vec!["http://example.com/torrent1.torrent".into()];
        let result = build_add_torrent_options(
            &urls, None, None, None, None, None, None, None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        // Only urls should be present
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].0, "urls");
        assert_eq!(result[0].1, "http://example.com/torrent1.torrent");
    }

    #[test]
    fn test_build_add_torrent_all_some() {
        let urls = vec!["http://example.com/torrent1.torrent".into()];
        let tags = vec!["tag1".into(), "tag2".into()];
        let result = build_add_torrent_options(
            &urls,
            Some("/downloads"),
            Some("cookie_value"),
            Some("Videos"),
            Some(&tags),
            Some(true),
            Some(true),
            Some(true),
            Some("my torrent"),
            Some(50000),
            Some(100000),
            Some(2.5),
            Some(60),
            Some(true),
            Some(true),
            Some(true),
            Some("Default"),
            Some("MetadataReceived"),
            Some(true),
        );

        // Check that all fields are present
        let keys: Vec<_> = result.iter().map(|(k, _)| k.as_str()).collect();
        assert!(keys.contains(&"urls"));
        assert!(keys.contains(&"savepath"));
        assert!(keys.contains(&"cookie"));
        assert!(keys.contains(&"category"));
        assert!(keys.contains(&"tags"));
        assert!(keys.contains(&"skip_checking"));
        assert!(keys.contains(&"paused"));
        assert!(keys.contains(&"root_folder"));
        assert!(keys.contains(&"rename"));
        assert!(keys.contains(&"upLimit"));
        assert!(keys.contains(&"dlLimit"));
        assert!(keys.contains(&"ratioLimit"));
        assert!(keys.contains(&"seedingTimeLimit"));
        assert!(keys.contains(&"autoTMM"));
        assert!(keys.contains(&"firstLastPiecePrio"));
        assert!(keys.contains(&"sequentialDownload"));
        assert!(keys.contains(&"contentLayout"));
        assert!(keys.contains(&"stopCondition"));
        assert!(keys.contains(&"addToTop"));

        // Verify tags are comma-joined
        let tags_field = result.iter().find(|(k, _)| k == "tags").unwrap();
        assert_eq!(tags_field.1, "tag1,tag2");
    }

    #[test]
    fn test_build_add_torrent_mixed() {
        let urls = vec!["http://example.com/torrent.torrent".into()];
        let result = build_add_torrent_options(
            &urls,
            Some("/downloads"),
            None,
            None,
            None,
            Some(false), // skip_checking at position 5
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        );

        // Only urls, savepath, and skip_checking should be present
        assert_eq!(result.len(), 3);
        let keys: Vec<_> = result.iter().map(|(k, _)| k.as_str()).collect();
        assert!(keys.contains(&"savepath"));
        assert!(keys.contains(&"skip_checking"));
        assert!(!keys.contains(&"cookie"));
        assert!(!keys.contains(&"category"));
    }

    #[test]
    fn test_build_add_torrent_urls_single() {
        let urls = vec!["http://example.com/torrent1.torrent".into()];
        let result = build_add_torrent_options(
            &urls, None, None, None, None, None, None, None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        let urls_field = result.iter().find(|(k, _)| k == "urls").unwrap();
        assert_eq!(urls_field.1, "http://example.com/torrent1.torrent");
    }

    #[test]
    fn test_build_add_torrent_urls_multiple_joined() {
        let urls = vec![
            "http://example.com/torrent1.torrent".into(),
            "http://example.com/torrent2.torrent".into(),
            "http://example.com/torrent3.torrent".into(),
        ];
        let result = build_add_torrent_options(
            &urls, None, None, None, None, None, None, None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        let urls_field = result.iter().find(|(k, _)| k == "urls").unwrap();
        assert_eq!(urls_field.1, "http://example.com/torrent1.torrent\nhttp://example.com/torrent2.torrent\nhttp://example.com/torrent3.torrent");
    }

    #[test]
    fn test_build_add_torrent_boolean_false_vs_none() {
        let urls = vec!["http://example.com/torrent.torrent".into()];

        // false should produce a field with "false" - skip_checking is at position 5
        let result_false = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            Some(false), // skip_checking at position 5
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        );
        let skip_checking = result_false.iter().find(|(k, _)| k == "skip_checking");
        assert!(skip_checking.is_some());
        assert_eq!(skip_checking.unwrap().1, "false");

        // None should produce no field
        let result_none = build_add_torrent_options(
            &urls, None, None, None, None, None, None, None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        let skip_checking_none = result_none.iter().find(|(k, _)| k == "skip_checking");
        assert!(skip_checking_none.is_none());
    }

    // New fields tests
    #[test]
    fn test_build_add_torrent_content_layout_value() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some("Subfolder"),
            None,
            None,
        );
        assert_eq!(result.len(), 2);
        let content_layout = result.iter().find(|(k, _)| k == "contentLayout").unwrap();
        assert_eq!(content_layout.1, "Subfolder");
    }

    #[test]
    fn test_build_add_torrent_content_layout_empty_omitted() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(""),
            None,
            None,
        );
        let content_layout = result.iter().find(|(k, _)| k == "contentLayout");
        assert!(content_layout.is_none());
    }

    #[test]
    fn test_build_add_torrent_stop_condition_value() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some("AllFilesCreated"),
            None,
        );
        assert_eq!(result.len(), 2);
        let stop_condition = result.iter().find(|(k, _)| k == "stopCondition").unwrap();
        assert_eq!(stop_condition.1, "AllFilesCreated");
    }

    #[test]
    fn test_build_add_torrent_stop_condition_empty_omitted() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(""),
            None,
        );
        let stop_condition = result.iter().find(|(k, _)| k == "stopCondition");
        assert!(stop_condition.is_none());
    }

    #[test]
    fn test_build_add_torrent_add_to_top_true() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(true),
        );
        assert_eq!(result.len(), 2);
        let add_to_top = result.iter().find(|(k, _)| k == "addToTop").unwrap();
        assert_eq!(add_to_top.1, "true");
    }

    #[test]
    fn test_build_add_torrent_add_to_top_false() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            Some(false),
        );
        assert_eq!(result.len(), 2);
        let add_to_top = result.iter().find(|(k, _)| k == "addToTop").unwrap();
        assert_eq!(add_to_top.1, "false");
    }

    #[test]
    fn test_build_add_torrent_all_new_fields_none() {
        let urls = vec!["magnet:?xt=urn:btih:abc".into()];
        let result = build_add_torrent_options(
            &urls, None, None, None, None, None, None, None, None, None, None, None, None, None,
            None, None, None, None, None,
        );
        assert_eq!(result.len(), 1);
        assert!(!result.iter().any(|(k, _)| k == "contentLayout"));
        assert!(!result.iter().any(|(k, _)| k == "stopCondition"));
        assert!(!result.iter().any(|(k, _)| k == "addToTop"));
    }
}
