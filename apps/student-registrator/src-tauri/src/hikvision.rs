// Hikvision ISAPI client with Digest Authentication

use crate::types::{DeviceActionResult, DeviceConfig, DeviceConnectionResult, UserInfoEntry, UserInfoSearchResponse};
use reqwest::Client;
use serde_json::{json, Value};

pub struct HikvisionClient {
    device: DeviceConfig,
    client: Client,
}

impl HikvisionClient {
    pub fn new(device: DeviceConfig) -> Self {
        Self {
            device,
            client: Client::new(),
        }
    }

    fn base_url(&self) -> String {
        format!("http://{}:{}", self.device.host, self.device.port)
    }

    async fn digest_request(&self, method: &str, url: &str, body: Option<Value>) -> Result<String, String> {
        // First request to get WWW-Authenticate header
        let initial_response = self.client
            .request(reqwest::Method::from_bytes(method.as_bytes()).unwrap(), url)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if initial_response.status() != reqwest::StatusCode::UNAUTHORIZED {
            return initial_response.text().await.map_err(|e| e.to_string());
        }

        let www_auth = initial_response
            .headers()
            .get("www-authenticate")
            .and_then(|v| v.to_str().ok())
            .ok_or("No WWW-Authenticate header")?;

        // Parse digest challenge and create authorization
        let auth_context = digest_auth::parse(www_auth)
            .map_err(|e| format!("Parse digest error: {:?}", e))?;

        let mut auth_context = auth_context;
        let auth_header = auth_context
            .respond(&digest_auth::AuthContext::new(
                &self.device.username,
                &self.device.password,
                url,
            ))
            .map_err(|e| format!("Auth error: {:?}", e))?;

        // Authenticated request
        let mut request = self.client
            .request(reqwest::Method::from_bytes(method.as_bytes()).unwrap(), url)
            .header("Authorization", auth_header.to_string());

        if let Some(json_body) = body {
            request = request
                .header("Content-Type", "application/json")
                .body(json_body.to_string());
        }

        let response = request.send().await.map_err(|e| e.to_string())?;
        response.text().await.map_err(|e| e.to_string())
    }

    pub async fn test_connection(&self) -> DeviceConnectionResult {
        let url = format!("{}/ISAPI/System/deviceInfo?format=json", self.base_url());
        
        match self.digest_request("GET", &url, None).await {
            Ok(_) => DeviceConnectionResult { ok: true, message: None },
            Err(e) => DeviceConnectionResult { ok: false, message: Some(e) },
        }
    }

