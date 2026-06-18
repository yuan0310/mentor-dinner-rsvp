document.addEventListener('DOMContentLoaded', async () => {
  await loadEvent();
  await loadStats();
  setupForm();
});

// ── State ──
let eventData = null;
let countdownTimer = null;

// ══════════════════════════════
//  Load & render event
// ══════════════════════════════
async function loadEvent() {
  try {
    const res = await fetch('/api/event');
    eventData = await res.json();
    render(eventData);
    startCountdown(eventData.date, eventData.time);
  } catch (e) {
    console.error('Load event failed:', e);
  }
}

function render(ev) {
  // Hero
  document.getElementById('hero-title').textContent = ev.title || '導生宴';
  document.getElementById('hero-subtitle').textContent = ev.subtitle || '';

  // Deadline
  if (ev.deadline) {
    document.getElementById('deadline-text').textContent = fmtDate(ev.deadline);
  }

  // Detail rows
  const rows = [];
  if (ev.date)       rows.push({ icon: '📅', label: '日期', value: fmtDate(ev.date) });
  if (ev.time)       rows.push({ icon: '🕕', label: '時間', value: ev.time });
  if (ev.restaurant) rows.push({ icon: '🍴', label: '餐廳', value: ev.restaurant });
  if (ev.address) {
    const val = ev.mapUrl
      ? `<a href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">${esc(ev.address)}</a>`
      : esc(ev.address);
    rows.push({ icon: '📍', label: '地點', value: val, html: true });
  }
  if (ev.budgetNote) rows.push({ icon: '💴', label: '費用', value: ev.budgetNote });
  if (ev.dresscode)  rows.push({ icon: '👕', label: '服裝', value: ev.dresscode });

  document.getElementById('detail-list').innerHTML = rows.map(r => `
    <div class="detail-row">
      <div class="icon">${r.icon}</div>
      <div class="content">
        <div class="label">${r.label}</div>
        <div class="value">${r.html ? r.value : esc(r.value)}</div>
      </div>
    </div>
  `).join('');

  // Hint
  if (ev.notes) {
    document.getElementById('hint-text').textContent = ev.notes;
    document.getElementById('hint-box').style.display = 'flex';
  }

  // Contact
  if (ev.contactName) {
    const el = document.getElementById('contact-link');
    el.textContent = ev.contactName;
    if (ev.contactEmail) el.href = `mailto:${ev.contactEmail}`;
  }
}

// ══════════════════════════════
//  Countdown
// ══════════════════════════════
function startCountdown(dateStr, timeStr) {
  if (!dateStr) return;
  const target = new Date(`${dateStr}T${timeStr || '18:00'}:00`);

  function tick() {
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 864e5);
    const h = Math.floor((diff / 36e5) % 24);
    const m = Math.floor((diff / 6e4) % 60);
    const s = Math.floor((diff / 1e3) % 60);

    document.getElementById('cd-days').textContent = d;
    document.getElementById('cd-hours').textContent = h;
    document.getElementById('cd-mins').textContent = m;
    document.getElementById('cd-secs').textContent = s;

    if (diff <= 0) clearInterval(countdownTimer);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ══════════════════════════════
//  Stats
// ══════════════════════════════
async function loadStats() {
  try {
    const res = await fetch('/api/responses');
    const d = await res.json();
    document.getElementById('stat-yes').textContent = d.attendingCount;
    document.getElementById('stat-no').textContent = d.notAttendingCount;
    document.getElementById('stat-total').textContent = d.total;
  } catch (e) {
    console.error('Load stats failed:', e);
  }
}

// ══════════════════════════════
//  Form
// ══════════════════════════════
function setupForm() {
  const form = document.getElementById('rsvp-form');
  const btn  = document.getElementById('btn-submit');
  const resultEl = document.getElementById('result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('input-name').value.trim();
    const studentId = document.getElementById('input-sid').value.trim();
    const radio = document.querySelector('input[name="attending"]:checked');
    const notes = document.getElementById('input-notes').value.trim();

    if (!name) return shake(document.getElementById('input-name'));
    if (!radio) return shake(document.querySelector('.rsvp-choice'));

    const attending = radio.value === 'yes';

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, studentId, attending, dietaryNotes: notes })
      });
      const data = await res.json();

      if (data.success) {
        form.style.display = 'none';
        resultEl.classList.add('show');
        document.getElementById('result-icon').textContent = attending ? '🎉' : '📝';
        document.getElementById('result-title').textContent = attending
          ? '太好了，期待見到你！'
          : '已收到你的回覆';
        document.getElementById('result-desc').textContent = data.message;
        await loadStats();
      } else {
        alert(data.error || '送出失敗，請再試一次');
      }
    } catch {
      alert('網路錯誤，請再試一次');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    resultEl.classList.remove('show');
    form.style.display = 'block';
    form.reset();
  });
}

// ══════════════════════════════
//  Helpers
// ══════════════════════════════
function fmtDate(str) {
  const d = new Date(str + 'T00:00:00');
  const w = ['日','一','二','三','四','五','六'][d.getDay()];
  return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日（${w}）`;
}

function esc(s) {
  const el = document.createElement('div');
  el.textContent = s;
  return el.innerHTML;
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.4s ease-in-out';
  setTimeout(() => el.style.animation = '', 400);
}
