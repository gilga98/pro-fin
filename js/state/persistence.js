/**
 * Pro-Finance Persistence Layer
 * Handles localStorage and data export/import
 */

const Persistence = {
  STORAGE_KEY: 'profinance_data',
  VERSION_KEY: 'profinance_version',
  CURRENT_VERSION: '1.0.0',

  /**
   * Save state to localStorage
   */
  save(state) {
    try {
      const data = {
        version: this.CURRENT_VERSION,
        state: state,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
      return true;
    } catch (e) {
      console.error('Failed to save state:', e);
      // Handle quota exceeded
      if (e.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
      }
      return false;
    }
  },

  /**
   * Load state from localStorage
   */
  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      
      const data = JSON.parse(raw);
      
      // Handle version migrations if needed
      if (data.version !== this.CURRENT_VERSION) {
        return this.migrate(data);
      }
      
      return data.state;
    } catch (e) {
      console.error('Failed to load state:', e);
      return null;
    }
  },

  /**
   * Migrate data from older versions
   */
  migrate(data) {
    console.log(`Migrating from version ${data.version} to ${this.CURRENT_VERSION}`);
    // Add migration logic here as versions change
    return data.state;
  },

  /**
   * Handle storage quota exceeded
   */
  handleQuotaExceeded() {
    // Try to clear old notifications to free up space
    try {
      const data = this.load();
      if (data && data.notifications && data.notifications.length > 50) {
        data.notifications = data.notifications.slice(0, 20);
        this.save(data);
      }
    } catch (e) {
      console.error('Failed to handle quota exceeded:', e);
    }
  },

  /**
   * Export data as downloadable JSON file
   */
  exportToFile(state) {
    const data = {
      version: this.CURRENT_VERSION,
      exportedAt: new Date().toISOString(),
      state: state
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `profinance-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Import data from file
   */
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.state) {
            resolve(data.state);
          } else {
            reject(new Error('Invalid file format'));
          }
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },

  /**
   * Clear all stored data
   */
  clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.VERSION_KEY);
      return true;
    } catch (e) {
      console.error('Failed to clear storage:', e);
      return false;
    }
  },

  /**
   * Get storage usage info
   */
  getStorageInfo() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const bytes = data ? new Blob([data]).size : 0;
      return {
        used: bytes,
        usedFormatted: this.formatBytes(bytes),
        estimatedMax: 5 * 1024 * 1024, // 5MB typical limit
        percentage: (bytes / (5 * 1024 * 1024)) * 100
      };
    } catch (e) {
      return null;
    }
  },

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};
