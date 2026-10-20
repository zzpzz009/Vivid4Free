<template>
  <div class="cursor-wrapper" v-if="showCursor">
    <div ref="cursorRef" class="cursor"></div>
    <div ref="followerRef" class="cursor-follower"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const cursorRef = ref(null)
const followerRef = ref(null)
const showCursor = ref(false)

let mouseX = 0
let mouseY = 0
let followerX = 0
let followerY = 0
let animationFrameId = null

const onMouseMove = (e) => {
  mouseX = e.clientX
  mouseY = e.clientY
  if (cursorRef.value) {
    cursorRef.value.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`
  }
}

const animateCursor = () => {
  followerX += (mouseX - followerX) * 0.15
  followerY += (mouseY - followerY) * 0.15
  
  if (followerRef.value) {
    followerRef.value.style.transform = `translate(${followerX}px, ${followerY}px) translate(-50%, -50%)`
  }
  
  animationFrameId = requestAnimationFrame(animateCursor)
}

const handleMouseEnter = () => {
  if (followerRef.value && cursorRef.value) {
    followerRef.value.classList.add('active')
    cursorRef.value.classList.add('active')
  }
}

const handleMouseLeave = () => {
  if (followerRef.value && cursorRef.value) {
    followerRef.value.classList.remove('active')
    cursorRef.value.classList.remove('active')
  }
}

onMounted(() => {
  // Only show custom cursor on fine pointer devices (mouse)
  if (window.matchMedia("(pointer: fine)").matches) {
    showCursor.value = true
    document.addEventListener('mousemove', onMouseMove)
    animateCursor()
    
    // Add hover effects to interactive elements
    document.body.addEventListener('mouseenter', (e) => {
      if (e.target.matches('a, button, input, .hover-trigger')) {
        handleMouseEnter()
      }
    }, true)
    
    document.body.addEventListener('mouseleave', (e) => {
      if (e.target.matches('a, button, input, .hover-trigger')) {
        handleMouseLeave()
      }
    }, true)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<style scoped>
.cursor {
  position: fixed; top: 0; left: 0; width: 8px; height: 8px;
  background: var(--color-neutral-white); border-radius: 50%;
  transform: translate(-50%, -50%); pointer-events: none; z-index: 1000;
  transition: width 0.3s, height 0.3s, background 0.3s;
  mix-blend-mode: difference;
}

.cursor-follower {
  position: fixed; top: 0; left: 0; width: 32px; height: 32px;
  border: 1px solid rgba(255,255,255,0.3); border-radius: 50%;
  transform: translate(-50%, -50%); pointer-events: none; z-index: 999;
  transition: transform 0.1s cubic-bezier(0.075, 0.82, 0.165, 1), width 0.3s, height 0.3s, background-color 0.3s, border-color 0.3s;
}

.cursor.active {
  width: 4px;
  height: 4px;
}

.cursor-follower.active {
  width: 60px;
  height: 60px;
  border-color: var(--brand-primary);
  background-color: rgba(197, 174, 246, 0.1); /* purple-light with opacity */
}
</style>
