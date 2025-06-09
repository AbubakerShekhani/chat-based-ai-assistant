<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { marked } from "marked";
import { useData } from "vitepress";

// --- Enhanced Types ---
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

interface ChatRequest {
  stream: boolean;
  rawResponse: boolean;
  messages: { role: string; content: string }[];
  threadId?: string;
}

// --- Constants ---
const WITTY_MESSAGES = [
  "Oh my, looks like something is wrong with Advocado 🥑. You can [read about Steve here](/about) or try again later!",
  "Oops! Advocado seems to have taken a little nap 😴. While you wait, why not [learn about Steve](/about)? Or try again in a moment!",
  "Looks like Advocado is having a bad hair day! 🌪️ Try again soon, or [check out Steve's profile](/about)!",
  "Advocado is feeling a bit under the weather today 🤒. Please try again later, or [read about Steve](/about)!",
  "Advocado is currently doing some avocado yoga to recover 🧘‍♂️. [Browse Steve's info](/about) or try again in a bit!",
  "Looks like Advocado spilled its guacamole! 🥑💦 While we clean up, [learn about Steve](/about) or try again later!",
  "Advocado is currently on a quick coffee break ☕. [Read Steve's story](/about) or try again in a moment!",
  "Looks like Advocado is having a moment... 🤔 Try again soon, or [discover more about Steve](/about)!",
  "Advocado is practicing its avocado meditation 🧘‍♀️. Please try again later, or [explore Steve's background](/about)!",
  "Looks like Advocado is doing some emergency guac maintenance! 🛠️ [Check out Steve's profile](/about) or try again in a bit!",
] satisfies string[];

const PROMPT_SUGGESTIONS = [
  "Tell me about Steve's background",
  "What are Steve's top skills?",
  "Summarize Steve's work experience",
  "Show me Steve's recent projects",
  "How can I contact Steve?",
] as const;

const API_BASE = "https://advocado-agent.vercel.app";

// --- State ---
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

// --- New state for compact mode ---
const isCompactMode = ref(true); // Start in compact mode
const hasStartedChat = ref(false); // Track if user has started chatting

// --- DOM Refs ---
const inputRef = ref<HTMLTextAreaElement | null>(null);
const chatContainerRef = ref<HTMLDivElement | null>(null);

// --- Theme & Computed ---
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

const hasOngoingThread = computed(() => !!threadId.value);

// --- Utility Functions ---
const getRandomWittyMessage = (): string =>
  WITTY_MESSAGES[Math.floor(Math.random() * WITTY_MESSAGES.length)];

const formatTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const parseMarkdown = (content: string): string | Promise<string> => marked.parse(content);

const scrollToBottom = async (): Promise<void> => {
  await nextTick();
  if (!chatContainerRef.value) return;

  requestAnimationFrame(() => {
    if (!chatContainerRef.value) return;
    const isAtBottom =
      chatContainerRef.value.scrollHeight - chatContainerRef.value.scrollTop <=
      chatContainerRef.value.clientHeight + 50;

    if (!isAtBottom) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
};

const resizeTextarea = (): void => {
  if (!inputRef.value) return;
  inputRef.value.style.height = "auto";
  const newHeight = Math.min(inputRef.value.scrollHeight, 100);
  inputRef.value.style.height = `${newHeight}px`;
};

// --- Expand chat to full mode ---
const expandToFullMode = async (): Promise<void> => {
  isCompactMode.value = false;
  hasStartedChat.value = true;

  await nextTick();
  scrollToBottom();
};

// --- Storage Functions ---
const isWittyMessage = (msg: ChatMessage, index: number): boolean => {
  // Check if this is a witty error message (exact match)
  if (msg.role === "assistant" && WITTY_MESSAGES.includes(msg.content as string)) {
    return true;
  }

  // Check if this user message is followed by a witty response (exact match)
  if (msg.role === "user" && index < messages.value.length - 1) {
    const nextMessage = messages.value[index + 1];
    return (
      nextMessage.role === "assistant" && WITTY_MESSAGES.includes(nextMessage.content as string)
    );
  }

  return false;
};

const saveMessagesToStorage = (): void => {
  if (!isClient.value) return;
  const messagesToSave = messages.value.filter((msg, index) => !isWittyMessage(msg, index));
  localStorage.setItem("chatMessages", JSON.stringify(messagesToSave));
};

// --- Event Handlers ---
const handleKeyDown = (e: KeyboardEvent): void => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (userInput.value.trim()) sendMessage();
  }
};

