document.addEventListener("DOMContentLoaded", function () {
  // Handle Supabase hash callback (e.g., #access_token=...)
  handleAuthHashIfPresent();

  // Check authentication status after processing potential hash tokens
  checkAuthStatus();

  // Enter key event listener
  document
    .getElementById("user-input")
    .addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });
});

// Global variables
let isListening = false;
let currentUser = null;
let accessToken = null;
let refreshToken = null;

// Authentication Functions
function checkAuthStatus() {
  const token = localStorage.getItem("accessToken");
  if (token) {
    fetch("/auth/verify", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated) {
          currentUser = data.user;
          accessToken = token;
          refreshToken = localStorage.getItem("refreshToken");
          showMainApp();
          updateUserInfo(data.user);
          // Clear session when authenticated user loads
          clearSession();
        } else {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          showAuthModal();
        }
      })
      .catch((error) => {
        console.error("Auth verification error:", error);
        showAuthModal();
      });
  } else {
    showAuthModal();
  }
}

function showAuthModal() {
  document.getElementById("auth-modal").classList.remove("hidden");
  document.querySelector(".chat-container").style.filter = "blur(5px)";
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden");
  document.querySelector(".chat-container").style.filter = "none";
}

function showMainApp() {
  closeAuthModal();
  document.getElementById("user-info-bar").classList.remove("hidden");
}

function showLoginForm() {
  document.getElementById("login-form").classList.remove("hidden");
  document.getElementById("signup-form").classList.add("hidden");
  document.getElementById("auth-title").textContent = "Welcome Back";
}

function showSignupForm() {
  document.getElementById("signup-form").classList.remove("hidden");
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("auth-title").textContent = "Join Mentorae";
}

function updateUserInfo(user) {
  document.getElementById("user-name").textContent = user.name || "User";
  document.getElementById("user-email").textContent = user.email;
}

function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showNotification("Please fill in all fields", "error");
    return;
  }

  const loginBtn = document.querySelector(".login-btn");
  const originalText = loginBtn.innerHTML;
  loginBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Signing in...';
  loginBtn.disabled = true;

  fetch("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        currentUser = data.user;

        // Store tokens
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        showMainApp();
        updateUserInfo(data.user);
        showNotification("Login successful!", "success");

        // Clear session for the authenticated user
        clearSession();

        // Reset form
        document.getElementById("login-email").value = "";
        document.getElementById("login-password").value = "";
      } else {
        showNotification(data.error || "Login failed", "error");
      }
    })
    .catch((error) => {
      console.error("Login error:", error);
      showNotification("Login failed. Please try again.", "error");
    })
    .finally(() => {
      loginBtn.innerHTML = originalText;
      loginBtn.disabled = false;
    });
}

function handleSignup(event) {
  event.preventDefault();

  const name = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById(
    "signup-confirm-password"
  ).value;

  if (!name || !email || !password || !confirmPassword) {
    showNotification("Please fill in all fields", "error");
    return;
  }

  if (password !== confirmPassword) {
    showNotification("Passwords do not match", "error");
    return;
  }

  if (password.length < 6) {
    showNotification("Password must be at least 6 characters long", "error");
    return;
  }

  const signupBtn = document.querySelector(".signup-btn");
  const originalText = signupBtn.innerHTML;
  signupBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Creating account...';
  signupBtn.disabled = true;

  fetch("/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showNotification(data.message, "success");
        showLoginForm();

        // Pre-fill email in login form
        document.getElementById("login-email").value = email;

        // Reset signup form
        document.getElementById("signup-name").value = "";
        document.getElementById("signup-email").value = "";
        document.getElementById("signup-password").value = "";
        document.getElementById("signup-confirm-password").value = "";
      } else {
        showNotification(data.error || "Signup failed", "error");
      }
    })
    .catch((error) => {
      console.error("Signup error:", error);
      showNotification("Signup failed. Please try again.", "error");
    })
    .finally(() => {
      signupBtn.innerHTML = originalText;
      signupBtn.disabled = false;
    });
}

