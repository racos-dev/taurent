//! 35-field sort comparator with numeric sentinels and locale-aware string
//! collation. Mirrors `sortTorrents.ts` exactly:
//!
//! - Numeric sentinels:
//!   - `availability`: `< 0` → negative infinity for asc, positive infinity for desc
//!   - `eta`: `< 0` → positive infinity for asc, negative infinity for desc
//!   - `popularity`: `None` → negative infinity
//!   - `ratio` / `ratio_limit`: `< 0` → negative infinity
//! - String fields use an `icu_collator::Collator` configured with
//!   ECMA-402 defaults (`numeric: false`, default sensitivity).
//! - `force_start` is a boolean: false < true.
//!
//! Collators are cached per locale in `CollatorCache`. On locale parse
//! failure we fall back to root collation (NOT byte order) and emit a
//! single `log::warn!` per cache instance.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::sync::Arc;

use icu_collator::options::CollatorOptions;
use icu_collator::{Collator, CollatorBorrowed};
use icu_locale::Locale;

use crate::dto::MaindataTorrentRow;
use crate::sync::MaindataSnapshot;

/// Sort direction (matches the JS `'asc' | 'desc'` literal).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDirection {
    Asc,
    Desc,
}

/// Caches one `icu_collator::Collator` (returned by `Collator::try_new` as a
/// `CollatorBorrowed<'static>`) per locale. Builds the collator with
/// ECMA-402 default options (`numeric: false`, default sensitivity) so it
/// matches JavaScript's `String.prototype.localeCompare` behavior closely.
///
/// On `Locale::try_from_str` failure we log a single warning per locale and
/// fall back to root collation — we never fall back to byte order because
/// that would diverge from `localeCompare` for CJK/accented names.
#[derive(Debug, Default)]
pub struct CollatorCache {
    cache: HashMap<String, Option<Arc<CollatorBorrowed<'static>>>>,
}

impl CollatorCache {
    /// Create an empty cache.
    pub fn new() -> Self {
        Self::default()
    }

    /// Return a collator for `locale`. Cached per locale string.
    pub fn get_or_insert(&mut self, locale: &str) -> Option<Arc<CollatorBorrowed<'static>>> {
        if let Some(existing) = self.cache.get(locale) {
            return existing.clone();
        }
        let collator = build_collator_for_locale(locale);
        self.cache.insert(locale.to_string(), collator.clone());
        collator
    }

    /// Drop all cached collators. Useful in tests.
    pub fn clear(&mut self) {
        self.cache.clear();
    }

    /// Number of cached locales.
    pub fn len(&self) -> usize {
        self.cache.len()
    }

    pub fn is_empty(&self) -> bool {
        self.cache.is_empty()
    }
}

/// Build a `CollatorBorrowed<'static>` for the given locale string.
///
/// Returns `None` only when the root collator cannot be built. In practice
/// ICU's compiled data path always succeeds for root collation.
fn build_collator_for_locale(locale: &str) -> Option<Arc<CollatorBorrowed<'static>>> {
    let locale_id = match Locale::try_from_str(locale) {
        Ok(loc) => loc,
        Err(err) => {
            log::warn!(
                "workspace view: failed to parse locale '{}', falling back to root collation: {}",
                locale,
                err
            );
            // Fall back to root collation by passing the default
            // `CollatorPreferences` — equivalent to passing `Locale::UNKNOWN`
            // but doesn't require naming the type.
            return Collator::try_new(Default::default(), CollatorOptions::default())
                .ok()
                .map(Arc::new);
        }
    };

    // ECMA-402 default sensitivity maps to `Strength::Tertiary` (variant +
    // case + accents). `Strength::Tertiary` is also the default value of
    // `Strength`, so we can leave `options.strength` at `None`.
    let options = CollatorOptions::default();

    match Collator::try_new(locale_id.into(), options) {
        Ok(collator) => Some(Arc::new(collator)),
        Err(err) => {
            log::warn!(
                "workspace view: failed to build collator for locale '{}', falling back to root: {}",
                locale,
                err
            );
            Collator::try_new(Default::default(), CollatorOptions::default())
                .ok()
                .map(Arc::new)
        }
    }
}

