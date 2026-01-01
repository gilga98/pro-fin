/**
 * Pro-Finance Family Office View
 * Multi-entity management for household finance
 */

const FamilyOffice = {
  activeEntity: 'user',

  /**
   * Initialize Family Office
   */
  init() {
    this.renderEntities();
    this.setupEntityClick();
  },

  /**
   * Render entity cards in sidebar
   */
  renderEntities() {
    const entities = Store.get('entities') || [];
    const container = document.getElementById('entities-list');
    
    if (!container) return;

    container.innerHTML = entities.map(entity => {
      const isActive = entity.id === this.activeEntity;
      const avatarClass = entity.type === 'spouse' ? 'spouse' : 
                          entity.type === 'dependent' ? 'dependent' : '';
      
      return `
        <div class="entity-card ${isActive ? 'active' : ''}" data-entity="${entity.id}">
          <div class="entity-avatar ${avatarClass}">${entity.initials || entity.name.substring(0, 2).toUpperCase()}</div>
          <div class="entity-info">
            <div class="entity-name">${entity.name}</div>
            <div class="entity-role">${this.getEntityRole(entity)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Setup click handlers
    this.setupEntityClick();
  },

  /**
   * Get entity role description
   */
  getEntityRole(entity) {
    const income = entity.incomeStreams?.reduce((sum, i) => sum + i.amount, 0) || 0;
    
    if (income > 0) {
      return `₹${(income / 1000).toFixed(0)}K/mo income`;
    }
    
    const expenses = entity.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    if (expenses > 0) {
      return `₹${(expenses / 1000).toFixed(0)}K/mo expenses`;
    }

    return entity.type === 'dependent' ? 'Dependent' : 'No income';
  },

  /**
   * Setup entity card click handlers
   */
  setupEntityClick() {
    const cards = document.querySelectorAll('.entity-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const entityId = card.dataset.entity;
        this.selectEntity(entityId);
      });
    });
  },

  /**
   * Select an entity
   */
  selectEntity(entityId) {
    this.activeEntity = entityId;
    
    // Update UI
    const cards = document.querySelectorAll('.entity-card');
    cards.forEach(card => {
      card.classList.toggle('active', card.dataset.entity === entityId);
    });

    // Update entity select in forms
    this.updateEntitySelects();

    // Trigger refresh
    ProFinance.refresh();
  },

  /**
   * Update entity select dropdowns
   */
  updateEntitySelects() {
    const entities = Store.get('entities') || [];
    const selects = document.querySelectorAll('select[name="entity"]');
    
    selects.forEach(select => {
      select.innerHTML = entities.map(e => 
        `<option value="${e.id}" ${e.id === this.activeEntity ? 'selected' : ''}>${e.name}</option>`
      ).join('');
    });

    // Update funding sources checkboxes
    const fundingContainer = document.getElementById('funding-sources-checkboxes');
    if (fundingContainer) {
      fundingContainer.innerHTML = entities
        .filter(e => e.incomeStreams?.length > 0)
        .map(e => `
          <label class="form-check">
            <input type="checkbox" class="form-check-input" name="fundingSources" value="${e.id}" ${e.id === 'user' ? 'checked' : ''}>
            <span>${e.name}</span>
          </label>
        `).join('');
    }
  },

  /**
   * Show add entity modal
   */
  showAddEntityModal() {
    // Create a simple prompt (could be enhanced with a proper modal)
    const name = prompt('Enter family member name:');
    if (!name) return;

    const typeOptions = [
      { value: 'spouse', label: 'Spouse/Partner' },
      { value: 'dependent', label: 'Child/Dependent' },
      { value: 'parent', label: 'Parent' },
      { value: 'other', label: 'Other' }
    ];

    const type = prompt('Enter type (spouse, dependent, parent, other):') || 'other';

    const entity = Store.addEntity({
      name,
      type,
      linkedTo: 'user'
    });

    this.renderEntities();
    Notifications.success('Family Member Added', `${name} added to your Family Office`);
  },

  /**
   * Get active entity
   */
  getActiveEntity() {
    return Store.getEntity(this.activeEntity);
  },

  /**
   * Calculate unified household balance sheet
   */
  calculateHouseholdBalance() {
    const entities = Store.get('entities') || [];
    
    const balance = {
      totalAssets: 0,
      totalLiabilities: 0,
      totalIncome: 0,
      totalExpenses: 0,
      byEntity: {}
    };

    entities.forEach(entity => {
      const entityBalance = {
        assets: entity.assets?.reduce((sum, a) => sum + a.currentValue, 0) || 0,
        liabilities: entity.liabilities?.reduce((sum, l) => sum + l.principal, 0) || 0,
        income: entity.incomeStreams?.reduce((sum, i) => sum + i.amount, 0) || 0,
        expenses: entity.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0
      };

      balance.totalAssets += entityBalance.assets;
      balance.totalLiabilities += entityBalance.liabilities;
      balance.totalIncome += entityBalance.income;
      balance.totalExpenses += entityBalance.expenses;
      balance.byEntity[entity.id] = entityBalance;
    });

    balance.netWorth = balance.totalAssets - balance.totalLiabilities;
    balance.monthlySavings = balance.totalIncome - balance.totalExpenses;

    return balance;
  },

  /**
   * Update sidebar balance display
   */
  updateBalanceDisplay() {
    const balance = this.calculateHouseholdBalance();

    const updateEl = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Validators.formatCurrency(value);
    };

    updateEl('total-assets', balance.totalAssets);
    updateEl('total-liabilities', balance.totalLiabilities);
    updateEl('net-worth', balance.netWorth);
  }
};
