(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const notes = JSON.parse(document.querySelector('#deck-notes-data').textContent);
  const select = document.querySelector('#deck-select');
  const previous = document.querySelector('#deck-prev'), next = document.querySelector('#deck-next');
  let current = 0;
  function fitCanvas() {
    const width = document.querySelector('#deck-stage').clientWidth;
    document.documentElement.style.setProperty('--deck-scale', String(width / 1920));
    document.documentElement.style.setProperty('--stage-height', `${width * 1080 / 1920}px`);
  }
  function show(index, updateHash = true) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide,i) => slide.hidden = i !== current);
    select.value = current; previous.disabled = current === 0; next.disabled = current === slides.length - 1;
    document.querySelector('#deck-progress').textContent = `${current+1} / ${slides.length}`;
    document.querySelector('#deck-note-body').textContent = notes[current];
    if (updateHash) history.replaceState(null, '', '#' + slides[current].id);
    window.scrollTo(0, 0);
    fitCanvas();
  }
  function fromHash() { const index = slides.findIndex(slide => slide.id === location.hash.slice(1)); show(index < 0 ? 0 : index, false); }
  previous.addEventListener('click', () => show(current - 1)); next.addEventListener('click', () => show(current + 1));
  select.addEventListener('change', () => show(Number(select.value)));
  document.querySelector('#deck-print').addEventListener('click', () => window.print());
  document.querySelector('#deck-notes-toggle').addEventListener('click', event => { const panel = document.querySelector('#deck-notes'); panel.hidden = !panel.hidden; event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden)); });
  document.addEventListener('keydown', event => { if (/INPUT|SELECT|TEXTAREA|BUTTON|A/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); show(current + 1); } if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); show(current - 1); } if (event.key === 'Home') { event.preventDefault(); show(0); } if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); } });
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('hashchange', fromHash); fromHash();
})();
