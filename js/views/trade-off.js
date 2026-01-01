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
    const riskSlider = document.getElementById('risk-slider');
    const reduceSlider = document.getElementById('reduce-slider');

    [delaySlider, riskSlider, reduceSlider].forEach(slider => {
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
    this.originalParams = {
      delay: 0,
      risk: 12,
      reduce: 0
    };

    // Update modal content
    document.getElementById('tradeoff-goal-name').textContent = goal.name;
    document.getElementById('tradeoff-target').textContent = Validators.formatCurrency(goal.futureValue || goal.targetAmount);
    document.getElementById('tradeoff-current-prob').textContent = `${Math.round((goal.achievability || 0) * 100)}%`;

    // Reset sliders
    document.getElementById('delay-slider').value = 0;
    document.getElementById('risk-slider').value = 12;
    document.getElementById('reduce-slider').value = 0;

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

    const delayMonths = parseInt(document.getElementById('delay-slider').value);
    const riskLevel = parseInt(document.getElementById('risk-slider').value);
    const reducePercent = parseInt(document.getElementById('reduce-slider').value);

    // Update display values
    document.getElementById('delay-value').textContent = 
      delayMonths === 0 ? 'No delay' : `${delayMonths} months`;
    
    const riskLabels = {
      6: 'Conservative (6%)',
      8: 'Moderate-Low (8%)',
      10: 'Moderate (10%)',
      12: 'Moderate-High (12%)',
      14: 'Aggressive (14%)',
      16: 'Very Aggressive (16%)',
      18: 'Ultra Aggressive (18%)'
    };
    document.getElementById('risk-value').textContent = 
      riskLabels[riskLevel] || `${riskLevel}%`;
    
    document.getElementById('reduce-value').textContent = 
      reducePercent === 0 ? 'Full target' : `-${reducePercent}%`;

    // Calculate new probability
    const targetDate = new Date(this.currentGoal.targetDate + '-01');
    const now = new Date();
    const baseYears = (targetDate - now) / (365.25 * 24 * 60 * 60 * 1000);

    const result = MonteCarlo.tradeoffSimulation({
      currentAmount: this.currentGoal.currentValue || 0,
      currentMonthlyContribution: this.currentGoal.monthlyContribution || 0,
      targetAmount: this.currentGoal.futureValue || this.currentGoal.targetAmount,
      baseYears,
      baseReturn: 12,
      baseVolatility: 15,
      delayMonths,
      riskAdjustment: riskLevel - 12,
      targetReduction: reducePercent
    });

    const newProb = Math.round(result.probability * 100);

    // Update display
    document.getElementById('tradeoff-new-prob').textContent = `${newProb}%`;

    // Update probability ring
    const ring = document.getElementById('tradeoff-prob-ring');
    if (ring) {
      const circumference = 2 * Math.PI * 26;
      ring.style.strokeDashoffset = circumference * (1 - result.probability);

      ring.classList.remove('high', 'medium', 'low');
      if (result.probability >= 0.75) {
        ring.classList.add('high');
      } else if (result.probability >= 0.5) {
        ring.classList.add('medium');
      } else {
        ring.classList.add('low');
      }
    }
  },

  /**
   * Apply trade-off changes to goal
   */
  applyChanges() {
    if (!this.currentGoal) return;

    const delayMonths = parseInt(document.getElementById('delay-slider').value);
    const riskLevel = parseInt(document.getElementById('risk-slider').value);
    const reducePercent = parseInt(document.getElementById('reduce-slider').value);

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
      expectedReturn: riskLevel
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
    if (riskLevel !== 12) changes.push(`risk adjusted to ${riskLevel}%`);

    Notifications.success(
      'Goal Optimized! ✨',
      `${this.currentGoal.name}: ${changes.join(', ')}`
    );

    // Close modal and refresh
    ProFinance.ui.closeModal('tradeoff-modal');
    ProFinance.refresh();
  }
};
