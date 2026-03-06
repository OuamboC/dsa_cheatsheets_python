/**
 * Authentication Module for DSA Playground
 * Supports: Google, GitHub via Supabase Auth
 * Uses Supabase for auth + progress tracking + daily streaks
 */

// Initialize Supabase - use supabaseClient to avoid conflict with SDK's global 'supabase'
let supabaseClient = null;
let currentUser = null;
let supabaseInitialized = false;

// Create Supabase client immediately when config is available
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (
    !window.supabaseConfig ||
    window.supabaseConfig.url === "YOUR_SUPABASE_URL"
  ) {
    return null;
  }

  if (typeof window.supabase === "undefined") {
    return null;
  }

  try {
    supabaseClient = window.supabase.createClient(
      window.supabaseConfig.url,
      window.supabaseConfig.anonKey,
    );
    supabaseClient.auth.onAuthStateChange(handleAuthStateChanged);
    return supabaseClient;
  } catch (e) {
    console.error("Failed to create Supabase client:", e);
    return null;
  }
}

function initSupabase() {
  console.log("Initializing Supabase...");

  if (supabaseInitialized && supabaseClient) {
    console.log("Supabase already initialized");
    return true;
  }

  if (
    !window.supabaseConfig ||
    window.supabaseConfig.url === "YOUR_SUPABASE_URL"
  ) {
    console.warn(
      "Supabase not configured. Progress will only be saved locally.",
    );
    return false;
  }

  // Check if Supabase SDK is loaded
  if (typeof window.supabase === "undefined") {
    console.error("Supabase SDK not loaded!");
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(
      window.supabaseConfig.url,
      window.supabaseConfig.anonKey,
    );

    console.log("Supabase client created successfully");
    supabaseInitialized = true;

    // Listen for auth state changes
    supabaseClient.auth.onAuthStateChange(handleAuthStateChanged);

    // Check initial session
    checkSession();
    return true;
  } catch (e) {
    console.error("Supabase init error:", e);
    return false;
  }
}

// Check for existing session
async function checkSession() {
  if (!supabaseClient) {
    return;
  }

  try {
    console.log("Checking existing session...");
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (session) {
      console.log("Existing session found:", session.user.email);
      currentUser = session.user;
      updateAuthUI(currentUser);
      injectAuthHeader(currentUser); // Show floating header
      hideAuthGate(); // Remove gate if showing
      loadUserProgress();
    } else {
      console.log("No existing session");
    }
  } catch (e) {
    console.error("Session check error:", e);
  }
}

// Handle auth state changes
function handleAuthStateChanged(event, session) {
  console.log("Auth state changed:", event);

  if (event === "SIGNED_IN" && session) {
    currentUser = session.user;
    console.log("User signed in:", session.user.email);
    updateAuthUI(currentUser);
    injectAuthHeader(currentUser); // Show floating header
    loadUserProgress();
    hideAuthGate(); // Remove auth gate on sign-in

    // Check if there's a stored return URL to redirect to
    const storedReturn = sessionStorage.getItem("returnUrl");
    if (storedReturn) {
      let redirectTo = storedReturn;

      // Convert full URL to relative path if needed
      if (redirectTo.includes(window.location.origin)) {
        redirectTo = redirectTo.replace(window.location.origin, "");
      }
      if (redirectTo.startsWith("/")) {
        redirectTo = redirectTo.substring(1);
      }

      // Only redirect if we're not already on that page
      if (!window.location.href.includes(redirectTo.split("?")[0])) {
        console.log("Redirecting to stored URL:", redirectTo);
        sessionStorage.removeItem("returnUrl");
        window.location.href = redirectTo;
      } else {
        sessionStorage.removeItem("returnUrl");
      }
    }
  } else if (event === "SIGNED_OUT") {
    currentUser = null;
    updateAuthUI(null);
    injectAuthHeader(null); // Remove floating header
    // Redirect to login if on a protected page
    if (
      typeof requireAuth === "function" &&
      !window.location.pathname.includes("login") &&
      !window.location.pathname.includes("index")
    ) {
      showAuthGate();
    }
  }
}

// Update UI based on auth state
function updateAuthUI(user) {
  const authContainer = document.getElementById("auth-container");
  if (!authContainer) return;

  if (user) {
    const metadata = user.user_metadata || {};
    const avatar =
      metadata.avatar_url ||
      metadata.picture ||
      "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%228%22 r=%224%22 fill=%22%237c6af7%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%237c6af7%22/></svg>";
    const name =
      metadata.full_name ||
      metadata.name ||
      user.email?.split("@")[0] ||
      "User";

    authContainer.innerHTML = `
      <div class="user-info">
        <img class="user-avatar" src="${avatar}" alt="avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%228%22 r=%224%22 fill=%22%237c6af7%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%237c6af7%22/></svg>'">
        <span class="user-name">${name}</span>
        <a href="logout.html" class="btn-logout">Sign Out</a>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <a href="login.html" class="btn-login">Sign In</a>
    `;
  }
}

