let db = null;
let countdownTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  // 活動資訊一定先顯示（不依賴任何外部服務）
  renderEvent();
  startCountdown();

  // Supabase 連線（僅用於統計和送出回覆）
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    loadStats();
  } catch (e) {
    console.warn('Supabase 未載入，統計功能暫時不可用', e);
  }

  setupForm();
});

// ══════════════════════════════
//  Render event details (純本地，不需網路)
// ══════════════════════════════
function renderEvent() {
  if (typeof EVENT === 'undefined') return;
  const ev = EVENT;

  document.getElementById('hero-title').textContent = ev.title || '導生宴';
  document.getElementById('hero-subtitle').textContent = ev.subtitle || '';

  if (ev.deadline) {
    document.getElementById('deadline-text').textContent = fmtDate(ev.deadline);
  }

  const rows = [];
  if (ev.date)       rows.push({ label: '日期', value: fmtDate(ev.date) });
  if (ev.time)       rows.push({ label: '時間', value: ev.time });
  if (ev.restaurant) rows.push({ label: '餐廳', value: ev.restaurant });
  if (ev.address) {
    const val = ev.mapUrl
      ? `<a href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">${esc(ev.address)}</a>`
      : esc(ev.address);
    rows.push({ label: '地點', value: val, html: true });
  }
  if (ev.notes) {
    document.getElementById('hint-text').textContent = ev.notes;
    document.getElementById('hint-box').style.display = 'block';
  }
  if (ev.contactName) {
    const el = document.getElementById('contact-link');
    el.textContent = ev.contactName;
    if (ev.contactEmail) el.href = `mailto:${ev.contactEmail}`;
  }

  document.getElementById('detail-list').innerHTML = rows.map(r => `
    <div class="detail-row">
      <div class="content">
        <div class="label">${r.label}</div>
        <div class="value">${r.html ? r.value : esc(r.value)}</div>
      </div>
    </div>
  `).join('');
}

// ══════════════════════════════
//  Countdown (純本地)
// ══════════════════════════════
function startCountdown() {
  if (typeof EVENT === 'undefined' || !EVENT.date) return;
  const target = new Date(`${EVENT.date}T${EVENT.time || '18:00'}:00`);

  function tick() {
    const diff = Math.max(0, target - Date.now());
    document.getElementById('cd-days').textContent  = Math.floor(diff / 864e5);
    document.getElementById('cd-hours').textContent = Math.floor((diff / 36e5) % 24);
    document.getElementById('cd-mins').textContent  = Math.floor((diff / 6e4) % 60);
    document.getElementById('cd-secs').textContent  = Math.floor((diff / 1e3) % 60);
    if (diff <= 0) clearInterval(countdownTimer);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ══════════════════════════════
//  Stats (需要 Supabase)
// ══════════════════════════════
async function loadStats() {
  if (!db) return;
  try {
    const { data, error } = await db.from('responses').select('attending');
    if (error) throw error;

    const yes = data.filter(r => r.attending).length;
    const no  = data.filter(r => !r.attending).length;
    document.getElementById('stat-yes').textContent   = yes;
    document.getElementById('stat-no').textContent    = no;
    document.getElementById('stat-total').textContent = data.length;
  } catch (e) {
    console.warn('讀取統計失敗', e);
  }
}

// ══════════════════════════════
//  RSVP Form
// ══════════════════════════════
function setupForm() {
  const form     = document.getElementById('rsvp-form');
  const btn      = document.getElementById('btn-submit');
  const resultEl = document.getElementById('result');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name      = document.getElementById('input-name').value.trim();
    const studentId = document.getElementById('input-sid').value.trim();
    const radio     = document.querySelector('input[name="attending"]:checked');
    const notes     = document.getElementById('input-notes').value.trim();

    if (!name)  return shake(document.getElementById('input-name'));
    if (!radio) return shake(document.querySelector('.rsvp-choice'));

    if (!db) { alert('系統尚未準備好，請稍後再試'); return; }

    const attending = radio.value === 'yes';

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const { error } = await db.from('responses').upsert({
        name:          name,
        student_id:    studentId,
        attending:     attending,
        dietary_notes: notes,
        submitted_at:  new Date().toISOString()
      }, { onConflict: 'name, student_id' });

      if (error) throw error;

      form.style.display = 'none';
      resultEl.classList.add('show');
      document.getElementById('result-symbol').textContent = attending ? '✓' : '—';
      document.getElementById('result-title').textContent  = attending ? '太好了，期待見到你！' : '已收到你的回覆';
      document.getElementById('result-desc').textContent   = attending ? '已確認出席，到時候見！' : '已收到你的回覆，下次再聚！';
      await loadStats();
    } catch (err) {
      alert('送出失敗：' + (err.message || '請再試一次'));
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
