// Reusable back button.
// Usage: put the #backButtonDiv markup on any page, set data-fallback on the
// button, and load this file with <script src="script/backButton.js" defer></script>

(() => {
    "use strict";

    function setupBackButton() {
        const button = document.getElementById("backButtonUniversal");

        if (!button) return;

        // Where to go when there is no previous page on this site
        // (e.g. the page was opened directly or in a new tab).
        const fallback = button.dataset.fallback || "index.html";

        button.addEventListener("click", () => {
            let cameFromThisSite = false;

            try {
                cameFromThisSite =
                    document.referrer !== "" &&
                    new URL(document.referrer).origin === location.origin;
            } catch {}

            if (cameFromThisSite && history.length > 1) {
                history.back();
            } else {
                location.href = fallback;
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupBackButton);
    } else {
        setupBackButton();
    }
})();