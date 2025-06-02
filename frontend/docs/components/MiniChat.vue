<script lang="ts" setup>
// Types
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

type Role = "user" | "assistant" | "system";

interface Message {
  role: Role;
  content: string;
  timestamp?: number;
}

// Imports
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { marked } from "marked";
import { useData } from "vitepress";

// Component state
const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const isInitialLoading = ref(false);
const clientSideTheme = ref(false);
const isClient = ref(false);
const isEndingChat = ref(false);
const showFeedbackModal = ref(false);
const feedback = ref<"good" | "bad" | null>(null);
const threadId = ref<string | null>(null);
const isChatOpen = ref(false);
const userInput = ref("");

// Computed properties
const hasOngoingThread = computed(() => !!threadId.value);

// Message sending function
// See streaming implementation below

// Witty messages for chat endings
const wittyMessages = [
  "Chat session has ended. Ask me anything to start a new conversation!",
  "Ready for a fresh start! Ask away!",
  "Previous chat ended. What's on your mind?",
  "Clean slate! What would you like to discuss?",
];

const getRandomWittyMessage = () => {
  return wittyMessages[Math.floor(Math.random() * wittyMessages.length)];
};

// Storage event handler for cross-component synchronization
const handleStorageChange = (event: StorageEvent) => {
  if (!isClient.value) return;

  // Handle mini chat state
  if (event.key === "miniChatOpen") {
    isChatOpen.value = event.newValue === "true";
  }

  // Handle chat interaction state
  if (event.key === "chatMessages") {
    try {
      const newMessages = JSON.parse(event.newValue || "[]");
      if (Array.isArray(newMessages)) {
        // Check if there are any new user messages
        const hasNewUserMessages = newMessages.some(
          (msg: Message) =>
            msg.role === "user" &&
            !messages.value.some(
              existingMsg =>
                existingMsg.role === msg.role &&
                existingMsg.content === msg.content &&
                existingMsg.timestamp === msg.timestamp,
            ),
        );
        if (hasNewUserMessages) {
          isChatOpen.value = true;
          localStorage.setItem("miniChatOpen", "true");
        }
        messages.value = newMessages;
      }
    } catch (error) {
      console.error("Error parsing chat messages from storage:", error);
    }
  }

  // Handle chat interaction flag
  if (event.key === "hadChatInteraction") {
    if (event.newValue === "true") {
      isChatOpen.value = true;
      localStorage.setItem("miniChatOpen", "true");
    }
  }

  // Sync thread ID
  if (event.key === "threadId") {
    threadId.value = event.newValue;
    if (!event.newValue) {
      // Thread was ended in another component
      messages.value = [
        {
          role: "assistant",
          content: getRandomWittyMessage(),
          timestamp: Date.now(),
        },
      ];
    }
  }

  // Sync messages
  if (event.key === "chatMessages" && event.newValue) {
    try {
      const newMessages = JSON.parse(event.newValue);
      if (Array.isArray(newMessages)) {
        messages.value = newMessages;
      }
    } catch (error) {
      console.error("Error parsing chat messages from storage:", error);
    }
  }
};

// Function to save messages to localStorage
const saveMessagesToStorage = () => {
  if (!isClient.value) return;
  localStorage.setItem("chatMessages", JSON.stringify(messages.value));
};

// Watch messages for changes to sync to storage
watch(messages, saveMessagesToStorage, { deep: true });

onMounted(() => {
  isClient.value = true;
  clientSideTheme.value =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("vitepress-theme-appearance") === "dark";

  // Load existing thread and messages
  threadId.value = typeof localStorage !== "undefined" ? localStorage.getItem("threadId") : null;
  const storedMessages =
    typeof localStorage !== "undefined" ? localStorage.getItem("chatMessages") : null;
  if (storedMessages) {
    try {
      messages.value = JSON.parse(storedMessages);
    } catch (error) {
      console.error("Error parsing stored messages:", error);
    }
  }

  // Add storage event listener
  window.addEventListener("storage", handleStorageChange);
});

onUnmounted(() => {
  window.removeEventListener("storage", handleStorageChange);
});

// --- DOM Refs ---
const inputRef = ref<HTMLTextAreaElement | null>(null);
const chatContainerRef = ref<HTMLDivElement | null>(null);

