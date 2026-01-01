/**
 * Pro-Finance Flow View
 * Real-time money flow visualization
 */

const FlowView = {
  /**
   * Initialize Flow view
   */
  init() {
    // Initialize charts
    SankeyChart.init('sankey-chart');
    WaterfallChart.init('waterfall-chart');
  },

  /**
   * Refresh the Flow view with current data
   */
  refresh() {
    const state = Store.get();
    
    // Update stat cards
    this.updateStats(state);
    
    // Update charts
    SankeyChart.update(state);
    WaterfallChart.update(state);
  },

  /**
   * Update the stat cards
   */
  updateStats(state) {
    // Calculate totals
    let monthlyIncome = 0;
    let fixedExpenses = 0;
    let totalEMI = 0;
    let goalSIPs = 0;

    state.entities?.forEach(entity => {
      entity.incomeStreams?.forEach(income => {
        monthlyIncome += income.amount;
      });

      entity.expenses?.forEach(expense => {
        if (expense.type === 'fixed') {
          fixedExpenses += expense.amount;
        }
      });

      entity.liabilities?.forEach(liability => {
        totalEMI += liability.emi;
      });
    });

    state.goals?.forEach(goal => {
      goalSIPs += goal.monthlyContribution || 0;
    });

    // Calculate tax
    let monthlyTax = 0;
    if (monthlyIncome > 0) {
      const taxResult = TaxCalculator.calculateTax({
        grossIncome: monthlyIncome * 12,
        regime: state.configuration?.taxRegime || 'new'
      });
      monthlyTax = taxResult.monthlyTax;
    }

    const netIncome = monthlyIncome - monthlyTax;
    const dispensable = Math.max(0, netIncome - fixedExpenses - totalEMI - goalSIPs);

    // Update DOM
    const updateElement = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Validators.formatCurrency(value);
    };

    updateElement('monthly-income', netIncome);
    updateElement('fixed-expenses', fixedExpenses + totalEMI);
    updateElement('goal-sips', goalSIPs);
    updateElement('dispensable', dispensable);
  }
};
