/**
 * Utility functions for AlgoViz
 */

// Generate a UUID for unique IDs
export function generateId() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// Show a toast notification
export function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}

// Format a number for display (e.g., infinity symbol)
export function formatNumber(value) {
    if (value === Infinity) return '∞';
    if (value === -Infinity) return '-∞';
    return value;
}

// Calculate the midpoint between two points
export function calculateMidpoint(x1, y1, x2, y2) {
    return {
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2
    };
}

// Calculate the position for an edge weight label
export function calculateEdgeLabelPosition(x1, y1, x2, y2) {
    const midpoint = calculateMidpoint(x1, y1, x2, y2);
    
    // Offset the label slightly to avoid overlapping with the edge
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return midpoint;
    
    const offsetX = -dy * 10 / length;
    const offsetY = dx * 10 / length;
    
    return {
        x: midpoint.x + offsetX,
        y: midpoint.y + offsetY
    };
}

// Calculate the position for an arrow marker
export function calculateArrowPosition(x1, y1, x2, y2, nodeRadius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return { x: x2, y: y2 };
    
    // Position the arrow at the edge of the target node
    const ratio = (length - nodeRadius) / length;
    
    return {
        x: x1 + dx * ratio,
        y: y1 + dy * ratio
    };
}

// Format table data to a text string for saving
export function formatTableToText(title, headers, rows) {
    let text = `${title}\n\n`;
    
    // Calculate column widths based on content
    const columnWidths = headers.map((header, index) => {
        const maxContentWidth = rows.reduce((max, row) => {
            const cellContent = String(row[index] || '');
            return Math.max(max, cellContent.length);
        }, header.length);
        
        return Math.max(maxContentWidth, header.length) + 2; // Add padding
    });
    
    // Add headers
    text += headers.map((header, i) => 
        header.padEnd(columnWidths[i])
    ).join(' | ') + '\n';
    
    // Add separator line
    text += headers.map((_, i) => 
        '-'.repeat(columnWidths[i])
    ).join('-|-') + '\n';
    
    // Add rows
    rows.forEach(row => {
        text += row.map((cell, i) => 
            String(cell || '').padEnd(columnWidths[i])
        ).join(' | ') + '\n';
    });
    
    return text;
}

// Save content to a file
export function saveToFile(content, filename, type = 'application/json') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    
    URL.revokeObjectURL(url);
}

// Load a file and return its contents as text
export async function loadFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

// Distance between two points
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
} 