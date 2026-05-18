<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <RouterLink to="/" class="font-semibold text-amber-400 hover:text-amber-300">
          SFL Digging Hub
        </RouterLink>
        <nav class="flex gap-4 text-sm text-stone-300">
          <RouterLink to="/community" class="hover:text-white" active-class="text-white">
            Community
          </RouterLink>
          <RouterLink to="/journal" class="hover:text-white" active-class="text-white">
            Journal
          </RouterLink>
          <a
            href="https://d1g.uk"
            class="hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dig on d1g.uk
          </a>
        </nav>
      </div>
    </header>
    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
      <RouterView />
    </main>
    <footer class="border-t border-stone-800 text-center text-xs text-stone-500 py-6">
      Dig on d1g.uk · Stories on the hub
    </footer>
  </div>
</template>
