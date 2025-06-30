<script lang="ts">
  import type { Meta, StoryObj } from '@storybook/svelte';
  import SlotGame from '../lib/SlotGame.svelte';

  
    export const meta = {
    title: 'Slot/SlotGame',
    component: SlotGame,
  } satisfies Meta<SlotGame>;

  type Story = StoryObj<typeof meta>;

  export const Default: Story = {};
</script>