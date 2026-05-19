<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";
</script>

<template>
  <div
    class="min-h-screen bg-base-200 bg-stripes text-base-content flex flex-col transition-colors duration-300"
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
        <RouterLink to="/journal" class="btn btn-ghost btn-sm" active-class="btn-active">
          Journal
        </RouterLink>
        <RouterLink to="/practice" class="btn btn-ghost btn-sm" active-class="btn-active">
          Practice
        </RouterLink>
        <a
          href="https://d1g.uk"
          class="btn btn-ghost btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Dig on d1g.uk
        </a>
      </nav>
    </header>
    <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
      <div class="bg-base-100 rounded-box shadow-md p-4 sm:p-6 min-h-[50vh]">
        <RouterView />
      </div>
    </main>
    <footer class="footer footer-center text-base-content/60 text-xs py-6">
      <aside>
        <p>Dig on d1g.uk · Stories and practice scores on the hub</p>
      </aside>
    </footer>
  </div>
</template>
