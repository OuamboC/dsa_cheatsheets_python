/**
 * Authentication Module for DSA Playground
 * Supports: Google, GitHub via Supabase Auth
 * Uses Supabase for auth + progress tracking + daily streaks
 */

// Initialize Supabase - use supabaseClient to avoid conflict with SDK's global 'supabase'
let supabaseClient = null;
let currentUser = null;
let supabaseInitialized = false;

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
  if (!supabaseClient) return;

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      updateAuthUI(currentUser);
      loadUserProgress();
    }
  } catch (e) {
    console.error("Session check error:", e);
  }
}

// Handle auth state changes
function handleAuthStateChanged(event, session) {
  if (event === "SIGNED_IN" && session) {
    currentUser = session.user;
    updateAuthUI(currentUser);
    loadUserProgress();
  } else if (event === "SIGNED_OUT") {
    currentUser = null;
    updateAuthUI(null);
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
        <button class="btn-logout" onclick="signOutUser()">Sign Out</button>
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
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/index.html",
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
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/index.html",
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
