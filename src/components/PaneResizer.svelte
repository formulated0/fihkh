<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let isDragging = false;
  
  function handleMouseDown(event) {
    isDragging = true;
    event.preventDefault();
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }
  
  function handleMouseMove(event) {
    if (!isDragging) return;
    dispatch('resize', { clientX: event.clientX });
  }
  
  function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }
</script>

<div 
  class="resizer"
  class:dragging={isDragging}
  on:mousedown={handleMouseDown}
  role="separator"
  aria-orientation="vertical"
  tabindex="-1"
>
  <div class="resizer-line"></div>
</div>

<style>
  .resizer {
    width: 6px;
    cursor: col-resize;
    position: relative;
    background: transparent;
    flex-shrink: 0;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .resizer:hover .resizer-line,
  .resizer.dragging .resizer-line {
    background: #fabd2f;
  }
  
  .resizer-line {
    width: 2px;
    height: 100%;
    background: #504945;
    transition: background 0.2s;
  }
  
  .resizer.dragging {
    cursor: col-resize;
  }
</style>