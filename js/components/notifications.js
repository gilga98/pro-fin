/**
 * Pro-Finance Notifications Component
 * Toast notifications and life event alerts
 */

const Notifications = {
  container: null,
  toastTimeout: 5000,

  /**
   * Initialize notifications
   */
  init() {
    this.container = document.getElementById('toast-container');
  },

  /**
   * Show a toast notification
   */
  show(options) {
    const {
      type = 'info', // success, warning, error, info
      title = '',
      message = '',
      duration = this.toastTimeout,
      persistent = false
    } = options;

    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    this.container.appendChild(toast);

    // Auto-remove after duration
    if (!persistent) {
      setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  },

  /**
   * Show success notification
   */
  success(title, message = '') {
    return this.show({ type: 'success', title, message });
  },

  /**
   * Show warning notification
   */
  warning(title, message = '') {
    return this.show({ type: 'warning', title, message });
  },

  /**
   * Show error notification
   */
  error(title, message = '') {
    return this.show({ type: 'error', title, message });
  },

  /**
   * Show info notification
   */
  info(title, message = '') {
    return this.show({ type: 'info', title, message });
  },

  /**
   * Show life event modal (salary hike)
   */
  showSalaryHikeEvent(data) {
    const { amount } = data;
    
    // Calculate what the hike could do
    const goals = Store.get('goals') || [];
    const priorityGoal = goals.sort((a, b) => a.priority - b.priority)[0];

    if (priorityGoal) {
      // Calculate months acceleration
      const monthlyRate = 0.12 / 12;
      const target = priorityGoal.futureValue || priorityGoal.targetAmount;
      const current = priorityGoal.currentValue || 0;
      const currentSIP = priorityGoal.monthlyContribution || 0;

      // Months with current SIP
      let monthsNow = 0;
      let value = current;
      while (value < target && monthsNow < 600) {
        value = value * (1 + monthlyRate) + currentSIP;
        monthsNow++;
      }

      // Months with increased SIP
      let monthsNew = 0;
      value = current;
      while (value < target && monthsNew < 600) {
        value = value * (1 + monthlyRate) + currentSIP + amount;
        monthsNew++;
      }

      const monthsSaved = monthsNow - monthsNew;

      // Update modal content
      document.getElementById('hike-amount').textContent = Validators.formatCurrency(amount);
      document.getElementById('accelerate-goal').textContent = priorityGoal.name;
      document.getElementById('accelerate-months').textContent = `${monthsSaved} months`;
      document.getElementById('lifestyle-amount').textContent = Validators.formatCurrency(amount);
    }

    // Store the hike data for later
    ProFinance.lifeEvents.currentHike = { amount };

    // Show the modal
    ProFinance.ui.showModal('life-event-modal');
  },

  /**
   * Show tax bracket change notification
   */
  showTaxBracketChange(data) {
    const { previousBracket, newBracket, suggestion } = data;
    
    this.warning(
      `Tax Bracket Change: ${previousBracket}% → ${newBracket}%`,
      suggestion
    );
  },

  /**
   * Show LTCG harvesting reminder
   */
  showHarvestingReminder(data) {
    const { harvestingOpportunity, taxSaved } = data;
    
    this.info(
      '📊 Tax Harvesting Opportunity',
      `You can realize ₹${harvestingOpportunity.toLocaleString('en-IN')} in gains to save ₹${taxSaved.toLocaleString('en-IN')} in taxes before FY end.`
    );
  },

  /**
   * Toggle notification panel (could be expanded)
   */
  toggle() {
    const notifications = Store.get('notifications') || [];
    
    if (notifications.length === 0) {
      this.info('No Notifications', 'You\'re all caught up!');
      return;
    }

    // Show recent notifications
    const recent = notifications.slice(0, 5);
    recent.forEach(n => {
      if (!n.read) {
        this.show({
          type: n.type,
          title: n.title,
          message: n.message
        });
      }
    });

    // Mark as read
    notifications.forEach(n => n.read = true);
    Store.set('notifications', notifications);
    this.updateBadge();
  },

  /**
   * Update notification badge count
   */
  updateBadge() {
    const notifications = Store.get('notifications') || [];
    const unread = notifications.filter(n => !n.read).length;
    
    const badge = document.getElementById('notification-count');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }
};

/**
 * Life Events Handler
 */
const LifeEvents = {
  currentHike: null,

  /**
   * Handle salary hike option selection
   */
  selectOption(option) {
    if (!this.currentHike) return;

    const { amount } = this.currentHike;
    const goals = Store.get('goals') || [];
    const priorityGoal = goals.sort((a, b) => a.priority - b.priority)[0];

    switch (option) {
      case 'accelerate':
        if (priorityGoal) {
          priorityGoal.monthlyContribution = (priorityGoal.monthlyContribution || 0) + amount;
          Store.updateGoal(priorityGoal.id, priorityGoal);
          Notifications.success(
            'Goal Accelerated! 🚀',
            `Added ₹${amount.toLocaleString('en-IN')}/month to ${priorityGoal.name}`
          );
        }
        break;

      case 'lifestyle':
        // Just notify - the extra goes to dispensable by default
        Notifications.success(
          'Lifestyle Upgraded! 🎉',
          `Enjoy your extra ₹${amount.toLocaleString('en-IN')}/month`
        );
        break;

      case 'split':
        const halfAmount = Math.round(amount / 2);
        if (priorityGoal) {
          priorityGoal.monthlyContribution = (priorityGoal.monthlyContribution || 0) + halfAmount;
          Store.updateGoal(priorityGoal.id, priorityGoal);
          Notifications.success(
            'Balanced Approach! ⚖️',
            `₹${halfAmount.toLocaleString('en-IN')} to goals, ₹${halfAmount.toLocaleString('en-IN')} to lifestyle`
          );
        }
        break;
    }

    this.currentHike = null;
    ProFinance.ui.closeModal('life-event-modal');
    ProFinance.refresh();
  }
};
