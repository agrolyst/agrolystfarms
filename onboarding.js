import { supabase } from "/supabase/supabase-client.js";

const $ = (id) => document.getElementById(id);
const form = $("onboardingForm");
const screens = Array.from(document.querySelectorAll(".onboarding-screen"));
const errorEl = $("onboardingError");
const nextButton = $("nextStep");
const finishButton = $("finishSetup");
const progressBar = $("progressBar");
const VAPID_PUBLIC_KEY = "BF2PkVrCk_EShR7HUqc-9YRYI9StIBZf0lBGaysWmbB6-NUNV84jlu6vTCz40k4sA32Uk4Rs49mYF5H8QNIRJS0";
const copy = [
  { number: "01", title: "Let’s start with you", description: "Share your basic details so we can recognise you and stay in touch." },
  { number: "02", title: "Tell us about your work", description: "Choose the areas where Agrolyst can be most useful to you." },
  { number: "03", title: "Almost there", description: "Add your general location and decide which updates you would like to receive." }
];
let stepIndex = 0;
let user = null;
let switching = false;

function setError(message) { errorEl.textContent = message || ""; }
function refreshProgress() {
  $("progressFill").style.width = ((stepIndex + 1) / screens.length * 100) + "%";
  progressBar.setAttribute("aria-valuenow", String(stepIndex + 1));
  $("stepNumber").textContent = copy[stepIndex].number;
  $("stepTitle").textContent = copy[stepIndex].title;
  $("stepDescription").textContent = copy[stepIndex].description;
  nextButton.hidden = stepIndex === screens.length - 1;
  finishButton.hidden = stepIndex !== screens.length - 1;
  $("saveHint").textContent = stepIndex === screens.length - 1 ? "Ready when you are." : "Step " + (stepIndex + 1) + " of " + screens.length;
}
function validateCurrent() {
  for (const field of screens[stepIndex].querySelectorAll("input,select,textarea")) {
    if (field.disabled || field.readOnly || field.type === "checkbox" || field.type === "hidden") continue;
    if (!field.checkValidity()) {
      field.reportValidity();
      field.focus();
      return false;
    }
  }
  return true;
}
function advance() {
  if (switching || stepIndex >= screens.length - 1 || !validateCurrent()) return;
  switching = true;
  setError("");
  const current = screens[stepIndex];
  const next = screens[stepIndex + 1];

  // The current screen exits upward; the next screen rises from below.
  current.classList.remove("is-current");
  current.classList.add("is-leaving");
  current.setAttribute("aria-hidden", "true");
  next.style.display = "block";
  next.classList.add("is-entering");
  next.setAttribute("aria-hidden", "false");

  stepIndex += 1;
  refreshProgress();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    next.classList.remove("is-entering");
    next.classList.add("is-current");
    window.setTimeout(() => {
      current.classList.remove("is-leaving");
      current.style.display = "none";
      switching = false;
      const firstField = next.querySelector("input:not([readonly]),select,textarea");
      if (firstField) firstField.focus({ preventScroll: true });
      if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }, 480);
  }));
}
function base64UrlBytes(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
async function subscribeToPush(permissionPromise) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser does not support background web push. Your profile was saved successfully.");
  }
  const permission = permissionPromise ? await permissionPromise : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Browser notifications were not allowed. Your profile was saved; you can enable alerts later in account settings.");
  }
  const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlBytes(VAPID_PUBLIC_KEY)
    });
  }
  const { error: subscriptionError } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    subscription: subscription.toJSON(),
    user_agent: navigator.userAgent,
    is_active: true
  }, { onConflict: "endpoint" });
  if (subscriptionError) throw new Error("Browser permission was granted, but the notification subscription could not be saved. " + subscriptionError.message);

  const { error: preferenceError } = await supabase.from("profiles")
    .update({ push_notifications_enabled: true }).eq("id", user.id);
  if (preferenceError) throw new Error("Your profile was saved, but the notification preference could not be saved. " + preferenceError.message);
}
async function loadProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    location.replace("/login.html?next=onboarding");
    return;
  }
  user = data.user;
  $("profileEmail").value = user.email || "";

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("full_name,phone,customer_type,business_name,farm_type,farm_scale,interests,address_line,city,state,country,marketing_opt_in")
    .eq("id", user.id).maybeSingle();
  if (profileError) {
    setError("We couldn’t load your saved details. Please refresh the page. " + profileError.message);
    return;
  }

  $("profileFullName").value = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "";
  $("profilePhone").value = profile?.phone || "";
  $("customerType").value = profile?.customer_type || "";
  $("businessName").value = profile?.business_name || "";
  $("farmType").value = profile?.farm_type || "";
  $("farmScale").value = profile?.farm_scale || "";
  $("addressLine").value = profile?.address_line || "";
  $("city").value = profile?.city || "";
  $("state").value = profile?.state || "";
  $("country").value = profile?.country || "Nigeria";
  $("marketingConsent").checked = Boolean(profile?.marketing_opt_in);
  const selected = new Set(profile?.interests || []);
  form.querySelectorAll('input[name="interest"]').forEach(input => { input.checked = selected.has(input.value); });
  refreshProgress();
}

nextButton.addEventListener("click", advance);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (stepIndex !== screens.length - 1) { advance(); return; }
  if (switching || !validateCurrent() || !user) return;

  // The permission request starts from the user's explicit Finish click.
  let permissionPromise = null;
  if ($("pushConsent").checked && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
    try {
      permissionPromise = Notification.permission === "granted"
        ? Promise.resolve("granted")
        : Notification.requestPermission();
    } catch (error) { console.warn("Push permission prompt could not open.", error); }
  }

  switching = true;
  finishButton.disabled = true;
  finishButton.textContent = "Saving your profile…";
  setError("");

  const values = {
    id: user.id,
    full_name: $("profileFullName").value.trim(),
    phone: $("profilePhone").value.trim(),
    customer_type: $("customerType").value,
    business_name: $("businessName").value.trim() || null,
    farm_type: $("farmType").value,
    farm_scale: $("farmScale").value || null,
    interests: Array.from(form.querySelectorAll('input[name="interest"]:checked')).map(input => input.value),
    address_line: $("addressLine").value.trim(),
    city: $("city").value.trim(),
    state: $("state").value.trim(),
    country: $("country").value.trim() || "Nigeria",
    onboarding_completed: true,
    marketing_opt_in: $("marketingConsent").checked,
    push_notifications_enabled: false
  };

  const { error } = await supabase.from("profiles").upsert(values, { onConflict: "id" });
  if (error) {
    setError("We couldn’t save your profile. Please check the details and try again. " + error.message);
    switching = false;
    finishButton.disabled = false;
    finishButton.innerHTML = 'Finish <i data-lucide="check" aria-hidden="true"></i>';
    window.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
    return;
  }

  let notificationMessage = "";
  if ($("pushConsent").checked) {
    try {
      await subscribeToPush(permissionPromise);
      notificationMessage = " Browser notifications are enabled on this device.";
    } catch (pushError) {
      notificationMessage = " " + (pushError?.message || "Browser notifications were not enabled.") + " You can manage this later in account settings.";
      console.warn("Agrolyst push setup:", pushError);
    }
  }

  $("onboarding-form-view").hidden = true;
  $("onboardingComplete").hidden = false;
  $("completionMessage").textContent = "Thanks, " + values.full_name + ". Your profile has been saved." + notificationMessage;
  $("onboardingComplete").classList.add("is-visible");
  switching = false;
  if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
});
loadProfile().catch(error => setError("We couldn’t load your account details. Please refresh and try again. " + (error?.message || "")));
