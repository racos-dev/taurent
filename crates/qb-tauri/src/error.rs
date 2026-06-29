use qb_core::error::BackendError;
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum CommandError {
    #[error("Backend error: {0}")]
    Backend(String),

    #[error("Session not connected")]
    SessionNotConnected,

    #[error("Request failed: {0}")]
    RequestFailed(String),

    #[error("JSON parse error: {0}")]
    JsonError(String),

    #[error("IO error: {0}")]
    IoError(String),
}

impl From<BackendError> for CommandError {
    fn from(e: BackendError) -> Self {
        CommandError::Backend(e.to_string())
    }
}

impl From<String> for CommandError {
    fn from(e: String) -> Self {
        CommandError::RequestFailed(e)
    }
}

impl From<&str> for CommandError {
    fn from(e: &str) -> Self {
        CommandError::RequestFailed(e.to_string())
    }
}
