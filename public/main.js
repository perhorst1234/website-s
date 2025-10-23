const STORAGE_KEY = 'codex-timeline-state-v1';
const DEFAULT_PREFERENCES = {
  showNotes: true,
  showFiles: true,
  showChecklist: true,
  theme: 'dark',
};

const COLOR_PALETTE = ['#38bdf8', '#818cf8', '#f472b6', '#22d3ee', '#f97316', '#a855f7'];

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatMultiline = (value = '') => escapeHtml(value).replace(/\n/g, '<br />');

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const uniqueId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const createState = () => ({
  projects: [],
  preferences: { ...DEFAULT_PREFERENCES },
  selectedProjectId: null,
  selectedPhaseId: null,
});

const normalizeStateShape = (rawState) => {
  const state = { ...rawState };
  state.projects = (state.projects || []).map((project, projectIndex) => {
    const phases = Array.isArray(project.phases) ? project.phases : [];
    return {
      id: project.id || uniqueId(),
      name: String(project.name || `Project ${projectIndex + 1}`),
      type: project.type === 'physical' ? 'physical' : 'digital',
      description: String(project.description || ''),
      createdAt: project.createdAt || new Date().toISOString(),
      phases: phases.map((phase, phaseIndex) => {
        const notes = Array.isArray(phase.notes) ? phase.notes : [];
        const files = Array.isArray(phase.files) ? phase.files : [];
        const checklist = Array.isArray(phase.checklist) ? phase.checklist : [];
        return {
          id: phase.id || uniqueId(),
          name: String(phase.name || `Nieuwe fase ${phaseIndex + 1}`),
          description: String(phase.description || ''),
          startDate: phase.startDate || '',
          endDate: phase.endDate || '',
          progress: clamp(Number(phase.progress) || 0, 0, 100),
          color: phase.color || COLOR_PALETTE[phaseIndex % COLOR_PALETTE.length],
          notes: notes.map((note) => ({
            id: note.id || uniqueId(),
            title: String(note.title || ''),
            content: String(note.content || ''),
            createdAt: note.createdAt || new Date().toISOString(),
          })),
          files: files.map((file) => ({
            id: file.id || uniqueId(),
            name: String(file.name || ''),
            link: String(file.link || ''),
            note: String(file.note || ''),
            createdAt: file.createdAt || new Date().toISOString(),
          })),
          checklist: checklist.map((item) => ({
            id: item.id || uniqueId(),
            text: String(item.text || ''),
            done: Boolean(item.done),
          })),
          createdAt: phase.createdAt || new Date().toISOString(),
        };
      }),
    };
  });
  return state;
};

const loadState = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createState();
  try {
    const parsed = JSON.parse(stored);
    return {
      ...createState(),
      ...parsed,
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed?.preferences || {}) },
    };
  } catch (error) {
    console.warn('Kon opgeslagen staat niet lezen, begin vers.', error);
    return createState();
  }
};