// Sign in with Google
async function signInWithGoogle() {
  console.log("signInWithGoogle called");

  // Store current page to return to after auth (if not on login page)
  const currentPage = window.location.pathname;
  if (!currentPage.includes("login")) {
    sessionStorage.setItem("returnUrl", window.location.href);
  }

  // Try to initialize if not already
  if (!supabaseClient) {
    initSupabase();
  }

  if (!supabaseClient) {
    console.error("Supabase is not initialized");
    const errorEl = document.getElementById("auth-error");
    if (errorEl) {
      errorEl.textContent =
        "Authentication service not available. Please refresh the page.";
      errorEl.style.display = "block";
    } else {
      alert("Authentication service not available. Please refresh the page.");
    }
    return;
  }

  showLoading(true);

  try {
    console.log("Calling signInWithOAuth for Google...");
    // Redirect to login.html to handle the OAuth callback
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/login.html",
      },
    });

    console.log("OAuth response:", { data, error });
    if (error) throw error;
  } catch (error) {
    handleAuthError(error);
    showLoading(false);
  }
}

// Sign in with GitHub
async function signInWithGitHub() {
  console.log("signInWithGitHub called");

  // Store current page to return to after auth (if not on login page)
  const currentPage = window.location.pathname;
  if (!currentPage.includes("login")) {
    sessionStorage.setItem("returnUrl", window.location.href);
  }

  // Try to initialize if not already
  if (!supabaseClient) {
    initSupabase();
  }

  if (!supabaseClient) {
    console.error("Supabase is not initialized");
    const errorEl = document.getElementById("auth-error");
    if (errorEl) {
      errorEl.textContent =
        "Authentication service not available. Please refresh the page.";
      errorEl.style.display = "block";
    } else {
      alert("Authentication service not available. Please refresh the page.");
    }
    return;
  }

  showLoading(true);

  try {
    console.log("Calling signInWithOAuth for GitHub...");
    // Redirect to login.html to handle the OAuth callback
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/login.html",
      },
    });

    console.log("OAuth response:", { data, error });
    if (error) throw error;
  } catch (error) {
    handleAuthError(error);
    showLoading(false);
  }
}

// Show/hide loading state
function showLoading(show) {
  const loadingEl = document.getElementById("loading");
  const buttonsEl = document.getElementById("auth-buttons");

  if (loadingEl) loadingEl.style.display = show ? "flex" : "none";
  if (buttonsEl) buttonsEl.style.display = show ? "none" : "flex";
}

// Sign out
async function signOutUser() {
  if (!supabaseClient) return;

  try {
    await supabaseClient.auth.signOut();
    currentUser = null;
    updateAuthUI(null);
    localStorage.removeItem("dsa_last_sync");
    console.log("Signed out successfully");

    // Redirect to index if on a playground page
    if (window.location.pathname.includes("playground")) {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Sign out error:", error);
  }
}

// Handle auth errors
function handleAuthError(error) {
  console.error("Auth error:", error);

  let message = error.message || "Authentication failed. Please try again.";

  // Show error in UI if element exists
  const errorEl = document.getElementById("auth-error");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  } else {
    alert(message);
  }
}

// ========== PROGRESS TRACKING ==========

// Get progress key for current page
function getProgressKey() {
  const path = window.location.pathname;
  const filename = path
    .substring(path.lastIndexOf("/") + 1)
    .replace(".html", "");
  return `progress_${filename}`;
}

// Save progress locally
function saveProgressLocal(progress) {
  const key = getProgressKey();
  localStorage.setItem(key, JSON.stringify(progress));
}