const handleStorageChange = (event: StorageEvent): void => {
  if (!isClient.value) return;

  switch (event.key) {
    case "miniChatOpen":
      isChatOpen.value = event.newValue === "true";
      break;
    case "chatMessages":
      try {
        const newMessages = JSON.parse(event.newValue || "[]");
        if (Array.isArray(newMessages)) {
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

          // Sync compact mode state based on messages
          if (newMessages.length > 0) {
            isCompactMode.value = false;
            hasStartedChat.value = true;
          } else {
            isCompactMode.value = true;
            hasStartedChat.value = false;
          }
        }
      } catch (error) {
        console.error("Error parsing chat messages from storage:", error);
        // On error, reset to safe state
        messages.value = [];
        isCompactMode.value = true;
        hasStartedChat.value = false;
      }
      break;
    case "hadChatInteraction":
      if (event.newValue === "true") {
        isChatOpen.value = true;
        localStorage.setItem("miniChatOpen", "true");
      }
      break;
    case "chatEnding":
      if (event.newValue === "true" && showFeedbackModal.value) {
        showFeedbackModal.value = false;
        feedback.value = null;
      }
      break;
    case "threadId":
      threadId.value = event.newValue;
      if (!event.newValue) {
        messages.value = [];
        isCompactMode.value = true;
        hasStartedChat.value = false;
        localStorage.removeItem("chatEnding");
      }
      break;
  }
};

