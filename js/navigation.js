// Shared navigation: touch-friendly drawer, or a bar when every item fits.
let disposeNavigation = () => {};

export function mountNavigation({ groups, activeKey, isModulePage }) {
  disposeNavigation();
  document.getElementById('menu-icon')?.remove();
  document.getElementById('nav-menu')?.closest('header')?.remove();

  const header = document.createElement('header');
  header.className = 'app-navigation';
  header.dataset.layout = 'drawer';
  header.innerHTML = `
    <div class="nav-toolbar">
      <a class="nav-brand" href="${isModulePage ? '../' : './'}index.html">A APP</a>
      <span class="nav-location"></span>
      <button type="button" id="menu-icon" aria-label="Abrir menu" aria-controls="nav-panel" aria-expanded="false"><span aria-hidden="true">☰</span><span>Menu</span></button>
    </div>
    <div class="nav-backdrop" hidden></div>
    <div id="nav-panel" class="nav-panel" aria-label="Menu principal">
      <div class="nav-panel-heading"><span>Menu</span><button type="button" class="nav-close" aria-label="Fechar menu">✕</button></div>
      <nav id="nav-menu" aria-label="Navegação principal">
        <div class="nav-links"></div>
        <div id="login-section" class="login-block">
          <a href="#" id="login-btn" class="login-visible">🔐 Entrar</a>
          <span id="user-info" class="user-visible" style="display:none;"><span id="user-name"></span></span>
        </div>
      </nav>
    </div>`;
  const linksWrap = header.querySelector('.nav-links');
  for (const group of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'nav-group';
    const current = group.links.some(link => link.key === activeKey);
    groupEl.classList.toggle('is-current', current);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-link nav-link--trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `nav-group-${group.key}`);
    trigger.textContent = group.label;
    const dropdown = document.createElement('div');
    dropdown.className = 'nav-dropdown';
    dropdown.id = `nav-group-${group.key}`;
    dropdown.hidden = true;
    for (const link of group.links) {
      const anchor = document.createElement('a');
      anchor.href = isModulePage ? link.slug.replace(/^modules\//, '') : link.slug;
      anchor.textContent = link.label;
      if (link.key === activeKey) {
        anchor.classList.add('active');
        anchor.setAttribute('aria-current', 'page');
        header.querySelector('.nav-location').textContent = `${group.label} / ${link.label}`;
      }
      dropdown.append(anchor);
    }
    groupEl.append(trigger, dropdown);
    linksWrap.append(groupEl);
  }
  document.body.prepend(header);
  disposeNavigation = setupNavigation(header);
  return header;
}

function setupNavigation(header) {
  const controller = new AbortController();
  const { signal } = controller;
  const panel = header.querySelector('.nav-panel');
  const nav = header.querySelector('#nav-menu');
  const menuButton = header.querySelector('#menu-icon');
  const closeButton = header.querySelector('.nav-close');
  const backdrop = header.querySelector('.nav-backdrop');
  const groups = [...header.querySelectorAll('.nav-group')];
  let opened = false;
  let background = [];
  let oldOverflow = '';
  let frame = 0;
  const isDrawer = () => header.dataset.layout === 'drawer';
  const setGroup = (group, expanded) => {
    group.classList.toggle('is-open', expanded);
    group.querySelector('button').setAttribute('aria-expanded', String(expanded));
    group.querySelector('.nav-dropdown').hidden = !expanded;
  };
  const closeGroups = () => groups.forEach(group => setGroup(group, false));
  const setOpen = (value, restoreFocus = true) => {
    const next = value && isDrawer();
    if (next === opened) return;
    opened = next;
    header.classList.toggle('is-open', opened);
    menuButton.setAttribute('aria-expanded', String(opened));
    header.querySelector('.nav-toolbar').inert = opened;
    backdrop.hidden = !opened;
    panel.inert = isDrawer() && !opened;
    if (opened) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      oldOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('nav-open');
      background = [...document.body.children].filter(el => el !== header && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName)).map(el => [el, el.inert]);
      background.forEach(([el]) => { el.inert = true; });
      closeGroups();
      const current = groups.find(group => group.classList.contains('is-current'));
      if (current) setGroup(current, true);
      closeButton.focus({ preventScroll: true });
      panel.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      document.body.style.overflow = oldOverflow;
      document.body.classList.remove('nav-open');
      background.forEach(([el, inert]) => { el.inert = inert; });
      background = [];
      if (restoreFocus) menuButton.focus({ preventScroll: true });
    }
  };

  function updateLayout() {
    const previous = header.dataset.layout;
    const focused = document.activeElement;
    // Measure the actual bar, including the account, before choosing a layout.
    header.dataset.layout = window.innerWidth >= 1100 ? 'bar' : 'drawer';
    if (!isDrawer() && nav.scrollWidth > nav.clientWidth + 1) header.dataset.layout = 'drawer';
    if (previous !== header.dataset.layout) {
      if (!isDrawer()) {
        const focusWasInside = panel.contains(focused);
        setOpen(false, false);
        closeGroups();
        if (focusWasInside) (groups.find(group => group.classList.contains('is-current'))?.querySelector('button') || header.querySelector('#login-btn')).focus();
      } else {
        closeGroups();
        if (panel.contains(focused)) menuButton.focus({ preventScroll: true });
      }
    }
    panel.inert = isDrawer() && !opened;
  }
  const scheduleLayout = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateLayout);
  };
  menuButton.addEventListener('click', () => setOpen(!opened), { signal });
  closeButton.addEventListener('click', () => setOpen(false), { signal });
  backdrop.addEventListener('click', () => setOpen(false), { signal });
  for (const group of groups) {
    const trigger = group.querySelector('button');
    trigger.addEventListener('click', () => {
      const expand = trigger.getAttribute('aria-expanded') !== 'true';
      if (!isDrawer()) closeGroups();
      setGroup(group, expand);
      if (!isDrawer() && expand) {
        const dropdown = group.querySelector('.nav-dropdown');
        dropdown.classList.remove('align-end');
        dropdown.classList.toggle('align-end', dropdown.getBoundingClientRect().right > window.innerWidth - 12);
      }
    }, { signal });
  }
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) {
      setOpen(false);
      closeGroups();
    }
  }, { signal });
  document.addEventListener('click', event => {
    if (!isDrawer() && !event.target.closest('.nav-group')) closeGroups();
  }, { signal });
  header.addEventListener('focusout', event => {
    if (!isDrawer()) groups.forEach(group => {
      if (!group.contains(event.relatedTarget)) setGroup(group, false);
    });
  }, { signal });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (opened) { event.preventDefault(); setOpen(false); }
      else {
        const activeGroup = groups.find(group => group.classList.contains('is-open'));
        if (activeGroup) { event.preventDefault(); closeGroups(); activeGroup.querySelector('button').focus(); }
      }
    }
    if (event.key === 'Tab' && opened) {
      const focusable = [...panel.querySelectorAll('button, a[href]')].filter(el => el.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  }, { signal });
  window.addEventListener('resize', scheduleLayout, { signal });
  const accountObserver = new MutationObserver(scheduleLayout);
  accountObserver.observe(header.querySelector('.login-block'), { subtree: true, childList: true, characterData: true, attributes: true });
  document.fonts?.ready.then(() => { if (!signal.aborted) scheduleLayout(); });
  updateLayout();
  return () => {
    setOpen(false, false);
    controller.abort();
    accountObserver.disconnect();
    cancelAnimationFrame(frame);
  };
}
