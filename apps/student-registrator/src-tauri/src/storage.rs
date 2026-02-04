// Device storage (local JSON file)

use std::fs;
use std::path::PathBuf;
use crate::types::DeviceConfig;

fn get_storage_path() -> PathBuf {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let app_dir = data_dir.join("student-registrator");
    fs::create_dir_all(&app_dir).ok();
    app_dir.join("devices.json")
}

pub fn load_devices() -> Vec<DeviceConfig> {
    let path = get_storage_path();
    if !path.exists() {
        return Vec::new();
    }
    
    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_devices(devices: &[DeviceConfig]) -> Result<(), String> {
    let path = get_storage_path();
    let content = serde_json::to_string_pretty(devices)
        .map_err(|e| e.to_string())?;
    fs::write(&path, content)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_device_by_id(device_id: &str) -> Option<DeviceConfig> {
    let devices = load_devices();
    devices.into_iter().find(|d| d.id == device_id)
}
