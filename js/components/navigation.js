/**
 * Pro-Finance Navigation Component
 * Handles view switching and tab navigation
 */

const Navigation = {
  currentView: 'flow',
  viewTabs: null,
  viewContainers: null,

  /**
   * Initialize navigation
   */
  init() {
    this.viewTabs = document.querySelectorAll('.view-tab');
    this.viewContainers = document.querySelectorAll('.view-container');

    // Setup view tab listeners
    this.viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        this.switchView(view);
      });
    });

    // Setup modal triggers
    document.getElementById('add-data-btn')?.addEventListener('click', () => {
      ProFinance.ui.showAddDataModal();
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => {
      ProFinance.ui.showModal('settings-modal');
    });

    document.getElementById('notification-btn')?.addEventListener('click', () => {
      ProFinance.notifications.toggle();
    });

    document.getElementById('add-entity-btn')?.addEventListener('click', () => {
      ProFinance.familyOffice.showAddEntityModal();
    });

    // Setup data type tabs in modal
    this.setupDataTypeTabs();

    // Setup asset type selection
    this.setupAssetTypeSelection();

    // Setup goal type selection
    this.setupGoalTypeSelection();
  },

  /**
   * Switch between Flow and Reservoir views
   */
  switchView(view) {
    this.currentView = view;

    // Update tab states
    this.viewTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.view === view) {
        tab.classList.add('active');
      }
    });

    // Update container visibility
    this.viewContainers.forEach(container => {
      container.classList.remove('active');
      if (container.id === `${view}-view`) {
        container.classList.add('active');
      }
    });

    // Trigger view-specific updates
    if (view === 'flow') {
      ProFinance.views.flow.refresh();
    } else if (view === 'reservoir') {
      ProFinance.views.reservoir.refresh();
    }
  },

  /**
   * Setup data type tabs in add data modal
   */
  setupDataTypeTabs() {
    const tabs = document.querySelectorAll('#data-type-tabs .tab');
    const forms = document.querySelectorAll('.data-form');
    const assetSelection = document.getElementById('asset-type-selection');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const type = tab.dataset.type;

        // Update tab states
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Show/hide forms
        forms.forEach(form => {
          form.style.display = form.id === `${type}-form` ? 'block' : 'none';
        });

        // Show asset type selection for assets
        if (type === 'asset') {
          assetSelection.style.display = 'block';
        } else {
          assetSelection.style.display = 'none';
        }
      });
    });
  },

  /**
   * Setup asset type card selection
   */
  setupAssetTypeSelection() {
    const cards = document.querySelectorAll('#asset-type-grid .asset-type-card');
    const hiddenInput = document.getElementById('selected-asset-type');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (hiddenInput) {
          hiddenInput.value = card.dataset.asset;
        }
      });
    });
  },

  /**
   * Setup goal type selection
   */
  setupGoalTypeSelection() {
    const cards = document.querySelectorAll('#goal-modal .asset-type-card');
    const hiddenInput = document.querySelector('#goal-form input[name="goalType"]');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        if (hiddenInput) {
          hiddenInput.value = card.dataset.goalType;
        }
      });
    });

    // Setup target amount / date change for future value calculation
    const targetAmountInput = document.querySelector('#goal-form input[name="targetAmount"]');
    const targetDateInput = document.querySelector('#goal-form input[name="targetDate"]');
    const inflationToggle = document.querySelector('#goal-form input[name="inflationAdjust"]');
    const futureValueDisplay = document.getElementById('goal-future-value');

    const updateFutureValue = () => {
      const amount = parseFloat(targetAmountInput.value) || 0;
      const date = targetDateInput.value;
      const adjust = inflationToggle?.checked;

      if (amount > 0 && date) {
        const result = Inflation.adjustGoalForInflation({
          currentCost: amount,
          targetDate: date,
          inflationRate: Store.get('configuration.inflationRate') || 6
        });

        if (futureValueDisplay) {
          futureValueDisplay.textContent = adjust 
            ? Validators.formatCurrency(result.futureValue)
            : Validators.formatCurrency(amount);
        }
      }
    };

    targetAmountInput?.addEventListener('input', updateFutureValue);
    targetDateInput?.addEventListener('change', updateFutureValue);
    inflationToggle?.addEventListener('change', updateFutureValue);
  },

  /**
   * Get current view
   */
  getCurrentView() {
    return this.currentView;
  }
};
