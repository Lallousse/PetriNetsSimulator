import { createIcons, icons } from 'lucide';

export class Toolbar {
    constructor(containerId, tools) {
        this.container = document.getElementById(containerId);
        this.tools = tools;
        this.buttons = new Map();
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.tools.forEach((group, index) => {
            const groupEl = document.createElement('div');
            groupEl.className = 'tool-group';
            
            group.forEach(tool => {
                const btn = document.createElement('button');
                btn.className = 'tool-btn';
                btn.id = tool.id;
                btn.setAttribute('data-tooltip', tool.tooltip);
                
                // Add SVG icon placeholder
                const iconEl = document.createElement('i');
                iconEl.setAttribute('data-lucide', tool.icon);
                btn.appendChild(iconEl);
                
                if (tool.action) {
                    btn.addEventListener('click', tool.action);
                }
                
                groupEl.appendChild(btn);
                this.buttons.set(tool.id, btn);
            });
            
            this.container.appendChild(groupEl);
            
            if (index < this.tools.length - 1) {
                const divider = document.createElement('div');
                divider.className = 'toolbar-divider';
                this.container.appendChild(divider);
            }
        });
        
        // Initialize Lucide icons
        createIcons({
            icons,
            nameAttr: 'data-lucide'
        });
    }

    setActive(id, isActive = true, exclusive = false) {
        if (exclusive) {
            this.buttons.forEach(btn => btn.classList.remove('active'));
        }
        if (id && this.buttons.has(id)) {
            if (isActive) {
                this.buttons.get(id).classList.add('active');
            } else {
                this.buttons.get(id).classList.remove('active');
            }
        }
    }

    setDisabled(id, disabled) {
        if (this.buttons.has(id)) {
            this.buttons.get(id).disabled = disabled;
        }
    }
}
