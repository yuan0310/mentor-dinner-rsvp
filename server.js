const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Load .env for local dev ──
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
} catch (e) { /* ignore */ }

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CONFIG_FILE = path.join(__dirname, 'event-config.json');

// ── Supabase ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ── Startup diagnostics ──
console.log('--- Startup ---');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'set' : 'MISSING');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? 'set' : 'MISSING');
console.log('PUBLIC_DIR exists:', fs.existsSync(PUBLIC_DIR));
console.log('---------------');

// ── Helpers ──
function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

// ── API Routes ──

// Health check
app.get('/api/health', async (req, res) => {
  const { data, error } = await supabase.from('responses').select('id', { count: 'exact', head: true });
  res.json({
    status: error ? 'db_error' : 'ok',
    dbConnected: !error,
    publicDir: fs.existsSync(PUBLIC_DIR),
    error: error ? error.message : null
  });
});

// Event info
app.get('/api/event', (req, res) => {
  try {
    res.json(readConfig());
  } catch (err) {
    res.status(500).json({ error: '無法讀取活動資訊' });
  }
});

// Get all responses
app.get('/api/responses', async (req, res) => {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .order('submitted_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const responses = data || [];
  const attending = responses.filter(r => r.attending);
  const notAttending = responses.filter(r => !r.attending);

  res.json({
    total: responses.length,
    attendingCount: attending.length,
    notAttendingCount: notAttending.length,
    responses: responses.map(r => ({
      id: r.id,
      name: r.name,
      studentId: r.student_id,
      attending: r.attending,
      dietaryNotes: r.dietary_notes,
      submittedAt: r.submitted_at
    }))
  });
});

// Submit RSVP
app.post('/api/rsvp', async (req, res) => {
  const { name, studentId, attending, dietaryNotes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請填寫姓名' });
  }

  const row = {
    name: name.trim(),
    student_id: (studentId || '').trim(),
    attending: !!attending,
    dietary_notes: (dietaryNotes || '').trim(),
    submitted_at: new Date().toISOString()
  };

  // Upsert: update if same name + student_id exists
  const { data, error } = await supabase
    .from('responses')
    .upsert(row, { onConflict: 'name, student_id' })
    .select();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    success: true,
    message: attending
      ? '已確認出席，期待見到你！'
      : '已收到你的回覆，下次再聚！'
  });
});

// Delete a response by ID
app.delete('/api/responses/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const { error } = await supabase
    .from('responses')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// Fallback: serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`導生宴 RSVP 系統已啟動 → http://localhost:${PORT}`);
});
