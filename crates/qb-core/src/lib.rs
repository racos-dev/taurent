//! Shared Rust qBittorrent/session core.

pub mod capability;
pub mod client;
pub mod dto;
pub mod error;
pub mod normalize;
pub mod server;
pub mod session;
pub mod sync;
pub mod workspace;

#[cfg(test)]
mod tests;

pub use dto::{
    parse_build_info, parse_categories, parse_preferences, parse_rss_items, parse_rss_rules,
    parse_search_plugins, parse_search_results, parse_search_start_id, parse_search_statuses,
    parse_sync_torrent_peers, parse_tags, parse_torrent_files, parse_torrent_list,
    parse_torrent_properties, parse_torrent_trackers, parse_transfer_info, parse_webseeds,
    BuildInfoDto, PreferencesDto, PreferencesUpdateDto, RssItemDto, RssRuleDto,
    SearchPluginCategoryDto, SearchPluginDto, SearchResultDto, SearchResultsDto, SearchStatusDto,
    TorrentDto, TorrentFileDto, TorrentPropertiesDto, TrackerDto, TransferInfoDto, WebSeedDto,
};
pub use error::{BackendError, BackendResult};
pub use server::{
    ActiveServerSummary, AddServerInput, CredentialStatus, NormalizeServerUrlInput,
    NormalizeServerUrlOutput, ProbeServerSchemeResult, SavedServerSummary, ServerCredentialsInput,
    ServerRecord, ServerValidationResult, TestConnectionResult, UpdateServerInput,
};
pub use session::{SafeServerSummary, ServerIdentity, SessionManager, SessionState, SessionStatus};
