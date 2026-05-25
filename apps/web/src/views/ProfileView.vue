<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  getAvatarUrl,
  getDisplayName,
  getProfile,
  getSavedLands,
  getSessionToken,
  signOut,
  unsaveLand,
  updateProfile,
  type SavedLand,
  type SessionInfo,
} from "@/api/client";

const router = useRouter();

const session = ref<SessionInfo | null>(null);
const savedLands = ref<SavedLand[]>([]);
const loadError = ref<string | null>(null);

const nicknameInput = ref("");
const nicknameError = ref<string | null>(null);
const nicknameSaving = ref(false);
const nicknameSaved = ref(false);

const unsavingId = ref<string | null>(null);

async function loadProfile() {
  if (!getSessionToken()) {
    router.replace("/");
    return;
  }
  try {
    const [profile, lands] = await Promise.all([getProfile(), getSavedLands()]);
    session.value = profile;
    nicknameInput.value = profile.nickname ?? "";
    savedLands.value = lands.lands;
  } catch {
    loadError.value = "Failed to load profile. Please sign in again.";
  }
}

async function saveNickname() {
  if (!session.value) return;
  nicknameError.value = null;
  nicknameSaved.value = false;
  const trimmed = nicknameInput.value.trim();
  if (trimmed.length > 30) {
    nicknameError.value = "Nickname must be 30 characters or fewer.";
    return;
  }
  nicknameSaving.value = true;
  try {
    const result = await updateProfile({ nickname: trimmed || null });
    session.value = { ...session.value, nickname: result.nickname };
    nicknameInput.value = result.nickname ?? "";
    nicknameSaved.value = true;
    setTimeout(() => (nicknameSaved.value = false), 3000);
  } catch (e) {
    nicknameError.value = e instanceof Error ? e.message : "Failed to save nickname.";
  } finally {
    nicknameSaving.value = false;
  }
}

async function removeSavedLand(landId: string) {
  unsavingId.value = landId;
  try {
    await unsaveLand(landId);
    savedLands.value = savedLands.value.filter((l) => l.landId !== landId);
  } catch {
    // silently ignore
  } finally {
    unsavingId.value = null;
  }
}

function handleSignOut() {
  signOut();
  router.replace("/");
}

onMounted(loadProfile);
</script>

<template>
  <section class="space-y-8 max-w-xl">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <img
          v-if="session"
          :src="getAvatarUrl(session.email)"
          :alt="getDisplayName(session)"
          class="w-14 h-14 rounded-full bg-base-200 border border-base-300"
        />
        <div>
          <h1 class="text-2xl font-bold text-primary">
            {{ session ? getDisplayName(session) : "Profile" }}
          </h1>
          <p v-if="session" class="text-base-content/60 text-sm mt-0.5">
            {{ session.email }}
          </p>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm text-error" @click="handleSignOut">
        Sign out
      </button>
    </div>

    <div v-if="loadError" class="alert alert-error text-sm">
      <span>{{ loadError }}</span>
    </div>

    <div v-if="!session && !loadError" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md text-primary" />
    </div>

    <template v-if="session">
      <!-- Identity -->
      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <h2 class="card-title text-base">Your identity</h2>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-base-content/70 text-xs uppercase tracking-wide">
                Email (read-only)
              </span>
            </label>
            <input
              :value="session.email"
              type="text"
              class="input input-bordered input-sm bg-base-300 cursor-default"
              readonly
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-xs uppercase tracking-wide">
                Nickname
              </span>
              <span class="label-text-alt text-base-content/50">
                shown instead of your email username
              </span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="nicknameInput"
                type="text"
                maxlength="30"
                placeholder="e.g. DesertDigger"
                class="input input-bordered input-sm flex-1"
                @keydown.enter.prevent="saveNickname"
              />
              <button
                class="btn btn-primary btn-sm"
                :disabled="nicknameSaving"
                @click="saveNickname"
              >
                <span v-if="nicknameSaving" class="loading loading-spinner loading-xs" />
                {{ nicknameSaving ? "" : "Save" }}
              </button>
            </div>
            <label v-if="nicknameError" class="label">
              <span class="label-text-alt text-error">{{ nicknameError }}</span>
            </label>
            <label v-else-if="nicknameSaved" class="label">
              <span class="label-text-alt text-success">Nickname saved!</span>
            </label>
            <label v-else class="label">
              <span class="label-text-alt text-base-content/40">
                {{ nicknameInput.trim().length }}/30
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- Saved lands -->
      <div class="card bg-base-200">
        <div class="card-body space-y-4">
          <h2 class="card-title text-base">
            Saved lands
            <span class="badge badge-neutral badge-sm">{{ savedLands.length }}</span>
          </h2>

          <p v-if="savedLands.length === 0" class="text-base-content/50 text-sm">
            No saved lands yet. Browse a land page and hit the bookmark button to save it here.
          </p>

          <ul v-else class="space-y-2">
            <li
              v-for="land in savedLands"
              :key="land.landId"
              class="flex items-center justify-between gap-3 bg-base-100 rounded-lg px-4 py-3"
            >
              <div>
                <RouterLink
                  :to="{ name: 'land', params: { landId: land.landId } }"
                  class="font-semibold text-primary link link-hover"
                >
                  Land #{{ land.landId }}
                </RouterLink>
                <p class="text-xs text-base-content/50 mt-0.5">
                  Saved {{ new Date(land.savedAt).toLocaleDateString() }}
                </p>
              </div>
              <button
                class="btn btn-ghost btn-xs text-error"
                :disabled="unsavingId === land.landId"
                @click="removeSavedLand(land.landId)"
              >
                <span
                  v-if="unsavingId === land.landId"
                  class="loading loading-spinner loading-xs"
                />
                <span v-else>Remove</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
