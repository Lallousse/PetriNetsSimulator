import { createIcons, icons } from 'lucide';
import JSZip from 'jszip';

export class FileExplorer {
    constructor(app) {
        this.app = app;
        this.fs = app.fs;
        this.currentFolderId = null; // null means root
    }

    async open() {
        const footer = `
            <button class="modal-btn" id="fe-new-folder"><i data-lucide="folder-plus"></i> New Folder</button>
            <button class="modal-btn" id="fe-export-all"><i data-lucide="archive"></i> Export All</button>
            <div style="flex:1"></div>
            <label class="modal-btn" style="background: var(--accent-primary); border-color: var(--accent-primary); cursor: pointer;">
                <i data-lucide="upload"></i> Upload JSON
                <input type="file" id="fe-upload-input" accept=".json" multiple style="display:none;">
            </label>
        `;
        
        this.app.modalManager.show("File Explorer", `
            <div id="fe-breadcrumb" style="font-size: 14px; margin-bottom: 16px; color: var(--text-muted); display:flex; align-items:center; gap: 8px;"></div>
            <div id="fe-container" class="file-explorer-grid" style="min-height: 300px;"></div>
        `, footer, { maxWidth: '800px' });
        
        this.container = document.getElementById('fe-container');
        this.breadcrumb = document.getElementById('fe-breadcrumb');
        
        document.getElementById('fe-new-folder').addEventListener('click', () => this.createNewFolder());
        document.getElementById('fe-export-all').addEventListener('click', () => this.exportAllZip());
        document.getElementById('fe-upload-input').addEventListener('change', (e) => this.handleUpload(e));
        
        await this.render();
    }

    async render() {
        this.container.innerHTML = '';
        
        // Render Breadcrumb
        this.breadcrumb.innerHTML = '';
        const rootLink = document.createElement('a');
        rootLink.textContent = 'Root';
        rootLink.style.cursor = 'pointer';
        rootLink.onclick = () => { this.currentFolderId = null; this.render(); };
        this.breadcrumb.appendChild(rootLink);

        if (this.currentFolderId) {
            const allFolders = await this.fs.getFolders();
            let path = [];
            let curr = allFolders.find(f => f.id === this.currentFolderId);
            while(curr) {
                path.unshift(curr);
                curr = allFolders.find(f => f.id === curr.parentId);
            }
            path.forEach(f => {
                const sep = document.createElement('span');
                sep.textContent = '/';
                this.breadcrumb.appendChild(sep);
                
                const link = document.createElement('a');
                link.textContent = f.name;
                link.style.cursor = 'pointer';
                link.onclick = () => { this.currentFolderId = f.id; this.render(); };
                this.breadcrumb.appendChild(link);
            });
        }

        // Fetch items
        const folders = await this.fs.getFolders();
        const files = await this.fs.getFiles();
        
        const currentFolders = folders.filter(f => f.parentId === this.currentFolderId);
        const currentFiles = files.filter(f => f.folderId === this.currentFolderId);

        // Parent navigation
        if (this.currentFolderId) {
            const parentFolder = folders.find(f => f.id === this.currentFolderId);
            const backItem = this.createItemDOM({ name: '..', id: parentFolder.parentId }, 'folder-back');
            this.container.appendChild(backItem);
        }

        currentFolders.forEach(folder => {
            this.container.appendChild(this.createItemDOM(folder, 'folder'));
        });

        currentFiles.forEach(file => {
            this.container.appendChild(this.createItemDOM(file, 'file'));
        });

        createIcons({ icons, nameAttr: 'data-lucide' });
    }

