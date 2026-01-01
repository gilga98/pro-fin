/**
 * Pro-Finance Debt Snowball Engine
 * Prioritizes debt clearance before goal funding
 */

const DebtSnowball = {
  /**
   * Analyze debts and create payoff strategy
   */
  analyzeDebts(liabilities) {
    if (!liabilities || liabilities.length === 0) {
      return { hasDebt: false, debts: [] };
    }

    // Create debt analysis for each liability
    const debts = liabilities.map(debt => {
      const monthlyInterest = (debt.interestRate / 100) / 12;
      const interestPortion = debt.principal * monthlyInterest;
      const principalPortion = debt.emi - interestPortion;

      // Calculate months remaining
      let remaining = debt.principal;
      let months = 0;
      while (remaining > 0 && months < 600) {
        const interest = remaining * monthlyInterest;
        remaining = remaining + interest - debt.emi;
        months++;
      }

      // Calculate total interest paid
      const totalPayment = debt.emi * months;
      const totalInterest = totalPayment - debt.principal;

      return {
        ...debt,
        monthlyInterestAmount: Math.round(interestPortion),
        monthlyPrincipalAmount: Math.round(principalPortion),
        monthsRemaining: months,
        totalInterest: Math.round(totalInterest),
        interestToDebtRatio: debt.principal > 0 ? totalInterest / debt.principal : 0,
        isHighInterest: debt.interestRate > 12,
        priority: this.calculatePriority(debt)
      };
    });

    // Sort by priority (higher = pay first)
    debts.sort((a, b) => b.priority - a.priority);

    const totalDebt = debts.reduce((sum, d) => sum + d.principal, 0);
    const totalMonthlyPayment = debts.reduce((sum, d) => sum + d.emi, 0);
    const totalInterestPaid = debts.reduce((sum, d) => sum + d.totalInterest, 0);
    const weightedAvgRate = debts.reduce((sum, d) => sum + d.interestRate * d.principal, 0) / totalDebt;

    return {
      hasDebt: true,
      debts,
      summary: {
        totalDebt: Math.round(totalDebt),
        totalMonthlyPayment: Math.round(totalMonthlyPayment),
        totalInterestPaid: Math.round(totalInterestPaid),
        weightedAvgRate: Math.round(weightedAvgRate * 10) / 10,
        debtCount: debts.length
      }
    };
  },

  /**
   * Calculate debt priority score
   * Higher score = pay off first
   */
  calculatePriority(debt) {
    let score = 0;

    // High interest = high priority
    if (debt.interestRate > 20) score += 100;
    else if (debt.interestRate > 15) score += 80;
    else if (debt.interestRate > 12) score += 60;
    else if (debt.interestRate > 8) score += 40;
    else score += 20;

    // Credit card debt = highest priority
    if (debt.loanType === 'credit-card') score += 50;
    // Personal loan = high priority
    else if (debt.loanType === 'personal') score += 30;

    // Smaller balances get priority (debt snowball psychological benefit)
    if (debt.principal < 50000) score += 20;
    else if (debt.principal < 200000) score += 10;

    // Tax-beneficial loans get lower priority
    if (debt.loanType === 'home' || debt.loanType === 'education') {
      score -= 30;
    }

    return score;
  },

  /**
   * Create snowball/avalanche payoff plan
   */
  createPayoffPlan(liabilities, extraPayment = 0, method = 'avalanche') {
    const analysis = this.analyzeDebts(liabilities);
    if (!analysis.hasDebt) return null;

    // Clone debts for simulation
    let debts = analysis.debts.map(d => ({
      ...d,
      balance: d.principal,
      paid: 0,
      monthsPaid: 0
    }));

    // Sort based on method
    if (method === 'avalanche') {
      // Highest interest first
      debts.sort((a, b) => b.interestRate - a.interestRate);
    } else {
      // Smallest balance first (snowball)
      debts.sort((a, b) => a.balance - b.balance);
    }

    const plan = [];
    let month = 0;
    let totalExtraAvailable = extraPayment;

    while (debts.some(d => d.balance > 0) && month < 600) {
      month++;
      const monthPlan = { month, payments: [] };
      let freedUpPayment = 0;

      for (const debt of debts) {
        if (debt.balance <= 0) continue;

        // Calculate interest for this month
        const monthlyRate = (debt.interestRate / 100) / 12;
        const interest = debt.balance * monthlyRate;

        // Calculate payment
        let payment = debt.emi;
        
        // Add extra payment to first active debt
        if (debts.find(d => d.balance > 0) === debt) {
          payment += totalExtraAvailable + freedUpPayment;
        }

        // Cap at remaining balance + interest
        payment = Math.min(payment, debt.balance + interest);

        // Apply payment
        const principalPaid = payment - interest;
        debt.balance = Math.max(0, debt.balance - principalPaid);
        debt.paid += payment;
        debt.monthsPaid++;

        monthPlan.payments.push({
          name: debt.name,
          payment: Math.round(payment),
          interest: Math.round(interest),
          principal: Math.round(principalPaid),
          balance: Math.round(debt.balance)
        });

        // If debt is paid off, its EMI becomes available for next debt
        if (debt.balance === 0) {
          freedUpPayment += debt.emi;
        }
      }

      plan.push(monthPlan);
    }

    // Calculate savings vs minimum payments
    const withExtra = {
      months: month,
      totalPaid: debts.reduce((sum, d) => sum + d.paid, 0)
    };

    const withoutExtra = this.simulateMinimumPayments(liabilities);

    return {
      method,
      plan,
      debts: debts.map(d => ({
        name: d.name,
        initialBalance: d.principal,
        totalPaid: Math.round(d.paid),
        monthsToPay: d.monthsPaid,
        interestPaid: Math.round(d.paid - d.principal)
      })),
      summary: {
        totalMonths: withExtra.months,
        totalPaid: Math.round(withExtra.totalPaid),
        monthsSaved: withoutExtra.months - withExtra.months,
        interestSaved: Math.round(withoutExtra.totalPaid - withExtra.totalPaid)
      }
    };
  },

  /**
   * Simulate minimum payments only
   */
  simulateMinimumPayments(liabilities) {
    let debts = liabilities.map(d => ({
      balance: d.principal,
      emi: d.emi,
      rate: d.interestRate,
      paid: 0
    }));

    let month = 0;

    while (debts.some(d => d.balance > 0) && month < 600) {
      month++;
      for (const debt of debts) {
        if (debt.balance <= 0) continue;
        
        const interest = debt.balance * (debt.rate / 100 / 12);
        const payment = Math.min(debt.emi, debt.balance + interest);
        debt.balance = Math.max(0, debt.balance + interest - payment);
        debt.paid += payment;
      }
    }

    return {
      months: month,
      totalPaid: debts.reduce((sum, d) => sum + d.paid, 0)
    };
  },

  /**
   * Should prioritize debt over goal investment?
   */
  shouldPrioritizeDebt(liabilities, investmentReturn = 12) {
    const analysis = this.analyzeDebts(liabilities);
    
    if (!analysis.hasDebt) {
      return { prioritizeDebt: false, reason: 'No debt' };
    }

    // Check for high-interest debt
    const highInterestDebts = analysis.debts.filter(d => d.interestRate > investmentReturn);
    
    if (highInterestDebts.length > 0) {
      const totalHighInterest = highInterestDebts.reduce((sum, d) => sum + d.principal, 0);
      return {
        prioritizeDebt: true,
        reason: `Clear high-interest debt first (₹${totalHighInterest.toLocaleString('en-IN')} at rates above ${investmentReturn}%)`,
        highInterestDebts
      };
    }

    // Credit card debt always takes priority
    const creditCardDebt = analysis.debts.filter(d => d.loanType === 'credit-card');
    if (creditCardDebt.length > 0) {
      return {
        prioritizeDebt: true,
        reason: 'Clear credit card debt first',
        creditCardDebt
      };
    }

    return {
      prioritizeDebt: false,
      reason: `Debt interest rates are below expected investment returns (${investmentReturn}%)`
    };
  },

  /**
   * Calculate how much to allocate to debt vs goals
   */
  allocateSurplus(surplus, liabilities, investmentReturn = 12) {
    const priority = this.shouldPrioritizeDebt(liabilities, investmentReturn);
    
    if (!priority.prioritizeDebt) {
      return {
        toDebt: 0,
        toGoals: surplus,
        recommendation: 'Invest entire surplus in goals'
      };
    }

    // Calculate optimal allocation
    const analysis = this.analyzeDebts(liabilities);
    const highInterestEMIs = analysis.debts
      .filter(d => d.interestRate > investmentReturn)
      .reduce((sum, d) => sum + d.emi, 0);

    // Allocate enough to accelerate high-interest debt payoff
    const toDebt = Math.min(surplus, highInterestEMIs * 0.5);
    const toGoals = surplus - toDebt;

    return {
      toDebt: Math.round(toDebt),
      toGoals: Math.round(toGoals),
      recommendation: toDebt > 0 
        ? `Allocate ₹${toDebt.toLocaleString('en-IN')} extra to debt payoff`
        : 'Invest surplus in goals'
    };
  }
};
