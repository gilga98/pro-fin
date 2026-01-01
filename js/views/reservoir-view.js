/**
 * Pro-Finance Reservoir View
 * Future wealth projections and goal tracking
 */

const ReservoirView = {
  /**
   * Initialize Reservoir view
   */
  init() {
    ProjectionChart.init('projection-chart');
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
    
    // Update projection chart
    ProjectionChart.update(state);
    
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
      
      // For loan-funded goals, show downpayment as the SIP target
      const sipLabel = isLoanFunded ? 'Save for Downpayment:' : 'Monthly SIP:';
      const sipTarget = isLoanFunded ? goal.downpaymentAmount : null;
      
      // Determine achievability status
      let achievabilityClass = 'green';
      let achievabilityText = 'On Track';
      if (achievability < 0.5) {
        achievabilityClass = 'red';
        achievabilityText = 'At Risk';
      } else if (achievability < 0.75) {
        achievabilityClass = 'yellow';
        achievabilityText = 'Needs Attention';
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
            <div class="probability-indicator">
              <div class="probability-ring" style="width: 40px; height: 40px;">
                <svg viewBox="0 0 40 40">
                  <circle class="probability-ring-bg" cx="20" cy="20" r="16" fill="none" stroke-width="3"></circle>
                  <circle class="probability-ring-fill ${achievabilityClass === 'green' ? 'high' : achievabilityClass === 'yellow' ? 'medium' : 'low'}" 
                          cx="20" cy="20" r="16" fill="none" stroke-width="3"
                          stroke-dasharray="100.53" 
                          stroke-dashoffset="${100.53 * (1 - achievability)}"></circle>
                </svg>
                <span class="probability-value" style="font-size: 10px;">${Math.round(achievability * 100)}%</span>
              </div>
            </div>
          </div>
          
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
  }
};
