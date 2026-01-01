/**
 * Pro-Finance Waterfall Chart
 * Monthly breakdown visualization using ECharts
 */

const WaterfallChart = {
  chart: null,
  container: null,

  /**
   * Initialize the waterfall chart
   */
  init(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (typeof echarts === 'undefined') {
      console.error('ECharts not loaded');
      return;
    }

    this.chart = echarts.init(this.container, 'dark');

    window.addEventListener('resize', () => {
      this.chart?.resize();
    });
  },

  /**
   * Update chart with current data
   */
  update(data) {
    if (!this.chart) return;

    const breakdown = this.calculateBreakdown(data);
    
    if (breakdown.length === 0) {
      this.showEmptyState();
      return;
    }

    const categories = breakdown.map(b => b.name);
    const values = breakdown.map(b => b.value);
    const colors = breakdown.map(b => b.color);

    // Calculate running totals for waterfall effect
    const placeholders = [];
    const increases = [];
    const decreases = [];
    let runningTotal = 0;

    breakdown.forEach((item, index) => {
      if (item.type === 'increase') {
        placeholders.push(runningTotal);
        increases.push(item.value);
        decreases.push(0);
        runningTotal += item.value;
      } else if (item.type === 'decrease') {
        runningTotal -= item.value;
        placeholders.push(runningTotal);
        increases.push(0);
        decreases.push(item.value);
      } else { // total
        placeholders.push(0);
        increases.push(item.value);
        decreases.push(0);
      }
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const item = breakdown[params[0].dataIndex];
          const sign = item.type === 'decrease' ? '-' : '+';
          return `${item.name}<br/>
                  <strong>${sign}₹${Math.abs(item.value).toLocaleString('en-IN')}</strong>`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          interval: 0,
          rotate: 30
        },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#9ca3af',
          formatter: (value) => {
            if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
            if (value >= 1000) return '₹' + (value / 1000).toFixed(0) + 'K';
            return '₹' + value;
          }
        },
        splitLine: {
          lineStyle: { color: 'rgba(75, 85, 99, 0.3)' }
        }
      },
      series: [
        {
          name: 'Placeholder',
          type: 'bar',
          stack: 'Total',
          itemStyle: {
            borderColor: 'transparent',
            color: 'transparent'
          },
          emphasis: {
            itemStyle: { borderColor: 'transparent', color: 'transparent' }
          },
          data: placeholders
        },
        {
          name: 'Increase',
          type: 'bar',
          stack: 'Total',
          barWidth: '60%',
          label: {
            show: true,
            position: 'top',
            color: '#f9fafb',
            fontSize: 11,
            formatter: (params) => {
              if (params.value === 0) return '';
              return '+₹' + (params.value / 1000).toFixed(0) + 'K';
            }
          },
          itemStyle: {
            color: (params) => {
              const item = breakdown[params.dataIndex];
              if (item.type === 'total') return '#3b82f6';
              return '#10b981';
            },
            borderRadius: [4, 4, 0, 0]
          },
          data: increases
        },
        {
          name: 'Decrease',
          type: 'bar',
          stack: 'Total',
          barWidth: '60%',
          label: {
            show: true,
            position: 'bottom',
            color: '#f9fafb',
            fontSize: 11,
            formatter: (params) => {
              if (params.value === 0) return '';
              return '-₹' + (params.value / 1000).toFixed(0) + 'K';
            }
          },
          itemStyle: {
            color: '#ef4444',
            borderRadius: [0, 0, 4, 4]
          },
          data: decreases
        }
      ]
    };

    this.chart.setOption(option);
  },

  /**
   * Calculate breakdown from app data
   */
  calculateBreakdown(data) {
    const breakdown = [];
    
    // Calculate totals
    let grossIncome = 0;
    let totalTax = 0;
    let mandatoryRetirement = 0;
    let fixedExpenses = 0;
    let variableExpenses = 0;
    let totalEMI = 0;
    let goalSIPs = 0;

    // Process entities
    data.entities?.forEach(entity => {
      entity.incomeStreams?.forEach(income => {
        grossIncome += income.amount;
      });

      entity.expenses?.forEach(expense => {
        if (expense.type === 'fixed') {
          fixedExpenses += expense.amount;
        } else {
          variableExpenses += expense.amount;
        }
      });

      entity.liabilities?.forEach(liability => {
        totalEMI += liability.emi;
      });

      // Check for EPF in assets (mandatory deduction)
      entity.assets?.forEach(asset => {
        if (asset.assetType === 'epf') {
          // Assume 12% employer contribution
          mandatoryRetirement += grossIncome * 0.12;
        }
      });
    });

    // Calculate tax
    if (grossIncome > 0) {
      const taxResult = TaxCalculator.calculateTax({
        grossIncome: grossIncome * 12,
        regime: data.configuration?.taxRegime || 'new'
      });
      totalTax = taxResult.monthlyTax;
    }

    // Goal SIPs
    data.goals?.forEach(goal => {
      goalSIPs += goal.monthlyContribution || 0;
    });

    if (grossIncome === 0) return [];

    // Build breakdown
    breakdown.push({
      name: 'Gross Income',
      value: grossIncome,
      type: 'increase',
      color: '#10b981'
    });

    if (totalTax > 0) {
      breakdown.push({
        name: 'Income Tax',
        value: totalTax,
        type: 'decrease',
        color: '#ef4444'
      });
    }

    if (mandatoryRetirement > 0) {
      breakdown.push({
        name: 'EPF/Retirement',
        value: mandatoryRetirement,
        type: 'decrease',
        color: '#8b5cf6'
      });
    }

    if (fixedExpenses > 0) {
      breakdown.push({
        name: 'Fixed Expenses',
        value: fixedExpenses,
        type: 'decrease',
        color: '#f59e0b'
      });
    }

    if (totalEMI > 0) {
      breakdown.push({
        name: 'Loan EMI',
        value: totalEMI,
        type: 'decrease',
        color: '#ef4444'
      });
    }

    if (goalSIPs > 0) {
      breakdown.push({
        name: 'Goal SIPs',
        value: goalSIPs,
        type: 'decrease',
        color: '#8b5cf6'
      });
    }

    // Calculate dispensable (what's left)
    const dispensable = grossIncome - totalTax - mandatoryRetirement - 
                        fixedExpenses - totalEMI - goalSIPs;

    if (dispensable > 0) {
      breakdown.push({
        name: 'Dispensable',
        value: dispensable,
        type: 'total',
        color: '#3b82f6'
      });
    }

    return breakdown;
  },

  /**
   * Show empty state
   */
  showEmptyState() {
    if (this.chart) this.chart.clear();
    
    this.container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-8);">
        <div class="empty-state-icon">📊</div>
        <h4 class="empty-state-title">No Data Yet</h4>
        <p class="empty-state-text">Add income data to see the breakdown</p>
      </div>
    `;
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
