/**
 * Pro-Finance Main Application
 * Orchestrates all modules and initializes the app
 */

const ProFinance = {
  // Module references
  store: null,
  ui: null,
  data: null,
  goals: null,
  views: null,
  notifications: null,
  lifeEvents: null,
  settings: null,
  familyOffice: null,
  engines: null,

  /**
   * Initialize the application
   */
  init() {
    console.log('🚀 Initializing Pro-Finance...');

    // Initialize state
    Store.init();
    this.store = Store;

    // Initialize engines
    this.engines = {
      monteCarlo: MonteCarlo,
      tax: TaxCalculator,
      inflation: Inflation,
      debtSnowball: DebtSnowball
    };

    // Initialize UI handlers
    this.initUI();

    // Initialize data handlers
    this.initDataHandlers();

    // Initialize goal handlers
    this.initGoalHandlers();

    // Initialize settings
    this.initSettings();

    // Initialize views
    this.views = {
      flow: FlowView,
      reservoir: ReservoirView
    };

    // Initialize components
    Navigation.init();
    Notifications.init();
    FamilyOffice.init();
    TradeOff.init();

    // Initialize charts with delay for DOM readiness
    setTimeout(() => {
      FlowView.init();
      ReservoirView.init();
      this.refresh();
    }, 100);

    // Setup state change listener
    Store.subscribe('main', () => {
      this.onStateChange();
    });

    // Module references
    this.notifications = Notifications;
    this.lifeEvents = LifeEvents;
    this.familyOffice = FamilyOffice;

    console.log('✅ Pro-Finance initialized successfully!');

    // Show welcome message if first time
    if (!this.store.get('lastUpdated')) {
      this.showWelcome();
    }
  },

  /**
   * Initialize UI handlers
   */
  initUI() {
    this.ui = {
      showModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
      },

      closeModal: (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
      },

      showAddDataModal: (type = 'income') => {
        // Switch to correct tab
        const tabs = document.querySelectorAll('#data-type-tabs .tab');
        const forms = document.querySelectorAll('.data-form');
        const assetSelection = document.getElementById('asset-type-selection');

        tabs.forEach(t => {
          t.classList.toggle('active', t.dataset.type === type);
        });

        forms.forEach(f => {
          f.style.display = f.id === `${type}-form` ? 'block' : 'none';
        });

        if (assetSelection) {
          assetSelection.style.display = type === 'asset' ? 'block' : 'none';
        }

        this.ui.showModal('add-data-modal');
      },

      showGoalModal: () => {
        // Reset form
        document.getElementById('goal-form')?.reset();
        
        // Reset goal type selection
        const goalTypeCards = document.querySelectorAll('#goal-form .asset-type-card');
        goalTypeCards.forEach((c, i) => c.classList.toggle('selected', i === 0));
        
        // Set default date (1 year from now)
        const defaultDate = new Date();
        defaultDate.setFullYear(defaultDate.getFullYear() + 1);
        const dateInput = document.querySelector('#goal-form input[name="targetDate"]');
        if (dateInput) {
          dateInput.value = defaultDate.toISOString().substring(0, 7);
        }
        
        // Reset loan fields
        document.getElementById('loan-details-section').style.display = 'none';

        // Update funding sources
        FamilyOffice.updateEntitySelects();

        this.ui.showModal('goal-modal');
      },

      toggleLoanFields: (show) => {
        const section = document.getElementById('loan-details-section');
        if (section) {
          section.style.display = show ? 'block' : 'none';
        }
        if (show) {
          ProFinance.ui.updateLoanPreview();
        }
      },

      updateLoanPreview: () => {
        const form = document.getElementById('goal-form');
        if (!form) return;
        
        const targetAmount = parseFloat(form.querySelector('input[name="targetAmount"]')?.value) || 0;
        const downpaymentPercent = parseFloat(form.querySelector('input[name="downpaymentPercent"]')?.value) || 20;
        const interestRate = parseFloat(form.querySelector('input[name="loanInterestRate"]')?.value) || 8.5;
        const tenureYears = parseInt(form.querySelector('input[name="loanTenureYears"]')?.value) || 20;
        
        // Apply inflation if checked
        const inflationChecked = form.querySelector('input[name="inflationAdjust"]')?.checked;
        const targetDateStr = form.querySelector('input[name="targetDate"]')?.value;
        
        let futureValue = targetAmount;
        if (inflationChecked && targetDateStr) {
          const inflationRate = Store.get('configuration.inflationRate') || 6;
          const result = Inflation.adjustGoalForInflation({
            currentCost: targetAmount,
            targetDate: targetDateStr,
            inflationRate
          });
          futureValue = result.futureValue;
        }
        
        const downpaymentAmount = Math.round(futureValue * downpaymentPercent / 100);
        const loanAmount = Math.round(futureValue - downpaymentAmount);
        const emi = Store.calculateEMI(loanAmount, interestRate, tenureYears);
        
        // Update preview elements
        document.getElementById('loan-downpayment-preview').textContent = Validators.formatCurrency(downpaymentAmount, true);
        document.getElementById('loan-amount-preview').textContent = Validators.formatCurrency(loanAmount, true);
        document.getElementById('loan-emi-preview').textContent = Validators.formatCurrency(emi);
      },

      // Track current manage tab type
      currentManageType: 'income',

      showManageDataModal: (type = 'income') => {
        ProFinance.ui.currentManageType = type;
        ProFinance.ui.switchManageTab(type);
        ProFinance.ui.showModal('manage-data-modal');
      },

      switchManageTab: (type) => {
        ProFinance.ui.currentManageType = type;
        
        // Update tab active state
        document.querySelectorAll('#manage-data-tabs .tab').forEach(tab => {
          tab.classList.toggle('active', tab.dataset.manageType === type);
        });
        
        // Render the list for this type
        ProFinance.ui.renderManageList(type);
      },

      renderManageList: (type) => {
        const listContainer = document.getElementById('manage-data-list');
        const emptyState = document.getElementById('manage-data-empty');
        const entity = FamilyOffice.getActiveEntity();
        
        if (!entity) {
          emptyState.style.display = 'block';
          listContainer.innerHTML = '';
          return;
        }

        let items = [];
        let labelField = 'name';
        let amountField = 'amount';
        let typeField = 'type';
        
        switch (type) {
          case 'income':
            items = entity.incomeStreams || [];
            typeField = 'type';
            break;
          case 'expense':
            items = entity.expenses || [];
            typeField = 'category';
            break;
          case 'asset':
            items = entity.assets || [];
            amountField = 'currentValue';
            typeField = 'assetType';
            break;
          case 'liability':
            items = entity.liabilities || [];
            amountField = 'principal';
            typeField = 'loanType';
            break;
        }

        if (items.length === 0) {
          emptyState.style.display = 'block';
          listContainer.innerHTML = '';
          return;
        }

        emptyState.style.display = 'none';
        listContainer.innerHTML = items.map(item => `
          <div class="data-item flex justify-between items-center p-3 mb-2" 
               style="background: var(--bg-tertiary); border-radius: var(--radius-lg);">
            <div style="flex: 1; min-width: 0;">
              <div class="font-semibold" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item[labelField]}</div>
              <div class="text-sm text-muted">${item[typeField] || 'Other'}</div>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-semibold" style="white-space: nowrap;">${Validators.formatCurrency(item[amountField] || 0)}</span>
              <button class="btn btn-sm btn-secondary" onclick="ProFinance.data.editItem('${type}', '${item.id}')">✏️</button>
              <button class="btn btn-sm btn-outline" style="color: var(--accent-danger); border-color: var(--accent-danger);" 
                      onclick="ProFinance.data.deleteItem('${type}', '${item.id}')">🗑️</button>
            </div>
          </div>
        `).join('');
      }
    };

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
          m.classList.remove('active');
        });
      }
    });
  },

  /**
   * Initialize data handlers
   */
  initDataHandlers() {
    this.data = {
      saveCurrentForm: () => {
        const activeTab = document.querySelector('#data-type-tabs .tab.active');
        if (!activeTab) return;

        const type = activeTab.dataset.type;
        const form = document.getElementById(`${type}-form`);
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Get active entity
        const entityId = data.entity || FamilyOffice.activeEntity || 'user';

        try {
          let validation;
          
          switch (type) {
            case 'income':
              validation = Validators.validateIncome(data);
              if (!validation.valid) {
                Notifications.error('Validation Error', validation.errors[0]);
                return;
              }
              Store.addIncome(entityId, data);
              Notifications.success('Income Added', `${data.name} added successfully`);
              break;

            case 'expense':
              // First save the main form if filled
              if (data.name && data.amount) {
                validation = Validators.validateExpense(data);
                if (!validation.valid) {
                  Notifications.error('Validation Error', validation.errors[0]);
                  return;
                }
                Store.addExpense(entityId, data);
              }
              
              // Also save quick expense rows
              const quickCount = ProFinance.data.saveQuickExpenses(entityId);
              
              if (data.name && data.amount) {
                Notifications.success('Expenses Added', `${data.name}${quickCount > 0 ? ` + ${quickCount} more` : ''} added successfully`);
              } else if (quickCount > 0) {
                Notifications.success('Expenses Added', `${quickCount} expense(s) added successfully`);
              } else {
                Notifications.error('No Data', 'Please enter at least one expense');
                return;
              }
              break;

            case 'asset':
              data.assetType = document.getElementById('selected-asset-type')?.value;
              validation = Validators.validateAsset(data);
              if (!validation.valid) {
                Notifications.error('Validation Error', validation.errors[0]);
                return;
              }
              Store.addAsset(entityId, data);
              Notifications.success('Asset Added', `${data.name} added successfully`);
              break;

            case 'liability':
              validation = Validators.validateLiability(data);
              if (!validation.valid) {
                Notifications.error('Validation Error', validation.errors[0]);
                return;
              }
              Store.addLiability(entityId, data);
              Notifications.success('Liability Added', `${data.name} added successfully`);
              
              // Check if should prioritize debt
              const entity = Store.getEntity(entityId);
              const debtAdvice = DebtSnowball.shouldPrioritizeDebt(entity.liabilities);
              if (debtAdvice.prioritizeDebt) {
                Notifications.warning('Debt Priority', debtAdvice.reason);
              }
              break;
          }

          form.reset();
          this.ui.closeModal('add-data-modal');
          this.refresh();

        } catch (error) {
          Notifications.error('Error', error.message);
        }
      },

      exportAll: () => {
        Persistence.exportToFile(Store.get());
        Notifications.success('Exported', 'Your data has been exported');
      },

      importFile: async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
          const data = await Persistence.importFromFile(file);
          Store.import(data);
          Notifications.success('Imported', 'Data imported successfully');
          this.refresh();
        } catch (error) {
          Notifications.error('Import Failed', error.message);
        }
        
        event.target.value = '';
      },

      clearAll: () => {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
          Store.reset();
          Notifications.info('Data Cleared', 'All data has been reset');
          this.refresh();
        }
      },

      addQuickExpenseRow: () => {
        const list = document.getElementById('quick-expense-list');
        if (!list) return;
        
        const rowId = `quick-exp-${Date.now()}`;
        const row = document.createElement('div');
        row.className = 'quick-expense-row flex gap-2 mb-2 items-center';
        row.id = rowId;
        row.innerHTML = `
          <input type="text" class="form-input" placeholder="Name" style="flex: 2;" data-field="name">
          <div class="form-input-wrapper" style="flex: 1;">
            <span class="form-input-prefix">₹</span>
            <input type="number" class="form-input currency" placeholder="0" data-field="amount">
          </div>
          <select class="form-select" style="flex: 1;" data-field="category">
            <option value="housing">Housing</option>
            <option value="utilities">Utilities</option>
            <option value="transport">Transport</option>
            <option value="groceries">Groceries</option>
            <option value="insurance">Insurance</option>
            <option value="education">Education</option>
            <option value="healthcare">Healthcare</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="other">Other</option>
          </select>
          <button type="button" class="btn btn-sm btn-outline" style="color: var(--accent-danger);" onclick="this.parentElement.remove()">✕</button>
        `;
        list.appendChild(row);
      },

      saveQuickExpenses: (entityId) => {
        const list = document.getElementById('quick-expense-list');
        if (!list) return 0;
        
        const rows = list.querySelectorAll('.quick-expense-row');
        let savedCount = 0;
        
        rows.forEach(row => {
          const name = row.querySelector('[data-field="name"]')?.value?.trim();
          const amount = row.querySelector('[data-field="amount"]')?.value;
          const category = row.querySelector('[data-field="category"]')?.value || 'other';
          
          if (name && amount && parseFloat(amount) > 0) {
            Store.addExpense(entityId, {
              name,
              amount: parseFloat(amount),
              category,
              expenseType: 'fixed'
            });
            savedCount++;
          }
        });
        
        // Clear the quick expense list
        list.innerHTML = '';
        
        return savedCount;
      },

      editItem: (type, itemId) => {
        const entityId = FamilyOffice.activeEntity || 'user';
        const entity = Store.getEntity(entityId);
        if (!entity) return;

        let item, items;
        switch (type) {
          case 'income':
            items = entity.incomeStreams;
            break;
          case 'expense':
            items = entity.expenses;
            break;
          case 'asset':
            items = entity.assets;
            break;
          case 'liability':
            items = entity.liabilities;
            break;
        }

        item = items?.find(i => i.id === itemId);
        if (!item) return;

        // Simple edit dialog - prompt for new amount
        const newName = prompt('Edit name:', item.name);
        if (newName === null) return; // Cancelled

        const amountField = type === 'asset' ? 'currentValue' : (type === 'liability' ? 'principal' : 'amount');
        const newAmount = prompt('Edit amount:', item[amountField]);
        if (newAmount === null) return; // Cancelled

        try {
          const updates = { name: newName };
          updates[amountField] = parseFloat(newAmount);

          switch (type) {
            case 'income':
              Store.updateIncome(entityId, itemId, updates);
              break;
            case 'expense':
              Store.updateExpense(entityId, itemId, updates);
              break;
            case 'asset':
              Store.updateAsset(entityId, itemId, updates);
              break;
            case 'liability':
              Store.updateLiability(entityId, itemId, updates);
              break;
          }

          Notifications.success('Updated', `${newName} has been updated`);
          ProFinance.ui.renderManageList(type);
          ProFinance.refresh();
        } catch (error) {
          Notifications.error('Error', error.message);
        }
      },

      deleteItem: (type, itemId) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        const entityId = FamilyOffice.activeEntity || 'user';

        try {
          switch (type) {
            case 'income':
              Store.deleteIncome(entityId, itemId);
              break;
            case 'expense':
              Store.deleteExpense(entityId, itemId);
              break;
            case 'asset':
              Store.deleteAsset(entityId, itemId);
              break;
            case 'liability':
              Store.deleteLiability(entityId, itemId);
              break;
          }

          Notifications.success('Deleted', 'Item has been removed');
          ProFinance.ui.renderManageList(type);
          ProFinance.refresh();
        } catch (error) {
          Notifications.error('Error', error.message);
        }
      }
    };
  },

  /**
   * Initialize goal handlers
   */
  initGoalHandlers() {
    this.goals = {
      save: () => {
        const form = document.getElementById('goal-form');
        if (!form) return;

        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
          if (key === 'fundingSources') {
            data.fundingSources = data.fundingSources || [];
            data.fundingSources.push(value);
          } else {
            data[key] = value;
          }
        }

        // Handle checkbox
        data.inflationAdjust = formData.get('inflationAdjust') === 'on';

        // Validate
        const validation = Validators.validateGoal(data);
        if (!validation.valid) {
          Notifications.error('Validation Error', validation.errors[0]);
          return;
        }

        // Add goal
        const goal = Store.addGoal(data);
        
        // Check achievability and show warning if low
        if (goal.achievability < 0.5) {
          Notifications.warning(
            'Goal Needs Optimization',
            `${goal.name} has only ${Math.round(goal.achievability * 100)}% probability of success. Consider using the optimizer.`
          );
        } else {
          Notifications.success('Goal Created', `${goal.name} added to your financial plan`);
        }

        form.reset();
        this.ui.closeModal('goal-modal');
        this.refresh();
      },

      edit: (goalId) => {
        const goal = Store.get('goals')?.find(g => g.id === goalId);
        if (!goal) return;

        // Populate form
        const form = document.getElementById('goal-form');
        if (!form) return;

        form.querySelector('input[name="name"]').value = goal.name;
        form.querySelector('input[name="targetAmount"]').value = goal.targetAmount;
        form.querySelector('input[name="targetDate"]').value = goal.targetDate;
        form.querySelector('select[name="priority"]').value = goal.priority;

        // Set goal type
        const goalTypeCards = form.querySelectorAll('.asset-type-card');
        goalTypeCards.forEach(c => {
          c.classList.toggle('selected', c.dataset.goalType === goal.type);
        });
        form.querySelector('input[name="goalType"]').value = goal.type;

        // Show modal
        this.ui.showModal('goal-modal');
      },

      showTradeoff: (goalId) => {
        TradeOff.show(goalId);
      },

      applyTradeoff: () => {
        TradeOff.applyChanges();
      },

      delete: (goalId) => {
        if (confirm('Are you sure you want to delete this goal?')) {
          Store.deleteGoal(goalId);
          Notifications.info('Goal Deleted', 'The goal has been removed');
          this.refresh();
        }
      }
    };
  },

  /**
   * Initialize settings handlers
   */
  initSettings() {
    this.settings = {
      save: () => {
        const taxRegime = document.querySelector('#settings-modal [data-regime].active')?.dataset.regime || 'new';
        const fy = document.getElementById('settings-fy')?.value || '2025-26';
        const inflation = parseFloat(document.getElementById('settings-inflation')?.value) || 6;
        const mcIterations = parseInt(document.getElementById('settings-mc-iterations')?.value) || 1000;

        Store.updateConfig('taxRegime', taxRegime);
        Store.updateConfig('financialYear', fy);
        Store.updateConfig('inflationRate', inflation);
        Store.updateConfig('monteCarloIterations', mcIterations);

        Notifications.success('Settings Saved', 'Your preferences have been updated');
        this.ui.closeModal('settings-modal');
        this.refresh();
      }
    };

    // Setup tax regime tabs in settings
    const regimeTabs = document.querySelectorAll('#settings-modal [data-regime]');
    regimeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        regimeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
      });
    });
  },

  /**
   * Handle state changes
   */
  onStateChange() {
    // Update notification badge
    Notifications.updateBadge();
    
    // Update sidebar balance
    FamilyOffice.updateBalanceDisplay();

    // Check for income changes that might trigger life events
    const notifications = Store.get('notifications') || [];
    const latestNotif = notifications[0];
    
    if (latestNotif && !latestNotif.read && latestNotif.action?.type === 'salary-hike') {
      Notifications.showSalaryHikeEvent(latestNotif.action);
      latestNotif.read = true;
      Store.set('notifications', notifications);
    }
  },

  /**
   * Refresh all views
   */
  refresh() {
    const currentView = Navigation.getCurrentView();
    
    if (currentView === 'flow') {
      FlowView.refresh();
    } else if (currentView === 'reservoir') {
      ReservoirView.refresh();
    }

    FamilyOffice.renderEntities();
    FamilyOffice.updateBalanceDisplay();
    Notifications.updateBadge();
  },

  /**
   * Show welcome message for new users
   */
  showWelcome() {
    setTimeout(() => {
      Notifications.info(
        'Welcome to Pro-Finance! 🎉',
        'Start by adding your income sources and financial goals'
      );
    }, 500);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  ProFinance.init();
});

// Expose for debugging
window.ProFinance = ProFinance;