    createItemDOM(item, type) {
        const div = document.createElement('div');
        div.className = `fe-item fe-item-${type}`;
        div.dataset.id = item.id;
        div.dataset.type = type;
        
        if (type !== 'folder-back') {
            div.draggable = true;
            div.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, type }));
            });
        }
        
        if (type === 'folder' || type === 'folder-back') {
            div.addEventListener('dragover', e => {
                e.preventDefault();
                div.classList.add('drag-over');
            });
            div.addEventListener('dragleave', e => {
                div.classList.remove('drag-over');
            });
            div.addEventListener('drop', async e => {
                e.preventDefault();
                div.classList.remove('drag-over');
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (data.id === item.id) return; // can't drop into itself
                
                if (data.type === 'file') {
                    const file = await this.fs.getFile(data.id);
                    file.folderId = type === 'folder-back' ? item.id : item.id;
                    await this.fs.updateFile(file);
                } else if (data.type === 'folder') {
                    // Get all folders to find target
                    const allFolders = await this.fs.getFolders();
                    const draggedFolder = allFolders.find(f => f.id === data.id);
                    draggedFolder.parentId = type === 'folder-back' ? item.id : item.id;
                    await this.fs.updateFolder(draggedFolder);
                }
                this.render();
            });
        }

        const iconMap = {
            'folder': 'folder',
            'folder-back': 'corner-left-up',
            'file': 'file-json'
        };

        div.innerHTML = `
            <div class="fe-icon"><i data-lucide="${iconMap[type]}"></i></div>
            <div class="fe-name">${item.name}</div>
        `;

        if (type !== 'folder-back') {
            const actions = document.createElement('div');
            actions.className = 'fe-actions';
            
            const renBtn = document.createElement('button');
            renBtn.innerHTML = '<i data-lucide="edit-2"></i>';
            renBtn.onclick = (e) => { e.stopPropagation(); this.renameItem(item.id, type, item.name); };
            
            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.onclick = (e) => { e.stopPropagation(); this.deleteItem(item.id, type); };
            
            actions.appendChild(renBtn);
            actions.appendChild(delBtn);
            div.appendChild(actions);
        }

        div.addEventListener('click', async () => {
            if (type === 'folder') {
                this.currentFolderId = item.id;
                this.render();
            } else if (type === 'folder-back') {
                this.currentFolderId = item.id || null;
                this.render();
            } else if (type === 'file') {
                const file = await this.fs.getFile(item.id);
                this.app.loadFromLocalFile(file);
                this.app.modalManager.close();
            }
        });

        return div;
    }

    async promptInput(title, defaultValue = '') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;border-radius:inherit;';
            const box = document.createElement('div');
            box.style.cssText = 'background:var(--bg-primary);padding:16px;border-radius:8px;border:1px solid var(--border-color);width:300px;box-shadow:0 10px 25px rgba(0,0,0,0.5);';
            box.innerHTML = `
                <div style="font-size:14px;margin-bottom:8px;color:var(--text-primary);">${title}</div>
                <input type="text" id="fe-inline-prompt" value="${defaultValue}" style="width:100%;padding:8px;border-radius:4px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);margin-bottom:12px;">
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button id="fe-prompt-cancel" class="modal-btn">Cancel</button>
                    <button id="fe-prompt-ok" class="modal-btn" style="background:var(--accent-primary);border-color:var(--accent-primary);">OK</button>
                </div>
            `;
            overlay.appendChild(box);
            const modalContent = this.container.closest('.modal-content');
            modalContent.style.position = 'relative';
            modalContent.appendChild(overlay);

            const input = box.querySelector('#fe-inline-prompt');
            setTimeout(() => input.focus(), 50);

            const close = (val) => {
                overlay.remove();
                resolve(val);
            };

            box.querySelector('#fe-prompt-cancel').onclick = () => close(null);
            box.querySelector('#fe-prompt-ok').onclick = () => close(input.value);
            input.onkeydown = (e) => { if (e.key === 'Enter') close(input.value); if (e.key === 'Escape') close(null); };
        });
    }

    async confirmAction(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;border-radius:inherit;';
            const box = document.createElement('div');
            box.style.cssText = 'background:var(--bg-primary);padding:16px;border-radius:8px;border:1px solid var(--border-color);width:300px;box-shadow:0 10px 25px rgba(0,0,0,0.5);';
            box.innerHTML = `
                <div style="font-size:14px;margin-bottom:12px;color:var(--text-primary);">${message}</div>
                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button id="fe-confirm-cancel" class="modal-btn">Cancel</button>
                    <button id="fe-confirm-ok" class="modal-btn" style="background:var(--accent-primary);border-color:var(--accent-primary);">OK</button>
                </div>
            `;
            overlay.appendChild(box);
            const modalContent = this.container.closest('.modal-content');
            modalContent.style.position = 'relative';
            modalContent.appendChild(overlay);

            const close = (val) => {
                overlay.remove();
                resolve(val);
            };

            box.querySelector('#fe-confirm-cancel').onclick = () => close(false);
            box.querySelector('#fe-confirm-ok').onclick = () => close(true);
        });
    }

    async createNewFolder() {
        const name = await this.promptInput("New Folder Name:");
        if (!name) return;
        await this.fs.createFolder(name, this.currentFolderId);
        this.render();
    }

    async handleUpload(e) {
        const files = Array.from(e.target.files);
        for (let f of files) {
            const text = await f.text();
            try {
                // Verify it's a valid JSON before saving
                JSON.parse(text);
                const name = f.name.replace('.json', '');
                await this.fs.saveFile(null, name, this.currentFolderId, text);
            } catch (err) {
                alert(`Invalid JSON file: ${f.name}`);
            }
        }
        this.render();
    }

    async renameItem(id, type, oldName) {
        const newName = await this.promptInput("Rename to:", oldName);
        if (!newName || newName === oldName) return;

        if (type === 'folder') {
            const folders = await this.fs.getFolders();
            const f = folders.find(x => x.id === id);
            f.name = newName;
            await this.fs.updateFolder(f);
        } else {
            const f = await this.fs.getFile(id);
            f.name = newName;
            await this.fs.updateFile(f);
            if (this.app.designState.currentFileId === id) {
                this.app.designState.currentFileName = newName;
                this.app.updateUI();
            }
        }
        this.render();
    }

    async deleteItem(id, type) {
        const confirmed = await this.confirmAction("Are you sure you want to delete this?");
        if (!confirmed) return;

        if (type === 'folder') {
            await this.fs.deleteFolder(id);
        } else {
            await this.fs.deleteFile(id);
            if (this.app.designState.currentFileId === id) {
                this.app.designState.currentFileId = null;
            }
        }
        this.render();
    }

    async exportAllZip() {
        const zip = new JSZip();
        const files = await this.fs.getFiles();
        const folders = await this.fs.getFolders();

        // Helper to build path
        const getPath = (folderId) => {
            if (!folderId) return "";
            const f = folders.find(x => x.id === folderId);
            if (!f) return "";
            return getPath(f.parentId) + f.name + "/";
        };

        // Add empty folders
        folders.forEach(f => {
            zip.folder(getPath(f.parentId) + f.name);
        });

        // Add files
        files.forEach(f => {
            zip.file(getPath(f.folderId) + f.name + ".json", f.content);
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "PetriNets_Export.zip";
        a.click();
        URL.revokeObjectURL(url);
    }
}
