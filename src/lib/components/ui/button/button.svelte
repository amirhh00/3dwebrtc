<script lang="ts">
  import { Button as ButtonPrimitive } from 'bits-ui';
  import { type Events, type Props, buttonVariants } from './index.js';
  import { cn } from '$lib/utils.js';

  type $$Props = Props;
  type $$Events = Events;

  let className: $$Props['class'] = '';
  export let variant: $$Props['variant'] = 'default';
  export let size: $$Props['size'] = 'default';
  export let builders: $$Props['builders'] = [];
  export { className as class };

  // @ts-expect-error - computedClass is a string, but cn can return a string or an array of strings
  $: computedClass = cn(buttonVariants({ variant, size, className })) as string;
</script>

<ButtonPrimitive.Root
  {builders}
  class={computedClass}
  type="button"
  {...$$restProps}
  on:click
  on:keydown
>
  <slot />
</ButtonPrimitive.Root>
