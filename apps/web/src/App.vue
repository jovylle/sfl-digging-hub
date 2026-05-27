<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import {
  checkEmailApproveSignIn,
  getAnonymousId,
  getAvatarUrl,
  getDisplayName,
  getSession,
  getSessionToken,
  setSessionToken,
  startEmailApproveSignIn,
  type SessionInfo,
} from "@/api/client";
import { D1G_BASE_URL, D1G_LABEL } from "@/utils/d1gUrl";

const sessionInfo = ref<SessionInfo | null>(null);
const showSignInModal = ref(false);
const signInEmail = ref("");
const signInError = ref<string | null>(null);
const signInPending = ref(false);
const signInExpiresAt = ref<string | null>(null);
const signInRequestId = ref<string | null>(null);
const signInChallengeId = ref<string | null>(null);
const signInFlowId = ref<string | null>(null);
let signInPollTimer: number | null = null;

async function loadSession() {
  if (!getSessionToken()) return;
  try {
    sessionInfo.value = await getSession();
  } catch {
    sessionInfo.value = null;
  }
}

function clearSignInPoll() {
  if (signInPollTimer !== null) {
    window.clearInterval(signInPollTimer);
    signInPollTimer = null;
  }
}

function openSignInModal() {
  signInError.value = null;
  signInPending.value = false;
  showSignInModal.value = true;
}

function closeSignInModal() {
  showSignInModal.value = false;
  signInError.value = null;
  signInPending.value = false;
  signInExpiresAt.value = null;
  signInRequestId.value = null;
  signInChallengeId.value = null;
  signInFlowId.value = null;
  clearSignInPoll();
}

async function pollApproveCheck() {
  if (!signInEmail.value || !signInRequestId.value) return;
  try {
    const result = await checkEmailApproveSignIn({
      email: signInEmail.value.trim().toLowerCase(),
      requestId: signInRequestId.value,
      challengeId: signInChallengeId.value ?? undefined,
      flowId: signInFlowId.value ?? undefined,
      anonymousId: getAnonymousId(),
    });
    if (result.status !== "approved") return;
    const token = result.token ?? result.accessToken;
    if (!token) throw new Error("Sign-in succeeded but no token was returned.");
    setSessionToken(token);
    await loadSession();
    closeSignInModal();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-in check failed.";
    if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("used")) {
      signInError.value = msg;
      signInPending.value = false;
      clearSignInPoll();
    }
  }
}

async function startSignIn() {
  const email = signInEmail.value.trim().toLowerCase();
  if (!email) {
    signInError.value = "Email is required.";
    return;
  }
  signInError.value = null;
  try {
    const started = await startEmailApproveSignIn({
      email,
      anonymousId: getAnonymousId(),
      returnUrl: window.location.href,
    });
    signInPending.value = true;
    signInRequestId.value = started.requestId;
    signInChallengeId.value = started.challengeId ?? null;
    signInFlowId.value = started.flowId ?? null;
    signInExpiresAt.value = started.expiresAt ?? null;
    clearSignInPoll();
    signInPollTimer = window.setInterval(() => {
      void pollApproveCheck();
    }, 2000);
    void pollApproveCheck();
  } catch (e) {
    signInError.value = e instanceof Error ? e.message : "Failed to start sign-in.";
  }
}

onMounted(loadSession);
onBeforeUnmount(clearSignInPoll);
</script>

<template>
  <div
    class="min-h-screen bg-base-200 bg-pattern text-base-content flex flex-col transition-colors duration-300"
  >
    <header class="navbar bg-base-100 shadow-sm sticky top-0 z-10 px-4">
      <div class="flex-1">
        <RouterLink to="/" class="btn btn-ghost text-lg font-bold px-2">
          SFL Digging Hub
        </RouterLink>
      </div>
      <nav class="flex-none gap-1">
        <RouterLink to="/community" class="btn btn-ghost btn-sm" active-class="btn-active">
          Community
        </RouterLink>
        <RouterLink
          :to="sessionInfo ? { name: 'profile', hash: '#lands' } : { name: 'profile' }"
          class="btn btn-ghost btn-sm"
          active-class="btn-active"
        >
          My Land Digs
        </RouterLink>
        <RouterLink to="/practice" class="btn btn-ghost btn-sm" active-class="btn-active">
          Practice
        </RouterLink>
        <a
          :href="D1G_BASE_URL"
          class="btn btn-ghost btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Dig on {{ D1G_LABEL }}
        </a>
        <RouterLink
          v-if="sessionInfo"
          to="/profile"
          class="btn btn-ghost btn-sm max-w-[9rem] truncate"
          active-class="btn-active"
          :title="sessionInfo.email"
        >
          <img
            :src="getAvatarUrl(sessionInfo.email)"
            :alt="getDisplayName(sessionInfo)"
            class="w-5 h-5 rounded-full shrink-0 bg-base-200"
          />
          <span class="truncate">{{ getDisplayName(sessionInfo) }}</span>
        </RouterLink>
        <button v-else type="button" class="btn btn-primary btn-sm" @click="openSignInModal">
          Sign in
        </button>
      </nav>
    </header>
    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
      <div class="bg-base-100 rounded-box shadow-md p-4 sm:p-6 min-h-[50vh]">
        <RouterView />
      </div>
    </main>
    <footer class="footer footer-center text-base-content/60 text-xs py-6">
      <aside>
        <p>Dig on {{ D1G_LABEL }} · Stories and practice scores on the hub</p>
      </aside>
    </footer>

    <div
      v-if="showSignInModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      @click.self="closeSignInModal"
    >
      <div class="w-full max-w-md rounded-box bg-base-100 shadow-xl border border-base-300 p-5">
        <div class="flex items-start justify-between gap-3">
          <h2 class="text-lg font-semibold">Sign in</h2>
          <button type="button" class="btn btn-ghost btn-xs" @click="closeSignInModal">Close</button>
        </div>

        <p class="text-sm text-base-content/70 mt-2">
          Enter your email and approve the link we send. No code needed.
        </p>

        <label class="form-control mt-4">
          <span class="label-text text-xs uppercase tracking-wide">Email</span>
          <input
            v-model="signInEmail"
            type="email"
            autocomplete="email"
            class="input input-bordered input-sm mt-1"
            placeholder="you@example.com"
            :disabled="signInPending"
            @keydown.enter.prevent="startSignIn"
          />
        </label>

        <div class="mt-4 flex items-center gap-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="signInPending"
            @click="startSignIn"
          >
            {{ signInPending ? "Waiting for approval…" : "Send approve link" }}
          </button>
          <button
            v-if="signInPending"
            type="button"
            class="btn btn-ghost btn-sm"
            @click="closeSignInModal"
          >
            Cancel
          </button>
        </div>

        <p v-if="signInPending" class="text-xs text-base-content/60 mt-2">
          Check your email and open the approve link.
          <span v-if="signInExpiresAt">Expires at {{ signInExpiresAt }}.</span>
        </p>
        <p v-if="signInError" class="text-error text-xs mt-2">{{ signInError }}</p>
      </div>
    </div>
  </div>
</template>
