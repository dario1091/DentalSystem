fn main() {
    // Recompile when the injected Google OAuth credentials change so that
    // `option_env!` in the source picks up new values between CI builds.
    println!("cargo:rerun-if-env-changed=GOOGLE_OAUTH_CLIENT_ID");
    println!("cargo:rerun-if-env-changed=GOOGLE_OAUTH_CLIENT_SECRET");

    tauri_build::build()
}
