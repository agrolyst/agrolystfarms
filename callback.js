// Supabase authentication callback for Agrolyst Farms.
const SUPABASE_URL = "https://rcrgooivgssuerrgnuqw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const heading = document.getElementById("heading");
const message = document.getElementById("message");
const status = document.getElementById("status");
const spinner = document.getElementById("spinner");
const continueLink = document.getElementById("continueLink");
function showError(text) {
  heading.textContent = "Sign-in could not be completed";
  message.textContent = "Please return to sign in and try again.";
  status.textContent = text || "The sign-in link may have expired or is invalid.";
  status.style.color = "#9b3c23";
  spinner.hidden = true;
  continueLink.hidden = false;
  continueLink.href = "auth.html";
  continueLink.textContent = "Back to sign in";
}
(async function completeAuth() {
  try {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const authError = params.get("error_description") || params.get("error") || hash.get("error_description") || hash.get("error");
    if (authError) throw new Error(authError);
    // PKCE OAuth / email confirmation links may include a one-time code.
    const code = params.get("code");
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (hash.get("access_token") && hash.get("refresh_token")) {
      const { error } = await client.auth.setSession({
        access_token: hash.get("access_token"),
        refresh_token: hash.get("refresh_token")
      });
      if (error) throw error;
    } else if (hash.get("error")) {
      throw new Error(hash.get("error_description") || hash.get("error"));
    }
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      throw new Error("No active session was returned. The link may have expired; please sign in again.");
    }
    // Keep the URL clean so one-time auth codes are not left in the address bar.
    history.replaceState({}, document.title, location.pathname);
    heading.textContent = "You're signed in";
    message.textContent = "Your Agrolyst Farms account has been verified successfully.";
    status.textContent = "Taking you to the website…";
    status.style.color = "#176d37";
    spinner.hidden = true;
    continueLink.hidden = false;
    continueLink.href = "index.html";
    continueLink.textContent = "Continue to Agrolyst Farms";
    window.setTimeout(() => { location.replace("index.html"); }, 1200);
  } catch (error) {
    showError(error && error.message ? error.message : "Authentication failed. Please try again.");
  }
})();