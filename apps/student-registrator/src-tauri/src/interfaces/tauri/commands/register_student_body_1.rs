    // Quick size guard: base64 expands data by ~33%, so this is conservative.
    if face_image_base64.len() > (MAX_FACE_IMAGE_BYTES * 4 / 3) + 256 {
        return Err(format!(
            "Face image is too large. Max {} KB.",
            MAX_FACE_IMAGE_BYTES / 1024
        ));
    }

    let mut devices = load_devices();
    
    if devices.is_empty() {
        return Err("No devices configured".to_string());
    }

    let backend_url = backend_url.filter(|v| !v.trim().is_empty());
    let backend_token = backend_token.filter(|v| !v.trim().is_empty());
    let school_id = school_id.filter(|v| !v.trim().is_empty());

    let full_name = {
        let first = first_name.clone().unwrap_or_default().trim().to_string();
        let last = last_name.clone().unwrap_or_default().trim().to_string();
        let combined = format!("{} {}", last, first).trim().to_string();
        if combined.is_empty() { name.trim().to_string() } else { combined }
    };

    let mut employee_no = generate_employee_no();
    let mut provisioning_id: Option<String> = None;
    let mut api_client: Option<ApiClient> = None;
    let mut backend_device_map: HashMap<String, String> = HashMap::new();
    let requested_target_backend_ids: Option<HashSet<String>> = target_device_ids.as_ref().map(|ids| {
        ids.iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .collect::<HashSet<String>>()
    });
    let explicit_db_only = requested_target_backend_ids
        .as_ref()
        .map(|ids| ids.is_empty())
        .unwrap_or(false);
    let mut provisioned_target_backend_ids: HashSet<String> = HashSet::new();

    if backend_url.is_some() && school_id.is_none() {
        return Err("schoolId is required when backendUrl is set".to_string());
    }

    if let (Some(url), Some(school_id)) = (backend_url.clone(), school_id.clone()) {
        let client = ApiClient::new(url, backend_token.clone());
        let request_id = Uuid::new_v4().to_string();
        let provisioning = client
            .start_provisioning(
                &school_id,
                &full_name,
                &gender,
                Some(&employee_no), // keep numeric device_student_id for Hikvision
                class_id.as_deref(), // classId - to'g'ri o'rinda!
                first_name.as_deref(),
                last_name.as_deref(),
                father_name.as_deref(),
                parent_phone.as_deref(),
                Some(&face_image_base64),
                target_device_ids.as_deref(),
                &request_id,
            )
            .await
            .map_err(|e| format!("Backend provisioning failed: {}", e))?;

        if provisioning.device_student_id.chars().all(|c| c.is_ascii_digit()) {
            employee_no = provisioning.device_student_id;
        }
        provisioning_id = Some(provisioning.provisioning_id);
        if let Some(targets) = provisioning.target_devices.as_ref() {
            for device in targets {
                backend_device_map.insert(device.device_id.clone(), device.id.clone());
                provisioned_target_backend_ids.insert(device.id.clone());
            }
        }
        api_client = Some(client);
    }

    let now = Local::now();
    let begin_time = to_device_time(now);
    let end_time = to_device_time(
        now.with_year(now.year() + 10).unwrap_or(now)
    );

    let mut results = Vec::new();
    let mut successful_devices: Vec<SuccessfulDeviceEntry> = Vec::new();
    let mut abort_error: Option<String> = None;

    let mut devices_changed = false;

