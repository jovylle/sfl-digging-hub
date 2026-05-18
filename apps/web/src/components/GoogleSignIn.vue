<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  getSession,
  getSessionToken,
  setSessionToken,
  signInWithGoogle,
  signOut,
} from "@/api/client";

const emit = defineEmits<{ signedIn: [email: string] }>();

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const email = ref<string | null>(null);
const error = ref<string | null>(null);
const ready = ref(false);

async function refreshSession() {
  if (!getSessionToken()) {
    email.value = null;
    return;
  }
  try {
    const s = await getSession();
    email.value = s.email;
    emit("signedIn", s.email);
  } catch {
    setSessionToken(null);
    email.value = null;
  }
}

function handleCredential(response: { credential: string }) {
  error.value = null;
  signInWithGoogle(response.credential)
    .then((res) => {
      setSessionToken(res.sessionToken);
      email.value = res.email;
      emit("signedIn", res.email);
    })
    .catch((e) => {
      error.value = e instanceof Error ? e.message : "Sign-in failed";
    });
}

onMounted(async () => {
  await refreshSession();
  if (!clientId) return;

  const g = (window as unknown as { google?: { accounts: { id: {
    initialize: (cfg: unknown) => void;
    renderButton: (el: HTMLElement, cfg: unknown) => void;
  } } } }).google;

  if (!g?.accounts?.id) {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => initGoogle();
    document.head.appendChild(script);
  } else {
    initGoogle();
  }
});

function initGoogle() {
  if (!clientId) return;
  const g = (window as unknown as { google: { accounts: { id: {
    initialize: (cfg: unknown) => void;
    renderButton: (el: HTMLElement, cfg: unknown) => void;
  } } } }).google;

  g.accounts.id.initialize({
    client_id: clientId,
    callback: handleCredential,
    auto_select: false,
  });

  const el = document.getElementById("google-signin-btn");
  if (el) {
    g.accounts.id.renderButton(el, {
      type: "standard",
      theme: "outline",
      size: "medium",
      text: "signin_with",
    });
  }
  ready.value = true;
}

function logout() {
  signOut();
  email.value = null;
}
</script>

<template>
  <div class="text-sm space-y-2">
    <p v-if="email" class="text-stone-400">
      Signed in as <span class="text-amber-300">{{ email }}</span>
      <button type="button" class="ml-2 underline text-stone-500" @click="logout">
        Sign out
      </button>
    </p>
    <template v-else>
      <p v-if="!clientId" class="text-stone-500 text-xs">
        Google sign-in not configured (VITE_GOOGLE_CLIENT_ID).
      </p>
      <div v-show="clientId" id="google-signin-btn" />
      <p v-if="!ready && clientId" class="text-stone-500 text-xs">Loading Google sign-in…</p>
    </template>
    <p v-if="error" class="text-red-400 text-xs">{{ error }}</p>
    <p class="text-stone-500 text-xs">
      Sign in with Google (email only) to attach comments to your account.
    </p>
  </div>
</template>
