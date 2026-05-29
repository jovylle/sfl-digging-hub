<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  getAvatarUrl,
  getDisplayName,
  getMyDigsToday,
  getProfile,
  getSessionToken,
  saveLand,
  signOut,
  unsaveLand,
  updateProfile,
  type MyLandDigToday,
  type SessionInfo,
} from "@/api/client";
import DigResultsGrid from "@/components/DigResultsGrid.vue";
import { D1G_LABEL } from "@/utils/d1gUrl";

const router = useRouter();

const session = ref<SessionInfo | null>(null);
const myDigs = ref<MyLandDigToday[]>([]);
const digsUtcDate = ref<string>("");
const loadError = ref<string | null>(null);

const nicknameInput = ref("");
const nicknameError = ref<string | null>(null);
const nicknameSaving = ref(false);
const nicknameSaved = ref(false);

const unsavingId = ref<string | null>(null);
const addLandId = ref("");
const addLandError = ref<string | null>(null);
const addLandSaving = ref(false);

async function loadProfile() {
  if (!getSessionToken()) {
    router.replace("/");
    return;
  }
  try {
    const [profile, digs] = await Promise.all([getProfile(), getMyDigsToday()]);
    session.value = profile;
    nicknameInput.value = profile.nickname ?? "";
    myDigs.value = digs.lands;
    digsUtcDate.value = digs.utcDate;
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

async function addLand() {
  const id = addLandId.value.trim();
  if (!id) {
    addLandError.value = "Land ID is required";
    return;
  }
  addLandError.value = null;
  addLandSaving.value = true;
  try {
    await saveLand(id);
    addLandId.value = "";
    const digs = await getMyDigsToday();
    myDigs.value = digs.lands;
    digsUtcDate.value = digs.utcDate;
  } catch (e) {
    addLandError.value = e instanceof Error ? e.message : "Failed to add land";
  } finally {
    addLandSaving.value = false;
  }
}

async function removeSavedLand(landId: string) {
  unsavingId.value = landId;
  try {
    await unsaveLand(landId);
    myDigs.value = myDigs.value.filter((l) => l.landId !== landId);
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
              <span class="label-text text-xs uppercase tracking-wide">Nickname</span>
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

      <div id="lands" class="card bg-base-200">
        <div class="card-body space-y-4">
          <div>
            <h2 class="card-title text-base">
              My Land Digs
              <span class="badge badge-neutral badge-sm">{{ myDigs.length }}</span>
            </h2>
            <p class="text-sm text-base-content/60 mt-1">
              Private view — today only ({{ digsUtcDate }} UTC). Sync from
              {{ D1G_LABEL }} to see your grid here. Public community feeds never show land IDs.
            </p>
          </div>

          <form class="flex gap-2" @submit.prevent="addLand">
            <input
              v-model="addLandId"
              type="text"
              inputmode="numeric"
              class="input input-bordered input-sm flex-1"
              placeholder="Add land ID (mainnet or testnet)"
            />
            <button type="submit" class="btn btn-primary btn-sm" :disabled="addLandSaving">
              <span v-if="addLandSaving" class="loading loading-spinner loading-xs" />
              {{ addLandSaving ? "" : "Add" }}
            </button>
          </form>
          <p v-if="addLandError" class="text-error text-xs">{{ addLandError }}</p>

          <p v-if="myDigs.length === 0" class="text-base-content/50 text-sm">
            Add a land ID to track today's dig privately.
          </p>

          <ul v-else class="space-y-4">
            <li
              v-for="land in myDigs"
              :key="land.landId"
              class="bg-base-100 rounded-lg p-4 space-y-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="font-semibold text-primary">Land #{{ land.landId }}</p>
                  <p class="text-xs text-base-content/50 mt-0.5">
                    <template v-if="land.snapshotId">
                      {{ land.digCount }} digs synced today
                    </template>
                    <template v-else>No dig synced yet today</template>
                  </p>
                </div>
                <button
                  class="btn btn-ghost btn-xs text-error shrink-0"
                  :disabled="unsavingId === land.landId"
                  @click="removeSavedLand(land.landId)"
                >
                  <span
                    v-if="unsavingId === land.landId"
                    class="loading loading-spinner loading-xs"
                  />
                  <span v-else>Remove</span>
                </button>
              </div>

              <DigResultsGrid
                v-if="land.digs.length"
                :digs="land.digs"
                compact
                class="w-28"
              />

              <RouterLink
                v-if="land.replayUrl"
                :to="{ name: 'dig', params: { id: land.snapshotId! } }"
                class="btn btn-secondary btn-sm"
              >
                View today's grid
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