/// Compare two torrent hashes by the given sort field.
///
/// `snapshot` is borrowed to look up the row for each hash. `collator` is
/// required for string fields; numeric fields ignore it.
///
/// Sorts hash slices with `slice::sort_by` for stability.
pub fn compare_hashes(
    a_hash: &str,
    b_hash: &str,
    snapshot: &MaindataSnapshot,
    field: &str,
    direction: SortDirection,
    collator: Option<&CollatorBorrowed<'static>>,
) -> Ordering {
    let a = snapshot.torrents.get(a_hash);
    let b = snapshot.torrents.get(b_hash);
    compare_rows(a, b, field, direction, collator)
}

/// Compare two torrent rows by the given sort field.
///
/// Public so external callers (tests, future ad-hoc sorters) can drive the
/// same comparator without needing a snapshot.
pub fn compare_rows(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    field: &str,
    direction: SortDirection,
    collator: Option<&CollatorBorrowed<'static>>,
) -> Ordering {
    match field {
        "added_on" => cmp_i64_opt(a, b, |r| r.added_on, direction),
        "amount_left" => cmp_i64_opt(a, b, |r| r.amount_left, direction),
        "availability" => cmp_availability(a, b, direction),
        "category" => cmp_string_opt(a, b, |r| r.category.clone(), direction, collator),
        "completed" => cmp_i64_opt(a, b, |r| r.completed, direction),
        "completion_on" => cmp_i64_opt(a, b, |r| r.completion_on, direction),
        "dl_limit" => cmp_i64_opt(a, b, |r| r.dl_limit, direction),
        "downloaded" => cmp_i64_opt(a, b, |r| r.downloaded, direction),
        "downloaded_session" => cmp_i64_opt(a, b, |r| r.downloaded_session, direction),
        "dlspeed" => cmp_i64_opt(a, b, |r| r.dlspeed, direction),
        "eta" => cmp_eta(a, b, direction),
        "force_start" => cmp_bool_opt(a, b, |r| r.force_start, direction),
        "last_activity" => cmp_i64_opt(a, b, |r| r.last_activity, direction),
        "name" => cmp_string_opt(a, b, |r| r.name.clone(), direction, collator),
        "num_complete" => cmp_i64_opt_neg_sentinel(a, b, |r| r.num_complete, direction),
        "num_incomplete" => cmp_i64_opt_neg_sentinel(a, b, |r| r.num_incomplete, direction),
        "num_leechs" => cmp_i64_opt(a, b, |r| r.num_leechs, direction),
        "num_seeds" => cmp_i64_opt(a, b, |r| r.num_seeds, direction),
        "popularity" => cmp_popularity(a, b, direction),
        "priority" => cmp_i64_opt(a, b, |r| r.priority.map(|p| p as i64), direction),
        "progress" => cmp_f64_opt(a, b, |r| r.progress, direction),
        "ratio" => cmp_non_negative(a, b, |r| r.ratio, direction),
        "ratio_limit" => cmp_non_negative(a, b, |r| r.ratio_limit, direction),
        "save_path" => cmp_string_opt(a, b, |r| r.save_path.clone(), direction, collator),
        "seeding_time" => cmp_i64_opt(a, b, |r| r.seeding_time, direction),
        "seen_complete" => cmp_i64_opt(a, b, |r| r.seen_complete, direction),
        "size" => cmp_i64_opt(a, b, |r| r.size, direction),
        "state" => cmp_string_opt(a, b, |r| r.state.clone(), direction, collator),
        "tags" => cmp_string_opt(a, b, |r| r.tags.clone(), direction, collator),
        "time_active" => cmp_i64_opt(a, b, |r| r.time_active, direction),
        "total_size" => cmp_i64_opt(a, b, |r| r.total_size, direction),
        "tracker" => cmp_string_opt(a, b, |r| r.tracker.clone(), direction, collator),
        "up_limit" => cmp_i64_opt(a, b, |r| r.up_limit, direction),
        "uploaded" => cmp_i64_opt(a, b, |r| r.uploaded, direction),
        "uploaded_session" => cmp_i64_opt(a, b, |r| r.uploaded_session, direction),
        "upspeed" => cmp_i64_opt(a, b, |r| r.upspeed, direction),
        // Default: same as JS `default` branch — sort by added_on.
        _ => cmp_i64_opt(a, b, |r| r.added_on, direction),
    }
}

// -----------------------------------------------------------------------------
// Per-type comparators
// -----------------------------------------------------------------------------

