/**
 * Pro-Finance Monte Carlo Simulation Engine
 * Runs probabilistic simulations for goal achievability
 */

const MonteCarlo = {
  /**
   * Simulate goal achievability with Monte Carlo method
   */
  simulateGoal(params) {
    const {
      currentAmount = 0,
      monthlyContribution = 0,
      expectedReturn = 12,
      volatility = 15,
      years = 5,
      targetAmount = 0,
      iterations = 1000
    } = params;

    const results = [];
    const annualReturn = expectedReturn / 100;
    const annualVolatility = volatility / 100;
    const months = Math.round(years * 12);

    // Run simulations
    for (let i = 0; i < iterations; i++) {
      let portfolio = currentAmount;
      
      for (let month = 0; month < months; month++) {
        // Generate monthly return with volatility
        const monthlyReturn = this.generateMonthlyReturn(annualReturn, annualVolatility);
        
        // Apply return to existing portfolio
        portfolio = portfolio * (1 + monthlyReturn);
        
        // Add monthly contribution
        portfolio += monthlyContribution;
      }
      
      results.push(portfolio);
    }

    // Sort results for percentile calculation
    results.sort((a, b) => a - b);

    // Calculate statistics
    const successCount = results.filter(r => r >= targetAmount).length;
    const probability = successCount / iterations;

    return {
      probability: Math.round(probability * 100) / 100,
      percentiles: {
        p10: Math.round(results[Math.floor(iterations * 0.1)]),
        p25: Math.round(results[Math.floor(iterations * 0.25)]),
        p50: Math.round(results[Math.floor(iterations * 0.5)]),
        p75: Math.round(results[Math.floor(iterations * 0.75)]),
        p90: Math.round(results[Math.floor(iterations * 0.9)])
      },
      mean: Math.round(results.reduce((a, b) => a + b, 0) / iterations),
      min: Math.round(results[0]),
      max: Math.round(results[iterations - 1])
    };
  },

  /**
   * Generate monthly return using normal distribution
   */
  generateMonthlyReturn(annualReturn, annualVolatility) {
    // Convert annual to monthly
    const monthlyReturn = annualReturn / 12;
    const monthlyVolatility = annualVolatility / Math.sqrt(12);
    
    // Use Box-Muller transform for normal distribution
    // Or use jStat if available
    if (typeof jStat !== 'undefined') {
      return jStat.normal.sample(monthlyReturn, monthlyVolatility);
    }
    
    // Fallback: Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    return monthlyReturn + z * monthlyVolatility;
  },

  /**
   * Simulate multiple asset portfolio
   */
  simulatePortfolio(assets, years, iterations = 1000) {
    const results = [];
    const months = Math.round(years * 12);
    
    for (let i = 0; i < iterations; i++) {
      let totalValue = 0;
      
      // Simulate each asset
      for (const asset of assets) {
        let value = asset.currentValue;
        const monthlyContribution = asset.monthlyContribution || 0;
        const annualReturn = (asset.expectedReturn || 10) / 100;
        const annualVolatility = (asset.volatility || 15) / 100;
        
        for (let month = 0; month < months; month++) {
          const monthlyReturn = this.generateMonthlyReturn(annualReturn, annualVolatility);
          value = value * (1 + monthlyReturn) + monthlyContribution;
        }
        
        totalValue += value;
      }
      
      results.push(totalValue);
    }
    
    results.sort((a, b) => a - b);
    
    return {
      percentiles: {
        p10: Math.round(results[Math.floor(iterations * 0.1)]),
        p50: Math.round(results[Math.floor(iterations * 0.5)]),
        p90: Math.round(results[Math.floor(iterations * 0.9)])
      },
      mean: Math.round(results.reduce((a, b) => a + b, 0) / iterations)
    };
  },

  /**
   * Calculate years to target with given parameters
   */
  calculateYearsToTarget(params) {
    const {
      currentAmount = 0,
      monthlyContribution = 0,
      expectedReturn = 12,
      targetAmount = 1000000
    } = params;
    
    const monthlyRate = (expectedReturn / 100) / 12;
    let months = 0;
    let value = currentAmount;
    
    // Iterate month by month until target is reached
    while (value < targetAmount && months < 600) { // Max 50 years
      value = value * (1 + monthlyRate) + monthlyContribution;
      months++;
    }
    
    return months < 600 ? months : null;
  },

  /**
   * Calculate required monthly SIP to reach target
   */
  calculateRequiredSIP(params) {
    const {
      currentAmount = 0,
      expectedReturn = 12,
      targetAmount = 1000000,
      years = 5
    } = params;
    
    const monthlyRate = (expectedReturn / 100) / 12;
    const months = years * 12;
    
    // Future value of current amount
    const fvCurrent = currentAmount * Math.pow(1 + monthlyRate, months);
    
    // Remaining amount needed
    const remaining = targetAmount - fvCurrent;
    
    if (remaining <= 0) return 0;
    
    // Required SIP (annuity formula)
    const sip = remaining * monthlyRate / (Math.pow(1 + monthlyRate, months) - 1);
    
    return Math.max(0, Math.round(sip));
  },

  /**
   * Calculate windfall impact (butterfly effect)
   */
  calculateWindfallImpact(params) {
    const {
      windfall = 0,
      currentMonthlyContribution = 0,
      expectedReturn = 12,
      targetAmount = 1000000,
      currentProgress = 0
    } = params;
    
    // Calculate months to target with current contribution
    const monthsWithoutWindfall = this.calculateYearsToTarget({
      currentAmount: currentProgress,
      monthlyContribution: currentMonthlyContribution,
      expectedReturn,
      targetAmount
    });
    
    // Calculate months with windfall invested
    const monthsWithWindfall = this.calculateYearsToTarget({
      currentAmount: currentProgress + windfall,
      monthlyContribution: currentMonthlyContribution,
      expectedReturn,
      targetAmount
    });
    
    if (!monthsWithoutWindfall || !monthsWithWindfall) {
      return null;
    }
    
    return {
      monthsSaved: monthsWithoutWindfall - monthsWithWindfall,
      investedValue: this.simulateGoal({
        currentAmount: windfall,
        monthlyContribution: 0,
        expectedReturn,
        volatility: 15,
        years: monthsWithoutWindfall / 12,
        targetAmount: windfall * 2, // Just for calculation
        iterations: 100
      }).percentiles.p50
    };
  },

  /**
   * Run trade-off simulation
   * Adjusts delay, risk, and target reduction to find achievable solution
   */
  tradeoffSimulation(params) {
    const {
      currentAmount = 0,
      currentMonthlyContribution = 0,
      targetAmount = 1000000,
      baseYears = 5,
      baseReturn = 12,
      baseVolatility = 15,
      delayMonths = 0,
      riskAdjustment = 0, // -6 (conservative) to +6 (aggressive)
      targetReduction = 0 // 0-50%
    } = params;
    
    const adjustedYears = baseYears + (delayMonths / 12);
    const adjustedReturn = baseReturn + riskAdjustment;
    const adjustedVolatility = baseVolatility + (riskAdjustment * 1.5); // More return = more risk
    const adjustedTarget = targetAmount * (1 - targetReduction / 100);
    
    return this.simulateGoal({
      currentAmount,
      monthlyContribution: currentMonthlyContribution,
      expectedReturn: adjustedReturn,
      volatility: adjustedVolatility,
      years: adjustedYears,
      targetAmount: adjustedTarget,
      iterations: 500 // Faster for interactive sliders
    });
  },

  /**
   * Generate projection data points for charting
   */
  generateProjectionData(params) {
    const {
      currentAmount = 0,
      monthlyContribution = 0,
      expectedReturn = 12,
      volatility = 15,
      years = 10,
      iterations = 100
    } = params;
    
    const months = years * 12;
    const dataPoints = Math.min(months, 120); // Max 10 years monthly, or quarterly after
    const interval = months <= 120 ? 1 : Math.ceil(months / 120);
    
    const projections = {
      labels: [],
      p10: [],
      p50: [],
      p90: []
    };
    
    // Run simulations for each time point
    for (let m = 0; m <= months; m += interval) {
      const result = this.simulateGoal({
        currentAmount,
        monthlyContribution,
        expectedReturn,
        volatility,
        years: m / 12,
        targetAmount: 0, // Not needed for projection
        iterations
      });
      
      const date = new Date();
      date.setMonth(date.getMonth() + m);
      
      projections.labels.push(date.toLocaleDateString('en-IN', { 
        month: 'short', 
        year: '2-digit' 
      }));
      projections.p10.push(result.percentiles.p10);
      projections.p50.push(result.percentiles.p50);
      projections.p90.push(result.percentiles.p90);
    }
    
    return projections;
  }
};