// --- Message Input Handling ---
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (userInput.value.trim()) {
      sendMessage();
    }
  }
};

// Auto-resize textarea as content grows
const resizeTextarea = () => {
  const textarea = document.querySelector("textarea");
  if (textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }
};

// Watch for input changes to auto-resize
watch(userInput, () => {
  nextTick(resizeTextarea);
});

// --- Theme ---
const { isDark } = useData();
const cssVars = computed(() => ({
  "--scrollbar-thumb": clientSideTheme.value && isDark.value ? "#4a5568" : "#cbd5e0",
  "--scrollbar-thumb-hover": clientSideTheme.value && isDark.value ? "#2d3748" : "#a0aec0",
  "--scrollbar-track": clientSideTheme.value && isDark.value ? "#1a202c" : "#edf2f7",
  "--code-bg-color":
    clientSideTheme.value && isDark.value ? "rgba(0, 0, 0, 0.2)" : "rgba(0, 0, 0, 0.05)",
  "--link-color": clientSideTheme.value && isDark.value ? "#90cdf4" : "#3182ce",
  "--blockquote-border-color": clientSideTheme.value && isDark.value ? "#4a5568" : "#cbd5e0",
}));

// --- Utility Functions ---
const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const parseMarkdown = (content: string): string | Promise<string> => marked.parse(content);

const scrollToBottom = async (): Promise<void> => {
  await nextTick();
  if (!chatContainerRef.value) return;
  chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
};

// --- Message Handling ---
const sendMessage = async (): Promise<void> => {
  if (!userInput.value.trim()) return;

  // Store user message and mark interaction
  const userMessage = {
    role: "user" as Role,
    content: userInput.value,
    timestamp: Date.now(),
  };

  messages.value.push(userMessage);
  if (isClient.value) {
    localStorage.setItem("hadChatInteraction", "true");
  }
  let currentAssistantContent = "";
  let assistantMessageAdded = false;
  loading.value = true;

  try {
    const requestBody = {
      stream: true,
      rawResponse: true,
      messages: [{ role: "user", content: userInput.value }],
      threadId: threadId.value,
    };

    const response = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
    if (!response.body) throw new Error("No response body");

    const threadIdHeader = response.headers.get("lb-thread-id");
    if (threadIdHeader && isClient.value) {
      localStorage.setItem("threadId", threadIdHeader);
      threadId.value = threadIdHeader;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const delta = parsed.choices[0]?.delta;
          if (delta?.content) {
            if (!assistantMessageAdded) {
              messages.value.push({
                role: "assistant",
                content: "",
                timestamp: Date.now(),
              });
              assistantMessageAdded = true;
            }
            currentAssistantContent += delta.content;
            messages.value[messages.value.length - 1].content = currentAssistantContent;
            messages.value = [...messages.value];
            await scrollToBottom();
          }
        } catch (error) {
          console.error("Error parsing line:", line, error);
        }
      }
    }
  } catch (error) {
    console.error("Error during streaming:", error);
    if (!assistantMessageAdded) {
      messages.value.push({
        role: "assistant",
        content: getRandomWittyMessage(),
        timestamp: Date.now(),
      });
    }
    messages.value = [...messages.value];
    await scrollToBottom();
  } finally {
    loading.value = false;
    userInput.value = "";
    if (inputRef.value) {
      inputRef.value.style.height = "auto";
    }
    inputRef.value?.focus();
    await scrollToBottom();
  }
};

// --- End Chat & Feedback Modal ---
const endChat = async () => {
  if (!threadId.value) return;
  isEndingChat.value = true;

  try {
    const response = await fetch("http://localhost:3000/thread/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        threadId: threadId.value,
        feedback: feedback.value,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to end chat");
    }

    threadId.value = null;
    feedback.value = null;
    localStorage.removeItem("threadId");
    showFeedbackModal.value = false;

    messages.value = [
      {
        role: "assistant",
        content: getRandomWittyMessage(),
        timestamp: Date.now(),
      },
    ];
  } catch (error) {
    console.error("Error ending chat:", error);
  } finally {
    isEndingChat.value = false;
  }
};

