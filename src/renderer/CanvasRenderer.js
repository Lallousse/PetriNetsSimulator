import { Place, Transition, Arc, Initializer, Annotation } from '../models/elements.js';

export class CanvasRenderer {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.iconSize = 40;
    }

    resize(width, height) {
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
    }

    getColors() {
        return this.isLight ? {
            placeBg: '#ffffff',
            placeBorder: '#94a3b8',
            transitionBg: '#ffffff',
            transitionBorder: '#94a3b8',
            initBg: '#f3e8ff',
            initBorder: '#a855f7',
            selectedBgPlace: '#e0e7ff',
            selectedBgInit: '#d8b4fe',
            selectedBorder: '#4f46e5',
            activeBg: '#bbf7d0',
            activeBorder: '#16a34a',
            text: '#1e293b',
            textTask: '#7c3aed',
            token: '#4f46e5',
            arc: '#64748b',
            arcHighlight: '#16a34a',
            selectionFill: 'rgba(79, 70, 229, 0.1)'
        } : {
            placeBg: '#1e1e2d',
            placeBorder: '#475569',
            transitionBg: '#1e1e2d',
            transitionBorder: '#475569',
            initBg: '#2e1065',
            initBorder: '#6d28d9',
            selectedBgPlace: '#312e81',
            selectedBgInit: '#4c1d95',
            selectedBorder: '#6366f1',
            activeBg: '#166534',
            activeBorder: '#22c55e',
            text: '#e2e8f0',
            textTask: '#8b5cf6',
            token: '#6366f1',
            arc: '#475569',
            arcHighlight: '#22c55e',
            selectionFill: 'rgba(99, 102, 241, 0.1)'
        };
    }

    render(state) {
        this.isLight = document.documentElement.getAttribute('data-theme') === 'light';
        this.c = this.getColors();
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.dpr, this.dpr);
        this.ctx.scale(state.zoomLevel, state.zoomLevel);
        
        const panX = state.inputHandler ? state.inputHandler.panX : 0;
        const panY = state.inputHandler ? state.inputHandler.panY : 0;
        this.ctx.translate(panX, panY);

        // Draw connections (arcs)
        state.arcs.forEach(arc => this.drawArc(arc, state.selectedElements.includes(arc), state.isSmartModel));
        
        // Draw drawing arc
        if (state.drawingArc && state.arcStart && state.arcEnd) {
            this.drawTempArc(state.arcStart, state.arcEnd);
        }

        // Draw elements
        state.places.forEach(p => this.drawPlace(p, state.selectedElements.includes(p)));
        state.transitions.forEach(t => this.drawTransition(t, state.selectedElements.includes(t)));
        state.initializers.forEach(i => this.drawInitializer(i, state.selectedElements.includes(i)));
        
        // Draw annotations
        state.annotations.forEach(a => this.drawAnnotation(a, state.selectedElements.includes(a)));

        // Draw animations
        state.animations.forEach(anim => this.drawAnimation(anim));

        // Draw selection area
        if (state.selectionArea) {
            this.drawSelectionArea(state.selectionArea);
        }
        
        this.ctx.restore();
    }

    drawPlace(place, selected) {
        this.ctx.beginPath();
        this.ctx.arc(place.x, place.y, this.iconSize / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = selected ? this.c.selectedBgPlace : this.c.placeBg;
        this.ctx.fill();
        this.ctx.strokeStyle = selected ? this.c.selectedBorder : this.c.placeBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.fillStyle = this.c.text;
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(place.name, place.x, place.y + this.iconSize / 2 + 16);

        // Draw tokens
        this.ctx.fillStyle = this.c.token;
        if (place.smartToken && place.tokens > 0) {
            this.ctx.font = 'bold 14px Inter';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(place.smartToken.value.toString(), place.x, place.y);
            this.ctx.textBaseline = 'alphabetic'; // reset
        } else if (place.tokens > 0) {
            this.drawTraditionalTokens(place.x, place.y, place.tokens);
        }
    }

    drawTraditionalTokens(x, y, count) {
        const tokenSize = 6;
        if (count === 1) {
            this.ctx.beginPath(); this.ctx.arc(x, y, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
        } else if (count === 2) {
            this.ctx.beginPath(); this.ctx.arc(x - tokenSize, y, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(x + tokenSize, y, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
        } else if (count === 3) {
            this.ctx.beginPath(); this.ctx.arc(x, y - tokenSize, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(x - tokenSize, y + tokenSize / 2, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(x + tokenSize, y + tokenSize / 2, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
        } else if (count === 4) {
            this.ctx.beginPath(); this.ctx.arc(x, y - tokenSize, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(x - tokenSize, y, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(x + tokenSize, y, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(x, y + tokenSize, tokenSize / 2, 0, Math.PI * 2); this.ctx.fill();
        } else {
            this.ctx.font = 'bold 12px Inter';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(count.toString(), x, y);
            this.ctx.textBaseline = 'alphabetic';
        }
    }

    drawTransition(transition, selected) {
        const width = this.iconSize * 0.8;
        const height = this.iconSize * 1.2;
        const rx = transition.x - width / 2;
        const ry = transition.y - height / 2;

        this.ctx.beginPath();
        this.ctx.roundRect(rx, ry, width, height, 4);
        this.ctx.fillStyle = selected ? this.c.selectedBgPlace : (transition.active ? this.c.activeBg : this.c.transitionBg);
        this.ctx.fill();
        this.ctx.strokeStyle = transition.active ? this.c.activeBorder : (selected ? this.c.selectedBorder : this.c.transitionBorder);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.fillStyle = this.c.text;
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(transition.name, transition.x, transition.y + height / 2 + 16);
        
        if (transition.task && transition.task.task) {
            this.ctx.fillStyle = this.c.textTask;
            this.ctx.font = '10px Inter';
            this.ctx.fillText(transition.task.task, transition.x, transition.y - height / 2 - 8);
        }
    }

    drawInitializer(initializer, selected) {
        const r = this.iconSize * 0.6;
        this.ctx.beginPath();
        this.ctx.moveTo(initializer.x, initializer.y - r);
        // Top to Right
        this.ctx.quadraticCurveTo(initializer.x, initializer.y, initializer.x + r, initializer.y);
        // Right to Bottom
        this.ctx.quadraticCurveTo(initializer.x, initializer.y, initializer.x, initializer.y + r);
        // Bottom to Left
        this.ctx.quadraticCurveTo(initializer.x, initializer.y, initializer.x - r, initializer.y);
        // Left to Top
        this.ctx.quadraticCurveTo(initializer.x, initializer.y, initializer.x, initializer.y - r);
        this.ctx.closePath();
        
        this.ctx.fillStyle = selected ? this.c.selectedBgInit : this.c.initBg;
        this.ctx.fill();
        this.ctx.strokeStyle = selected ? this.c.selectedBorder : this.c.initBorder;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.fillStyle = this.c.text;
        this.ctx.font = '12px Inter';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(initializer.name, initializer.x, initializer.y + r + 16);
    }

    drawArc(arc, selected, isSmartModel) {
        const startX = arc.start.x;
        const startY = arc.start.y;
        const endX = arc.end.x;
        const endY = arc.end.y;
        
        const angle = Math.atan2(endY - startY, endX - startX);
        const offsetStart = this.iconSize / 2;
        const offsetEnd = this.iconSize / 2 + (arc.end instanceof Transition ? 4 : 0);
        
        const adjStartX = startX + offsetStart * Math.cos(angle);
        const adjStartY = startY + offsetStart * Math.sin(angle);
        const adjEndX = endX - offsetEnd * Math.cos(angle);
        const adjEndY = endY - offsetEnd * Math.sin(angle);

        this.ctx.beginPath();
        this.ctx.moveTo(adjStartX, adjStartY);
        this.ctx.lineTo(adjEndX, adjEndY);
        
        if (arc.highlighted) {
            this.ctx.strokeStyle = this.c.arcHighlight;
            this.ctx.lineWidth = 3;
        } else {
            this.ctx.strokeStyle = selected ? this.c.selectedBorder : this.c.arc;
            this.ctx.lineWidth = selected ? 3 : 2;
        }
        this.ctx.stroke();

        // Arrow head
        const arrowSize = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(adjEndX, adjEndY);
        this.ctx.lineTo(adjEndX - arrowSize * Math.cos(angle + Math.PI / 6), adjEndY - arrowSize * Math.sin(angle + Math.PI / 6));
        this.ctx.moveTo(adjEndX, adjEndY);
        this.ctx.lineTo(adjEndX - arrowSize * Math.cos(angle - Math.PI / 6), adjEndY - arrowSize * Math.sin(angle - Math.PI / 6));
        this.ctx.stroke();

        if (!isSmartModel && arc.weight > 1) {
            const midX = (adjStartX + adjEndX) / 2;
            const midY = (adjStartY + adjEndY) / 2;
            this.ctx.fillStyle = this.c.text;
            this.ctx.font = '12px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(arc.weight.toString(), midX, midY - 8);
        }
    }

    drawTempArc(start, end) {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = this.c.selectedBorder;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawAnnotation(a, selected) {
        this.ctx.font = `${a.fontSize}px ${a.fontName}`;
        this.ctx.textAlign = 'left';
        
        const lines = a.text.split("\n");
        const width = Math.max(...lines.map(line => this.ctx.measureText(line).width));
        const height = a.fontSize * lines.length;
        const padding = 12;

        // Draw background card
        this.ctx.fillStyle = 'rgba(30, 41, 59, 0.8)'; // modern dark glass effect
        this.ctx.strokeStyle = selected ? this.c.selectedBorder : 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = selected ? 2 : 1;
        
        this.ctx.beginPath();
        this.ctx.roundRect(
            a.x - padding, 
            a.y - a.fontSize - padding/2, 
            width + padding * 2, 
            height + padding, 
            8
        );
        this.ctx.fill();
        this.ctx.stroke();

        // Draw text
        this.ctx.fillStyle = a.color;
        lines.forEach((line, i) => {
            this.ctx.fillText(line, a.x, a.y + i * a.fontSize);
        });
    }

    drawAnimation(anim) {
        const startX = anim.sourcePlace ? anim.sourcePlace.x : anim.startX;
        const startY = anim.sourcePlace ? anim.sourcePlace.y : anim.startY;
        
        let endX = anim.endX;
        let endY = anim.endY;

        if (anim.toTransition && anim.transition) {
            endX = anim.transition.x;
            endY = anim.transition.y;
        } else if (!anim.toTransition && anim.targetPlace) {
            endX = anim.targetPlace.x;
            endY = anim.targetPlace.y;
        }

        const currentX = startX + (endX - startX) * anim.progress;
        const currentY = startY + (endY - startY) * anim.progress;
        
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, 4, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.c.arcHighlight;
        this.ctx.fill();
        this.ctx.shadowColor = this.c.animShadow;
        this.ctx.shadowBlur = 8;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    drawSelectionArea(area) {
        this.ctx.fillStyle = this.c.selectionFill;
        this.ctx.strokeStyle = this.c.selectedBorder;
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(area.x, area.y, area.width, area.height);
        this.ctx.strokeRect(area.x, area.y, area.width, area.height);
    }
}
