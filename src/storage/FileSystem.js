export class FileSystem {
    constructor() {
        this.dbName = 'PetriNetsDB';
        this.dbVersion = 1;
        this.db = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (e) => reject("IndexedDB error: " + e.target.errorCode);
            
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('folders')) {
                    const store = db.createObjectStore('folders', { keyPath: 'id' });
                    store.createIndex('parentId', 'parentId', { unique: false });
                }
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'id' });
                    store.createIndex('folderId', 'folderId', { unique: false });
                }
            };
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Folders
    async createFolder(name, parentId = null) {
        const id = this.generateId();
        const folder = { id, name, parentId };
        return this.putData('folders', folder).then(() => folder);
    }

    async getFolders() {
        return this.getAllData('folders');
    }

    async updateFolder(folder) {
        return this.putData('folders', folder);
    }

    async deleteFolder(id) {
        // Find all children and delete them
        const files = await this.getFiles();
        const folders = await this.getFolders();
        
        const filesToDelete = files.filter(f => f.folderId === id);
        for (let f of filesToDelete) await this.deleteFile(f.id);

        const subfolders = folders.filter(f => f.parentId === id);
        for (let sub of subfolders) await this.deleteFolder(sub.id);

        return this.deleteData('folders', id);
    }

    // Files
    async saveFile(id, name, folderId, content) {
        const fileId = id || this.generateId();
        const file = {
            id: fileId,
            name,
            folderId: folderId || null,
            content,
            timestamp: Date.now()
        };
        return this.putData('files', file).then(() => file);
    }

    async getFiles() {
        return this.getAllData('files');
    }

    async getFile(id) {
        return this.getData('files', id);
    }

    async updateFile(file) {
        return this.putData('files', file);
    }

    async deleteFile(id) {
        return this.deleteData('files', id);
    }

    // DB Helpers
    putData(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data);
            req.onsuccess = () => resolve(data);
            req.onerror = () => reject(req.error);
        });
    }

    getAllData(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    getData(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    deleteData(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}
