/**
 * Pro-Finance Investment Allocator
 * Manages sector allocation for goals with automatic rebalancing
 */

const InvestmentAllocator = {
  // Preset definitions
  presets: {
    equity: { name: 'Equity', icon: '📈', defaultReturn: 12, taxType: 'LTCG 10%', color: '#10b981' },
    debt: { name: 'Debt', icon: '🏦', defaultReturn: 7, taxType: 'Taxed as income', color: '#3b82f6' },
    gold: { name: 'Gold', icon: '🪙', defaultReturn: 8, taxType: 'LTCG 20%', color: '#f59e0b' },
    crypto: { name: 'Crypto', icon: '₿', defaultReturn: 15, taxType: 'VDA 30%', color: '#8b5cf6' },
    reit: { name: 'REIT', icon: '🏢', defaultReturn: 9, taxType: 'Taxed as income', color: '#ec4899' }
  },

  // Current allocation state
  currentAllocation: [],
  containerId: null,
  onUpdateCallback: null,

  /**
   * Initialize with default allocation or existing goal allocation
   */
  init(existingAllocation = null) {
      if (existingAllocation && existingAllocation.length > 0) {
        // Normalize existing data to ensure all fields exist
        this.currentAllocation = existingAllocation.map(a => ({
          id: a.id || Date.now() + Math.random().toString(36).substr(2, 9),
          type: (a.type || a.sector || 'equity').toLowerCase(),
          percent: parseInt(a.percent) || 0,
          expectedReturn: parseFloat(a.expectedReturn) || 0,
          taxType: a.taxType || this.presets[(a.type || a.sector || 'equity').toLowerCase()]?.taxType || 'Taxed'
        }));
      } else {
        // Default Strategy: Equity 60, Debt 30, Gold 10
        this.currentAllocation = [
          this.createInstrument('equity', 60),
          this.createInstrument('debt', 30),
          this.createInstrument('gold', 10)
        ];
      }
  },

  createInstrument(type, percent = 0) {
    const preset = this.presets[type] || this.presets.equity;
    return {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      type: type,
      percent: percent,
      expectedReturn: preset.defaultReturn,
      taxType: preset.taxType
    };
  },
  
  setOnUpdate(callback) {
      this.onUpdateCallback = callback;
  },

  /**
   * Render allocation sliders into a container
   */
  render(containerId) {
    this.containerId = containerId;
    const container = document.getElementById(containerId);
    if (!container) return;

    const weightedReturn = this.getWeightedReturn();
    const totalPercent = this.getTotalPercent();

    container.innerHTML = `
      <div class="allocation-sliders">
        ${this.currentAllocation.map((alloc, index) => {
          const preset = this.presets[alloc.type] || this.presets.equity;
          return `
            <div class="allocation-row" data-id="${alloc.id}">
              <div class="allocation-icon" style="color: ${preset.color}">${preset.icon}</div>
              
              <div class="allocation-config">
                <select class="allocation-select" onchange="InvestmentAllocator.updateInstrument('${alloc.id}', 'type', this.value)">
                  ${Object.keys(this.presets).map(key => `
                    <option value="${key}" ${key === alloc.type ? 'selected' : ''}>${this.presets[key].name}</option>
                  `).join('')}
                </select>
              </div>

              <div class="allocation-slider" style="flex: 1; margin: 0 10px;">
                <input type="range" class="range-slider allocation-range" 
                       min="0" max="100" value="${alloc.percent}"
                       data-id="${alloc.id}"
                       oninput="InvestmentAllocator.updateAllocation('${alloc.id}', this.value)">
              </div>
              
              <div class="allocation-percent" data-id="${alloc.id}" style="width: 35px; text-align: right;">${alloc.percent}%</div>
              
              <div class="allocation-meta" style="flex-direction: row; align-items: center; gap: 5px;">
                <input type="number" class="allocation-input-sm" value="${alloc.expectedReturn}" 
                       onchange="InvestmentAllocator.updateInstrument('${alloc.id}', 'return', this.value)">
                <span style="font-size: 10px; color: var(--text-muted);">%</span>
                
                <button class="allocation-btn-sm" onclick="InvestmentAllocator.removeInstrument('${alloc.id}')" title="Remove">×</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <button class="allocation-add-btn" onclick="InvestmentAllocator.addInstrument()">
        + Add Instrument
      </button>

      <div class="allocation-summary">
        <div class="allocation-total">
          <span class="text-muted">Total:</span>
          <span class="allocation-total-percent font-semibold" style="color: ${totalPercent === 100 ? 'var(--accent-primary)' : 'var(--accent-danger)'}">${totalPercent}%</span>
        </div>
        <div class="allocation-weighted">
          <span class="text-muted">Weighted Return:</span>
          <span class="weighted-return stat-value text-gradient" style="font-size: var(--font-size-lg);">${weightedReturn.toFixed(1)}%</span>
        </div>
      </div>
    `;

    this.styleSliders(container);
    if (this.onUpdateCallback) this.onUpdateCallback();
  },

  styleSliders(container) {
    const sliders = container.querySelectorAll('.allocation-range');
    sliders.forEach(slider => {
      const row = slider.closest('.allocation-row');
      const select = row.querySelector('select');
      const type = select ? select.value : 'equity';
      const preset = this.presets[type];
      
      if (preset) {
        slider.style.setProperty('--slider-color', preset.color);
      }
    });
  },

  updateAllocation(id, newValue) {
    const newPercent = parseInt(newValue) || 0;
    const targetAlloc = this.currentAllocation.find(a => a.id === id);
    if (!targetAlloc) return;

    const oldValue = targetAlloc.percent;
    const diff = newPercent - oldValue;

    targetAlloc.percent = newPercent;

    const otherAllocs = this.currentAllocation.filter(a => a.id !== id);
    const otherTotal = otherAllocs.reduce((sum, a) => sum + a.percent, 0);

    if (otherTotal > 0 && diff !== 0) {
      otherAllocs.forEach(alloc => {
        const proportion = alloc.percent / otherTotal;
        alloc.percent = Math.max(0, Math.round(alloc.percent - (diff * proportion)));
      });
    }

    // Force check total
    const currentTotal = this.getTotalPercent();
    if (currentTotal > 100 && otherAllocs.length > 0) {
        const overshoot = currentTotal - 100;
        const largest = otherAllocs.reduce((p, c) => (p.percent > c.percent ? p : c), otherAllocs[0]);
        if (largest) largest.percent = Math.max(0, largest.percent - overshoot);
    }
    
    this.updateUI();
  },

  addInstrument() {
    this.currentAllocation.push(this.createInstrument('equity', 0));
    if (this.containerId) this.render(this.containerId);
  },

  removeInstrument(id) {
    if (this.currentAllocation.length <= 1) {
        alert("At least one instrument is required.");
        return;
    }
    this.currentAllocation = this.currentAllocation.filter(a => a.id !== id);
    if (this.containerId) this.render(this.containerId);
  },

  updateInstrument(id, field, value) {
    const alloc = this.currentAllocation.find(a => a.id === id);
    if (!alloc) return;

    if (field === 'type') {
        alloc.type = value;
        const preset = this.presets[value];
        alloc.expectedReturn = preset.defaultReturn;
        alloc.taxType = preset.taxType;
        if (this.containerId) this.render(this.containerId);
    } else if (field === 'return') {
        alloc.expectedReturn = parseFloat(value) || 0;
        this.updateUI();
    }
  },

  updateUI() {
    if (!this.containerId) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.currentAllocation.forEach(alloc => {
      const percentEl = container.querySelector(`.allocation-percent[data-id="${alloc.id}"]`);
      if (percentEl) percentEl.textContent = `${alloc.percent}%`;

      const slider = container.querySelector(`input[data-id="${alloc.id}"]`);
      if (slider && parseInt(slider.value) !== alloc.percent) {
        slider.value = alloc.percent;
      }
    });

    const total = this.getTotalPercent();
    const totalEl = container.querySelector('.allocation-total-percent');
    if (totalEl) {
      totalEl.textContent = `${total}%`;
      totalEl.style.color = total === 100 ? 'var(--accent-primary)' : 'var(--accent-danger)';
    }

    const weightedEl = container.querySelector('.weighted-return');
    if (weightedEl) {
      weightedEl.textContent = `${this.getWeightedReturn().toFixed(1)}%`;
    }
    
    if (this.onUpdateCallback) this.onUpdateCallback();
  },

  getTotalPercent() {
    return this.currentAllocation.reduce((sum, a) => sum + parseInt(a.percent), 0);
  },

  getWeightedReturn() {
    const total = this.getTotalPercent();
    if (total === 0) return 0;
    return this.currentAllocation.reduce((sum, alloc) => {
      return sum + (alloc.percent * alloc.expectedReturn / 100);
    }, 0);
  },

  getAllocation() {
    return this.currentAllocation.map(a => ({
      type: a.type,
      percent: a.percent,
      expectedReturn: a.expectedReturn,
      taxType: a.taxType
    }));
  },

  reset() {
    this.init(null);
  }
};
