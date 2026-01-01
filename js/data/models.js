/**
 * Pro-Finance Data Models
 * Asset types, defaults, and schema definitions
 */

const Models = {
  // Asset type definitions with expected returns and volatility
  assetTypes: {
    // Physical Assets
    gold: {
      name: 'Gold',
      category: 'physical',
      expectedReturn: 10,
      volatility: 12,
      taxTreatment: 'ltcg-indexed',
      icon: '🪙'
    },
    land: {
      name: 'Land',
      category: 'physical',
      expectedReturn: 12,
      volatility: 15,
      taxTreatment: 'ltcg-indexed',
      icon: '🏞️'
    },
    'real-estate': {
      name: 'Real Estate',
      category: 'physical',
      expectedReturn: 10,
      volatility: 12,
      taxTreatment: 'ltcg-indexed',
      icon: '🏠'
    },
    
    // Debt Instruments
    fd: {
      name: 'Fixed Deposit',
      category: 'debt',
      expectedReturn: 7,
      volatility: 0,
      taxTreatment: 'income',
      icon: '🏦'
    },
    ppf: {
      name: 'PPF',
      category: 'debt',
      expectedReturn: 7.1,
      volatility: 0,
      taxTreatment: 'exempt',
      section80C: true,
      icon: '📜'
    },
    bonds: {
      name: 'Bonds/NSC',
      category: 'debt',
      expectedReturn: 7.5,
      volatility: 2,
      taxTreatment: 'income',
      section80C: true,
      icon: '📃'
    },
    
    // Equity
    stocks: {
      name: 'Direct Stocks',
      category: 'equity',
      expectedReturn: 14,
      volatility: 22,
      taxTreatment: 'stcg-ltcg',
      icon: '📈'
    },
    'mutual-funds': {
      name: 'Mutual Funds',
      category: 'equity',
      expectedReturn: 12,
      volatility: 18,
      taxTreatment: 'stcg-ltcg',
      icon: '📊'
    },
    elss: {
      name: 'ELSS',
      category: 'equity',
      expectedReturn: 12,
      volatility: 18,
      taxTreatment: 'stcg-ltcg',
      section80C: true,
      lockIn: 3,
      icon: '🛡️'
    },
    
    // Retirement
    epf: {
      name: 'EPF',
      category: 'retirement',
      expectedReturn: 8.1,
      volatility: 0,
      taxTreatment: 'exempt',
      section80C: true,
      icon: '👴'
    },
    nps: {
      name: 'NPS',
      category: 'retirement',
      expectedReturn: 10,
      volatility: 8,
      taxTreatment: 'partial-exempt',
      section80CCD: true,
      icon: '🏛️'
    },
    gratuity: {
      name: 'Gratuity',
      category: 'retirement',
      expectedReturn: 0,
      volatility: 0,
      taxTreatment: 'exempt',
      icon: '🎁'
    },
    
    // Alternative
    'private-loan': {
      name: 'Private Loans Given',
      category: 'alternative',
      expectedReturn: 12,
      volatility: 20,
      taxTreatment: 'income',
      icon: '🤝'
    }
  },

  // Goal type definitions
  goalTypes: {
    house: { name: 'House', icon: '🏠', color: '#3b82f6' },
    retirement: { name: 'Retirement', icon: '👴', color: '#8b5cf6' },
    education: { name: 'Education', icon: '🎓', color: '#f59e0b' },
    car: { name: 'Car', icon: '🚗', color: '#10b981' },
    wedding: { name: 'Wedding', icon: '💍', color: '#ec4899' },
    travel: { name: 'Travel', icon: '✈️', color: '#0ea5e9' },
    emergency: { name: 'Emergency Fund', icon: '🚨', color: '#ef4444' },
    other: { name: 'Other', icon: '📦', color: '#6b7280' }
  },

  // Expense categories
  expenseCategories: {
    housing: { name: 'Housing (Rent/EMI)', icon: '🏠', essential: true },
    utilities: { name: 'Utilities', icon: '💡', essential: true },
    transport: { name: 'Transport', icon: '🚗', essential: true },
    groceries: { name: 'Groceries', icon: '🛒', essential: true },
    insurance: { name: 'Insurance', icon: '🛡️', essential: true },
    education: { name: 'Education', icon: '📚', essential: true },
    healthcare: { name: 'Healthcare', icon: '🏥', essential: true },
    lifestyle: { name: 'Lifestyle', icon: '🎉', essential: false },
    entertainment: { name: 'Entertainment', icon: '🎬', essential: false },
    dining: { name: 'Dining Out', icon: '🍽️', essential: false },
    shopping: { name: 'Shopping', icon: '🛍️', essential: false },
    other: { name: 'Other', icon: '📦', essential: false }
  },

  // Income types
  incomeTypes: {
    salary: { name: 'Salary', icon: '💼', taxable: true },
    business: { name: 'Business Income', icon: '🏪', taxable: true },
    freelance: { name: 'Freelance', icon: '💻', taxable: true },
    rental: { name: 'Rental Income', icon: '🏠', taxable: true },
    dividend: { name: 'Dividends', icon: '📈', taxable: true },
    interest: { name: 'Interest', icon: '🏦', taxable: true },
    capital_gains: { name: 'Capital Gains', icon: '📊', taxable: true },
    other: { name: 'Other', icon: '💰', taxable: true }
  },

  // Loan types
  loanTypes: {
    home: { name: 'Home Loan', icon: '🏠', taxBenefit: true },
    car: { name: 'Car Loan', icon: '🚗', taxBenefit: false },
    education: { name: 'Education Loan', icon: '🎓', taxBenefit: true },
    personal: { name: 'Personal Loan', icon: '👤', taxBenefit: false },
    'credit-card': { name: 'Credit Card', icon: '💳', taxBenefit: false, highInterest: true },
    gold: { name: 'Gold Loan', icon: '🪙', taxBenefit: false },
    other: { name: 'Other', icon: '📋', taxBenefit: false }
  },

  /**
   * Get asset defaults by type
   */
  getAssetDefaults(assetType) {
    return this.assetTypes[assetType] || {
      expectedReturn: 8,
      volatility: 10,
      taxTreatment: 'income'
    };
  },

  /**
   * Get goal type info
   */
  getGoalType(type) {
    return this.goalTypes[type] || this.goalTypes.other;
  },

  /**
   * Get expense category info
   */
  getExpenseCategory(category) {
    return this.expenseCategories[category] || this.expenseCategories.other;
  },

  /**
   * Get loan type info
   */
  getLoanType(type) {
    return this.loanTypes[type] || this.loanTypes.other;
  },

  /**
   * Check if a loan is high-interest (priority for debt snowball)
   */
  isHighInterestDebt(loan) {
    const type = this.loanTypes[loan.loanType];
    return type?.highInterest || loan.interestRate > 15;
  },

  /**
   * Get all assets grouped by category
   */
  getAssetsByCategory() {
    const grouped = {};
    Object.entries(this.assetTypes).forEach(([key, asset]) => {
      if (!grouped[asset.category]) {
        grouped[asset.category] = [];
      }
      grouped[asset.category].push({ key, ...asset });
    });
    return grouped;
  },

  /**
   * Calculate post-tax return based on tax treatment
   */
  calculatePostTaxReturn(asset, taxBracket) {
    const preTaxReturn = asset.expectedReturn;
    const treatment = asset.taxTreatment;
    
    switch (treatment) {
      case 'exempt':
        return preTaxReturn;
      
      case 'income':
        // Fully taxed as income
        return preTaxReturn * (1 - taxBracket);
      
      case 'stcg-ltcg':
        // Assume long-term (12.5% tax after ₹1.25L exemption)
        // Simplified: assume average 10% effective tax
        return preTaxReturn * 0.9;
      
      case 'ltcg-indexed':
        // Indexed LTCG (20% on indexed gains)
        // After indexation, effective tax is lower
        return preTaxReturn * 0.85;
      
      case 'partial-exempt':
        // NPS: 60% exempt, 40% taxable
        return preTaxReturn * (1 - 0.4 * taxBracket);
      
      default:
        return preTaxReturn * (1 - taxBracket);
    }
  }
};
