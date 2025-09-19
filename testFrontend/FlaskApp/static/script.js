document.addEventListener("DOMContentLoaded", function () {
  // Enter key event listener
  document
    .getElementById("user-input")
    .addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });

  // Clear session when page is refreshed or loaded
  clearSession();
});

// Global variables
let isListening = false;

// Function to clear session on page load/refresh
function clearSession() {
  fetch("/clear-session", {
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

function displayArtifactResult(searchData, userMessage) {
  const chatBox = document.getElementById("chat-box");

  // Try to display Claude-style artifact first
  const artifactContainer = document.createElement("div");
  artifactContainer.className = "search-artifact claude-style";

  // Create Claude-style header with globe icon
  const header = document.createElement("div");
  header.className = "claude-artifact-header";
  header.innerHTML = `
        <div class="claude-header-content">
            <div class="claude-search-icon">
                <i class="fas fa-globe"></i>
            </div>
            <div class="claude-title-section">
                <h3 class="claude-search-title">${searchData.query}</h3>
                <span class="claude-result-count">${searchData.total_results} results</span>
            </div>
        </div>
    `;

  // Create Claude-style content
  const content = document.createElement("div");
  content.className = "claude-artifact-content";

  let contentHTML = "";

  // AI Summary in Claude style
  if (searchData.answer) {
    contentHTML += `
            <div class="claude-summary">
                <p class="claude-summary-text">${searchData.answer}</p>
            </div>
        `;
  }

  // Claude-style search results list
  if (searchData.results && searchData.results.length > 0) {
    contentHTML += `
            <div class="claude-results-container">
        `;

    searchData.results.slice(0, 6).forEach((result, index) => {
      // Get domain favicon
      const favicon = `https://www.google.com/s2/favicons?domain=${result.domain}&sz=16`;

      // Determine result icon based on domain
      let resultIcon = "fas fa-globe";
      if (result.domain.includes("wikipedia"))
        resultIcon = "fab fa-wikipedia-w";
      else if (result.domain.includes("youtube")) resultIcon = "fab fa-youtube";
      else if (result.domain.includes("github")) resultIcon = "fab fa-github";
      else if (result.domain.includes("aws")) resultIcon = "fab fa-aws";
      else if (result.domain.includes("geeksforgeeks"))
        resultIcon = "fas fa-code";

      contentHTML += `
                <div class="claude-result-item" onclick="window.open('${result.url}', '_blank')">
                    <div class="claude-result-icon">
                        <i class="${resultIcon}"></i>
                    </div>
                    <div class="claude-result-content">
                        <div class="claude-result-title">${result.title}</div>
                        <div class="claude-result-domain">${result.domain}</div>
                    </div>
                    <div class="claude-result-favicon">
                        <img src="${favicon}" alt="" onerror="this.style.display='none'">
                    </div>
                </div>
            `;
    });

    contentHTML += `
            </div>
        `;
  }

  // Add educational videos in Claude style if available
  if (searchData.videos && searchData.videos.length > 0) {
    contentHTML += `
            <div class="claude-videos-section">
                <div class="claude-section-title">
                    <i class="fab fa-youtube"></i>
                    Educational Videos
                </div>
                <div class="claude-videos-list">
        `;

    searchData.videos.slice(0, 3).forEach((video, index) => {
      contentHTML += `
                <div class="claude-video-item" onclick="window.open('${video.url}', '_blank')">
                    <div class="claude-video-icon">
                        <i class="fab fa-youtube"></i>
                    </div>
                    <div class="claude-video-content">
                        <div class="claude-video-title">${video.title}</div>
                        <div class="claude-video-meta">${video.channel} • ${video.duration}</div>
                    </div>
                </div>
            `;
    });

    contentHTML += `
                </div>
            </div>
        `;
  }

  content.innerHTML = contentHTML;

  // Assemble Claude-style artifact
  artifactContainer.appendChild(header);
  artifactContainer.appendChild(content);

  // Create fallback text-only version
  const textOnlyContainer = document.createElement("div");
  textOnlyContainer.className = "ai-message";

  let textContent = `<strong>Mentorae:</strong> Here are the search results for "${searchData.query}":\n\n`;

  if (searchData.answer) {
    textContent += `<strong>Summary:</strong>\n${searchData.answer}\n\n`;
  }

  if (searchData.results && searchData.results.length > 0) {
    textContent += `<strong>Top Results:</strong>\n`;
    searchData.results.slice(0, 6).forEach((result, index) => {
      textContent += `${index + 1}. ${result.title}
   Source: ${result.domain}
   URL: ${result.url}

`;
    });
  }

  if (searchData.videos && searchData.videos.length > 0) {
    textContent += `<strong>Educational Videos:</strong>\n`;
    searchData.videos.slice(0, 3).forEach((video, index) => {
      textContent += `${index + 1}. ${video.title}
   Channel: ${video.channel}
   Duration: ${video.duration}
   URL: ${video.url}

`;
    });
  }

  textOnlyContainer.innerHTML = textContent.replace(/\n/g, "<br>");

  // Try to add Claude-style artifact, fallback to text-only if it fails
  try {
    // Add to chat
    chatBox.appendChild(userMessage);
    chatBox.appendChild(artifactContainer);
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (error) {
    console.error(
      "Error displaying Claude-style artifact, falling back to text-only display:",
      error
    );
    // Remove the artifact container if it was partially added
    if (artifactContainer.parentNode) {
      artifactContainer.parentNode.removeChild(artifactContainer);
    }
    // Add to chat with text-only version
    chatBox.appendChild(userMessage);
    chatBox.appendChild(textOnlyContainer);
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function displayTextOnlyResult(searchData, userMessage) {
  const chatBox = document.getElementById("chat-box");

  // Create text-only version
  const textOnlyContainer = document.createElement("div");
  textOnlyContainer.className = "ai-message";

  let textContent = `<strong>Mentorae:</strong> Here are the search results for "${searchData.query}":\n\n`;

  if (searchData.answer) {
    textContent += `<strong>Summary:</strong>\n${searchData.answer}\n\n`;
  }

  if (searchData.results && searchData.results.length > 0) {
    textContent += `<strong>Top Results:</strong>\n`;
    searchData.results.slice(0, 6).forEach((result, index) => {
      textContent += `${index + 1}. ${result.title}
   Source: ${result.domain}
   URL: ${result.url}

`;
    });
  }

  if (searchData.videos && searchData.videos.length > 0) {
    textContent += `<strong>Educational Videos:</strong>\n`;
    searchData.videos.slice(0, 3).forEach((video, index) => {
      textContent += `${index + 1}. ${video.title}
   Channel: ${video.channel}
   Duration: ${video.duration}
   URL: ${video.url}

`;
    });
  }

  textOnlyContainer.innerHTML = textContent.replace(/\n/g, "<br>");

  // Add to chat with text-only version
  chatBox.appendChild(userMessage);
  chatBox.appendChild(textOnlyContainer);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function previewSource(url, title) {
  // Create preview modal
  const modal = document.createElement("div");
  modal.className = "source-preview-modal";
  modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="this.closest('.source-preview-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <iframe src="${url}" frameborder="0"></iframe>
            </div>
            <div class="modal-footer">
                <button onclick="window.open('${url}', '_blank')" class="btn-primary">
                    <i class="fas fa-external-link-alt"></i> Open in New Tab
                </button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function openSourceModal(url, title) {
  previewSource(url, title);
}

// Enhanced Artifact Control Functions
function toggleArtifactContent(button) {
  const artifactContainer = button.closest(".search-artifact");
  const content = artifactContainer.querySelector(".artifact-content");
  const icon = button.querySelector("i");

  if (content.classList.contains("expanded")) {
    content.classList.remove("expanded");
    content.classList.add("collapsed");
    icon.classList.remove("fa-chevron-down");
    icon.classList.add("fa-chevron-right");
  } else {
    content.classList.remove("collapsed");
    content.classList.add("expanded");
    icon.classList.remove("fa-chevron-right");
    icon.classList.add("fa-chevron-down");
  }
}

function toggleSection(sectionHeader) {
  const section = sectionHeader.closest(".artifact-section");
  const content = section.querySelector(".section-content");
  const toggle = sectionHeader.querySelector(".section-toggle");

  if (content.classList.contains("expanded")) {
    content.classList.remove("expanded");
    content.classList.add("collapsed");
    toggle.classList.remove("fa-chevron-down");
    toggle.classList.add("fa-chevron-right");
    section.classList.add("section-collapsed");
  } else {
    content.classList.remove("collapsed");
    content.classList.add("expanded");
    toggle.classList.remove("fa-chevron-right");
    toggle.classList.add("fa-chevron-down");
    section.classList.remove("section-collapsed");
  }
}

function copyCitation(citationNumber, title, url) {
  const citation = `[${citationNumber}] ${title}. ${url}`;

  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(citation)
      .then(() => {
        showToast("Citation copied to clipboard!", "success");
      })
      .catch(() => {
        fallbackCopyText(citation);
      });
  } else {
    fallbackCopyText(citation);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
    showToast("Citation copied to clipboard!", "success");
  } catch (err) {
    showToast("Failed to copy citation", "error");
  }

  document.body.removeChild(textArea);
}

function suggestQuery(query) {
  const userInput = document.getElementById("user-input");
  userInput.value = query;
  userInput.focus();

  // Optional: Auto-send the query
  const sendButton = document.querySelector(".send-button");
  if (sendButton) {
    setTimeout(() => {
      sendMessage();
    }, 500);
  }
}

function showToast(message, type = "info") {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll(".toast");
  existingToasts.forEach((toast) => toast.remove());

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${
              type === "success"
                ? "fa-check-circle"
                : type === "error"
                ? "fa-exclamation-circle"
                : "fa-info-circle"
            }"></i>
            <span>${message}</span>
        </div>
    `;

  document.body.appendChild(toast);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.classList.add("toast-fade-out");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 3000);
}

// Enhanced Video and Link Functions
function openVideoLink(url) {
  if (url) {
    window.open(url, "_blank");
    showToast("Opening video on YouTube...", "info");
  }
}

function shareVideo(title, url) {
  if (navigator.share) {
    navigator
      .share({
        title: title,
        url: url,
      })
      .then(() => {
        showToast("Video shared successfully!", "success");
      })
      .catch(() => {
        copyToClipboard(url);
        showToast("Video URL copied to clipboard!", "success");
      });
  } else {
    copyToClipboard(url);
    showToast("Video URL copied to clipboard!", "success");
  }
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}

function sendMessage() {
  let userInput = document.getElementById("user-input").value.trim();
  if (userInput === "") return;

  let chatBox = document.getElementById("chat-box");

  // Display user message (Right-aligned)
  let userMessage = document.createElement("div");
  userMessage.className = "user-message";
  userMessage.innerHTML = `<strong>You:</strong> ${userInput}`;

  // Create and show thinking message with animated dots
  let thinkingMessage = document.createElement("div");
  thinkingMessage.className = "ai-message";
  setAIMessageToThinking(thinkingMessage);
  chatBox.appendChild(thinkingMessage);

  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom

  // Check if we have image data and should query about the image
  if (window.currentImageData && window.currentImageAnalysis) {
    // Send request to backend with image context
    fetch("/ask-about-image", {
      method: "POST",
      body: JSON.stringify({ 
        query: userInput,
        image_data: window.currentImageData,
        image_analysis: window.currentImageAnalysis
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => {
        // Remove thinking message
        chatBox.removeChild(thinkingMessage);
        
        // Display user message
        chatBox.appendChild(userMessage);
        
        // Display AI response
        let aiMessage = document.createElement("div");
        aiMessage.className = "ai-message";
        aiMessage.innerHTML = `<strong>Mentorae:</strong> ${data.response}`;
        chatBox.appendChild(aiMessage);
        
        chatBox.scrollTop = chatBox.scrollHeight;
      })
      .catch((error) => {
        // Remove thinking message
        chatBox.removeChild(thinkingMessage);
        
        // Display user message
        chatBox.appendChild(userMessage);
        
        // Display error message
        let errorMessage = document.createElement("div");
        errorMessage.className = "ai-message error";
        errorMessage.innerHTML = `<strong>Mentorae:</strong> Sorry, I encountered an error processing your request. Please try again.`;
        chatBox.appendChild(errorMessage);

        console.error("Error sending message:", error);
        chatBox.scrollTop = chatBox.scrollHeight;
      });
  } else {
    // Regular message flow for non-image queries
    // Check if we should show enhanced search results
    const shouldShowSearchArtifact =
      !document.querySelector(".status-dot.active"); // Show if no RAG loaded

    if (shouldShowSearchArtifact) {
      // First, get enhanced search results with timeout handling
      fetch("/enhanced-search", {
        method: "POST",
        body: JSON.stringify({ query: userInput, search_type: "educational" }),
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => {
          if (response.status === 408) {
            // Timeout error
            throw new Error("TIMEOUT");
          }
          return response.json();
        })
        .then((searchResponse) => {
          if (searchResponse.success && searchResponse.search_data) {
            // Don't display search artifact immediately - just add user message and get AI response
            chatBox.removeChild(thinkingMessage);
            chatBox.appendChild(userMessage);

            // Show engine used info
            if (searchResponse.engine_used) {
              showToast(
                `Search powered by ${searchResponse.engine_used}`,
                "info"
              );
            }

            // Add thinking message for AI response
            let secondThinkingMessage = document.createElement("div");
            secondThinkingMessage.className = "ai-message";
            setAIMessageToThinking(secondThinkingMessage);
            chatBox.appendChild(secondThinkingMessage);

            // Now get AI response
            return fetch("/ask", {
              method: "POST",
              body: JSON.stringify({ query: userInput }),
              headers: { "Content-Type": "application/json" },
            })
              .then((response) => response.json())
              .then((data) => {
                chatBox.removeChild(secondThinkingMessage);
                displayAIResponse(data);

                // After AI response, add the search artifact as reference links
                setTimeout(() => {
                  addSearchArtifactAsReferences(searchResponse.search_data);
                }, 1500); // 1.5 second delay to show search results as references
              });
          } else {
            // Handle search failure
            if (searchResponse.timeout) {
              showToast(
                "Search timed out. Switching to backup method...",
                "warning"
              );
              // Try regular flow as fallback
              return regularMessageFlow(userInput, userMessage, thinkingMessage);
            } else {
              showToast("Search failed. Using backup method...", "warning");
              return regularMessageFlow(userInput, userMessage, thinkingMessage);
            }
          }
        })
        .catch((error) => {
          console.log("Enhanced search failed:", error);

          if (error.message === "TIMEOUT") {
            showToast(
              "Search timed out. Trying alternative method...",
              "warning"
            );
          } else {
            showToast("Search unavailable. Using fallback...", "info");
          }

          return regularMessageFlow(userInput, userMessage, thinkingMessage);
        });
    } else {
      // Regular flow for RAG-enabled queries
      regularMessageFlow(userInput, userMessage, thinkingMessage);
    }
  }

  document.getElementById("user-input").value = ""; // Clear input field
}

function regularMessageFlow(userInput, userMessage, thinkingMessage) {
  let chatBox = document.getElementById("chat-box");
  chatBox.appendChild(userMessage);

  // Send request to backend
  return fetch("/ask", {
    method: "POST",
    body: JSON.stringify({ query: userInput }),
    headers: { "Content-Type": "application/json" },
  })
    .then((response) => response.json())
    .then((data) => {
      // Remove thinking message
      chatBox.removeChild(thinkingMessage);
      displayAIResponse(data);
    })
    .catch((error) => {
      // Remove thinking message
      chatBox.removeChild(thinkingMessage);

      // Display error message
      let errorMessage = document.createElement("div");
      errorMessage.className = "ai-message error";
      errorMessage.innerHTML = `<strong>Mentorae:</strong> Sorry, I encountered an error processing your request. Please try again.`;
      chatBox.appendChild(errorMessage);

      console.error("Error sending message:", error);
    });
}

function displayAIResponse(data) {
  let chatBox = document.getElementById("chat-box");

  // Display AI response (Left-aligned)
  let aiMessage = document.createElement("div");
  aiMessage.className = "ai-message";
  aiMessage.innerHTML = `<strong>Mentorae:</strong> ${data.response}`;
  chatBox.appendChild(aiMessage);

  // If sources should be shown separately, add them in a new pill after a delay
  if (data.showSourcesSeparately && data.hasScraping && data.scraped) {
    setTimeout(() => {
      addReferenceLinksPill(data.scraped);
    }, 1000); // 1 second delay to show sources in a separate pill
  } else if (data.hasScraping && data.scraped) {
    // Legacy behavior for backward compatibility
    let scrapedInfo = document.createElement("div");
    scrapedInfo.className = "scraped-info modern-style";
    scrapedInfo.innerHTML = createModernScrapedInfo(data.scraped);
    chatBox.appendChild(scrapedInfo);
  }

  // If there was retrieval info and we want to show it
  if (data.hasRetrieval && data.retrieved) {
    let retrievalInfo = document.createElement("div");
    retrievalInfo.className = "retrieval-info modern-style";
    retrievalInfo.innerHTML = createModernScrapedInfo(data.retrieved);
    chatBox.appendChild(retrievalInfo);
  }

  chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
}

function addReferenceLinksPill(scrapedData) {
  let chatBox = document.getElementById("chat-box");

  // Create a new AI message pill for reference links
  // let referencePill = document.createElement("div");
  // referencePill.className = "ai-message reference-pill";

  // Parse the scraped data to extract links
  const lines = scrapedData.split("\n");
  let sources = [];
  let currentContent = "";

  lines.forEach((line) => {
    line = line.trim();
    if (!line) return;

    // Check for source patterns
    const sourceMatch = line.match(/^\[(\d+)\]\s+(.+?)(?:\s+\(([^)]+)\))?:?$/);
    if (sourceMatch) {
      if (currentContent) {
        currentContent = "";
      }

      const [, number, title, domain] = sourceMatch;
      sources.push({
        number: parseInt(number),
        title: title,
        domain: domain || extractDomainFromTitle(title),
        url: constructUrlFromSource(title, domain),
      });
    }
    // Check for direct URLs
    else if (line.includes("http")) {
      const urlMatch = line.match(/^\[(\d+)\]\s+(.+)/);
      if (urlMatch) {
        const [, number, url] = urlMatch;
        const existingSource = sources.find(
          (s) => s.number === parseInt(number)
        );
        if (existingSource) {
          existingSource.url = url;
        } else {
          sources.push({
            number: parseInt(number),
            title: extractDomainFromUrl(url),
            domain: extractDomainFromUrl(url),
            url: url,
          });
        }
      }
    }
    // Skip "Sources:" header
    else if (line !== "Sources:") {
      currentContent += line + " ";
    }
  });

  // Create the reference links content
  let referenceContent = `<strong>Mentorae:</strong> <i class="fas fa-link"></i> Reference Links:`;

  if (sources.length > 0) {
    referenceContent += `<div class="reference-links-container">`;
    sources.forEach((source) => {
      const favicon = `https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`;
      const domainIcon = getDomainSpecificIcon(source.domain);

      referenceContent += `
        <div class="reference-link-item" onclick="window.open('${
          source.url
        }', '_blank')">
          <div class="reference-number">${source.number}</div>
          <div class="reference-favicon">
            <img src="${favicon}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="fallback-icon" style="display: none;">
              <i class="${domainIcon}"></i>
            </div>
          </div>
          <div class="reference-content">
            <div class="reference-title">${truncateText(source.title, 50)}</div>
            <div class="reference-domain">${source.domain}</div>
          </div>
          <div class="reference-arrow">
            <i class="fas fa-external-link-alt"></i>
          </div>
        </div>
      `;
    });
    referenceContent += `</div>`;
  } else {
    referenceContent += `<div class="no-sources">No reference links available</div>`;
  }

  referencePill.innerHTML = referenceContent;
  chatBox.appendChild(referencePill);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addSearchArtifactAsReferences(searchData) {
  let chatBox = document.getElementById("chat-box");

  // Create a new AI message pill for search results as references
  let referencePill = document.createElement("div");
  referencePill.className = "ai-message reference-pill";

  // Create the reference links content from search data
  let referenceContent = `<strong>Mentorae:</strong> <i class="fas fa-globe"></i> Web Sources:`;

  if (searchData.results && searchData.results.length > 0) {
    referenceContent += `<div class="reference-links-container">`;
    searchData.results.slice(0, 6).forEach((result, index) => {
      const favicon = `https://www.google.com/s2/favicons?domain=${result.domain}&sz=16`;
      const domainIcon = getDomainSpecificIcon(result.domain);

      referenceContent += `
        <div class="reference-link-item" onclick="window.open('${
          result.url
        }', '_blank')">
          <div class="reference-number">${index + 1}</div>
          <div class="reference-favicon">
            <img src="${favicon}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div class="fallback-icon" style="display: none;">
              <i class="${domainIcon}"></i>
            </div>
          </div>
          <div class="reference-content">
            <div class="reference-title">${truncateText(result.title, 50)}</div>
            <div class="reference-domain">${result.domain}</div>
          </div>
          <div class="reference-arrow">
            <i class="fas fa-external-link-alt"></i>
          </div>
        </div>
      `;
    });
    referenceContent += `</div>`;
  } else {
    referenceContent += `<div class="no-sources">No web sources available</div>`;
  }

  referencePill.innerHTML = referenceContent;
  chatBox.appendChild(referencePill);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function createModernScrapedInfo(scrapedData) {
  // Parse the scraped data to extract content and links
  const lines = scrapedData.split("\n");
  let content = "";
  let links = [];
  let currentSection = "";
  let citationCounter = 0;

  // Process each line to extract content and links
  lines.forEach((line) => {
    line = line.trim();
    if (!line) return;

    // Check if it's a source line pattern like "[1] Title (domain):"
    const sourceMatch = line.match(/^\[(\d+)\]\s+(.+?)\s+\(([^)]+)\):/);
    if (sourceMatch) {
      const [, number, title, domain] = sourceMatch;
      citationCounter++;
      links.push({
        number: number,
        title: title,
        domain: domain,
        url: extractUrlFromDomain(domain),
        citationNumber: citationCounter,
      });
      currentSection = `source-${number}`;
    }
    // Check if it's a direct URL in "Sources:" section
    else if (
      line.startsWith("[") &&
      line.includes("]") &&
      line.includes("http")
    ) {
      const urlMatch = line.match(/\[(\d+)\]\s+(.+)/);
      if (urlMatch) {
        const [, number, url] = urlMatch;
        const domain = extractDomainFromUrl(url);
        const existingLink = links.find((l) => l.number === number);
        if (existingLink) {
          existingLink.url = url;
        } else {
          citationCounter++;
          links.push({
            number: number,
            title: domain,
            domain: domain,
            url: url,
            citationNumber: citationCounter,
          });
        }
      }
    }
    // Skip "Sources:" header
    else if (line === "Sources:") {
      return;
    }
    // Content lines
    else if (!line.startsWith("http") && currentSection) {
      content += line + " ";
    }
  });

  // Create Claude-inspired scraped info structure
  return `
        <div class="claude-scraped-container">
            <div class="claude-scraped-header">
                <div class="claude-scraped-icon">
                    <i class="fas fa-globe"></i>
                </div>
                <div class="claude-scraped-title-section">
                    <h3 class="claude-scraped-title">Web Search Results</h3>
                    <span class="claude-scraped-count">${
                      links.length
                    } sources found</span>
                </div>
                <div class="claude-scraped-toggle">
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
            <div class="claude-scraped-content">
                ${
                  content
                    ? `
                    <div class="claude-scraped-summary">
                        <div class="claude-summary-header">
                            <i class="fas fa-robot"></i>
                            <span>AI Summary</span>
                        </div>
                        <div class="claude-summary-text">${content.trim()}</div>
                    </div>
                `
                    : ""
                }
                
                ${
                  links.length > 0
                    ? `
                    <div class="claude-sources-section">
                        <div class="claude-sources-header">
                            <i class="fas fa-external-link-alt"></i>
                            <span>Sources & Citations</span>
                            <div class="claude-sources-count">${
                              links.length
                            }</div>
                        </div>
                        <div class="claude-sources-list">
                            ${links
                              .map((link) => createClaudeStyleSource(link))
                              .join("")}
                        </div>
                    </div>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

function createClaudeStyleSource(link) {
  const icon = getDomainIcon(link.domain);
  const favicon = `https://www.google.com/s2/favicons?domain=${link.domain}&sz=16`;

  return `
        <div class="claude-source-item" onclick="window.open('${
          link.url
        }', '_blank')">
            <div class="claude-source-citation">
                <span class="citation-number">${
                  link.citationNumber || link.number
                }</span>
            </div>
            <div class="claude-source-icon">
                <i class="${icon}"></i>
            </div>
            <div class="claude-source-content">
                <div class="claude-source-title">${link.title}</div>
                <div class="claude-source-domain">${link.domain}</div>
            </div>
            <div class="claude-source-favicon">
                <img src="${favicon}" alt="" onerror="this.style.display='none'">
            </div>
            <div class="claude-source-arrow">
                <i class="fas fa-external-link-alt"></i>
            </div>
        </div>
    `;
}

function createModernStyleLink(link) {
  const icon = getDomainIcon(link.domain);
  const favicon = `https://www.google.com/s2/favicons?domain=${link.domain}&sz=16`;

  return `
        <div class="modern-scraped-link-item" onclick="window.open('${link.url}', '_blank')">
            <div class="modern-scraped-link-icon">
                <i class="${icon}"></i>
            </div>
            <div class="modern-scraped-link-content">
                <div class="modern-scraped-link-title">${link.title}</div>
                <div class="modern-scraped-link-domain">${link.domain}</div>
            </div>
            <div class="modern-scraped-link-favicon">
                <img src="${favicon}" alt="" onerror="this.style.display='none'">
            </div>
            <div class="modern-link-arrow">
                <i class="fas fa-external-link-alt"></i>
            </div>
        </div>
    `;
}

function getDomainIcon(domain) {
  if (domain.includes("youtube")) return "fab fa-youtube";
  if (domain.includes("wikipedia")) return "fab fa-wikipedia-w";
  if (domain.includes("github")) return "fab fa-github";
  if (domain.includes("stackoverflow")) return "fab fa-stack-overflow";
  if (domain.includes("medium")) return "fab fa-medium";
  if (domain.includes("freecodecamp")) return "fas fa-graduation-cap";
  if (domain.includes("geeksforgeeks")) return "fas fa-code";
  if (domain.includes("w3schools")) return "fas fa-code";
  if (domain.includes("tutorialspoint")) return "fas fa-book";
  if (domain.includes("programiz")) return "fas fa-laptop-code";
  return "fas fa-globe";
}

function extractUrlFromDomain(domain) {
  // Simple URL construction for common domains
  if (domain.includes("http")) return domain;
  return `https://${domain}`;
}

function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
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

function handleImageUpload(file) {
  if (!file) return;

  // Display image name in chat
  const chatBox = document.getElementById("chat-box");
  const imageNameDisplay = document.createElement("div");
  imageNameDisplay.className = "file-name-display";
  imageNameDisplay.innerHTML = `<strong>Mentorae:</strong> Processing image: ${file.name}`;
  chatBox.appendChild(imageNameDisplay);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Display processing message
  const processingMessage = document.createElement("div");
  processingMessage.className = "ai-message";
  processingMessage.innerHTML = `<strong>Mentorae:</strong> Analyzing image content...`;
  chatBox.appendChild(processingMessage);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Show image processing indicator
  document.getElementById("image-processing-indicator").classList.remove("hidden");

  // Create FormData and send to backend
  const formData = new FormData();
  formData.append("image", file);
  
  // Get current user input as query context
  const userQuery = document.getElementById("user-input").value.trim();
  if (userQuery) {
    formData.append("query", userQuery);
  }

  fetch("/process-image", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      // Hide processing indicator
      document.getElementById("image-processing-indicator").classList.add("hidden");

      const chatBox = document.getElementById("chat-box");
      
      if (data.success) {
        // Display image analysis
        const analysisMessage = document.createElement("div");
        analysisMessage.className = "ai-message";
        analysisMessage.innerHTML = `<strong>Mentorae:</strong> ${data.analysis}`;
        chatBox.appendChild(analysisMessage);
        
        // If there's extracted text and it's not an error message, show it
        if (data.image_data.extracted_text && 
            !data.image_data.extracted_text.includes("OCR failed") && 
            !data.image_data.extracted_text.includes("tesseract is not installed")) {
          const textMessage = document.createElement("div");
          textMessage.className = "ai-message";
          textMessage.innerHTML = `<strong>Mentorae:</strong> Extracted text from image: "${data.image_data.extracted_text}"`;
          chatBox.appendChild(textMessage);
        }
        
        // Add a prompt for asking questions about the image
        const questionPrompt = document.createElement("div");
        questionPrompt.className = "ai-message";
        questionPrompt.innerHTML = `<strong>Mentorae:</strong> You can now ask me specific questions about this image. Type your question in the input field below and click "Ask Tutor".`;
        chatBox.appendChild(questionPrompt);
        
        // Store image data for future queries
        window.currentImageData = data.image_data;
        window.currentImageAnalysis = data.analysis;
        
        showToast("✅ Image processed successfully!", "success");
      } else {
        const errorMessage = document.createElement("div");
        errorMessage.className = "ai-message error";
        errorMessage.innerHTML = `<strong>Mentorae:</strong> ❌ ${data.message || "Failed to process image"}`;
        chatBox.appendChild(errorMessage);
        showToast("❌ Image processing failed", "error");
      }

      chatBox.scrollTop = chatBox.scrollHeight;
    })
    .catch((error) => {
      // Hide processing indicator
      document.getElementById("image-processing-indicator").classList.add("hidden");

      console.error("Image processing error:", error);

      const chatBox = document.getElementById("chat-box");
      const errorMessage = document.createElement("div");
      errorMessage.className = "ai-message error";
      errorMessage.innerHTML = `<strong>Mentorae:</strong> ❌ Error processing image. ${error.message || ''}`;
      chatBox.appendChild(errorMessage);
      chatBox.scrollTop = chatBox.scrollHeight;

      showToast("❌ Image processing error", "error");
    });
}

// Function to handle Claude-style scraped info toggle
function toggleClaudeScrapedInfo(headerElement) {
  const container = headerElement.closest(".claude-scraped-container");
  const content = container.querySelector(".claude-scraped-content");
  const toggle = headerElement.querySelector(".claude-scraped-toggle i");

  if (content.classList.contains("expanded")) {
    content.classList.remove("expanded");
    content.classList.add("collapsed");
    toggle.classList.remove("fa-chevron-up");
    toggle.classList.add("fa-chevron-down");
    container.classList.add("collapsed");
  } else {
    content.classList.remove("collapsed");
    content.classList.add("expanded");
    toggle.classList.remove("fa-chevron-down");
    toggle.classList.add("fa-chevron-up");
    container.classList.remove("collapsed");
  }
}

// Add event listeners for Claude-style scraped info
function addClaudeScrapedEventListeners() {
  // Add click listeners to all Claude scraped headers
  document.addEventListener("click", function (e) {
    if (e.target.closest(".claude-scraped-header")) {
      const header = e.target.closest(".claude-scraped-header");
      toggleClaudeScrapedInfo(header);
    }
  });
}

// Welcome message on page load
window.onload = function () {
  // Add event listeners for Claude-style components
  addClaudeScrapedEventListeners();

  setTimeout(() => {
    const chatBox = document.getElementById("chat-box");
    const welcomeMessage = document.createElement("div");
    welcomeMessage.className = "ai-message";
    const welcomeText =
      "Hello! I'm Mentorae your AI Tutor. You can ask me questions directly, or upload PDF documents using the buttons below to get document-specific answers. How can I help you today?";
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
};

// Enhanced function to display modern scraped info (for regular RAG responses)
function createModernScrapedInfo(scrapedData) {
  const lines = scrapedData.split("\n");
  let content = "";
  let sources = [];
  let currentContent = "";

  lines.forEach((line) => {
    line = line.trim();
    if (!line) return;

    // Check for source patterns
    const sourceMatch = line.match(/^\[(\d+)\]\s+(.+?)(?:\s+\(([^)]+)\))?:?$/);
    if (sourceMatch) {
      if (currentContent) {
        content += currentContent + "\n";
        currentContent = "";
      }

      const [, number, title, domain] = sourceMatch;
      sources.push({
        number: parseInt(number),
        title: title,
        domain: domain || extractDomainFromTitle(title),
        url: constructUrlFromSource(title, domain),
      });
    }
    // Check for direct URLs
    else if (line.includes("http")) {
      const urlMatch = line.match(/^\[(\d+)\]\s+(.+)/);
      if (urlMatch) {
        const [, number, url] = urlMatch;
        const existingSource = sources.find(
          (s) => s.number === parseInt(number)
        );
        if (existingSource) {
          existingSource.url = url;
        } else {
          sources.push({
            number: parseInt(number),
            title: extractDomainFromUrl(url),
            domain: extractDomainFromUrl(url),
            url: url,
          });
        }
      }
    }
    // Skip "Sources:" header
    else if (line !== "Sources:") {
      currentContent += line + " ";
    }
  });

  if (currentContent) {
    content += currentContent;
  }

  return `
        <div class="modern-scraped-container">
            <div class="modern-scraped-header" onclick="toggleModernScrapedInfo(this)">
                <div class="scraped-header-content">
                    <div class="scraped-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                            <path d="21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </div>
                    <span class="scraped-title">Search Results</span>
                    ${
                      sources.length > 0
                        ? `<div class="scraped-count">${sources.length} sources</div>`
                        : ""
                    }
                </div>
                <div class="scraped-toggle">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polyline points="6,9 12,15 18,9" stroke="currentColor" stroke-width="2" fill="none"/>
                    </svg>
                </div>
            </div>
            
            <div class="modern-scraped-content">
                ${
                  content
                    ? `
                <div class="scraped-summary">
                    <div class="summary-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5" stroke="currentColor" stroke-width="2" fill="none"/>
                            <circle cx="12" cy="5" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
                        </svg>
                        Content Summary
                    </div>
                    <div class="summary-text">${content.trim()}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  sources.length > 0
                    ? `
                <div class="scraped-sources">
                    <div class="sources-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        Referenced Sources
                    </div>
                    <div class="sources-list">
                        ${sources
                          .map((source) => createSourceItem(source))
                          .join("")}
                    </div>
                </div>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

function createSourceItem(source) {
  const favicon = `https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`;
  const domainIcon = getDomainSpecificIcon(source.domain);

  return `
        <div class="source-item" onclick="openCitationLink('${
          source.url
        }', '${escapeHtml(source.title)}')">
            <div class="source-number">${source.number}</div>
            <div class="source-favicon">
                <img src="${favicon}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="fallback-icon" style="display: none;">
                    <i class="${domainIcon}"></i>
                </div>
            </div>
            <div class="source-content">
                <div class="source-title">${truncateText(
                  source.title,
                  60
                )}</div>
                <div class="source-domain">${source.domain}</div>
            </div>
            <div class="source-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 17L17 7" stroke="currentColor" stroke-width="2"/>
                    <path d="M7 7h10v10" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>
        </div>
    `;
}

// Utility functions
function getDomainSpecificIcon(domain) {
  if (domain.includes("youtube")) return "fab fa-youtube";
  if (domain.includes("wikipedia")) return "fab fa-wikipedia-w";
  if (domain.includes("github")) return "fab fa-github";
  if (domain.includes("stackoverflow")) return "fab fa-stack-overflow";
  if (domain.includes("medium")) return "fab fa-medium";
  if (domain.includes("reddit")) return "fab fa-reddit";
  if (domain.includes("twitter")) return "fab fa-twitter";
  if (domain.includes("linkedin")) return "fab fa-linkedin";
  if (domain.includes("freecodecamp")) return "fas fa-graduation-cap";
  if (domain.includes("geeksforgeeks")) return "fas fa-code";
  if (domain.includes("w3schools")) return "fas fa-code";
  if (domain.includes("mdn") || domain.includes("mozilla"))
    return "fab fa-firefox";
  return "fas fa-globe";
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function extractDomainFromTitle(title) {
  // Extract domain from title if it contains URL-like patterns
  const urlMatch = title.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
  return urlMatch ? urlMatch[1] : title;
}

function constructUrlFromSource(title, domain) {
  if (title.includes("http")) return title;
  if (domain && domain.includes("http")) return domain;
  return domain
    ? `https://${domain}`
    : `https://www.google.com/search?q=${encodeURIComponent(title)}`;
}

function extractDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url.replace(/https?:\/\//, "").split("/")[0];
  }
}

// Event handlers
function openCitationLink(url, title) {
  window.open(url, "_blank");
  showToast(`Opening: ${title}`, "info");
}

function copyCitationText(number, title, url) {
  const citation = `[${number}] ${title} - ${url}`;

  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(citation)
      .then(() => {
        showToast("Citation copied to clipboard!", "success");
      })
      .catch(() => {
        fallbackCopyText(citation);
      });
  } else {
    fallbackCopyText(citation);
  }
}

function toggleModernScrapedInfo(headerElement) {
  const container = headerElement.closest(".modern-scraped-container");
  const content = container.querySelector(".modern-scraped-content");
  const toggle = headerElement.querySelector(".scraped-toggle svg");

  if (container.classList.contains("expanded")) {
    container.classList.remove("expanded");
    content.style.maxHeight = "0";
    toggle.style.transform = "rotate(0deg)";
  } else {
    container.classList.add("expanded");
    content.style.maxHeight = content.scrollHeight + "px";
    toggle.style.transform = "rotate(180deg)";
  }
}
