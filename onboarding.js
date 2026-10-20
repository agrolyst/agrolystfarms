import { supabase } from "./supabase/supabase-client.js";

const $ = (id) => document.getElementById(id);
const form = $("onboardingForm");
const steps = Array.from(document.querySelectorAll(".onboarding-step"));
const errorEl = $("onboardingError");
const VAPID_PUBLIC_KEY = "BF2PkVrCk_EShR7HUqc-9YRYI9StIBZf0lBGaysWmbB6-NUNV84jlu6vTCz40k4sA32Uk4Rs49mYF5H8QNIRJS0";
let stepIndex = 0;
let signedInUser = null;

function setError(message) {
  errorEl.textContent = message || "";
}
function updateProgress() {
  steps.forEach((step, index) => {
    step.setAttribute("aria-hidden", String(index !== stepIndex));
  });
  for (let i = 1; i <= 3; i++) {
    $("progress" + i).style.width = i <= stepIndex + 1 ? "100%" : "0";
  }
  $("stepCounter").textContent = "Step " + (stepIndex + 1) + " of 3";
  $("backStep").hidden = stepIndex === 0;
  $("nextStep").hidden = stepIndex === steps.length - 1;
  $("finishSetup").hidden = stepIndex !== steps.length - 1;
}
function transitionTo(nextIndex) {
  if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === stepIndex) return;
  const current = steps[stepIndex];
  const next = steps[nextIndex];
  current.classList.remove("is-active");
  current.classList.add("is-leaving");
  next.classList.add("is-entering");
  next.hidden = false;
  stepIndex = nextIndex;
  updateProgress();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      next.classList.remove("is-entering");
      next.classList.add("is-active");
    });
  });
  window.setTimeout(() => {
    current.classList.remove("is-leaving");
  }, 430);
  setError("");
  const heading = next.querySelector("h2");
  if (heading) heading.focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
function validateCurrentStep() {
  const active = steps[stepIndex];
  const controls = Array.from(active.querySelectorAll("input, select, textarea")).filter(el =>
    !el.disabled && el.type !== "checkbox" && !el.readOnly
  );
  for (const control of controls) {
    if (!control.checkValidity()) {
      control.reportValidity();
      control.focus();
      return false;
    }
  }
  return true;
}
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
async function enablePushNotifications(permissionPromise) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser does not support background web push notifications. Your profile will still be saved.");
  }
  const permission = permissionPromise ? await permissionPromise : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications were not enabled in your browser. Your profile is saved; you can allow alerts later in browser settings.");
  }
  const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }
  const saved = await supabase.from("push_subscriptions").upsert({
    user_id: signedInUser.id,
    endpoint: subscription.endpoint,
    subscription: subscription.toJSON(),
    user_agent: navigator.userAgent,
    is_active: true
  }, { onConflict: "endpoint" });
  if (saved.error) throw new Error("Browser permission was granted, but the notification subscription could not be saved. " + saved.error.message);
  const profileSaved = await supabase.from("profiles").update({ push_notifications_enabled: true }).eq("id", signedInUser.id);
  if (profileSaved.error) throw new Error("Your profile is saved, but notification preferences could not be stored. " + profileSaved.error.message);
}
async function loadProfile() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    location.replace("login.html?next=onboarding");
    return;
  }
  signedInUser = data.user;
  $("onboardingEmail").textContent = data.user.email || "Signed-in customer";
  $("profileEmail").value = data.user.email || "";
  const { data: profile } = await supabase.from("profiles")
    .select("full_name,phone,customer_type,business_name,farm_type,farm_scale,interests,address_line,city,state,country,marketing_opt_in")
    .eq("id", data.user.id).maybeSingle();
  if (profile) {
    $("profileFullName").value = profile.full_name || data.user.user_metadata?.full_name || "";
    $("profilePhone").value = profile.phone || "";
    $("customerType").value = profile.customer_type || "";
    $("businessName").value = profile.business_name || "";
    $("farmType").value = profile.farm_type || "";
    $("farmScale").value = profile.farm_scale || "";
    $("addressLine").value = profile.address_line || "";
    $("city").value = profile.city || "";
    $("state").value = profile.state || "";
    $("country").value = profile.country || "Nigeria";
    $("marketingConsent").checked = Boolean(profile.marketing_opt_in);
    const interests = new Set(profile.interests || []);
    form.querySelectorAll('input[name="interest"]').forEach(input => { input.checked = interests.has(input.value); });
  } else {
    $("profileFullName").value = data.user.user_metadata?.full_name || data.user.user_metadata?.name || "";
  }
  updateProgress();
}
$("nextStep").addEventListener("click", () => {
  if (!validateCurrentStep()) return;
  transitionTo(stepIndex + 1);
});
$("backStep").addEventListener("click", () => transitionTo(stepIndex - 1));
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (stepIndex !== steps.length - 1) {
    if (validateCurrentStep()) transitionTo(stepIndex + 1);
    return;
  }
  if (!validateCurrentStep()) return;
  const finish = $("finishSetup");
  finish.disabled = true;
  finish.textContent = "Saving your details…";
  setError("");
  // Ask for browser permission synchronously inside the user's submit gesture;
  // waiting for the profile save first can cause browsers to reject the prompt.
  let notificationPermissionPromise = null;
  if ($("pushConsent").checked && "Notification" in window &&
      "serviceWorker" in navigator && "PushManager" in window) {
    try { notificationPermissionPromise = Notification.requestPermission(); }
    catch (permissionError) { console.warn("Notification permission request was blocked.", permissionError); }
  }
  const interests = Array.from(form.querySelectorAll('input[name="interest"]:checked')).map(input => input.value);
  const profile = {
    id: signedInUser.id,
    full_name: $("profileFullName").value.trim(),
    phone: $("profilePhone").value.trim(),
    customer_type: $("customerType").value,
    business_name: $("businessName").value.trim() || null,
    farm_type: $("farmType").value,
    farm_scale: $("farmScale").value || null,
    interests,
    address_line: $("addressLine").value.trim(),
    city: $("city").value.trim(),
    state: $("state").value.trim(),
    country: $("country").value.trim() || "Nigeria",
    onboarding_completed: true,
    marketing_opt_in: $("marketingConsent").checked,
    push_notifications_enabled: false
  };
  const { error } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });
  if (error) {
    setError("We couldn't save your profile yet. " + error.message);
    finish.disabled = false;
    finish.innerHTML = 'Finish setup <i data-lucide="check" aria-hidden="true"></i>';
    window.lucide?.createIcons?.();
    return;
  }
  let notificationMessage = "";
  if ($("pushConsent").checked) {
    try {
      await enablePushNotifications(notificationPermissionPromise);
      notificationMessage = " Order and service notifications are enabled on this browser.";
    } catch (pushError) {
      notificationMessage = " " + (pushError?.message || "Notifications were not enabled.") + " You can still continue to your account.";
      console.warn("Agrolyst push notification setup:", pushError);
    }
  }
  $("onboardingFormView").hidden = true;
  $("onboardingComplete").classList.add("is-visible");
  $("completionMessage").textContent = "Thank you, " + profile.full_name + ". Your profile has been saved securely to your Agrolyst account." + notificationMessage;
  if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
});
loadProfile().catch(error => {
  setError("We couldn't load your account details. Please refresh or sign in again. " + (error?.message || ""));
});
