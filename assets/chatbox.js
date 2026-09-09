// Wuanberri — global floating chatbox
// A persistent bottom-right widget that lives on every page. It calls
// the user's LLM (OpenAI or Anthropic) when a key is set; otherwise it
// shows a "Add a key" banner pointing to Settings. The conversation
// persists in Store between page loads (under Store.get('chatbox', [])).

(function (global) {
  'use strict';

  if (!global.Store || !global.LLM) {
    // Either the store or the LLM client failed to load. Skip quietly.
    return;
  }

  const HISTORY_KEY = 'chatbox';
  const MAX_HISTORY = 40; // ~20 user/assistant turns

  // ---------- Build the DOM ----------

  const ensureDom = () => {
    let fab = document.querySelector('.chatbox-fab');
    let panel = document.querySelector('.chatbox-panel');
    if (fab && panel) return { fab, panel };

    fab = document.createElement('button');
    fab.className = 'chatbox-fab';
    fab.setAttribute('aria-label', 'Open study coach');
    fab.setAttribute('data-global-chat', '');
    fab.textContent = 'W';

    panel = document.createElement('div');
    panel.className = 'chatbox-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Study coach chat');
    panel.innerHTML = `
      <div class="chatbox-head">
        <span class="chatbox-title">Study coach</span>
        <button class="chatbox-close" aria-label="Close chat">×</button>
      </div>
      <div class="chatbox-status" data-chatbox-status></div>
      <div class="chatbox-body" data-chatbox-body></div>
      <div class="chatbox-chips" data-chatbox-chips>
        <button class="chip" data-chip>Explain a concept</button>
        <button class="chip" data-chip>Quiz me on a topic</button>
        <button class="chip" data-chip>Build a study plan</button>
      </div>
      <form class="chatbox-input">
        <input type="text" placeholder="Ask the coach anything…" aria-label="Message" autocomplete="off" />
        <button type="submit" class="btn btn-accent">Send</button>
      </form>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    return { fab, panel };
  };

  // ---------- Status banner ----------

  const setStatus = (panel) => {
    const status = panel.querySelector('[data-chatbox-status]');
    const provider = LLM.activeProvider();
    if (provider) {
      status.style.cssText = 'font-size:11px;padding:8px 16px;border-bottom:1px solid var(--line);background:#f4faf5;color:#2f7a3e';
      status.innerHTML = `LLM mode: ${provider}. <a href="settings.html" style="color:#2f7a3e;text-decoration:underline">Settings</a>`;
    } else {
      status.style.cssText = 'font-size:11px;padding:8px 16px;border-bottom:1px solid var(--line);background:#fcfaf6;color:var(--ink-muted)';
      status.innerHTML = `Keyword mode. <a href="settings.html" style="color:var(--accent)">Add an API key</a> for real-time answers.`;
    }
  };

  // ---------- Render history ----------

  const renderHistory = (body, history) => {
    body.innerHTML = '';
    if (!history.length) {
      const intro = document.createElement('div');
      intro.className = 'bubble bot';
      intro.innerHTML = 'Hey! I\'m your study coach. Ask me to explain a concept, quiz you on a topic, or sketch a study plan.';
      body.appendChild(intro);
      return;
    }
    history.forEach((m) => {
      const b = document.createElement('div');
      b.className = 'bubble ' + (m.role === 'user' ? 'user' : 'bot');
      b.innerHTML = m.content;
      body.appendChild(b);
    });
    body.scrollTop = body.scrollHeight;
  };

  // ---------- Send a message ----------

  const send = async (panel, text) => {
    const body = panel.querySelector('[data-chatbox-body]');
    const input = panel.querySelector('.chatbox-input input');
    if (!text || !text.trim()) return;

    const history = Store.get(HISTORY_KEY, []);
    history.push({ role: 'user', content: text });
    // Cap history size so we don't blow past context windows.
    while (history.length > MAX_HISTORY) history.shift();
    Store.set(HISTORY_KEY, history);

    const u = document.createElement('div');
    u.className = 'bubble user';
    u.textContent = text;
    body.appendChild(u);
    body.scrollTop = body.scrollHeight;
    if (input) input.value = '';

    const provider = LLM.activeProvider();
    if (!provider) {
      // Local keyword mode — give a short canned reply so the chatbox
      // doesn't go silent when no key is configured.
      setTimeout(() => {
        const lower = text.toLowerCase();
        let reply;
        if (/deriv/.test(lower)) {
          reply = 'A <strong>derivative</strong> measures how a function changes. <span class="math">f\'(x) = lim<sub>h→0</sub> (f(x+h) − f(x)) / h</span>.';
        } else if (/integr|antideriv/.test(lower)) {
          reply = 'An <strong>integral</strong> accumulates change. <span class="math">∫<sub>a</sub><sup>b</sup> f(x) dx</span> = signed area under f.';
        } else if (/limit/.test(lower)) {
          reply = 'A <strong>limit</strong> asks: what does f(x) approach as x approaches something?';
        } else if (/newton|force|kinematic/.test(lower)) {
          reply = '<strong>Newton\'s second law:</strong> <span class="math">F = ma</span>.';
        } else if (/plan|study/.test(lower)) {
          reply = 'A 4-week starter: 1) Limits, 2) Derivatives, 3) Applications, 4) Integrals.';
        } else if (/quiz|practice/.test(lower)) {
          reply = 'Open the dashboard and click "Take a pop quiz" — I\'ll generate 5 questions from your weakest topics.';
        } else if (/hello|hi|hey/.test(lower)) {
          reply = 'Hey! What are you working on?';
        } else {
          reply = 'I\'m in keyword mode (no LLM key set). Add one in Settings, or try <em>explain derivatives</em> / <em>quiz me</em> / <em>make a plan</em>.';
        }
        const b = document.createElement('div');
        b.className = 'bubble bot';
        b.innerHTML = reply;
        body.appendChild(b);
        body.scrollTop = body.scrollHeight;
        const h = Store.get(HISTORY_KEY, []);
        h.push({ role: 'assistant', content: reply });
        Store.set(HISTORY_KEY, h);
      }, 200);
      return;
    }

    const typing = document.createElement('div');
    typing.className = 'bubble bot';
    typing.textContent = '…';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    try {
      const reply = await LLM.send({
        provider,
        history: history.slice(0, -1),
        userMessage: text,
        context: 'Floating chatbox. Be concise. Use LaTeX in $...$ inline, $$...$$ for blocks.',
      });
      history.push({ role: 'assistant', content: reply });
      Store.set(HISTORY_KEY, history);
      typing.innerHTML = reply;
    } catch (e) {
      typing.innerHTML = '(LLM call failed: ' + (e && e.message ? e.message : 'unknown error') + ')';
    }
    body.scrollTop = body.scrollHeight;
  };

  // ---------- Mount ----------

  const mount = () => {
    const { fab, panel } = ensureDom();
    setStatus(panel);
    const body = panel.querySelector('[data-chatbox-body]');
    renderHistory(body, Store.get(HISTORY_KEY, []));

    const open = () => { panel.classList.add('open'); setTimeout(() => panel.querySelector('.chatbox-input input')?.focus(), 50); };
    const close = () => { panel.classList.remove('open'); };
    const toggle = () => panel.classList.contains('open') ? close() : open();

    fab.addEventListener('click', toggle);
    panel.querySelector('.chatbox-close').addEventListener('click', close);

    panel.querySelector('.chatbox-input').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = panel.querySelector('.chatbox-input input');
      send(panel, input.value);
    });

    panel.querySelectorAll('[data-chip]').forEach((c) => {
      c.addEventListener('click', () => send(panel, c.textContent));
    });

    // ESC closes the panel.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('open')) close();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})(window);
