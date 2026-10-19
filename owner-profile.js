import { supabase } from "./supabase/supabase-client.js";

const setText = (id, value) => {
  const node = document.getElementById(id);
  if (node && typeof value === "string") node.textContent = value;
};
function safeImageUrl(value) {
  if (typeof value !== "string" || value.length > 2000) return "";
  try { const url = new URL(value, location.origin); return url.protocol === "https:" ? url.href : ""; }
  catch { return ""; }
}
(async function loadOwnerProfile() {
  if (!document.querySelector("[data-owner-profile]")) return;
  try {
    const result = await supabase.from("store_settings").select("value").eq("key", "owner_profile").maybeSingle();
    if (result.error) throw result.error;
    const profile = result.data && result.data.value ? result.data.value : {};
    const hasProfile = Boolean(profile.display_name || profile.biography || profile.portrait_url);
    if (!hasProfile) return;
    if (profile.display_name) setText("ownerName", profile.display_name);
    if (profile.role_title) setText("ownerRole", profile.role_title);
    if (profile.biography) setText("ownerBio", profile.biography);
    if (profile.quote) setText("ownerQuote", profile.quote);
    if (profile.image_alt) setText("ownerImageCaption", profile.image_alt);
    const image = document.getElementById("ownerPortrait");
    const url = safeImageUrl(profile.portrait_url);
    if (image && url) {
      image.src = url;
      image.alt = profile.image_alt || (profile.display_name ? "Portrait of " + profile.display_name + ", Agrolyst leadership" : "Agrolyst leadership portrait");
    }
    const note = document.getElementById("ownerDetailsNote");
    if (note) note.hidden = Boolean(profile.display_name && profile.biography && profile.portrait_url);
  } catch (error) {
    console.info("Optional owner profile is not configured yet.", error);
  }
})();
