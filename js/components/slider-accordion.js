/**
 * Pro-Finance Slider Accordion
 * Reusable component for editing items with slider + collapsible details
 */

const SliderAccordion = {
  // Track expanded items
  expandedItems: new Set(),

  /**
   * Render a list of items as slider accordions
   * @param {Array} items - [{id, name, icon, amount, maxAmount, category, type, entityId}]
   * @param {Object} options - {dataType: 'expense'|'asset'|'income'|'liability', onUpdate, onDelete}
   */
  render(items, options = {}) {
    if (!items || items.length === 0) {
      return `
        <div class="empty-state" style="padding: var(--space-8);">
          <div style="font-size: 2rem; margin-bottom: var(--space-2);">📭</div>
          <p class="text-muted">No items yet. Click "Add New" to get started.</p>
        </div>
      `;
    }

    const dataType = options.dataType || 'expense';

    return items.map(item => {
      const isExpanded = this.expandedItems.has(item.id);
      const maxAmount = item.maxAmount || Math.max(item.amount * 2, 100000);
      
      return `
        <div class="slider-accordion-item" data-id="${item.id}">
          <div class="slider-accordion-header">
            <span class="slider-accordion-icon">${item.icon || '📋'}</span>
            <span class="slider-accordion-name">${item.name}</span>
            <span class="slider-accordion-amount">${Validators.formatCurrency(item.amount)}</span>
            <button class="slider-accordion-expand ${isExpanded ? 'open' : ''}" 
                    onclick="SliderAccordion.toggleDetails('${item.id}')">
              ▼
            </button>
          </div>
          <div class="slider-accordion-slider">
            <input type="range" class="range-slider" 
                   min="0" max="${maxAmount}" value="${item.amount}"
                   oninput="SliderAccordion.onSliderChange('${item.id}', this.value, '${dataType}', '${item.entityId || 'user'}')">
            <div class="slider-accordion-range-labels">
              <span>₹0</span>
              <span>${Validators.formatCurrency(maxAmount)}</span>
            </div>
          </div>
          <div class="slider-accordion-details ${isExpanded ? 'open' : ''}" id="details-${item.id}">
            <div class="slider-accordion-details-grid">
              ${item.category ? `
                <div class="slider-accordion-detail">
                  <span class="text-muted">Category:</span>
                  <span>${this.formatCategory(item.category)}</span>
                </div>
              ` : ''}
              ${item.type ? `
                <div class="slider-accordion-detail">
                  <span class="text-muted">Type:</span>
                  <span class="badge ${item.type === 'fixed' ? 'badge-info' : 'badge-warning'}">${item.type}</span>
                </div>
              ` : ''}
              ${item.assetType ? `
                <div class="slider-accordion-detail">
                  <span class="text-muted">Asset Type:</span>
                  <span>${this.formatAssetType(item.assetType)}</span>
                </div>
              ` : ''}
              ${item.expectedReturn ? `
                <div class="slider-accordion-detail">
                  <span class="text-muted">Expected Return:</span>
                  <span>${item.expectedReturn}%</span>
                </div>
              ` : ''}
            </div>
            <div class="slider-accordion-actions">
              <button class="btn btn-sm btn-secondary" 
                      onclick="SliderAccordion.editItem('${item.id}', '${dataType}', '${item.entityId || 'user'}')">
                ✏️ Edit Details
              </button>
              <button class="btn btn-sm btn-danger" 
                      onclick="SliderAccordion.deleteItem('${item.id}', '${dataType}', '${item.entityId || 'user'}')">
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Handle slider value change
   */
  onSliderChange(itemId, newValue, dataType, entityId) {
    const amount = parseInt(newValue) || 0;
    
    // Update display immediately
    const item = document.querySelector(`[data-id="${itemId}"]`);
    if (item) {
      const amountEl = item.querySelector('.slider-accordion-amount');
      if (amountEl) {
        amountEl.textContent = Validators.formatCurrency(amount);
      }
    }

    // Debounce the store update
    clearTimeout(this._sliderTimeout);
    this._sliderTimeout = setTimeout(() => {
      this.updateStore(itemId, amount, dataType, entityId);
    }, 300);
  },

  /**
   * Update the store with new value
   */
  updateStore(itemId, amount, dataType, entityId) {
    switch (dataType) {
      case 'expense':
        Store.updateExpense(entityId, itemId, { amount });
        break;
      case 'asset':
        Store.updateAsset(entityId, itemId, { currentValue: amount });
        break;
      case 'income':
        Store.updateIncome(entityId, itemId, { amount });
        break;
      case 'liability':
        Store.updateLiability(entityId, itemId, { principal: amount });
        break;
    }
  },

  /**
   * Toggle accordion details visibility
   */
  toggleDetails(itemId) {
    const detailsEl = document.getElementById(`details-${itemId}`);
    const buttonEl = document.querySelector(`[data-id="${itemId}"] .slider-accordion-expand`);
    
    if (this.expandedItems.has(itemId)) {
      this.expandedItems.delete(itemId);
      if (detailsEl) detailsEl.classList.remove('open');
      if (buttonEl) buttonEl.classList.remove('open');
    } else {
      this.expandedItems.add(itemId);
      if (detailsEl) detailsEl.classList.add('open');
      if (buttonEl) buttonEl.classList.add('open');
    }
  },

  /**
   * Edit item - open add data modal with pre-filled data
   */
  editItem(itemId, dataType, entityId) {
    // Close manage modal first
    ProFinance.ui.closeModal('manage-data-modal');
    
    // Open add data modal for editing
    const entity = Store.getEntity(entityId);
    if (!entity) return;

    let item = null;
    switch (dataType) {
      case 'expense':
        item = entity.expenses?.find(e => e.id === itemId);
        break;
      case 'asset':
        item = entity.assets?.find(a => a.id === itemId);
        break;
      case 'income':
        item = entity.incomeStreams?.find(i => i.id === itemId);
        break;
      case 'liability':
        item = entity.liabilities?.find(l => l.id === itemId);
        break;
    }

    if (item) {
      ProFinance.ui.showAddDataModal(dataType, item);
    }
  },

  /**
   * Delete item with confirmation
   */
  deleteItem(itemId, dataType, entityId) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    switch (dataType) {
      case 'expense':
        Store.deleteExpense(entityId, itemId);
        break;
      case 'asset':
        Store.deleteAsset(entityId, itemId);
        break;
      case 'income':
        Store.deleteIncome(entityId, itemId);
        break;
      case 'liability':
        Store.deleteLiability(entityId, itemId);
        break;
    }

    // Refresh the manage data modal
    ProFinance.ui.refreshManageDataList();
  },

  /**
   * Format category for display
   */
  formatCategory(category) {
    const categories = {
      housing: '🏠 Housing',
      utilities: '💡 Utilities',
      transport: '🚗 Transport',
      groceries: '🛒 Groceries',
      insurance: '🛡️ Insurance',
      education: '📚 Education',
      healthcare: '🏥 Healthcare',
      lifestyle: '✨ Lifestyle',
      other: '📦 Other'
    };
    return categories[category] || category;
  },

  /**
   * Format asset type for display
   */
  formatAssetType(type) {
    const types = {
      'gold': '🪙 Gold',
      'land': '🏞️ Land',
      'real-estate': '🏠 Real Estate',
      'fd': '🏦 Fixed Deposit',
      'ppf': '📜 PPF',
      'bonds': '📃 Bonds',
      'stocks': '📈 Stocks',
      'mutual-funds': '📊 Mutual Funds',
      'elss': '🛡️ ELSS',
      'epf': '👴 EPF',
      'nps': '🏛️ NPS',
      'private-loan': '🤝 Loans Given'
    };
    return types[type] || type;
  },

  /**
   * Clear expanded state
   */
  clearExpanded() {
    this.expandedItems.clear();
  }
};
