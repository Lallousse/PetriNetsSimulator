# AlgoViz Studio (Petri Net Simulator & Graph Algorithms)

AlgoViz Studio is a free, interactive web-based dual-platform designed to help you create, simulate, and analyze Petri Nets as well as visualize core Graph Algorithms (Prim, Kruskal, Dijkstra, Bellman-Ford). This project is built with a modern technology stack (Vite, ES Modules) and a premium dark UI using glassmorphism and Lucide icons.

> **⚠️ IMPORTANT WARNING REGARDING FILE EXPLORER:**
> Designs saved using the built-in File Explorer ("Save Local" or "Save As") are stored directly in your browser's IndexedDB. **They are only available on the device and browser where they were created.** To back up your designs or move them to another computer, you **must** use the Export/Download feature to save them as a file to your local computer.

## What is AlgoViz Studio?
AlgoViz Studio gives you the best of two worlds in one unified app:
- **Petri Net Simulator:** Create and simulate Petri Nets for educational, research, or professional modeling workflows.
- **Graph Algorithm Visualizer:** Create graphs and visualize classic algorithms step-by-step.

## How to Use the Studio
### Getting Started
1. **Access the App**: Open AlgoViz Studio by visiting the live URL (https://lallousse.github.io/AlgoViz-Studio/).
2. **Switch Platforms**: Use the Platform Switch in the top-right to toggle between "PetriNet" and "AlgoViz".
3. **Choose a Model Type (PetriNet)**: Select either the Traditional Model (T-Model) or the Smart Model (S-Model).

### Building Your Petri Net
1. **Add Elements**:
   - Click the "Place" button and click on the canvas to add places (represented as circles) where tokens reside.
   - Click the "Transition" button and click to add transitions (represented as rectangles) that fire to move tokens.
   - Use the "Arc" button to connect places to transitions or transitions to places, creating the flow of your net.
   - Add annotations with the "Annotation" button to label or describe your model.
2. **Add Tokens**:
   - Select a place, then use the "+" button to add tokens (black dots for T-Model, or numerical values for S-Model) or "-" to remove them.
   - For S-Model, double-click a place to set a specific token value (e.g., numbers for calculations).
3. **Configure Transitions (S-Model)**:
   - Double-click a transition to set a task (e.g., "+", "-", "*", "/", "==", "!=", "cp", "p <seconds>") to define how tokens are processed when the transition fires.

### Simulating Your Model
1. **Run the Simulation**:
   - Click the "Play" button to start the simulation. Tokens will move from places to transitions and back based on your net’s structure and rules.
   - Use "Pause"  to freeze the simulation mid-animation, keeping tokens in place, or click "Play" again to resume.
   - Click "Reset" to clear all tokens and stop the simulation.
2. **Adjust Speed**: Use the "Speed" button to cycle through speeds (0.25x, 0.5x, 1.0x, 1.5x) for faster or slower animations.
3. **Zoom and Pan**: Use the "Zoom In" and "Zoom Out" buttons, mouse wheel, or pinch gestures (on touch devices) to adjust the view. Use the "Hand" tool to drag the canvas for panning.

### Advanced Features (Petri Net)
- **Edit and Delete**: Switch to "Select" mode, click or drag to select elements, double-click to edit properties (e.g., names, weights, tasks), or use the "Delete" button to remove selected elements.
- **Clear Canvas**: Click "Clear Canvas" to remove all elements (confirms if unsaved changes exist).
- **Save and Load**: Use "Save" to download your design as a JSON file, and "Load" (load icon) to import a saved design.
- **Analysis Tools**:
  - **Petri Net Formal Notation (PN-FN)**: Click "PN-FN" to view the formal notation (P, T, I, O, M₀) of your net(s), regenerate markings, or insert as a note.
  - **Matrix Representation (MR-PN)**: Click "MR-PN" to see input/output matrices, regenerate them, or insert as a note.
- **Switch Models**: Use the "Switch" button to toggle between T-Model and S-Model, adapting the behavior of your net.

### Using AlgoViz (Graph Algorithms)
AlgoViz is a dedicated platform within the Studio that allows you to draw graphs and visualize classic algorithms step-by-step.
1. **Building Your Graph**:
   - Use the **Node** button to drop new nodes onto the canvas.
   - Use the **Edge** button to draw connections between nodes. The edges will automatically adapt (directed or undirected) based on the algorithm you have selected.
   - Double-click an edge to edit its **Weight**.
   - Double-click a node to edit its name.
2. **Algorithm Selection**:
   - Choose between **Prim**, **Kruskal**, **Dijkstra**, or **Bellman-Ford**.
   - For Dijkstra, Prim, and Bellman-Ford, click **Select Start Node** (target icon), then click a node to designate it as the starting point.
3. **Visualization & Playback**:
   - Press **Play** to start the algorithm. It will automatically step through the algorithm, highlighting active nodes and edges.
   - A **Floating Steps Table** tracks the state, distances, and data structures at every step of the algorithm.
   - Use **Next Step** and **Pause** to manually step through the execution.
   - Check the **Explanation Panel** in the bottom left corner for real-time pedagogical explanations of what the algorithm is doing at that exact moment.
   - *Note: Bellman-Ford fully supports negative edge weights and correctly visualizes its negative cycle detection phase.*

### Tips for Best Use
- **Snap to Grid**: Enable "Snap"  to snap elements neatly on a grid for unmovable cleaner designs.
- **Annotations**: Add notes to explain complex parts of your net, customizable with font and color via the "Font" and "Color" buttons.
- **Undo/Redo**: Use Ctrl+Z (undo) or Ctrl+Shift+Z (redo) to revert or reapply changes.
- **Guide**: Click "Guide" for a detailed tutorial on all tools and features.

## Contributing
While this app is free to use, I welcome feedback, bug reports, or feature requests. Please open an issue or contact me on Discord at `Lallousse#2052` if you have suggestions—I’m committed to improving it for the community!

## License
This project is licensed under the [MIT License](LICENSE)—feel free to use, modify, and share it, but please maintain the attribution.

---

[Lallousse](https://discord.com/users/Lallousse#2052) | Petri Net Simulator Creator
