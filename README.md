# Petri Net Simulator Web App

## Support This Free Project
Thank you for checking out the Petri Net Simulator! I’ve created this web application and made it freely available to help users model, simulate, and analyze Petri Nets for educational, research, or professional purposes. Since this is offered for free, your support would be immensely appreciated to help me maintain and improve it. If you find this tool valuable, please consider donating to support my work:

- **Western Union/OMT**: Contact me on Discord at `Lallousse#2052` with your donation intent, and I’ll provide my personal information for sending money via Western Union or OMT. This ensures a secure and direct way to support me—thank you!

Your support helps cover my time, hosting costs, and future enhancements—thank you!

## What is the Petri Net Simulator?
The Petri Net Simulator is a free, interactive web-based tool designed to help you create, simulate, and analyze Petri Nets. Whether you’re a student learning about Petri Nets, a researcher modeling complex systems, or a professional designing workflows, this app provides an intuitive interface to visualize and test your models in real-time.

## How to Use the Simulator
### Getting Started
1. **Access the App**: Open the Petri Net Simulator by visiting the live URL (https://lallousse.github.io/PetriNetsSimulator/). No installation is required—just use it in any modern web browser!
2. **Choose a Model Type**: Select either the Traditional Model (T-Model) for basic Petri Net simulation or the Smart Model (S-Model) for advanced operations like arithmetic on token values (e.g., addition, multiplication) and conditional logic.

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

### Advanced Features
- **Edit and Delete**: Switch to "Select" mode, click or drag to select elements, double-click to edit properties (e.g., names, weights, tasks), or use the "Delete" button to remove selected elements.
- **Clear Canvas**: Click "Clear Canvas" to remove all elements (confirms if unsaved changes exist).
- **Save and Load**: Use "Save" to download your design as a JSON file, and "Load" (load icon) to import a saved design.
- **Analysis Tools**:
  - **Petri Net Formal Notation (PN-FN)**: Click "PN-FN" to view the formal notation (P, T, I, O, M₀) of your net(s), regenerate markings, or insert as a note.
  - **Matrix Representation (MR-PN)**: Click "MR-PN" to see input/output matrices, regenerate them, or insert as a note.
- **Switch Models**: Use the "Switch" button to toggle between T-Model and S-Model, adapting the behavior of your net.

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
