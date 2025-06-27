<script lang="ts">
  import type { Meta, StoryObj } from '@storybook/svelte';
  import SlotGame from '../lib/SlotGame.svelte';

  const meta = {
    title: 'Slot/SlotGame',
    component: SlotGame,
  } satisfies Meta<SlotGame>;

  export default meta;

  type Story = StoryObj<typeof meta>;

  export const Default: Story = {};
</script>