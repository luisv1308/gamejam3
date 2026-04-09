/**
 * Menú flotante solo en desarrollo (Vite: import.meta.env.DEV).
 * No se incluye en la lógica del juego; solo dispara callbacks.
 */

export function initDevMenu({ levelCount, goToLevel, restartLevel, getPhaseLabel }) {
  if (!import.meta.env.DEV) {
    return { sync: () => {} };
  }

  const style = document.createElement('style');
  style.textContent = `
    #dev-menu-root {
      position: fixed;
      top: 10px;
      left: 10px;
      z-index: 10000;
      font-family: system-ui, Segoe UI, sans-serif;
      font-size: 12px;
      color: #e8eaef;
      user-select: none;
    }
    #dev-menu-root.collapsed .dev-menu-body { display: none; }
    #dev-menu-root.collapsed .dev-menu-toggle { border-radius: 6px; }
    .dev-menu-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(22, 26, 34, 0.95);
      border: 1px solid #3d4a5c;
      border-radius: 6px;
      padding: 6px 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
    }
    .dev-menu-bar strong {
      color: #7cffb6;
      font-size: 11px;
      letter-spacing: 0.06em;
    }
    .dev-menu-body {
      margin-top: 6px;
      background: rgba(22, 26, 34, 0.95);
      border: 1px solid #3d4a5c;
      border-radius: 6px;
      padding: 10px 12px;
      min-width: 200px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
    }
    .dev-menu-body label {
      display: block;
      margin-bottom: 8px;
    }
    .dev-menu-body select {
      width: 100%;
      margin-top: 4px;
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid #4a5568;
      background: #1a1f28;
      color: #e8eaef;
    }
    .dev-menu-body button {
      width: 100%;
      margin-top: 4px;
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid #4a5568;
      background: #2a3140;
      color: #e8eaef;
      cursor: pointer;
    }
    .dev-menu-body button:hover {
      background: #343d4f;
    }
    .dev-menu-phase {
      font-size: 11px;
      color: #9ca8bc;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #3d4a5c;
    }
    .dev-menu-toggle {
      cursor: pointer;
      background: none;
      border: none;
      color: #9ca8bc;
      margin-left: auto;
      padding: 2px 6px;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'dev-menu-root';

  const bar = document.createElement('div');
  bar.className = 'dev-menu-bar';
  bar.innerHTML = '<strong>DEV</strong><span style="color:#6b7a90">Menú de pruebas</span>';
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'dev-menu-toggle';
  toggleBtn.title = 'Contraer / expandir';
  toggleBtn.textContent = '−';
  toggleBtn.addEventListener('click', () => {
    root.classList.toggle('collapsed');
    toggleBtn.textContent = root.classList.contains('collapsed') ? '+' : '−';
  });
  bar.appendChild(toggleBtn);

  const body = document.createElement('div');
  body.className = 'dev-menu-body';

  const label = document.createElement('label');
  label.textContent = 'Nivel (pantalla)';
  const select = document.createElement('select');
  for (let i = 0; i < levelCount; i++) {
    const opt = document.createElement('option');
    opt.value = String(i + 1);
    opt.textContent = `Nivel ${i + 1}`;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    const idx = parseInt(select.value, 10) - 1;
    if (idx >= 0 && idx < levelCount) goToLevel(idx);
  });
  label.appendChild(select);

  const btnRestart = document.createElement('button');
  btnRestart.type = 'button';
  btnRestart.textContent = 'Reiniciar nivel actual';
  btnRestart.addEventListener('click', () => restartLevel());

  const phaseEl = document.createElement('div');
  phaseEl.className = 'dev-menu-phase';
  phaseEl.textContent = '—';

  body.appendChild(label);
  body.appendChild(btnRestart);
  body.appendChild(phaseEl);

  root.appendChild(bar);
  root.appendChild(body);
  document.body.appendChild(root);

  setInterval(() => {
    try {
      phaseEl.textContent = `Fase: ${getPhaseLabel?.() ?? '—'}`;
    } catch (_) {
      phaseEl.textContent = 'Fase: —';
    }
  }, 300);

  return {
    sync(levelIndex) {
      if (select && levelIndex >= 0 && levelIndex < levelCount) {
        select.value = String(levelIndex + 1);
      }
    },
  };
}