const ready = () => {
  const root = document.documentElement;
  const projectListEl = document.getElementById('project-list');
  const projectForm = document.getElementById('project-form');
  const toggleProjectFormButton = document.getElementById('toggle-project-form');
  const emptyState = document.getElementById('empty-state');
  const projectWorkspace = document.getElementById('project-workspace');
  const projectTitle = document.getElementById('project-title');
  const projectDescription = document.getElementById('project-description');
  const addPhaseButton = document.getElementById('add-phase-btn');
  const timelineEl = document.getElementById('timeline');
  const phaseDetailEl = document.getElementById('phase-detail');
  const themeToggle = document.getElementById('theme-toggle');
  const viewToggleInputs = document.querySelectorAll('.view-toggles input[type="checkbox"]');

  let state = normalizeStateShape(loadState());

  const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const saveAndRender = () => {
    ensureSelections();
    saveState();
    render();
  };

  const getProject = (projectId) => state.projects.find((project) => project.id === projectId) || null;

  const getSelectedProject = () => getProject(state.selectedProjectId);

  const getSelectedPhase = () => {
    const project = getSelectedProject();
    if (!project) return null;
    return project.phases.find((phase) => phase.id === state.selectedPhaseId) || null;
  };

  const ensureSelections = () => {
    if (!state.projects.length) {
      state.selectedProjectId = null;
      state.selectedPhaseId = null;
      return;
    }
    const project = getSelectedProject();
    if (!project) {
      state.selectedProjectId = state.projects[0].id;
    }
    const currentProject = getSelectedProject();
    if (!currentProject) {
      state.selectedPhaseId = null;
      return;
    }
    if (!currentProject.phases.length) {
      state.selectedPhaseId = null;
    } else if (!currentProject.phases.some((phase) => phase.id === state.selectedPhaseId)) {
      state.selectedPhaseId = currentProject.phases[0].id;
    }
  };

  const applyTheme = () => {
    root.classList.toggle('light', state.preferences.theme === 'light');
    themeToggle.innerHTML = state.preferences.theme === 'light' ? '<span aria-hidden="true">🌞</span>' : '<span aria-hidden="true">🌙</span>';
    themeToggle.setAttribute('aria-label', state.preferences.theme === 'light' ? 'Schakel naar donker thema' : 'Schakel naar licht thema');
  };

  const createPhase = (index = 0) => ({
    id: uniqueId(),
    name: `Nieuwe fase ${index + 1}`,
    description: '',
    startDate: '',
    endDate: '',
    progress: 0,
    color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    notes: [],
    files: [],
    checklist: [],
    createdAt: new Date().toISOString(),
  });

  const renderProjects = () => {
    projectListEl.innerHTML = '';
    if (!state.projects.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'Nog geen projecten. Voeg er een toe!';
      projectListEl.appendChild(empty);
      return;
    }
    state.projects.forEach((project) => {
      const item = document.createElement('li');
      item.className = `project-item${project.id === state.selectedProjectId ? ' active' : ''}`;
      item.dataset.projectId = project.id;
      const phaseCount = project.phases.length;
      const progress =
        phaseCount === 0
          ? 0
          : Math.round(
              project.phases.reduce((total, phase) => total + clamp(Number(phase.progress) || 0, 0, 100), 0) /
                phaseCount
            );

      item.innerHTML = `
        <h3>${escapeHtml(project.name)}</h3>
        <span>${phaseCount} fases • ${project.type === 'physical' ? 'Fysiek' : 'Digitaal'}</span>
        <span>Gem. voortgang ${progress}%</span>
      `;

      projectListEl.appendChild(item);
    });
  };

  const renderTimeline = (project) => {
    timelineEl.innerHTML = '';
    if (!project.phases.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.innerHTML =
        'Nog geen fases. Klik op “Fase toevoegen” om de tijdbalk te starten.';
      timelineEl.appendChild(empty);
      return;
    }

    project.phases.forEach((phase, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'timeline-phase';

      const marker = document.createElement('span');
      marker.className = 'timeline-marker';
      marker.style.background = phase.color || COLOR_PALETTE[index % COLOR_PALETTE.length];
      listItem.appendChild(marker);

      const card = document.createElement('article');
      card.className = `timeline-card${phase.id === state.selectedPhaseId ? ' active' : ''}`;
      card.dataset.phaseId = phase.id;

      const start = formatDate(phase.startDate);
      const end = formatDate(phase.endDate);
      const checklistStats = phase.checklist.length
        ? `${phase.checklist.filter((item) => item.done).length}/${phase.checklist.length} stappen`
        : null;

      const chips = [];
      if (state.preferences.showNotes && phase.notes.length) {
        chips.push(
          `<span class="chip note" title="Notities">${phase.notes.length} notitie${phase.notes.length === 1 ? '' : 's'}</span>`
        );
      }
      if (state.preferences.showFiles && phase.files.length) {
        chips.push(
          `<span class="chip file" title="Bestanden">${phase.files.length} bestand${phase.files.length === 1 ? '' : 'en'}</span>`
        );
      }
      if (state.preferences.showChecklist && checklistStats) {
        chips.push(`<span class="chip checklist" title="Checklist">${checklistStats}</span>`);
      }

      card.innerHTML = `
        <header>
          <div>
            <h4>${escapeHtml(phase.name)}</h4>
            <div class="timeline-meta">
              ${start ? `<span>Start: ${escapeHtml(start)}</span>` : ''}
              ${end ? `<span>Eind: ${escapeHtml(end)}</span>` : ''}
            </div>
          </div>
          <span class="progress-chip">${clamp(Number(phase.progress) || 0, 0, 100)}%</span>
        </header>
        ${phase.description ? `<p class="muted">${formatMultiline(phase.description)}</p>` : ''}
        ${chips.length ? `<div class="timeline-chips">${chips.join('')}</div>` : ''}
      `;

      listItem.appendChild(card);
      timelineEl.appendChild(listItem);
    });
  };

  const renderPhaseDetail = (project) => {
    const phase = getSelectedPhase();
    if (!project.phases.length) {
      phaseDetailEl.innerHTML = `
        <div>
          <h3>Tijdens het bouwen…</h3>
          <p class="muted">Selecteer of maak een fase om notities, bestanden en checklist-items toe te voegen.</p>
        </div>
      `;
      return;
    }
    if (!phase) {
      phaseDetailEl.innerHTML = `
        <div>
          <h3>Kies een fase</h3>
          <p class="muted">Klik op een fase in de tijdbalk om details te bekijken.</p>
        </div>
      `;
      return;
    }

    const checklistStats =
      phase.checklist.length > 0
        ? `${phase.checklist.filter((item) => item.done).length} van ${phase.checklist.length} voltooid`
        : 'Nog geen stappen vastgelegd';

    phaseDetailEl.innerHTML = `
      <header>
        <span class="muted">Fase ${project.phases.findIndex((item) => item.id === phase.id) + 1}</span>
        <h3>${escapeHtml(phase.name)}</h3>
        <p class="muted">${checklistStats}</p>
      </header>
      <form data-action="update-phase">
        <label>
          <span>Naam</span>
          <input name="name" value="${escapeAttribute(phase.name)}" required />
        </label>
        <label>
          <span>Omschrijving</span>
          <textarea name="description" rows="3" placeholder="Wat gebeurt er in deze fase?">${escapeHtml(
            phase.description || ''
          )}</textarea>
        </label>
        <div class="range-field">
          <label for="progress-range"><span>Voortgang</span></label>
          <input id="progress-range" name="progress" type="range" min="0" max="100" value="${clamp(
            Number(phase.progress) || 0,
            0,
            100
          )}" />
          <output>${clamp(Number(phase.progress) || 0, 0, 100)}%</output>
        </div>
        <div class="date-grid">
          <label>
            <span>Startdatum</span>
            <input name="startDate" type="date" value="${escapeAttribute(phase.startDate || '')}" />
          </label>
          <label>
            <span>Einddatum</span>
            <input name="endDate" type="date" value="${escapeAttribute(phase.endDate || '')}" />
          </label>
        </div>
        <div class="color-field">
          <label>
            <span>Kleur</span>
            <input name="color" type="color" value="${escapeAttribute(phase.color || '#38bdf8')}" />
          </label>
        </div>
        <div class="form-actions">
          <button type="submit">Wijzigingen bewaren</button>
          <button type="button" data-action="delete-phase">Fase verwijderen</button>
        </div>
      </form>
      ${renderNotesSection(phase)}
      ${renderFilesSection(phase)}
      ${renderChecklistSection(phase)}
    `;
  };

  const escapeAttribute = (value) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  };

  const renderNotesSection = (phase) => {
    const hidden = state.preferences.showNotes ? '' : '<p class="muted">Notities zijn verborgen in de tijdbalk.</p>';
    const entries = phase.notes
      .map(
        (note) => `
          <article class="entry-card" data-note-id="${note.id}">
            <header>
              <h4>${escapeHtml(note.title || 'Onbenoemde notitie')}</h4>
              <time>${formatDate(note.createdAt) || ''}</time>
            </header>
            ${note.content ? `<p class="muted">${formatMultiline(note.content)}</p>` : ''}
            <button type="button" data-action="remove-note">Verwijderen</button>
          </article>
        `
      )
      .join('');
    return `
      <section>
        <header>
          <h4>Notities</h4>
          ${hidden}
        </header>
        <form data-action="add-note">
          <label>
            <span>Titel</span>
            <input name="title" placeholder="Logboek regel" />
          </label>
          <label>
            <span>Notitie</span>
            <textarea name="content" rows="3" placeholder="Wat wil je onthouden?"></textarea>
          </label>
          <button type="submit">Notitie toevoegen</button>
        </form>
        <div class="entry-list">${entries || '<p class="muted">Nog geen notities.</p>'}</div>
      </section>
    `;
  };

  const renderFilesSection = (phase) => {
    const hidden = state.preferences.showFiles ? '' : '<p class="muted">Bestanden zijn verborgen in de tijdbalk.</p>';
    const entries = phase.files
      .map(
        (file) => `
          <article class="entry-card" data-file-id="${file.id}">
            <header>
              <h4>${escapeHtml(file.name || 'Bestand')}</h4>
              <time>${formatDate(file.createdAt) || ''}</time>
            </header>
            ${file.link ? `<p><a href="${escapeAttribute(file.link)}" target="_blank" rel="noopener">Open link</a></p>` : ''}
            ${file.note ? `<p class="muted">${formatMultiline(file.note)}</p>` : ''}
            <button type="button" data-action="remove-file">Verwijderen</button>
          </article>
        `
      )
      .join('');
    return `
      <section>
        <header>
          <h4>Bestanden &amp; referenties</h4>
          ${hidden}
        </header>
        <form data-action="add-file">
          <label>
            <span>Naam</span>
            <input name="name" placeholder="Render of schema" />
          </label>
          <label>
            <span>Link (optioneel)</span>
            <input name="link" type="url" placeholder="https://..." />
          </label>
          <label>
            <span>Opmerking</span>
            <textarea name="note" rows="2" placeholder="Waarom is dit bestand belangrijk?"></textarea>
          </label>
          <button type="submit">Bestand toevoegen</button>
        </form>
        <div class="entry-list">${entries || '<p class="muted">Nog geen bestanden.</p>'}</div>
      </section>
    `;
  };

  const renderChecklistSection = (phase) => {
    const hidden = state.preferences.showChecklist
      ? ''
      : '<p class="muted">Checklist is verborgen in de tijdbalk.</p>';
    const items = phase.checklist
      .map(
        (item) => `
          <label class="checklist-item" data-checklist-id="${item.id}">
            <input type="checkbox" ${item.done ? 'checked' : ''} />
            <span>${escapeHtml(item.text)}</span>
            <button type="button" data-action="remove-check">Verwijderen</button>
          </label>
        `
      )
      .join('');
    return `
      <section>
        <header>
          <h4>Checklist</h4>
          ${hidden}
        </header>
        <form data-action="add-check">
          <label>
            <span>Stap</span>
            <input name="text" placeholder="Controleer kabels" required />
          </label>
          <button type="submit">Stap toevoegen</button>
        </form>
        <div class="checklist">${items || '<p class="muted">Nog geen checklist.</p>'}</div>
        ${phase.checklist.length ? '<button class="clear-button" data-action="clear-checklist">Checklist legen</button>' : ''}
      </section>
    `;
  };

  const render = () => {
    applyTheme();
    renderProjects();
    const project = getSelectedProject();
    if (!project) {
      emptyState.hidden = false;
      projectWorkspace.hidden = true;
      return;
    }
    emptyState.hidden = true;
    projectWorkspace.hidden = false;
    projectTitle.textContent = project.name;
    projectDescription.textContent = project.description || 'Voeg een korte beschrijving toe via het projectmenu.';

    viewToggleInputs.forEach((input) => {
      const pref = input.dataset.pref;
      input.checked = !!state.preferences[pref];
    });

    renderTimeline(project);
    renderPhaseDetail(project);
  };

  toggleProjectFormButton.addEventListener('click', () => {
    const hidden = projectForm.hasAttribute('hidden');
    if (hidden) {
      projectForm.removeAttribute('hidden');
      projectForm.elements.name?.focus();
    } else {
      projectForm.setAttribute('hidden', '');
    }
  });

  projectForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(projectForm);
    const name = String(formData.get('name') || '').trim();
    if (!name) return;
    const project = {
      id: uniqueId(),
      name,
      type: formData.get('type') === 'physical' ? 'physical' : 'digital',
      description: String(formData.get('description') || '').trim(),
      createdAt: new Date().toISOString(),
      phases: [],
    };
    state.projects.push(project);
    state.selectedProjectId = project.id;
    state.selectedPhaseId = null;
    projectForm.reset();
    projectForm.setAttribute('hidden', '');
    saveAndRender();
  });

  projectListEl.addEventListener('click', (event) => {
    const item = event.target.closest('.project-item');
    if (!item) return;
    const projectId = item.dataset.projectId;
    if (!projectId) return;
    state.selectedProjectId = projectId;
    state.selectedPhaseId = null;
    saveAndRender();
  });

  addPhaseButton.addEventListener('click', () => {
    const project = getSelectedProject();
    if (!project) return;
    const phase = createPhase(project.phases.length);
    project.phases.push(phase);
    state.selectedPhaseId = phase.id;
    saveAndRender();
  });

  timelineEl.addEventListener('click', (event) => {
    const card = event.target.closest('.timeline-card');
    if (!card) return;
    const phaseId = card.dataset.phaseId;
    if (!phaseId) return;
    state.selectedPhaseId = phaseId;
    saveAndRender();
  });

  viewToggleInputs.forEach((input) => {
    input.addEventListener('change', () => {
      const pref = input.dataset.pref;
      state.preferences[pref] = input.checked;
      saveAndRender();
    });
  });

  themeToggle.addEventListener('click', () => {
    state.preferences.theme = state.preferences.theme === 'light' ? 'dark' : 'light';
    saveAndRender();
  });

  phaseDetailEl.addEventListener('input', (event) => {
    if (event.target.matches('input[type="range"][name="progress"]')) {
      const output = event.target.closest('.range-field')?.querySelector('output');
      if (output) {
        output.textContent = `${event.target.value}%`;
      }
    }
  });

  phaseDetailEl.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault();
    const project = getSelectedProject();
    const phase = getSelectedPhase();
    if (!project || !phase) return;
    const action = form.dataset.action;
    const formData = new FormData(form);

    switch (action) {
      case 'update-phase': {
        phase.name = String(formData.get('name') || '').trim() || phase.name;
        phase.description = String(formData.get('description') || '').trim();
        phase.progress = clamp(Number(formData.get('progress')) || 0, 0, 100);
        phase.startDate = formData.get('startDate') ? String(formData.get('startDate')) : '';
        phase.endDate = formData.get('endDate') ? String(formData.get('endDate')) : '';
        phase.color = formData.get('color') ? String(formData.get('color')) : phase.color;
        saveAndRender();
        break;
      }
      case 'add-note': {
        const title = String(formData.get('title') || '').trim();
        const content = String(formData.get('content') || '').trim();
        if (!title && !content) return;
        phase.notes.unshift({
          id: uniqueId(),
          title,
          content,
          createdAt: new Date().toISOString(),
        });
        form.reset();
        saveAndRender();
        break;
      }
      case 'add-file': {
        const name = String(formData.get('name') || '').trim();
        const link = String(formData.get('link') || '').trim();
        const note = String(formData.get('note') || '').trim();
        if (!name && !link && !note) return;
        phase.files.unshift({
          id: uniqueId(),
          name,
          link,
          note,
          createdAt: new Date().toISOString(),
        });
        form.reset();
        saveAndRender();
        break;
      }
      case 'add-check': {
        const text = String(formData.get('text') || '').trim();
        if (!text) return;
        phase.checklist.push({
          id: uniqueId(),
          text,
          done: false,
        });
        form.reset();
        saveAndRender();
        break;
      }
      default:
        break;
    }
  });

  phaseDetailEl.addEventListener('click', (event) => {
    const project = getSelectedProject();
    const phase = getSelectedPhase();
    if (!project || !phase) return;

    if (event.target.matches('[data-action="delete-phase"]')) {
      const confirmDelete = confirm('Weet je zeker dat je deze fase wilt verwijderen?');
      if (!confirmDelete) return;
      project.phases = project.phases.filter((item) => item.id !== phase.id);
      state.selectedPhaseId = project.phases[0]?.id || null;
      saveAndRender();
      return;
    }

    const noteCard = event.target.closest('[data-note-id]');
    if (noteCard && event.target.matches('[data-action="remove-note"]')) {
      const noteId = noteCard.dataset.noteId;
      phase.notes = phase.notes.filter((note) => note.id !== noteId);
      saveAndRender();
      return;
    }

    const fileCard = event.target.closest('[data-file-id]');
    if (fileCard && event.target.matches('[data-action="remove-file"]')) {
      const fileId = fileCard.dataset.fileId;
      phase.files = phase.files.filter((file) => file.id !== fileId);
      saveAndRender();
      return;
    }

    const checklistItem = event.target.closest('[data-checklist-id]');
    if (checklistItem && event.target.matches('[data-action="remove-check"]')) {
      const id = checklistItem.dataset.checklistId;
      phase.checklist = phase.checklist.filter((item) => item.id !== id);
      saveAndRender();
      return;
    }

    if (event.target.matches('[data-action="clear-checklist"]')) {
      const confirmClear = confirm('Checklist legen?');
      if (!confirmClear) return;
      phase.checklist = [];
      saveAndRender();
    }
  });

  phaseDetailEl.addEventListener('change', (event) => {
    const project = getSelectedProject();
    const phase = getSelectedPhase();
    if (!project || !phase) return;
    if (event.target.matches('[data-checklist-id] input[type="checkbox"], .checklist-item input[type="checkbox"]')) {
      const container = event.target.closest('[data-checklist-id]');
      if (!container) return;
      const id = container.dataset.checklistId;
      const item = phase.checklist.find((entry) => entry.id === id);
      if (!item) return;
      item.done = event.target.checked;
      saveAndRender();
    }
  });

  ensureSelections();
  saveState();
  render();
};

document.addEventListener('DOMContentLoaded', ready);
