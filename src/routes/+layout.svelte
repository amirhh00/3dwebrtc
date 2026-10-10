<script>
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$lib/components/ui/sonner';
  import '../app.css';
</script>

<ModeWatcher />

<main class="h-dvh w-full overflow-hidden bg-slate-950 font-sans">
  <slot></slot>
</main>
<Toaster />