// Load progress from local storage
function loadProgressLocal() {
  const key = getProgressKey();
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

// Save progress to Supabase
async function saveProgressCloud(progress) {
  if (!currentUser || !supabaseClient) return false;

  try {
    const key = getProgressKey();
    const { error } = await supabaseClient.from("user_progress").upsert(
      {
        user_id: currentUser.id,
        page_key: key,
        progress_data: progress,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,page_key",
      },
    );

    if (error) throw error;

    localStorage.setItem("dsa_last_sync", Date.now().toString());
    return true;
  } catch (error) {
    console.error("Error saving progress to cloud:", error);
    return false;
  }
}

// Load user progress from Supabase
async function loadUserProgress() {
  if (!currentUser || !supabaseClient) return null;

  try {
    const key = getProgressKey();
    const { data, error } = await supabaseClient
      .from("user_progress")
      .select("progress_data")
      .eq("user_id", currentUser.id)
      .eq("page_key", key)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    if (data && data.progress_data) {
      const cloudProgress = data.progress_data;
      const localProgress = loadProgressLocal();

      if (localProgress) {
        // Merge: keep higher progress
        const mergedSolved = [
          ...new Set([
            ...(localProgress.solved || []),
            ...(cloudProgress.solved || []),
          ]),
        ];

        const mergedProgress = {
          solved: mergedSolved,
          score: mergedSolved.length,
          lastUpdated: Date.now(),
        };

        applyProgressToUI(mergedProgress);
        saveProgressLocal(mergedProgress);
        saveProgressCloud(mergedProgress);

        return mergedProgress;
      } else {
        applyProgressToUI(cloudProgress);
        saveProgressLocal(cloudProgress);
        return cloudProgress;
      }
    }

    // No cloud progress - sync local up
    const localProgress = loadProgressLocal();
    if (localProgress) {
      await saveProgressCloud(localProgress);
    }

    return localProgress;
  } catch (error) {
    console.error("Error loading progress from cloud:", error);
    return loadProgressLocal();
  }
}

// Apply progress to UI (to be overridden by playground pages)
function applyProgressToUI(progress) {
  if (window.onProgressLoaded) {
    window.onProgressLoaded(progress);
  }
}

// Get all progress for dashboard
async function getAllProgress() {
  if (!currentUser || !supabaseClient) {
    // Return local progress
    const structures = [
      "dict_playground",
      "list_playground",
      "set_playground",
      "tuple_playground",
      "stack_and_queue_playground",
    ];
    const progress = {};

    structures.forEach((struct) => {
      const data = localStorage.getItem(`progress_${struct}`);
      if (data) {
        progress[struct] = JSON.parse(data);
      }
    });

    return progress;
  }

  try {
    const { data, error } = await supabaseClient
      .from("user_progress")
      .select("page_key, progress_data")
      .eq("user_id", currentUser.id);

    if (error) throw error;

    const progress = {};
    data.forEach((row) => {
      progress[row.page_key] = row.progress_data;
    });

    return progress;
  } catch (error) {
    console.error("Error getting all progress:", error);
    return {};
  }
}

// ========== DAILY STREAK TRACKING ==========

// Get today's date as a string (YYYY-MM-DD)
function getTodayString() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

// Get yesterday's date as a string (YYYY-MM-DD)
function getYesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

// Load streak data from local storage
function loadStreakLocal() {
  const data = localStorage.getItem("dsa_streak_data");
  return data
    ? JSON.parse(data)
    : { currentStreak: 0, lastPracticeDate: null, longestStreak: 0 };
}

// Save streak data to local storage
function saveStreakLocal(streakData) {
  localStorage.setItem("dsa_streak_data", JSON.stringify(streakData));
}

// Save streak to Supabase
async function saveStreakCloud(streakData) {
  if (!currentUser || !supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from("user_progress").upsert(
      {
        user_id: currentUser.id,
        playground_name: "daily_streak",
        completed_items: streakData,
        last_updated: new Date().toISOString(),
      },
      {
        onConflict: "user_id,playground_name",
      },
    );

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error saving streak to cloud:", error);
    return false;
  }
}

// Load streak from Supabase
async function loadStreakCloud() {
  if (!currentUser || !supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from("user_progress")
      .select("completed_items")
      .eq("user_id", currentUser.id)
      .eq("playground_name", "daily_streak")
      .single();

    if (error && error.code !== "PGRST116") throw error;

    return data ? data.completed_items : null;
  } catch (error) {
    console.error("Error loading streak from cloud:", error);
    return null;
  }
}

// Record practice for today (call this when user completes an exercise)
async function recordPractice() {
  const today = getTodayString();
  const yesterday = getYesterdayString();

  // Load current streak data
  let streakData = loadStreakLocal();
  const cloudStreak = await loadStreakCloud();

  // Merge with cloud data if available
  if (cloudStreak) {
    if (
      cloudStreak.currentStreak > streakData.currentStreak ||
      cloudStreak.longestStreak > streakData.longestStreak
    ) {
      streakData = {
        currentStreak: Math.max(
          streakData.currentStreak,
          cloudStreak.currentStreak,
        ),
        longestStreak: Math.max(
          streakData.longestStreak,
          cloudStreak.longestStreak,
        ),
        lastPracticeDate:
          cloudStreak.lastPracticeDate || streakData.lastPracticeDate,
      };
    }
  }

  // Already practiced today
  if (streakData.lastPracticeDate === today) {
    return streakData;
  }

  // Check if streak continues or resets
  if (streakData.lastPracticeDate === yesterday) {
    // Continuing streak
    streakData.currentStreak += 1;
  } else if (streakData.lastPracticeDate !== today) {
    // Streak broken - reset to 1
    streakData.currentStreak = 1;
  }

  // Update longest streak if current is higher
  if (streakData.currentStreak > streakData.longestStreak) {
    streakData.longestStreak = streakData.currentStreak;
  }

  // Update last practice date
  streakData.lastPracticeDate = today;

  // Save locally and to cloud
  saveStreakLocal(streakData);
  await saveStreakCloud(streakData);

  // Update UI if element exists
  updateStreakUI(streakData);

  console.log("Practice recorded! Current streak:", streakData.currentStreak);
  return streakData;
}

// Get current streak data
async function getStreakData() {
  let streakData = loadStreakLocal();
  const cloudStreak = await loadStreakCloud();

  // Merge with cloud data
  if (cloudStreak) {
    streakData = {
      currentStreak: Math.max(
        streakData.currentStreak,
        cloudStreak.currentStreak,
      ),
      longestStreak: Math.max(
        streakData.longestStreak,
        cloudStreak.longestStreak,
      ),
      lastPracticeDate:
        cloudStreak.lastPracticeDate || streakData.lastPracticeDate,
    };
    saveStreakLocal(streakData);
  }

  // Check if streak is still valid (practiced yesterday or today)
  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (
    streakData.lastPracticeDate !== today &&
    streakData.lastPracticeDate !== yesterday
  ) {
    // Streak has been broken
    streakData.currentStreak = 0;
    saveStreakLocal(streakData);
  }

  return streakData;
}

// Update streak display in UI
function updateStreakUI(streakData) {
  const streakElements = document.querySelectorAll(".daily-streak-count");
  streakElements.forEach((el) => {
    el.textContent = streakData.currentStreak;
  });

  const longestStreakElements = document.querySelectorAll(
    ".longest-streak-count",
  );
  longestStreakElements.forEach((el) => {
    el.textContent = streakData.longestStreak;
  });
}

// Check if user has practiced today
function hasPracticedToday() {
  const streakData = loadStreakLocal();
  return streakData.lastPracticeDate === getTodayString();
}

// ========== AUTH GATE FOR PLAYGROUNDS ==========

// Inject auth gate styles
function injectAuthGateStyles() {
  if (document.getElementById("auth-gate-styles")) return;

  const style = document.createElement("style");
  style.id = "auth-gate-styles";
  style.textContent = `
    .auth-gate-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(8, 8, 16, 0.98);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    }
    .auth-gate-content {
      text-align: center;
      max-width: 420px;
      padding: 3rem;
      background: linear-gradient(135deg, #13131f 0%, #1a1a2e 100%);
      border: 1px solid #2a2a4a;
      border-radius: 16px;
      box-shadow: 0 25px 80px rgba(0,0,0,0.5);
    }
    .auth-gate-icon {
      font-size: 4rem;
      margin-bottom: 1.5rem;
    }
    .auth-gate-title {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 0.75rem;
      background: linear-gradient(135deg, #f76a6a, #f7c46a);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .auth-gate-text {
      color: #8a8aaa;
      font-size: 1rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .auth-gate-btn {
      display: inline-block;
      padding: 1rem 2.5rem;
      background: linear-gradient(135deg, #7c6af7, #a78bfa);
      color: white;
      font-weight: 700;
      font-size: 1.1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .auth-gate-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(124, 106, 247, 0.4);
    }
    .auth-gate-features {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #2a2a4a;
    }
    .auth-gate-features p {
      color: #6a6a8a;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }
    .auth-gate-features ul {
      list-style: none;
      display: flex;
      justify-content: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .auth-gate-features li {
      color: #9a9aba;
      font-size: 0.8rem;
    }
    .auth-gate-features li::before {
      content: '✓ ';
      color: #6af76a;
    }
    .auth-floating-header {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(19, 19, 31, 0.95);
      border: 1px solid #2a2a4a;
      border-radius: 50px;
      padding: 0.5rem 1rem;
      backdrop-filter: blur(10px);
    }
    .auth-floating-header .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid #7c6af7;
    }
    .auth-floating-header .user-name {
      color: #e8e8f4;
      font-size: 0.85rem;
      font-weight: 600;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .auth-floating-header .btn-logout {
      background: transparent;
      border: 1px solid #f76a6a;
      color: #f76a6a;
      padding: 0.35rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .auth-floating-header .btn-logout:hover {
      background: #f76a6a;
      color: #0f0a0a;
    }
  `;
  document.head.appendChild(style);
}

// Inject floating auth header for playground pages
function injectAuthHeader(user) {
  // Inject styles first
  injectAuthGateStyles();

  // Remove existing header if any
  const existing = document.getElementById("auth-floating-header");
  if (existing) existing.remove();

  if (!user) return;

  const metadata = user.user_metadata || {};
  const avatar =
    metadata.avatar_url ||
    metadata.picture ||
    "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%228%22 r=%224%22 fill=%22%237c6af7%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%237c6af7%22/></svg>";
  const name =
    metadata.full_name || metadata.name || user.email?.split("@")[0] || "User";

  const header = document.createElement("div");
  header.className = "auth-floating-header";
  header.id = "auth-floating-header";
  header.innerHTML = `
    <img class="user-avatar" src="${avatar}" alt="avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><circle cx=%2212%22 cy=%228%22 r=%224%22 fill=%22%237c6af7%22/><path d=%22M4 20c0-4 4-6 8-6s8 2 8 6%22 fill=%22%237c6af7%22/></svg>'">
    <span class="user-name">${name}</span>
    <a href="logout.html" class="btn-logout">Log Out</a>
  `;
  document.body.appendChild(header);
}

// Show auth gate overlay
function showAuthGate() {
  injectAuthGateStyles();

  // Store current URL so we can return after login
  const returnUrl = encodeURIComponent(window.location.href);

  const overlay = document.createElement("div");
  overlay.className = "auth-gate-overlay";
  overlay.id = "auth-gate";
  overlay.innerHTML = `
    <div class="auth-gate-content">
      <div class="auth-gate-icon">🔐</div>
      <h2 class="auth-gate-title">Sign In Required</h2>
      <p class="auth-gate-text">
        Create a free account to access the playground exercises and track your progress.
      </p>
      <a href="login.html?return=${returnUrl}" class="auth-gate-btn">Sign In to Continue</a>
      <div class="auth-gate-features">
        <p>With an account you get:</p>
        <ul>
          <li>Daily streaks</li>
          <li>Progress tracking</li>
          <li>Cloud sync</li>
        </ul>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// Hide auth gate
function hideAuthGate() {
  const gate = document.getElementById("auth-gate");
  if (gate) gate.remove();
}

// Require authentication for playground pages
// DISABLED FOR NOW - just check auth and show header if logged in, don't block access
async function requireAuth() {
  console.log("requireAuth called (optional mode)");

  // Small delay to let Supabase SDK initialize
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Get or create Supabase client
  const client = getSupabaseClient();

  if (!client) {
    console.log("Supabase not available, continuing without auth");
    return;
  }

  try {
    const {
      data: { session },
    } = await client.auth.getSession();

    if (session && session.user) {
      console.log("User is authenticated:", session.user.email);
      currentUser = session.user;
      injectAuthHeader(currentUser);
    } else {
      console.log("Not logged in, but allowing access");
    }
  } catch (e) {
    console.error("Auth check error:", e);
  }

  // Don't show gate - let everyone use the playground
}

// ========== INITIALIZATION ==========

// Initialize auth on page load
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
});

// Export functions for global use
window.authModule = {
  signInWithGoogle,
  signInWithGitHub,
  signOutUser,
  saveProgressLocal,
  loadProgressLocal,
  saveProgressCloud,
  loadUserProgress,
  getAllProgress,
  getCurrentUser: () => currentUser,
  isAuthenticated: () => !!currentUser,
  // Async session check - returns promise with session
  getSessionAsync: async () => {
    if (!supabaseClient) return null;
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      if (session) {
        currentUser = session.user;
      }
      return session;
    } catch (e) {
      console.error("getSessionAsync error:", e);
      return null;
    }
  },
  // Streak functions
  recordPractice,
  getStreakData,
  hasPracticedToday,
};

// Make sign-in functions globally available
window.signInWithGoogle = signInWithGoogle;
window.signInWithGitHub = signInWithGitHub;
window.signOutUser = signOutUser;
window.recordPractice = recordPractice;
window.getStreakData = getStreakData;
window.requireAuth = requireAuth;
window.hideAuthGate = hideAuthGate;