// --- API Functions ---
const sendMessage = async (): Promise<void> => {
  if (!userInput.value.trim()) return;

  const isFirstMessage = messages.value.length === 0;

  const userMessage: ChatMessage = {
    role: "user",
    content: userInput.value,
    timestamp: Date.now(),
  };

  messages.value.push(userMessage);

  if (isFirstMessage) {
    await expandToFullMode();
  }

  if (isClient.value) localStorage.setItem("hadChatInteraction", "true");

  let currentAssistantContent = "";
  let assistantMessageAdded = false;
  loading.value = true;

  const originalInput = userInput.value;
  userInput.value = "";

  try {
    const requestBody: ChatRequest = {
      stream: true,
      rawResponse: true,
      messages: [{ role: "user", content: originalInput }],
    };

    if (threadId.value) requestBody.threadId = threadId.value;

    const response = await fetch(`${API_BASE}/chat`, {
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
              messages.value.push({ role: "assistant", content: "", timestamp: Date.now() });
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
    } else if (currentAssistantContent.trim() === "") {
      messages.value[messages.value.length - 1].content = getRandomWittyMessage();
    }

    messages.value = [...messages.value];
    await scrollToBottom();
  } finally {
    loading.value = false;
    if (inputRef.value) inputRef.value.style.height = "auto";
    inputRef.value?.focus();
    await scrollToBottom();
  }
};

const endChat = (): void => {
  if (isEndingChat.value || showFeedbackModal.value || !threadId.value) return;
  showFeedbackModal.value = true;
  feedback.value = null;
  if (isClient.value) localStorage.setItem("chatEnding", "true");
};

const submitFeedback = async (): Promise<void> => {
  if (!feedback.value || isEndingChat.value || !threadId.value) return;

  isEndingChat.value = true;
  try {
    const response = await fetch(`${API_BASE}/thread/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: threadId.value, feedback: feedback.value }),
    });

    if (!response.ok) throw new Error("Failed to end chat");

    localStorage.removeItem("threadId");
    localStorage.removeItem("chatMessages");
    threadId.value = null;
    messages.value = [];
    isCompactMode.value = true;
    hasStartedChat.value = false;
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

const setSuggestion = (suggestion: string): void => {
  userInput.value = suggestion;
  inputRef.value?.focus();
};

const toggleChat = (): void => {
  isChatOpen.value = !isChatOpen.value;
  if (isClient.value) localStorage.setItem("miniChatOpen", isChatOpen.value.toString());
  if (isChatOpen.value) {
    nextTick(() => inputRef.value?.focus());
  }
};

// --- Watchers ---
watch(userInput, () => nextTick(resizeTextarea));
watch(messages, saveMessagesToStorage, { deep: true });

watch(isChatOpen, async newVal => {
  if (newVal) {
    await nextTick();
    if (!isCompactMode.value) scrollToBottom();
    nextTick(() => inputRef.value?.focus());
  }
});

watch(
  messages,
  async () => {
    if (!isClient.value) return;
    saveMessagesToStorage();
    if (isChatOpen.value && !isCompactMode.value) {
      await nextTick();
      scrollToBottom();
    }
  },
  { deep: true },
);

// --- Lifecycle ---
onMounted(async () => {
  isClient.value = true;
  clientSideTheme.value = true;

  threadId.value = localStorage.getItem("threadId");
  const storedMessages = localStorage.getItem("chatMessages");

  if (storedMessages) {
    try {
      const parsedMessages = JSON.parse(storedMessages);
      messages.value = parsedMessages;

      // If we have stored messages, we're not in compact mode
      if (parsedMessages.length > 0) {
        isCompactMode.value = false;
        hasStartedChat.value = true;
      }
    } catch (error) {
      console.error("Error parsing stored messages:", error);
      messages.value = [];
    }
  } else {
    messages.value = [];
  }

  // Initial chat state setup
  const hadInteraction = localStorage.getItem("hadChatInteraction") === "true";
  const lastMiniChatState = localStorage.getItem("miniChatOpen");

  if (hadInteraction) {
    isChatOpen.value = true;
    localStorage.setItem("miniChatOpen", "true");
    localStorage.removeItem("hadChatInteraction");
  } else if (lastMiniChatState !== null) {
    isChatOpen.value = lastMiniChatState === "true";
  }

  // Only load from backend if we have threadId but no stored messages
  if (threadId.value && !storedMessages) {
    isInitialLoading.value = true;
    try {
      const response = await fetch(`${API_BASE}/thread/listMessages?threadId=${threadId.value}`);

      if (response.ok) {
        const messagesData = await response.json();
        if (messagesData && Array.isArray(messagesData)) {
          messages.value = messagesData.map((msg: Message) => ({
            role: msg.role,
            content: msg.content || "",
            timestamp: Date.now(),
          }));
          saveMessagesToStorage();

          // If we have messages from backend, we're not in compact mode
          if (messagesData.length > 0) {
            isCompactMode.value = false;
            hasStartedChat.value = true;
          }
        } else {
          // Invalid response data - reset to fresh state
          localStorage.removeItem("threadId");
          threadId.value = null;
          messages.value = [];
          isCompactMode.value = true;
          hasStartedChat.value = false;
        }
      } else {
        // API error or thread not found - reset to fresh state
        localStorage.removeItem("threadId");
        threadId.value = null;
        messages.value = [];
        isCompactMode.value = true;
        hasStartedChat.value = false;
      }
    } catch (error) {
      console.error("Error fetching thread messages:", error);
      // Network error - reset to fresh state
      localStorage.removeItem("threadId");
      threadId.value = null;
      messages.value = [];
      isCompactMode.value = true;
      hasStartedChat.value = false;
    } finally {
      isInitialLoading.value = false;
      await nextTick();
      if (isChatOpen.value && !isCompactMode.value) scrollToBottom();
    }
  } else {
    await nextTick();
    if (isChatOpen.value && !isCompactMode.value) scrollToBottom();
  }

  window.addEventListener("storage", handleStorageChange);
});

onUnmounted(() => {
  window.removeEventListener("storage", handleStorageChange);
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
        '!rounded-2xl !shadow-2xl !transition-all !w-[calc(100vw-2rem)] sm:!w-[400px] !max-w-[400px]',
        clientSideTheme && isDark
          ? '!bg-gray-900 !border !border-gray-700'
          : '!bg-white !border !border-gray-200',
        '!flex !flex-col',
        isCompactMode ? '!h-auto' : '!max-h-[32rem]',
      ]"
    >
      <!-- Loading Overlay -->
      <div v-if="isInitialLoading" class="chat-loading-overlay">
        <div class="chat-loading-content">
          <div
            class="!h-6 !w-6 !border-4 !border-indigo-600 !border-t-transparent !rounded-full !animate-spin"
          ></div>
          <p
            :class="clientSideTheme && isDark ? '!text-gray-200' : '!text-gray-700'"
            class="!text-base"
          >
            Loading past conversations...
          </p>
        </div>
      </div>

      <!-- Compact Mode - Initial State -->
      <div v-if="isCompactMode" class="!relative !p-6 !pt-8">
        <!-- Close button -->
        <button
          :class="[
            '!absolute !top-3 !right-3 !p-1.5 !rounded-full !transition-colors',
            clientSideTheme && isDark
              ? '!text-gray-400 hover:!text-gray-200 hover:!bg-gray-700'
              : '!text-gray-500 hover:!text-gray-700 hover:!bg-gray-100',
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

        <!-- Welcome Header -->
        <div class="!text-center !mb-6">
          <div class="!flex !items-center !justify-center !mb-3">
            <div class="!h-3 !w-3 !rounded-full !bg-green-500 !mr-2"></div>
            <h3
              :class="[
                '!text-xl !font-bold',
                clientSideTheme && isDark ? '!text-white' : '!text-gray-900',
              ]"
            >
              Chat with Advocado 🥑
            </h3>
          </div>
          <p
            :class="[
              '!text-base !leading-relaxed',
              clientSideTheme && isDark ? '!text-gray-300' : '!text-gray-600',
            ]"
          >
            Hi! What would you like to learn about Steve today?
          </p>
        </div>

        <!-- Prompt Suggestions -->
        <div class="!mb-6">
          <div class="!flex !flex-col !gap-3">
            <button
              v-for="suggestion in PROMPT_SUGGESTIONS.slice(0, 3)"
              :key="suggestion"
              type="button"
              :disabled="isInitialLoading"
              :class="[
                '!w-full !px-4 !py-3 !rounded-xl !text-base !font-medium !transition-all !duration-200',
                '!border !text-left !shadow-sm',
                clientSideTheme && isDark
                  ? '!bg-gray-800 !text-gray-200 !border-gray-600 hover:!bg-gray-700 hover:!border-gray-500'
                  : '!bg-gray-50 !text-gray-700 !border-gray-200 hover:!bg-gray-100 hover:!border-gray-300',
                isInitialLoading && '!opacity-50 !cursor-not-allowed',
              ]"
              @click="setSuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
        </div>

        <!-- Input Form -->
        <form class="!flex !gap-2" @submit.prevent="sendMessage">
          <textarea
            ref="inputRef"
            v-model="userInput"
            placeholder="AMA about Steve! 🎤"
            :class="[
              '!flex-1 !rounded-lg !p-2 !text-base !resize-none !min-h-[2.5rem] !max-h-[100px] !border-0 !outline-none !focus:ring-0 !focus:ring-offset-0',
              '!overflow-y-auto',
              clientSideTheme && isDark
                ? '!bg-gray-800 !text-gray-100 !placeholder-gray-400'
                : '!bg-gray-100 !text-gray-800 !placeholder-gray-500',
              '[&::placeholder]:!text-ellipsis [&::placeholder]:!overflow-hidden [&::placeholder]:!whitespace-nowrap',
            ]"
            :disabled="loading || isInitialLoading"
            rows="1"
            @keydown="handleKeyDown"
          ></textarea>
          <button
            type="submit"
            :class="[
              '!rounded-lg !px-3 !transition-all !duration-200 !flex !items-center !justify-center !min-w-[48px]',
              userInput.trim() && !loading && !isInitialLoading
                ? '!bg-indigo-600 hover:!bg-indigo-700 !text-white'
                : clientSideTheme && isDark
                  ? '!bg-gray-700 !text-gray-400 !cursor-not-allowed'
                  : '!bg-gray-200 !text-gray-400 !cursor-not-allowed',
            ]"
            :disabled="loading || isInitialLoading || !userInput.trim()"
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
              class="!h-4 !w-4 !border-2 !border-t-transparent !border-current !rounded-full !animate-spin"
            ></div>
          </button>
        </form>
      </div>

      <!-- Full Mode - After First Message -->
      <div v-else class="!flex !flex-col !h-full">
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
                '!text-base !font-medium',
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
                '!px-2 !py-1 !rounded !text-base !transition-colors',
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
        <div ref="chatContainerRef" class="!flex-1 !overflow-y-auto !p-3 !space-y-3 !max-h-80">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            class="!flex !w-full"
            :class="[msg.role === 'user' ? '!justify-end' : '!justify-start']"
          >
            <div
              v-if="msg.content.trim()"
              :class="[
                '!rounded-lg !px-3 !py-2 !max-w-[85%] !text-base !shadow-md',
                msg.role === 'user'
                  ? '!bg-indigo-600 !text-white'
                  : clientSideTheme && isDark
                    ? '!bg-gray-800 !text-gray-100 !border !border-gray-700'
                    : '!bg-white !text-gray-800 !border !border-gray-200',
              ]"
            >
              <div class="!flex !justify-between !items-center !mb-1">
                <span
                  :class="[
                    '!text-sm',
                    msg.role === 'user'
                      ? '!text-gray-200'
                      : clientSideTheme && isDark
                        ? '!text-gray-400'
                        : '!text-gray-500',
                  ]"
                >
                  {{ msg.role === "user" ? "You" : "Advocado" }}
                </span>
                <span
                  v-if="msg.timestamp"
                  :class="[
                    '!text-sm !ml-4',
                    msg.role === 'user'
                      ? '!text-gray-200'
                      : clientSideTheme && isDark
                        ? '!text-gray-400'
                        : '!text-gray-500',
                  ]"
                >
                  {{ formatTime(msg.timestamp) }}
                </span>
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
                '!rounded-lg !px-3 !py-2 !max-w-[85%] !text-base !shadow-md',
                clientSideTheme && isDark
                  ? '!bg-gray-800 !text-gray-300 !border !border-gray-700'
                  : '!bg-white !text-gray-600 !border !border-gray-200',
              ]"
            >
              <div class="!flex !justify-between !items-center !mb-1">
                <span
                  :class="
                    clientSideTheme && isDark
                      ? '!text-sm !text-gray-400'
                      : '!text-sm !text-gray-500'
                  "
                >
                  Advocado
                </span>
                <span
                  :class="
                    clientSideTheme && isDark
                      ? '!text-sm !text-gray-400 !ml-4'
                      : '!text-sm !text-gray-500 !ml-4'
                  "
                >
                  {{ formatTime(Date.now()) }}
                </span>
              </div>
              <div class="!flex !items-center">
                <span
                  v-for="(_, i) in 3"
                  :key="i"
                  :class="[
                    '!inline-block !h-1.5 !w-1.5 !rounded-full !animate-pulse',
                    clientSideTheme && isDark ? '!bg-gray-400' : '!bg-gray-300',
                  ]"
                  :style="{
                    marginLeft: i > 0 ? '0.25rem' : 0,
                    marginRight: i < 2 ? '0.25rem' : 0,
                    animationDelay: `${i * 0.2}s`,
                  }"
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
              placeholder="AMA about Steve! 🎤"
              :class="[
                '!flex-1 !rounded-lg !p-2 !text-base !resize-none !min-h-[2.5rem] !max-h-[100px] !border-0 !outline-none !focus:ring-0 !focus:ring-offset-0',
                '!overflow-y-auto',
                clientSideTheme && isDark
                  ? '!bg-gray-800 !text-gray-100 !placeholder-gray-400'
                  : '!bg-gray-100 !text-gray-800 !placeholder-gray-500',
                '[&::placeholder]:!text-ellipsis [&::placeholder]:!overflow-hidden [&::placeholder]:!whitespace-nowrap',
              ]"
              :disabled="loading || isInitialLoading"
              rows="1"
              @keydown="handleKeyDown"
            ></textarea>
            <button
              type="submit"
              :class="[
                '!rounded-lg !px-3 !transition-all !duration-200 !flex !items-center !justify-center !min-w-[48px]',
                userInput.trim() && !loading && !isInitialLoading
                  ? '!bg-indigo-600 hover:!bg-indigo-700 !text-white'
                  : clientSideTheme && isDark
                    ? '!bg-gray-700 !text-gray-400 !cursor-not-allowed'
                    : '!bg-gray-200 !text-gray-400 !cursor-not-allowed',
              ]"
              :disabled="loading || isInitialLoading || !userInput.trim()"
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
                class="!h-4 !w-4 !border-2 !border-t-transparent !border-current !rounded-full !animate-spin"
              ></div>
            </button>
          </form>
        </div>
      </div>

      <!-- Feedback Modal -->
      <div
        v-if="showFeedbackModal"
        class="!absolute !inset-0 !flex !items-center !justify-center !bg-black !bg-opacity-50 !rounded-lg !z-50"
      >
        <div
          :class="[
            '!relative !rounded-lg !p-4 !w-72 !mx-4 !shadow-xl',
            clientSideTheme && isDark ? '!bg-gray-800 !text-white' : '!bg-white !text-gray-800',
          ]"
        >
          <h3
            :class="[
              '!text-base !font-medium !mb-3',
              clientSideTheme && isDark ? '!text-white' : '!text-gray-900',
            ]"
          >
            How was your chat experience?
          </h3>
          <div class="!flex !space-x-2 !mb-4">
            <button
              :class="[
                '!flex-1 !py-1 !px-2 !rounded !text-base !transition-colors',
                feedback === 'good'
                  ? '!bg-green-500 !text-white'
                  : clientSideTheme && isDark
                    ? '!bg-gray-700 !text-gray-300 !hover:bg-gray-600'
                    : '!bg-gray-100 !text-gray-700 !hover:bg-gray-200',
              ]"
              :disabled="isInitialLoading"
              @click="feedback = 'good'"
            >
              Good 👍
            </button>
            <button
              :class="[
                '!flex-1 !py-1 !px-2 !rounded !text-base !transition-colors',
                feedback === 'bad'
                  ? '!bg-red-500 !text-white'
                  : clientSideTheme && isDark
                    ? '!bg-gray-700 !text-gray-300 !hover:bg-gray-600'
                    : '!bg-gray-100 !text-gray-700 !hover:bg-gray-200',
              ]"
              :disabled="isInitialLoading"
              @click="feedback = 'bad'"
            >
              Bad 👎
            </button>
          </div>
          <div class="!flex !justify-end !space-x-2">
            <button
              :class="[
                '!px-3 !py-1 !rounded !text-base !transition-colors',
                clientSideTheme && isDark
                  ? '!bg-gray-700 !text-gray-300 !hover:bg-gray-600'
                  : '!bg-gray-100 !text-gray-700 !hover:bg-gray-200',
              ]"
              :disabled="isInitialLoading"
              @click="closeFeedbackModal"
            >
              Cancel
            </button>
            <button
              :disabled="!feedback || isEndingChat || isInitialLoading"
              :class="[
                '!px-3 !py-1 !rounded !text-base !transition-colors',
                !feedback || isEndingChat || isInitialLoading
                  ? '!bg-gray-400 !text-white !cursor-not-allowed'
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

.chat-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
  border-radius: 0.5rem;
}

.dark .chat-loading-overlay {
  background: rgba(30, 30, 30, 0.7);
}

.chat-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

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
