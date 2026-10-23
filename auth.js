// Supabase project configuration (publishable/anon key is intended for browser use).
const SUPABASE_URL = "https://rcrgooivgssuerrgnuqw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const form = document.getElementById("authForm");
const statusEl = document.getElementById("status");
async function routeSignedInUser(user) {
  if (!user || !user.id) {
    location.replace("/onboarding/");
    return;
  }
  try {
    const { data: profile, error } = await client.from("profiles")
      .select("onboarding_completed").eq("id", user.id).maybeSingle();
    if (error) throw error;
    location.replace(profile && profile.onboarding_completed ? "/" : "/onboarding/");
  } catch (error) {
    console.warn("Unable to read onboarding state; sending customer to profile setup.", error);
    location.replace("/onboarding/");
  }
}
// Existing authenticated visitors go to profile setup only if it is incomplete.
(async () => {
  const { data, error } = await client.auth.getSession();
  if (!error && data.session) await routeSignedInUser(data.session.user);
})();
let mode = location.pathname.toLowerCase().replace(/\/+$/, "").endsWith("/signup") || location.hash === "#signup" ? "signup" : "signin";
function setStatus(message, error = true) { statusEl.textContent = message; statusEl.style.color = error ? "#9b3c23" : "#176d37"; }
function renderMode() {
  const signup = mode === "signup";
  document.getElementById("heading").textContent = signup ? "Create your account" : "Welcome back";
  document.getElementById("subheading").textContent = signup ? "Join the Agrolyst Farms community." : "Sign in to your Agrolyst account.";
  document.getElementById("nameWrap").hidden = !signup;
  document.getElementById("fullName").required = signup;
  document.getElementById("submitBtn").textContent = signup ? "Create account" : "Sign in";
  document.getElementById("switchText").innerHTML = signup ? 'Already registered? <a href="/login/" id="switchMode">Sign in</a>' : 'New to Agrolyst? <a href="/signup/" id="switchMode">Create an account</a>';
  document.getElementById("switchMode").addEventListener("click", e => {
    e.preventDefault();
    location.href = signup ? "/login/" : "/signup/";
  });
}
renderMode();
form.addEventListener("submit", async e => {
  e.preventDefault(); setStatus("Please wait…", false);
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    if (mode === "signup") {
      const fullName = document.getElementById("fullName").value.trim();
      const { data, error } = await client.auth.signUp({email, password, options:{data:{full_name:fullName}, emailRedirectTo:"https://agrolystfarms.com/callback/"}});
      if (error) throw error;
      if (data.session && data.user) {
        setStatus("Account created. Let's finish your profile…", false);
        await routeSignedInUser(data.user);
      } else {
        setStatus("Account created. Check your email to confirm it. After confirming, we’ll guide you through your profile setup.", false);
      }
    } else {
      const { data, error } = await client.auth.signInWithPassword({email, password});
      if (error) throw error;
      setStatus("Signed in. Checking your profile…", false);
      await routeSignedInUser(data.user);
    }
  } catch (error) { setStatus(error.message || "Authentication failed."); }
});
// Google Identity Services uses its official popup UX; the returned ID token is exchanged with Supabase.
const googleClientId = "482368984987-l7qacfrv7vc1q76objbqe1p44qe1r3lf.apps.googleusercontent.com";
const googleButtonHost = document.getElementById("googleBtn");
if (googleButtonHost) {
  if (window.google?.accounts?.id) {
    initialiseGooglePopup();
  } else {
    window.addEventListener("load", initialiseGooglePopup, { once: true });
  }
}
async function createGooglePopupNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  const hashedNonce = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  return { nonce, hashedNonce };
}
async function initialiseGooglePopup() {
  if (!googleButtonHost || !window.google?.accounts?.id) {
    setStatus("Google sign-in could not load. Please refresh the page or use email and password.");
    return;
  }
  if (!window.isSecureContext || !window.crypto?.subtle) {
    setStatus("Secure Google sign-in is unavailable in this browser. Please use email and password or try a supported browser.");
    return;
  }
  try {
    const { nonce, hashedNonce } = await createGooglePopupNonce();
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      nonce: hashedNonce,
      ux_mode: "popup",
      auto_select: false,
      use_fedcm_for_button: true,
      button_auto_select: false,
      cancel_on_tap_outside: true,
      callback: async response => {
        if (!response || !response.credential) {
          setStatus("Google did not return a sign-in credential. Please try again.");
          return;
        }
        setStatus("Verifying your Google account…", false);
        try {
          const { data, error } = await client.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            nonce
          });
          if (error) throw error;
          setStatus("Signed in. Checking your profile…", false);
          await routeSignedInUser(data.user);
        } catch (error) {
          setStatus(error.message || "Google sign-in failed.");
        }
      }
    });
    googleButtonHost.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonHost, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: Math.min(380, Math.max(240, googleButtonHost.clientWidth || 320)),
      logo_alignment: "left"
    });
  } catch (error) {
    console.error("Could not initialise secure Google popup sign-in.", error);
    setStatus("Google sign-in could not be initialised. Please refresh the page and try again.");
  }
}
document.getElementById("resetLink").addEventListener("click", async e => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  if (!email) { setStatus("Enter your email address first, then choose Forgot password."); return; }
  const { error } = await client.auth.resetPasswordForEmail(email, {redirectTo:"https://agrolystfarms.com/callback/"});
  setStatus(error ? error.message : "If that email is registered, a password reset link will arrive shortly.", Boolean(error));
});
