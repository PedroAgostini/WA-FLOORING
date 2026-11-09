/*
 * WA Flooring Specialist | Form antispam
 * Runs in the browser before an estimate request leaves the page.
 * Layers: honeypot field, minimum time on page, real interaction,
 * foreign-script spam, link stuffing, disposable email domains
 * and a short resend cooldown.
 * Web3Forms runs its own spam filter on the server side once the key is set.
 */
window.WAAntispam = (() => {
  const loadedAt = Date.now();
  const MIN_MS = 4000;          // nobody fills the form in under 4 seconds
  const COOLDOWN_MS = 60000;    // one request per minute per browser
  const KEY = 'wa-last-request';
  const LINKS = /(https?:\/\/|www\.|\[url|<a\s|\.ru\b|\.xyz\b)/i;
  // A South Carolina homeowner does not write in Cyrillic or CJK; spam bots often do
  const FOREIGN = /[Ѐ-ӿ぀-ヿ一-鿿가-힯]/;
  const DISPOSABLE = /@(mailinator|yopmail|guerrillamail|sharklasers|10minutemail|tempmail|temp-mail|trashmail|getnada|dispostable|maildrop|throwawaymail|fakeinbox|mintemail)\./i;
  let interacted = false;

  ['pointerdown', 'keydown', 'touchstart'].forEach((type) => {
    window.addEventListener(type, () => { interacted = true; }, { once: true, passive: true });
  });

  const lastSent = () => {
    try { return Number(localStorage.getItem(KEY) || 0); } catch (e) { return 0; }
  };

  return {
    /**
     * Returns '' when the request looks human.
     * 'bot' means drop it silently; 'links', 'email' and 'repeat' carry a message for the visitor.
     */
    check(form) {
      const data = new FormData(form);
      if (String(data.get('website') || '').trim()) return 'bot';
      if (Date.now() - loadedAt < MIN_MS) return 'bot';
      if (!interacted) return 'bot';
      const text = `${data.get('name') || ''} ${data.get('message') || ''}`;
      if (FOREIGN.test(text)) return 'bot';
      if (LINKS.test(text)) return 'links';
      if (DISPOSABLE.test(String(data.get('email') || ''))) return 'email';
      if (Date.now() - lastSent() < COOLDOWN_MS) return 'repeat';
      return '';
    },
    markSent() {
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* storage blocked: skip */ }
    }
  };
})();
