const STORAGE_KEY = 'pm-codex-state-v1';
const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const FULL_DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const filters = {
  search: '',
  type: 'all',
  status: 'all',
  deadline: 'all',
};

const defaultState = () => ({
  projects: [],
  selectedProjectId: null,
});

const ready = () => {
  const projectForm = document.getElementById('project-form');
  const projectListEl = document.getElementById('project-list');
  const projectDetailEl = document.getElementById('project-detail');
  const focusListEl = document.getElementById('focus-items');
  const todaySummaryEl = document.getElementById('today-summary');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const deadlineFilter = document.getElementById('deadline-filter');
  const typeFilter = document.getElementById('type-filter');
  const themeToggle = document.getElementById('theme-toggle');
  const emptyTemplate = document.getElementById('project-empty-template');

  let state = loadState();
  let selectedProjectId = state.selectedProjectId || (state.projects[0]?.id ?? null);

  function loadProject(projectId) {
    return state.projects.find((project) => project.id === projectId) || null;
  }

  function saveStateAndRender() {
    state.selectedProjectId = selectedProjectId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
  }

  function renderAll() {
    renderProjectList();
    renderProjectDetail();
    renderFocusView();
    renderTodaySummary();
  }

  function renderProjectList() {
    projectListEl.innerHTML = '';
    const filtered = state.projects.filter(projectMatchesFilters);

    if (!filtered.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'muted';
      emptyItem.textContent = 'No projects found. Adjust your filters or create a new project.';
      projectListEl.appendChild(emptyItem);
      return;
    }

    filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    filtered.forEach((project) => {
      const li = document.createElement('li');
      li.className = `project-item${project.id === selectedProjectId ? ' active' : ''}`;
      li.dataset.projectId = project.id;

      const { progress, totalTasks, openTasks } = projectProgress(project);
      const overdueCount = countOverdueTasks(project);

      li.innerHTML = `
        <div class="project-title">${escapeHtml(project.name)}</div>
        <div class="project-meta">
          <span>${project.type.charAt(0).toUpperCase()}${project.type.slice(1)}</span>
          <span>${totalTasks} tasks • ${project.phases.length} phases</span>
        </div>
        <div class="project-meta">
          <span>${openTasks} active • ${overdueCount} overdue</span>
          <span>${progress}% progress</span>
        </div>
        <div class="progress-bar"><span style="width:${progress}%"></span></div>
      `;

      projectListEl.appendChild(li);
    });
  }

  function renderProjectDetail() {
    const project = loadProject(selectedProjectId);
    if (!project) {
      projectDetailEl.innerHTML = emptyTemplate.innerHTML;
      return;
    }

    normalizeProject(project);

    const progressInfo = projectProgress(project);

    projectDetailEl.innerHTML = `
      <article class="project-overview">
        <header class="panel-header">
          <div>
            <h2>${escapeHtml(project.name)}</h2>
            <p class="muted">${escapeHtml(project.description || 'No description yet.')} </p>
            <div class="tag-group">
              <span class="tag">${escapeHtml(capitalize(project.type))} project</span>
              <span class="tag">${project.phases.length} phases</span>
              <span class="tag">${progressInfo.progress}% overall progress</span>
            </div>
          </div>
          <div class="project-actions">
            ${project.github ? `<a class="tag" href="${escapeAttribute(project.github)}" target="_blank" rel="noopener noreferrer">GitHub connected</a>` : '<span class="tag">GitHub not linked</span>'}
            <label class="tag">
              <input type="checkbox" data-action="toggle-share" ${project.share?.enabled ? 'checked' : ''} />
              Share via read-only link
            </label>
            ${project.share?.enabled ? `<a class="read-only-link" href="${escapeAttribute(shareUrl(project))}" target="_blank" rel="noopener noreferrer">${escapeHtml(shareUrl(project))}</a>` : '<p class="muted">Private by default. Enable sharing to generate a link.</p>'}
          </div>
        </header>
        <section class="split-grid">
          <div class="focus-card">
            <strong>Momentum</strong>
            <div class="progress-bar"><span style="width:${progressInfo.progress}%"></span></div>
            <p class="status">${progressInfo.progress}% avg phase completion</p>
          </div>
          <div class="focus-card">
            <strong>Active tasks</strong>
            <p class="status">${progressInfo.openTasks} of ${progressInfo.totalTasks} open</p>
            <p class="status">${countOverdueTasks(project)} overdue • ${countDueToday(project)} due today</p>
          </div>
          <div class="focus-card">
            <strong>Phase coverage</strong>
            <p class="status">${project.phases.filter((phase) => phase.tasks.length > 0).length} phases with tasks</p>
            <p class="status">${project.notes.length} linked notes • ${project.files.length} files</p>
          </div>
        </section>
      </article>

      <section class="project-section">
        <header class="panel-header">
          <h3>Phases &amp; tasks</h3>
          <p class="muted">Track phases, attach tasks, and steer progress manually.</p>
        </header>
        ${renderAddPhaseForm(project)}
        <div class="split-grid">
          ${project.phases.map((phase) => renderPhaseCard(project, phase)).join('') || '<p class="muted">Add a phase to start planning your roadmap.</p>'}
        </div>
      </section>

      <section class="project-section">
        <header class="panel-header">
          <h3>File library</h3>
          <p class="muted">Store markdown, notes, code snippets, or embed reference files and images.</p>
        </header>
        ${renderAddFileForm(project)}
        <div class="split-grid">
          ${project.files.map((file) => renderFileCard(project, file)).join('') || '<p class="muted">No files yet. Capture your research, BOM spreadsheets, or reference docs.</p>'}
        </div>
      </section>

      <section class="project-section">
        <header class="panel-header">
          <h3>Notes &amp; timeline</h3>
          <p class="muted">Log learnings, decisions, and link them to phases.</p>
        </header>
        ${renderAddNoteForm(project)}
        <div class="split-grid">
          ${project.notes.map((note) => renderNoteCard(project, note)).join('') || '<p class="muted">Capture the narrative behind your build or launch.</p>'}
        </div>
      </section>

      ${project.type === 'physical' ? renderPhysicalSections(project) : ''}
      ${project.type === 'digital' ? renderDigitalSections(project) : ''}
    `;
  }

  function renderAddPhaseForm(project) {
    return `
      <form class="form-inline" data-action="add-phase">
        <label>
          <span>Phase name</span>
          <input name="name" required placeholder="e.g. Ideation" />
        </label>
        <label>
          <span>Priority</span>
          <select name="priority">
            <option value="high">High</option>
            <option value="medium" selected>Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <span>Deadline</span>
          <input type="date" name="deadline" />
        </label>
        <button type="submit">Add phase</button>
      </form>
    `;
  }

  function renderPhaseCard(project, phase) {
    const autoProgress = phase.tasks.length
      ? Math.round((phase.tasks.filter((task) => task.status === 'done').length / phase.tasks.length) * 100)
      : 0;
    const manualProgress = typeof phase.manualProgress === 'number' ? phase.manualProgress : autoProgress;
    const manualLabel = manualProgress ?? 0;
    const autoLabel = autoProgress;
    const deadlineInfo = deadlineLabel(phase.deadline);
    const filteredTasks = phase.tasks.filter((task) => taskMatchesFilters(task));

    return `
      <article class="phase-card" data-phase-id="${phase.id}">
        <header class="phase-header">
          <div>
            <h3>${escapeHtml(phase.name)}</h3>
            <div class="tag-group">
              <span class="badge ${phase.priority}">${capitalize(phase.priority)}</span>
              ${phase.deadline ? `<span class="badge ${deadlineInfo.status}">Due ${escapeHtml(deadlineInfo.label)}</span>` : ''}
            </div>
          </div>
          <div class="stack" style="min-width:160px;">
            <label>
              <span>Manual progress: <strong data-phase-progress="${phase.id}">${manualLabel}</strong>%</span>
              <input type="range" min="0" max="100" step="5" value="${manualProgress}" data-action="phase-progress" data-phase-id="${phase.id}" />
            </label>
            <small class="muted">Auto: ${autoLabel}% complete</small>
          </div>
        </header>

        <section class="tasks">
          ${filteredTasks.map((task) => renderTaskItem(project, phase, task)).join('') || '<p class="muted">No tasks match the current filters.</p>'}
        </section>

        <form class="stack" data-action="add-task" data-phase-id="${phase.id}">
          <fieldset>
            <legend>Add task</legend>
            <div class="form-inline">
              <label>
                <span>Task</span>
                <input name="title" required placeholder="Define the next meaningful step" />
              </label>
              <label>
                <span>Label</span>
                <input name="label" placeholder="Prototype, QA, etc." />
              </label>
              <label>
                <span>Priority</span>
                <select name="priority">
                  <option value="high">High</option>
                  <option value="medium" selected>Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label>
                <span>Due date</span>
                <input type="date" name="dueDate" />
              </label>
            </div>
            <label>
              <span>Notes</span>
              <textarea name="notes" rows="2" placeholder="Context, blockers, resources"></textarea>
            </label>
          </fieldset>
          <button type="submit">Add task</button>
        </form>
      </article>
    `;
  }

  function renderTaskItem(project, phase, task) {
    const dueInfo = deadlineLabel(task.dueDate);
    const progress = typeof task.percentComplete === 'number' ? task.percentComplete : task.status === 'done' ? 100 : 0;

    return `
      <div class="task-item" data-task-id="${task.id}" data-phase-id="${phase.id}" data-project-id="${project.id}">
        <div class="task-main">
          <strong>${escapeHtml(task.title)}</strong>
          <div class="task-meta">
            ${task.label ? `<span class="tag">${escapeHtml(task.label)}</span>` : ''}
            <span class="tag ${task.priority}">${capitalize(task.priority)}</span>
            ${task.dueDate ? `<span class="deadline ${dueInfo.status}">Due ${escapeHtml(dueInfo.label)}</span>` : '<span class="muted">No deadline</span>'}
          </div>
          ${task.notes ? `<p class="muted">${escapeHtml(task.notes)}</p>` : ''}
        </div>
        <label class="stack">
          <span>Status</span>
          <select data-action="task-status" data-task-id="${task.id}" data-phase-id="${phase.id}">
            ${['todo', 'progress', 'blocked', 'done']
              .map((value) => `<option value="${value}" ${task.status === value ? 'selected' : ''}>${statusLabel(value)}</option>`)
              .join('')}
          </select>
        </label>
        <div class="stack">
          <label>
            <span>Progress: <strong data-task-progress="${task.id}">${progress}</strong>%</span>
            <input type="range" min="0" max="100" step="5" value="${progress}" data-action="task-progress" data-task-id="${task.id}" data-phase-id="${phase.id}" />
          </label>
          <button type="button" class="secondary" data-action="toggle-focus" data-task-id="${task.id}" data-phase-id="${phase.id}">${task.focus ? 'Unpin from Today' : 'Pin to Today'}</button>
        </div>
      </div>
    `;
  }

  function renderAddFileForm(project) {
    return `
      <form class="stack" data-action="add-file">
        <div class="form-inline">
          <label>
            <span>Title</span>
            <input name="title" required placeholder="Name or purpose" />
          </label>
          <label>
            <span>Type</span>
            <select name="type">
              <option value="markdown">Markdown</option>
              <option value="text">Text note</option>
              <option value="code">Code snippet</option>
              <option value="image">Image</option>
              <option value="binary">Upload file</option>
            </select>
          </label>
          <label>
            <span>Link to phase</span>
            <select name="phaseId">
              <option value="">Unlinked</option>
              ${project.phases.map((phase) => `<option value="${phase.id}">${escapeHtml(phase.name)}</option>`).join('')}
            </select>
          </label>
        </div>
        <label>
          <span>Content (Markdown / text / code)</span>
          <textarea class="editor" name="content" placeholder="Write or paste your content"></textarea>
        </label>
        <label>
          <span>Attach file (optional)</span>
          <input type="file" name="fileData" />
        </label>
        <button type="submit">Add file</button>
      </form>
    `;
  }

  function renderFileCard(project, file) {
    const phaseName = project.phases.find((phase) => phase.id === file.phaseId)?.name;
    const updatedLabel = file.updatedAt ? FULL_DATE_FORMAT.format(new Date(file.updatedAt)) : 'N/A';
    const versions = file.versions
      .map((version) => `<li>${FULL_DATE_FORMAT.format(new Date(version.timestamp))}</li>`)
      .join('');
    let body = '';

    if (['markdown', 'text', 'code'].includes(file.type)) {
      body = `
        <textarea class="editor" data-file-editor="${file.id}">${escapeHtml(file.content || '')}</textarea>
        <div class="file-actions">
          <button type="button" data-action="save-file" data-file-id="${file.id}">Save version</button>
        </div>
      `;
    } else if (file.type === 'image') {
      body = file.content
        ? `<img src="${escapeAttribute(file.content)}" alt="${escapeAttribute(file.title)}" style="width:100%;border-radius:12px;object-fit:cover;" />`
        : '<p class="muted">No image uploaded yet.</p>';
    } else {
      body = file.content
        ? `<a class="tag" href="${escapeAttribute(file.content)}" download="${escapeAttribute(file.metadata?.originalName || file.title)}">Download</a>`
        : '<p class="muted">Upload a file to generate a download link.</p>';
    }

    return `
      <article class="file-card" data-file-id="${file.id}">
        <header class="phase-header">
          <div>
            <h3>${escapeHtml(file.title)}</h3>
            <div class="task-meta">
              <span class="tag">${capitalize(file.type)}</span>
              ${phaseName ? `<span class="tag">Linked: ${escapeHtml(phaseName)}</span>` : ''}
            </div>
          </div>
          <p class="muted">Updated ${escapeHtml(updatedLabel)}</p>
        </header>
        ${body}
        ${versions ? `<details class="version-history"><summary>Version history (${file.versions.length})</summary><ul>${versions}</ul></details>` : '<p class="muted">Version history is empty. Save to capture revisions.</p>'}
      </article>
    `;
  }
  function renderAddNoteForm(project) {
    return `
      <form class="stack" data-action="add-note">
        <div class="form-inline">
          <label>
            <span>Title</span>
            <input name="title" required placeholder="Decision, insight, or meeting" />
          </label>
          <label>
            <span>Link phase</span>
            <select name="phaseId">
              <option value="">Unlinked</option>
              ${project.phases.map((phase) => `<option value="${phase.id}">${escapeHtml(phase.name)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Timeline date</span>
            <input type="date" name="timelineDate" />
          </label>
        </div>
        <textarea class="editor" name="content" required placeholder="Write in Markdown, capture retro notes, or log progress."></textarea>
        <button type="submit">Add note</button>
      </form>
    `;
  }

  function renderNoteCard(project, note) {
    const phaseName = project.phases.find((phase) => phase.id === note.phaseId)?.name;
    const versions = note.versions
      .map((version) => `<li>${FULL_DATE_FORMAT.format(new Date(version.timestamp))}</li>`)
      .join('');

    return `
      <article class="note-card" data-note-id="${note.id}">
        <header class="phase-header">
          <div>
            <h3>${escapeHtml(note.title)}</h3>
            <div class="task-meta">
              ${phaseName ? `<span class="tag">Phase: ${escapeHtml(phaseName)}</span>` : ''}
              ${note.timelineDate ? `<span class="tag">${escapeHtml(FULL_DATE_FORMAT.format(new Date(note.timelineDate)))}</span>` : ''}
            </div>
          </div>
          <p class="muted">Updated ${note.updatedAt ? escapeHtml(FULL_DATE_FORMAT.format(new Date(note.updatedAt))) : 'N/A'}</p>
        </header>
        <textarea class="editor" data-note-editor="${note.id}">${escapeHtml(note.content || '')}</textarea>
        <div class="note-actions">
          <button type="button" data-action="save-note" data-note-id="${note.id}">Save version</button>
        </div>
        ${versions ? `<details class="version-history"><summary>Version history (${note.versions.length})</summary><ul>${versions}</ul></details>` : '<p class="muted">Version history is empty. Save to capture revisions.</p>'}
      </article>
    `;
  }

  function renderPhysicalSections(project) {
    return `
      <section class="project-section">
        <header class="panel-header">
          <h3>Bill of Materials</h3>
          <p class="muted">Track components, suppliers, and spend.</p>
        </header>
        <form class="form-inline" data-action="add-bom">
          <label>
            <span>Part</span>
            <input name="item" required placeholder="Component name" />
          </label>
          <label>
            <span>Supplier</span>
            <input name="supplier" placeholder="Supplier or store" />
          </label>
          <label>
            <span>Cost</span>
            <input name="cost" type="number" min="0" step="0.01" placeholder="0.00" />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              <option value="needed">Needed</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
            </select>
          </label>
          <button type="submit">Add line</button>
        </form>
        <div class="table-like">
          ${project.bom.map((item) => `
            <div class="bom-row" data-bom-id="${item.id}">
              <strong>${escapeHtml(item.item)}</strong>
              <span class="muted">Supplier: ${escapeHtml(item.supplier || 'n/a')}</span>
              <span class="muted">Cost: €${Number(item.cost || 0).toFixed(2)}</span>
              <label>
                <span>Status</span>
                <select data-action="bom-status" data-bom-id="${item.id}">
                  ${['needed', 'ordered', 'received']
                    .map((value) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${capitalize(value)}</option>`)
                    .join('')}
                </select>
              </label>
            </div>
          `).join('') || '<p class="muted">No BOM entries yet.</p>'}
        </div>
      </section>

      <section class="project-section">
        <header class="panel-header">
          <h3>Photo logbook</h3>
          <p class="muted">Document your build steps.</p>
        </header>
        <form class="stack" data-action="add-logbook">
          <div class="form-inline">
            <label>
              <span>Title</span>
              <input name="title" required placeholder="Assembly step" />
            </label>
            <label>
              <span>Date</span>
              <input type="date" name="date" />
            </label>
            <label>
              <span>Image URL</span>
              <input name="image" type="url" placeholder="https://" />
            </label>
          </div>
          <textarea name="notes" rows="3" placeholder="What changed, insights, or adjustments"></textarea>
          <button type="submit">Add entry</button>
        </form>
        <div class="split-grid">
          ${project.logbook.map((entry) => `
            <article class="logbook-card" data-log-id="${entry.id}">
              <h3>${escapeHtml(entry.title)}</h3>
              ${entry.date ? `<p class="muted">${escapeHtml(FULL_DATE_FORMAT.format(new Date(entry.date)))}</p>` : ''}
              ${entry.image ? `<img src="${escapeAttribute(entry.image)}" alt="${escapeAttribute(entry.title)}" style="width:100%;border-radius:12px;object-fit:cover;" />` : ''}
              ${entry.notes ? `<p>${escapeHtml(entry.notes)}</p>` : ''}
            </article>
          `).join('') || '<p class="muted">Add photos or quick logs to build your timeline.</p>'}
        </div>
      </section>

      <section class="project-section">
        <header class="panel-header">
          <h3>Refine / Tune checklist</h3>
          <p class="muted">Keep repeatable QA steps handy.</p>
        </header>
        <form class="form-inline" data-action="add-checklist-item">
          <label>
            <span>Checklist item</span>
            <input name="label" required placeholder="Test motor alignment" />
          </label>
          <button type="submit">Add</button>
        </form>
        <div class="checklist">
          ${project.checklist.map((item) => `
            <label>
              <input type="checkbox" ${item.done ? 'checked' : ''} data-action="toggle-checklist" data-checklist-id="${item.id}" />
              <span>${escapeHtml(item.label)}</span>
            </label>
          `).join('') || '<p class="muted">Create your QA checklist for future passes.</p>'}
        </div>
      </section>
    `;
  }

  function renderDigitalSections(project) {
    return `
      <section class="project-section">
        <header class="panel-header">
          <h3>Releases &amp; milestones</h3>
          <p class="muted">Track releases, milestones, and their readiness.</p>
        </header>
        <form class="form-inline" data-action="add-release">
          <label>
            <span>Name</span>
            <input name="name" required placeholder="v1.0 Alpha" />
          </label>
          <label>
            <span>Target date</span>
            <input type="date" name="targetDate" />
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              <option value="planning">Planning</option>
              <option value="building">Building</option>
              <option value="review">In review</option>
              <option value="shipped">Shipped</option>
            </select>
          </label>
          <button type="submit">Add milestone</button>
        </form>
        <div class="split-grid">
          ${project.releases.map((release) => `
            <article class="release-card" data-release-id="${release.id}">
              <h3>${escapeHtml(release.name)}</h3>
              <p class="muted">${release.targetDate ? `Target ${escapeHtml(FULL_DATE_FORMAT.format(new Date(release.targetDate)))}` : 'No target date'}</p>
              <label>
                <span>Status</span>
                <select data-action="release-status" data-release-id="${release.id}">
                  ${['planning', 'building', 'review', 'shipped']
                    .map((value) => `<option value="${value}" ${release.status === value ? 'selected' : ''}>${capitalize(value)}</option>`)
                    .join('')}
                </select>
              </label>
              ${release.description ? `<p>${escapeHtml(release.description)}</p>` : ''}
            </article>
          `).join('') || '<p class="muted">Outline upcoming releases to maintain momentum.</p>'}
        </div>
      </section>

      <section class="project-section">
        <header class="panel-header">
          <h3>Issue-like tasks</h3>
          <p class="muted">Capture bugs, features, and chores alongside your roadmap.</p>
        </header>
        <form class="stack" data-action="add-issue">
          <div class="form-inline">
            <label>
              <span>Title</span>
              <input name="title" required placeholder="Describe the issue" />
            </label>
            <label>
              <span>Type</span>
              <select name="issueType">
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="chore">Chore</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select name="status">
                <option value="todo">To do</option>
                <option value="progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label>
              <span>Due date</span>
              <input type="date" name="dueDate" />
            </label>
          </div>
          <textarea name="notes" rows="2" placeholder="Context or acceptance criteria"></textarea>
          <button type="submit">Add issue</button>
        </form>
        <div class="split-grid">
          ${project.issues.map((issue) => `
            <article class="issue-card" data-issue-id="${issue.id}">
              <h3>${escapeHtml(issue.title)}</h3>
              <div class="task-meta">
                <span class="tag">${capitalize(issue.issueType)}</span>
                <span class="tag">${statusLabel(issue.status)}</span>
                ${issue.dueDate ? `<span class="tag ${deadlineLabel(issue.dueDate).status}">Due ${escapeHtml(deadlineLabel(issue.dueDate).label)}</span>` : ''}
              </div>
              ${issue.notes ? `<p>${escapeHtml(issue.notes)}</p>` : ''}
              <label>
                <span>Status</span>
                <select data-action="issue-status" data-issue-id="${issue.id}">
                  ${['todo', 'progress', 'blocked', 'done']
                    .map((value) => `<option value="${value}" ${issue.status === value ? 'selected' : ''}>${statusLabel(value)}</option>`)
                    .join('')}
                </select>
              </label>
            </article>
          `).join('') || '<p class="muted">Track bugs, features, and chores to complement your phase tasks.</p>'}
        </div>
      </section>
    `;
  }

  function renderFocusView() {
    const focusItems = computeFocusItems().slice(0, 3);
    focusListEl.innerHTML = '';

    if (!focusItems.length) {
      const empty = document.createElement('li');
      empty.className = 'muted';
      empty.textContent = 'No focus items yet. Pin a task or add due dates to surface priorities here.';
      focusListEl.appendChild(empty);
      return;
    }

    focusItems.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'focus-card';
      li.innerHTML = `
        <strong>${escapeHtml(item.title)}</strong>
        <p class="status">${escapeHtml(item.subtitle)}</p>
        <p class="status">${escapeHtml(item.detail)}</p>
      `;
      focusListEl.appendChild(li);
    });
  }

  function renderTodaySummary() {
    const totalProjects = state.projects.length;
    const totalTasks = state.projects.reduce((sum, project) => sum + project.phases.reduce((acc, phase) => acc + phase.tasks.length, 0), 0);
    const openTasks = state.projects.reduce((sum, project) => sum + project.phases.reduce((acc, phase) => acc + phase.tasks.filter((task) => task.status !== 'done').length, 0), 0);
    const overdue = state.projects.reduce((sum, project) => sum + project.phases.reduce((acc, phase) => acc + phase.tasks.filter((task) => isOverdue(task)).length, 0), 0);

    todaySummaryEl.textContent = `${totalProjects} projects • ${totalTasks} tasks • ${overdue} overdue (${openTasks} active)`;
  }

  function computeFocusItems() {
    const items = [];
    state.projects.forEach((project) => {
      project.phases.forEach((phase) => {
        phase.tasks.forEach((task) => {
          if (task.focus) {
            items.push({
              title: `${task.title} • ${project.name}`,
              subtitle: `Pinned from ${phase.name}`,
              detail: task.dueDate ? `Due ${deadlineLabel(task.dueDate).label}` : 'No due date',
              score: 0,
            });
          } else if (task.dueDate && task.status !== 'done') {
            const deadline = classifyDeadline(task.dueDate);
            if (deadline === 'overdue' || deadline === 'today') {
              items.push({
                title: `${task.title} • ${project.name}`,
                subtitle: `${capitalize(deadline)} task in ${phase.name}`,
                detail: `Due ${deadlineLabel(task.dueDate).label}`,
                score: deadline === 'overdue' ? 1 : 2,
              });
            } else if (deadline === 'upcoming') {
              items.push({
                title: `${task.title} • ${project.name}`,
                subtitle: `Upcoming deadline in ${phase.name}`,
                detail: `Due ${deadlineLabel(task.dueDate).label}`,
                score: 3,
              });
            }
          }
        });
      });
    });

    items.sort((a, b) => a.score - b.score);
    return items;
  }

  function projectMatchesFilters(project) {
    if (filters.type !== 'all' && project.type !== filters.type) {
      return false;
    }

    if (filters.search) {
      const query = filters.search.toLowerCase();
      const haystack = [project.name, project.description, project.github || '']
        .concat(project.phases.map((phase) => phase.name))
        .concat(project.phases.flatMap((phase) => phase.tasks.map((task) => `${task.title} ${task.label || ''}`)))
        .concat(project.notes.map((note) => `${note.title} ${note.content}`))
        .join(' ') || '';
      if (!haystack.toLowerCase().includes(query)) {
        return false;
      }
    }

    return true;
  }

  function taskMatchesFilters(task) {
    if (filters.status !== 'all' && task.status !== filters.status) {
      return false;
    }

    if (filters.deadline !== 'all') {
      const category = classifyDeadline(task.dueDate);
      if (filters.deadline === 'overdue' && category !== 'overdue') {
        return false;
      }
      if (filters.deadline === 'today' && category !== 'today') {
        return false;
      }
      if (filters.deadline === 'upcoming' && category !== 'upcoming') {
        return false;
      }
    }

    return true;
  }

  function projectProgress(project) {
    const phaseProgress = project.phases.map((phase) => {
      const auto = phase.tasks.length
        ? Math.round((phase.tasks.filter((task) => task.status === 'done').length / phase.tasks.length) * 100)
        : 0;
      const manual = typeof phase.manualProgress === 'number' ? phase.manualProgress : auto;
      return manual;
    });

    const totalTasks = project.phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const openTasks = project.phases.reduce((sum, phase) => sum + phase.tasks.filter((task) => task.status !== 'done').length, 0);

    const progress = phaseProgress.length
      ? Math.round(phaseProgress.reduce((sum, value) => sum + value, 0) / phaseProgress.length)
      : 0;

    return { progress, totalTasks, openTasks };
  }

  function countOverdueTasks(project) {
    return project.phases.reduce((sum, phase) => sum + phase.tasks.filter((task) => isOverdue(task)).length, 0);
  }

  function countDueToday(project) {
    return project.phases.reduce((sum, phase) => sum + phase.tasks.filter((task) => classifyDeadline(task.dueDate) === 'today').length, 0);
  }

  function isOverdue(task) {
    if (!task.dueDate || task.status === 'done') {
      return false;
    }
    return classifyDeadline(task.dueDate) === 'overdue';
  }

  function classifyDeadline(dateStr) {
    if (!dateStr) {
      return 'none';
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);

    const diff = (due - today) / (1000 * 60 * 60 * 24);
    if (diff < 0) {
      return 'overdue';
    }
    if (diff === 0) {
      return 'today';
    }
    if (diff <= 7) {
      return 'upcoming';
    }
    return 'future';
  }

  function deadlineLabel(dateStr) {
    if (!dateStr) {
      return { label: 'unscheduled', status: 'none' };
    }
    const status = classifyDeadline(dateStr);
    const label = DATE_FORMAT.format(new Date(dateStr));
    return { label, status };
  }

  function statusLabel(status) {
    switch (status) {
      case 'todo':
        return 'To do';
      case 'progress':
        return 'In progress';
      case 'blocked':
        return 'Blocked';
      case 'done':
        return 'Done';
      default:
        return status;
    }
  }

  function escapeHtml(string) {
    if (string == null) {
      return '';
    }
    return String(string)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(string) {
    return escapeHtml(string);
  }

  function capitalize(value) {
    if (!value) {
      return '';
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function shareUrl(project) {
    const slug = project.share?.slug;
    return slug ? `https://codex.local/share/${slug}` : '';
  }

  function generateId() {
    return `id-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  }

  function normalizeProject(project) {
    project.phases = project.phases || [];
    project.files = project.files || [];
    project.notes = project.notes || [];
    project.bom = project.bom || [];
    project.logbook = project.logbook || [];
    project.checklist = project.checklist || [];
    project.releases = project.releases || [];
    project.issues = project.issues || [];
  }
  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return defaultState();
    }
    try {
      const parsed = JSON.parse(raw);
      parsed.projects = parsed.projects || [];
      parsed.projects.forEach(normalizeProject);
      return parsed;
    } catch (error) {
      console.warn('Unable to parse stored state', error);
      return defaultState();
    }
  }

  function upsertProject(project) {
    project.updatedAt = new Date().toISOString();
  }

  projectForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(projectForm);
    const name = formData.get('name').trim();
    if (!name) {
      return;
    }
    const type = formData.get('type') || 'general';
    const description = formData.get('description')?.trim() || '';
    const github = formData.get('github')?.trim() || '';

    const project = {
      id: generateId(),
      name,
      type,
      description,
      github,
      phases: [],
      files: [],
      notes: [],
      bom: [],
      logbook: [],
      checklist: [],
      releases: [],
      issues: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      share: { enabled: false, slug: '' },
    };

    state.projects.push(project);
    selectedProjectId = project.id;
    projectForm.reset();
    saveStateAndRender();
  });

  projectListEl.addEventListener('click', (event) => {
    const item = event.target.closest('.project-item');
    if (!item) {
      return;
    }
    selectedProjectId = item.dataset.projectId;
    saveStateAndRender();
  });

  searchInput.addEventListener('input', () => {
    filters.search = searchInput.value.trim();
    renderProjectList();
    renderProjectDetail();
  });

  statusFilter.addEventListener('change', () => {
    filters.status = statusFilter.value;
    renderProjectDetail();
  });

  deadlineFilter.addEventListener('change', () => {
    filters.deadline = deadlineFilter.value;
    renderProjectDetail();
  });

  typeFilter.addEventListener('change', () => {
    filters.type = typeFilter.value;
    renderProjectList();
    renderProjectDetail();
  });

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    themeToggle.textContent = document.body.classList.contains('light') ? 'Toggle dark' : 'Toggle light';
    themeToggle.setAttribute('aria-pressed', document.body.classList.contains('light') ? 'false' : 'true');
  });

  projectDetailEl.addEventListener('change', (event) => {
    const target = event.target;

    if (target.matches('[data-action="phase-progress"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const phase = project.phases.find((item) => item.id === target.dataset.phaseId);
      if (phase) {
        phase.manualProgress = Number(target.value);
        const label = projectDetailEl.querySelector(`[data-phase-progress="${phase.id}"]`);
        if (label) {
          label.textContent = String(phase.manualProgress);
        }
        upsertProject(project);
        saveStateAndRender();
      }
    }

    if (target.matches('[data-action="task-status"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const phase = project.phases.find((item) => item.id === target.dataset.phaseId);
      if (!phase) {
        return;
      }
      const task = phase.tasks.find((item) => item.id === target.dataset.taskId);
      if (!task) {
        return;
      }
      task.status = target.value;
      if (task.status === 'done') {
        task.percentComplete = 100;
      }
      task.updatedAt = new Date().toISOString();
      upsertProject(project);
      saveStateAndRender();
    }

    if (target.matches('[data-action="task-progress"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const phase = project.phases.find((item) => item.id === target.dataset.phaseId);
      if (!phase) {
        return;
      }
      const task = phase.tasks.find((item) => item.id === target.dataset.taskId);
      if (!task) {
        return;
      }
      task.percentComplete = Number(target.value);
      if (task.percentComplete === 100) {
        task.status = 'done';
      }
      task.updatedAt = new Date().toISOString();
      const label = projectDetailEl.querySelector(`[data-task-progress="${task.id}"]`);
      if (label) {
        label.textContent = String(task.percentComplete);
      }
      upsertProject(project);
      saveStateAndRender();
    }

    if (target.matches('[data-action="toggle-share"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      if (!project.share) {
        project.share = { enabled: false, slug: '' };
      }
      project.share.enabled = target.checked;
      if (project.share.enabled && !project.share.slug) {
        project.share.slug = generateId();
      }
      upsertProject(project);
      saveStateAndRender();
    }

    if (target.matches('[data-action="bom-status"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const item = project.bom.find((entry) => entry.id === target.dataset.bomId);
      if (item) {
        item.status = target.value;
        upsertProject(project);
        saveStateAndRender();
      }
    }

    if (target.matches('[data-action="toggle-checklist"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const entry = project.checklist.find((item) => item.id === target.dataset.checklistId);
      if (entry) {
        entry.done = target.checked;
        upsertProject(project);
        saveStateAndRender();
      }
    }

    if (target.matches('[data-action="release-status"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const release = project.releases.find((item) => item.id === target.dataset.releaseId);
      if (release) {
        release.status = target.value;
        release.updatedAt = new Date().toISOString();
        upsertProject(project);
        saveStateAndRender();
      }
    }

    if (target.matches('[data-action="issue-status"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const issue = project.issues.find((item) => item.id === target.dataset.issueId);
      if (issue) {
        issue.status = target.value;
        issue.updatedAt = new Date().toISOString();
        upsertProject(project);
        saveStateAndRender();
      }
    }
  });

  projectDetailEl.addEventListener('click', (event) => {
    const target = event.target;

    if (target.matches('[data-action="save-file"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const file = project.files.find((item) => item.id === target.dataset.fileId);
      if (!file) {
        return;
      }
      const editor = projectDetailEl.querySelector(`[data-file-editor="${file.id}"]`);
      if (!editor) {
        return;
      }
      if (!file.versions) {
        file.versions = [];
      }
      file.versions.unshift({ timestamp: new Date().toISOString(), content: file.content });
      file.content = editor.value;
      file.updatedAt = new Date().toISOString();
      upsertProject(project);
      saveStateAndRender();
    }

    if (target.matches('[data-action="save-note"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const note = project.notes.find((item) => item.id === target.dataset.noteId);
      if (!note) {
        return;
      }
      const editor = projectDetailEl.querySelector(`[data-note-editor="${note.id}"]`);
      if (!editor) {
        return;
      }
      if (!note.versions) {
        note.versions = [];
      }
      note.versions.unshift({ timestamp: new Date().toISOString(), content: note.content });
      note.content = editor.value;
      note.updatedAt = new Date().toISOString();
      upsertProject(project);
      saveStateAndRender();
    }

    if (target.matches('[data-action="toggle-focus"]')) {
      const project = loadProject(selectedProjectId);
      if (!project) {
        return;
      }
      const phase = project.phases.find((item) => item.id === target.dataset.phaseId);
      if (!phase) {
        return;
      }
      const task = phase.tasks.find((item) => item.id === target.dataset.taskId);
      if (!task) {
        return;
      }
      task.focus = !task.focus;
      upsertProject(project);
      saveStateAndRender();
    }
  });

  projectDetailEl.addEventListener('submit', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement)) {
      return;
    }
    event.preventDefault();

    const project = loadProject(selectedProjectId);
    if (!project) {
      return;
    }

    if (target.dataset.action === 'add-phase') {
      const formData = new FormData(target);
      const name = formData.get('name')?.trim();
      if (!name) {
        return;
      }
      project.phases.push({
        id: generateId(),
        name,
        priority: formData.get('priority') || 'medium',
        deadline: formData.get('deadline') || '',
        tasks: [],
        manualProgress: 0,
        createdAt: new Date().toISOString(),
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-task') {
      const formData = new FormData(target);
      const title = formData.get('title')?.trim();
      if (!title) {
        return;
      }
      const phase = project.phases.find((item) => item.id === target.dataset.phaseId);
      if (!phase) {
        return;
      }
      phase.tasks.push({
        id: generateId(),
        title,
        label: formData.get('label')?.trim() || '',
        priority: formData.get('priority') || 'medium',
        dueDate: formData.get('dueDate') || '',
        notes: formData.get('notes')?.trim() || '',
        status: 'todo',
        percentComplete: 0,
        focus: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-note') {
      const formData = new FormData(target);
      const title = formData.get('title')?.trim();
      const content = formData.get('content')?.trim();
      if (!title || !content) {
        return;
      }
      project.notes.push({
        id: generateId(),
        title,
        content,
        phaseId: formData.get('phaseId') || '',
        timelineDate: formData.get('timelineDate') || '',
        versions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-bom') {
      const formData = new FormData(target);
      const item = formData.get('item')?.trim();
      if (!item) {
        return;
      }
      project.bom.push({
        id: generateId(),
        item,
        supplier: formData.get('supplier')?.trim() || '',
        cost: formData.get('cost') || 0,
        status: formData.get('status') || 'needed',
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-logbook') {
      const formData = new FormData(target);
      const title = formData.get('title')?.trim();
      if (!title) {
        return;
      }
      project.logbook.unshift({
        id: generateId(),
        title,
        date: formData.get('date') || '',
        image: formData.get('image')?.trim() || '',
        notes: formData.get('notes')?.trim() || '',
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-checklist-item') {
      const formData = new FormData(target);
      const label = formData.get('label')?.trim();
      if (!label) {
        return;
      }
      project.checklist.push({ id: generateId(), label, done: false });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-release') {
      const formData = new FormData(target);
      const name = formData.get('name')?.trim();
      if (!name) {
        return;
      }
      project.releases.push({
        id: generateId(),
        name,
        targetDate: formData.get('targetDate') || '',
        status: formData.get('status') || 'planning',
        description: formData.get('description')?.trim() || '',
        createdAt: new Date().toISOString(),
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-issue') {
      const formData = new FormData(target);
      const title = formData.get('title')?.trim();
      if (!title) {
        return;
      }
      project.issues.push({
        id: generateId(),
        title,
        issueType: formData.get('issueType') || 'feature',
        status: formData.get('status') || 'todo',
        dueDate: formData.get('dueDate') || '',
        notes: formData.get('notes')?.trim() || '',
        createdAt: new Date().toISOString(),
      });
      upsertProject(project);
      target.reset();
      saveStateAndRender();
      return;
    }

    if (target.dataset.action === 'add-file') {
      handleFileFormSubmission(project, target).catch((error) => {
        console.error('Failed to attach file', error);
      });
    }
  });

  async function handleFileFormSubmission(project, form) {
    const formData = new FormData(form);
    const title = formData.get('title')?.trim();
    if (!title) {
      return;
    }
    const type = formData.get('type') || 'text';
    const phaseId = formData.get('phaseId') || '';
    const content = formData.get('content')?.trim() || '';
    const fileInput = form.querySelector('input[name="fileData"]');

    let storedContent = content;
    const metadata = {};

    if (fileInput?.files?.length) {
      const file = fileInput.files[0];
      metadata.originalName = file.name;
      metadata.mime = file.type;
      storedContent = await readFileAsDataUrl(file);
      if (file.type.startsWith('image/')) {
        metadata.kind = 'image';
      }
    }

    project.files.push({
      id: generateId(),
      title,
      type,
      phaseId,
      content: storedContent,
      metadata,
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    upsertProject(project);
    form.reset();
    saveStateAndRender();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  renderAll();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ready);
} else {
  ready();
}
