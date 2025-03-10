class PetriNetCanvas {
    constructor() {
        this.canvas = document.getElementById("petriCanvas");
        if (!this.canvas) {
            console.error("Canvas element not found!");
            return;
        }
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
            console.error("Failed to get 2D context!");
            return;
        }
        
        this.toolTipElements = new WeakMap(); // Store tooltip elements
        this.dropdownElements = new WeakMap(); // Store dropdown elements
        this.lastPinchDistance = null; // Store pinch distance for zoom
        this.activeDropdownBtn = null; // Track the currently active dropdown button
        
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.drawingArc = false;
        this.arcStart = null;
        this.arcEnd = null;
        this.selectionArea = null;
        this.selectionStart = null;
        this.handMode = false;
        this.draggingCanvas = false;
        this.draggingElements = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.autoRun = false;
        this.lastStep = 0;
        this.animationSpeed = 1.0;
        this.speedOptions = [0.25, 0.5, 1.0, 1.5, 2];
        this.currentSpeedIndex = 2;
        this.paused = false;
        this.snappingEnabled = false;
        this.zoomLevel = 1.0;
        this.isSmartModel = false;
        this.designState = new DesignState(this);
        this.designExists = false;
        this.arcType = "line";
        this.draggingControlPoint = false;
        this.editingElement = null;

        this.iconSize = 32;
        this.tokenSize = 8;
        this.stepDelay = 1000;
        this.animationSpeedBase = 0.1;

        this.icons = {};
        this.undoHistory = [];
        this.redoHistory = [];
        this.maxHistorySize = 10;
        this.lastPinchDistance = null;
        this.canvasWidth = window.innerWidth;
        this.canvasHeight = window.innerHeight - 30;
        this.tokenQueue = new Map();
        this.firingTimeouts = new Map();

        this.resize();
        this.loadIcons();
        this.initEventListeners();
        this.updateButtonStates();
        this.updateStatus("Ready", this.isSmartModel ? "S-Model" : "T-Model");
        this.renderLoop();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight - 30;
        const widthRatio = newWidth / this.canvasWidth;
        const heightRatio = newHeight / this.canvasHeight;

        this.places.forEach(p => { p.x *= widthRatio; p.y *= heightRatio; });
        this.transitions.forEach(t => { t.x *= widthRatio; t.y *= heightRatio; });
        this.initializers.forEach(i => { i.x *= widthRatio; i.y *= heightRatio; });
        this.annotations.forEach(a => { a.x *= widthRatio; a.y *= heightRatio; });
        this.arcs.forEach(a => {
            if (a.controlPoints.length > 0) {
                a.controlPoints.forEach(cp => { cp.x *= widthRatio; cp.y *= heightRatio; });
            }
        });

        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;

        this.canvas.width = newWidth * dpr;
        this.canvas.height = newHeight * dpr;
        this.canvas.style.width = `${newWidth}px`;
        this.canvas.style.height = `${newHeight}px`;
        this.ctx.scale(dpr, dpr);
        console.log("Canvas resized to:", this.canvas.width, this.canvas.height);
    }

    loadIcons() {
        const iconNames = [
            "new", "place", "transition", "delete", "plus", "minus", "play", "pause",
            "save", "load", "arc", "reset", "speed", "select", "snap", "zin", "zout",
            "clear", "switch", "guide", "ini", "note", "color", "font", "pnfn", "mrpn", "hand"
        ];
        iconNames.forEach(name => {
            this.icons[name] = new Image();
            this.icons[name].src = `assets/${name}.png`;
            this.icons[name].onload = () => {
                console.log(`Loaded icon: ${name}`);
                this.renderLoop();
            };
            this.icons[name].onerror = () => console.error(`Failed to load icon: ${name}`);
        });
    }

    initEventListeners() {
        // Mouse events
        this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e));
        this.canvas.addEventListener("mouseup", (e) => this.handleMouseUp(e));
        this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        this.canvas.addEventListener("dblclick", (e) => this.handleDoubleClick(e));
        this.canvas.addEventListener("wheel", (e) => this.handleWheel(e));
        this.canvas.addEventListener("click", (e) => this.handleClick(e));

        // Touch events
        this.canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
        this.canvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY, buttons: 1 });
            } else if (e.touches.length === 2) {
                // Pinch-to-zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch1.clientX - touch2.clientX,
                    touch1.clientY - touch2.clientY
                );
                if (!this.lastPinchDistance) {
                    this.lastPinchDistance = currentDistance;
                } else {
                    const delta = currentDistance - this.lastPinchDistance;
                    if (delta > 0) {
                        this.zoomIn();
                    } else if (delta < 0) {
                        this.zoomOut();
                    }
                    this.lastPinchDistance = currentDistance;
                }
            }
        }, { passive: false });
        this.canvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.handleMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
            this.lastPinchDistance = null; // Reset pinch distance
        }, { passive: false });

        // Button events
        document.getElementById("newBtn").addEventListener("click", () => this.newDesign());
        document.getElementById("selectBtn").addEventListener("click", () => this.setMode("select"));
        document.getElementById("handBtn").addEventListener("click", () => this.setMode("hand"));
        document.getElementById("placeBtn").addEventListener("click", () => this.setMode("place"));
        document.getElementById("transitionBtn").addEventListener("click", () => this.setMode("transition"));
        document.getElementById("iniBtn").addEventListener("click", () => this.setMode("ini"));
        document.getElementById("arcBtn").addEventListener("click", () => this.setMode("arc"));
        document.getElementById("deleteBtn").addEventListener("click", () => this.deleteSelected());
        document.getElementById("plusTokenBtn").addEventListener("click", () => this.addToken());
        document.getElementById("minusTokenBtn").addEventListener("click", () => this.removeToken());
        document.getElementById("playPauseBtn").addEventListener("click", () => this.togglePlayPause());
        document.getElementById("resetBtn").addEventListener("click", () => this.resetTokens());
        document.getElementById("snapBtn").addEventListener("click", () => this.toggleSnap());
        document.getElementById("speedBtn").addEventListener("click", () => this.cycleSpeed());
        document.getElementById("saveBtn").addEventListener("click", () => this.saveDesign());
        document.getElementById("loadBtn").addEventListener("click", () => this.loadDesign());
        document.getElementById("clearBtn").addEventListener("click", () => this.clearCanvas());
        document.getElementById("switchBtn").addEventListener("click", () => this.toggleModel());
        document.getElementById("guideBtn").addEventListener("click", () => this.showGuide());
        document.getElementById("annotateBtn").addEventListener("click", () => this.setMode("annotate"));
        document.getElementById("pnfnBtn").addEventListener("click", () => this.showPNFN());
        document.getElementById("mrpnBtn").addEventListener("click", () => this.showMRPN());

        // Handle dropdowns for color and font (click only, remove hover)
        const colorBtn = document.querySelector('.tool-btn[title="Color"]');
        const fontBtn = document.querySelector('.tool-btn[title="Font"]');
        if (colorBtn) colorBtn.addEventListener("click", (e) => { e.preventDefault(); this.toggleDropdown(colorBtn, "color-palette"); });
        if (fontBtn) fontBtn.addEventListener("click", (e) => { e.preventDefault(); this.toggleDropdown(fontBtn, "font-picker"); });

        // Add tooltips (once, for performance)
        document.querySelectorAll(".tool-btn").forEach(btn => {
            const title = btn.getAttribute("title");
            if (title) {
                let tooltip = this.toolTipElements.get(btn);
                if (!tooltip) {
                    tooltip = document.createElement("span");
                    tooltip.className = "tool-tooltip";
                    btn.appendChild(tooltip);
                    this.toolTipElements.set(btn, tooltip);
                }
                tooltip.textContent = title;
                tooltip.style.display = "none"; // Hidden by default

                btn.addEventListener("mouseover", () => {
                    tooltip.style.display = "block";
                });
                btn.addEventListener("mouseout", () => {
                    tooltip.style.display = "none";
                });
            }
        });

        document.getElementById("pnfnInsertBtn").addEventListener("click", () => this.insertPNFNAsNote());
        document.getElementById("pnfnRegenerateAllBtn").addEventListener("click", () => this.regeneratePNFN(true));
        document.getElementById("pnfnRegenerateM0Btn").addEventListener("click", () => this.regeneratePNFN(false));
        document.getElementById("mrpnInsertBtn").addEventListener("click", () => this.insertMRPNAsNote());
        document.getElementById("mrpnRegenerateAllBtn").addEventListener("click", () => this.regenerateMRPN(true));
        document.getElementById("mrpnRegenerateM0Btn").addEventListener("click", () => this.regenerateMRPN(false));

        document.getElementById("zoomInBtn").addEventListener("click", () => this.zoomIn());
        document.getElementById("zoomOutBtn").addEventListener("click", () => this.zoomOut());

        // Close dropdowns on outside click
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".tool-btn[title='Color'], .tool-btn[title='Font']")) {
                this.dropdownElements.forEach((dropdown, btn) => {
                    dropdown.style.opacity = "0";
                    dropdown.style.pointerEvents = "none";
                    dropdown.style.transform = btn.closest("#right-panel") ? "translateX(100%)" : "translateX(-100%)";
                });
                this.activeDropdownBtn = null;
            }
        });

        window.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.key === "z") this.undo();
            if (e.ctrlKey && e.shiftKey && e.key === "Z") this.redo();
            if ((e.key === "Backspace" || e.key === "Delete") && !this.editingElement) this.deleteSelected();
            if (e.ctrlKey && e.key === "s") {
                e.preventDefault();
                this.saveDesign();
            }
            if (this.editingElement && e.key === "Escape" && !document.getElementById("editModal") && !document.getElementById("pnfnModal") && !document.getElementById("mrpnModal")) {
                this.finishEditing(false);
                e.preventDefault();
            }
        });

        window.addEventListener("resize", () => this.resize());
        document.querySelectorAll(".close").forEach(close => close.onclick = () => {
            const modal = close.closest(".modal");
            if (modal) modal.remove();
        });
    }

    toggleDropdown(btn, type) {
        let dropdown = this.dropdownElements.get(btn);
        if (!dropdown) {
            dropdown = document.createElement("div");
            dropdown.className = `dropdown-content ${type}`;
            document.body.appendChild(dropdown); // Add to body, not panel
            this.dropdownElements.set(btn, dropdown);

            if (type === "color-palette") {
                const colors = ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
                colors.forEach(color => {
                    const option = document.createElement("div");
                    option.className = "color-option";
                    option.style.backgroundColor = color;
                    option.addEventListener("click", () => {
                        this.changeAnnotationColor(color);
                        this.closeDropdown(btn); // Close after selection
                    });
                    dropdown.appendChild(option);
                });
            } else if (type === "font-picker") {
                const fonts = ["Arial", "Times New Roman", "Helvetica Neue", "Courier New", "Monospaced"];
                const sizes = [8, 10, 12, 14, 16, 18, 20];
                const fontSelect = document.createElement("select");
                fontSelect.id = "fontFamilySelect";
                fonts.forEach(font => {
                    const option = document.createElement("option");
                    option.value = font;
                    option.textContent = font;
                    fontSelect.appendChild(option);
                });
                fontSelect.addEventListener("change", () => {
                    const size = parseInt(document.getElementById("fontSizeSelect").value);
                    this.changeAnnotationFont(fontSelect.value, size);
                    this.closeDropdown(btn); // Close after selection
                });
                dropdown.appendChild(fontSelect);

                const sizeSelect = document.createElement("select");
                sizeSelect.id = "fontSizeSelect";
                sizes.forEach(size => {
                    const option = document.createElement("option");
                    option.value = size;
                    option.textContent = size;
                    sizeSelect.appendChild(option);
                });
                sizeSelect.addEventListener("change", () => {
                    const font = document.getElementById("fontFamilySelect").value;
                    this.changeAnnotationFont(font, parseInt(sizeSelect.value));
                    this.closeDropdown(btn); // Close after selection
                });
                dropdown.appendChild(sizeSelect);
            }
        }

        const rect = btn.getBoundingClientRect();
        const isRightPanel = btn.closest("#right-panel");
        dropdown.style.position = "fixed";
        
        // Position for left panel (slide right-to-left)
        if (!isRightPanel) {
            dropdown.style.left = `${rect.right}px`;
            dropdown.style.top = `${rect.top}px`;
            dropdown.style.transform = "translateX(-100%)";
        } 
        // Position for right panel (slide left-to-right)
        else {
            dropdown.style.right = `${window.innerWidth - rect.left}px`;
            dropdown.style.top = `${rect.top}px`;
            dropdown.style.transform = "translateX(100%)";
        }

        dropdown.style.opacity = "0";
        dropdown.style.pointerEvents = "none";

        // Toggle visibility and track active dropdown
        if (this.activeDropdownBtn === btn) {
            this.closeDropdown(btn); // Re-click to close
            this.activeDropdownBtn = null;
        } else {
            if (this.activeDropdownBtn) this.closeDropdown(this.activeDropdownBtn); // Close previous
            dropdown.style.opacity = "1";
            dropdown.style.pointerEvents = "auto";
            dropdown.style.transform = "translateX(0)";
            this.activeDropdownBtn = btn;
        }

        // Close dropdowns on outside click (handled in document.click)
    }

    renderLoop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        // Draw arcs with highlighting
        this.arcs.forEach(arc => {
            arc.draw(this.ctx, this.selectedElements.includes(arc), this.iconSize);
            if (arc.highlighted) {
                this.ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(arc.start.x, arc.start.y);
                this.ctx.lineTo(arc.end.x, arc.end.y);
                this.ctx.stroke();
            }
        });

        if (this.drawingArc && this.arcStart && this.arcEnd) {
            this.ctx.strokeStyle = "green";
            this.ctx.beginPath();
            this.ctx.moveTo(this.arcStart.x, this.arcStart.y);
            this.ctx.lineTo(this.arcEnd.x, this.arcEnd.y);
            this.ctx.stroke();
        }

        this.places.forEach(place => place.draw(this.ctx, this.selectedElements.includes(place), this.iconSize, this.tokenSize));

        // Draw transitions with highlighting
        this.transitions.forEach(trans => {
            const isHighlighted = this.animations.some(anim => anim.transition === trans && anim.toTransition && !anim.isFinished());
            trans.draw(this.ctx, this.selectedElements.includes(trans), this.iconSize, isHighlighted);
        });

        this.initializers.forEach(ini => ini.draw(this.ctx, this.selectedElements.includes(ini), this.iconSize));
        this.annotations.forEach(annot => annot.draw(this.ctx, this.selectedElements.includes(annot)));
        this.animations.forEach(anim => anim.draw(this.ctx, this.tokenSize));

        if (this.selectionArea) {
            this.ctx.fillStyle = "rgba(0, 120, 255, 0.2)";
            this.ctx.fillRect(this.selectionArea.x, this.selectionArea.y, this.selectionArea.width, this.selectionArea.height);
            this.ctx.strokeStyle = "rgba(0, 120, 255, 1)";
            this.ctx.strokeRect(this.selectionArea.x, this.selectionArea.y, this.selectionArea.width, this.selectionArea.height);
        }
        if (this.selected && this.selectedElements.length === 1) {
            this.drawProperties();
        }
        if (this.editingElement && !(this.editingElement instanceof Place || this.editingElement instanceof Transition || this.editingElement instanceof Initializer || this.editingElement instanceof Arc)) {
            this.drawEditing(this.editingElement);
        }

        this.ctx.restore();
        if (this.autoRun && !this.paused) {
            const now = Date.now();
            if (now - this.lastStep >= this.stepDelay) {
                this.simulateStep();
                this.lastStep = now;
            }
            this.updateAnimations();
            this.generateTokensFromInitializers();
        }
        requestAnimationFrame(() => this.renderLoop());
    }

    drawProperties() {
        this.ctx.fillStyle = "black";
        this.ctx.font = "12px Helvetica Neue";
        let y = 10;
        if (this.selected instanceof Place) {
            const p = this.selected;
            this.ctx.fillText(`Name: ${p.name}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${p.tokens}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel && p.tokens > 0) {
                this.ctx.fillText(`Token Value: ${p.getTokenValue()}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
            }
        } else if (this.selected instanceof Transition) {
            const t = this.selected;
            this.ctx.fillText(`Name: ${t.name}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Inputs: ${t.inputArcs.length}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Outputs: ${t.outputArcs.length}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel) {
                this.ctx.fillText(`Task: ${t.task.task}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
                this.ctx.fillText(`Token Order: ${t.tokenOrder}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
            }
        } else if (this.selected instanceof Initializer) {
            const i = this.selected;
            this.ctx.fillText(`Name: ${i.name}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Tokens: ${i.tokensToGenerate}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (this.isSmartModel) {
                this.ctx.fillText(`Token Value: ${i.tokenValue}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            }
            this.ctx.fillText(`Rate: ${i.tokensPerSecond}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Continuous: ${i.isContinuous}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
        } else if (this.selected instanceof Annotation) {
            const a = this.selected;
            this.ctx.fillText(`Text: ${a.text}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Color: ${a.color}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            this.ctx.fillText(`Font: ${a.fontName} ${a.fontSize}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
        } else if (this.selected instanceof Arc) {
            const a = this.selected;
            this.ctx.fillText(`Arc Type: ${a.type}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y); y += 20;
            if (!this.isSmartModel) {
                this.ctx.fillText(`Weight: ${a.getWeight()}`, (this.canvas.width / window.devicePixelRatio - 190) / this.zoomLevel, y);
            }
        }
    }

    drawEditing(element) {
        if (!(element instanceof Annotation)) return;

        const input = document.createElement("textarea");
        const rect = this.canvas.getBoundingClientRect();
        input.style.position = "absolute";
        input.style.left = `${rect.left + (element.x * this.zoomLevel)}px`;
        input.style.top = `${rect.top + (element.y * this.zoomLevel)}px`;
        input.style.resize = "both";
        input.style.width = `${element.fontSize * 10}px`;
        input.style.height = `${element.fontSize * element.text.split("\n").length + 20}px`;
        input.style.font = `${element.fontSize}px ${element.fontName}`;
        input.style.zIndex = "1200";
        input.value = element.text;
        document.body.appendChild(input);
        input.focus();
        input.select();

        const finish = (save) => {
            const newValue = input.value.trim();
            if (save && newValue) {
                this.saveStateToUndo();
                element.text = newValue;
                this.designState.setUnsavedChanges();
            }
            document.body.removeChild(input);
            this.editingElement = null;
            this.setMode("select");
            this.updateButtonStates();
        };

        input.onblur = () => finish(true);
        input.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                return; // Allow new line
            } else if (e.key === "Enter" && e.shiftKey) {
                finish(true);
                e.preventDefault();
            } else if (e.key === "Escape") {
                finish(false);
                e.preventDefault();
            }
            if (e.key === "Backspace" || e.key === "Delete") {
                e.stopPropagation();
            }
        };
    }

    showEditModal(element) {
        const modal = document.createElement("div");
        modal.className = "modal";
        modal.id = "editModal";
        modal.style.display = "block";
        modal.style.position = "fixed";
        modal.style.left = "0";
        modal.style.top = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        modal.style.zIndex = "2000";

        const content = document.createElement("div");
        content.className = "modal-content";
        content.style.position = "absolute";
        content.style.left = "50%";
        content.style.top = "50%";
        content.style.transform = "translate(-50%, -50%)";
        content.style.backgroundColor = "#fff";
        content.style.padding = "20px";
        content.style.borderRadius = "8px";
        content.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        content.style.width = "400px";
        content.style.maxWidth = "90vw";
        content.style.maxHeight = "80vh";
        content.style.overflowY = "auto";
        content.style.resize = "both";

        const header = document.createElement("div");
        header.style.cursor = "move";
        header.style.padding = "10px";
        header.style.backgroundColor = "#f0f0f0";
        header.style.borderBottom = "1px solid #ddd";
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";

        const close = document.createElement("span");
        close.className = "close";
        close.innerHTML = "×";
        close.style.fontSize = "20px";
        close.style.cursor = "pointer";
        close.onclick = () => {
            document.body.removeChild(modal);
            this.editingElement = null;
        };

        const title = document.createElement("h3");
        title.style.margin = "0";
        title.style.fontSize = "16px";

        const form = document.createElement("div");
        form.style.display = "grid";
        form.style.gridTemplateColumns = "1fr 2fr";
        form.style.gap = "10px";
        form.style.padding = "10px 0";
        form.style.alignItems = "center";

        const pinBtn = document.createElement("button");
        pinBtn.textContent = "Pin";
        pinBtn.className = "modal-btn save-btn";
        pinBtn.style.padding = "8px 16px";
        pinBtn.style.marginLeft = "10px";
        pinBtn.onclick = () => {
            modal.style.backgroundColor = "transparent";
            modal.style.pointerEvents = "none";
            content.style.pointerEvents = "auto";
            pinBtn.style.display = "none";
        };

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Save";
        saveBtn.className = "modal-btn save-btn";
        saveBtn.style.gridColumn = "1 / 3";
        saveBtn.style.marginTop = "20px";

        header.appendChild(title);
        header.appendChild(close);

        if (element instanceof Place) {
            title.textContent = "Edit Place";
            form.innerHTML = `
                <label for="editName">Name:</label>
                <input type="text" id="editName" value="${element.name}">
                <label for="editTokens">Tokens:</label>
                <input type="number" id="editTokens" value="${element.tokens}" min="0">
                ${this.isSmartModel ? `<label for="editTokenValue">Token Value:</label>
                <input type="number" id="editTokenValue" value="${element.getTokenValue()}">` : ""}
            `;
            saveBtn.onclick = () => {
                this.saveStateToUndo();
                element.name = document.getElementById("editName").value;
                element.tokens = parseInt(document.getElementById("editTokens").value) || 0;
                if (this.isSmartModel) element.setTokenValue(parseFloat(document.getElementById("editTokenValue").value) || 0);
                this.finishModal(modal);
            };
        } else if (element instanceof Transition) {
            title.textContent = "Edit Transition";
            form.innerHTML = `
                <label for="editName">Name:</label>
                <input type="text" id="editName" value="${element.name}">
                ${this.isSmartModel ? `
                <label for="editTask">Task:</label>
                <input type="text" id="editTask" value="${element.task.task}">
                <label for="editTokenOrder">Token Order:</label>
                <input type="text" id="editTokenOrder" value="${element.tokenOrder}" placeholder="e.g., P1,P2">
                <label for="editPassOnTrue">Pass on True:</label>
                <input type="checkbox" id="editPassOnTrue" ${element.passOnTrue ? "checked" : ""}>
                <label for="editPassOnFalse">Pass on False:</label>
                <input type="checkbox" id="editPassOnFalse" ${element.passOnFalse ? "checked" : ""}>
                <label for="editPassPreviousValue">Pass Previous Value:</label>
                <input type="checkbox" id="editPassPreviousValue" ${element.passPreviousValue ? "checked" : ""}>
                ` : ""}
            `;
            saveBtn.onclick = () => {
                this.saveStateToUndo();
                element.name = document.getElementById("editName").value;
                if (this.isSmartModel) {
                    element.task = new TransitionTask(document.getElementById("editTask").value);
                    element.tokenOrder = document.getElementById("editTokenOrder").value;
                    element.passOnTrue = document.getElementById("editPassOnTrue").checked;
                    element.passOnFalse = document.getElementById("editPassOnFalse").checked;
                    element.passPreviousValue = document.getElementById("editPassPreviousValue").checked;
                }
                this.finishModal(modal);
            };
        } else if (element instanceof Initializer) {
            title.textContent = "Edit Initializer";
            form.innerHTML = `
                <label for="editName">Name:</label>
                <input type="text" id="editName" value="${element.name}">
                <label for="editTokensToGenerate">Tokens to Generate:</label>
                <input type="number" id="editTokensToGenerate" value="${element.tokensToGenerate}" min="0">
                <label for="editTokensPerSecond">Tokens per Second:</label>
                <input type="number" id="editTokensPerSecond" value="${element.tokensPerSecond}" step="0.1" min="0">
                <label for="editIsContinuous">Continuous:</label>
                <input type="checkbox" id="editIsContinuous" ${element.isContinuous ? "checked" : ""}>
                ${this.isSmartModel ? `
                <label for="editTokenValue">Token Value:</label>
                <input type="number" id="editTokenValue" value="${element.tokenValue}">
                ` : ""}
            `;
            saveBtn.onclick = () => {
                this.saveStateToUndo();
                element.name = document.getElementById("editName").value;
                element.tokensToGenerate = parseInt(document.getElementById("editTokensToGenerate").value) || 0;
                element.tokensPerSecond = parseFloat(document.getElementById("editTokensPerSecond").value) || 1.0;
                element.isContinuous = document.getElementById("editIsContinuous").checked;
                if (this.isSmartModel) element.tokenValue = parseFloat(document.getElementById("editTokenValue").value) || 0;
                element.tokensGenerated = 0;
                element.lastGenerationTime = Date.now();
                this.finishModal(modal);
            };
        } else if (element instanceof Arc && !this.isSmartModel) {
            title.textContent = "Edit Arc";
            form.innerHTML = `
                <label for="editWeight">Weight:</label>
                <input type="number" id="editWeight" value="${element.getWeight()}" min="1">
            `;
            saveBtn.onclick = () => {
                this.saveStateToUndo();
                const w = parseInt(document.getElementById("editWeight").value) || 1;
                element.setWeight(w);
                if (element.isInput) {
                    element.end.inputArcs.find(a => a.place === element.start).weight = w;
                } else {
                    element.start.outputArcs.find(a => a.place === element.end).weight = w;
                }
                this.finishModal(modal);
            };
        }

        content.appendChild(header);
        content.appendChild(form);
        content.appendChild(saveBtn);
        content.appendChild(pinBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);

        let offsetX, offsetY;
        header.onmousedown = (e) => {
            if (e.target !== header) return;
            const rect = content.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.onmousemove = (e) => {
                content.style.left = `${e.clientX - offsetX}px`;
                content.style.top = `${e.clientY - offsetY}px`;
                content.style.transform = "none";
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    finishModal(modal) {
        this.designState.setUnsavedChanges();
        document.body.removeChild(modal);
        this.editingElement = null;
        this.updateButtonStates();
    }

    showPNFN() {
        try {
            const analyzer = new NetAnalyzer(this);
            const nets = analyzer.analyze();
            let text = "";
            nets.forEach((net, i) => {
                text += `Net ${i + 1}:\n${net.toFormalNotation(this.isSmartModel)}\n\n`;
            });

            const modal = document.createElement("div");
            modal.className = "modal";
            modal.id = "pnfnModal";
            modal.style.display = "block";
            modal.style.position = "fixed";
            modal.style.left = "0";
            modal.style.top = "0";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            modal.style.zIndex = "2000";

            const content = document.createElement("div");
            content.className = "modal-content";
            content.style.position = "absolute";
            content.style.left = "50%";
            content.style.top = "50%";
            content.style.transform = "translate(-50%, -50%)";
            content.style.backgroundColor = "#fff";
            content.style.padding = "20px";
            content.style.borderRadius = "8px";
            content.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
            content.style.width = "600px";
            content.style.maxWidth = "90vw";
            content.style.maxHeight = "80vh";
            content.style.overflowY = "auto";
            content.style.resize = "both";

            const header = document.createElement("div");
            header.style.cursor = "move";
            header.style.padding = "10px";
            header.style.backgroundColor = "#f0f0f0";
            header.style.borderBottom = "1px solid #ddd";
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";

            const title = document.createElement("h3");
            title.textContent = "Petri Net Formal Notation (PN-FN)";
            title.style.margin = "0";
            title.style.fontSize = "16px";

            const close = document.createElement("span");
            close.className = "close";
            close.innerHTML = "×";
            close.style.fontSize = "20px";
            close.style.cursor = "pointer";
            close.onclick = () => content.parentElement.remove();

            header.appendChild(title);
            header.appendChild(close);
            content.appendChild(header);

            const textarea = document.createElement("textarea");
            textarea.id = "pnfnText";
            textarea.value = text;
            textarea.readOnly = true;
            textarea.style.width = "100%";
            textarea.style.height = "300px";
            textarea.style.resize = "none";
            textarea.style.padding = "10px";
            textarea.style.border = "1px solid #ddd";
            textarea.style.borderRadius = "4px";
            textarea.style.font = "12px Monospaced";
            content.appendChild(textarea);

            const controlPanel = document.createElement("div");
            controlPanel.style.display = "flex";
            controlPanel.style.justifyContent = "space-between";
            controlPanel.style.marginTop = "10px";
            controlPanel.style.gap = "10px";

            const buttonPanel = document.createElement("div");
            buttonPanel.style.display = "flex";
            buttonPanel.style.gap = "10px";

            const insertBtn = document.createElement("button");
            insertBtn.textContent = "Insert as Note";
            insertBtn.className = "modal-btn";
            insertBtn.onclick = () => this.insertPNFNAsNote();

            const regenAllBtn = document.createElement("button");
            regenAllBtn.textContent = "Reload All";
            regenAllBtn.className = "modal-btn";
            regenAllBtn.onclick = () => {
                const nets = new NetAnalyzer(this).analyze();
                let newText = "";
                nets.forEach((net, i) => {
                    newText += `Net ${i + 1}:\n${net.toFormalNotation(this.isSmartModel)}\n\n`;
                });
                textarea.value = newText;
            };

            const regenM0Btn = document.createElement("button");
            regenM0Btn.textContent = "Regenerate M₀";
            regenM0Btn.className = "modal-btn";
            regenM0Btn.onclick = () => this.regeneratePNFN(false);

            const fontPanel = document.createElement("div");
            fontPanel.style.display = "flex";
            fontPanel.style.alignItems = "center";
            fontPanel.style.gap = "5px";

            const fontLabel = document.createElement("label");
            fontLabel.textContent = "Font Size:";
            fontPanel.appendChild(fontLabel);

            const fontSizeSelect = document.createElement("select");
            [8, 10, 12, 14, 16, 18, 20, 24].forEach(size => {
                const option = document.createElement("option");
                option.value = size;
                option.textContent = size;
                if (size === 12) option.selected = true;
                fontSizeSelect.appendChild(option);
            });
            fontSizeSelect.onchange = () => {
                textarea.style.fontSize = `${fontSizeSelect.value}px`;
            };
            fontPanel.appendChild(fontSizeSelect);

            const pinBtn = document.createElement("button");
            pinBtn.textContent = "Pin";
            pinBtn.className = "modal-btn save-btn";
            pinBtn.style.padding = "8px 16px";
            pinBtn.onclick = () => {
                modal.style.backgroundColor = "transparent";
                modal.style.pointerEvents = "none";
                content.style.pointerEvents = "auto";
                pinBtn.style.display = "none";
            };

            buttonPanel.appendChild(regenM0Btn);
            buttonPanel.appendChild(regenAllBtn);
            buttonPanel.appendChild(insertBtn);
            controlPanel.appendChild(buttonPanel);
            controlPanel.appendChild(fontPanel);
            controlPanel.appendChild(pinBtn);
            content.appendChild(controlPanel);

            modal.appendChild(content);
            document.body.appendChild(modal);

            let offsetX, offsetY;
            header.onmousedown = (e) => {
                if (e.target !== header) return;
                const rect = content.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                document.onmousemove = (e) => {
                    content.style.left = `${e.clientX - offsetX}px`;
                    content.style.top = `${e.clientY - offsetY}px`;
                    content.style.transform = "none";
                };
                document.onmouseup = () => {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };

            this.updateStatus("PN-FN opened", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("PN-FN modal opened");
        } catch (e) {
            console.error("Error in showPNFN:", e);
            this.updateStatus("Error opening PN-FN: " + e.message, this.isSmartModel ? "S-Model" : "T-Model");
        }
    }

    showMRPN() {
        try {
            const analyzer = new NetAnalyzer(this);
            const nets = analyzer.analyze();

            const modal = document.createElement("div");
            modal.className = "modal";
            modal.id = "mrpnModal";
            modal.style.display = "block";
            modal.style.position = "fixed";
            modal.style.left = "0";
            modal.style.top = "0";
            modal.style.width = "100%";
            modal.style.height = "100%";
            modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            modal.style.zIndex = "2000";

            const content = document.createElement("div");
            content.className = "modal-content";
            content.style.position = "absolute";
            content.style.left = "50%";
            content.style.top = "50%";
            content.style.transform = "translate(-50%, -50%)";
            content.style.backgroundColor = "#fff";
            content.style.padding = "20px";
            content.style.borderRadius = "8px";
            content.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
            content.style.width = "600px";
            content.style.maxWidth = "90vw";
            content.style.maxHeight = "80vh";
            content.style.overflowY = "auto";
            content.style.resize = "both";

            const header = document.createElement("div");
            header.style.cursor = "move";
            header.style.padding = "10px";
            header.style.backgroundColor = "#f0f0f0";
            header.style.borderBottom = "1px solid #ddd";
            header.style.display = "flex";
            header.style.justifyContent = "space-between";
            header.style.alignItems = "center";

            const title = document.createElement("h3");
            title.textContent = "Matrix Representation Petri Net (MR-PN)";
            title.style.margin = "0";
            title.style.fontSize = "16px";

            const close = document.createElement("span");
            close.className = "close";
            close.innerHTML = "×";
            close.style.fontSize = "20px";
            close.style.cursor = "pointer";
            close.onclick = () => content.parentElement.remove();

            header.appendChild(title);
            header.appendChild(close);
            content.appendChild(header);

            const tableContainer = document.createElement("div");
            tableContainer.id = "mrpnTableContainer";
            tableContainer.style.maxHeight = "300px";
            tableContainer.style.overflowY = "auto";
            tableContainer.style.border = "1px solid #ddd";
            tableContainer.style.padding = "10px";
            tableContainer.style.borderRadius = "4px";

            let fullText = "";
            nets.forEach((net, netIndex) => {
                const placeList = Array.from(net.places);
                const transitionList = Array.from(net.transitions);
                if (placeList.length === 0 || transitionList.length === 0) {
                    tableContainer.innerHTML += `<p>Net ${netIndex + 1}: No design elements available.</p>`;
                    fullText += `Net ${netIndex + 1}: No design elements available.\n\n`;
                    return;
                }

                const netLabel = document.createElement("label");
                netLabel.textContent = `Net ${netIndex + 1}:`;
                netLabel.style.font = "bold 14px Monospaced";
                tableContainer.appendChild(netLabel);

                const inputLabel = document.createElement("label");
                inputLabel.textContent = "Input Matrix:";
                inputLabel.style.font = "bold 12px Monospaced";
                tableContainer.appendChild(inputLabel);

                const inputTable = document.createElement("table");
                inputTable.style.borderCollapse = "collapse";
                inputTable.style.width = "100%";
                inputTable.style.marginBottom = "10px";

                const inputHeader = document.createElement("tr");
                inputHeader.appendChild(document.createElement("th"));
                transitionList.forEach(t => {
                    const th = document.createElement("th");
                    th.textContent = t.name;
                    th.style.border = "1px solid #ddd";
                    th.style.padding = "8px";
                    th.style.backgroundColor = "#f2f2f2";
                    inputHeader.appendChild(th);
                });
                inputTable.appendChild(inputHeader);

                placeList.forEach((p, i) => {
                    const tr = document.createElement("tr");
                    const tdPlace = document.createElement("td");
                    tdPlace.textContent = p.name;
                    tdPlace.style.border = "1px solid #ddd";
                    tdPlace.style.padding = "8px";
                    tr.appendChild(tdPlace);
                    transitionList.forEach(t => {
                        const td = document.createElement("td");
                        const weight = net.inputFunction.get(`${p.name},${t.name}`) || 0;
                        td.textContent = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                        td.style.border = "1px solid #ddd";
                        td.style.padding = "8px";
                        td.style.textAlign = "center";
                        tr.appendChild(td);
                    });
                    inputTable.appendChild(tr);
                });
                tableContainer.appendChild(inputTable);

                const outputLabel = document.createElement("label");
                outputLabel.textContent = "Output Matrix:";
                outputLabel.style.font = "bold 12px Monospaced";
                tableContainer.appendChild(outputLabel);

                const outputTable = document.createElement("table");
                outputTable.style.borderCollapse = "collapse";
                outputTable.style.width = "100%";
                outputTable.style.marginBottom = "10px";

                const outputHeader = document.createElement("tr");
                outputHeader.appendChild(document.createElement("th"));
                transitionList.forEach(t => {
                    const th = document.createElement("th");
                    th.textContent = t.name;
                    th.style.border = "1px solid #ddd";
                    th.style.padding = "8px";
                    th.style.backgroundColor = "#f2f2f2";
                    outputHeader.appendChild(th);
                });
                outputTable.appendChild(outputHeader);

                placeList.forEach((p, i) => {
                    const tr = document.createElement("tr");
                    const tdPlace = document.createElement("td");
                    tdPlace.textContent = p.name;
                    tdPlace.style.border = "1px solid #ddd";
                    tdPlace.style.padding = "8px";
                    tr.appendChild(tdPlace);
                    transitionList.forEach(t => {
                        const td = document.createElement("td");
                        const weight = net.outputFunction.get(`${p.name},${t.name}`) || 0;
                        td.textContent = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                        td.style.border = "1px solid #ddd";
                        td.style.padding = "8px";
                        td.style.textAlign = "center";
                        tr.appendChild(td);
                    });
                    outputTable.appendChild(tr);
                });
                tableContainer.appendChild(outputTable);

                fullText += net.toMRPNText(this.isSmartModel) + "\n\n";
            });

            content.appendChild(tableContainer);

            const controlPanel = document.createElement("div");
            controlPanel.style.display = "flex";
            controlPanel.style.justifyContent = "space-between";
            controlPanel.style.marginTop = "10px";
            controlPanel.style.gap = "10px";

            const buttonPanel = document.createElement("div");
            buttonPanel.style.display = "flex";
            buttonPanel.style.gap = "10px";

            const insertBtn = document.createElement("button");
            insertBtn.textContent = "Insert as Note";
            insertBtn.className = "modal-btn";
            insertBtn.onclick = () => {
                const textOutput = fullText.trim();
                if (!textOutput) return;
                this.saveStateToUndo();
                const { x, y } = this.findAnnotationPosition(textOutput);
                const annotation = new Annotation(textOutput, x, y, "Times New Roman", parseInt(fontSizeSelect.value));
                this.annotations.push(annotation);
                this.designState.setUnsavedChanges();
                modal.remove();
                this.updateButtonStates();
                this.updateStatus("MR-PN inserted as note", this.isSmartModel ? "S-Model" : "T-Model");
            };

            const regenBtn = document.createElement("button");
            regenBtn.textContent = "Regenerate";
            regenBtn.className = "modal-btn";
            regenBtn.onclick = () => {
                const nets = new NetAnalyzer(this).analyze();
                tableContainer.innerHTML = "";
                let newText = "";
                nets.forEach((net, netIndex) => {
                    const placeList = Array.from(net.places);
                    const transitionList = Array.from(net.transitions);
                    if (placeList.length === 0 || transitionList.length === 0) {
                        tableContainer.innerHTML += `<p>Net ${netIndex + 1}: No design elements available.</p>`;
                        newText += `Net ${netIndex + 1}: No design elements available.\n\n`;
                        return;
                    }

                    const netLabel = document.createElement("label");
                    netLabel.textContent = `Net ${netIndex + 1}:`;
                    netLabel.style.font = "bold 14px Monospaced";
                    tableContainer.appendChild(netLabel);

                    const inputLabel = document.createElement("label");
                    inputLabel.textContent = "Input Matrix:";
                    inputLabel.style.font = "bold 12px Monospaced";
                    tableContainer.appendChild(inputLabel);

                    const inputTable = document.createElement("table");
                    inputTable.style.borderCollapse = "collapse";
                    inputTable.style.width = "100%";
                    inputTable.style.marginBottom = "10px";

                    const inputHeader = document.createElement("tr");
                    inputHeader.appendChild(document.createElement("th"));
                    transitionList.forEach(t => {
                        const th = document.createElement("th");
                        th.textContent = t.name;
                        th.style.border = "1px solid #ddd";
                        th.style.padding = "8px";
                        th.style.backgroundColor = "#f2f2f2";
                        inputHeader.appendChild(th);
                    });
                    inputTable.appendChild(inputHeader);

                    placeList.forEach((p, i) => {
                        const tr = document.createElement("tr");
                        const tdPlace = document.createElement("td");
                        tdPlace.textContent = p.name;
                        tdPlace.style.border = "1px solid #ddd";
                        tdPlace.style.padding = "8px";
                        tr.appendChild(tdPlace);
                        transitionList.forEach(t => {
                            const td = document.createElement("td");
                            const weight = net.inputFunction.get(`${p.name},${t.name}`) || 0;
                            td.textContent = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                            td.style.border = "1px solid #ddd";
                            td.style.padding = "8px";
                            td.style.textAlign = "center";
                            tr.appendChild(td);
                        });
                        inputTable.appendChild(tr);
                    });
                    tableContainer.appendChild(inputTable);

                    const outputLabel = document.createElement("label");
                    outputLabel.textContent = "Output Matrix:";
                    outputLabel.style.font = "bold 12px Monospaced";
                    tableContainer.appendChild(outputLabel);

                    const outputTable = document.createElement("table");
                    outputTable.style.borderCollapse = "collapse";
                    outputTable.style.width = "100%";
                    outputTable.style.marginBottom = "10px";

                    const outputHeader = document.createElement("tr");
                    outputHeader.appendChild(document.createElement("th"));
                    transitionList.forEach(t => {
                        const th = document.createElement("th");
                        th.textContent = t.name;
                        th.style.border = "1px solid #ddd";
                        th.style.padding = "8px";
                        th.style.backgroundColor = "#f2f2f2";
                        outputHeader.appendChild(th);
                    });
                    outputTable.appendChild(outputHeader);

                    placeList.forEach((p, i) => {
                        const tr = document.createElement("tr");
                        const tdPlace = document.createElement("td");
                        tdPlace.textContent = p.name;
                        tdPlace.style.border = "1px solid #ddd";
                        tdPlace.style.padding = "8px";
                        tr.appendChild(tdPlace);
                        transitionList.forEach(t => {
                            const td = document.createElement("td");
                            const weight = net.outputFunction.get(`${p.name},${t.name}`) || 0;
                            td.textContent = this.isSmartModel ? (weight > 0 ? 1 : 0) : weight;
                            td.style.border = "1px solid #ddd";
                            td.style.padding = "8px";
                            td.style.textAlign = "center";
                            tr.appendChild(td);
                        });
                        outputTable.appendChild(tr);
                    });
                    tableContainer.appendChild(outputTable);

                    newText += net.toMRPNText(this.isSmartModel) + "\n\n";
                });
                fullText = newText;
            };

            const fontPanel = document.createElement("div");
            fontPanel.style.display = "flex";
            fontPanel.style.alignItems = "center";
            fontPanel.style.gap = "5px";

            const fontLabel = document.createElement("label");
            fontLabel.textContent = "Font Size:";
            fontPanel.appendChild(fontLabel);

            const fontSizeSelect = document.createElement("select");
            [8, 10, 12, 14, 16, 18, 20, 24].forEach(size => {
                const option = document.createElement("option");
                option.value = size;
                option.textContent = size;
                if (size === 12) option.selected = true;
                fontSizeSelect.appendChild(option);
            });
            fontSizeSelect.onchange = () => {
                tableContainer.querySelectorAll("table, label").forEach(el => {
                    el.style.fontSize = `${fontSizeSelect.value}px`;
                });
            };
            fontPanel.appendChild(fontSizeSelect);

            const pinBtn = document.createElement("button");
            pinBtn.textContent = "Pin";
            pinBtn.className = "modal-btn save-btn";
            pinBtn.style.padding = "8px 16px";
            pinBtn.onclick = () => {
                modal.style.backgroundColor = "transparent";
                modal.style.pointerEvents = "none";
                content.style.pointerEvents = "auto";
                pinBtn.style.display = "none";
            };

            buttonPanel.appendChild(regenBtn);
            buttonPanel.appendChild(insertBtn);
            controlPanel.appendChild(buttonPanel);
            controlPanel.appendChild(fontPanel);
            controlPanel.appendChild(pinBtn);
            content.appendChild(controlPanel);

            modal.appendChild(content);
            document.body.appendChild(modal);

            let offsetX, offsetY;
            header.onmousedown = (e) => {
                if (e.target !== header) return;
                const rect = content.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                document.onmousemove = (e) => {
                    content.style.left = `${e.clientX - offsetX}px`;
                    content.style.top = `${e.clientY - offsetY}px`;
                    content.style.transform = "none";
                };
                document.onmouseup = () => {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };

            this.updateStatus("MR-PN opened", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("MR-PN modal opened");
        } catch (e) {
            console.error("Error in showMRPN:", e);
            this.updateStatus("Error opening MR-PN: " + e.message, this.isSmartModel ? "S-Model" : "T-Model");
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        console.log(`Mouse down at (${x}, ${y}) with mode: ${this.addMode}`);

        if (!this.designExists && this.addMode !== "new") return;

        const elem = this.getElementAt(x, y);
        const arc = this.getArcAt(x, y);
        const annotation = this.getAnnotationAt(x, y);

        if (this.handMode) {
            this.draggingCanvas = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.canvas.style.cursor = "grabbing";
            console.log("Started dragging canvas");
        } else if (this.addMode === "arc" && (elem instanceof Place || elem instanceof Transition || elem instanceof Initializer)) {
            this.arcStart = new Point(x, y);
            this.arcEnd = new Point(x, y);
            this.drawingArc = true;
            console.log("Started drawing arc");
        } else if (this.addMode === "select") {
            if (elem) {
                if (!this.selectedElements.includes(elem)) {
                    if (!e.ctrlKey) this.selectedElements = [];
                    this.selectedElements.push(elem);
                }
                this.selected = elem;
                this.draggingElements = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                console.log("Selected element:", elem.name);
            } else if (annotation) {
                if (!e.ctrlKey) this.selectedElements = [];
                this.selectedElements.push(annotation);
                this.selected = annotation;
                this.draggingElements = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                console.log("Selected annotation");
            } else if (arc) {
                if (!e.ctrlKey) this.selectedElements = [];
                this.selectedElements.push(arc);
                this.selected = arc;
                this.draggingElements = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                console.log("Selected arc");
            } else {
                this.selected = null;
                this.selectionStart = new Point(x, y);
                this.selectionArea = { x, y, width: 0, height: 0 };
                if (!e.ctrlKey) this.selectedElements = [];
                console.log("Started selection area");
            }
        } else if (this.addMode === "place") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            this.places.push(new Place(`P${this.places.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added place at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "transition") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            this.transitions.push(new Transition(`T${this.transitions.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added transition at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "ini") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            this.initializers.push(new Initializer(`INI${this.initializers.length + 1}`, snappedX, snappedY));
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added initializer at (${snappedX}, ${snappedY})`);
        } else if (this.addMode === "annotate") {
            this.saveStateToUndo();
            const snappedX = this.snappingEnabled ? Math.round(x / 25) * 25 : x;
            const snappedY = this.snappingEnabled ? Math.round(y / 25) * 25 : y;
            const newAnnotation = new Annotation("New Annotation", snappedX, snappedY);
            this.annotations.push(newAnnotation);
            this.editingElement = newAnnotation;
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            console.log(`Added annotation at (${snappedX}, ${snappedY})`);
        }
    }

    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (this.draggingCanvas) {
            this.draggingCanvas = false;
            this.canvas.style.cursor = this.handMode ? "grab" : "default";
            this.saveStateToUndo();
            console.log("Finished dragging canvas");
        } else if (this.drawingArc && this.arcStart) {
            const start = this.getElementAt(this.arcStart.x, this.arcStart.y);
            const elem = this.getElementAt(x, y);
            if (start instanceof Place && elem instanceof Transition) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, true);
                this.arcs.push(arc);
                elem.inputArcs.push({ place: start, weight: 1 });
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log("Added input arc");
            } else if (start instanceof Transition && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false);
                this.arcs.push(arc);
                start.outputArcs.push({ place: elem, weight: 1 });
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log("Added output arc");
            } else if (start instanceof Initializer && elem instanceof Place) {
                this.saveStateToUndo();
                const arc = new Arc(start, elem, false);
                this.arcs.push(arc);
                start.outputPlace = elem;
                this.designState.setUnsavedChanges();
                this.updateButtonStates();
                console.log("Added initializer arc");
            }
            this.arcStart = null;
            this.arcEnd = null;
            this.drawingArc = false;
        } else if (this.addMode === "select" && this.selectionStart) {
            this.selectionArea = {
                x: Math.min(this.selectionStart.x, x),
                y: Math.min(this.selectionStart.y, y),
                width: Math.abs(x - this.selectionStart.x),
                height: Math.abs(y - this.selectionStart.y)
            };
            if (this.selectionArea.width > 5 && this.selectionArea.height > 5) {
                this.selectWithinArea();
            }
            this.selectionStart = null;
            this.selectionArea = null;
            this.draggingElements = false;
        } else if (this.draggingElements) {
            this.draggingElements = false;
            this.saveStateToUndo();
            this.designState.setUnsavedChanges();
            console.log("Finished dragging elements");
        }
        this.draggingControlPoint = false;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (this.draggingCanvas && this.handMode) {
            const dx = (e.clientX - this.dragStartX) / this.zoomLevel;
            const dy = (e.clientY - this.dragStartY) / this.zoomLevel;
            this.places.forEach(p => { p.x += dx; p.y += dy; });
            this.transitions.forEach(t => { t.x += dx; t.y += dy; });
            this.initializers.forEach(i => { i.x += dx; i.y += dy; });
            this.annotations.forEach(a => { a.x += dx; a.y += dy; });
            this.arcs.forEach(a => {
                if (a.controlPoints.length > 0) {
                    a.controlPoints.forEach(cp => { cp.x += dx; cp.y += dy; });
                }
            });
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.designState.setUnsavedChanges();
        } else if (this.drawingArc && this.arcStart) {
            this.arcEnd = new Point(x, y);
        } else if (this.addMode === "select" && this.selectionStart && e.buttons === 1) {
            this.selectionArea = {
                x: Math.min(this.selectionStart.x, x),
                y: Math.min(this.selectionStart.y, y),
                width: Math.abs(x - this.selectionStart.x),
                height: Math.abs(y - this.selectionStart.y)
            };
        } else if (this.addMode === "select" && this.draggingElements && e.buttons === 1) {
            const dx = (e.clientX - this.dragStartX) / this.zoomLevel;
            const dy = (e.clientY - this.dragStartY) / this.zoomLevel;
            this.selectedElements.forEach(elem => {
                const snappedX = this.snappingEnabled ? Math.round((elem.x + dx) / 25) * 25 : elem.x + dx;
                const snappedY = this.snappingEnabled ? Math.round((elem.y + dy) / 25) * 25 : elem.y + dy;
                if (elem instanceof Arc && this.draggingControlPoint) {
                    elem.controlPoints[0].x = snappedX;
                    elem.controlPoints[0].y = snappedY;
                } else {
                    elem.x = snappedX;
                    elem.y = snappedY;
                }
            });
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
        }
    }

    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;
        const elem = this.getElementAt(x, y);
        const arc = this.getArcAt(x, y);
        const annotation = this.getAnnotationAt(x, y);

        if (this.addMode === "select" && (elem || arc || annotation)) {
            this.editingElement = elem || arc || annotation;
            if (elem instanceof Place || elem instanceof Transition || elem instanceof Initializer || (arc && !this.isSmartModel)) {
                this.showEditModal(this.editingElement);
            } else if (annotation) {
                this.renderLoop();
            }
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoomLevel;
        const y = (e.clientY - rect.top) / this.zoomLevel;

        if (this.editingElement && this.editingElement instanceof Annotation) {
            const elem = this.getElementAt(x, y);
            const arc = this.getArcAt(x, y);
            const annotation = this.getAnnotationAt(x, y);
            if (!(elem === this.editingElement || arc === this.editingElement || annotation === this.editingElement)) {
                this.finishEditing(true);
                this.setMode("select");
            }
        }
    }

    finishEditing(save) {
        // Handled in drawEditing
    }

    newDesign() {
        if (this.designState.hasUnsavedChanges() && this.designState.hasDesign()) {
            if (!confirm("You have unsaved changes. Create a new design anyway?")) return;
        }
        this.designState.currentFileName = "Untitled.json";
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.handMode = false;
        this.drawingArc = false;
        this.designExists = true;
        this.designState.newDesign(this.designState.currentFileName);
        this.updateTitle();
        this.updateButtonStates();
        this.updateStatus("New design created", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("New design created with file:", this.designState.currentFileName);
    }

    setMode(mode) {
        this.addMode = mode;
        this.handMode = mode === "hand";
        this.drawingArc = mode === "arc";
        document.querySelectorAll(".tool-btn").forEach(btn => btn.classList.remove("highlighted"));
        const btn = document.getElementById(`${mode}Btn`);
        if (btn) btn.classList.add("highlighted");
        this.canvas.style.cursor = this.handMode ? "grab" : "default";
        console.log(`Mode set to: ${mode}`);
    }

    deleteSelected() {
        if (this.addMode === "select" && this.selectedElements.length > 0) {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Arc) {
                    this.arcs = this.arcs.filter(a => a !== elem);
                    if (elem.isInput) {
                        elem.end.inputArcs = elem.end.inputArcs.filter(a => a.place !== elem.start);
                    } else {
                        elem.start.outputArcs = elem.start.outputArcs.filter(a => a.place !== elem.end);
                    }
                } else if (elem instanceof Place) {
                    this.places = this.places.filter(p => p !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem && a.end !== elem);
                } else if (elem instanceof Transition) {
                    this.transitions = this.transitions.filter(t => t !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem && a.end !== elem);
                } else if (elem instanceof Initializer) {
                    this.initializers = this.initializers.filter(i => i !== elem);
                    this.arcs = this.arcs.filter(a => a.start !== elem);
                } else if (elem instanceof Annotation) {
                    this.annotations = this.annotations.filter(a => a !== elem);
                }
            });
            this.selectedElements = [];
            this.selected = null;
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            this.updateStatus("Elements deleted", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Selected elements deleted");
        }
    }

    addToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.addToken();
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            this.updateStatus("Tokens added", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Added tokens to selected places");
        }
    }

    removeToken() {
        if (this.addMode === "select") {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Place) elem.removeToken();
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            this.updateStatus("Tokens removed", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Removed tokens from selected places");
        }
    }

    togglePlayPause() {
        this.autoRun = !this.autoRun;
        if (!this.autoRun) this.animations = [];
        document.getElementById("playPauseBtn").innerHTML = this.autoRun ?
            `<img src="assets/pause.png" alt="Pause">` :
            `<img src="assets/play.png" alt="Play">`;
        this.updateStatus(this.autoRun ? "Simulation running" : "Simulation paused", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Play/Pause toggled to:", this.autoRun);
    }

    resetTokens() {
        this.saveStateToUndo();
        this.places.forEach(p => p.tokens = 0);
        this.transitions.forEach(t => t.active = false);
        this.initializers.forEach(i => {
            i.tokensGenerated = 0;
            i.lastGenerationTime = Date.now();
            i.isGenerating = false;
        });
        this.animations = [];
        this.autoRun = false;
        this.designState.setUnsavedChanges();
        this.updateButtonStates();
        this.updateStatus("Tokens reset", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Tokens reset");
    }

    toggleSnap() {
        this.snappingEnabled = !this.snappingEnabled;
        document.getElementById("snapBtn").classList.toggle("active", this.snappingEnabled);
        this.updateStatus(`Snapping ${this.snappingEnabled ? "enabled" : "disabled"}`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Snapping toggled to:", this.snappingEnabled);
    }

    cycleSpeed() {
        this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speedOptions.length;
        this.animationSpeed = this.speedOptions[this.currentSpeedIndex];
        document.getElementById("speedLabel").textContent = `Speed: ${this.getSpeedLabel()}`;
        this.updateStatus(`Speed set to ${this.getSpeedLabel()}`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Speed cycled to:", this.animationSpeed);
    }

    getSpeedLabel() {
        return `${this.animationSpeed}x`;
    }

    saveDesign() {
        const design = Saver.save(this);
        const blob = new Blob([JSON.stringify(design, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this.designState.currentFileName || "petriNetDesign.json";
        a.click();
        URL.revokeObjectURL(url);
        this.designState.saveDesign();
        this.updateTitle();
        this.updateStatus("Design saved", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Design saved");
    }

    loadDesign() {
        if (this.designState.hasUnsavedChanges() && this.designState.hasDesign()) {
            if (!confirm("You have unsaved changes. Load a new design anyway?")) return;
        }
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
                this.updateStatus("No file selected", this.isSmartModel ? "S-Model" : "T-Model");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonData = JSON.parse(event.target.result);
                    this.saveStateToUndo();
                    Loader.load(this, jsonData);
                    this.designExists = true;
                    this.designState.currentFileName = file.name;
                    this.updateTitle();
                    this.updateButtonStates();
                    this.updateStatus(`Design loaded: ${file.name}`, this.isSmartModel ? "S-Model" : "T-Model");
                    console.log(`Loaded design from ${file.name}`);
                } catch (ex) {
                    console.error("Failed to load design:", ex);
                    this.updateStatus(`Error loading design: ${ex.message}`, this.isSmartModel ? "S-Model" : "T-Model");
                }
            };
            reader.onerror = (error) => {
                console.error("File reading error:", error);
                this.updateStatus("Error reading file", this.isSmartModel ? "S-Model" : "T-Model");
            };
            reader.readAsText(file);
        };
        input.click();
    }

    clearCanvas() {
        if (!this.designExists) {
            this.updateStatus("No design to clear", this.isSmartModel ? "S-Model" : "T-Model");
            return;
        }
        if (this.designState.hasUnsavedChanges() && !confirm("You have unsaved changes. Clear anyway?")) return;
        this.saveStateToUndo();
        this.places = [];
        this.transitions = [];
        this.arcs = [];
        this.initializers = [];
        this.annotations = [];
        this.animations = [];
        this.selectedElements = [];
        this.selected = null;
        this.addMode = "select";
        this.handMode = false;
        this.drawingArc = false;
        this.designState.setUnsavedChanges();
        this.updateTitle();
        this.updateButtonStates();
        this.updateStatus("Canvas cleared", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Canvas cleared");
    }

    toggleModel() {
        this.isSmartModel = !this.isSmartModel;
        document.getElementById("switchBtn").classList.toggle("active", this.isSmartModel);
        document.getElementById("switchBtn").innerHTML = `<img src="assets/switch.png" alt="Switch">`;
        this.updateStatus(`Model switched to ${this.isSmartModel ? "S-Model" : "T-Model"}`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Model toggled to:", this.isSmartModel ? "S-Model" : "T-Model");
    }

    showGuide() {
        const existingModal = document.getElementById("guideModal");
        if (existingModal) existingModal.remove();

        const modal = document.createElement("div");
        modal.className = "modal";
        modal.id = "guideModal";
        modal.style.display = "block";
        modal.style.position = "fixed";
        modal.style.left = "0";
        modal.style.top = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        modal.style.zIndex = "2000";

        const content = document.createElement("div");
        content.className = "modal-content";
        content.style.position = "absolute";
        content.style.left = "50%";
        content.style.top = "50%";
        content.style.transform = "translate(-50%, -50%)";
        content.style.backgroundColor = "#fff";
        content.style.padding = "20px";
        content.style.borderRadius = "8px";
        content.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        content.style.width = "800px";
        content.style.maxWidth = "90vw";
        content.style.maxHeight = "80vh";
        content.style.overflowY = "auto";

        const close = document.createElement("span");
        close.className = "close";
        close.innerHTML = "×";
        close.style.fontSize = "28px";
        close.style.cursor = "pointer";
        close.style.float = "right";
        close.onclick = () => modal.remove();

        const guideText = document.createElement("p");
        guideText.id = "guideText";
        guideText.innerHTML = `
            <b>Smart Model (S-Model) Transition Tasks Guide:</b><br>
            - '+': Adds values of incoming tokens.<br>
            - '-': Subtracts second token value from first based on order.<br>
            - '*': Multiplies values of incoming tokens.<br>
            - '/': Divides first token value by second based on order.<br>
            - '!= <number>': Checks if token value is not equal to <number>.<br>
            - '== <number>': Checks if token value equals <number>.<br>
            - 'cp': Copies the token value to all output places.<br>
            - 'p <seconds>': Pauses token for <seconds> before forwarding.<br>
            - No task: Acts as a gate, forwards token as-is.<br><br>
            <b>Traditional Model (T-Model) Notes:</b><br>
            - Input arc weights: Number of tokens required to enable transition.<br>
            - Output arc weights: Number of tokens produced per firing to output places.<br><br>
            <b>Basic Tools Tutorial:</b><br>
            - <img src="assets/new.png" alt="New" style="width:16px;height:16px;vertical-align:middle"> <b>New Design</b>: Click to start a fresh Petri net.<br>
            - <img src="assets/place.png" alt="Place" style="width:16px;height:16px;vertical-align:middle"> <b>Add Place</b>: Select, then click on the canvas to add a place.<br>
            - <img src="assets/transition.png" alt="Transition" style="width:16px;height:16px;vertical-align:middle"> <b>Add Transition</b>: Select, then click to add a transition.<br>
            - <img src="assets/arc.png" alt="Arc" style="width:16px;height:16px;vertical-align:middle"> <b>Draw Arc</b>: Select, click a place/transition, then another to connect.<br>
            - <img src="assets/plus.png" alt="Plus" style="width:16px;height:16px;vertical-align:middle"> <b>Add Tokens</b>: Select a place, click to add tokens.<br>
            - <img src="assets/minus.png" alt="Minus" style="width:16px;height:16px;vertical-align:middle"> <b>Remove Tokens</b>: Select a place, click to remove tokens.<br>
            - <img src="assets/play.png" alt="Play" style="width:16px;height:16px;vertical-align:middle"> <b>Play/Pause</b>: Click to run; click again to pause (keeps tokens), or twice to stop.<br>
            - <img src="assets/speed.png" alt="Speed" style="width:16px;height:16px;vertical-align:middle"> <b>Speed Control</b>: Click to cycle 0.25x, 0.5x, 1.0x, 1.5x, 2.0x (higher = faster).<br>
            - <img src="assets/select.png" alt="Select" style="width:16px;height:16px;vertical-align:middle"> <b>Select & Edit</b>: Click or drag-select elements; double-click to edit.<br>
            - <img src="assets/delete.png" alt="Delete" style="width:16px;height:16px;vertical-align:middle"> <b>Delete</b>: Select elements, click to remove.<br>
            - <img src="assets/reset.png" alt="Reset" style="width:16px;height:16px;vertical-align:middle"> <b>Reset</b>: Click to clear tokens and stop simulation.<br>
            - <img src="assets/clear.png" alt="Clear" style="width:16px;height:16px;vertical-align:middle"> <b>Clear Canvas</b>: Click to remove all elements (confirms if unsaved changes exist).<br>
            - <img src="assets/hand.png" alt="Hand" style="width:16px;height:16px;vertical-align:middle"> <b>Hand Tool</b>: Select, then drag the canvas to pan the view.<br>
            - <img src="assets/note.png" alt="Note" style="width:16px;height:16px;vertical-align:middle"> <b>Add Annotation</b>: Select, click to add text notes; double-click to edit.<br>
            - <img src="assets/save.png" alt="Save" style="width:16px;height:16px;vertical-align:middle"> <b>Save</b>: Download your design as JSON.<br>
            - <img src="assets/load.png" alt="Load" style="width:16px;height:16px;vertical-align:middle"> <b>Load</b>: Import a JSON design.<br>
            - <img src="assets/zin.png" alt="Zoom In" style="width:16px;height:16px;vertical-align:middle"> <img src="assets/zout.png" alt="Zoom Out" style="width:16px;height:16px;vertical-align:middle"> <b>Zoom</b>: Use buttons (or mouse wheel) to adjust view.<br><br>
            <b>Analysis Tools:</b><br>
            <b>Petri Net Formal Notation (PN-FN):</b><br>
            - <img src="assets/pnfn.png" alt="PN-FN" style="width:16px;height:16px;vertical-align:middle"> Access via the 'PN-FN' button in the toolbar.<br>
            - Displays the formal notation of the Petri Net(s) on the canvas as PN = {P, T, I, O, M₀}.<br>
            - P: Set of all places (e.g., P = {P1, P2, P3}).<br>
            - T: Set of all transitions (e.g., T = {T1, T2}).<br>
            - I: Input function listing arc weights from places to transitions (e.g., I(P1, T1) = 2).<br>
            - O: Output function listing arc weights from transitions to places (e.g., O(P2, T1) = 1).<br>
            - M₀: Initial marking showing token counts for each place in a vertical matrix (e.g., M₀ =<br>&nbsp;&nbsp;&nbsp;&nbsp;|  2 |<br>&nbsp;&nbsp;&nbsp;&nbsp;|  1 |<br>&nbsp;&nbsp;&nbsp;&nbsp;|  0 |).<br>
            - Multiple nets are detected if elements are unconnected and shown as 'Net 1', 'Net 2', etc.<br>
            - 'Regenerate M₀': Updates M₀ to reflect current token counts.<br>
            - 'Reload All': Refreshes the entire notation after design changes.<br>
            - 'Insert as Note': Adds the notation as a multi-line annotation on the canvas (right or bottom).<br><br>
            <b>Matrix Representation of Petri Nets (MR-PN):</b><br>
            - <img src="assets/mrpn.png" alt="MR-PN" style="width:16px;height:16px;vertical-align:middle"> Access via the 'MR-PN' button in the toolbar.<br>
            - Displays input and output matrices for each net on the canvas.<br>
            - Input Matrix (I): Shows arc weights from places (rows) to transitions (columns), e.g.:<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;t1&nbsp;&nbsp;&nbsp;t2&nbsp;&nbsp;&nbsp;t3<br>
            &nbsp;&nbsp;p1 |&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;|<br>
            &nbsp;&nbsp;p2 |&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;|<br>
            - Output Matrix (O): Shows arc weights from transitions (columns) to places (rows), e.g.:<br>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;t1&nbsp;&nbsp;&nbsp;t2&nbsp;&nbsp;&nbsp;t3<br>
            &nbsp;&nbsp;p1 |&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;|<br>
            &nbsp;&nbsp;p2 |&nbsp;&nbsp;0&nbsp;&nbsp;&nbsp;&nbsp;1&nbsp;&nbsp;&nbsp;&nbsp;0&nbsp;&nbsp;|<br>
            - In S-Model, weights are always 1; in T-Model, weights reflect user-set values.<br>
            - Multiple nets are shown as separate matrices if detected.<br>
            - 'Regenerate': Updates matrices after design changes.<br>
            - 'Insert as Note': Adds the matrices as a multi-line annotation on the canvas (right or bottom).<br>
        `;

        content.appendChild(close);
        content.appendChild(guideText);
        modal.appendChild(content);
        document.body.appendChild(modal);

        let offsetX, offsetY;
        content.onmousedown = (e) => {
            if (e.target !== content && e.target !== close) return;
            const rect = content.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.onmousemove = (e) => {
                content.style.left = `${e.clientX - offsetX}px`;
                content.style.top = `${e.clientY - offsetY}px`;
                content.style.transform = "none";
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };

        this.updateStatus("Guide opened", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Guide modal opened");
    }

    insertPNFNAsNote() {
        const pnfnText = document.getElementById("pnfnText").value;
        if (!pnfnText) return;
        this.saveStateToUndo();
        const { x, y } = this.findAnnotationPosition(pnfnText);
        const fontSize = parseInt(document.querySelector("#pnfnModal select")?.value || 12);
        this.annotations.push(new Annotation(pnfnText, x, y, "Times New Roman", fontSize));
        const modal = document.getElementById("pnfnModal");
        if (modal) document.body.removeChild(modal);
        this.designState.setUnsavedChanges();
        this.updateButtonStates();
        this.updateStatus("PN-FN inserted as note", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Inserted PN-FN as note");
    }

    insertMRPNAsNote() {
        // Handled in showMRPN
    }

    regeneratePNFN(all) {
        const analyzer = new NetAnalyzer(this);
        const nets = analyzer.analyze();
        let text = "";
        nets.forEach((net, i) => {
            if (all) net.updateInitialMarking();
            text += `Net ${i + 1}:\n${net.toFormalNotation(this.isSmartModel)}\n\n`;
        });
        document.getElementById("pnfnText").value = text;
        this.updateStatus(`PNFN regenerated (${all ? "All" : "M0 only"})`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Regenerated PNFN:", all ? "All" : "M0 only");
    }

    regenerateMRPN(all) {
        const modal = document.getElementById("mrpnModal");
        if (modal) document.body.removeChild(modal);
        this.showMRPN();
        this.updateStatus(`MRPN regenerated (${all ? "All" : "M0 only"})`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Regenerated MRPN:", all ? "All" : "M0 only");
    }

    findAnnotationPosition(text) {
        let maxX = 0, maxY = 0;
        this.places.forEach(p => { maxX = Math.max(maxX, p.x + 40); maxY = Math.max(maxY, p.y + 40); });
        this.transitions.forEach(t => { maxX = Math.max(maxX, t.x + 40); maxY = Math.max(maxY, t.y + 40); });
        this.initializers.forEach(i => { maxX = Math.max(maxX, i.x + 40); maxY = Math.max(maxY, i.y + 40); });
        this.annotations.forEach(a => {
            const width = this.ctx.measureText(a.text.split("\n")[0]).width;
            maxX = Math.max(maxX, a.x + width);
            maxY = Math.max(maxY, a.y + a.fontSize * a.text.split("\n").length);
        });

        let x = maxX + 20;
        let y = maxY / 2;
        const width = 200;
        const height = text.split("\n").length * 15;

        if (x + width > this.canvas.width / window.devicePixelRatio / this.zoomLevel || this.overlaps(x, y, width, height)) {
            x = maxX / 2;
            y = maxY + 20;
            if (y + height > this.canvas.height / window.devicePixelRatio / this.zoomLevel || this.overlaps(x, y, width, height)) {
                this.updateStatus("No space available to insert annotation", this.isSmartModel ? "S-Model" : "T-Model");
                return { x: 0, y: 0 };
            }
        }
        return { x, y };
    }

    overlaps(x, y, width, height) {
        const rect = { x, y, width, height };
        return this.places.some(p => this.rectIntersects(rect, p.x - 20, p.y - 20, 40, 40)) ||
               this.transitions.some(t => this.rectIntersects(rect, t.x - 20, t.y - 20, 40, 40)) ||
               this.initializers.some(i => this.rectIntersects(rect, i.x - 20, i.y - 20, 40, 40)) ||
               this.annotations.some(a => {
                   const width = this.ctx.measureText(a.text.split("\n")[0]).width;
                   return this.rectIntersects(rect, a.x, a.y - a.fontSize, width, a.fontSize * a.text.split("\n").length);
               });
    }

    rectIntersects(r1, x, y, w, h) {
        return !(r1.x + r1.width < x || x + w < r1.x || r1.y + r1.height < y || y + h < r1.y);
    }

    zoomIn() {
        this.zoomLevel += 0.1;
        if (this.zoomLevel > 2.0) this.zoomLevel = 2.0;
        this.updateStatus(`Zoomed in to ${this.zoomLevel.toFixed(1)}x`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Zoomed in to:", this.zoomLevel);
    }

    zoomOut() {
        this.zoomLevel -= 0.1;
        if (this.zoomLevel < 0.5) this.zoomLevel = 0.5;
        this.updateStatus(`Zoomed out to ${this.zoomLevel.toFixed(1)}x`, this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Zoomed out to:", this.zoomLevel);
    }

    simulateStep() {
        if (!this.autoRun || this.paused) return; // Skip if paused

        const enabled = this.transitions.filter(t => {
            const isEnabled = this.isSmartModel ? t.isEnabledSmart() : t.isEnabled();
            return isEnabled && !t.active && !this.firingTimeouts.has(t);
        });
        if (enabled.length === 0) {
            console.log("No enabled and idle transitions found");
            return;
        }

        const transition = enabled[Math.floor(Math.random() * enabled.length)];
        transition.active = true;
        const queue = [];

        console.log(`Starting simulation for ${transition.name}, enabled: ${this.isSmartModel ? transition.isEnabledSmart() : transition.isEnabled()}`);

        transition.inputArcs.forEach(arc => {
            const place = arc.place;
            const weight = this.isSmartModel ? 1 : arc.weight;
            const tokensToMove = Math.min(weight, place.tokens);
            console.log(`Processing arc from ${place.name} (tokens: ${place.tokens}) to ${transition.name}, weight: ${weight}, moving: ${tokensToMove}`);
            for (let i = 0; i < tokensToMove; i++) {
                const token = this.isSmartModel ? new SmartToken(place.getTokenValue()) : null;
                queue.push({ place, token });
                place.removeToken();
                const anim = this.isSmartModel ?
                    new TokenAnimation(place.x, place.y, transition.x, transition.y, null, place, token) :
                    new TokenAnimation(place.x, place.y, transition.x, transition.y, null, place);
                anim.toTransition = true;
                anim.transition = transition;
                this.animations.push(anim);
                console.log(`Queued token from ${place.name} to ${transition.name}, queue length: ${queue.length}`);
            }
        });

        if (queue.length === 0) {
            console.log(`No tokens to move to ${transition.name}, resetting active`);
            transition.active = false;
        } else {
            this.tokenQueue.set(transition, queue);
            this.updateStatus(`Acknowledging transition: ${transition.name}`, this.isSmartModel ? "S-Model" : "T-Model");
            console.log(`Acknowledging transition: ${transition.name}, queued tokens: ${queue.length}`);

            // Wait for input animations to finish before firing
            const checkAnimations = setInterval(() => {
                const inputAnimsPending = this.animations.some(a => a.transition === transition && a.toTransition && !a.isFinished());
                if (!inputAnimsPending && !this.paused) {
                    clearInterval(checkAnimations);
                    const timeoutId = setTimeout(() => {
                        this.fireTransition(transition);
                        this.firingTimeouts.delete(transition);
                    }, 500); // Existing 500ms delay after animation
                    this.firingTimeouts.set(transition, timeoutId);
                }
            }, 100); // Check every 100ms
        }
    }

    fireTransition(transition) {
        if (!transition.active || !this.tokenQueue.has(transition)) {
            console.log(`Transition ${transition.name} not active or no tokens queued, skipping fire`);
            transition.active = false;
            return;
        }

        const queue = this.tokenQueue.get(transition);
        const requiredTokens = this.isSmartModel ? transition.inputArcs.length : transition.inputArcs.reduce((sum, a) => sum + a.weight, 0);
        const stillEnabled = queue.length >= requiredTokens;
        console.log(`Firing ${transition.name}, enabled: ${stillEnabled}, queued tokens: ${queue.length}, required: ${requiredTokens}`);

        if (stillEnabled) {
            if (this.isSmartModel) {
                const smartTokens = queue.map(q => q.token);
                transition.fireSmart(this.animations, smartTokens);
            } else {
                transition.fire(this.animations);
            }
            this.updateStatus(`Fired transition: ${transition.name}`, this.isSmartModel ? "S-Model" : "T-Model");
            console.log(`Fired transition: ${transition.name}, processed tokens: ${queue.length}`);
        } else {
            console.log(`Transition ${transition.name} not enabled with queued tokens, aborting fire`);
        }

        transition.active = false;
        this.tokenQueue.delete(transition);
    }

    updateAnimations() {
        if (this.paused) return; // Freeze animations when paused

        console.log(`Updating animations, count: ${this.animations.length}`);
        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            const oldProgress = anim.progress;
            anim.update();
            console.log(`Animation ${i} from ${anim.sourcePlace?.name || "unknown"} to ${anim.targetPlace?.name || anim.transition?.name || "unknown"}, progress: ${oldProgress} -> ${anim.progress}, finished: ${anim.isFinished()}`);

            const arc = this.arcs.find(a => 
                (a.start === anim.sourcePlace && a.end === anim.transition) ||
                (a.start === anim.transition && a.end === anim.targetPlace)
            );
            if (arc && !anim.isFinished()) arc.highlighted = true;
            else if (arc) arc.highlighted = false;

            if (anim.isFinished()) {
                if (!anim.toTransition && anim.targetPlace) {
                    anim.targetPlace.addToken();
                    if (this.isSmartModel && anim.smartToken) anim.targetPlace.setTokenValue(anim.smartToken.value);
                    console.log(`Token added to ${anim.targetPlace.name}, tokens: ${anim.targetPlace.tokens}`);
                }
                this.animations.splice(i, 1);
            }
        }
    }

    togglePlayPause() {
        if (!this.autoRun) {
            this.autoRun = true;
            this.paused = false;
            this.lastStep = Date.now(); // Reset timing for smooth resume
        } else if (!this.paused) {
            this.paused = true; // Pause without stopping
        } else {
            this.paused = false; // Resume
            this.lastStep = Date.now();
        }

        if (!this.autoRun && !this.paused) {
            this.animations = [];
            this.tokenQueue.clear();
            this.firingTimeouts.forEach((timeoutId, transition) => {
                clearTimeout(timeoutId);
                transition.active = false;
            });
            this.firingTimeouts.clear();
        }

        document.getElementById("playPauseBtn").innerHTML = this.autoRun && !this.paused ?
            `<img src="assets/pause.png" alt="Pause">` :
            `<img src="assets/play.png" alt="Play">`;
        this.updateStatus(this.autoRun && !this.paused ? "Simulation running" : "Simulation paused", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("Play/Pause toggled to:", this.autoRun, "Paused:", this.paused);
    }

    generateTokensFromInitializers() {
        if (!this.autoRun) return;
        const now = Date.now();
        this.initializers.forEach(ini => {
            if (ini.outputPlace && ini.tokensPerSecond > 0) {
                const timeSinceLast = now - ini.lastGenerationTime;
                const interval = 1000 / ini.tokensPerSecond;
                if (timeSinceLast >= interval) {
                    if (ini.isContinuous || ini.tokensGenerated < ini.tokensToGenerate) {
                        const anim = this.isSmartModel ?
                            new TokenAnimation(ini.x, ini.y, ini.outputPlace.x, ini.outputPlace.y, ini.outputPlace, null, new SmartToken(ini.tokenValue)) :
                            new TokenAnimation(ini.x, ini.y, ini.outputPlace.x, ini.outputPlace.y, ini.outputPlace);
                        this.animations.push(anim);
                        ini.tokensGenerated++;
                        ini.lastGenerationTime = now;
                        ini.isGenerating = true;
                        this.updateStatus(`Token generated from ${ini.name}`, this.isSmartModel ? "S-Model" : "T-Model");
                        console.log(`Generated token from initializer ${ini.name}`);
                    } else {
                        ini.isGenerating = false;
                    }
                }
            }
        });
    }

    getElementAt(x, y) {
        for (const p of this.places) {
            if ((x - p.x) ** 2 + (y - p.y) ** 2 <= (this.iconSize / 2) ** 2) return p;
        }
        for (const t of this.transitions) {
            if (Math.abs(x - t.x) < this.iconSize / 2 && Math.abs(y - t.y) < this.iconSize / 2) return t;
        }
        for (const i of this.initializers) {
            if ((x - i.x) ** 2 + (y - i.y) ** 2 <= (this.iconSize / 2) ** 2) return i;
        }
        return null;
    }

    getArcAt(x, y) {
        for (const arc of this.arcs) {
            const startX = arc.start.x;
            const startY = arc.start.y;
            const endX = arc.end.x;
            const endY = arc.end.y;
            const dx = endX - startX;
            const dy = endY - startY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const unitX = dx / length;
            const unitY = dy / length;
            const perpX = -unitY;
            const perpY = unitX;
            const t = ((x - startX) * unitX + (y - startY) * unitY);
            const dist = Math.abs((x - startX) * perpX + (y - startY) * perpY);
            if (dist < 10 && t >= 0 && t <= length) return arc;
        }
        return null;
    }

    getAnnotationAt(x, y) {
        for (const a of this.annotations) {
            const width = this.ctx.measureText(a.text.split("\n")[0]).width;
            const height = a.fontSize * a.text.split("\n").length;
            if (x >= a.x && x <= a.x + width && y >= a.y - height && y <= a.y) return a;
        }
        return null;
    }

    isNearControlPoint(x, y, arc) {
        if (arc.controlPoints.length > 0) {
            const cp = arc.controlPoints[0];
            return Math.sqrt((x - cp.x) ** 2 + (y - cp.y) ** 2) < 10;
        }
        return false;
    }

    selectWithinArea() {
        this.places.forEach(p => {
            if (this.selectionArea.x <= p.x && p.x <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= p.y && p.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(p);
            }
        });
        this.transitions.forEach(t => {
            if (this.selectionArea.x <= t.x && t.x <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= t.y && t.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(t);
            }
        });
        this.initializers.forEach(i => {
            if (this.selectionArea.x <= i.x && i.x <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= i.y && i.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(i);
            }
        });
        this.arcs.forEach(a => {
            const startX = a.start.x;
            const startY = a.start.y;
            const endX = a.end.x;
            const endY = a.end.y;
            const line = { x1: startX, y1: startY, x2: endX, y2: endY };
            if (this.intersectsRectLine(this.selectionArea, line)) {
                this.selectedElements.push(a);
            }
        });
        this.annotations.forEach(a => {
            const width = this.ctx.measureText(a.text.split("\n")[0]).width;
            const height = a.fontSize * a.text.split("\n").length;
            if (this.selectionArea.x <= a.x && a.x + width <= this.selectionArea.x + this.selectionArea.width &&
                this.selectionArea.y <= a.y - height && a.y <= this.selectionArea.y + this.selectionArea.height) {
                this.selectedElements.push(a);
            }
        });
        if (this.selectedElements.length === 1) this.selected = this.selectedElements[0];
        else this.selected = null;
        console.log("Selected elements:", this.selectedElements.length);
    }

    intersectsRectLine(rect, line) {
        const { x, y, width, height } = rect;
        const { x1, y1, x2, y2 } = line;
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        if (left > x + width || right < x || top > y + height || bottom < y) return false;

        const m = x1 === x2 ? Infinity : (y2 - y1) / (x2 - x1);
        const b = y1 - m * x1;
        const edges = [
            { x: x, y: y }, { x: x + width, y: y },
            { x: x + width, y: y + height }, { x: x, y: y + height }
        ];
        for (let i = 0; i < 4; i++) {
            const xEdge = edges[i].x;
            const yEdge = m === Infinity ? y1 : m * xEdge + b;
            if (yEdge >= Math.min(y, y + height) && yEdge <= Math.max(y, y + height) &&
                xEdge >= Math.min(x1, x2) && xEdge <= Math.max(x1, x2)) return true;
        }
        return false;
    }

    saveStateToUndo() {
        if (this.undoHistory.length >= this.maxHistorySize) this.undoHistory.shift();
        this.undoHistory.push({
            places: this.places.map(p => ({ ...p, smartToken: p.smartToken ? { value: p.smartToken.value } : null })),
            transitions: this.transitions.map(t => ({
                ...t,
                inputArcs: [...t.inputArcs],
                outputArcs: [...t.outputArcs],
                task: t.task ? { task: t.task.task } : null,
                tokenOrder: t.tokenOrder,
                passOnTrue: t.passOnTrue,
                passOnFalse: t.passOnFalse,
                passPreviousValue: t.passPreviousValue
            })),
            arcs: this.arcs.map(a => ({ ...a, type: a.type, controlPoints: a.controlPoints.map(cp => ({ ...cp })), weight: a.weight })),
            initializers: this.initializers.map(i => ({ ...i })),
            annotations: this.annotations.map(a => ({ ...a })),
            selectedElements: [...this.selectedElements],
            isSmartModel: this.isSmartModel,
            autoRun: this.autoRun,
            addMode: this.addMode,
            handMode: this.handMode,
            drawingArc: this.drawingArc,
            arcStart: this.arcStart ? { ...this.arcStart } : null,
            arcEnd: this.arcEnd ? { ...this.arcEnd } : null,
            selectionArea: this.selectionArea ? { ...this.selectionArea } : null,
            selectionStart: this.selectionStart ? { ...this.selectionStart } : null,
            currentFileName: this.designState.currentFileName,
            designExists: this.designExists
        });
        this.redoHistory = [];
        console.log("State saved to undo history");
    }

    undo() {
        if (this.undoHistory.length > 0) {
            this.redoHistory.push(this.getCurrentState());
            this.restoreState(this.undoHistory.pop());
            this.updateTitle();
            this.updateButtonStates();
            this.updateStatus("Undo performed", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Undo performed");
        }
    }

    redo() {
        if (this.redoHistory.length > 0) {
            this.undoHistory.push(this.getCurrentState());
            this.restoreState(this.redoHistory.pop());
            this.updateTitle();
            this.updateButtonStates();
            this.updateStatus("Redo performed", this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Redo performed");
        }
    }

    getCurrentState() {
        return {
            places: this.places.map(p => ({ ...p, smartToken: p.smartToken ? { value: p.smartToken.value } : null })),
            transitions: this.transitions.map(t => ({
                ...t,
                inputArcs: [...t.inputArcs],
                outputArcs: [...t.outputArcs],
                task: t.task ? { task: t.task.task } : null,
                tokenOrder: t.tokenOrder,
                passOnTrue: t.passOnTrue,
                passOnFalse: t.passOnFalse,
                passPreviousValue: t.passPreviousValue
            })),
            arcs: this.arcs.map(a => ({ ...a, type: a.type, controlPoints: a.controlPoints.map(cp => ({ ...cp })), weight: a.weight })),
            initializers: this.initializers.map(i => ({ ...i })),
            annotations: this.annotations.map(a => ({ ...a })),
            selectedElements: [...this.selectedElements],
            isSmartModel: this.isSmartModel,
            autoRun: this.autoRun,
            addMode: this.addMode,
            handMode: this.handMode,
            drawingArc: this.drawingArc,
            arcStart: this.arcStart ? { ...this.arcStart } : null,
            arcEnd: this.arcEnd ? { ...this.arcEnd } : null,
            selectionArea: this.selectionArea ? { ...this.selectionArea } : null,
            selectionStart: this.selectionStart ? { ...this.selectionStart } : null,
            currentFileName: this.designState.currentFileName,
            designExists: this.designExists
        };
    }

    restoreState(state) {
        this.places = state.places.map(p => {
            const place = new Place(p.name, p.x, p.y, p.tokens);
            if (p.smartToken) place.smartToken = new SmartToken(p.smartToken.value);
            return place;
        });
        this.transitions = state.transitions.map(t => {
            const trans = new Transition(t.name, t.x, t.y);
            if (t.task) trans.task = new TransitionTask(t.task.task);
            trans.tokenOrder = t.tokenOrder || "";
            trans.passOnTrue = t.passOnTrue !== undefined ? t.passOnTrue : true;
            trans.passOnFalse = t.passOnFalse !== undefined ? t.passOnFalse : false;
            trans.passPreviousValue = t.passPreviousValue || false;
            return trans;
        });
        this.initializers = state.initializers.map(i => 
            new Initializer(i.name, i.x, i.y, i.tokensToGenerate, i.tokensPerSecond, i.isContinuous, i.tokenValue || 0));
        this.arcs = state.arcs.map(a => {
            const start = a.start instanceof Place ? this.places[this.places.findIndex(p => p.name === a.start.name)] :
                          a.start instanceof Transition ? this.transitions[this.transitions.findIndex(t => t.name === a.start.name)] :
                          this.initializers[this.initializers.findIndex(i => i.name === a.start.name)];
            const end = a.end instanceof Place ? this.places[this.places.findIndex(p => p.name === a.end.name)] :
                        this.transitions[this.transitions.findIndex(t => t.name === a.end.name)];
            const arc = new Arc(start, end, a.isInput);
            arc.controlPoints = a.controlPoints.map(cp => ({ x: cp.x, y: cp.y }));
            arc.weight = a.weight || 1;
            return arc;
        });
        this.transitions.forEach((t, i) => {
            t.inputArcs = state.transitions[i].inputArcs.map(a => ({ 
                place: this.places[this.places.findIndex(p => p.name === a.place.name)], 
                weight: a.weight 
            }));
            t.outputArcs = state.transitions[i].outputArcs.map(a => ({ 
                place: this.places[this.places.findIndex(p => p.name === a.place.name)], 
                weight: a.weight 
            }));
        });
        this.initializers.forEach((i, idx) => {
            if (state.initializers[idx].outputPlace) {
                i.outputPlace = this.places[this.places.findIndex(p => p.name === state.initializers[idx].outputPlace.name)];
            }
        });
        this.annotations = state.annotations.map(a => 
            new Annotation(a.text, a.x, a.y, a.fontName, a.fontSize, a.color, a.strokeWeight));
        this.selectedElements = state.selectedElements.map(e => {
            if (e instanceof Place) return this.places.find(p => p.name === e.name);
            if (e instanceof Transition) return this.transitions.find(t => t.name === e.name);
            if (e instanceof Arc) return this.arcs.find(a => a.start.name === e.start.name && a.end.name === e.end.name && a.isInput === e.isInput);
            if (e instanceof Initializer) return this.initializers.find(i => i.name === e.name);
            if (e instanceof Annotation) return this.annotations.find(a => a.text === e.text && a.x === e.x && a.y === e.y);
            return e;
        });
        this.selected = this.selectedElements.length === 1 ? this.selectedElements[0] : null;
        this.isSmartModel = state.isSmartModel;
        this.autoRun = state.autoRun;
        this.addMode = state.addMode;
        this.handMode = state.handMode;
        this.drawingArc = state.drawingArc;
        this.arcStart = state.arcStart ? new Point(state.arcStart.x, state.arcStart.y) : null;
        this.arcEnd = state.arcEnd ? new Point(state.arcEnd.x, state.arcEnd.y) : null;
        this.selectionArea = state.selectionArea ? { ...state.selectionArea } : null;
        this.selectionStart = state.selectionStart ? new Point(state.selectionStart.x, state.selectionStart.y) : null;
        this.designState.currentFileName = state.currentFileName;
        this.designExists = state.designExists;
        this.updateStatus("State restored", this.isSmartModel ? "S-Model" : "T-Model");
        console.log("State restored");
    }

    closeDropdown(btn) {
        const dropdown = this.dropdownElements.get(btn);
        if (dropdown) {
            const isRightPanel = btn.closest("#right-panel");
            dropdown.style.opacity = "0";
            dropdown.style.pointerEvents = "none";
            dropdown.style.transform = isRightPanel ? "translateX(100%)" : "translateX(-100%)";
        }
    }

    changeAnnotationColor(color) {
        if (this.addMode === "select" && this.selected instanceof Annotation) {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Annotation) elem.color = color;
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            this.updateStatus(`Annotation color changed to ${color}`, this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Annotation color changed to:", color);
        }
    }

    changeAnnotationFont(font, size) {
        if (this.addMode === "select" && this.selected instanceof Annotation) {
            this.saveStateToUndo();
            this.selectedElements.forEach(elem => {
                if (elem instanceof Annotation) {
                    elem.fontName = font;
                    elem.fontSize = size;
                }
            });
            this.designState.setUnsavedChanges();
            this.updateButtonStates();
            this.updateStatus(`Annotation font changed to ${font} ${size}px`, this.isSmartModel ? "S-Model" : "T-Model");
            console.log("Annotation font changed to:", font, size);
        }
    }

    updateButtonStates() {
        const hasDesign = this.designExists && 
                         (this.places.length > 0 || this.transitions.length > 0 || 
                          this.arcs.length > 0 || this.initializers.length > 0 || 
                          this.annotations.length > 0);
        document.getElementById("deleteBtn").disabled = !hasDesign;
        document.getElementById("plusTokenBtn").disabled = !hasDesign;
        document.getElementById("minusTokenBtn").disabled = !hasDesign;
        document.getElementById("playPauseBtn").disabled = !hasDesign;
        document.getElementById("resetBtn").disabled = !hasDesign;
        document.getElementById("saveBtn").disabled = !hasDesign;
        document.getElementById("clearBtn").disabled = !hasDesign;
        document.getElementById("pnfnBtn").disabled = !hasDesign;
        document.getElementById("mrpnBtn").disabled = !hasDesign;
        document.getElementById("placeBtn").disabled = !this.designExists;
        document.getElementById("transitionBtn").disabled = !this.designExists;
        document.getElementById("iniBtn").disabled = !this.designExists;
        document.getElementById("arcBtn").disabled = !this.designExists;
        document.getElementById("annotateBtn").disabled = !this.designExists;

        console.log("Updated button states. Has design:", hasDesign, "Design exists:", this.designExists);
    }

    updateTitle() {
        document.title = `Petri Net Simulator - ${this.designState.currentFileName || "Untitled"}${this.designState.hasUnsavedChanges() ? " (unsaved changes *)" : " (saved)"}`;
    }

    updateStatus(message, model) {
        document.getElementById("statusText").textContent = message;
        document.getElementById("modelStatus").textContent = model;
        const statusText = document.getElementById("statusText");
        if (message.includes("Error")) {
            statusText.style.color = "#ff5555";
        } else if (message.includes("saved") || message.includes("loaded")) {
            statusText.style.color = "#55ff55";
        } else {
            statusText.style.color = "#ffffff";
        }
    }

    handleWheel(e) {
        e.preventDefault();
        if (e.deltaY < 0) this.zoomIn();
        else this.zoomOut();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const canvas = new PetriNetCanvas();
    if (!canvas.canvas) {
        console.error("Failed to initialize PetriNetCanvas!");
    } else {
        console.log("PetriNetCanvas initialized successfully");
        window.canvas = canvas;
    }
});