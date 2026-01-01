/**
 * Pro-Finance Input Validators
 * Validation logic for all user inputs
 */

const Validators = {
  /**
   * Validate income input
   */
  validateIncome(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Income source name is required');
    }
    
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      errors.push('Monthly amount must be a positive number');
    }
    
    if (parseFloat(data.amount) > 100000000) {
      errors.push('Amount seems too high. Please verify.');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate expense input
   */
  validateExpense(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Expense name is required');
    }
    
    if (!data.amount || isNaN(parseFloat(data.amount)) || parseFloat(data.amount) <= 0) {
      errors.push('Monthly amount must be a positive number');
    }
    
    if (parseFloat(data.amount) > 10000000) {
      errors.push('Amount seems too high. Please verify.');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate asset input
   */
  validateAsset(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Asset name is required');
    }
    
    if (!data.currentValue || isNaN(parseFloat(data.currentValue)) || parseFloat(data.currentValue) <= 0) {
      errors.push('Current value must be a positive number');
    }
    
    if (!data.assetType) {
      errors.push('Please select an asset type');
    }
    
    if (data.expectedReturn && (parseFloat(data.expectedReturn) < -50 || parseFloat(data.expectedReturn) > 100)) {
      errors.push('Expected return should be between -50% and 100%');
    }
    
    if (data.volatility && (parseFloat(data.volatility) < 0 || parseFloat(data.volatility) > 100)) {
      errors.push('Volatility should be between 0% and 100%');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate liability input
   */
  validateLiability(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Loan name is required');
    }
    
    if (!data.principal || isNaN(parseFloat(data.principal)) || parseFloat(data.principal) <= 0) {
      errors.push('Outstanding principal must be a positive number');
    }
    
    if (!data.interestRate || isNaN(parseFloat(data.interestRate)) || parseFloat(data.interestRate) < 0) {
      errors.push('Interest rate must be a non-negative number');
    }
    
    if (parseFloat(data.interestRate) > 50) {
      errors.push('Interest rate seems too high. Please verify.');
    }
    
    if (!data.emi || isNaN(parseFloat(data.emi)) || parseFloat(data.emi) <= 0) {
      errors.push('EMI amount must be a positive number');
    }
    
    // Validate EMI is reasonable compared to principal
    const principal = parseFloat(data.principal);
    const emi = parseFloat(data.emi);
    const tenure = parseInt(data.tenure) || 1;
    
    if (emi * tenure < principal * 0.5) {
      errors.push('EMI seems too low for the principal and tenure. Please verify.');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate goal input
   */
  validateGoal(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Goal name is required');
    }
    
    if (!data.targetAmount || isNaN(parseFloat(data.targetAmount)) || parseFloat(data.targetAmount) <= 0) {
      errors.push('Target amount must be a positive number');
    }
    
    if (!data.targetDate) {
      errors.push('Target date is required');
    } else {
      const targetDate = new Date(data.targetDate + '-01');
      const today = new Date();
      if (targetDate <= today) {
        errors.push('Target date must be in the future');
      }
      
      // Check if target is too far (> 50 years)
      const years = (targetDate - today) / (365.25 * 24 * 60 * 60 * 1000);
      if (years > 50) {
        errors.push('Target date is more than 50 years away. Consider splitting into intermediate goals.');
      }
    }
    
    if (!data.fundingSources || data.fundingSources.length === 0) {
      errors.push('Please select at least one funding source');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate entity input
   */
  validateEntity(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Entity name is required');
    }
    
    if (data.name && data.name.length > 50) {
      errors.push('Name is too long (max 50 characters)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate settings
   */
  validateSettings(data) {
    const errors = [];
    
    if (data.inflationRate !== undefined) {
      const rate = parseFloat(data.inflationRate);
      if (isNaN(rate) || rate < 0 || rate > 30) {
        errors.push('Inflation rate should be between 0% and 30%');
      }
    }
    
    if (data.monteCarloIterations !== undefined) {
      const iterations = parseInt(data.monteCarloIterations);
      if (isNaN(iterations) || iterations < 100 || iterations > 10000) {
        errors.push('Monte Carlo iterations should be between 100 and 10,000');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Sanitize string input
   */
  sanitizeString(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
  },

  /**
   * Sanitize number input
   */
  sanitizeNumber(input, defaultValue = 0) {
    const num = parseFloat(input);
    return isNaN(num) ? defaultValue : num;
  },

  /**
   * Format currency for display
   */
  formatCurrency(amount, compact = false) {
    const num = parseFloat(amount) || 0;
    
    if (compact) {
      if (num >= 10000000) {
        return '₹' + (num / 10000000).toFixed(2) + ' Cr';
      } else if (num >= 100000) {
        return '₹' + (num / 100000).toFixed(2) + ' L';
      } else if (num >= 1000) {
        return '₹' + (num / 1000).toFixed(1) + 'K';
      }
    }
    
    return '₹' + num.toLocaleString('en-IN', {
      maximumFractionDigits: 0
    });
  },

  /**
   * Format percentage for display
   */
  formatPercentage(value, decimals = 1) {
    const num = parseFloat(value) || 0;
    return num.toFixed(decimals) + '%';
  },

  /**
   * Parse Indian number format (with commas)
   */
  parseIndianNumber(str) {
    if (typeof str !== 'string') return parseFloat(str) || 0;
    return parseFloat(str.replace(/,/g, '')) || 0;
  }
};
