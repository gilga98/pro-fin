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
              validation = Validators.validateExpense(data);
              if (!validation.valid) {
                Notifications.error('Validation Error', validation.errors[0]);
                return;
              }
              Store.addExpense(entityId, data);
              Notifications.success('Expense Added', `${data.name} added successfully`);
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
