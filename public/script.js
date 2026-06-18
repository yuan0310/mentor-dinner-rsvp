// ── State ──
let eventData = null;
let countdownInterval = null;

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  await loadEvent();
  await loadStats();
  setupForm();
});

// ── Load event config ──
async function loadEvent() {
  try {
    const res = await fetch('/api/event');
    eventData = await res.json();
    renderEvent(eventData);
    startCountdown(eventData.date, eventData.time);
  } catch (err) {
    console.error('Failed to load event:', err);
  }
}

// ── Render event details ──
function renderEvent(ev) {
  // Hero
  document.getElementById('event-title').textContent = ev.title || '導生宴';
  document.getElementById('event-subtitle').textContent = ev.subtitle || '';

  // Deadline
  if (ev.deadline) {
    const d = new Date(ev.deadline + 'T23:59:59');
    document.getElementById('deadline-text').textContent = formatDate(ev.deadline);
  }

  // Detail list
  const details = [];

  if (ev.date) {
    details.push({
      icon: '📅',
      label: '日期',
      value: formatDate(ev.date)
    });
  }
  if (ev.time) {
    details.push({
      icon: '🕐',
      label: '時間',
      value: ev.time
    });
  }
  if (ev.restaurant) {
    details.push({
      icon: '🍴',
      label: '餐廳',
      value: ev.restaurant
    });
  }
  if (ev.address) {
    const mapLink = ev.mapUrl
      ? `<a href="${ev.mapUrl}" target="_blank" rel="noopener">${ev.address} ↗</a>`
      : ev.address;
    details.push({
      icon: '📍',
      label: '地點',
      value: mapLink,
      isHTML: true
    });
  }
  if (ev.budgetNote) {
    details.push({
      icon: '💰',
      label: '費用',
      value: ev.budgetNote
    });
  }
  if (ev.dresscode) {
    details.push({
      icon: '👔',
      label: '服裝',
      value: ev.dresscode
    });
  }

  const listEl = document.getElementById('detail-list');
  listEl.innerHTML = details.map(d => `
    <div class="detail-item">
      <span class="detail-icon">${d.icon}</span>
      <div class="detail-content">
        <div class="detail-label">${d.label}</div>
        <div class="detail-value">${d.isHTML ? d.value : escapeHTML(d.value)}</div>
      </div>
    </div>
  `).join('');

  // Notes
  if (ev.notes) {
    const notesBox = document.getElementById('notes-box');
    document.getElementById('notes-text').textContent = ev.notes;
    notesBox.style.display = 'flex';
  }

  // Contact
  if (ev.contactName) {
    const contactLink = document.getElementById('contact-link');
    contactLink.textContent = ev.contactName;
    if (ev.contactEmail) {
      contactLink.href = `mailto:${ev.contactEmail}`;
    }
  }
}

// ── Countdown ──
function startCountdown(dateStr, timeStr) {
  if (!dateStr) return;
  const target = new Date(`${dateStr}T${timeStr || '18:00'}:00`);

  function update() {
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) {
      document.getElementById('cd-days').textContent = '0';
      document.getElementById('cd-hours').textContent = '0';
      document.getElementById('cd-mins').textContent = '0';
      document.getElementById('cd-secs').textContent = '0';
      clearInterval(countdownInterval);
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    document.getElementById('cd-days').textContent = days;
    document.getElementById('cd-hours').textContent = hours;
    document.getElementById('cd-mins').textContent = mins;
    document.getElementById('cd-secs').textContent = secs;
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

// ── Load stats ──
async function loadStats() {
  try {
    const res = await fetch('/api/responses');
    const data = await res.json();
    document.getElementById('stat-attending').textContent = data.attendingCount;
    document.getElementById('stat-not-attending').textContent = data.notAttendingCount;
    document.getElementById('stat-total').textContent = data.total;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ── Form ──
function setupForm() {
  const form = document.getElementById('rsvp-form');
  const btn = document.getElementById('btn-submit');
  const resultEl = document.getElementById('result-message');
  const resetBtn = document.getElementById('btn-reset');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('input-name').value.trim();
    const studentId = document.getElementById('input-student-id').value.trim();
    const attendingRadio = document.querySelector('input[name="attending"]:checked');
    const dietaryNotes = document.getElementById('input-dietary').value.trim();

    if (!name) {
      shakeElement(document.getElementById('input-name'));
      return;
    }
    if (!attendingRadio) {
      shakeElement(document.querySelector('.rsvp-toggle'));
      return;
    }

    const attending = attendingRadio.value === 'yes';

    // Loading state
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, studentId, attending, dietaryNotes })
      });

      const data = await res.json();

      if (data.success) {
        // Show result
        form.style.display = 'none';
        resultEl.classList.add('show');
        document.getElementById('result-icon').textContent = attending ? '🎉' : '📝';
        document.getElementById('result-title').textContent = attending ? '太好了，期待見到你！' : '已收到你的回覆';
        document.getElementById('result-desc').textContent = data.message;

        // Refresh stats
        await loadStats();
      } else {
        alert(data.error || '送出失敗，請再試一次');
      }
    } catch (err) {
      alert('網路錯誤，請再試一次');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    resultEl.classList.remove('show');
    form.style.display = 'block';
    form.reset();
  });
}

// ── Helpers ──
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = weekdays[d.getDay()];
  return `${y} 年 ${m} 月 ${day} 日（${w}）`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight; // Trigger reflow
  el.style.animation = 'shake 0.4s ease-in-out';
  setTimeout(() => { el.style.animation = ''; }, 400);
}

// Add shake keyframes dynamically
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-8px); }
    40% { transform: translateX(8px); }
    60% { transform: translateX(-6px); }
    80% { transform: translateX(6px); }
  }
`;
document.head.appendChild(style);
