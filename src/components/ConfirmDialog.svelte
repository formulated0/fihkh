<script>
  import { createEventDispatcher } from 'svelte';
  
  export let title = 'Confirm';
  export let message = '';
  export let confirmText = 'Confirm';
  export let cancelText = 'Cancel';
  export let danger = false;

  const dispatch = createEventDispatcher();

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleConfirm();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="dialog-overlay" on:click={handleCancel}>
  <div class="dialog-box" on:click|stopPropagation>
    <!-- Title -->
    <div class="dialog-title">
      {title}
    </div>

    <!-- Message -->
    <div class="dialog-message">
      {message}
    </div>

    <!-- Buttons -->
    <div class="dialog-buttons">
      <button 
        class="dialog-button dialog-button-cancel" 
        on:click={handleCancel}
        tabindex="-1"
      >
        {cancelText}
      </button>
      <button 
        class="dialog-button"
        class:dialog-button-danger={danger}
        class:dialog-button-confirm={!danger}
        on:click={handleConfirm}
        tabindex="-1"
      >
        {confirmText}
      </button>
    </div>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog-box {
    background: #282828;
    border: 2px solid #665c54;
    min-width: 400px;
    max-width: 600px;
    padding: 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  .dialog-title {
    background: #3c3836;
    padding: 1rem 1.5rem;
    font-weight: bold;
    color: #ebdbb2;
    border-bottom: 1px solid #504945;
  }

  .dialog-message {
    padding: 1.5rem;
    color: #d5c4a1;
    line-height: 1.5;
  }

  .dialog-buttons {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    justify-content: flex-end;
    border-top: 1px solid #504945;
    background: #1d2021;
  }

  .dialog-button {
    padding: 0.5rem 1.5rem;
    border: 1px solid #504945;
    background: #3c3836;
    color: #ebdbb2;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.875rem;
    transition: all 0.15s;
  }

  .dialog-button:hover {
    background: #504945;
  }

  .dialog-button-confirm {
    background: #458588;
    border-color: #458588;
    color: white;
  }

  .dialog-button-confirm:hover {
    background: #83a598;
    border-color: #83a598;
  }

  .dialog-button-danger {
    background: #cc241d;
    border-color: #cc241d;
    color: white;
  }

  .dialog-button-danger:hover {
    background: #fb4934;
    border-color: #fb4934;
  }

  .dialog-button-cancel {
    background: transparent;
    border-color: #504945;
  }

  .dialog-button-cancel:hover {
    background: #3c3836;
  }
</style>