use std::fmt::{Display, Formatter};

use serde::{Deserialize, Serialize};

/// Structured error categories for qBittorrent backend operations.
/// Each variant carries context (status code, body snippet) where available.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum BackendError {
    /// Network-level failure: connection refused, DNS lookup failed, timeout, etc.
    Network { message: String },

    /// HTTP response received but status was non-success.
    Http {
        status: u16,
        /// Truncated body snippet (up to 200 chars), if body was text-decodable.
        body_snippet: Option<String>,
    },

    /// Authentication failed (qBittorrent returned non-Ok login response).
    Auth {
        message: String,
        /// Body snippet from the auth endpoint response.
        body_snippet: Option<String>,
    },

    /// Response body failed to parse as expected JSON / UTF-8.
    Parse {
        message: String,
        /// Truncated body snippet if body was available but malformed.
        body_snippet: Option<String>,
    },

    /// Response was structurally valid JSON but missing an expected field
    /// or contained invalid data (e.g. missing 'rid' in sync maindata).
    InvalidResponse { message: String },

    /// Catch-all for other errors (no specific category identified).
    Other { message: String },
}

impl BackendError {
    pub fn new(message: impl Into<String>) -> Self {
        Self::Other {
            message: message.into(),
        }
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    pub fn http(status: u16, body_snippet: Option<String>) -> Self {
        Self::Http {
            status,
            body_snippet,
        }
    }

    pub fn auth(message: impl Into<String>, body_snippet: Option<String>) -> Self {
        Self::Auth {
            message: message.into(),
            body_snippet,
        }
    }

    pub fn parse(message: impl Into<String>, body_snippet: Option<String>) -> Self {
        Self::Parse {
            message: message.into(),
            body_snippet,
        }
    }

    pub fn invalid_response(message: impl Into<String>) -> Self {
        Self::InvalidResponse {
            message: message.into(),
        }
    }

    /// Returns the error message for display/logging.
    pub fn message(&self) -> String {
        match self {
            Self::Network { message } => message.clone(),
            Self::Http {
                status,
                body_snippet,
            } => {
                format!("HTTP {} {:?}", status, body_snippet)
            }
            Self::Auth { message, .. } => message.clone(),
            Self::Parse { message, .. } => message.clone(),
            Self::InvalidResponse { message } => message.clone(),
            Self::Other { message } => message.clone(),
        }
    }

    /// Returns true for network-level errors (timeout, connection refused, etc.).
    pub fn is_network(&self) -> bool {
        matches!(self, Self::Network { .. })
    }

    /// Returns true for HTTP non-success errors.
    pub fn is_http(&self) -> bool {
        matches!(self, Self::Http { .. })
    }

    /// Returns true for authentication failures.
    pub fn is_auth(&self) -> bool {
        matches!(self, Self::Auth { .. })
    }

    /// Returns true for parse/validation errors.
    pub fn is_parse(&self) -> bool {
        matches!(self, Self::Parse { .. })
    }

    /// Returns true for invalid-response-structure errors.
    pub fn is_invalid_response(&self) -> bool {
        matches!(self, Self::InvalidResponse { .. })
    }

    /// Returns true for HTTP 403 Forbidden responses.
    pub fn is_http_403(&self) -> bool {
        matches!(self, Self::Http { status: 403, .. })
    }

    /// Returns true if this error represents a network-level failure.
    /// Checks the `Network` variant, `Http` with status 0, and searches
    /// other variant messages for network-error keywords.
    pub fn is_network_error(&self) -> bool {
        match self {
            Self::Network { .. } => true,
            Self::Http {
                status,
                body_snippet,
            } => {
                *status == 0
                    || body_snippet
                        .as_deref()
                        .is_some_and(is_network_error_message)
            }
            Self::Other { message }
            | Self::Auth { message, .. }
            | Self::Parse { message, .. }
            | Self::InvalidResponse { message } => is_network_error_message(message),
        }
    }
}

/// Check if a string message indicates a network-level failure.
/// Matches case-insensitively against common network error keywords.
pub fn is_network_error_message(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("connection refused")
        || lower.contains("connection failed")
        || lower.contains("timeout")
        || lower.contains("timed out")
        || lower.contains("econnrefused")
        || lower.contains("enotfound")
        || lower.contains("error sending request")
}

impl Display for BackendError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Network { message } => write!(f, "network error: {}", message),
            Self::Http {
                status,
                body_snippet,
            } => {
                write!(f, "HTTP error {} {:?}", status, body_snippet)
            }
            Self::Auth {
                message,
                body_snippet,
            } => {
                write!(f, "auth error: {} {:?}", message, body_snippet)
            }
            Self::Parse {
                message,
                body_snippet,
            } => {
                write!(f, "parse error: {} {:?}", message, body_snippet)
            }
            Self::InvalidResponse { message } => write!(f, "invalid response: {}", message),
            Self::Other { message } => write!(f, "{}", message),
        }
    }
}

impl std::error::Error for BackendError {}

impl From<reqwest::Error> for BackendError {
    fn from(value: reqwest::Error) -> Self {
        if value.is_timeout() {
            return Self::network(format!("request timed out: {}", value));
        }
        if value.is_connect() {
            return Self::network(format!("connection failed: {}", value));
        }
        Self::network(value.to_string())
    }
}

impl From<serde_json::Error> for BackendError {
    fn from(value: serde_json::Error) -> Self {
        Self::parse(format!("JSON error: {}", value), None)
    }
}

impl From<std::io::Error> for BackendError {
    fn from(value: std::io::Error) -> Self {
        Self::network(format!("I/O error: {}", value))
    }
}

pub type BackendResult<T> = Result<T, BackendError>;
