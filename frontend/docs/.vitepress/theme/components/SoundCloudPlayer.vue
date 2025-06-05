<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";

// Types
interface SoundCloudSound {
  title: string;
  duration: number;
  user: {
    username: string;
  };
  id: number;
}

interface SoundCloudWidget {
  bind: (event: string, callback: () => void) => void;
  getCurrentSound: (callback: (sound: SoundCloudSound | null) => void) => void;
  getCurrentSoundIndex: (callback: (index: number) => void) => void;
  getSounds: (callback: (sounds: SoundCloudSound[]) => void) => void;
  isPaused: (callback: (paused: boolean) => void) => void;
  getPosition: (callback: (position: number) => void) => void;
  getDuration: (callback: (duration: number) => void) => void;
  seekTo: (position: number) => void;
  next: () => void;
  prev: () => void;
  play: () => void;
  pause: () => void;
}

interface SoundCloudWidgetConstructor {
  (iframe: HTMLIFrameElement): SoundCloudWidget;
  Events: {
    READY: string;
    PLAY: string;
    PAUSE: string;
    FINISH: string;
    SEEK: string;
  };
}

interface SoundCloudAPI {
  Widget: SoundCloudWidgetConstructor;
}

declare global {
  interface Window {
    SC: SoundCloudAPI;
  }
}

// Props
interface Props {
  playlistUrl?: string;
}

const props = withDefaults(defineProps<Props>(), {
  playlistUrl: "https://soundcloud.com/stevanus-satria/sets/piano-covers",
});

// State
const isExpanded = ref(false);
const isPlaying = ref(false);
const isLoading = ref(true);
const currentTrack = ref(0);
const currentPosition = ref(0);
const currentDuration = ref(0);
const isClient = ref(false);

// Track info
const currentTrackTitle = ref("Loading...");
const currentTrackArtist = ref("SoundCloud");
const totalTracks = ref(0);

// DOM refs
const playerRef = ref<HTMLDivElement | null>(null);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const seekBarRef = ref<HTMLDivElement | null>(null);

// Widget instance
let widget: SoundCloudWidget | null = null;
let positionInterval: number | null = null;

// Computed
const formattedPosition = computed(() => formatTime(currentPosition.value));
const formattedDuration = computed(() => formatTime(currentDuration.value));
const progressPercentage = computed(() => {
  if (currentDuration.value === 0) return 0;
  return (currentPosition.value / currentDuration.value) * 100;
});

// Helper functions
const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const loadSoundCloudAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.SC) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load SoundCloud API"));
    document.head.appendChild(script);
  });
};

const initializeWidget = async (): Promise<void> => {
  if (!iframeRef.value) return;

  try {
    await loadSoundCloudAPI();
    widget = window.SC.Widget(iframeRef.value);

    widget.bind(window.SC.Widget.Events.READY, () => {
      console.log("SoundCloud widget ready");
      loadTrackInfo();
      startPositionTracking();
      isLoading.value = false;
    });

    widget.bind(window.SC.Widget.Events.PLAY, () => {
      console.log("Track started playing");
      isPlaying.value = true;
      startPositionTracking();
    });

    widget.bind(window.SC.Widget.Events.PAUSE, () => {
      console.log("Track paused");
      isPlaying.value = false;
      stopPositionTracking();
    });

    widget.bind(window.SC.Widget.Events.FINISH, () => {
      console.log("Track finished");
      isPlaying.value = false;
      stopPositionTracking();
      // Auto-advance to next track
      setTimeout(() => {
        nextTrack();
      }, 1000);
    });

    widget.bind(window.SC.Widget.Events.SEEK, () => {
      updatePosition();
    });

    // Add error event handler
    widget.bind("error", () => {
      console.error("SoundCloud widget error:");
      isPlaying.value = false;
      stopPositionTracking();
    });
  } catch (error) {
    console.error("Failed to initialize SoundCloud widget:", error);
    isLoading.value = false;
  }
};

const loadTrackInfo = (): void => {
  if (!widget) return;

  widget.getCurrentSound((sound: SoundCloudSound | null) => {
    if (sound) {
      currentTrackTitle.value = sound.title;
      currentTrackArtist.value = sound.user.username;
      currentDuration.value = sound.duration;
    }
  });

  widget.getCurrentSoundIndex((index: number) => {
    currentTrack.value = index;
  });

  widget.getSounds((sounds: SoundCloudSound[]) => {
    totalTracks.value = sounds.length;
  });
};

