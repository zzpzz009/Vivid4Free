// The approved animation runs in a scoped DOM; no inline script execution.
export function runIntroAnimation(document, onComplete) {
  const intro = document.getElementById('intro');
  const landing = document.getElementById('landing');
  const replay = document.getElementById('replay');
  const skip = document.getElementById('skip');
  const logo = document.getElementById('logo-image');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let timer;
  let dockingTimer;
  let active = false;
  let replaying = false;
  let motion = [];
  let flyingText = [];

  function clearMotion() {
    motion.forEach(animation => animation.cancel());
    motion = [];
    flyingText.forEach(element => element.remove());
    flyingText = [];
  }

  function characters(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const result = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const style = getComputedStyle(node.parentElement);
      for (let index = 0; index < node.length; index++) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        result.push({ text: node.textContent[index], rect: range.getBoundingClientRect(), style,
          background: node.parentElement.getBoundingClientRect() });
      }
    }
    return result;
  }

  function moveText(source, target, options) {
    const from = characters(source);
    const to = characters(target);
    to.forEach((destination, index) => {
      const origin = from[index]?.text === destination.text ? from[index] : null;
      if (!origin) return;
      const start = origin;
      const flight = document.createElement('span');
      flight.className = 'text-flight';
      flight.setAttribute('aria-hidden', 'true');
      Object.assign(flight.style, { fontFamily: start.style.fontFamily,
        fontStyle: start.style.fontStyle, fontSize: start.style.fontSize,
        fontWeight: start.style.fontWeight, color: start.style.color });
      const ink = document.createElement('span');
      ink.textContent = destination.text;
      const finalInk = ink.cloneNode(true);
      finalInk.className = 'flight-target';
      Object.assign(finalInk.style, { color: destination.style.color,
        backgroundImage: destination.style.backgroundImage,
        backgroundSize: `${destination.background.width}px 100%`,
        backgroundPosition: `${destination.background.left - destination.rect.left}px 0` });
      flight.append(ink, finalInk);
      document.body.append(flight);
      flyingText.push(flight);
      motion.push(flight.animate([
        { transform: `translate(${start.rect.left}px, ${start.rect.top}px)`,
          fontSize: start.style.fontSize, fontWeight: start.style.fontWeight },
        { transform: `translate(${destination.rect.left}px, ${destination.rect.top}px)`,
          fontSize: destination.style.fontSize, fontWeight: destination.style.fontWeight }
      ], options));
      motion.push(ink.animate([{ opacity: origin ? 1 : 0 }, { opacity: 0 }], options));
      motion.push(finalInk.animate([{ opacity: 0 }, { opacity: 1 }], options));
    });
  }

  function finish(reason = 'complete') {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    clearTimeout(dockingTimer);
    const restoreFocus = intro.contains(document.activeElement) || replaying;
    intro.hidden = true;
    intro.classList.remove('playing');
    document.body.classList.remove('intro-active', 'docking');
    clearMotion();
    landing.inert = false;
    landing.removeAttribute('aria-hidden');
    if (restoreFocus) replay.focus({ preventScroll: true });
    // Listen here to connect the animation to an existing application.
    onComplete(reason);
  }

  function dock() {
    if (!active) return;
    const ribbon = intro.querySelector('.logo-wrap');
    const from = ribbon.getBoundingClientRect();
    const to = document.getElementById('landing-logo').getBoundingClientRect();
    const x = to.left + to.width / 2 - from.left - from.width / 2;
    const y = to.top + to.height / 2 - from.top - from.height / 2;
    const scale = to.width / from.width;
    document.body.classList.add('docking');
    const options = { duration: 1200, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' };
    moveText(intro.querySelector('.wordmark'), landing.querySelector('.eyebrow'), options);
    moveText(intro.querySelector('.tagline'), landing.querySelector('h1'), options);
    motion.push(ribbon.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${x}px, ${y}px) scale(${scale})` }
    ], options));
    // The large logo stays on screen until it exactly meets the small one.
    for (const selector of ['.intro-footer', '.intro-backdrop']) {
      const element = intro.querySelector(selector);
      motion.push(element.animate([{ opacity: getComputedStyle(element).opacity }, { opacity: 0 }], {
        duration: selector === '.intro-backdrop' ? 1100 : 350, fill: 'forwards', easing: 'ease'
      }));
    }
  }

  function play() {
    clearTimeout(timer);
    clearTimeout(dockingTimer);
    clearMotion();
    replaying = document.activeElement === replay;
    active = true;
    intro.hidden = false;
    intro.classList.remove('playing');
    document.body.classList.remove('docking');
    document.body.classList.add('intro-active');
    landing.inert = true;
    landing.setAttribute('aria-hidden', 'true');
    void intro.offsetWidth;
    intro.classList.add('playing');
    if (replaying) skip.focus({ preventScroll: true });
    if (!reducedMotion.matches) dockingTimer = setTimeout(dock, 3500);
    timer = setTimeout(() => finish(), reducedMotion.matches ? 1200 : 4750);
  }

  replay.addEventListener('click', play);
  skip.addEventListener('click', () => finish('skip'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active) finish('skip');
  });
  // Start once the original logo is decoded, so no empty image flashes.
  const preload = new Image();
  preload.src = logo.getAttribute('href');
  preload.decode().catch(() => {}).then(() => { if (!disposed) play(); });
  return () => {
    disposed = true;
    active = false;
    clearTimeout(timer);
    clearTimeout(dockingTimer);
    clearMotion();
  };
}