/// Numeric comparator for `Option<i64>` with the JS `|| 0` fallback.
#[inline]
fn cmp_i64_opt<F: Fn(&MaindataTorrentRow) -> Option<i64>>(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    f: F,
    direction: SortDirection,
) -> Ordering {
    let av = a.and_then(&f).unwrap_or(0);
    let bv = b.and_then(&f).unwrap_or(0);
    apply_direction(av.cmp(&bv), direction)
}

/// Numeric comparator for `Option<i64>` with `-1` fallback (used by
/// `num_complete`/`num_incomplete`).
#[inline]
fn cmp_i64_opt_neg_sentinel<F: Fn(&MaindataTorrentRow) -> Option<i64>>(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    f: F,
    direction: SortDirection,
) -> Ordering {
    let av = a.and_then(&f).unwrap_or(-1);
    let bv = b.and_then(&f).unwrap_or(-1);
    apply_direction(av.cmp(&bv), direction)
}

/// `availability`: `< 0` → negative infinity (asc), positive infinity (desc).
/// Equivalent: replace negative values with a sentinel that always sorts last
/// (or first, for desc). We use `i64::MIN` for `< 0` so it always sorts
/// before any real availability value.
#[inline]
fn cmp_availability(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    direction: SortDirection,
) -> Ordering {
    let av = a
        .and_then(|r| r.availability)
        .map(|v| if v < 0.0 { f64::NEG_INFINITY } else { v })
        .unwrap_or(f64::NEG_INFINITY);
    let bv = b
        .and_then(|r| r.availability)
        .map(|v| if v < 0.0 { f64::NEG_INFINITY } else { v })
        .unwrap_or(f64::NEG_INFINITY);
    // Float comparison handles NaN as "not equal" but our inputs are filtered
    // to finite values, so plain `cmp` is fine.
    apply_direction(av.partial_cmp(&bv).unwrap_or(Ordering::Equal), direction)
}

/// `eta`: `< 0` → positive infinity (asc), negative infinity (desc).
#[inline]
fn cmp_eta(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    direction: SortDirection,
) -> Ordering {
    let av = a
        .and_then(|r| r.eta)
        .map(|v| if v < 0 { i64::MAX } else { v })
        .unwrap_or(i64::MAX);
    let bv = b
        .and_then(|r| r.eta)
        .map(|v| if v < 0 { i64::MAX } else { v })
        .unwrap_or(i64::MAX);
    apply_direction(av.cmp(&bv), direction)
}

/// `popularity`: `None` → negative infinity.
#[inline]
fn cmp_popularity(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    direction: SortDirection,
) -> Ordering {
    let av = a.and_then(|r| r.popularity).unwrap_or(f64::NEG_INFINITY);
    let bv = b.and_then(|r| r.popularity).unwrap_or(f64::NEG_INFINITY);
    apply_direction(av.partial_cmp(&bv).unwrap_or(Ordering::Equal), direction)
}

/// `ratio` / `ratio_limit`: `< 0` → negative infinity.
#[inline]
fn cmp_non_negative<F: Fn(&MaindataTorrentRow) -> Option<f64>>(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    f: F,
    direction: SortDirection,
) -> Ordering {
    let av = a
        .and_then(&f)
        .map(|v| if v < 0.0 { f64::NEG_INFINITY } else { v })
        .unwrap_or(f64::NEG_INFINITY);
    let bv = b
        .and_then(&f)
        .map(|v| if v < 0.0 { f64::NEG_INFINITY } else { v })
        .unwrap_or(f64::NEG_INFINITY);
    apply_direction(av.partial_cmp(&bv).unwrap_or(Ordering::Equal), direction)
}

/// `Option<f64>` fallback to 0 (used by `progress`).
#[inline]
fn cmp_f64_opt<F: Fn(&MaindataTorrentRow) -> Option<f64>>(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    f: F,
    direction: SortDirection,
) -> Ordering {
    let av = a.and_then(&f).unwrap_or(0.0);
    let bv = b.and_then(&f).unwrap_or(0.0);
    apply_direction(av.partial_cmp(&bv).unwrap_or(Ordering::Equal), direction)
}

