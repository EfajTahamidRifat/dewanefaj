/* Efaj Tahamid Rifat — portfolio: smooth scroll, header, parallax */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = window.gsap && window.ScrollTrigger;

  // smooth scroll, kept in sync with ScrollTrigger
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGsap) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const el = id === '#top' ? 0 : document.querySelector(id);
      if (el === null) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: id === '#story' ? 0 : -70, duration: id === '#story' ? 1.4 : 1.2 });
    }));
  }

  // header tucks away while scrolling down
  const top = document.querySelector('.top');
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    top.classList.toggle('hide', y > 300 && y > last);
    last = y;
  }, { passive: true });

  // grease-pencil circle hugs the picked frame's image
  const sizeGrease = () => document.querySelectorAll('.frame.pick').forEach(f => {
    const neg = f.querySelector('.neg');
    if (neg) f.style.setProperty('--negh', (neg.offsetHeight / f.offsetHeight * 100) + '%');
  });
  window.addEventListener('load', sizeGrease);
  window.addEventListener('resize', sizeGrease);
  sizeGrease();

  if (reduce || !hasGsap) return;
  gsap.registerPlugin(ScrollTrigger);
  const scrub = (trigger, start = 'top bottom', end = 'bottom top') => ({ trigger, start, end, scrub: true });

  // hero: the print floats away slower than the name; each name line at its own speed
  gsap.to('.print', { yPercent: -22, rotate: 4, ease: 'none', scrollTrigger: scrub('.hero', 'top top') });
  gsap.to('.hero .safelight', { yPercent: 30, scale: 1.25, ease: 'none', scrollTrigger: scrub('.hero', 'top top') });
  [-60, -110, -160].forEach((y, i) => gsap.to(`.name span:nth-child(${i + 1})`, { y, ease: 'none', scrollTrigger: scrub('.hero', 'top top') }));
  gsap.to('.hero-copy .lede, .hero-copy .role, .hero-copy .actions', { y: -40, opacity: 0, ease: 'none', scrollTrigger: scrub('.hero', 'center top', 'bottom top') });

  // contact sheet: images drift inside their frames; frames move at slightly different depths
  gsap.utils.toArray('.neg img').forEach(img => {
    gsap.fromTo(img, { yPercent: -8, scale: 1.18 }, { yPercent: 8, scale: 1.18, ease: 'none', scrollTrigger: scrub(img.closest('.frame')) });
  });
  gsap.utils.toArray('.frame').forEach((f, i) => {
    gsap.fromTo(f, { y: 40 + (i % 3) * 30 }, { y: -(20 + (i % 3) * 30), ease: 'none', scrollTrigger: scrub(f) });
  });
  gsap.fromTo('.strip', { backgroundPositionX: 0 }, { backgroundPositionX: 200, ease: 'none', scrollTrigger: scrub('.strip') });

  // section titles slide in from the side as they cross the screen
  gsap.utils.toArray('.h2').forEach((t, i) => {
    gsap.fromTo(t, { xPercent: i % 2 ? 6 : -6 }, { xPercent: 0, ease: 'none', scrollTrigger: scrub(t, 'top bottom', 'top 40%') });
  });

  // about: the tall portrait drifts inside its frame
  gsap.fromTo('.about-print img', { yPercent: -10, scale: 1.2 }, { yPercent: 10, scale: 1.2, ease: 'none', scrollTrigger: scrub('.about') });
  // timeline years count past at a different speed than their text
  gsap.utils.toArray('.timeline .yr').forEach(y => gsap.fromTo(y, { y: 30 }, { y: -30, ease: 'none', scrollTrigger: scrub(y) }));

  // contact: the number slides across, the safelight rises
  gsap.fromTo('.phone', { xPercent: -12 }, { xPercent: 0, ease: 'none', scrollTrigger: scrub('.contact', 'top bottom', 'center center') });
  gsap.fromTo('.contact .safelight', { yPercent: 30 }, { yPercent: -20, ease: 'none', scrollTrigger: scrub('.contact') });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
