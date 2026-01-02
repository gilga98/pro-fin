/**
 * Pro-Finance State Store
 * Central state management with JSON structure
 */

const Store = {
  // Initial state structure
  defaultState: {
    configuration: {
      taxRegime: 'new', // 'old' | 'new'
      inflationRate: 6,
      financialYear: '2025-26',
      currency: 'INR',
      monteCarloIterations: 1000
    },
    entities: [
      {
        id: 'user',
        name: 'Primary User',
        type: 'individual',
        initials: 'PU',
        incomeStreams: [],
        expenses: [],
        assets: [],
        liabilities: []
      }
    ],
    goals: [],
    notifications: [],
    lastUpdated: null,
    previousMonthlyIncome: null // For detecting salary hikes
  },

  // Current state
  state: null,

  // Subscribers for reactive updates
  subscribers: new Map(),

  /**
   * Initialize the store
   */
  init() {
    const savedState = Persistence.load();
    this.state = savedState || JSON.parse(JSON.stringify(this.defaultState));
    this.state.lastUpdated = new Date().toISOString();
    this.notifyAll();
    console.log('Store initialized:', this.state);
  },

  /**
   * Get current state or a specific path
   */
  get(path = null) {
    if (!path) return this.state;
    
    const keys = path.split('.');
    let value = this.state;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  },

  /**
   * Set state at a specific path
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.state;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    this.state.lastUpdated = new Date().toISOString();
    this.persist();
    this.notifyAll();
  },

  /**
   * Update configuration
   */
  updateConfig(key, value) {
    this.state.configuration[key] = value;
    this.persist();
    this.notifyAll();
  },

  /**
   * Get entity by ID
   */
  getEntity(entityId) {
    return this.state.entities.find(e => e.id === entityId);
  },

  /**
   * Add a new entity (spouse, dependent)
   */
  addEntity(entity) {
    const newEntity = {
      id: entity.id || `entity-${Date.now()}`,
      name: entity.name,
      type: entity.type || 'individual',
      initials: entity.initials || entity.name.substring(0, 2).toUpperCase(),
      linkedTo: entity.linkedTo || 'user',
      incomeStreams: [],
      expenses: [],
      assets: [],
      liabilities: []
    };
    this.state.entities.push(newEntity);
    this.persist();
    this.notifyAll();
    return newEntity;
  },

  /**
   * Add income stream to an entity
   */
  addIncome(entityId, income) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const newIncome = {
      id: `income-${Date.now()}`,
      name: income.name,
      amount: parseFloat(income.amount),
      type: income.type || 'salary',
      taxable: income.taxable !== false,
      createdAt: new Date().toISOString()
    };
    
    entity.incomeStreams.push(newIncome);
    this.checkForIncomeChange();
    this.persist();
    this.notifyAll();
    return newIncome;
  },

  /**
   * Update income stream
   */
  updateIncome(entityId, incomeId, updates) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const income = entity.incomeStreams.find(i => i.id === incomeId);
    if (!income) throw new Error(`Income ${incomeId} not found`);
    
    if (updates.name) income.name = updates.name;
    if (updates.amount) income.amount = parseFloat(updates.amount);
    if (updates.type) income.type = updates.type;
    if (updates.taxable !== undefined) income.taxable = updates.taxable;
    
    this.checkForIncomeChange();
    this.persist();
    this.notifyAll();
    return income;
  },

  /**
   * Delete income stream
   */
  deleteIncome(entityId, incomeId) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const index = entity.incomeStreams.findIndex(i => i.id === incomeId);
    if (index > -1) {
      entity.incomeStreams.splice(index, 1);
      this.persist();
      this.notifyAll();
      return true;
    }
    return false;
  },

  /**
   * Add expense to an entity
   */
  addExpense(entityId, expense) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const newExpense = {
      id: `expense-${Date.now()}`,
      name: expense.name,
      amount: parseFloat(expense.amount),
      category: expense.category || 'other',
      type: expense.expenseType || 'fixed',
      createdAt: new Date().toISOString()
    };
    
    entity.expenses.push(newExpense);
    this.persist();
    this.notifyAll();
    return newExpense;
  },

  /**
   * Update expense
   */
  updateExpense(entityId, expenseId, updates) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const expense = entity.expenses.find(e => e.id === expenseId);
    if (!expense) throw new Error(`Expense ${expenseId} not found`);
    
    if (updates.name) expense.name = updates.name;
    if (updates.amount) expense.amount = parseFloat(updates.amount);
    if (updates.category) expense.category = updates.category;
    if (updates.expenseType) expense.type = updates.expenseType;
    
    this.persist();
    this.notifyAll();
    return expense;
  },

  /**
   * Delete expense
   */
  deleteExpense(entityId, expenseId) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const index = entity.expenses.findIndex(e => e.id === expenseId);
    if (index > -1) {
      entity.expenses.splice(index, 1);
      this.persist();
      this.notifyAll();
      return true;
    }
    return false;
  },

  /**
   * Add asset to an entity
   */
  addAsset(entityId, asset) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const assetDefaults = Models.getAssetDefaults(asset.assetType);
    
    const newAsset = {
      id: `asset-${Date.now()}`,
      name: asset.name,
      assetType: asset.assetType,
      currentValue: parseFloat(asset.currentValue),
      purchaseValue: parseFloat(asset.purchaseValue) || parseFloat(asset.currentValue),
      expectedReturn: parseFloat(asset.expectedReturn) || assetDefaults.expectedReturn,
      volatility: parseFloat(asset.volatility) || assetDefaults.volatility,
      taxTreatment: assetDefaults.taxTreatment,
      createdAt: new Date().toISOString()
    };
    
    entity.assets.push(newAsset);
    this.persist();
    this.notifyAll();
    return newAsset;
  },

  /**
   * Update asset
   */
  updateAsset(entityId, assetId, updates) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const asset = entity.assets.find(a => a.id === assetId);
    if (!asset) throw new Error(`Asset ${assetId} not found`);
    
    if (updates.name) asset.name = updates.name;
    if (updates.currentValue) asset.currentValue = parseFloat(updates.currentValue);
    if (updates.expectedReturn) asset.expectedReturn = parseFloat(updates.expectedReturn);
    if (updates.volatility) asset.volatility = parseFloat(updates.volatility);
    
    this.persist();
    this.notifyAll();
    return asset;
  },

  /**
   * Delete asset
   */
  deleteAsset(entityId, assetId) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const index = entity.assets.findIndex(a => a.id === assetId);
    if (index > -1) {
      entity.assets.splice(index, 1);
      this.persist();
      this.notifyAll();
      return true;
    }
    return false;
  },

  /**
   * Add liability to an entity
   */
  addLiability(entityId, liability) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const newLiability = {
      id: `liability-${Date.now()}`,
      name: liability.name,
      loanType: liability.loanType || 'other',
      principal: parseFloat(liability.principal),
      interestRate: parseFloat(liability.interestRate),
      emi: parseFloat(liability.emi),
      tenure: parseInt(liability.tenure) || 0,
      linkedGoalId: liability.linkedGoalId || null,
      createdAt: new Date().toISOString()
    };
    
    entity.liabilities.push(newLiability);
    this.persist();
    this.notifyAll();
    return newLiability;
  },

  /**
   * Update liability
   */
  updateLiability(entityId, liabilityId, updates) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const liability = entity.liabilities.find(l => l.id === liabilityId);
    if (!liability) throw new Error(`Liability ${liabilityId} not found`);
    
    if (updates.name) liability.name = updates.name;
    if (updates.principal) liability.principal = parseFloat(updates.principal);
    if (updates.interestRate) liability.interestRate = parseFloat(updates.interestRate);
    if (updates.emi) liability.emi = parseFloat(updates.emi);
    if (updates.tenure) liability.tenure = parseInt(updates.tenure);
    
    this.persist();
    this.notifyAll();
    return liability;
  },

  /**
   * Delete liability
   */
  deleteLiability(entityId, liabilityId) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    const index = entity.liabilities.findIndex(l => l.id === liabilityId);
    if (index > -1) {
      entity.liabilities.splice(index, 1);
      this.persist();
      this.notifyAll();
      return true;
    }
    return false;
  },

  /**
   * Update entity
   */
  updateEntity(entityId, updates) {
    const entity = this.getEntity(entityId);
    if (!entity) throw new Error(`Entity ${entityId} not found`);
    
    if (updates.name) {
      entity.name = updates.name;
      entity.initials = updates.name.substring(0, 2).toUpperCase();
    }
    if (updates.type) entity.type = updates.type;
    
    this.persist();
    this.notifyAll();
    return entity;
  },

  /**
   * Delete entity (cannot delete primary user)
   */
  deleteEntity(entityId) {
    if (entityId === 'user') {
      throw new Error('Cannot delete primary user');
    }
    
    const index = this.state.entities.findIndex(e => e.id === entityId);
    if (index > -1) {
      this.state.entities.splice(index, 1);
      this.persist();
      this.notifyAll();
      return true;
    }
    return false;
  },

  /**
   * Add a financial goal
   * Supports both cash-funded and loan-funded goals
   */
  addGoal(goal) {
    const inflationRate = this.state.configuration.inflationRate / 100;
    const today = new Date();
    const targetDate = new Date(goal.targetDate + '-01');
    const years = (targetDate - today) / (365.25 * 24 * 60 * 60 * 1000);
    
    const targetAmount = parseFloat(goal.targetAmount);
    const futureValue = goal.inflationAdjust !== false 
      ? targetAmount * Math.pow(1 + inflationRate, years)
      : targetAmount;
    
    // Parse funding type and loan details
    const fundingType = goal.fundingType || 'cash'; // 'cash' or 'loan'
    const downpaymentPercent = parseFloat(goal.downpaymentPercent) || 20;
    const loanInterestRate = parseFloat(goal.loanInterestRate) || 8.5;
    const loanTenureYears = parseInt(goal.loanTenureYears) || 20;
    
    // Calculate loan-related amounts
    const downpaymentAmount = fundingType === 'loan' 
      ? Math.round(futureValue * downpaymentPercent / 100)
      : 0;
    const loanAmount = fundingType === 'loan'
      ? Math.round(futureValue - downpaymentAmount)
      : 0;
    const emi = fundingType === 'loan'
      ? this.calculateEMI(loanAmount, loanInterestRate, loanTenureYears)
      : 0;
    
    const newGoal = {
      id: `goal-${Date.now()}`,
      name: goal.name,
      type: goal.goalType || 'other',
      targetAmount: targetAmount,
      futureValue: Math.round(futureValue),
      targetDate: goal.targetDate,
      inflationAdjust: goal.inflationAdjust !== false,
      fundingSources: goal.fundingSources || ['user'],
      priority: parseInt(goal.priority) || 2,
      
      // Funding type
      fundingType: fundingType,
      
      // For cash-funded goals
      monthlyContribution: 0,  // Will be calculated
      currentValue: parseFloat(goal.currentValue) || 0,
      
      // For loan-funded goals
      downpaymentPercent: downpaymentPercent,
      downpaymentAmount: downpaymentAmount,
      loanAmount: loanAmount,
      loanInterestRate: loanInterestRate,
      loanTenureYears: loanTenureYears,
      projectedEMI: emi,
      
      // Investment assumptions
      expectedReturn: parseFloat(goal.expectedReturn) || 12,
      salaryIncrement: parseFloat(goal.salaryIncrement) || 8,
      
      achievability: 0,
      createdAt: new Date().toISOString()
    };
    
    // Calculate required monthly contribution and achievability
    this.calculateGoalMetrics(newGoal);
    
    this.state.goals.push(newGoal);
    this.persist();
    this.notifyAll();
    return newGoal;
  },

  /**
   * Calculate EMI for a loan
   */
  calculateEMI(principal, annualRate, tenureYears) {
    if (principal <= 0 || tenureYears <= 0) return 0;
    
    const monthlyRate = annualRate / 100 / 12;
    const months = tenureYears * 12;
    
    if (monthlyRate === 0) return Math.round(principal / months);
    
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) 
                / (Math.pow(1 + monthlyRate, months) - 1);
    
    return Math.round(emi);
  },

  /**
   * Calculate goal metrics (SIP required, achievability)
   * For loan-funded goals: calculate SIP needed for downpayment only
   * For cash-funded goals: calculate SIP needed for full amount
   */
  calculateGoalMetrics(goal) {
    const today = new Date();
    const targetDate = new Date(goal.targetDate + '-01');
    const months = Math.max(1, Math.round((targetDate - today) / (30.44 * 24 * 60 * 60 * 1000)));
    
    // Assume moderate return rate of 12% annually for equity-heavy portfolio
    const monthlyRate = 0.12 / 12;
    
    // For loan-funded goals, target is the downpayment
    // For cash-funded goals, target is the full future value
    const target = goal.fundingType === 'loan' 
      ? goal.downpaymentAmount || 0
      : goal.futureValue;
    
    const current = goal.currentValue || 0;
    
    // Future value of current amount
    const fvCurrent = current * Math.pow(1 + monthlyRate, months);
    const remaining = target - fvCurrent;
    
    // Required monthly SIP (using annuity formula)
    const requiredSIP = remaining > 0 
      ? remaining * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1)
      : 0;
    
    goal.monthlyContribution = Math.max(0, Math.round(requiredSIP));
    
    // For loan-funded goals, also store the post-purchase EMI
    if (goal.fundingType === 'loan' && goal.loanAmount > 0) {
      goal.projectedEMI = this.calculateEMI(
        goal.loanAmount, 
        goal.loanInterestRate, 
        goal.loanTenureYears
      );
    }
    
    // Calculate ACTUAL available monthly savings for simulation
    // This is what the user can actually invest, not what's required
    const totalIncome = this.calculateTotalMonthlyIncome();
    const totalExpenses = this.calculateTotalMonthlyExpenses();
    
    // Get total EMIs from liabilities
    const totalEMIs = this.state.entities.reduce((sum, entity) => 
      sum + entity.liabilities.reduce((emiSum, l) => emiSum + (l.emi || 0), 0), 0);
    
    // Get SIPs already allocated to other goals
    const otherGoalsSIP = this.state.goals
      .filter(g => g.id !== goal.id)
      .reduce((sum, g) => sum + (g.monthlyContribution || 0), 0);
    
    // Available income for this goal = Income - Expenses - EMIs - Other Goals
    const dispensableIncome = Math.max(0, totalIncome - totalExpenses - totalEMIs - otherGoalsSIP);
    
    // For Monte Carlo, use the ACTUAL available income
    // If user can contribute MORE than required, probability increases above 50%
    // This gives meaningful achievability signals
    const actualContribution = dispensableIncome;
    
    // Get expected return from goal or use default
    const expectedReturn = goal.expectedReturn || 12;
    
    // Run Monte Carlo with actual contribution ability
    const result = MonteCarlo.simulateGoal({
      currentAmount: current,
      monthlyContribution: actualContribution,
      expectedReturn: expectedReturn,
      volatility: 15,
      years: months / 12,
      targetAmount: target,
      iterations: this.state.configuration.monteCarloIterations
    });
    
    goal.achievability = result.probability;
    goal.percentiles = result.percentiles;
    
    // Store the actual contribution for display purposes
    goal.actualContribution = actualContribution;
    goal.canAffordRequired = dispensableIncome >= goal.monthlyContribution;
  },

  /**
   * Update an existing goal
   */
  updateGoal(goalId, updates) {
    const goal = this.state.goals.find(g => g.id === goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);
    
    Object.assign(goal, updates);
    this.calculateGoalMetrics(goal);
    this.persist();
    this.notifyAll();
    return goal;
  },

  /**
   * Delete a goal
   */
  deleteGoal(goalId) {
    const index = this.state.goals.findIndex(g => g.id === goalId);
    if (index > -1) {
      this.state.goals.splice(index, 1);
      this.persist();
      this.notifyAll();
    }
  },

  /**
   * Add notification
   */
  addNotification(notification) {
    const newNotification = {
      id: `notif-${Date.now()}`,
      type: notification.type || 'info',
      title: notification.title,
      message: notification.message,
      action: notification.action || null,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    this.state.notifications.unshift(newNotification);
    this.persist();
    this.notifyAll();
    return newNotification;
  },

  /**
   * Check for income change (salary hike detection)
   */
  checkForIncomeChange() {
    const currentIncome = this.calculateTotalMonthlyIncome();
    const previousIncome = this.state.previousMonthlyIncome;
    
    if (previousIncome && currentIncome > previousIncome) {
      const increase = currentIncome - previousIncome;
      const percentIncrease = (increase / previousIncome) * 100;
      
      if (percentIncrease >= 5) { // 5% or more increase
        this.addNotification({
          type: 'success',
          title: 'Income Increase Detected! 🎉',
          message: `Your monthly income increased by ₹${increase.toLocaleString('en-IN')}`,
          action: { type: 'salary-hike', amount: increase }
        });
      }
    }
    
    this.state.previousMonthlyIncome = currentIncome;
  },

  /**
   * Calculate total monthly income across all entities
   */
  calculateTotalMonthlyIncome() {
    return this.state.entities.reduce((total, entity) => {
      return total + entity.incomeStreams.reduce((sum, income) => sum + income.amount, 0);
    }, 0);
  },

  /**
   * Calculate total monthly expenses
   */
  calculateTotalMonthlyExpenses() {
    return this.state.entities.reduce((total, entity) => {
      return total + entity.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    }, 0);
  },

  /**
   * Calculate total assets value
   */
  calculateTotalAssets() {
    return this.state.entities.reduce((total, entity) => {
      return total + entity.assets.reduce((sum, asset) => sum + asset.currentValue, 0);
    }, 0);
  },

  /**
   * Calculate total liabilities
   */
  calculateTotalLiabilities() {
    return this.state.entities.reduce((total, entity) => {
      return total + entity.liabilities.reduce((sum, liability) => sum + liability.principal, 0);
    }, 0);
  },

  /**
   * Calculate net worth
   */
  calculateNetWorth() {
    return this.calculateTotalAssets() - this.calculateTotalLiabilities();
  },

  /**
   * Subscribe to state changes
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key).push(callback);
    return () => this.unsubscribe(key, callback);
  },

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(key, callback) {
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  },

  /**
   * Notify all subscribers
   */
  notifyAll() {
    this.subscribers.forEach((callbacks, key) => {
      callbacks.forEach(callback => {
        try {
          callback(this.state);
        } catch (e) {
          console.error(`Error in subscriber ${key}:`, e);
        }
      });
    });
  },

  /**
   * Persist state to storage
   */
  persist() {
    Persistence.save(this.state);
  },

  /**
   * Reset to default state
   */
  reset() {
    this.state = JSON.parse(JSON.stringify(this.defaultState));
    this.persist();
    this.notifyAll();
  },

  /**
   * Import state from JSON
   */
  import(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      this.state = { ...this.defaultState, ...data };
      this.persist();
      this.notifyAll();
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  },

  /**
   * Export state as JSON
   */
  export() {
    return JSON.stringify(this.state, null, 2);
  }
};
