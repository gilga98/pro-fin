/**
 * Pro-Finance Projection Charts
 * Future wealth and goal projection visualization using ECharts
 */

const ProjectionChart = {
  chart: null,
  container: null,

  /**
   * Initialize the projection chart
   */
  init(containerId) {
    this.containerId = containerId; // Store for potential reinit
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (typeof echarts === 'undefined') {
      console.error('ECharts not loaded');
      return;
    }

    // Dispose existing chart before reinit
    if (this.chart) {
      this.chart.dispose();
    }

    this.chart = echarts.init(this.container, 'dark');

    window.addEventListener('resize', () => {
      this.chart?.resize();
    });
  },

  /**
   * Update chart with projection data
   */
  update(data) {
    // Ensure chart is initialized (handles case when container was hidden)
    if (!this.chart && this.container) {
      this.init(this.container.id);
    }
    
    // If still no chart, container might not exist yet
    if (!this.chart) return;

    // Resize to handle container becoming visible
    this.chart.resize();

    const projectionData = this.generateProjections(data);
    
    if (!projectionData) {
      this.showEmptyState();
      return;
    }

    // Build series based on whether Monte Carlo is used
    const series = [];
    
    if (projectionData.usesMonteCarlo) {
      // Monte Carlo mode: show confidence bands
      series.push(
        // Confidence band (shaded area between p10 and p90)
        {
          name: '80% Confidence Band',
          type: 'line',
          data: projectionData.p90,
          lineStyle: { width: 0, color: 'transparent' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.15)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
              ]
            }
          },
          stack: 'confidence',
          symbol: 'none',
          silent: true
        },
        {
          name: 'Lower Bound',
          type: 'line',
          data: projectionData.p10,
          lineStyle: { width: 0, color: 'transparent' },
          areaStyle: {
            color: '#1f2937'
          },
          stack: 'confidence',
          symbol: 'none',
          silent: true
        },
        // Median projection line
        {
          name: 'Expected Wealth (Median)',
          type: 'line',
          data: projectionData.projected,
          smooth: true,
          lineStyle: { width: 3, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: false,
          z: 10
        },
        // Dashed lines for p10 and p90
        {
          name: 'Best Case (90th %ile)',
          type: 'line',
          data: projectionData.p90,
          lineStyle: { width: 1, type: 'dashed', color: '#34d399' },
          itemStyle: { color: '#34d399' },
          symbol: 'none',
          z: 5
        },
        {
          name: 'Worst Case (10th %ile)',
          type: 'line',
          data: projectionData.p10,
          lineStyle: { width: 1, type: 'dashed', color: '#6ee7b7' },
          itemStyle: { color: '#6ee7b7' },
          symbol: 'none',
          z: 5
        }
      );
    } else {
      // Deterministic mode: single line
      series.push({
        name: 'Projected Wealth',
        type: 'line',
        data: projectionData.projected,
        smooth: true,
        lineStyle: { width: 3, color: '#10b981' },
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false
      });
    }
    
    // Add goal markers
    series.push({
      name: 'Goal Targets',
      type: 'scatter',
      data: projectionData.goalMarkers,
      symbol: 'pin',
      symbolSize: 40,
      itemStyle: { color: '#f59e0b' },
      label: {
        show: true,
        position: 'top',
        color: '#f59e0b',
        fontSize: 10,
        formatter: (params) => params.data.name
      },
      z: 15
    });

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          let html = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach(p => {
            if (p.value !== undefined && p.seriesName !== 'Lower Bound' && p.seriesName !== '80% Confidence Band') {
              html += `${p.marker} ${p.seriesName}: ₹${(p.value / 100000).toFixed(1)}L<br/>`;
            }
          });
          return html;
        }
      },
      legend: {
        data: projectionData.usesMonteCarlo 
          ? ['Expected Wealth (Median)', 'Best Case (90th %ile)', 'Worst Case (10th %ile)', 'Goal Targets']
          : ['Projected Wealth', 'Goal Targets'],
        textStyle: { color: '#9ca3af' },
        bottom: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: projectionData.labels,
        axisLabel: {
          color: '#9ca3af',
          fontSize: 11,
          interval: 'auto'
        },
        axisLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.5)' } }
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLabel: {
          color: '#9ca3af',
          formatter: (value) => {
            if (value >= 10000000) return '₹' + (value / 10000000).toFixed(1) + 'Cr';
            if (value >= 100000) return '₹' + (value / 100000).toFixed(0) + 'L';
            return '₹' + (value / 1000).toFixed(0) + 'K';
          }
        },
        splitLine: { lineStyle: { color: 'rgba(75, 85, 99, 0.3)' } }
      },
      series: series
    };

    this.chart.setOption(option);
  },

  /**
   * Generate projection data from app state
   * Uses Monte Carlo simulations for confidence bands
   * Accounts for: 
   * - Post-goal EMI for loan-funded goals
   * - Fund release after cash-funded goals are achieved
   */
  generateProjections(data) {
    // Calculate total investments
    let totalCurrentValue = 0;

    data.entities?.forEach(entity => {
      entity.assets?.forEach(asset => {
        totalCurrentValue += asset.currentValue || 0;
      });
    });

    // Get all goals sorted by target date
    const goals = (data.goals || []).map(g => ({
      ...g,
      targetDate: new Date(g.targetDate + '-01'),
      monthsAway: Math.round((new Date(g.targetDate + '-01') - new Date()) / (30.44 * 24 * 60 * 60 * 1000))
    })).sort((a, b) => a.targetDate - b.targetDate);

    // Calculate base monthly contribution (before any goals complete)
    let baseMonthlyContribution = goals.reduce((sum, g) => sum + (g.monthlyContribution || 0), 0);

    if (totalCurrentValue === 0 && baseMonthlyContribution === 0) {
      return null;
    }

    // Calculate projection for 10 years with timeline events
    const years = 10;
    const totalMonths = years * 12;
    const monthLabels = [];
    const now = new Date();
    
    // Generate month labels (every 6 months)
    for (let m = 0; m <= totalMonths; m += 6) {
      const date = new Date(now);
      date.setMonth(now.getMonth() + m);
      monthLabels.push(date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
    }

    // Build timeline events
    const events = [];
    goals.forEach(goal => {
      // Goal completion event
      if (goal.monthsAway > 0 && goal.monthsAway <= totalMonths) {
        events.push({
          month: goal.monthsAway,
          type: goal.fundingType === 'loan' ? 'loan_goal_complete' : 'cash_goal_complete',
          goal: goal,
          sipRelease: goal.monthlyContribution || 0,
          emiStart: goal.fundingType === 'loan' ? (goal.projectedEMI || 0) : 0
        });
      }
    });
    
    // Sort events by month
    events.sort((a, b) => a.month - b.month);

    // Get expected return and volatility from configuration
    const expectedReturn = (data.configuration?.expectedReturn || 10);
    const monteCarloEnabled = data.configuration?.monteCarlo?.enabled !== false && typeof MonteCarlo !== 'undefined';
    
    // Get average volatility from portfolio
    let portfolioVolatility = 15; // Default
    if (goals.length > 0) {
      const volatilities = goals.map(g => g.monteCarloResults?.volatility || 15);
      portfolioVolatility = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;
    }

    const projectionPoints = monthLabels.length;
    const projected = [];
    const p10Data = [];
    const p90Data = [];
    
    // If Monte Carlo is enabled, generate confidence bands
    if (monteCarloEnabled) {
      let currentValue = totalCurrentValue;
      let monthlyContrib = baseMonthlyContribution;
      let monthlyEMI = 0;
      
      for (let i = 0; i < projectionPoints; i++) {
        const currentMonth = i * 6;
        
        // Apply events
        events.forEach(evt => {
          if (evt.month <= currentMonth && !evt.applied) {
            if (evt.type === 'loan_goal_complete') {
              monthlyContrib -= evt.sipRelease;
              monthlyEMI += evt.emiStart;
            } else if (evt.type === 'cash_goal_complete') {
              monthlyContrib -= evt.sipRelease;
              currentValue += evt.sipRelease * 6;
            }
            evt.applied = true;
          }
        });
        
        const netMonthlyContrib = Math.max(0, monthlyContrib - monthlyEMI);
        
        // Run Monte Carlo simulation for this time point
        try {
          const mcResults = MonteCarlo.simulateGoal({
            currentAmount: totalCurrentValue,
            monthlyContribution: netMonthlyContrib,
            expectedReturn: expectedReturn,
            volatility: portfolioVolatility,
            years: currentMonth / 12,
            targetAmount: 0, // Not checking target, just projecting
            iterations: 200 // Lighter for multiple data points
          });
          
          projected.push(mcResults.percentiles.p50);
          p10Data.push(mcResults.percentiles.p10);
          p90Data.push(mcResults.percentiles.p90);
          
        } catch (error) {
          // Fallback to deterministic
          const monthlyReturn = expectedReturn / 100 / 12;
          const monthsOfGrowth = currentMonth;
          const invested = totalCurrentValue + (netMonthlyContrib * monthsOfGrowth);
          const growthFactor = Math.pow(1 + monthlyReturn, monthsOfGrowth);
          const value = Math.round(invested * growthFactor);
          
          projected.push(value);
          p10Data.push(Math.round(value * 0.8)); // Approximate
          p90Data.push(Math.round(value * 1.2));
        }
        
        currentValue = projected[projected.length - 1];
      }
    } else {
      // Deterministic projection (original logic)
      let currentValue = totalCurrentValue;
      let monthlyContrib = baseMonthlyContribution;
      let monthlyEMI = 0;
      const monthlyReturn = expectedReturn / 100 / 12;
      
      for (let i = 0; i < projectionPoints; i++) {
        const currentMonth = i * 6;
        
        // Apply events
        events.forEach(evt => {
          if (evt.month <= currentMonth && !evt.applied) {
            if (evt.type === 'loan_goal_complete') {
              monthlyContrib -= evt.sipRelease;
              monthlyEMI += evt.emiStart;
            } else if (evt.type === 'cash_goal_complete') {
              monthlyContrib -= evt.sipRelease;
              currentValue += evt.sipRelease * 6;
            }
            evt.applied = true;
          }
        });
        
        const netMonthlyContrib = Math.max(0, monthlyContrib - monthlyEMI);
        const monthsOfGrowth = currentMonth;
        const invested = totalCurrentValue + (netMonthlyContrib * monthsOfGrowth);
        const growthFactor = Math.pow(1 + monthlyReturn, monthsOfGrowth);
        const projectedValue = Math.round(invested * growthFactor);
        
        projected.push(projectedValue);
        p10Data.push(projectedValue); // No variation in deterministic mode
        p90Data.push(projectedValue);
        
        currentValue = projectedValue;
      }
    }

    // Add goal markers
    const goalMarkers = [];
    goals.forEach(goal => {
      const labelIndex = Math.min(
        Math.floor(goal.monthsAway / 6),
        monthLabels.length - 1
      );
      
      if (labelIndex >= 0 && labelIndex < monthLabels.length) {
        goalMarkers.push({
          value: [monthLabels[labelIndex], goal.futureValue || goal.targetAmount],
          name: `${goal.name}${goal.fundingType === 'loan' ? ' (Loan)' : ''}`
        });
      }
    });

    return {
      labels: monthLabels,
      projected,
      p10: p10Data,
      p90: p90Data,
      goalMarkers,
      usesMonteCarlo: monteCarloEnabled
    };
  },

  /**
   * Show empty state
   */
  showEmptyState() {
    if (this.chart) this.chart.clear();
    
    this.container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-12);">
        <div class="empty-state-icon">📈</div>
        <h4 class="empty-state-title">No Projections Yet</h4>
        <p class="empty-state-text">Add goals and assets to see wealth projections</p>
        <button class="btn btn-primary" onclick="ProFinance.ui.showGoalModal()">
          Create Your First Goal
        </button>
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

/**
 * Goal-specific mini charts
 */
const GoalCharts = {
  charts: new Map(),

  /**
   * Create a mini projection chart for a goal
   */
  createGoalChart(containerId, goal) {
    const container = document.getElementById(containerId);
    if (!container || typeof echarts === 'undefined') return;

    const chart = echarts.init(container, 'dark');
    this.charts.set(containerId, chart);

    const targetDate = new Date(goal.targetDate + '-01');
    const now = new Date();
    const years = Math.max(1, (targetDate - now) / (365.25 * 24 * 60 * 60 * 1000));

    const projection = MonteCarlo.generateProjectionData({
      currentAmount: goal.currentValue || 0,
      monthlyContribution: goal.monthlyContribution || 0,
      expectedReturn: 12,
      volatility: 15,
      years,
      iterations: 50
    });

    const option = {
      backgroundColor: 'transparent',
      grid: {
        left: 5,
        right: 5,
        top: 5,
        bottom: 5
      },
      xAxis: {
        type: 'category',
        data: projection.labels,
        show: false
      },
      yAxis: {
        type: 'value',
        show: false
      },
      series: [
        {
          type: 'line',
          data: projection.p50,
          smooth: true,
          lineStyle: { width: 2, color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
              ]
            }
          },
          symbol: 'none',
          markLine: {
            silent: true,
            symbol: 'none',
            data: [{
              yAxis: goal.futureValue || goal.targetAmount,
              lineStyle: { color: '#f59e0b', type: 'dashed', width: 2 }
            }]
          }
        }
      ]
    };

    chart.setOption(option);
  },

  /**
   * Resize all goal charts
   */
  resizeAll() {
    this.charts.forEach(chart => chart.resize());
  },

  /**
   * Destroy a specific chart
   */
  destroy(containerId) {
    const chart = this.charts.get(containerId);
    if (chart) {
      chart.dispose();
      this.charts.delete(containerId);
    }
  },

  /**
   * Destroy all charts
   */
  destroyAll() {
    this.charts.forEach(chart => chart.dispose());
    this.charts.clear();
  }
};