function handleLogout() {
  if (!confirm("Are you sure you want to logout?")) {
    return;
  }

  fetch("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      // Clear stored data
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      currentUser = null;
      accessToken = null;
      refreshToken = null;

      // Hide user info and show auth modal
      document.getElementById("user-info-bar").classList.add("hidden");
      showAuthModal();
      showNotification("Logged out successfully", "success");

      // Clear chat history
      document.getElementById("chat-box").innerHTML = "";
    })
    .catch((error) => {
      console.error("Logout error:", error);
      showNotification("Logout failed", "error");
    });
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
        <i class="fa-solid ${
          type === "success"
            ? "fa-check-circle"
            : type === "error"
            ? "fa-exclamation-circle"
            : "fa-info-circle"
        }"></i>
        <span>${message}</span>
    `;

  document.body.appendChild(notification);

  // Add styles if not already present
  if (!document.querySelector(".notification-styles")) {
    const style = document.createElement("style");
    style.className = "notification-styles";
    style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 16px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 250px;
                animation: slideInRight 0.3s ease-out;
            }
            .notification.success { background-color: #4caf50; }
            .notification.error { background-color: #f44336; }
            .notification.info { background-color: #2196f3; }
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
    document.head.appendChild(style);
  }

  // Auto remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = "slideInRight 0.3s ease-out reverse";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Enhanced API call function with authentication
function makeAuthenticatedRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  return fetch(url, mergedOptions).then((response) => {
    if (response.status === 401) {
      // Token might be expired, try to refresh
      return refreshAuthToken().then((success) => {
        if (success) {
          // Update authorization header and retry
          mergedOptions.headers.Authorization = `Bearer ${accessToken}`;
          return fetch(url, mergedOptions);
        } else {
          // Refresh failed, redirect to login
          handleLogout();
          throw new Error("Authentication failed");
        }
      });
    }
    return response;
  });
}

function refreshAuthToken() {
  if (!refreshToken) {
    return Promise.resolve(false);
  }

  return fetch("/auth/refresh", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", refreshToken);
        return true;
      }
      return false;
    })
    .catch(() => false);
}

// Function to clear session on page load/refresh
function clearSession() {
  if (!accessToken) {
    console.log("No access token available");
    return;
  }

  makeAuthenticatedRequest("/clear-session", {
    method: "POST",
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Session cleared:", data.message);
      // Reset RAG status indicator
      updateRagStatus(false);
    })
    .catch((error) => {
      console.error("Error clearing session:", error);
    });
}

function displayFileNames(files) {
  const chatBox = document.getElementById("chat-box");
  const fileNameDisplay = document.createElement("div");
  fileNameDisplay.className = "file-name-display";

  const fileNames = Array.from(files)
    .map((file) => file.name)
    .join(", ");
  fileNameDisplay.innerHTML = `<strong>Mentorae:</strong> Loading documents: ${fileNames}`;
  chatBox.appendChild(fileNameDisplay);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function handleFileUpload(files) {
  if (!files || files.length === 0) return;

  // Display file names in chat
  displayFileNames(files);

  // Display initializing message
  const chatBox = document.getElementById("chat-box");
  const initializingMessage = document.createElement("div");
  initializingMessage.className = "ai-message";
  initializingMessage.innerHTML = `<strong>Mentorae:</strong> Initializing RAG system with documents...`;
  chatBox.appendChild(initializingMessage);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Show loading indicator
  document.getElementById("loading-indicator").classList.remove("hidden");

  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append("files", file);
  });

  fetch("/initialize-rag", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      // Hide loading indicator
      document.getElementById("loading-indicator").classList.add("hidden");

      const chatBox = document.getElementById("chat-box");
      const ragMessage = document.createElement("div");
      ragMessage.className = "ai-message";

      if (data.success) {
        ragMessage.innerHTML = `<strong>Mentorae:</strong> ✅ RAG initialized successfully! You can now ask questions about the uploaded documents.`;
        updateRagStatus(true);
      } else {
        ragMessage.innerHTML = `<strong>Mentorae:</strong> ❌ Failed to initialize RAG. Falling back to standard response generation.`;
        updateRagStatus(false);
      }

      chatBox.appendChild(ragMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch((error) => {
      // Hide loading indicator
      document.getElementById("loading-indicator").classList.add("hidden");

      console.error("RAG initialization error:", error);

      const chatBox = document.getElementById("chat-box");
      const errorMessage = document.createElement("div");
      errorMessage.className = "ai-message";
      errorMessage.innerHTML = `<strong>Mentorae:</strong> ❌ Error initializing RAG. Falling back to standard response generation.`;
      chatBox.appendChild(errorMessage);
      chatBox.scrollTop = chatBox.scrollHeight;

      updateRagStatus(false);
    });
}

function handleFolderUpload(files) {
  if (!files || files.length === 0) return;

  // Display folder name in chat
  const folderName = files[0].webkitRelativePath.split("/")[0];
  const chatBox = document.getElementById("chat-box");
  const folderNameDisplay = document.createElement("div");
  folderNameDisplay.className = "file-name-display";
  folderNameDisplay.innerHTML = `<strong>Mentorae:</strong> Loading documents from folder: ${folderName}`;
  chatBox.appendChild(folderNameDisplay);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Display initializing message
  const initializingMessage = document.createElement("div");
  initializingMessage.className = "ai-message";
  initializingMessage.innerHTML = `<strong>Mentorae:</strong> Initializing RAG system with folder documents...`;
  chatBox.appendChild(initializingMessage);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Show loading indicator
  document.getElementById("loading-indicator").classList.remove("hidden");

  // Get the first file's webkitRelativePath to extract the folder
  const folderPath = files[0].webkitRelativePath.split("/")[0];

  const formData = new FormData();
  formData.append("folder", folderPath);

  fetch("/initialize-rag", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      // Hide loading indicator
      document.getElementById("loading-indicator").classList.add("hidden");

      const ragMessage = document.createElement("div");
      ragMessage.className = "ai-message";

      if (data.success) {
        ragMessage.innerHTML = `<strong>Mentorae:</strong> ✅ RAG initialized successfully with folder documents! You can now ask questions about the uploaded documents.`;
        updateRagStatus(true);
      } else {
        ragMessage.innerHTML = `<strong>Mentorae:</strong> ❌ Failed to initialize RAG. Falling back to standard response generation.`;
        updateRagStatus(false);
      }

      chatBox.appendChild(ragMessage);
      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch((error) => {
      // Hide loading indicator
      document.getElementById("loading-indicator").classList.add("hidden");

      console.error("RAG initialization error:", error);

      const errorMessage = document.createElement("div");
      errorMessage.className = "ai-message";
      errorMessage.innerHTML = `<strong>Mentorae:</strong> ❌ Error initializing RAG. Falling back to standard response generation.`;
      chatBox.appendChild(errorMessage);
      chatBox.scrollTop = chatBox.scrollHeight;

      updateRagStatus(false);
    });
}

function updateRagStatus(isActive) {
  const statusDot = document.querySelector(".status-dot");
  const statusText = document.querySelector(".status-text");

  if (isActive) {
    statusDot.classList.remove("inactive");
    statusDot.classList.add("active");
    statusText.textContent = "PDFs loaded - RAG enabled";
  } else {
    statusDot.classList.remove("active");
    statusDot.classList.add("inactive");
    statusText.textContent = "No PDFs loaded";
  }
}

// Function to create or update the thinking state
function setAIMessageToThinking(messageElement) {
  // Add the thinking class
  messageElement.classList.add("thinking");

  // Check if dots already exist
  let dotsContainer = messageElement.querySelector(".thinking-dots");

  // If not, create them
  if (!dotsContainer) {
    dotsContainer = document.createElement("div");
    dotsContainer.className = "thinking-dots";

    // Create 3 dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "thinking-dot";
      dotsContainer.appendChild(dot);
    }

    // Add "Mentorae:" label
    const label = document.createElement("strong");
    label.textContent = "Mentorae:";
    messageElement.appendChild(label);
    messageElement.appendChild(dotsContainer);
  }
}

function sendMessage() {
  let userInput = document.getElementById("user-input").value.trim();
  if (userInput === "") return;

  if (!accessToken) {
    showNotification("Please login to use the chat feature", "error");
    return;
  }

  let chatBox = document.getElementById("chat-box");

  // Display user message (Right-aligned)
  let userMessage = document.createElement("div");
  userMessage.className = "user-message";
  userMessage.innerHTML = `<strong>You:</strong> ${userInput}`;
  chatBox.appendChild(userMessage);

  // Create and show thinking message with animated dots
  let thinkingMessage = document.createElement("div");
  thinkingMessage.className = "ai-message";
  setAIMessageToThinking(thinkingMessage);
  chatBox.appendChild(thinkingMessage);

  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom

  // Send request to backend
  makeAuthenticatedRequest("/ask", {
    method: "POST",
    body: JSON.stringify({ query: userInput }),
  })
    .then((response) => response.json())
    .then((data) => {
      // Remove thinking message
      chatBox.removeChild(thinkingMessage);

      // Display AI response (Left-aligned)
      let aiMessage = document.createElement("div");
      aiMessage.className = "ai-message";
      aiMessage.innerHTML = `<strong>Mentorae:</strong> ${data.response}`;
      chatBox.appendChild(aiMessage);

      if (data.hasScraping && data.scraped) {
        let scrapedInfo = document.createElement("div");
        scrapedInfo.className = "scraped-info";
        scrapedInfo.innerHTML = `<details>
                <summary>📚 View scraped information</summary>
                <div class="scraped-content">${data.scraped}</div>
            </details>`;
        chatBox.appendChild(scrapedInfo);
      }
      // If there was retrieval info and we want to show it
      if (data.hasRetrieval && data.retrieved) {
        let retrievalInfo = document.createElement("div");
        retrievalInfo.className = "retrieval-info";
        retrievalInfo.innerHTML = `<details>
                <summary>📚 View retrieved information</summary>
                <div class="retrieved-content">${data.retrieved}</div>
            </details>`;
        chatBox.appendChild(retrievalInfo);
      }

      chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
    })
    .catch((error) => {
      // Remove thinking message
      if (chatBox.contains(thinkingMessage)) {
        chatBox.removeChild(thinkingMessage);
      }

      // Display error message
      let errorMessage = document.createElement("div");
      errorMessage.className = "ai-message error";
      errorMessage.innerHTML = `<strong>Mentorae:</strong> Sorry, I encountered an error processing your request. Please try again.`;
      chatBox.appendChild(errorMessage);

      console.error("Error sending message:", error);
    });

  document.getElementById("user-input").value = ""; // Clear input field
}

function toggleVoiceInput() {
  if (isListening) {
    stopListening();
  } else {
    startVoiceInput();
  }
}

function startVoiceInput() {
  let popup = document.getElementById("listening-popup");
  let micButton = document.querySelector(".mic-button");

  // Toggle listening state
  if (isListening) {
    // If already listening, stop it
    stopListening();

    // Call backend to stop listening process
    fetch("/stop-listening", { method: "POST" }).then(() =>
      console.log("Speech recognition stopped by user")
    );

    return;
  }

  // Start listening
  isListening = true;
  micButton.classList.add("active");
  popup.classList.remove("hidden");

  // Show the listening popup with waves
  document.getElementById("listening-text").textContent = "Listening...";

  fetch("/speech-to-text", { method: "POST" })
    .then((response) => response.json())
    .then((data) => {
      // Stop listening state
      stopListening();

      // Update input field with recognized text
      document.getElementById("user-input").value = data.query;

      // If we got valid text, send the message
      if (data.query && data.query.trim() !== "") {
        sendMessage();
      }
    })
    .catch((error) => {
      console.error("Speech recognition error:", error);
      stopListening();
    });
}

function stopListening() {
  let popup = document.getElementById("listening-popup");
  let micButton = document.querySelector(".mic-button");

  isListening = false;
  micButton.classList.remove("active");
  popup.classList.add("hidden");
}

function stopSpeech() {
  // Visual feedback that the button was clicked
  const stopButton = document.querySelector(".stop-button");
  const originalContent = stopButton.innerHTML;
  stopButton.disabled = true;
  stopButton.style.backgroundColor = "#ffffff";
  stopButton.innerHTML = "⏱ Stopping...";

  // Make multiple attempts to stop the speech
  function attemptStopSpeech(attempts = 3) {
    fetch("/stop-speech", {
      method: "POST",
      headers: { "Cache-Control": "no-cache" }, // Prevent caching
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Stop speech response:", data);

        if (data.success) {
          stopButton.style.backgroundColor = "#ffffff";
          stopButton.innerHTML = "✓ Stopped";

          setTimeout(() => {
            stopButton.disabled = false;
            stopButton.style.backgroundColor = "#ffffff";
            stopButton.innerHTML = originalContent;
          }, 500);
        } else if (attempts > 1) {
          // Try again
          console.log(
            `Speech stop attempt failed, trying again. ${
              attempts - 1
            } attempts remaining`
          );
          setTimeout(() => attemptStopSpeech(attempts - 1), 500);
        } else {
          console.warn("Failed to stop speech after multiple attempts");
          stopButton.disabled = false;
          stopButton.style.backgroundColor = "#dc3545";
          stopButton.innerHTML = originalContent;

          // Last resort: reload the page
          if (
            confirm(
              "Unable to stop speech. Would you like to reload the page to stop it?"
            )
          ) {
            window.location.reload();
          }
        }
      })
      .catch((error) => {
        console.error("Error stopping speech:", error);
        stopButton.disabled = false;
        stopButton.style.backgroundColor = "#dc3545";
        stopButton.innerHTML = originalContent;
      });
  }

  attemptStopSpeech();
}

function handleTextareaInput(event) {
  // Allow for shift+enter to create a new line without submitting
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }

  // Auto-resize the textarea
  const textarea = event.target;
  textarea.style.height = "auto";
  const newHeight = Math.min(textarea.scrollHeight, 150); // Max height of 150px
  textarea.style.height = newHeight + "px";
}

// Welcome message on page load
window.onload = function () {
  // Only show welcome message if user is authenticated
  if (currentUser) {
    setTimeout(() => {
      const chatBox = document.getElementById("chat-box");
      const welcomeMessage = document.createElement("div");
      welcomeMessage.className = "ai-message";
      const welcomeText = `Hello ${
        currentUser.name || "there"
      }! I'm Mentorae your AI Tutor. You can ask me questions directly, or upload PDF documents using the buttons below to get document-specific answers. How can I help you today?`;
      welcomeMessage.innerHTML = `<strong>Mentorae:</strong> ${welcomeText}`;
      chatBox.appendChild(welcomeMessage);

      // Send welcome message for speech synthesis
      fetch("/text-to-speech", {
        method: "POST",
        body: JSON.stringify({ text: welcomeText }),
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => response.json())
        .then((data) => console.log("Welcome message spoken"))
        .catch((error) =>
          console.error("Error speaking welcome message:", error)
        );
    }, 500);
  }
};

// Helper: parse URL hash params into an object
function getHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.substring(1)
    : "";
  const params = new URLSearchParams(hash);
  const obj = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return obj;
}

// Handle Supabase auth callback from hash fragment
function handleAuthHashIfPresent() {
  const params = getHashParams();
  if (!params || !params.access_token) {
    return;
  }

  try {
    // Store tokens
    accessToken = params.access_token;
    refreshToken = params.refresh_token || null;
    localStorage.setItem("accessToken", accessToken);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }

    // Clean the URL (remove hash) without reloading
    const newUrl =
      window.location.origin +
      window.location.pathname +
      window.location.search;
    window.history.replaceState({}, document.title, newUrl);
  } catch (e) {
    console.error("Failed to process auth hash:", e);
  }
}
