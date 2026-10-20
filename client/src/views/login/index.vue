<template>
  <div class="login-page">
    <LoginCursor />
    
    <!-- Video Background -->
    <div class="video-bg">
      <video autoplay muted loop playsinline class="bg-video">
        <source src="https://videos.pexels.com/video-files/3129671/3129671-hd_1920_1080_30fps.mp4" type="video/mp4">
      </video>
      <div class="bg-overlay"></div>
    </div>

    <!-- Noise Texture -->
    <div class="noise-overlay"></div>

    <!-- Main Content -->
    <div class="content-container">
      <!-- Left: Brand Title -->
      <div class="brand-section">
        <div class="brand-label reveal active">
          <span>AI GENERATION</span>
          <span class="divider">//</span>
          <span>ENTERPRISE</span>
        </div>
        <h1 class="brand-title reveal active delay-1">
          WELCOME TO<br>
          <span class="text-sheen">VIVID</span>
        </h1>
        <p class="brand-subtitle reveal active delay-2">
          Beyond Imagination. <span class="text-muted">Building Realities.</span>
        </p>
      </div>

      <!-- Right: Login Form -->
      <div class="form-section reveal active delay-3">
        <LoginForm />
      </div>
    </div>

    <!-- Footer -->
    <div class="login-footer reveal active delay-3">
      <div class="footer-item">[ SYSTEM STATUS: ONLINE ]</div>
      <div class="footer-item highlight">● SECURE CONNECTION</div>
    </div>
  </div>
</template>

<script setup>
import LoginCursor from './LoginCursor.vue'
import LoginForm from './LoginForm.vue'
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap');

:global(:root) {
  --font-display: 'Syne', sans-serif;
  --font-body: 'Manrope', sans-serif;
  --login-accent: #C5AEF6; /* Purple Light */
  --login-bg: #0A0A0A;
}

.login-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--login-bg);
  color: #EDEDED;
  font-family: var(--font-body);
  cursor: none; /* Hide default cursor for custom one */
}

.video-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.bg-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.2;
  filter: grayscale(100%) contrast(1.2);
  mix-blend-mode: screen;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(10,10,10,0.9) 0%, rgba(10,10,10,0.6) 50%, rgba(10,10,10,0.8) 100%);
}

.noise-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  opacity: 0.03;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

.content-container {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  height: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 4rem;
}

.brand-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding-right: 4rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center; /* Center form horizontally in its column */
  padding-left: 4rem;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  color: var(--login-accent);
  margin-bottom: 1.5rem;
  font-weight: 600;
}

.divider {
  margin: 0 0.5rem;
  color: #666;
}

.brand-title {
  font-family: var(--font-display);
  font-size: clamp(3rem, 6vw, 5.5rem);
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.03em;
  margin-bottom: 2rem;
  color: #fff;
}

.text-sheen {
  background: linear-gradient(90deg, #fff, #C5AEF6, #fff);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: sheen 3s ease-in-out infinite;
}

@keyframes sheen {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.brand-subtitle {
  font-size: 1.25rem;
  font-weight: 300;
  color: #EDEDED;
}

.text-muted {
  color: #888;
}

.login-footer {
  position: absolute;
  bottom: 2rem;
  left: 4rem;
  right: 4rem;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  font-family: monospace;
  font-size: 0.75rem;
  color: #666;
  pointer-events: none;
}

.highlight {
  color: var(--login-accent);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
}

.reveal.active {
  opacity: 1;
  transform: translateY(0);
}

.delay-1 { transition-delay: 0.1s; }
.delay-2 { transition-delay: 0.2s; }
.delay-3 { transition-delay: 0.3s; }

@media (max-width: 1024px) {
  .content-container {
    grid-template-columns: 1fr;
    padding: 2rem;
  }
  
  .brand-section {
    padding-right: 0;
    align-items: center;
    text-align: center;
    padding-bottom: 4rem;
  }
  
  .form-section {
    padding-left: 0;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 4rem;
  }

  .login-footer {
    left: 2rem;
    right: 2rem;
  }
}
</style>
