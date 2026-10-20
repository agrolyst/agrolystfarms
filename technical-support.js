(() => {
"use strict";
const root=document.querySelector("[data-support-page]");
if(!root)return;
const form=root.querySelector("#supportRequestForm");
if(!form)return;
form.addEventListener("submit",event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const value=id=>(form.querySelector("#"+id)?.value||"").trim();
  const message=[
    "Technical support enquiry for Rokib Yusuf (Don Martial)","",
    "Name: "+value("supportName"),
    "Email: "+value("supportEmail"),
    "Project / website: "+value("supportProject"),
    "Website / repository link: "+(value("supportLink")||"Not provided"),
    "Support topic: "+value("supportTopic"),
    "Device / browser: "+(value("supportDevice")||"Not provided"),
    "Preferred contact: "+value("supportContact"),"",
    "Issue / request:",value("supportDescription"),"",
    "I have not included passwords, one-time codes, private keys, access tokens or sensitive payment information."
  ].join("\n");
  const status=root.querySelector("#supportFormStatus");
  if(status)status.textContent="WhatsApp is opening with your draft. Review the details before sending.";
  window.open("https://wa.me/2347067579596?text="+encodeURIComponent(message),"_blank","noopener,noreferrer");
});
})();