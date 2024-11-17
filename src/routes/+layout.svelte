<script>
  import { ModeWatcher } from 'mode-watcher';
  import Navbar from '$lib/components/layout/navbar.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import '../app.css';
</script>

<ModeWatcher />

<div
  class="grid min-h-screen grid-rows-[var(--nav-height)_1fr_40px] font-[family-name:var(--font-geist-sans)]"
>
  <Navbar />
  <main class="bg-slate-100 dark:bg-slate-900">
    <slot></slot>
  </main>
  <!-- <footer class="row-start-3 border-t-[1px] flex gap-6 flex-wrap items-center justify-center">
    footer
  </footer> -->
</div>
<Toaster />