const updatePosition = (): void => {
  if (!widget) return;

  widget.getPosition((position: number) => {
    currentPosition.value = position;

    // Check if track stopped unexpectedly
    if (isPlaying.value && position > 0) {
      widget!.isPaused((paused: boolean) => {
        if (paused && isPlaying.value) {
          console.log("Track stopped unexpectedly at:", formatTime(position));
          isPlaying.value = false;
          stopPositionTracking();
        }
      });
    }
  });
};

const startPositionTracking = (): void => {
  stopPositionTracking();
  positionInterval = window.setInterval(updatePosition, 1000);
};

const stopPositionTracking = (): void => {
  if (positionInterval) {
    clearInterval(positionInterval);
    positionInterval = null;
  }
};

// Player controls
const togglePlay = (): void => {
  if (!widget) return;

  widget.isPaused((paused: boolean) => {
    console.log("Current state - paused:", paused);
    if (paused) {
      console.log("Attempting to play");
      widget!.play();
    } else {
      console.log("Attempting to pause");
      widget!.pause();
    }
  });
};

const nextTrack = (): void => {
  if (!widget) return;
  widget.next();
  setTimeout(loadTrackInfo, 100);
};

const prevTrack = (): void => {
  if (!widget) return;
  widget.prev();
  setTimeout(loadTrackInfo, 100);
};

const seek = (event: MouseEvent): void => {
  if (!widget || !seekBarRef.value) return;

  const rect = seekBarRef.value.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percentage = clickX / rect.width;
  const seekPosition = percentage * currentDuration.value;

  widget.seekTo(seekPosition);
};

const toggleExpanded = (): void => {
  isExpanded.value = !isExpanded.value;
};

// Lifecycle
onMounted(() => {
  isClient.value = true;
  nextTick(() => {
    initializeWidget();
  });
});

onUnmounted(() => {
  stopPositionTracking();
});
</script>