const submitFeedback = async (): Promise<void> => {
  if (!feedback.value || isEndingChat.value) return;
  isEndingChat.value = true;
  try {
    if (!threadId.value) return;
    const response = await fetch("http://localhost:3000/thread/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: threadId.value,
        feedback: feedback.value,
      }),
    });
    if (!response.ok) throw new Error("Failed to end chat");
    localStorage.removeItem("threadId");
    threadId.value = null;
    messages.value.push({
      role: "assistant",
      content: "Chat session has ended. Ask me anything to start a new conversation!",
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error ending chat:", error);
    messages.value.push({
      role: "assistant",
      content: "Failed to end chat session. Please try again.",
      timestamp: Date.now(),
    });
  } finally {
    isEndingChat.value = false;
    showFeedbackModal.value = false;
    feedback.value = null;
  }
};

const closeFeedbackModal = (): void => {
  showFeedbackModal.value = false;
  feedback.value = null;
};

const toggleChat = () => {
  isChatOpen.value = !isChatOpen.value;
  if (isClient.value) {
    localStorage.setItem("miniChatOpen", isChatOpen.value.toString());
  }
  if (isChatOpen.value) {
    nextTick(() => {
      const textarea = document.querySelector("textarea");
      if (textarea) {
        textarea.focus();
      }
    });
  }
};

