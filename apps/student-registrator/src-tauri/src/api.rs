// Main Backend API client

use crate::types::DeviceActionResult;
use reqwest::Client;
use serde_json::json;

pub struct ApiClient {
    base_url: String,
    client: Client,
}

impl ApiClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            client: Client::new(),
        }
    }

    /// Sync student registration to main backend
    pub async fn sync_student(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/api/students/sync", self.base_url);
        
        let payload = json!({
            "employeeNo": employee_no,
            "name": name,
            "gender": gender,
            "source": "desktop-registrator"
        });

        match self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(payload.to_string())
            .send()
            .await
        {
            Ok(res) => {
                if res.status().is_success() {
                    DeviceActionResult {
                        ok: true,
                        status_code: Some(res.status().as_u16() as i32),
                        status_string: Some("OK".to_string()),
                        error_msg: None,
                    }
                } else {
                    let status = res.status().as_u16() as i32;
                    let text = res.text().await.unwrap_or_default();
                    DeviceActionResult {
                        ok: false,
                        status_code: Some(status),
                        status_string: Some("RequestFailed".to_string()),
                        error_msg: Some(text),
                    }
                }
            }
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("NetworkError".to_string()),
                error_msg: Some(e.to_string()),
            },
        }
    }
}
