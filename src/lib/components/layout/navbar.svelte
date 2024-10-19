<script>
  import LightSwitch from '$lib/components/layout/lightSwitch.svelte';
  let isOpen = false;

  function toggleMenu() {
    isOpen = !isOpen;
  }
</script>

<nav class="content-center">
  <div class="container mx-auto flex items-center justify-between">
    <div class="text-lg font-bold">
      <a href="/">Brand</a>
    </div>
    <LightSwitch className="md:order-last" />
    <div
      class={`w-full justify-center md:flex md:w-auto md:items-center ${isOpen ? 'block' : 'hidden'}`}
    >
      <div class="text-sm md:flex-grow">
        <a href="/" class="mr-4 mt-4 block md:mt-0 md:inline-block"> Home </a>
        <a href="/about" class="mr-4 mt-4 block md:mt-0 md:inline-block">About</a>
        <a href="/services" class="mr-4 mt-4 block md:mt-0 md:inline-block">Services</a>
        <a href="/contact" class="mt-4 block md:mt-0 md:inline-block"> Contact </a>
      </div>
    </div>
    <button class="block md:hidden" on:click={toggleMenu} aria-label="Toggle menu">
      &#9776;
    </button>
  </div>
</nav>