// --- Initial Load ---
onMounted(async () => {
  isClient.value = true;
  clientSideTheme.value = true; // Initialize from localStorage if available
  if (typeof localStorage !== "undefined") {
    threadId.value = localStorage.getItem("threadId"); // Handle chat window state
    const hadInteraction = localStorage.getItem("hadChatInteraction") === "true";
    const lastMiniChatState = localStorage.getItem("miniChatOpen");

    // Only use hadInteraction to determine initial state
    if (hadInteraction) {
      // If there was interaction in the main chat, open mini chat
      isChatOpen.value = true;
      localStorage.setItem("miniChatOpen", "true");
      // Reset the interaction flag
      localStorage.removeItem("hadChatInteraction");
    } else if (lastMiniChatState !== null) {
      // Otherwise respect the last mini chat state
      isChatOpen.value = lastMiniChatState === "true";
    }
  }

  if (messages.value.length === 0) {
    messages.value = [
      {
        role: "assistant",
        content: "Hi! What would you like to learn about Steve today?",
        timestamp: Date.now(),
      },
    ];
  }

  if (isClient.value && threadId.value) {
    isInitialLoading.value = true;
    try {
      const response = await fetch(
        `http://localhost:3000/thread/listMessages?threadId=${threadId.value}`,
      );
      const messagesData = await response.json();
      if (messagesData && Array.isArray(messagesData)) {
        messages.value = messagesData.map((msg: Message) => ({
          role: msg.role,
          content: msg.content ? msg.content : "",
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      console.error("Error fetching thread messages:", error);
    } finally {
      isInitialLoading.value = false;
    }
  }
});
</script>

<template>
  <div v-if="isClient" class="!fixed !bottom-4 !right-4 !z-50">
    <!-- Chat Toggle Button -->
    <button
      v-if="!isChatOpen"
      class="!w-14 !h-14 !rounded-full !bg-indigo-600 !text-white !shadow-lg !flex !items-center !justify-center !transition-all hover:!bg-indigo-700"
      @click="toggleChat"
    >
      <img src="/advocado.webp" alt="Advocado" class="!w-8 !h-8 !rounded-full" />
    </button>
    <!-- Mini Chat Window -->
    <div
      v-else
      :style="cssVars"
      :class="[
        '!rounded-lg !shadow-xl !transition-all !w-[calc(100vw-2rem)] sm:!w-96 !max-w-[24rem] !bg-white dark:!bg-gray-900',
        '!border dark:!border-gray-700 !flex !flex-col',
      ]"
    >
      <!-- Header -->
      <div
        :class="[
          '!p-3 !flex !items-center !justify-between !border-b',
          clientSideTheme && isDark ? '!border-gray-700' : '!border-gray-200',
        ]"
      >
        <div class="!flex !items-center !gap-2">
          <div class="!h-2 !w-2 !rounded-full !bg-green-500"></div>
          <h3
            :class="[
              '!text-sm !font-medium',
              clientSideTheme && isDark ? '!text-gray-100' : '!text-gray-800',
            ]"
          >
            Chat with Advocado 🥑
          </h3>
        </div>
        <div class="!flex !items-center !gap-2">
          <button
            v-if="hasOngoingThread"
            :disabled="isEndingChat || isInitialLoading"
            :class="[
              '!px-2 !py-1 !rounded !text-xs !transition-colors',
              '!bg-indigo-600 !text-white hover:!bg-indigo-700',
              (isEndingChat || isInitialLoading) && '!opacity-50 !cursor-not-allowed',
            ]"
            @click="endChat"
          >
            {{ isEndingChat ? "Ending..." : "End" }}
          </button>
          <button
            :class="[
              '!p-1 !rounded hover:!bg-gray-100 dark:hover:!bg-gray-800',
              clientSideTheme && isDark ? '!text-gray-300' : '!text-gray-600',
            ]"
            @click="toggleChat"
          >
            <svg class="!w-4 !h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Messages Area -->
      <div ref="chatContainerRef" class="!flex-1 !overflow-y-auto !p-3 !space-y-3 !max-h-96">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="!flex !w-full"
          :class="[msg.role === 'user' ? '!justify-end' : '!justify-start']"
        >
          <div
            v-if="msg.content.trim()"
            :class="[
              '!rounded-lg !px-3 !py-2 !max-w-[85%] !text-sm',
              msg.role === 'user'
                ? '!bg-indigo-600 !text-white'
                : clientSideTheme && isDark
                  ? '!bg-gray-800 !text-gray-100'
                  : '!bg-gray-100 !text-gray-800',
            ]"
          >
            <div class="!flex !justify-between !items-center !mb-1">
              <span
                :class="[
                  '!text-xs',
                  msg.role === 'user'
                    ? '!text-gray-200'
                    : clientSideTheme && isDark
                      ? '!text-gray-400'
                      : '!text-gray-500',
                ]"
                >{{ msg.role === "user" ? "You" : "Advocado" }}</span
              >
              <span
                v-if="msg.timestamp"
                :class="[
                  '!text-xs !ml-4',
                  msg.role === 'user'
                    ? '!text-gray-200'
                    : clientSideTheme && isDark
                      ? '!text-gray-400'
                      : '!text-gray-500',
                ]"
                >{{ formatTime(msg.timestamp) }}</span
              >
            </div>
            <!-- eslint-disable vue/no-v-html -->
            <div
              class="!whitespace-pre-wrap markdown-content"
              v-html="parseMarkdown(msg.content)"
            ></div>
            <!-- eslint-enable -->
          </div>
        </div>

        <!-- Loading Indicator -->
        <div v-if="loading" class="!flex !justify-start !w-full">
          <div
            :class="[
              '!rounded-lg !px-3 !py-2 !max-w-[85%] !text-sm',
              clientSideTheme && isDark
                ? '!bg-gray-800 !text-gray-300'
                : '!bg-gray-100 !text-gray-600',
            ]"
          >
            <div class="!flex !items-center !gap-1">
              <span
                v-for="(_, i) in 3"
                :key="i"
                :class="[
                  '!inline-block !h-1.5 !w-1.5 !rounded-full !animate-pulse',
                  clientSideTheme && isDark ? '!bg-gray-400' : '!bg-gray-500',
                ]"
                :style="{ animationDelay: `${i * 0.2}s` }"
              ></span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div
        :class="[
          '!p-3 !border-t',
          clientSideTheme && isDark ? '!border-gray-700' : '!border-gray-200',
        ]"
      >
        <form class="!flex !gap-2" @submit.prevent="sendMessage">
          <textarea
            ref="inputRef"
            v-model="userInput"
            placeholder="Ask something about Steve..."
            :class="[
              '!flex-1 !rounded-lg !p-2 !text-sm !resize-none !min-h-[2.5rem] !max-h-[100px]',
              clientSideTheme && isDark
                ? '!bg-gray-800 !text-gray-100 !placeholder-gray-400'
                : '!bg-gray-100 !text-gray-800 !placeholder-gray-500',
            ]"
            :disabled="loading || isInitialLoading"
            rows="1"
            @keydown="handleKeyDown"
          ></textarea>
          <button
            type="submit"
            class="!bg-indigo-600 hover:!bg-indigo-700 !text-white !px-3 !rounded-lg !transition-colors !flex !items-center !justify-center"
            :disabled="loading || isInitialLoading"
          >
            <svg
              v-if="!loading"
              xmlns="http://www.w3.org/2000/svg"
              class="!h-4 !w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            <div
              v-else
              class="!h-4 !w-4 !border-2 !border-t-transparent !border-white !rounded-full !animate-spin"
            ></div>
          </button>
        </form>
      </div>

      <!-- Feedback Modal -->
      <div
        v-if="showFeedbackModal"
        class="!absolute !inset-0 !flex !items-center !justify-center !bg-black !bg-opacity-50 !rounded-lg"
      >
        <div
          :class="[
            '!relative !rounded-lg !p-4 !w-72 !mx-4',
            clientSideTheme && isDark ? '!bg-gray-800' : '!bg-white',
          ]"
        >
          <h3
            :class="[
              '!text-sm !font-medium !mb-3',
              clientSideTheme && isDark ? '!text-white' : '!text-gray-900',
            ]"
          >
            How was your chat experience?
          </h3>
          <div class="!flex !space-x-2 !mb-4">
            <button
              :class="[
                '!flex-1 !py-1 !px-2 !rounded !text-sm !transition-colors',
                feedback === 'good'
                  ? '!bg-green-500 !text-white'
                  : clientSideTheme && isDark
                    ? '!bg-gray-700 !text-gray-300'
                    : '!bg-gray-100 !text-gray-700',
              ]"
              @click="feedback = 'good'"
            >
              Good 👍
            </button>
            <button
              :class="[
                '!flex-1 !py-1 !px-2 !rounded !text-sm !transition-colors',
                feedback === 'bad'
                  ? '!bg-red-500 !text-white'
                  : clientSideTheme && isDark
                    ? '!bg-gray-700 !text-gray-300'
                    : '!bg-gray-100 !text-gray-700',
              ]"
              @click="feedback = 'bad'"
            >
              Bad 👎
            </button>
          </div>
          <div class="!flex !justify-end !space-x-2">
            <button
              :class="[
                '!px-3 !py-1 !rounded !text-sm !transition-colors',
                clientSideTheme && isDark
                  ? '!bg-gray-700 !text-gray-300'
                  : '!bg-gray-100 !text-gray-700',
              ]"
              @click="closeFeedbackModal"
            >
              Cancel
            </button>
            <button
              :disabled="!feedback || isEndingChat"
              :class="[
                '!px-3 !py-1 !rounded !text-sm !transition-colors',
                !feedback || isEndingChat
                  ? '!bg-gray-400 !text-white'
                  : '!bg-indigo-600 !text-white hover:!bg-indigo-700',
              ]"
              @click="submitFeedback"
            >
              {{ isEndingChat ? "Ending..." : "End Chat" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scrollbar styling */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 2px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

/* Markdown content styling */
:deep(.markdown-content) {
  line-height: 1.4 !important;
}

:deep(.markdown-content p),
:deep(.markdown-content ul),
:deep(.markdown-content ol),
:deep(.markdown-content pre),
:deep(.markdown-content blockquote) {
  margin: 0 !important;
  padding: 0 !important;
}

:deep(.markdown-content > * + *) {
  margin-top: 0.4em !important;
}

:deep(.markdown-content p + p) {
  margin-top: 0.4em !important;
}

:deep(.markdown-content li),
:deep(.markdown-content li p) {
  margin: 0 !important;
  padding: 0 !important;
}

:deep(.markdown-content ul),
:deep(.markdown-content ol) {
  margin-left: 1rem !important;
  padding: 0 !important;
}

:deep(.markdown-content ul) {
  list-style-type: disc !important;
}

:deep(.markdown-content ol) {
  list-style-type: decimal !important;
}

:deep(.markdown-content strong) {
  font-weight: bold !important;
}

:deep(.markdown-content em) {
  font-style: italic !important;
}

:deep(.markdown-content code) {
  font-family: monospace !important;
  background-color: var(--code-bg-color) !important;
  padding: 0.1rem 0.3rem !important;
  border-radius: 0.25rem !important;
}

:deep(.markdown-content pre code) {
  display: block !important;
  padding: 0.75rem !important;
  margin-bottom: 0.5rem !important;
  overflow-x: auto !important;
}

:deep(.markdown-content a) {
  color: var(--link-color) !important;
  text-decoration: underline !important;
}

:deep(.markdown-content blockquote) {
  border-left: 3px solid var(--blockquote-border-color) !important;
  padding-left: 1rem !important;
  font-style: italic !important;
  margin: 0 !important;
}
</style>
