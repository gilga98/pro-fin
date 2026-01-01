/**
 * Pro-Finance Tax Calculator
 * Indian Income Tax calculation with Old vs New regime comparison
 */

const TaxCalculator = {
  // Tax slabs for FY 2025-26
  taxSlabs: {
    new: {
      slabs: [
        { min: 0, max: 400000, rate: 0 },
        { min: 400000, max: 800000, rate: 5 },
        { min: 800000, max: 1200000, rate: 10 },
        { min: 1200000, max: 1600000, rate: 15 },
        { min: 1600000, max: 2000000, rate: 20 },
        { min: 2000000, max: 2400000, rate: 25 },
        { min: 2400000, max: Infinity, rate: 30 }
      ],
      standardDeduction: 75000,
      rebate87A: { limit: 700000, maxRebate: 25000 } // For income up to 7L
    },
    old: {
      slabs: [
        { min: 0, max: 250000, rate: 0 },
        { min: 250000, max: 500000, rate: 5 },
        { min: 500000, max: 1000000, rate: 20 },
        { min: 1000000, max: Infinity, rate: 30 }
      ],
      standardDeduction: 50000,
      rebate87A: { limit: 500000, maxRebate: 12500 }
    }
  },

  // Section 80C limit
  section80CLimit: 150000,
  
  // Section 80D limits
  section80D: {
    self: 25000,  // Below 60
    selfSenior: 50000,  // 60+
    parents: 25000,
    parentsSenior: 50000
  },

  // LTCG exemption
  ltcgExemption: 125000,
  ltcgRate: 12.5,
  stcgRate: 20,

  // Home loan deductions (old regime)
  homeLoan: {
    principalUnder80C: 150000, // Part of 80C
    interestUnder24b: 200000 // Self-occupied
  },

  /**
   * Calculate tax for a given income and regime
   */
  calculateTax(params) {
    const {
      grossIncome = 0,
      regime = 'new',
      deductions80C = 0,
      deductions80D = 0,
      deductions80CCD = 0, // NPS additional
      homeLoanInterest = 0,
      hra = 0,
      ltcg = 0,
      stcg = 0
    } = params;

    const slabConfig = this.taxSlabs[regime];
    let taxableIncome = grossIncome;
    const breakdown = {
      grossIncome,
      deductions: {},
      exemptions: {}
    };

    // Apply standard deduction
    taxableIncome -= slabConfig.standardDeduction;
    breakdown.deductions.standardDeduction = slabConfig.standardDeduction;

    // Old regime allows more deductions
    if (regime === 'old') {
      // 80C deductions
      const actual80C = Math.min(deductions80C, this.section80CLimit);
      taxableIncome -= actual80C;
      breakdown.deductions.section80C = actual80C;

      // 80D deductions
      const actual80D = Math.min(deductions80D, this.section80D.self + this.section80D.parents);
      taxableIncome -= actual80D;
      breakdown.deductions.section80D = actual80D;

      // 80CCD (NPS additional ₹50,000)
      const actual80CCD = Math.min(deductions80CCD, 50000);
      taxableIncome -= actual80CCD;
      breakdown.deductions.section80CCD = actual80CCD;

      // Home loan interest (24b)
      const actualHomeLoan = Math.min(homeLoanInterest, this.homeLoan.interestUnder24b);
      taxableIncome -= actualHomeLoan;
      breakdown.deductions.homeLoanInterest = actualHomeLoan;

      // HRA exemption (simplified)
      if (hra > 0) {
        taxableIncome -= hra;
        breakdown.exemptions.hra = hra;
      }
    }

    // Calculate base tax
    taxableIncome = Math.max(0, taxableIncome);
    breakdown.taxableIncome = taxableIncome;

    let baseTax = 0;
    for (const slab of slabConfig.slabs) {
      if (taxableIncome > slab.min) {
        const taxableInSlab = Math.min(taxableIncome - slab.min, slab.max - slab.min);
        baseTax += taxableInSlab * (slab.rate / 100);
      }
    }

    // Apply rebate 87A
    if (taxableIncome <= slabConfig.rebate87A.limit) {
      const rebate = Math.min(baseTax, slabConfig.rebate87A.maxRebate);
      baseTax -= rebate;
      breakdown.rebate87A = rebate;
    }

    // Add surcharge if applicable
    let surcharge = 0;
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) {
      surcharge = baseTax * 0.10;
    } else if (taxableIncome > 10000000 && taxableIncome <= 20000000) {
      surcharge = baseTax * 0.15;
    } else if (taxableIncome > 20000000 && taxableIncome <= 50000000) {
      surcharge = baseTax * 0.25;
    } else if (taxableIncome > 50000000) {
      surcharge = baseTax * 0.37;
    }

    // Add health & education cess (4%)
    const cess = (baseTax + surcharge) * 0.04;

    // Capital gains tax (separate)
    let capitalGainsTax = 0;
    if (ltcg > 0) {
      const taxableLTCG = Math.max(0, ltcg - this.ltcgExemption);
      capitalGainsTax += taxableLTCG * (this.ltcgRate / 100);
    }
    if (stcg > 0) {
      capitalGainsTax += stcg * (this.stcgRate / 100);
    }

    const totalTax = baseTax + surcharge + cess + capitalGainsTax;

    return {
      regime,
      breakdown,
      baseTax: Math.round(baseTax),
      surcharge: Math.round(surcharge),
      cess: Math.round(cess),
      capitalGainsTax: Math.round(capitalGainsTax),
      totalTax: Math.round(totalTax),
      effectiveRate: grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0,
      monthlyTax: Math.round(totalTax / 12)
    };
  },

  /**
   * Compare old vs new regime
   */
  compareRegimes(params) {
    const oldRegime = this.calculateTax({ ...params, regime: 'old' });
    const newRegime = this.calculateTax({ ...params, regime: 'new' });

    const savings = oldRegime.totalTax - newRegime.totalTax;
    const recommendedRegime = savings > 0 ? 'new' : 'old';

    return {
      old: oldRegime,
      new: newRegime,
      savings: Math.abs(savings),
      recommendedRegime,
      recommendation: savings > 0 
        ? `New regime saves ₹${Math.abs(savings).toLocaleString('en-IN')}/year`
        : `Old regime saves ₹${Math.abs(savings).toLocaleString('en-IN')}/year`
    };
  },

  /**
   * Calculate net-of-tax return for an investment
   */
  calculatePostTaxReturn(params) {
    const {
      preTaxReturn = 10,
      investmentType = 'equity',
      holdingPeriod = 'long', // 'short' or 'long'
      taxBracket = 30
    } = params;

    switch (investmentType) {
      case 'fd':
      case 'bonds':
        // Taxed as income
        return preTaxReturn * (1 - taxBracket / 100);
      
      case 'equity':
      case 'mutual-funds':
        if (holdingPeriod === 'long') {
          // LTCG at 12.5% (simplified, assumes gains above exemption)
          return preTaxReturn * (1 - 0.125);
        } else {
          // STCG at 20%
          return preTaxReturn * (1 - 0.20);
        }
      
      case 'ppf':
      case 'epf':
        // Tax exempt
        return preTaxReturn;
      
      case 'nps':
        // 60% exempt, 40% taxable at marginal rate
        return preTaxReturn * (1 - 0.4 * taxBracket / 100);
      
      case 'gold':
      case 'real-estate':
        // LTCG with indexation (simplified)
        return preTaxReturn * 0.85;
      
      default:
        return preTaxReturn * (1 - taxBracket / 100);
    }
  },

  /**
   * Calculate LTCG tax harvesting opportunity
   */
  calculateHarvestingOpportunity(params) {
    const {
      realizedGains = 0,
      unrealizedGains = 0
    } = params;

    const remainingExemption = Math.max(0, this.ltcgExemption - realizedGains);
    const harvestingOpportunity = Math.min(remainingExemption, unrealizedGains);
    const taxSaved = harvestingOpportunity * (this.ltcgRate / 100);

    return {
      exemptionLimit: this.ltcgExemption,
      usedExemption: Math.min(realizedGains, this.ltcgExemption),
      remainingExemption,
      harvestingOpportunity,
      taxSaved: Math.round(taxSaved),
      recommendation: harvestingOpportunity > 0
        ? `Consider selling ₹${harvestingOpportunity.toLocaleString('en-IN')} worth of gains to save ₹${Math.round(taxSaved).toLocaleString('en-IN')} in taxes`
        : 'LTCG exemption already utilized'
    };
  },

  /**
   * Get tax bracket for a given income
   */
  getTaxBracket(grossIncome, regime = 'new') {
    const slabs = this.taxSlabs[regime].slabs;
    for (let i = slabs.length - 1; i >= 0; i--) {
      if (grossIncome > slabs[i].min) {
        return slabs[i].rate;
      }
    }
    return 0;
  },

  /**
   * Calculate Section 80C utilization
   */
  calculate80CUtilization(investments) {
    const eligible80C = ['ppf', 'elss', 'li-premium', 'nsc', 'tuition', 'home-loan-principal', 'epf'];
    
    let total = 0;
    const breakdown = {};

    for (const inv of investments) {
      if (eligible80C.includes(inv.type)) {
        const amount = inv.annualAmount || inv.amount * 12;
        total += amount;
        breakdown[inv.type] = (breakdown[inv.type] || 0) + amount;
      }
    }

    const utilized = Math.min(total, this.section80CLimit);
    const remaining = this.section80CLimit - utilized;

    return {
      limit: this.section80CLimit,
      totalEligible: total,
      utilized,
      remaining,
      breakdown,
      recommendation: remaining > 0
        ? `You can invest ₹${remaining.toLocaleString('en-IN')} more in 80C instruments`
        : '80C limit fully utilized ✓'
    };
  },

  /**
   * Check for tax bracket change alert
   */
  checkTaxBracketChange(previousIncome, newIncome, regime = 'new') {
    const previousBracket = this.getTaxBracket(previousIncome * 12, regime);
    const newBracket = this.getTaxBracket(newIncome * 12, regime);

    if (newBracket > previousBracket) {
      return {
        changed: true,
        previousBracket,
        newBracket,
        message: `You've moved to the ${newBracket}% tax bracket`,
        suggestion: 'Consider increasing 80C/80D investments to reduce tax liability'
      };
    }

    return { changed: false };
  }
};
