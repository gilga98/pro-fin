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
   * Update chart with projection data
   */
  update(data) {
    if (!this.chart) return;

    const projectionData = this.generateProjections(data);
    
    if (!projectionData) {
      this.showEmptyState();
      return;
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          let html = `<strong>${params[0].axisValue}</strong><br/>`;
          params.forEach(p => {
            if (p.value !== undefined) {
              html += `${p.marker} ${p.seriesName}: ₹${(p.value / 100000).toFixed(1)}L<br/>`;
            }
          });
          return html;
        }
      },
      legend: {
        data: ['10th Percentile', 'Median (50th)', '90th Percentile', 'Goal Targets'],
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
      series: [
        {
          name: '10th Percentile',
          type: 'line',
          data: projectionData.p10,
          smooth: true,
          lineStyle: { width: 1, type: 'dashed', color: '#ef4444' },
          itemStyle: { color: '#ef4444' },
          areaStyle: null,
          symbol: 'none'
        },
        {
          name: 'Median (50th)',
          type: 'line',
          data: projectionData.p50,
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
        },
        {
          name: '90th Percentile',
          type: 'line',
          data: projectionData.p90,
          smooth: true,
          lineStyle: { width: 1, type: 'dashed', color: '#8b5cf6' },
          itemStyle: { color: '#8b5cf6' },
          areaStyle: null,
          symbol: 'none'
        },
        {
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
          }
        }
      ]
    };

    this.chart.setOption(option);
  },

  /**
   * Generate projection data from app state
   */
  generateProjections(data) {
    // Calculate total investments and contributions
    let totalCurrentValue = 0;
    let totalMonthlyContribution = 0;

    data.entities?.forEach(entity => {
      entity.assets?.forEach(asset => {
        totalCurrentValue += asset.currentValue || 0;
      });
    });

    data.goals?.forEach(goal => {
      totalMonthlyContribution += goal.monthlyContribution || 0;
    });

    if (totalCurrentValue === 0 && totalMonthlyContribution === 0) {
      return null;
    }

    // Calculate projection for 10 years
    const years = 10;
    const projection = MonteCarlo.generateProjectionData({
      currentAmount: totalCurrentValue,
      monthlyContribution: totalMonthlyContribution,
      expectedReturn: 12,
      volatility: 15,
      years,
      iterations: 100
    });

    // Add goal markers
    const goalMarkers = [];
    data.goals?.forEach(goal => {
      const targetDate = new Date(goal.targetDate + '-01');
      const now = new Date();
      const monthsAway = Math.round((targetDate - now) / (30.44 * 24 * 60 * 60 * 1000));
      
      // Find the closest label index
      const labelIndex = Math.min(
        Math.floor(monthsAway / (years * 12 / projection.labels.length)),
        projection.labels.length - 1
      );
      
      if (labelIndex >= 0 && labelIndex < projection.labels.length) {
        goalMarkers.push({
          value: [projection.labels[labelIndex], goal.futureValue || goal.targetAmount],
          name: goal.name
        });
      }
    });

    return {
      labels: projection.labels,
      p10: projection.p10,
      p50: projection.p50,
      p90: projection.p90,
      goalMarkers
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
