// Tauri Commands - Bridge between React UI and Rust backend

use crate::hikvision::HikvisionClient;
use crate::storage::{get_device_by_id, load_devices, save_devices};
use crate::types::{DeviceConfig, RegisterDeviceResult, RegisterResult, UserInfoSearchResponse};
use crate::api::ApiClient;
use chrono::{Datelike, Local, Timelike};
use uuid::Uuid;

fn generate_employee_no() -> String {
    let mut result = String::new();
    for _ in 0..10 {
        result.push_str(&(rand::random::<u8>() % 10).to_string());
    }
    result
}

fn to_device_time(dt: chrono::DateTime<Local>) -> String {
    format!(
        "{}-{:02}-{:02}T{:02}:{:02}:{:02}",
        dt.year(), dt.month(), dt.day(),
        dt.hour(), dt.minute(), dt.second()
    )
}

// ============ Device Management Commands ============

#[tauri::command]
pub async fn get_devices() -> Result<Vec<DeviceConfig>, String> {
    Ok(load_devices())
}

#[tauri::command]
pub async fn create_device(
    name: String,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<DeviceConfig, String> {
    let mut devices = load_devices();
    
    if devices.len() >= 6 {
        return Err("Maximum 6 devices allowed".to_string());
    }

    let device = DeviceConfig {
        id: Uuid::new_v4().to_string(),
        name,
        host,
        port,
        username,
        password,
    };

    devices.push(device.clone());
    save_devices(&devices)?;
    
    Ok(device)
}

#[tauri::command]
pub async fn update_device(
    id: String,
    name: String,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<DeviceConfig, String> {
    let mut devices = load_devices();
    
    let index = devices.iter().position(|d| d.id == id)
        .ok_or("Device not found")?;

    let device = DeviceConfig { id, name, host, port, username, password };
    devices[index] = device.clone();
    save_devices(&devices)?;
    
    Ok(device)
}

#[tauri::command]
pub async fn delete_device(id: String) -> Result<bool, String> {
    let mut devices = load_devices();
    let original_len = devices.len();
    devices.retain(|d| d.id != id);
    
    if devices.len() == original_len {
        return Err("Device not found".to_string());
    }
    
    save_devices(&devices)?;
    Ok(true)
}

#[tauri::command]
pub async fn test_device_connection(device_id: String) -> Result<bool, String> {
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    let result = client.test_connection().await;
    
    Ok(result.ok)
}

// ============ Student Registration Commands ============

#[tauri::command]
pub async fn register_student(
    name: String,
    gender: String,
    face_image_base64: String,
    backend_url: Option<String>,
) -> Result<RegisterResult, String> {
    let devices = load_devices();
    
    if devices.is_empty() {
        return Err("No devices configured".to_string());
    }

    let employee_no = generate_employee_no();
    let now = Local::now();
    let begin_time = to_device_time(now);
    let end_time = to_device_time(
        now.with_year(now.year() + 10).unwrap_or(now)
    );

    let mut results = Vec::new();

    for device in devices {
        let client = HikvisionClient::new(device.clone());
        
        // Test connection
        let connection = client.test_connection().await;
        if !connection.ok {
            results.push(RegisterDeviceResult {
                device_id: device.id,
                device_name: device.name,
                connection,
                user_create: None,
                face_upload: None,
            });
            continue;
        }

        // Create user
        let user_create = client.create_user(
            &employee_no,
            &name,
            &gender,
            &begin_time,
            &end_time,
        ).await;

        if !user_create.ok {
            results.push(RegisterDeviceResult {
                device_id: device.id,
                device_name: device.name,
                connection,
                user_create: Some(user_create),
                face_upload: None,
            });
            continue;
        }

        // Upload face
        let face_upload = client.upload_face(
            &employee_no,
            &name,
            &gender,
            &face_image_base64,
        ).await;

        results.push(RegisterDeviceResult {
            device_id: device.id,
            device_name: device.name,
            connection,
            user_create: Some(user_create),
            face_upload: Some(face_upload),
        });
    }

    // Sync to main backend if URL provided
    if let Some(url) = backend_url {
        let api_client = ApiClient::new(url);
        let _ = api_client.sync_student(&employee_no, &name, &gender).await;
    }

    Ok(RegisterResult {
        employee_no,
        results,
    })
}

// ============ User Management Commands ============

#[tauri::command]
pub async fn fetch_users(device_id: String, offset: Option<i32>, limit: Option<i32>) -> Result<UserInfoSearchResponse, String> {
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    let result = client.search_users(offset.unwrap_or(0), limit.unwrap_or(30)).await;
    
    Ok(result)
}

#[tauri::command]
pub async fn delete_user(device_id: String, employee_no: String) -> Result<bool, String> {
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    let result = client.delete_user(&employee_no).await;
    
    if result.ok {
        Ok(true)
    } else {
        Err(result.error_msg.unwrap_or("Delete failed".to_string()))
    }
}

/// Recreate user - delete and create again with updated info
#[tauri::command]
pub async fn recreate_user(
    device_id: String,
    employee_no: String,
    name: String,
    gender: String,
    new_employee_no: bool,
    reuse_existing_face: bool,
    face_image_base64: Option<String>,
) -> Result<serde_json::Value, String> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let device = get_device_by_id(&device_id)
        .ok_or("Device not found")?;
    
    let client = HikvisionClient::new(device);
    
    // Test connection
    let connection = client.test_connection().await;
    if !connection.ok {
        return Err(connection.message.unwrap_or("Device offline".to_string()));
    }

    // Get face image - either from existing user or from provided base64
    let face_data: String = if reuse_existing_face && face_image_base64.is_none() {
        // Fetch existing face from device
        let existing_user = client.get_user_by_employee_no(&employee_no).await
            .ok_or("User not found on device")?;
        
        let face_url = existing_user.face_url
            .ok_or("Existing user has no face to reuse")?;
        
        let face_bytes = client.fetch_face_image(&face_url).await?;
        STANDARD.encode(&face_bytes)
    } else if let Some(base64) = face_image_base64 {
        base64
    } else {
        return Err("Face image is required".to_string());
    };

    // Determine new employee number
    let next_employee_no = if new_employee_no {
        generate_employee_no()
    } else {
        employee_no.clone()
    };

    // Delete old user
    let delete_result = client.delete_user(&employee_no).await;
    if !delete_result.ok {
        return Err(format!("Delete failed: {}", delete_result.error_msg.unwrap_or_default()));
    }

    // Create new user
    let now = Local::now();
    let begin_time = to_device_time(now);
    let end_time = to_device_time(
        now.with_year(now.year() + 10).unwrap_or(now)
    );

    let create_result = client.create_user(
        &next_employee_no,
        &name,
        &gender,
        &begin_time,
        &end_time,
    ).await;

    if !create_result.ok {
        return Err(format!("Create failed: {}", create_result.error_msg.unwrap_or_default()));
    }

    // Upload face
    let face_upload = client.upload_face(
        &next_employee_no,
        &name,
        &gender,
        &face_data,
    ).await;

    Ok(serde_json::json!({
        "employeeNo": next_employee_no,
        "deleteResult": {
            "ok": delete_result.ok,
            "statusString": delete_result.status_string,
            "errorMsg": delete_result.error_msg
        },
        "createResult": {
            "ok": create_result.ok,
            "statusString": create_result.status_string,
            "errorMsg": create_result.error_msg
        },
        "faceUpload": {
            "ok": face_upload.ok,
            "statusString": face_upload.status_string,
            "errorMsg": face_upload.error_msg
        }
    }))
}
