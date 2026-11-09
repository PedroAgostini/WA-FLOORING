/* WA Flooring Specialist: page behavior */
(() => {
  // Paste the Web3Forms access key here (https://web3forms.com, free, sends to the business inbox).
  // While empty, forms fall back to opening the visitor's email app with the request filled in.
  const WEB3FORMS_KEY = '';
  const BUSINESS_EMAIL = 'luanleal0209@gmail.com';
  const PHONE_LABEL = '(843) 822-5964';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // year
  $$('.js-year').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // header shadow
  const header = $('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // mobile menu
  const toggle = $('.menu-toggle');
  const nav = $('#nav');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('a', nav).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // reveals: shutters open, planks slide, sections snap up
  $$('.section-head, .about__copy, .about__media, .service-card, .review, .step, .faq__list details, .gallery__item, .contact__info, .form-card, .why__media, .why__content')
    .forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = `${(i % 4) * 70}ms`; });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el) => io.observe(el));

  // service links preselect the estimate form
  const estimateSelect = $('#estimate select[name="service"]');
  $$('[data-service]').forEach((a) => a.addEventListener('click', () => {
    const want = a.dataset.service.replace('&amp;', '&');
    const opt = [...estimateSelect.options].find((o) => o.value === want || o.text === want);
    if (opt) estimateSelect.value = opt.value || opt.text;
  }));

  // forms
  const digits = (v) => v.replace(/\D/g, '');
  const markInvalid = (input, msg) => {
    const field = input.closest('.field');
    field.classList.add('is-invalid');
    let err = $('.field__error', field);
    if (!err) { err = document.createElement('span'); err.className = 'field__error'; field.appendChild(err); }
    err.textContent = msg;
    input.setAttribute('aria-invalid', 'true');
  };
  const clearInvalid = (input) => {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.remove('is-invalid');
    $('.field__error', field)?.remove();
    input.removeAttribute('aria-invalid');
  };

  // two step estimate card: pick a service, then contact details
  $$('.js-steps').forEach((form) => {
    const card = form.closest('.quote-card');
    const label = $('.js-step-label', card);
    const chosen = $('.js-chosen', card);
    const status = $('.form-status', form);
    const picked = () => $('input[name="service"]:checked', form);
    const go = (n, focus = true) => {
      card.dataset.step = String(n);
      label.textContent = `Step ${n} of 2`;
      status.textContent = '';
      status.className = 'form-status';
      if (n === 2) {
        const p = picked();
        chosen.textContent = p ? $('.tile__title', p.closest('.tile')).textContent : 'Service';
        if (focus) setTimeout(() => form.elements.name.focus({ preventScroll: true }), 60);
      } else if (focus) {
        (picked() || $('input[name="service"]', form)).focus({ preventScroll: true });
      }
    };
    card.goStep = go;
    $('.js-next', form).addEventListener('click', () => {
      if (!picked()) {
        status.className = 'form-status is-error';
        status.textContent = 'Pick one option to continue.';
        return;
      }
      go(2);
    });
    $('.js-back', form).addEventListener('click', () => go(1));
    // a pointer pick moves straight on; keyboard users confirm with Continue
    $$('.tile', form).forEach((t) => t.addEventListener('pointerup', () => setTimeout(() => { if (picked()) go(2); }, 260)));
    go(1, false);
  });

  $$('.js-lead-form').forEach((form) => {
    const status = $('.form-status', form);
    const btn = $('button[type="submit"]', form);
    $$('input, select, textarea', form).forEach((el) => el.addEventListener('input', () => clearInvalid(el)));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';
      let firstBad = null;
      const name = form.elements.name;
      const phone = form.elements.phone;
      const service = form.elements.service;
      const email = form.elements.email;

      if (!name.value.trim()) { markInvalid(name, 'Please tell us your name.'); firstBad ||= name; }
      if (digits(phone.value).length < 10) { markInvalid(phone, 'Enter a 10 digit phone number so we can reach you.'); firstBad ||= phone; }
      // the hero uses radio tiles (one is always checked); the full form uses a select
      if (service instanceof HTMLSelectElement && !service.value) { markInvalid(service, 'Pick the service you need, or "Not sure yet".'); firstBad ||= service; }
      if (service instanceof RadioNodeList && !service.value) {
        form.closest('.quote-card')?.goStep?.(1);
        status.className = 'form-status is-error';
        status.textContent = 'Pick the service you need first.';
        return;
      }
      if (email && email.value && !/^\S+@\S+\.\S+$/.test(email.value)) { markInvalid(email, 'That email looks incomplete.'); firstBad ||= email; }
      if (firstBad) { firstBad.focus(); return; }

      // antispam (js/antispam.js): bots get a quiet fake success, people get a clear reason
      const verdict = window.WAAntispam ? window.WAAntispam.check(form) : '';
      if (verdict === 'bot') {
        form.reset();
        status.classList.add('is-ok');
        status.textContent = 'Thank you. We got your request and will reach out soon to schedule your free estimate.';
        return;
      }
      if (verdict === 'email') { markInvalid(email, 'Please use an email address you check regularly.'); email.focus(); return; }
      if (verdict) {
        status.classList.add('is-error');
        status.textContent = verdict === 'links'
          ? 'Please remove links from your message and send it again.'
          : `We just got a request from you. Give it a minute, or call or text ${PHONE_LABEL}.`;
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      delete data.website;

      if (!WEB3FORMS_KEY) {
        const lines = [
          `Name: ${data.name}`, `Phone: ${data.phone}`, `Service: ${data.service}`,
          data.email && `Email: ${data.email}`, data.location && `City or ZIP: ${data.location}`, data.zip && `ZIP: ${data.zip}`,
          data.contact_pref && `Best way to reach me: ${data.contact_pref}`, data.message && `Project: ${data.message}`,
        ].filter(Boolean).join('\n');
        window.WAAntispam?.markSent();
        location.href = `mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent(`Free estimate request: ${data.service}`)}&body=${encodeURIComponent(lines)}`;
        status.classList.add('is-ok');
        status.textContent = `Your email app should open with the request ready to send. If it does not, call or text ${PHONE_LABEL}.`;
        return;
      }

      btn.disabled = true;
      const label = $('span', btn);
      const original = label.textContent;
      label.textContent = 'Sending...';
      try {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: `New estimate request: ${data.service}`, from_name: 'WA Flooring Specialist website', ...data }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Send failed');
        window.WAAntispam?.markSent();
        form.reset();
        status.classList.add('is-ok');
        status.textContent = 'Thank you. We got your request and will reach out soon to schedule your free estimate.';
      } catch (err) {
        status.classList.add('is-error');
        status.textContent = `We could not send this right now. Please call or text ${PHONE_LABEL}.`;
      } finally {
        btn.disabled = false;
        label.textContent = original;
      }
    });
  });

  // lightbox
  const box = $('.lightbox');
  const media = $('.lightbox__media', box);
  const caption = $('.lightbox__caption', box);
  $$('.gallery__item').forEach((item) => item.addEventListener('click', () => {
    const src = item.dataset.full;
    const alt = $('img', item).alt;
    media.innerHTML = '';
    const img = new Image();
    img.src = src;
    img.alt = alt;
    media.appendChild(img);
    caption.textContent = $('span', item).textContent;
    box.showModal();
  }));
  $('.lightbox__close', box).addEventListener('click', () => box.close());
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
})();
