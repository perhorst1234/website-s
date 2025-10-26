const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'projects.json');

const defaultState = {
  projects: [],
  preferences: {},
  selectedProjectId: null,
  selectedPhaseId: null,
};

const generateId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const ensureStateFile = () => {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState, null, 2), 'utf8');
  }
};

const readState = () => {
  ensureStateFile();
  try {
    const contents = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(contents);
    return {
      ...defaultState,
      ...parsed,
      projects: Array.isArray(parsed?.projects) ? parsed.projects : [],
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Kon projectstaat niet lezen, start opnieuw.', error);
    return { ...defaultState };
  }
};

const writeState = (state) => {
  ensureStateFile();
  const cleanState = {
    ...defaultState,
    ...state,
    projects: Array.isArray(state?.projects) ? state.projects : [],
  };
  fs.writeFileSync(stateFile, JSON.stringify(cleanState, null, 2), 'utf8');
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '-');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

app.use(express.json());
ensureStateFile();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

app.get('/api/state', (_req, res) => {
  const state = readState();
  res.json(state);
});

app.post('/api/state', (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Ongeldige projectdata.' });
  }

  const state = {
    projects: Array.isArray(incoming.projects)
      ? incoming.projects.map((project) => ({
          ...project,
          id: project?.id || generateId(),
        }))
      : [],
    preferences: incoming.preferences && typeof incoming.preferences === 'object' ? incoming.preferences : {},
    selectedProjectId: incoming.selectedProjectId || null,
    selectedPhaseId: incoming.selectedPhaseId || null,
  };

  try {
    writeState(state);
    return res.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Kon projectstaat niet opslaan.', error);
    return res.status(500).json({ error: 'Opslaan mislukt.' });
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Geen bestand ontvangen.' });
  }

  res.json({
    originalName: req.file.originalname,
    storedName: req.file.filename,
    path: `/uploads/${req.file.filename}`,
  });
});

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Er is iets misgegaan tijdens het uploaden.' });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server draait op poort ${PORT}`);
});
