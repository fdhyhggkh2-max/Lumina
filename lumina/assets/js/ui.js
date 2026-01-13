// ===== UI UTILITIES START =====
(function () {
  let toastHost = null;

  function ensureToastHost() {
    if (toastHost) return toastHost;
    toastHost = document.createElement("div");
    toastHost.id = "toast-host";
    document.body.appendChild(toastHost);
    return toastHost;
  }

  function toast(msg, type = "info", ms = 2400) {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
    }, ms);
  }

  // PWA install prompt (manual)
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.__pwaCanInstall = true;
    window.UI.toast("✨ App can be installed (Profile → Install)", "success", 2600);
  });

  async function promptInstall() {
    if (!deferredPrompt) {
      toast("Install not available yet (try Safari Add to Home Screen).", "warn", 2800);
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    window.__pwaCanInstall = false;
    toast(choice.outcome === "accepted" ? "✅ Installed!" : "❌ Install dismissed", "info", 2400);
  }

  window.UI = { toast, promptInstall };
})();
// ===== UI UTILITIES END =====
