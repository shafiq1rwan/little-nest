// The "Your rooms" dialog: save the current design under a name, and load, rename, duplicate,
// or delete saved rooms. Rendering only; every action calls back into the game.

import { MAX_NAME_LENGTH } from '../persistence/gallery.js';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function createGalleryDialog({ dialog, list, saveForm, nameInput, emptyEl, closeButton, handlers }) {
  const { entries, currentId, onSaveAs, onLoad, onRename, onDuplicate, onDelete } = handlers;
  let pendingDelete = null;
  let renaming = null;

  nameInput.maxLength = MAX_NAME_LENGTH;
  saveForm.onsubmit = (ev) => {
    ev.preventDefault();
    onSaveAs(nameInput.value);
    nameInput.value = '';
    render();
  };
  closeButton.onclick = () => dialog.close();
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });   // backdrop closes

  function button(label, className, onClick, attrs = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = className;
    for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
    b.onclick = onClick;
    return b;
  }

  function row(entry) {
    const li = document.createElement('li');
    li.className = 'room-entry' + (entry.id === currentId() ? ' current' : '');
    li.dataset.roomId = entry.id;

    const head = document.createElement('div');
    head.className = 'room-head';
    if (renaming === entry.id) {
      const form = document.createElement('form');
      form.className = 'room-rename';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = entry.name;
      input.maxLength = MAX_NAME_LENGTH;
      input.setAttribute('aria-label', 'Room name');
      form.append(input, button('Save name', 'primary', null, { type: 'submit' }), button('Cancel', '', () => { renaming = null; render(); }));
      form.onsubmit = (ev) => { ev.preventDefault(); onRename(entry.id, input.value); renaming = null; render(); };
      head.append(form);
      queueMicrotask(() => { input.focus(); input.select(); });
    } else {
      const name = document.createElement('h3');
      name.textContent = entry.name;
      const meta = document.createElement('p');
      meta.textContent = entry.itemCount + (entry.itemCount === 1 ? ' item' : ' items') + (entry.updatedAt ? ' · ' + formatDate(entry.updatedAt) : '') + (entry.id === currentId() ? ' · open now' : '');
      head.append(name, meta);
    }

    const actions = document.createElement('div');
    actions.className = 'room-actions';
    actions.append(
      button('Load', 'primary', () => { onLoad(entry.id); dialog.close(); }, { 'aria-label': 'Load ' + entry.name }),
      button('Rename', '', () => { renaming = entry.id; pendingDelete = null; render(); }, { 'aria-label': 'Rename ' + entry.name }),
      button('Duplicate', '', () => { onDuplicate(entry.id); render(); }, { 'aria-label': 'Duplicate ' + entry.name }),
    );
    if (pendingDelete === entry.id) {
      actions.append(
        button('Confirm delete', 'danger', () => { onDelete(entry.id); pendingDelete = null; render(); }, { 'aria-label': 'Confirm delete ' + entry.name }),
        button('Keep', '', () => { pendingDelete = null; render(); }),
      );
    } else {
      actions.append(button('Delete', '', () => { pendingDelete = entry.id; renaming = null; render(); }, { 'aria-label': 'Delete ' + entry.name }));
    }
    li.append(head, actions);
    return li;
  }

  function render() {
    const items = entries();
    list.replaceChildren(...items.map(row));
    emptyEl.hidden = items.length > 0;
  }

  function open({ focusName = false } = {}) {
    pendingDelete = null;
    renaming = null;
    render();
    if (!dialog.open) dialog.showModal();
    if (focusName) nameInput.focus();
  }

  return { open, close: () => dialog.close(), render, isOpen: () => dialog.open };
}
