#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::api::process::Command as TauriCommand;

fn resolve_server_entry(app: &tauri::AppHandle) -> Option<PathBuf> {
  let resource_dir = app.path_resolver().resource_dir();
  if let Some(dir) = resource_dir {
    let candidate = dir.join("server").join("dist").join("index.js");
    if candidate.exists() {
      return Some(candidate);
    }
  }

  let cwd = std::env::current_dir().ok()?;
  let candidates = [
    cwd.join("server").join("dist").join("index.js"),
    cwd.join("../server").join("dist").join("index.js"),
  ];
  candidates.into_iter().find(|path| path.exists())
}

fn spawn_server(app: &tauri::AppHandle) {
  if let Ok(mut sidecar) = TauriCommand::new_sidecar("student-registrator-server") {
    let _ = sidecar.spawn();
    return;
  }

  let entry = match resolve_server_entry(app) {
    Some(path) => path,
    None => {
      eprintln!("Student Registrator: server entry not found.");
      return;
    }
  };

  let mut cmd = Command::new("node");
  cmd.arg(entry)
    .env("NODE_ENV", "production")
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  if let Err(err) = cmd.spawn() {
    eprintln!("Student Registrator: failed to start server: {err}");
  }
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      spawn_server(&app.app_handle());
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
