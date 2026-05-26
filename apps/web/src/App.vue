<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { getAvatarUrl, getDisplayName, getSession, getSessionToken, type SessionInfo } from "@/api/client";
import { D1G_BASE_URL, D1G_LABEL } from "@/utils/d1gUrl";

const sessionInfo = ref<SessionInfo | null>(null);

async function loadSession() {
  if (!getSessionToken()) return;
  try {
    sessionInfo.value = await getSession();
  } catch {
    sessionInfo.value = null;
  }
}

onMounted(loadSession);
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
  </div>
</template>
