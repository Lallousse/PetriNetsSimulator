import { createIcons, icons } from 'lucide';

export class ModalManager {
    constructor(containerId) {
        this.overlay = document.getElementById(containerId);
        this.renderOverlay();
    }

    renderOverlay() {
        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'modal-overlay';
            this.overlay.className = 'modal-overlay';
            document.body.appendChild(this.overlay);
        }
        
        // Close on clicking outside
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
    }

    show(title, contentHtml, footerHtml = '', options = {}) {
        const maxWidth = options.maxWidth ? `max-width: ${options.maxWidth}; width: 100%;` : '';
        this.overlay.innerHTML = `
            <div class="modal-content" ${maxWidth ? `style="${maxWidth}"` : ''}>
                <div class="modal-header">
                    <div class="modal-title">${title}</div>
                    <button class="modal-close" id="modal-close-btn">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">${contentHtml}</div>
                ${footerHtml ? `<div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1)">${footerHtml}</div>` : ''}
            </div>
        `;
        
        this.overlay.style.display = 'flex';
        
        document.getElementById('modal-close-btn').addEventListener('click', () => {
            this.close();
        });

        // Initialize lucide icons in the modal
        createIcons({ icons, nameAttr: 'data-lucide' });
    }

    close() {
        this.overlay.style.display = 'none';
        this.overlay.innerHTML = '';
    }
    showConfirm(title, message, onConfirm) {
        const contentHtml = `<p style="color: var(--text-primary); font-size: 14px;">${message}</p>`;
        const footerHtml = `
            <button class="modal-btn" id="modal-cancel-btn" style="background: var(--bg-primary);">Cancel</button>
            <button class="modal-btn" id="modal-confirm-btn" style="background: var(--accent-primary); border-color: var(--accent-primary);">Confirm</button>
        `;
        this.show(title, contentHtml, footerHtml, { maxWidth: '450px' });
        
        document.getElementById('modal-cancel-btn').addEventListener('click', () => {
            this.close();
        });
        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
            this.close();
            if (onConfirm) onConfirm();
        });
    }

    showAlert(title, message) {
        const contentHtml = `<p style="color: var(--text-primary); font-size: 14px;">${message}</p>`;
        const footerHtml = `
            <button class="modal-btn" id="modal-ok-btn" style="background: var(--accent-primary); border-color: var(--accent-primary);">OK</button>
        `;
        this.show(title, contentHtml, footerHtml, { maxWidth: '450px' });
        
        document.getElementById('modal-ok-btn').addEventListener('click', () => {
            this.close();
        });
    }

    showPrompt(title, message, defaultValue, onConfirm) {
        const contentHtml = `
            <p style="color: var(--text-primary); font-size: 14px; margin-bottom: 8px;">${message}</p>
            <input type="text" id="modal-prompt-input" value="${defaultValue || ''}" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary);">
        `;
        const footerHtml = `
            <button class="modal-btn" id="modal-cancel-btn" style="background: var(--bg-primary);">Cancel</button>
            <button class="modal-btn" id="modal-confirm-btn" style="background: var(--accent-primary); border-color: var(--accent-primary);">Confirm</button>
        `;
        this.show(title, contentHtml, footerHtml, { maxWidth: '450px' });
        
        document.getElementById('modal-cancel-btn').addEventListener('click', () => {
            this.close();
        });
        document.getElementById('modal-confirm-btn').addEventListener('click', () => {
            const val = document.getElementById('modal-prompt-input').value;
            this.close();
            if (onConfirm) onConfirm(val);
        });
        
        // Focus the input when rendering
        setTimeout(() => document.getElementById('modal-prompt-input').focus(), 50);
    }
}