/// Boolean field (`force_start`): false < true.
#[inline]
fn cmp_bool_opt<F: Fn(&MaindataTorrentRow) -> Option<bool>>(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    f: F,
    direction: SortDirection,
) -> Ordering {
    let av = a.and_then(&f).unwrap_or(false);
    let bv = b.and_then(&f).unwrap_or(false);
    apply_direction(av.cmp(&bv), direction)
}

/// String field with locale-aware collation. Empty string for `None`.
/// Mirrors `a.field || ''` in JS.
#[inline]
fn cmp_string_opt<F: Fn(&MaindataTorrentRow) -> Option<String>>(
    a: Option<&MaindataTorrentRow>,
    b: Option<&MaindataTorrentRow>,
    f: F,
    direction: SortDirection,
    collator: Option<&CollatorBorrowed<'static>>,
) -> Ordering {
    let av = a.and_then(&f).unwrap_or_default();
    let bv = b.and_then(&f).unwrap_or_default();
    let ord = match collator {
        Some(c) => c.compare(&av, &bv),
        None => av.cmp(&bv),
    };
    apply_direction(ord, direction)
}

#[inline]
fn apply_direction(ord: Ordering, direction: SortDirection) -> Ordering {
    match direction {
        SortDirection::Asc => ord,
        SortDirection::Desc => ord.reverse(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::MaindataTorrentRow;

    fn row_with(name: &str) -> MaindataTorrentRow {
        MaindataTorrentRow {
            name: Some(name.to_string()),
            ..Default::default()
        }
    }

    fn snap(pairs: &[(&str, MaindataTorrentRow)]) -> MaindataSnapshot {
        let mut s = MaindataSnapshot::default();
        for (h, r) in pairs {
            let mut row = r.clone();
            if row.hash.is_none() {
                row.hash = Some((*h).to_string());
            }
            s.torrents.insert((*h).to_string(), row);
        }
        s
    }

    #[test]
    fn cmp_i64_uses_zero_fallback() {
        let r1 = MaindataTorrentRow {
            added_on: Some(10),
            ..Default::default()
        };
        let r2 = MaindataTorrentRow {
            added_on: Some(20),
            ..Default::default()
        };
        let r3 = MaindataTorrentRow::default();
        assert_eq!(
            compare_rows(Some(&r1), Some(&r2), "added_on", SortDirection::Asc, None),
            Ordering::Less
        );
        // None sorts as 0.
        assert_eq!(
            compare_rows(Some(&r3), Some(&r1), "added_on", SortDirection::Asc, None),
            Ordering::Less
        );
        assert_eq!(
            compare_rows(Some(&r2), Some(&r3), "added_on", SortDirection::Asc, None),
            Ordering::Greater
        );
    }

    #[test]
    fn cmp_availability_negative_infinity_sentinel() {
        let r_ok = MaindataTorrentRow {
            availability: Some(0.5),
            ..Default::default()
        };
        let r_neg = MaindataTorrentRow {
            availability: Some(-1.0),
            ..Default::default()
        };
        let r_none = MaindataTorrentRow::default();

        // Asc: -inf < 0 < 0.5.
        assert_eq!(
            compare_rows(
                Some(&r_neg),
                Some(&r_ok),
                "availability",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
        assert_eq!(
            compare_rows(
                Some(&r_none),
                Some(&r_ok),
                "availability",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
        // Desc: 0.5 > -inf → compare(r_ok, r_neg, desc) returns Less (the
        // reversed ordering says r_ok should come *before* r_neg in desc).
        assert_eq!(
            compare_rows(
                Some(&r_ok),
                Some(&r_neg),
                "availability",
                SortDirection::Desc,
                None
            ),
            Ordering::Less
        );
        // The reverse: compare(r_neg, r_ok, desc) returns Greater.
        assert_eq!(
            compare_rows(
                Some(&r_neg),
                Some(&r_ok),
                "availability",
                SortDirection::Desc,
                None
            ),
            Ordering::Greater
        );
    }

    #[test]
    fn cmp_eta_negative_goes_to_infinity_for_asc() {
        let r_eta = MaindataTorrentRow {
            eta: Some(100),
            ..Default::default()
        };
        let r_inf = MaindataTorrentRow {
            eta: Some(-1),
            ..Default::default()
        };
        // Asc: 100 < -1 (because -1 maps to +Inf).
        assert_eq!(
            compare_rows(Some(&r_eta), Some(&r_inf), "eta", SortDirection::Asc, None),
            Ordering::Less
        );
        // Desc reverses: -1 (=+Inf for asc) becomes -Inf for desc, so 100 > -1.
        assert_eq!(
            compare_rows(Some(&r_eta), Some(&r_inf), "eta", SortDirection::Desc, None),
            Ordering::Greater
        );
    }

    #[test]
    fn cmp_popularity_none_is_neg_infinity() {
        let r_pop = MaindataTorrentRow {
            popularity: Some(10.0),
            ..Default::default()
        };
        let r_none = MaindataTorrentRow::default();
        assert_eq!(
            compare_rows(
                Some(&r_none),
                Some(&r_pop),
                "popularity",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
    }

    #[test]
    fn cmp_ratio_negative_is_neg_infinity() {
        let r_pos = MaindataTorrentRow {
            ratio: Some(2.0),
            ..Default::default()
        };
        let r_neg = MaindataTorrentRow {
            ratio: Some(-1.0),
            ..Default::default()
        };
        let r_none = MaindataTorrentRow::default();
        // Asc: -inf (-1) < -inf (None) < 2.0.
        assert_eq!(
            compare_rows(
                Some(&r_neg),
                Some(&r_pos),
                "ratio",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
        // None == -1 (both map to -inf).
        assert_eq!(
            compare_rows(
                Some(&r_none),
                Some(&r_neg),
                "ratio",
                SortDirection::Asc,
                None
            ),
            Ordering::Equal
        );
    }

    #[test]
    fn cmp_force_start_boolean() {
        let t = MaindataTorrentRow {
            force_start: Some(true),
            ..Default::default()
        };
        let f = MaindataTorrentRow {
            force_start: Some(false),
            ..Default::default()
        };
        let none = MaindataTorrentRow::default();
        assert_eq!(
            compare_rows(Some(&f), Some(&t), "force_start", SortDirection::Asc, None),
            Ordering::Less
        );
        // None defaults to false.
        assert_eq!(
            compare_rows(
                Some(&none),
                Some(&t),
                "force_start",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
    }

    #[test]
    fn cmp_string_uses_collator_when_provided() {
        let r1 = row_with("banana");
        let r2 = row_with("apple");
        let r3 = row_with("cherry");
        let s = snap(&[("a", r1.clone()), ("b", r2.clone()), ("c", r3.clone())]);

        let mut cache = CollatorCache::new();
        let c = cache.get_or_insert("en-US");

        // Without collator we get byte order.
        assert_eq!(
            compare_hashes("a", "b", &s, "name", SortDirection::Asc, None),
            Ordering::Greater // banana > apple byte-wise
        );

        // With collator we get locale-aware order.
        assert_eq!(
            compare_hashes("a", "b", &s, "name", SortDirection::Asc, c.as_deref()),
            Ordering::Greater // banana > apple either way
        );
        assert_eq!(
            compare_hashes("b", "a", &s, "name", SortDirection::Asc, c.as_deref()),
            Ordering::Less
        );

        // Desc reverses.
        assert_eq!(
            compare_hashes("b", "a", &s, "name", SortDirection::Desc, c.as_deref()),
            Ordering::Greater
        );
    }

    #[test]
    fn cmp_string_none_falls_back_to_empty() {
        let r = MaindataTorrentRow::default();
        let r_name = MaindataTorrentRow {
            name: Some("x".to_string()),
            ..Default::default()
        };
        assert_eq!(
            compare_rows(Some(&r), Some(&r_name), "name", SortDirection::Asc, None),
            Ordering::Less
        );
    }

    #[test]
    fn unknown_field_falls_back_to_added_on() {
        let r1 = MaindataTorrentRow {
            added_on: Some(5),
            ..Default::default()
        };
        let r2 = MaindataTorrentRow {
            added_on: Some(10),
            ..Default::default()
        };
        assert_eq!(
            compare_rows(
                Some(&r1),
                Some(&r2),
                "no-such-field",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
    }

    #[test]
    fn collator_cache_falls_back_to_root_on_invalid_locale() {
        let mut cache = CollatorCache::new();
        // `123` is not a valid BCP-47 locale. Must still produce *some*
        // collator (root collation).
        let c = cache.get_or_insert("@@@invalid@@@");
        assert!(c.is_some(), "must produce a collator on parse failure");
        // Second call must reuse the same cached entry.
        let c2 = cache.get_or_insert("@@@invalid@@@");
        assert!(Arc::ptr_eq(c.as_ref().unwrap(), c2.as_ref().unwrap()));
        assert_eq!(cache.len(), 1);
    }

    #[test]
    fn collator_cache_distinguishes_locales() {
        let mut cache = CollatorCache::new();
        let en = cache.get_or_insert("en-US");
        let zh = cache.get_or_insert("zh-CN");
        assert!(en.is_some());
        assert!(zh.is_some());
        assert_eq!(cache.len(), 2);
        let en2 = cache.get_or_insert("en-US");
        assert!(Arc::ptr_eq(en.as_ref().unwrap(), en2.as_ref().unwrap()));
    }

    #[test]
    fn cmp_string_with_cjk_names_orders_via_collator() {
        // Use root collator to avoid pulling in CJK data; this just verifies
        // that the collator path is exercised for non-ASCII strings.
        let r1 = row_with("日本語");
        let r2 = row_with("한국어");
        let s = snap(&[("a", r1), ("b", r2)]);
        let mut cache = CollatorCache::new();
        let c = cache.get_or_insert("en-US").unwrap();
        // Both calls must return Some(Ordering); the exact ordering depends
        // on ICU collation tables and is not asserted here.
        let _ = compare_hashes("a", "b", &s, "name", SortDirection::Asc, Some(c.as_ref()));
        let _ = compare_hashes("a", "b", &s, "name", SortDirection::Desc, Some(c.as_ref()));
    }

    #[test]
    fn cmp_num_complete_uses_neg_one_sentinel() {
        let r_some = MaindataTorrentRow {
            num_complete: Some(0),
            ..Default::default()
        };
        let r_none = MaindataTorrentRow::default();
        // None → -1 < 0.
        assert_eq!(
            compare_rows(
                Some(&r_none),
                Some(&r_some),
                "num_complete",
                SortDirection::Asc,
                None
            ),
            Ordering::Less
        );
    }

    #[test]
    fn cmp_priority_uses_zero_fallback() {
        let r1 = MaindataTorrentRow {
            priority: Some(1),
            ..Default::default()
        };
        let r2 = MaindataTorrentRow::default();
        assert_eq!(
            compare_rows(Some(&r2), Some(&r1), "priority", SortDirection::Asc, None),
            Ordering::Less
        );
    }

    #[test]
    fn sort_hashes_is_stable_with_collator() {
        let s = snap(&[
            ("a", row_with("b")),
            ("b", row_with("a")),
            ("c", row_with("c")),
            ("d", row_with("a")),
        ]);
        let mut cache = CollatorCache::new();
        let c = cache.get_or_insert("en-US");
        let mut hashes: Vec<String> = ["a", "b", "c", "d"].iter().map(|s| s.to_string()).collect();
        hashes.sort_by(|x, y| compare_hashes(x, y, &s, "name", SortDirection::Asc, c.as_deref()));
        // "a" before "b" before "c"; "a" < "c" < "d" stay equal-positioned
        // per the original ordering ("b" then "d" both have "a").
        assert_eq!(hashes, vec!["b", "d", "a", "c"]);
    }

    #[test]
    fn compare_hashes_returns_equal_for_missing_rows() {
        let s: MaindataSnapshot = MaindataSnapshot::default();
        let mut cache = CollatorCache::new();
        let c = cache.get_or_insert("en-US");
        // Both hashes are absent — still returns Equal (no panic).
        assert_eq!(
            compare_hashes("a", "b", &s, "name", SortDirection::Asc, c.as_deref()),
            Ordering::Equal
        );
    }

    #[test]
    fn compare_hashes_with_snapshot_uses_correct_rows() {
        let s = snap(&[("a", row_with("z")), ("b", row_with("a"))]);
        let mut cache = CollatorCache::new();
        let c = cache.get_or_insert("en-US");
        assert_eq!(
            compare_hashes("a", "b", &s, "name", SortDirection::Asc, c.as_deref()),
            Ordering::Greater
        );
        // Missing row should compare as if it had an empty name.
        assert_eq!(
            compare_hashes("a", "missing", &s, "name", SortDirection::Asc, c.as_deref()),
            Ordering::Greater
        );
    }
}