    pub async fn create_user(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
        begin_time: &str,
        end_time: &str,
    ) -> DeviceActionResult {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Record?format=json", self.base_url());
        
        let payload = json!({
            "UserInfo": {
                "employeeNo": employee_no,
                "name": name,
                "userType": "normal",
                "doorRight": "1",
                "RightPlan": [{ "doorNo": 1, "planTemplateNo": "1" }],
                "Valid": {
                    "enable": true,
                    "beginTime": begin_time,
                    "endTime": end_time,
                    "timeType": "local"
                },
                "gender": gender,
                "localUIRight": false,
                "maxOpenDoorTime": 0,
                "userVerifyMode": ""
            }
        });

        match self.digest_request("POST", &url, Some(payload)).await {
            Ok(text) => parse_action_result(&text),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("RequestFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }

    pub async fn upload_face(
        &self,
        employee_no: &str,
        name: &str,
        gender: &str,
        image_base64: &str,
    ) -> DeviceActionResult {
        // Note: Face upload requires multipart/form-data
        // This is a simplified version - may need curl fallback for production
        let url = format!("{}/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json", self.base_url());
        
        let face_record = json!({
            "faceLibType": "blackFD",
            "FDID": "1",
            "FPID": employee_no,
            "name": name,
            "gender": gender
        });

        // Decode base64 image
        let image_bytes = match base64::Engine::decode(&base64::engine::general_purpose::STANDARD, image_base64) {
            Ok(bytes) => bytes,
            Err(e) => {
                return DeviceActionResult {
                    ok: false,
                    status_code: None,
                    status_string: Some("InvalidImage".to_string()),
                    error_msg: Some(e.to_string()),
                };
            }
        };

        // Build multipart form
        let form = reqwest::multipart::Form::new()
            .text("FaceDataRecord", face_record.to_string())
            .part("FaceImage", reqwest::multipart::Part::bytes(image_bytes).file_name("face.jpg").mime_str("image/jpeg").unwrap());

        // For multipart with digest auth, we need special handling
        // Simplified: try direct upload (may need curl fallback)
        match self.client
            .post(&url)
            .basic_auth(&self.device.username, Some(&self.device.password))
            .multipart(form)
            .send()
            .await
        {
            Ok(res) => {
                let text = res.text().await.unwrap_or_default();
                parse_action_result(&text)
            }
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("UploadFailed".to_string()),
                error_msg: Some(e.to_string()),
            },
        }
    }

    pub async fn search_users(&self, offset: i32, limit: i32) -> UserInfoSearchResponse {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Search?format=json", self.base_url());
        
        let payload = json!({
            "UserInfoSearchCond": {
                "searchID": format!("search-{}", chrono::Utc::now().timestamp()),
                "maxResults": limit,
                "searchResultPosition": offset
            }
        });

        match self.digest_request("POST", &url, Some(payload)).await {
            Ok(text) => serde_json::from_str(&text).unwrap_or(UserInfoSearchResponse { user_info_search: None }),
            Err(_) => UserInfoSearchResponse { user_info_search: None },
        }
    }

    pub async fn get_user_by_employee_no(&self, employee_no: &str) -> Option<UserInfoEntry> {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Search?format=json", self.base_url());
        
        let payload = json!({
            "UserInfoSearchCond": {
                "searchID": format!("search-{}", chrono::Utc::now().timestamp()),
                "maxResults": 1,
                "searchResultPosition": 0,
                "EmployeeNoList": [{ "employeeNo": employee_no }]
            }
        });

        match self.digest_request("POST", &url, Some(payload)).await {
            Ok(text) => {
                let result: UserInfoSearchResponse = serde_json::from_str(&text).ok()?;
                result.user_info_search?.user_info?.into_iter().next()
            }
            Err(_) => None,
        }
    }

    pub async fn delete_user(&self, employee_no: &str) -> DeviceActionResult {
        let url = format!("{}/ISAPI/AccessControl/UserInfo/Delete?format=json", self.base_url());
        
        let payload = json!({
            "UserInfoDelCond": {
                "EmployeeNoList": [{ "employeeNo": employee_no }]
            }
        });

        match self.digest_request("PUT", &url, Some(payload)).await {
            Ok(text) => parse_action_result(&text),
            Err(e) => DeviceActionResult {
                ok: false,
                status_code: None,
                status_string: Some("DeleteFailed".to_string()),
                error_msg: Some(e),
            },
        }
    }

    /// Fetch face image from device to reuse it
    pub async fn fetch_face_image(&self, face_url: &str) -> Result<Vec<u8>, String> {
        let full_url = if face_url.starts_with("http") {
            face_url.to_string()
        } else {
            format!("{}/{}", self.base_url(), face_url.trim_start_matches('/'))
        };

        // First request to get WWW-Authenticate header
        let initial_response = self.client
            .get(&full_url)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if initial_response.status() != reqwest::StatusCode::UNAUTHORIZED {
            let bytes = initial_response.bytes().await.map_err(|e| e.to_string())?;
            return Ok(bytes.to_vec());
        }

        let www_auth = initial_response
            .headers()
            .get("www-authenticate")
            .and_then(|v| v.to_str().ok())
            .ok_or("No WWW-Authenticate header")?;

        let auth_context = digest_auth::parse(www_auth)
            .map_err(|e| format!("Parse digest error: {:?}", e))?;

        let mut auth_context = auth_context;
        let auth_header = auth_context
            .respond(&digest_auth::AuthContext::new(
                &self.device.username,
                &self.device.password,
                &full_url,
            ))
            .map_err(|e| format!("Auth error: {:?}", e))?;

        let response = self.client
            .get(&full_url)
            .header("Authorization", auth_header.to_string())
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch face image: HTTP {}", response.status()));
        }

        let bytes = response.bytes().await.map_err(|e| e.to_string())?;
        Ok(bytes.to_vec())
    }
}

fn parse_action_result(text: &str) -> DeviceActionResult {
    match serde_json::from_str::<Value>(text) {
        Ok(data) => {
            let status_code = data.get("statusCode").and_then(|v| v.as_i64()).map(|v| v as i32);
            let status_string = data.get("statusString").and_then(|v| v.as_str()).map(|s| s.to_string());
            let error_msg = data.get("errorMsg").and_then(|v| v.as_str()).map(|s| s.to_string());
            let ok = status_code == Some(1) || status_string.as_deref() == Some("OK");
            
            DeviceActionResult { ok, status_code, status_string, error_msg }
        }
        Err(_) => DeviceActionResult {
            ok: false,
            status_code: None,
            status_string: Some("ParseError".to_string()),
            error_msg: Some(text.to_string()),
        },
    }
}
