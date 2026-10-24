// OneSpace Production Configuration
(function () {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  // Default Render production backend URL:
  const DEFAULT_PROD_API_URL = "https://one-minorproject.onrender.com";

  // Check if a custom backend URL was set in localStorage
  const userOverrideUrl = window.localStorage.getItem("onespace_api_base_url");

  window.OneSpaceConfig = {
    // If local, connect to localhost:8000; otherwise use user override or production Render URL
    API_BASE_URL: userOverrideUrl || (isLocal ? "http://localhost:8000" : DEFAULT_PROD_API_URL),
    USE_MOCK_DATA: false
  };

  // Helper method: call window.setBackendUrl("https://your-service.onrender.com") from browser console to point to any backend
  window.setBackendUrl = function (url) {
    if (!url) {
      window.localStorage.removeItem("onespace_api_base_url");
      console.log("Reset backend URL to default:", window.OneSpaceConfig.API_BASE_URL);
    } else {
      const clean = url.trim().replace(/\/+$/, "");
      window.localStorage.setItem("onespace_api_base_url", clean);
      console.log("Backend URL updated to:", clean);
    }
    window.location.reload();
  };
})();
