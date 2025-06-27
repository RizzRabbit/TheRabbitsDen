<script lang="ts">
  import SlotGame from './lib/SlotGame.svelte';
</script>

<main>
  <SlotGame />
</main>

<style>
  :global(body) {
    margin: 0;
    display: flex;
    place-items: center;
    min-width: 320px;
    min-height: 100vh;
    background-color: #1a1a1a;
  }

  main {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>