<template>
  <div v-if="isClient" class="sc-player">
    <!-- Hidden SoundCloud iframe with proper dimensions -->
    <iframe
      ref="iframeRef"
      :src="`https://w.soundcloud.com/player/?url=${encodeURIComponent(props.playlistUrl)}&auto_play=false&buying=false&liking=false&download=false&sharing=false&show_artwork=false&show_comments=false&show_playcount=false&show_user=false&hide_related=true&visual=false&start_track=0&single_active=false`"
      class="sc-iframe"
      width="100"
      height="100"
      allow="autoplay"
    />

    <!-- Player UI -->
    <div ref="playerRef" :class="['sc-player-container', { expanded: isExpanded }]">
      <!-- Collapsed View (just musical note icon) -->
      <div v-if="!isExpanded" class="sc-collapsed" @click="toggleExpanded">
        <div class="sc-music-note">
          <svg viewBox="0 0 24 24" fill="currentColor" class="sc-note-icon">
            <path
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
        </div>
        <div v-if="isPlaying" class="sc-playing-indicator">
          <div class="sc-wave"></div>
          <div class="sc-wave"></div>
          <div class="sc-wave"></div>
        </div>
      </div>

      <!-- Expanded View (full player) -->
      <div v-else class="sc-expanded">
        <div class="sc-header">
          <div class="sc-header-info">
            <div class="sc-title">{{ currentTrackTitle }}</div>
            <div class="sc-artist">{{ currentTrackArtist }}</div>
          </div>
          <button @click="toggleExpanded" class="sc-minimize-btn">
            <svg class="sc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
          </button>
        </div>

        <div class="sc-controls">
          <button
            @click="prevTrack"
            class="sc-nav-btn"
            :disabled="isLoading"
            title="Previous track"
          >
            <svg class="sc-icon-small" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button @click="togglePlay" class="sc-play-btn" :disabled="isLoading">
            <svg v-if="isLoading" class="sc-spinner" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                fill="none"
                opacity="0.25"
              />
              <path
                fill="currentColor"
                opacity="0.75"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <svg v-else-if="!isPlaying" class="sc-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else class="sc-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <button @click="nextTrack" class="sc-nav-btn" :disabled="isLoading" title="Next track">
            <svg class="sc-icon-small" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        <div class="sc-progress">
          <div class="sc-time">{{ formattedPosition }}</div>
          <div ref="seekBarRef" class="sc-seek-bar" @click="seek">
            <div class="sc-seek-bg">
              <div class="sc-seek-fill" :style="{ width: `${progressPercentage}%` }" />
            </div>
          </div>
          <div class="sc-time">{{ formattedDuration }}</div>
        </div>

        <div class="sc-track-counter">{{ currentTrack + 1 }} / {{ totalTracks }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sc-player {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 1000;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.sc-iframe {
  position: absolute;
  top: -200px;
  left: -200px;
  width: 100px;
  height: 100px;
  opacity: 0;
  pointer-events: none;
  border: none;
}

.sc-player-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.sc-player-container.expanded {
  width: 320px;
  height: 200px;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .sc-player-container {
    background: rgba(17, 24, 39, 0.95);
    border-color: rgba(75, 85, 99, 0.3);
    color: white;
  }
}

/* Collapsed View */
.sc-collapsed {
  width: 56px;
  height: 56px;
  background: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.sc-collapsed:hover {
  background: #4338ca;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.sc-music-note {
  width: 24px;
  height: 24px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sc-note-icon {
  width: 100%;
  height: 100%;
}

.sc-playing-indicator {
  position: absolute;
  bottom: 6px;
  right: 6px;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 10px;
}

.sc-wave {
  width: 2px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
  animation: wave 1.2s ease-in-out infinite;
}

.sc-wave:nth-child(1) {
  height: 4px;
  animation-delay: 0s;
}

.sc-wave:nth-child(2) {
  height: 10px;
  animation-delay: 0.2s;
}

.sc-wave:nth-child(3) {
  height: 6px;
  animation-delay: 0.4s;
}

@keyframes wave {
  0%,
  40%,
  100% {
    transform: scaleY(0.4);
  }

  20% {
    transform: scaleY(1);
  }
}

/* Expanded View */
.sc-expanded {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.sc-header-info {
  flex: 1;
  min-width: 0;
}

.sc-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-artist {
  font-size: 14px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-color-scheme: dark) {
  .sc-title {
    color: #f9fafb;
  }

  .sc-artist {
    color: #9ca3af;
  }
}

.sc-minimize-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 12px;
}

.sc-minimize-btn:hover {
  background: rgba(107, 114, 128, 0.1);
}

@media (prefers-color-scheme: dark) {
  .sc-minimize-btn {
    color: #9ca3af;
  }

  .sc-minimize-btn:hover {
    background: rgba(156, 163, 175, 0.1);
  }
}

.sc-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
}

.sc-nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.sc-nav-btn:hover:not(:disabled) {
  background: rgba(107, 114, 128, 0.1);
  color: #374151;
}

.sc-nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-color-scheme: dark) {
  .sc-nav-btn {
    color: #9ca3af;
  }

  .sc-nav-btn:hover:not(:disabled) {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }
}

.sc-play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #4f46e5;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}

.sc-play-btn:hover:not(:disabled) {
  background: #4338ca;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
}

.sc-play-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.sc-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sc-time {
  font-size: 12px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
  min-width: 40px;
}

@media (prefers-color-scheme: dark) {
  .sc-time {
    color: #9ca3af;
  }
}

.sc-seek-bar {
  flex: 1;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.sc-seek-bg {
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

@media (prefers-color-scheme: dark) {
  .sc-seek-bg {
    background: #374151;
  }
}

.sc-seek-fill {
  height: 100%;
  background: #4f46e5;
  border-radius: 2px;
  transition: width 0.1s linear;
}

.sc-track-counter {
  text-align: center;
  font-size: 12px;
  color: #6b7280;
}

@media (prefers-color-scheme: dark) {
  .sc-track-counter {
    color: #9ca3af;
  }
}

.sc-icon {
  width: 20px;
  height: 20px;
}

.sc-icon-small {
  width: 16px;
  height: 16px;
}

.sc-spinner {
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .sc-player {
    bottom: 16px;
    left: 16px;
  }

  .sc-player-container.expanded {
    width: calc(100vw - 32px);
    max-width: 320px;
  }
}
</style>
