const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');
const CONFIG_FILE = path.join(__dirname, 'event-config.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');

// Helper: read responses
function readResponses() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Helper: write responses
function writeResponses(responses) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2), 'utf-8');
}

// Helper: read event config
function readConfig() {
  const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
  return JSON.parse(data);
}

// GET /api/event — return event info
app.get('/api/event', (req, res) => {
  try {
    const config = readConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: '無法讀取活動資訊' });
  }
});

// GET /api/responses — return all RSVP responses (for admin)
app.get('/api/responses', (req, res) => {
  const responses = readResponses();
  const attending = responses.filter(r => r.attending);
  const notAttending = responses.filter(r => !r.attending);
  res.json({
    total: responses.length,
    attendingCount: attending.length,
    notAttendingCount: notAttending.length,
    responses
  });
});

// POST /api/rsvp — submit an RSVP
app.post('/api/rsvp', (req, res) => {
  const { name, studentId, attending, dietaryNotes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請填寫姓名' });
  }

  const responses = readResponses();

  // Check if this student already responded (by name + studentId)
  const existingIdx = responses.findIndex(
    r => r.name === name.trim() && r.studentId === (studentId || '').trim()
  );

  const entry = {
    name: name.trim(),
    studentId: (studentId || '').trim(),
    attending: !!attending,
    dietaryNotes: (dietaryNotes || '').trim(),
    submittedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    responses[existingIdx] = entry;
  } else {
    responses.push(entry);
  }

  writeResponses(responses);

  res.json({
    success: true,
    message: attending ? '已確認出席，期待見到你！🎉' : '已收到你的回覆，下次再聚！',
    entry
  });
});

// DELETE /api/responses/:index — delete a response (admin)
app.delete('/api/responses/:index', (req, res) => {
  const responses = readResponses();
  const idx = parseInt(req.params.index, 10);
  if (idx < 0 || idx >= responses.length) {
    return res.status(404).json({ error: '找不到該筆回覆' });
  }
  responses.splice(idx, 1);
  writeResponses(responses);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🍽️  導生宴 RSVP 系統已啟動`);
  console.log(`📋 學生頁面: http://localhost:${PORT}`);
  console.log(`📊 管理後台: http://localhost:${PORT}/admin.html`);
});
