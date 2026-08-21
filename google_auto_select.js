(function () {
  console.log('[HCMUTE Google Auto Select] Running on:', window.location.href);

  let clicked = false;
  let poll = null;
  let observer = null;

  function stopAllScanners() {
    if (poll) { clearInterval(poll); poll = null; }
    if (observer) { observer.disconnect(); observer = null; }
  }

  function simulateClick(el) {
    if (!el) return;
    try { el.focus(); } catch {}
    try { el.click(); } catch {}
  }

  function findStudentAccountElement() {
    // 1. Precise Selector matching data-identifier or data-email attribute from Google Account Chooser
    const directMatch = document.querySelector(
      '[data-identifier*="24110166"], [data-email*="24110166"], ' +
      '[data-identifier*="@student.hcmute.edu.vn"], [data-email*="@student.hcmute.edu.vn"], ' +
      '[data-identifier*="@hcmute.edu.vn"], [data-email*="@hcmute.edu.vn"]'
    );
    if (directMatch) {
      return directMatch.closest('[role="link"], [role="button"], li, div[data-identifier]') || directMatch;
    }

    // 2. Check candidate containers
    const candidates = Array.from(document.querySelectorAll(
      'li, div[role="link"], div[role="button"], [data-identifier], [data-email], .VV3oRb, .aZvCDf'
    ));

    for (const el of candidates) {
      const id = (
        el.getAttribute('data-identifier') ||
        el.getAttribute('data-email') ||
        el.innerText ||
        el.textContent ||
        ''
      ).toLowerCase();

      if (id.includes('24110166') || id.includes('@student.hcmute.edu.vn') || id.includes('@hcmute.edu.vn')) {
        return el.closest('[role="link"], [role="button"], li, div[data-identifier]') || el;
      }
    }

    // 3. Fallback: Leaf text node matching student email
    const allDivs = Array.from(document.querySelectorAll('div, span, p'));
    for (const d of allDivs) {
      const text = (d.innerText || d.textContent || '').toLowerCase().trim();
      if ((text.includes('24110166') || text.includes('@student.hcmute.edu.vn')) && d.children.length === 0) {
        return d.closest('[role="link"], [role="button"], li, div[data-identifier]') || d;
      }
    }

    return null;
  }

  function trySelect() {
    if (clicked || sessionStorage.getItem('google_selected_done')) {
      stopAllScanners();
      return true;
    }

    const el = findStudentAccountElement();
    if (el) {
      sessionStorage.setItem('google_selected_done', '1');
      clicked = true;
      stopAllScanners();
      console.log('[HCMUTE Google Auto Select] >>> CHỈ CLICK 1 LẦN TÀI KHOẢN SINH VIÊN:', el);
      simulateClick(el);
      return true;
    }

    // Fallback: If on email entry screen (#identifierId), fill email and click Next ONCE
    const emailInput = document.querySelector('input[type="email"], input[name="identifier"], #identifierId');
    if (emailInput && !emailInput.value) {
      sessionStorage.setItem('google_selected_done', '1');
      clicked = true;
      stopAllScanners();
      console.log('[HCMUTE Google Auto Select] Nhập email 24110166@student.hcmute.edu.vn...');
      emailInput.value = '24110166@student.hcmute.edu.vn';
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));

      setTimeout(() => {
        const nextBtn = document.querySelector('#identifierNext, button[jsname="LgbsSe"], button:not([disabled])');
        if (nextBtn) {
          simulateClick(nextBtn);
        }
      }, 300);
      return true;
    }

    return false;
  }

  // Fast polling every 200ms until item is found
  let attempts = 0;
  poll = setInterval(() => {
    attempts++;
    const done = trySelect();
    if (done || attempts > 40) {
      stopAllScanners();
    }
  }, 200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trySelect);
  } else {
    trySelect();
  }

  // Observe DOM additions dynamically until selected
  observer = new MutationObserver(() => {
    trySelect();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
