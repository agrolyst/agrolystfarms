// Supabase project configuration (publishable/anon key is intended for browser use).
const SUPABASE_URL = "https://rcrgooivgssuerrgnuqw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const form = document.getElementById("authForm");
const statusEl = document.getElementById("status");
const modeLink = document.getElementById("switchMode");
let mode = location.hash === "#signup" ? "signup" : "signin";
function setStatus(message, error = true) { statusEl.textContent = message; statusEl.style.color = error ? "#9b3c23" : "#176d37"; }
function renderMode() {
  const signup = mode === "signup";
  document.getElementById("heading").textContent = signup ? "Create your account" : "Welcome back";
  document.getElementById("subheading").textContent = signup ? "Join the Agrolyst Farms community." : "Sign in to your Agrolyst account.";
  document.getElementById("nameWrap").hidden = !signup;
  document.getElementById("fullName").required = signup;
  document.getElementById("submitBtn").textContent = signup ? "Create account" : "Sign in";
  document.getElementById("switchText").innerHTML = signup ? 'Already registered? <a href="#signin" id="switchMode">Sign in</a>' : 'New to Agrolyst? <a href="#signup" id="switchMode">Create an account</a>';
  document.getElementById("switchMode").addEventListener("click", e => { e.preventDefault(); mode = signup ? "signin" : "signup"; history.replaceState(null, "", mode === "signup" ? "#signup" : "#signin"); setStatus(""); renderMode(); });
}
renderMode();
form.addEventListener("submit", async e => {
  e.preventDefault(); setStatus("Please wait…", false);
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    if (mode === "signup") {
      const fullName = document.getElementById("fullName").value.trim();
      const { data, error } = await client.auth.signUp({email, password, options:{data:{full_name:fullName}, emailRedirectTo:location.origin + "/auth.html"}});
      if (error) throw error;
      setStatus(data.session ? "Account created. You are signed in." : "Account created. Check your email to confirm it.", false);
    } else {
      const { error } = await client.auth.signInWithPassword({email, password});
      if (error) throw error;
      setStatus("Signed in successfully. Redirecting…", false);
      location.href = "index.html";
    }
  } catch (error) { setStatus(error.message || "Authentication failed."); }
});
document.getElementById("googleBtn").addEventListener("click", async () => {
  setStatus("Connecting to Google…", false);
  const { error } = await client.auth.signInWithOAuth({provider:"google", options:{redirectTo:location.origin + "/auth.html", queryParams:{prompt:"select_account"}}});
  if (error) setStatus(error.message || "Google sign-in failed.");
});
document.getElementById("resetLink").addEventListener("click", async e => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  if (!email) { setStatus("Enter your email address first, then choose Forgot password."); return; }
  const { error } = await client.auth.resetPasswordForEmail(email, {redirectTo:location.origin + "/auth.html"});
  setStatus(error ? error.message : "If that email is registered, a password reset link will arrive shortly.", Boolean(error));
});
