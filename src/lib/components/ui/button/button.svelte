<script lang="ts">
  import { Button as ButtonPrimitive } from 'bits-ui';
  import { type Props, buttonVariants } from './index.js';
  import { cn } from '$lib/utils.js';

  let {
    class: className = '',
    variant = 'default',
    size = 'default',
    children,
    ...restProps
  }: Props = $props();
</script>

<ButtonPrimitive.Root
  class={cn(buttonVariants({ variant, size, className: className as any })) as any}
  type="button"
  {...restProps as any}
>
  {@render children?.()}
</ButtonPrimitive.Root>

