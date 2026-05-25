<script setup lang="ts">
import { onMounted, ref } from "vue";
import { GOOGLE_CLIENT_ID } from "@sfl-digging-hub/shared";
import {
  getSession,
  getSessionToken,
  setSessionToken,
  signInWithGoogle,
  signOut,
} from "@/api/client";

const emit = defineEmits<{ signedIn: [email: string] }>();

const clientId = GOOGLE_CLIENT_ID;
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
    <p v-if="email" class="text-base-content/70">
      Signed in as <span class="font-medium text-primary">{{ email }}</span>
      <button type="button" class="btn btn-ghost btn-xs ml-1" @click="logout">
        Sign out
      </button>
    </p>
    <template v-else>
      <div id="google-signin-btn" />
      <p v-if="!ready" class="text-base-content/50 text-xs">
        Loading Google sign-in…
      </p>
    </template>
    <p v-if="error" class="text-error text-xs">{{ error }}</p>
  </div>
</template>
