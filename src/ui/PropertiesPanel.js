import { createIcons, icons } from 'lucide';

export class PropertiesPanel {
    constructor(containerId, onPropertyChange) {
        this.container = document.getElementById(containerId);
        this.onPropertyChange = onPropertyChange;
        this.selectedElement = null;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="font-size: 14px; font-weight: 600;" id="prop-title">Properties</h3>
                <button class="modal-close" id="prop-close" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
                    <i data-lucide="x" style="width:16px;height:16px;"></i>
                </button>
            </div>
            <div id="prop-content" style="display: flex; flex-direction: column; gap: 12px;"></div>
        `;
        
        document.getElementById('prop-close').addEventListener('click', () => {
            this.hide();
        });
        
        createIcons({ icons, nameAttr: 'data-lucide' });
    }

    show(element, isSmartModel) {
        this.selectedElement = element;
        this.container.classList.add('visible');
        const content = document.getElementById('prop-content');
        document.getElementById('prop-title').textContent = element.constructor.name + ' Properties';
        
        content.innerHTML = '';
        
        // Name property (for most elements except Arc, Annotation)
        if (element.name !== undefined) {
            content.appendChild(this.createInputGroup('Name', 'name', element.name));
        }

        if (element.constructor.name === 'Place') {
            if (isSmartModel && element.tokens > 0) {
                content.appendChild(this.createInputGroup('Token Value', 'tokenValue', element.getTokenValue(), 'number'));
            } else if (!isSmartModel) {
                content.appendChild(this.createInputGroup('Tokens', 'tokens', element.tokens, 'number'));
            }
        }

        if (element.constructor.name === 'Transition') {
            if (isSmartModel) {
                content.appendChild(this.createInputGroup('Task (e.g., +, -, cp)', 'task', element.task.task));
                content.appendChild(this.createInputGroup('Token Order (e.g., P1, P2)', 'tokenOrder', element.tokenOrder));
                content.appendChild(this.createCheckboxGroup('Pass on True', 'passOnTrue', element.passOnTrue));
                content.appendChild(this.createCheckboxGroup('Pass on False', 'passOnFalse', element.passOnFalse));
                content.appendChild(this.createCheckboxGroup('Pass Previous Value', 'passPreviousValue', element.passPreviousValue));
            }
        }

        if (element.constructor.name === 'Arc') {
            if (!isSmartModel) {
                content.appendChild(this.createInputGroup('Weight', 'weight', element.weight, 'number'));
            }
        }

        if (element.constructor.name === 'Initializer') {
            content.appendChild(this.createInputGroup('Tokens to Generate', 'tokensToGenerate', element.tokensToGenerate, 'number'));
            content.appendChild(this.createInputGroup('Tokens / Second', 'tokensPerSecond', element.tokensPerSecond, 'number', '0.1'));
            content.appendChild(this.createCheckboxGroup('Continuous', 'isContinuous', element.isContinuous));
            if (isSmartModel) {
                content.appendChild(this.createInputGroup('Token Value', 'tokenValue', element.tokenValue, 'number'));
            }
        }

        if (element.constructor.name === 'Annotation') {
            content.appendChild(this.createTextAreaGroup('Text', 'text', element.text));
            content.appendChild(this.createSelectGroup('Font', 'fontName', element.fontName, [
                { value: 'Arial', label: 'Arial' },
                { value: 'Inter', label: 'Inter' },
                { value: 'Roboto', label: 'Roboto' },
                { value: 'Times New Roman', label: 'Times New Roman' },
                { value: 'Courier New', label: 'Courier New' },
                { value: 'Comic Sans MS', label: 'Comic Sans MS' }
            ]));
            content.appendChild(this.createInputGroup('Font Size', 'fontSize', element.fontSize, 'number'));
            content.appendChild(this.createInputGroup('Color', 'color', element.color, 'color'));
        }

        // Attach event listeners
        content.querySelectorAll('input, textarea, select').forEach(input => {
            let hasSavedState = false;
            input.addEventListener('focus', () => {
                hasSavedState = false;
            });
            input.addEventListener('input', (e) => {
                let value = e.target.type === 'checkbox' ? e.target.checked : 
                            e.target.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
                this.onPropertyChange(this.selectedElement, e.target.name, value, !hasSavedState);
                hasSavedState = true;
            });
        });
    }

    hide() {
        this.container.classList.remove('visible');
        this.selectedElement = null;
    }

    createInputGroup(label, name, value, type = 'text', step = '1') {
        const div = document.createElement('div');
        div.className = 'prop-group';
        div.innerHTML = `
            <label>${label}</label>
            <input type="${type}" name="${name}" class="prop-input" value="${value}" ${type === 'number' ? `step="${step}"` : ''}>
        `;
        return div;
    }

    createTextAreaGroup(label, name, value) {
        const div = document.createElement('div');
        div.className = 'prop-group';
        div.innerHTML = `
            <label>${label}</label>
            <textarea name="${name}" class="prop-input" rows="3">${value}</textarea>
        `;
        return div;
    }

    createCheckboxGroup(label, name, checked) {
        const div = document.createElement('div');
        div.className = 'prop-group';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                <label style="margin:0; font-size: 13px; color: var(--text-primary); cursor: pointer;">${label}</label>
                <label class="toggle-switch">
                    <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
        return div;
    }

    createSelectGroup(label, name, value, options) {
        const div = document.createElement('div');
        div.className = 'prop-group';
        
        let optionsHtml = options.map(opt => 
            `<option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        div.innerHTML = `
            <label>${label}</label>
            <select name="${name}" class="prop-input" style="padding-right: 28px;">
                ${optionsHtml}
            </select>
        `;
        return div;
    }
}
