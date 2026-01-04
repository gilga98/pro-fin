/**
 * Pro-Finance Dispensable Income Planner
 * Helps users plan and allocate their "fun money"
 */

const DispensablePlanner = {
  categories: [
    { id: 'dining', icon: '🍽️', name: 'Dining & Entertainment', percent: 30 },
    { id: 'shopping', icon: '🛍️', name: 'Shopping', percent: 25 },
    { id: 'vacation', icon: '🏖️', name: 'Vacation Savings', percent: 20 },
    { id: 'goals', icon: '💰', name: 'Extra Goal Boost', percent: 15 },
    { id: 'misc', icon: '✨', name: 'Miscellaneous', percent: 10 }
  ],

  /**
   * Initialize the planner
   */
  init() {
    this.loadAllocations();
    this.render();
  },

  /**
   * Load saved allocations from store
   */
  loadAllocations() {
    const saved = Store.get('dispensableAllocations');
    if (saved) {
      saved.forEach(allocation => {
        const category = this.categories.find(c => c.id === allocation.id);
        if (category) category.percent = allocation.percent;
      });
    }
  },

  /**
   * Save allocations to store
   */
  saveAllocations() {
    Store.set('dispensableAllocations', this.categories.map(c => ({
      id: c.id,
      percent: c.percent
    })));
  },

  /**
   * Get current dispensable amount
   */
  getDispensableAmount() {
    const state = Store.get();
    let monthlyIncome = 0;
    let fixedExpenses = 0;
    let totalEMI = 0;
    let goalSIPs = 0;

    state.entities?.forEach(entity => {
      entity.incomeStreams?.forEach(income => {
        monthlyIncome += income.amount;
      });
      entity.expenses?.forEach(expense => {
        if (expense.type === 'fixed') fixedExpenses += expense.amount;
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
    return Math.max(0, netIncome - fixedExpenses - totalEMI - goalSIPs);
  },

  /**
   * Render the planner
   */
  render() {
    const container = document.getElementById('dispensable-planner');
    if (!container) return;

    const amount = this.getDispensableAmount();

    if (amount === 0) {
      container.innerHTML = `
        <div class="card" style="padding: var(--space-4); text-align: center;">
          <div style="font-size: 2rem; margin-bottom: var(--space-2);">💸</div>
          <p class="text-muted">Add income and expenses to see your dispensable income</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card dispensable-planner-card">
        <div class="planner-header">
          <div>
            <h4 class="planner-title">💰 Your Fun Money</h4>
            <p class="text-muted text-sm">Plan how to spend or save your monthly surplus</p>
          </div>
          <div class="stat-value text-gradient" style="font-size: var(--font-size-2xl);">
            ${Validators.formatCurrency(amount)}
          </div>
        </div>
        
        <div class="planner-categories">
          ${this.categories.map(cat => `
            <div class="planner-category" data-category="${cat.id}">
              <div class="category-header">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${cat.name}</span>
                <span class="category-amount">${Validators.formatCurrency(amount * cat.percent / 100)}</span>
              </div>
              <div class="category-slider">
                <input type="range" min="0" max="100" value="${cat.percent}" 
                       onchange="DispensablePlanner.updateCategory('${cat.id}', this.value)">
                <span class="category-percent">${cat.percent}%</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="planner-tips">
          <div class="tip-card">
            <span class="tip-icon">💡</span>
            <span class="tip-text">${this.getTip(amount)}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Update a category allocation
   */
  updateCategory(categoryId, percent) {
    const category = this.categories.find(c => c.id === categoryId);
    if (category) {
      category.percent = parseInt(percent) || 0;
      this.saveAllocations();
      this.render();
    }
  },

  /**
   * Get a contextual tip based on amount
   */
  getTip(amount) {
    if (amount > 50000) {
      return "Great surplus! Consider increasing your goal contributions for faster wealth building.";
    } else if (amount > 20000) {
      return "Healthy fun money! A vacation fund can grow quickly with consistent contributions.";
    } else if (amount > 5000) {
      return "Every bit counts! Even small amounts can compound into big savings.";
    } else {
      return "Consider reviewing expenses to increase your disposable income.";
    }
  }
};
