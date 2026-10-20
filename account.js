// Keep the homepage navigation in sync with the visitor's Supabase session.
const AGROLYST_SUPABASE_URL = "https://rcrgooivgssuerrgnuqw.supabase.co";
const AGROLYST_SUPABASE_KEY = "sb_publishable_j8SoLv73ssa13M_rAJwB6g_rPb8whHD";
(async function syncAccountNavigation() {
  const client = window.supabase.createClient(AGROLYST_SUPABASE_URL, AGROLYST_SUPABASE_KEY);
  const link = document.getElementById("accountNav");
  if (!link) return;
  async function render(session) {
    if (session) {
      const { data } = await client.auth.getUser();
      const name = data && data.user && (data.user.user_metadata?.full_name || data.user.user_metadata?.name);
      link.textContent = name ? "My Account" : "My Account";
      link.href = "/account/";
      link.setAttribute("aria-label", "Open your Agrolyst account");
    } else {
      link.textContent = "Sign in";
      link.href = "/login/";
      link.removeAttribute("aria-label");
    }
  }
  const { data } = await client.auth.getSession();
  await render(data.session);
  client.auth.onAuthStateChange((_event, session) => { void render(session); });
})();
