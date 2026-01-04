/**
 * Pro-Finance Sankey Chart
 * Money flow visualization using ECharts
 */

const SankeyChart = {
  chart: null,
  container: null,

  /**
   * Initialize the Sankey chart
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    
    // Check if echarts is loaded
    if (typeof echarts === 'undefined') {
      console.error('ECharts not loaded');
      return;
    }

    this.chart = echarts.init(this.container, 'dark');
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.chart?.resize();
    });
  },

  /**
   * Update chart with current data
   */
  update(data) {
    if (!this.chart) {
      console.warn('Sankey chart not initialized');
      return;
    }

    const { nodes, links } = this.transformData(data);

    if (nodes.length === 0 || links.length === 0) {
      this.showEmptyState();
      return;
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          if (params.dataType === 'edge') {
            return `${params.data.source} → ${params.data.target}<br/>
                    <strong>₹${params.data.value.toLocaleString('en-IN')}</strong>`;
          }
          return `${params.name}<br/>
                  <strong>₹${params.value.toLocaleString('en-IN')}</strong>`;
        }
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: {
            focus: 'adjacency'
          },
          nodeAlign: 'justify',
          orient: 'horizontal',
          draggable: true,
          nodeWidth: 12, // Slightly wider for better touch
          nodeGap: 15, // Normal gap
          layoutIterations: 64,
          // Refined spacing
          left: '5%',
          right: '25%', 
          top: '5%',
          bottom: '15%', // 15% is usually enough if div height is good
          data: nodes,
          links: links,
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.6
          },
          label: {
            position: 'right',
            color: '#f9fafb',
            fontSize: 10,
            fontFamily: 'Inter, sans-serif',
            formatter: (params) => {
              return `${params.name}\n₹${Math.round(params.value / 1000)}K`;
            }
          },
          itemStyle: {
            borderWidth: 0
          }
        }
      ]
    };

    this.chart.setOption(option);
    
    // Show warning if goals exceed capacity
    if (this.overcommitted && this.overcommittedAmount > 0) {
      this.showOvercommittedWarning();
    } else {
      this.hideOvercommittedWarning();
    }
  },
  
  /**
   * Show warning when goals exceed available funds
   */
  showOvercommittedWarning() {
    let warningEl = document.getElementById('sankey-warning');
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'sankey-warning';
      warningEl.style.cssText = `
        margin-top: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: rgba(239, 68, 68, 0.15);
        border-left: 3px solid var(--accent-danger);
        border-radius: var(--radius-lg);
        font-size: var(--font-size-sm);
        color: var(--accent-danger);
      `;
      this.container.parentNode.appendChild(warningEl);
    }
    warningEl.innerHTML = `
      ⚠️ <strong>Goals exceed capacity:</strong> Your goal SIPs are ₹${this.overcommittedAmount.toLocaleString('en-IN')}/mo more than available funds. 
      Consider reducing goals or increasing income.
    `;
    warningEl.style.display = 'block';
  },
  
  /**
   * Hide overcommitted warning
   */
  hideOvercommittedWarning() {
    const warningEl = document.getElementById('sankey-warning');
    if (warningEl) {
      warningEl.style.display = 'none';
    }
  },

  /**
   * Transform app data to Sankey format
   */
  transformData(data) {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // Helper to add node if not exists
    const addNode = (name, color) => {
      if (!nodeMap.has(name)) {
        nodeMap.set(name, { name, itemStyle: { color } });
        nodes.push(nodeMap.get(name));
      }
    };

    // Calculate totals from all entities
    let grossIncome = 0;
    let totalTax = 0;
    let totalExpenses = 0;
    let totalGoalSIPs = 0;
    let totalEMI = 0;

    // Process entities
    data.entities?.forEach(entity => {
      // Income
      entity.incomeStreams?.forEach(income => {
        grossIncome += income.amount;
        addNode(income.name, '#10b981');
        links.push({
          source: income.name,
          target: 'Gross Income',
          value: income.amount
        });
      });

      // Expenses by category
      entity.expenses?.forEach(expense => {
        totalExpenses += expense.amount;
      });

      // EMI from liabilities
      entity.liabilities?.forEach(liability => {
        totalEMI += liability.emi;
      });
    });

    // Calculate tax (simplified)
    if (grossIncome > 0) {
      const annualIncome = grossIncome * 12;
      const taxResult = TaxCalculator.calculateTax({
        grossIncome: annualIncome,
        regime: data.configuration?.taxRegime || 'new'
      });
      totalTax = taxResult.monthlyTax;
    }

    // Goal SIPs
    data.goals?.forEach(goal => {
      totalGoalSIPs += goal.monthlyContribution || 0;
    });

    // Calculate net income and available funds
    const netIncome = grossIncome - totalTax;
    const availableForGoals = Math.max(0, netIncome - totalExpenses - totalEMI);
    
    // CAP goal SIPs to available funds to prevent negative flows
    const cappedGoalSIPs = Math.min(totalGoalSIPs, availableForGoals);
    const overcommitted = totalGoalSIPs > availableForGoals;
    
    // Calculate dispensable with capped SIPs
    const dispensable = Math.max(0, availableForGoals - cappedGoalSIPs);

    // Only create flow if we have income
    if (grossIncome > 0) {
      addNode('Gross Income', '#10b981');
      
      if (totalTax > 0) {
        addNode('Income Tax', '#ef4444');
        links.push({ source: 'Gross Income', target: 'Income Tax', value: totalTax });
      }

      addNode('Net Income', '#3b82f6');
      links.push({ source: 'Gross Income', target: 'Net Income', value: netIncome });

      if (totalExpenses > 0) {
        addNode('Fixed Expenses', '#f59e0b');
        links.push({ source: 'Net Income', target: 'Fixed Expenses', value: totalExpenses });
      }

      if (totalEMI > 0) {
        addNode('Loan EMI', '#ef4444');
        links.push({ source: 'Net Income', target: 'Loan EMI', value: totalEMI });
      }

      if (cappedGoalSIPs > 0) {
        // Show warning color if overcommitted
        const goalColor = overcommitted ? '#ef4444' : '#8b5cf6';
        addNode('Goal Investments', goalColor);
        links.push({ source: 'Net Income', target: 'Goal Investments', value: cappedGoalSIPs });

        // Break down by goal (proportionally reduced if overcommitted)
        const reductionRatio = overcommitted ? availableForGoals / totalGoalSIPs : 1;
        data.goals?.forEach(goal => {
          if (goal.monthlyContribution > 0) {
            const goalInfo = Models.getGoalType(goal.type);
            const actualAllocation = Math.round(goal.monthlyContribution * reductionRatio);
            if (actualAllocation > 0) {
              addNode(goal.name, goalInfo.color);
              links.push({ 
                source: 'Goal Investments', 
                target: goal.name, 
                value: actualAllocation 
              });
            }
          }
        });
      }

      if (dispensable > 0) {
        addNode('Dispensable', '#06b6d4');
        links.push({ source: 'Net Income', target: 'Dispensable', value: dispensable });
      }
    }
    
    // Store overcommitted state for warning display
    this.overcommitted = overcommitted;
    this.overcommittedAmount = overcommitted ? totalGoalSIPs - availableForGoals : 0;

    return { nodes, links };
  },

  /**
   * Show empty state
   */
  showEmptyState() {
    if (this.chart) {
      this.chart.clear();
    }

    const emptyHtml = `
      <div class="empty-state">
        <div class="empty-state-icon">🌊</div>
        <h4 class="empty-state-title">No Income Data Yet</h4>
        <p class="empty-state-text">Add your income and expenses to see the money flow</p>
        <button class="btn btn-primary" onclick="ProFinance.ui.showAddDataModal('income')">
          Add Income Source
        </button>
      </div>
    `;

    this.container.innerHTML = emptyHtml;
  },

  /**
   * Resize chart
   */
  resize() {
    this.chart?.resize();
  },

  /**
   * Destroy chart
   */
  destroy() {
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  }
};
