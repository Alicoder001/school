    if devices_changed {
        let _ = save_devices(&devices);
    }

    if let Some(message) = abort_error {
        let rollback_reason = format!("Rolled back due to failure: {}", message);
        let mut rollback_errors: Vec<String> = Vec::new();
        let mut finalize_error: Option<String> = None;
        for (dev, backend_device_id, external_device_id, device_name, device_location) in successful_devices.iter() {
            let client = HikvisionClient::new(dev.clone());
            let result = client.delete_user(&employee_no).await;
            if !result.ok {
                let label = device_label(dev);
                let err = result
                    .error_msg
                    .clone()
                    .unwrap_or_else(|| "Delete failed".to_string());
                rollback_errors.push(format!("{}: {}", label, err));
            }
            if let (Some(api), Some(pid)) = (api_client.as_ref(), provisioning_id.as_ref()) {
                let status_error = if result.ok {
                    rollback_reason.clone()
                } else {
                    let err = result
                        .error_msg
                        .clone()
                        .unwrap_or_else(|| "Rollback delete failed".to_string());
                    format!("{}. Rollback delete failed: {}", rollback_reason, err)
                };
                let _ = api
                    .report_device_result(
                        pid,
                        backend_device_id.as_deref(),
                        external_device_id.as_deref(),
                        Some(device_name.as_str()),
                        None,
                        Some(device_location.as_str()),
                        "FAILED",
                        &employee_no,
                        Some(status_error.as_str()),
                    )
                    .await;
            }
        }
        if let (Some(api), Some(pid)) = (api_client.as_ref(), provisioning_id.as_ref()) {
            let finalize_reason = if rollback_errors.is_empty() {
                rollback_reason.clone()
            } else {
                format!("{}. Rollback errors: {}", rollback_reason, rollback_errors.join("; "))
            };
            if let Err(err) = api
                .finalize_provisioning_failure(pid, finalize_reason.as_str())
                .await
            {
                finalize_error = Some(err);
            }
        }
        if let Some(err) = finalize_error {
            if rollback_errors.is_empty() {
                return Err(format!(
                    "{}. Finalize failure xatosi: {}",
                    message, err
                ));
            }
            return Err(format!(
                "{}. Rollback errors: {}. Finalize failure xatosi: {}",
                message,
                rollback_errors.join("; "),
                err
            ));
        }
        if rollback_errors.is_empty() {
            return Err(message);
        }
        return Err(format!(
            "{}. Rollback errors: {}",
            message,
            rollback_errors.join("; ")
        ));
    }

    // Backend provisioning already handles server sync; skip legacy /api/students/sync call.

    Ok(RegisterResult {
        employee_no,
        provisioning_id,
        results,
    })
