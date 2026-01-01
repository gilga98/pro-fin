/**
 * Pro-Finance Inflation Engine
 * Future value calculations and inflation adjustments
 */

const Inflation = {
  // Default inflation rate
  defaultRate: 6,

  /**
   * Calculate future value with inflation
   */
  futureValue(presentValue, years, inflationRate = this.defaultRate) {
    const rate = inflationRate / 100;
    return presentValue * Math.pow(1 + rate, years);
  },

  /**
   * Calculate present value from future value
   */
  presentValue(futureValue, years, inflationRate = this.defaultRate) {
    const rate = inflationRate / 100;
    return futureValue / Math.pow(1 + rate, years);
  },

  /**
   * Calculate real return (after inflation)
   */
  realReturn(nominalReturn, inflationRate = this.defaultRate) {
    // Using Fisher equation: (1 + r_real) = (1 + r_nominal) / (1 + inflation)
    const nominal = nominalReturn / 100;
    const inflation = inflationRate / 100;
    const real = ((1 + nominal) / (1 + inflation)) - 1;
    return real * 100;
  },

  /**
   * Calculate required nominal return to achieve real return target
   */
  requiredNominalReturn(targetRealReturn, inflationRate = this.defaultRate) {
    const real = targetRealReturn / 100;
    const inflation = inflationRate / 100;
    const nominal = (1 + real) * (1 + inflation) - 1;
    return nominal * 100;
  },

  /**
   * Calculate inflation-adjusted goal amount
   */
  adjustGoalForInflation(params) {
    const {
      currentCost = 0,
      targetDate,
      inflationRate = this.defaultRate,
      categoryInflation = null // For category-specific inflation
    } = params;

    const today = new Date();
    const target = new Date(targetDate);
    const years = (target - today) / (365.25 * 24 * 60 * 60 * 1000);

    if (years <= 0) {
      return { todayValue: currentCost, futureValue: currentCost, years: 0 };
    }

    // Use category-specific inflation if provided
    const rate = categoryInflation !== null ? categoryInflation : inflationRate;
    const futureValue = this.futureValue(currentCost, years, rate);

    return {
      todayValue: Math.round(currentCost),
      futureValue: Math.round(futureValue),
      years: Math.round(years * 10) / 10,
      inflationRate: rate,
      totalInflation: Math.round((futureValue / currentCost - 1) * 100)
    };
  },

  /**
   * Category-specific inflation rates (Indian context)
   */
  categoryInflationRates: {
    education: 10,        // Education inflation is higher
    healthcare: 8,        // Healthcare inflation
    housing: 7,           // Real estate inflation
    car: 5,               // Vehicle inflation
    general: 6,           // CPI general
    food: 6,
    travel: 4
  },

  /**
   * Get inflation rate for a goal type
   */
  getGoalInflation(goalType) {
    const mapping = {
      house: 'housing',
      education: 'education',
      car: 'car',
      retirement: 'general',
      wedding: 'general',
      travel: 'travel',
      emergency: 'general',
      other: 'general'
    };

    const category = mapping[goalType] || 'general';
    return this.categoryInflationRates[category];
  },

  /**
   * Calculate yearly inflation impact table
   */
  generateInflationTable(currentCost, years, inflationRate = this.defaultRate) {
    const table = [];
    
    for (let year = 0; year <= years; year++) {
      const value = this.futureValue(currentCost, year, inflationRate);
      const yearlyIncrease = year > 0 
        ? this.futureValue(currentCost, year, inflationRate) - this.futureValue(currentCost, year - 1, inflationRate)
        : 0;
      
      table.push({
        year: new Date().getFullYear() + year,
        value: Math.round(value),
        yearlyIncrease: Math.round(yearlyIncrease),
        cumulativeInflation: Math.round((value / currentCost - 1) * 100)
      });
    }


    return table;
  },

  /**
   * Calculate purchasing power erosion
   */
  purchasingPowerErosion(amount, years, inflationRate = this.defaultRate) {
    const futureEquivalent = this.presentValue(amount, years, inflationRate);
    const erosion = amount - futureEquivalent;
    const erosionPercentage = (erosion / amount) * 100;

    return {
      currentValue: amount,
      futureEquivalent: Math.round(futureEquivalent),
      erosion: Math.round(erosion),
      erosionPercentage: Math.round(erosionPercentage * 10) / 10,
      message: `₹${amount.toLocaleString('en-IN')} today will be worth only ₹${Math.round(futureEquivalent).toLocaleString('en-IN')} in ${years} years`
    };
  },

  /**
   * Calculate inflation-adjusted retirement corpus
   */
  retirementCorpus(params) {
    const {
      monthlyExpenses = 50000,
      currentAge = 30,
      retirementAge = 60,
      lifeExpectancy = 85,
      preRetirementInflation = 6,
      postRetirementInflation = 5,
      postRetirementReturn = 6
    } = params;

    const yearsToRetirement = retirementAge - currentAge;
    const retirementYears = lifeExpectancy - retirementAge;

    // Monthly expenses at retirement
    const expensesAtRetirement = this.futureValue(
      monthlyExpenses,
      yearsToRetirement,
      preRetirementInflation
    );

    // Calculate corpus needed (using real return)
    const realReturn = this.realReturn(postRetirementReturn, postRetirementInflation);
    const monthlyRealReturn = realReturn / 100 / 12;
    const retirementMonths = retirementYears * 12;

    // Present value of annuity (at retirement)
    let corpus;
    if (monthlyRealReturn <= 0) {
      corpus = expensesAtRetirement * retirementMonths;
    } else {
      corpus = expensesAtRetirement * 
        (1 - Math.pow(1 + monthlyRealReturn, -retirementMonths)) / monthlyRealReturn;
    }

    return {
      monthlyExpensesToday: monthlyExpenses,
      monthlyExpensesAtRetirement: Math.round(expensesAtRetirement),
      corpusRequired: Math.round(corpus),
      yearsToRetirement,
      retirementYears,
      assumptions: {
        preRetirementInflation,
        postRetirementInflation,
        postRetirementReturn
      }
    };
  },

  /**
   * Calculate education cost projection (specific to India)
   */
  educationCostProjection(params) {
    const {
      currentCost = 1000000, // Current annual cost
      childAge = 5,
      educationAge = 18, // When education starts (college)
      educationDuration = 4, // Years
      educationInflation = 10
    } = params;

    const yearsToStart = educationAge - childAge;
    
    // Calculate cost for each year of education
    let totalCost = 0;
    const yearWise = [];

    for (let i = 0; i < educationDuration; i++) {
      const yearsFromNow = yearsToStart + i;
      const costThatYear = this.futureValue(currentCost, yearsFromNow, educationInflation);
      totalCost += costThatYear;
      
      yearWise.push({
        year: new Date().getFullYear() + yearsFromNow,
        age: educationAge + i,
        cost: Math.round(costThatYear)
      });
    }

    return {
      currentAnnualCost: currentCost,
      totalCostToday: currentCost * educationDuration,
      totalCostFuture: Math.round(totalCost),
      inflationMultiple: Math.round(totalCost / (currentCost * educationDuration) * 10) / 10,
      startYear: new Date().getFullYear() + yearsToStart,
      yearWise
    };
  }
};
