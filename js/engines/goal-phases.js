/**
 * Pro-Finance Goal Phase Handler
 * Manages goal-specific computations and lifecycle phases
 */

const GoalPhases = {
  /**
   * Calculate comprehensive goal plan based on goal type
   */
  calculateGoalPlan(goal) {
    const today = new Date();
    const targetDate = new Date(goal.targetDate + '-01');
    const yearsToGoal = (targetDate - today) / (365.25 * 24 * 60 * 60 * 1000);
    
    const basePlan = {
      goalId: goal.id,
      goalName: goal.name,
      goalType: goal.type,
      targetDate: goal.targetDate,
      yearsRemaining: Math.max(0, yearsToGoal),
      phases: []
    };
    
    // Handle based on funding type and goal type
    if (goal.fundingType === 'loan') {
      return this.calculateLoanFundedPlan(goal, basePlan);
    }
    
    // Handle specific goal types
    switch (goal.type) {
      case 'retirement':
        return this.calculateRetirementPlan(goal, basePlan);
      case 'education':
        return this.calculateEducationPlan(goal, basePlan);
      default:
        return this.calculateCashFundedPlan(goal, basePlan);
    }
  },

  /**
   * Loan-funded goal plan (House, Car with loan)
   * Phases: Accumulate Downpayment → Purchase → EMI Payments
   */
  calculateLoanFundedPlan(goal, basePlan) {
    const today = new Date();
    const purchaseDate = new Date(goal.targetDate + '-01');
    const monthsToTarget = Math.max(1, Math.round((purchaseDate - today) / (30.44 * 24 * 60 * 60 * 1000)));
    
    // Phase 1: Accumulate downpayment
    const downpaymentTarget = goal.downpaymentAmount || Math.round(goal.futureValue * 0.2);
    const currentSaved = goal.currentValue || 0;
    const remainingDownpayment = Math.max(0, downpaymentTarget - currentSaved);
    
    // Calculate monthly SIP needed for downpayment
    const monthlyRate = 0.10 / 12; // Conservative rate for short-term goal
    const downpaymentSIP = remainingDownpayment > 0 
      ? remainingDownpayment * monthlyRate / (Math.pow(1 + monthlyRate, monthsToTarget) - 1)
      : 0;

    basePlan.phases.push({
      name: 'Accumulation Phase',
      description: 'Save for downpayment',
      status: currentSaved >= downpaymentTarget ? 'completed' : 'active',
      startDate: today.toISOString().substring(0, 7),
      endDate: goal.targetDate,
      target: downpaymentTarget,
      current: currentSaved,
      progress: Math.min(100, (currentSaved / downpaymentTarget) * 100),
      monthlySIP: Math.round(downpaymentSIP),
      icon: '💰'
    });

    // Phase 2: Purchase (one-time event)
    basePlan.phases.push({
      name: 'Purchase',
      description: 'Complete the purchase with downpayment + loan',
      status: 'pending',
      date: goal.targetDate,
      details: {
        totalCost: goal.futureValue,
        downpayment: downpaymentTarget,
        loanAmount: goal.loanAmount || Math.round(goal.futureValue * 0.8)
      },
      icon: '🎉'
    });

    // Phase 3: EMI payments
    const loanEndDate = new Date(purchaseDate);
    loanEndDate.setFullYear(loanEndDate.getFullYear() + (goal.loanTenureYears || 20));
    
    const emi = goal.projectedEMI || Store.calculateEMI(
      goal.loanAmount,
      goal.loanInterestRate || 8.5,
      goal.loanTenureYears || 20
    );
    
    const totalInterest = (emi * (goal.loanTenureYears || 20) * 12) - (goal.loanAmount || 0);

    basePlan.phases.push({
      name: 'EMI Phase',
      description: 'Monthly loan repayments',
      status: 'future',
      startDate: goal.targetDate,
      endDate: loanEndDate.toISOString().substring(0, 7),
      monthlyEMI: emi,
      totalPayments: emi * (goal.loanTenureYears || 20) * 12,
      totalInterest: Math.round(totalInterest),
      tenureYears: goal.loanTenureYears || 20,
      icon: '🏦',
      warning: emi > 0 ? `EMI of ${Validators.formatCurrency(emi)}/month will be added to your expenses after purchase` : null
    });

    // Summary
    basePlan.summary = {
      prePurchaseSIP: Math.round(downpaymentSIP),
      postPurchaseEMI: emi,
      totalCostOfOwnership: downpaymentTarget + (emi * (goal.loanTenureYears || 20) * 12),
      recommendation: this.getLoanRecommendation(goal, emi)
    };

    return basePlan;
  },

  /**
   * Cash-funded goal plan (standard savings goal)
   */
  calculateCashFundedPlan(goal, basePlan) {
    const today = new Date();
    const targetDate = new Date(goal.targetDate + '-01');
    const months = Math.max(1, Math.round((targetDate - today) / (30.44 * 24 * 60 * 60 * 1000)));
    
    const target = goal.futureValue || goal.targetAmount;
    const current = goal.currentValue || 0;
    const monthlyRate = 0.12 / 12;
    
    // Calculate SIP needed
    const fvCurrent = current * Math.pow(1 + monthlyRate, months);
    const remaining = target - fvCurrent;
    const sip = remaining > 0 
      ? remaining * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1)
      : 0;

    basePlan.phases.push({
      name: 'Savings Phase',
      description: 'Build your corpus through regular SIPs',
      status: current >= target ? 'completed' : 'active',
      startDate: today.toISOString().substring(0, 7),
      endDate: goal.targetDate,
      target: target,
      current: current,
      progress: Math.min(100, (current / target) * 100),
      monthlySIP: Math.round(sip),
      icon: '📈'
    });

    basePlan.phases.push({
      name: 'Goal Achievement',
      description: 'Withdraw and use funds',
      status: 'pending',
      date: goal.targetDate,
      icon: '🎯'
    });

    basePlan.summary = {
      monthlySIP: Math.round(sip),
      totalContributions: Math.round(sip * months),
      expectedReturns: Math.round((sip * months) * 0.4), // Rough estimate
      recommendation: sip > 0 ? `Invest ${Validators.formatCurrency(Math.round(sip))}/month in equity funds` : 'Goal already achieved!'
    };

    return basePlan;
  },

  /**
   * Retirement goal plan
   */
  calculateRetirementPlan(goal, basePlan) {
    // Use retirement corpus calculator if we have expense data
    const monthlyExpenses = Store.calculateTotalMonthlyExpenses() || 50000;
    
    const corpus = Inflation.retirementCorpus({
      monthlyExpenses,
      currentAge: 30, // TODO: Get from user profile
      retirementAge: 60,
      lifeExpectancy: 85
    });

    const target = corpus.corpusRequired;
    const current = goal.currentValue || 0;
    const yearsToRetirement = corpus.yearsToRetirement;
    
    // Phase 1: Accumulation
    const monthlyRate = 0.12 / 12;
    const months = yearsToRetirement * 12;
    const fvCurrent = current * Math.pow(1 + monthlyRate, months);
    const remaining = target - fvCurrent;
    const sip = remaining > 0 
      ? remaining * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1)
      : 0;

    basePlan.phases.push({
      name: 'Wealth Building',
      description: 'Aggressive growth phase',
      status: 'active',
      duration: `${yearsToRetirement} years`,
      monthlySIP: Math.round(sip),
      target: target,
      current: current,
      icon: '📈'
    });

    basePlan.phases.push({
      name: 'Retirement',
      description: 'Systematic withdrawal phase',
      status: 'future',
      monthlyWithdrawal: corpus.monthlyExpensesAtRetirement,
      duration: `${corpus.retirementYears} years`,
      icon: '🏖️'
    });

    basePlan.summary = {
      corpusRequired: target,
      monthlySIP: Math.round(sip),
      monthlyExpensesAtRetirement: corpus.monthlyExpensesAtRetirement,
      recommendation: `Need ${Validators.formatCurrency(target, true)} corpus for ₹${Math.round(corpus.monthlyExpensesAtRetirement / 1000)}K/month post-retirement`
    };

    return basePlan;
  },

  /**
   * Education goal plan (multi-year payments)
   */
  calculateEducationPlan(goal, basePlan) {
    const educationProjection = Inflation.educationCostProjection({
      currentCost: goal.targetAmount / 4, // Assume 4-year education
      childAge: 5, // TODO: Get from goal details
      educationAge: 18,
      educationDuration: 4
    });

    const target = educationProjection.totalCostFuture;
    const current = goal.currentValue || 0;
    
    basePlan.phases.push({
      name: 'Savings Phase',
      description: 'Build education corpus',
      status: 'active',
      target: target,
      current: current,
      icon: '📚'
    });

    // Add yearly payment phases
    educationProjection.yearWise.forEach((year, i) => {
      basePlan.phases.push({
        name: `Year ${i + 1}: ${year.year}`,
        description: `Education year ${i + 1} payment`,
        status: 'future',
        amount: year.cost,
        icon: '🎓'
      });
    });

    basePlan.summary = {
      totalCostFuture: target,
      yearlyPayments: educationProjection.yearWise,
      recommendation: `Education costs will be ${educationProjection.inflationMultiple}x today's value`
    };

    return basePlan;
  },

  /**
   * Get loan recommendation based on income and EMI
   */
  getLoanRecommendation(goal, emi) {
    const monthlyIncome = Store.calculateTotalMonthlyIncome();
    const existingEMIs = Store.state.entities.reduce((sum, e) => 
      sum + e.liabilities.reduce((s, l) => s + l.emi, 0), 0);
    
    const totalEMI = existingEMIs + emi;
    const emiRatio = monthlyIncome > 0 ? (totalEMI / monthlyIncome) * 100 : 0;
    
    if (emiRatio > 50) {
      return `⚠️ Warning: EMI would be ${Math.round(emiRatio)}% of income (recommended <50%)`;
    } else if (emiRatio > 40) {
      return `⚡ Caution: EMI would be ${Math.round(emiRatio)}% of income`;
    } else {
      return `✅ Affordable: EMI would be ${Math.round(emiRatio)}% of income`;
    }
  },

  /**
   * Get current phase for a goal
   */
  getCurrentPhase(goal) {
    const plan = this.calculateGoalPlan(goal);
    return plan.phases.find(p => p.status === 'active') || plan.phases[0];
  },

  /**
   * Get summary text for goal card
   */
  getSummaryForCard(goal) {
    const plan = this.calculateGoalPlan(goal);
    const activePhase = this.getCurrentPhase(goal);
    
    if (goal.fundingType === 'loan') {
      return {
        primaryLabel: 'Save for Downpayment:',
        primaryValue: activePhase.monthlySIP,
        secondaryLabel: 'EMI after purchase:',
        secondaryValue: plan.summary.postPurchaseEMI,
        targetLabel: 'Downpayment Target:',
        targetValue: activePhase.target,
        phase: activePhase.name,
        warning: plan.summary.recommendation
      };
    }
    
    return {
      primaryLabel: 'Monthly SIP:',
      primaryValue: activePhase.monthlySIP,
      targetLabel: 'Target:',
      targetValue: goal.futureValue || goal.targetAmount,
      phase: activePhase.name,
      recommendation: plan.summary?.recommendation
    };
  }
};
