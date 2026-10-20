// Drag and drop composable for reordering items
import { ref } from 'vue'

export function useDragAndDrop(items, options = {}) {
  const draggedItem = ref(null)
  const draggedIndex = ref(-1)
  const dropZoneIndex = ref(-1)
  const isDragging = ref(false)

  const {
    onReorder = () => {},
    dragClass = 'dragging',
    dropZoneClass = 'drop-zone',
    ghostClass = 'drag-ghost'
  } = options

  const handleDragStart = (event, item, index) => {
    draggedItem.value = item
    draggedIndex.value = index
    isDragging.value = true
    
    // Set drag image
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/html', event.target.outerHTML)
    
    // Add dragging class after a short delay to avoid affecting drag image
    setTimeout(() => {
      event.target.classList.add(dragClass)
    }, 0)
  }

  const handleDragEnd = (event) => {
    event.target.classList.remove(dragClass)
    draggedItem.value = null
    draggedIndex.value = -1
    dropZoneIndex.value = -1
    isDragging.value = false
  }

  const handleDragOver = (event, index) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    
    if (index !== draggedIndex.value) {
      dropZoneIndex.value = index
    }
  }

  const handleDragEnter = (event, index) => {
    event.preventDefault()
    if (index !== draggedIndex.value) {
      dropZoneIndex.value = index
    }
  }

  const handleDragLeave = (event) => {
    // Only clear drop zone if we're leaving the container
    if (!event.currentTarget.contains(event.relatedTarget)) {
      dropZoneIndex.value = -1
    }
  }

  const handleDrop = (event, targetIndex) => {
    event.preventDefault()
    
    if (draggedIndex.value === -1 || targetIndex === draggedIndex.value) {
      return
    }

    // Create new array with reordered items
    const newItems = [...items.value]
    const draggedItemData = newItems[draggedIndex.value]
    
    // Remove dragged item
    newItems.splice(draggedIndex.value, 1)
    
    // Insert at new position
    const insertIndex = draggedIndex.value < targetIndex ? targetIndex - 1 : targetIndex
    newItems.splice(insertIndex, 0, draggedItemData)
    
    // Update items
    items.value = newItems
    
    // Call reorder callback
    onReorder(newItems, draggedIndex.value, insertIndex)
    
    dropZoneIndex.value = -1
  }

  const getDragHandlers = (item, index) => ({
    draggable: true,
    onDragstart: (event) => handleDragStart(event, item, index),
    onDragend: handleDragEnd,
    onDragover: (event) => handleDragOver(event, index),
    onDragenter: (event) => handleDragEnter(event, index),
    onDragleave: handleDragLeave,
    onDrop: (event) => handleDrop(event, index)
  })

  const getItemClasses = (index) => {
    const classes = []
    
    if (index === draggedIndex.value) {
      classes.push(dragClass)
    }
    
    if (index === dropZoneIndex.value) {
      classes.push(dropZoneClass)
    }
    
    return classes.join(' ')
  }

  return {
    isDragging,
    draggedIndex,
    dropZoneIndex,
    getDragHandlers,
    getItemClasses
  }
}

// CSS classes for drag and drop styling
export const dragDropStyles = `
.dragging {
  opacity: 0.5;
  transform: rotate(5deg);
  transition: all 0.2s ease;
}

.drop-zone {
  transform: scale(1.05);
  box-shadow: 0 0 0 2px #b6f298;
  transition: all 0.2s ease;
}

.drag-ghost {
  opacity: 0.8;
  transform: rotate(5deg);
}

.drag-container {
  position: relative;
}

.drag-container .drag-item {
  cursor: grab;
  transition: all 0.2s ease;
}

.drag-container .drag-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.drag-container .drag-item:active {
  cursor: grabbing;
}
`
