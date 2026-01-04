/**
 * Pro-Finance Trade-off View
 * Goal optimization with interactive sliders
 */

const TradeOff = {
  currentGoal: null,
  originalParams: null,

  /**
   * Initialize trade-off sliders
   */
  init() {
    const delaySlider = document.getElementById('delay-slider');
    const reduceSlider = document.getElementById('reduce-slider');
    
    // Risk is now handled by InvestmentAllocator
    
    [delaySlider, reduceSlider].forEach(slider => {
      if (slider) {
        slider.addEventListener('input', () => this.updateCalculation());
      }
    });
  },

  /**
   * Show trade-off modal for a goal
   */
  show(goalId) {
    const goal = Store.get('goals')?.find(g => g.id === goalId);
    if (!goal) return;

    this.currentGoal = goal;

    // Check achievability for warning banner
    // If goal is "on-track" (achievability >= 1), hide warning. Else show.
    const warningEl = document.getElementById('tradeoff-warning');
    if (warningEl) {
        warningEl.style.display = (goal.achievability < 1.0) ? 'block' : 'none';
    }

    // Initialize Investment Allocator with goal allocation
    if (typeof InvestmentAllocator !== 'undefined') {
        InvestmentAllocator.init(goal.investmentAllocation); // Defaults if null
        InvestmentAllocator.render('tradeoff-allocation-container');
        // Hook for updates
        InvestmentAllocator.setOnUpdate(() => this.updateCalculation());
    } 

    this.planReturn = goal.expectedReturn || 12;
    
    // Calculate derived return from current allocator state
    let calculatedReturn = 12;
    if (typeof InvestmentAllocator !== 'undefined') {
        calculatedReturn = InvestmentAllocator.getWeightedReturn();
    }
    
    this.originalParams = {
      delay: 0,
      risk: calculatedReturn,
      reduce: 0
    };

    // Update modal content
    document.getElementById('tradeoff-goal-name').textContent = goal.name;
    document.getElementById('tradeoff-target').textContent = Validators.formatCurrency(goal.futureValue || goal.targetAmount);
    
    // Show current coverage instead of probability
    const currentScore = Math.round((goal.achievability || 0) * 100);
    document.getElementById('tradeoff-current-prob').textContent = `${currentScore}%`;

    // Reset sliders
    const delaySlider = document.getElementById('delay-slider');
    const reduceSlider = document.getElementById('reduce-slider');
    if (delaySlider) delaySlider.value = 0;
    if (reduceSlider) reduceSlider.value = 0;

    // Initial calculation
    this.updateCalculation();

    // Show modal
    ProFinance.ui.showModal('tradeoff-modal');
  },

  /**
   * Update calculation based on slider values
   */
  updateCalculation() {
    if (!this.currentGoal) return;

    const delaySlider = document.getElementById('delay-slider');
    const reduceSlider = document.getElementById('reduce-slider');
    
    const delayMonths = delaySlider ? parseInt(delaySlider.value) : 0;
    const reducePercent = reduceSlider ? parseInt(reduceSlider.value) : 0;
    
    // Get risk from allocator
    let riskLevel = 12;
    if (typeof InvestmentAllocator !== 'undefined') {
        riskLevel = InvestmentAllocator.getWeightedReturn();
    }

    // Update display values
    const delayValEl = document.getElementById('delay-value');
    if (delayValEl) delayValEl.textContent = delayMonths === 0 ? 'No delay' : `${delayMonths} months`;
    
    const reduceValEl = document.getElementById('reduce-value');
    if (reduceValEl) reduceValEl.textContent = reducePercent === 0 ? 'Full target' : `-${reducePercent}%`;

    // Calculate new parameters
    const currentAmount = this.currentGoal.currentValue || 0;
    const monthlyContribution = this.currentGoal.monthlyContribution || 0;
    
    // Original target details
    const originalTargetDate = new Date(this.currentGoal.targetDate + '-01');
    const now = new Date();
    
    // Adjusted timeline
    const totalMonths = Math.max(1, 
      Math.round((originalTargetDate - now) / (30.44 * 24 * 60 * 60 * 1000)) + delayMonths
    );
    const years = totalMonths / 12;

    // Adjusted Target Amount
    const originalTargetAmount = this.currentGoal.futureValue || this.currentGoal.targetAmount;
    const targetAmount = Math.round(originalTargetAmount * (1 - reducePercent / 100));

    // Get volatility from investment allocation
    let volatility = 15;
    if (typeof InvestmentAllocator !== 'undefined') {
      const allocation = InvestmentAllocator.getAllocation();
      const equityPercent = allocation
        .filter(a => a.sector === 'equity')
        .reduce((sum, a) => sum + a.percent, 0);
      volatility = 5 + (equityPercent / 100) * 13;
    }

    // USE MONTE CARLO SIMULATION for real-time feedback
    const monteCarloEnabled = typeof MonteCarlo !== 'undefined';
    let score = 0;
    let coveragePercent = 0;

    if (monteCarloEnabled) {
      try {
        // Use quick iterations for responsive slider updates
        const quickIterations = Store.get('configuration.monteCarlo.quickIterations') || 500;
        
        const mcResults = MonteCarlo.simulateGoal({
          currentAmount: currentAmount,
          monthlyContribution: monthlyContribution,
          expectedReturn: riskLevel,
          volatility: volatility,
          years: years,
          targetAmount: targetAmount,
          iterations: quickIterations
        });
        
        // Probability of success from Monte Carlo
        score = mcResults.probability;
        coveragePercent = Math.round(score * 100);
        
      } catch (error) {
        console.warn('Monte Carlo failed in trade-off, using deterministic:', error);
        // Fallback to deterministic
        const projectedFV = this.calculateDeterministicProjection(
          currentAmount, monthlyContribution, riskLevel, totalMonths
        );
        score = targetAmount > 0 ? projectedFV / targetAmount : 1;
        coveragePercent = Math.round(score * 100);
      }
    } else {
      // Deterministic fallback
      const projectedFV = this.calculateDeterministicProjection(
        currentAmount, monthlyContribution, riskLevel, totalMonths
      );
      score = targetAmount > 0 ? projectedFV / targetAmount : 1;
      coveragePercent = Math.round(score * 100);
    }

    // Cap display score at 1.0 for ring visualization
    const displayScore = Math.min(score, 1.0);

    // Update display text (show actual percentage, can exceed 100%)
    const probEl = document.getElementById('tradeoff-new-prob');
    if (probEl) {
      if (monteCarloEnabled) {
        probEl.textContent = `${coveragePercent}%`;
      } else {
        probEl.textContent = `${coveragePercent}%`;
      }
    }

    // Update ring
    const ring = document.getElementById('tradeoff-prob-ring');
    if (ring) {
      const circumference = 2 * Math.PI * 26;
      ring.style.strokeDashoffset = circumference * (1 - displayScore);

      ring.classList.remove('high', 'medium', 'low');
      if (coveragePercent >= 95) {
        ring.classList.add('high');
      } else if (coveragePercent >= 70) {
        ring.classList.add('medium');
      } else {
        ring.classList.add('low');
      }
    }
  },

  /**
   * Deterministic projection calculation (fallback)
   */
  calculateDeterministicProjection(currentAmount, monthlyContribution, expectedReturn, months) {
    const r = expectedReturn / 100 / 12;
    const n = months;
    
    if (months <= 0) return currentAmount;
    
    const fvLumpSum = currentAmount * Math.pow(1 + r, n);
    const fvSIP = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
    return Math.round(fvLumpSum + fvSIP);
  },

  /**
   * Apply trade-off changes to goal
   */
  applyChanges() {
    if (!this.currentGoal) return;

    const delaySlider = document.getElementById('delay-slider');
    const reduceSlider = document.getElementById('reduce-slider');
    
    const delayMonths = delaySlider ? parseInt(delaySlider.value) : 0;
    const reducePercent = reduceSlider ? parseInt(reduceSlider.value) : 0;
    
    // Get new logic from allocator
    let riskLevel = 12;
    let newAllocation = null;
    
    if (typeof InvestmentAllocator !== 'undefined') {
        riskLevel = InvestmentAllocator.getWeightedReturn();
        newAllocation = InvestmentAllocator.getAllocation();
    }

    // Calculate new target date
    let newTargetDate = this.currentGoal.targetDate;
    if (delayMonths > 0) {
      const date = new Date(this.currentGoal.targetDate + '-01');
      date.setMonth(date.getMonth() + delayMonths);
      newTargetDate = date.toISOString().substring(0, 7);
    }

    // Calculate new target amount
    const originalTarget = this.currentGoal.targetAmount;
    const newTarget = Math.round(originalTarget * (1 - reducePercent / 100));

    // Update goal
    const updates = {
      targetDate: newTargetDate,
      targetAmount: newTarget,
      expectedReturn: riskLevel, // Update return
      investmentAllocation: newAllocation // Update allocation
    };

    // Recalculate future value
    if (this.currentGoal.inflationAdjust) {
      const result = Inflation.adjustGoalForInflation({
        currentCost: newTarget,
        targetDate: newTargetDate,
        inflationRate: Store.get('configuration.inflationRate') || 6
      });
      updates.futureValue = result.futureValue;
    } else {
      updates.futureValue = newTarget;
    }

    Store.updateGoal(this.currentGoal.id, updates);

    // Show success notification
    let changes = [];
    if (delayMonths > 0) changes.push(`delayed by ${delayMonths} months`);
    if (reducePercent > 0) changes.push(`target reduced by ${reducePercent}%`);
    if (Math.abs(riskLevel - (this.currentGoal.expectedReturn || 12)) > 0.1) changes.push(`risk adjusted to ${riskLevel.toFixed(1)}%`);
    if (newAllocation) changes.push('allocation updated');

    Notifications.success(
      'Goal Optimized! ✨',
      `${this.currentGoal.name}: ${changes.join(', ') || 'Updated'}`
    );

    // Close modal and refresh
    ProFinance.ui.closeModal('tradeoff-modal');
    ProFinance.refresh();
  }
};
