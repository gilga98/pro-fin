/**
 * Pro-Finance Reservoir View
 * Future wealth projections and goal tracking
 */

const ReservoirView = {
  /**
   * Initialize Reservoir view
   */
  init() {
    this.setupValueToggle();
  },

  /**
   * Setup today/future value toggle
   */
  setupValueToggle() {
    const tabs = document.querySelectorAll('#reservoir-view .tabs .tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderGoals(tab.dataset.value === 'future');
      });
    });
  },

  /**
   * Refresh the Reservoir view
   */
  refresh() {
    const state = Store.get();
    
    // Update goals grid
    this.renderGoals(false); // Default to today's value
    
    // Update probability indicator
    this.updateProbability(state);
  },

  /**
   * Render goals grid
   */
  renderGoals(showFutureValue = false) {
    const goals = Store.get('goals') || [];
    const goalsGrid = document.getElementById('goals-grid');
    
    if (!goalsGrid) return;

    if (goals.length === 0) {
      goalsGrid.innerHTML = `
        <div class="card" style="border: 2px dashed var(--bg-tertiary); display: flex; align-items: center; justify-content: center; min-height: 280px;">
          <div class="empty-state" style="padding: 0;">
            <div class="empty-state-icon">🎯</div>
            <h4 class="empty-state-title">Add Your First Goal</h4>
            <p class="empty-state-text">Define what you\'re saving for</p>
            <button class="btn btn-primary" onclick="ProFinance.ui.showGoalModal()">
              ➕ Create Goal
            </button>
          </div>
        </div>
      `;
      return;
    }

    goalsGrid.innerHTML = goals.map(goal => {
      const goalType = Models.getGoalType(goal.type);
      const targetAmount = showFutureValue ? goal.futureValue : goal.targetAmount;
      const progress = goal.currentValue / targetAmount * 100;
      const achievability = goal.achievability || 0;
      const isLoanFunded = goal.fundingType === 'loan';
      const hasMonteCarlo = goal.monteCarloResults != null;
      
      // For loan-funded goals, show downpayment as the SIP target
      const sipLabel = isLoanFunded ? 'Save for Downpayment:' : 'Monthly SIP:';
      const sipTarget = isLoanFunded ? goal.downpaymentAmount : null;
      
      // Determine achievability status (simplified binary logic)
      let achievabilityClass = 'green';
      let achievabilityText = 'Sufficient Funds';
      
      // Binary check: 1.0 = sufficient, < 1.0 = insufficient
      if (achievability < 1.0) {
        achievabilityClass = 'red';
        achievabilityText = 'Insufficient Funds';
      }
      
      // If no income data (neutral state 0.5), show pending
      if (achievability === 0.5) {
        achievabilityClass = 'yellow';
        achievabilityText = 'Add Income Data';
      }
      
      // Prepare Monte Carlo display if available
      let monteCarloHTML = '';
      if (hasMonteCarlo) {
        const mc = goal.monteCarloResults;
        monteCarloHTML = `
          <div class="card mt-2" style="background: rgba(16, 185, 129, 0.05); padding: var(--space-2); font-size: var(--font-size-xs);">
            <div style="font-weight: 600; margin-bottom: var(--space-1); color: var(--text-secondary);">
              📊 Projected Outcome Range
            </div>
            <div class="flex justify-between">
              <span class="text-muted">Worst Case (10%):</span>
              <span>${Validators.formatCurrency(mc.percentiles.p10, true)}</span>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-muted">Expected (Median):</span>
              <span class="font-semibold">${Validators.formatCurrency(mc.percentiles.p50, true)}</span>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-muted">Best Case (90%):</span>
              <span>${Validators.formatCurrency(mc.percentiles.p90, true)}</span>
            </div>
            <div class="mt-2" style="font-size: 10px; color: var(--text-muted);">
              Based on ${hasMonteCarlo ? '1000+ simulations' : 'deterministic calculation'}
            </div>
          </div>
        `;
      }

      return `
        <div class="goal-card" data-goal-id="${goal.id}">
          <div class="goal-header">
            <div class="goal-icon ${goal.type}">
              ${goalType.icon}
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              ${isLoanFunded ? '<span class="badge badge-warning" style="font-size: 10px;">🏦 Loan</span>' : ''}
              <div class="achievability" onclick="ProFinance.goals.showTradeoff('${goal.id}')">
                <div class="achievability-light ${achievabilityClass}"></div>
                <span class="achievability-text">${achievabilityText}</span>
              </div>
            </div>
          </div>
          
          <h4 class="goal-title">${goal.name}</h4>
          <div class="goal-target">
            Target: ${Validators.formatCurrency(targetAmount, true)}
            ${showFutureValue ? '<span class="text-muted">(Future)</span>' : '<span class="text-muted">(Today)</span>'}
          </div>
          <div class="goal-timeline" style="font-size: var(--font-size-sm); margin-top: var(--space-1);">
            <span class="text-muted">📅 Target Date:</span> 
            <span class="font-medium">${new Date(goal.targetDate + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
            <span class="text-muted" style="margin-left: var(--space-2);">
              (${this.getTimeRemaining(goal.targetDate)})
            </span>
          </div>
          
          <div class="goal-progress">
            <div class="goal-progress-bar">
              <div class="goal-progress-fill" style="width: ${Math.min(100, progress)}%"></div>
            </div>
            <div class="goal-progress-text">
              <span class="goal-progress-current">${Validators.formatCurrency(goal.currentValue || 0, true)}</span>
              <span class="goal-progress-remaining">${Math.round(progress)}%</span>
            </div>
          </div>
          
          <div class="goal-footer">
            <div class="goal-sip">
              <span class="goal-sip-label">${sipLabel}</span>
              <span class="goal-sip-value">${Validators.formatCurrency(goal.monthlyContribution || 0)}</span>
              ${sipTarget ? `<div class="text-xs text-muted">of ${Validators.formatCurrency(sipTarget, true)} downpayment</div>` : ''}
            </div>
          </div>
          
          ${monteCarloHTML}
          
          ${isLoanFunded ? `
          <div class="card mt-3" style="background: rgba(245, 158, 11, 0.1); padding: var(--space-2); font-size: var(--font-size-xs);">
            <div class="flex justify-between">
              <span class="text-muted">Post-purchase EMI:</span>
              <span class="text-warning font-semibold">${Validators.formatCurrency(goal.projectedEMI || 0)}/mo</span>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-muted">Loan Amount:</span>
              <span>${Validators.formatCurrency(goal.loanAmount || 0, true)}</span>
            </div>
          </div>
          ` : ''}
          
          <div class="mt-4 flex gap-2">
            <button class="btn btn-sm btn-secondary" onclick="ProFinance.goals.edit('${goal.id}')">Edit</button>
            <button class="btn btn-sm btn-outline" onclick="ProFinance.goals.showTradeoff('${goal.id}')">Optimize</button>
            <button class="btn btn-sm btn-outline" style="color: var(--accent-danger); border-color: var(--accent-danger);" onclick="ProFinance.goals.delete('${goal.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('') + `
      <div class="card" style="border: 2px dashed var(--bg-tertiary); display: flex; align-items: center; justify-content: center; min-height: 280px; cursor: pointer;" onclick="ProFinance.ui.showGoalModal()">
        <div class="empty-state" style="padding: 0;">
          <div style="font-size: 2rem; margin-bottom: var(--space-2);">➕</div>
          <h4 class="empty-state-title">Add Another Goal</h4>
        </div>
      </div>
    `;
  },

  /**
   * Update overall probability indicator
   */
  updateProbability(state) {
    const goals = state.goals || [];
    
    if (goals.length === 0) {
      return;
    }

    // Calculate weighted average probability
    const totalWeight = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    const weightedProb = goals.reduce((sum, g) => {
      const weight = (g.targetAmount || 0) / totalWeight;
      return sum + (g.achievability || 0) * weight;
    }, 0);

    const probValue = document.getElementById('probability-value');
    const probRing = document.getElementById('probability-ring');

    if (probValue) {
      probValue.textContent = `${Math.round(weightedProb * 100)}%`;
    }

    if (probRing) {
      const circumference = 2 * Math.PI * 26; // r=26
      const offset = circumference * (1 - weightedProb);
      probRing.style.strokeDashoffset = offset;

      // Update color based on probability
      probRing.classList.remove('high', 'medium', 'low');
      if (weightedProb >= 0.75) {
        probRing.classList.add('high');
      } else if (weightedProb >= 0.5) {
        probRing.classList.add('medium');
      } else {
        probRing.classList.add('low');
      }
    }
  },

  /**
   * Get human-readable time remaining until target date
   */
  getTimeRemaining(targetDate) {
    const target = new Date(targetDate + '-01');
    const now = new Date();
    const diffMs = target - now;
    
    if (diffMs < 0) return 'Overdue';
    
    const months = Math.round(diffMs / (30.44 * 24 * 60 * 60 * 1000));
    
    if (months < 1) return 'This month';
    if (months < 12) return `${months} months left`;
    
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''} left`;
    return `${years}y ${remainingMonths}m left`;
  }
};
