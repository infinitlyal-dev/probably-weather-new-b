/**
 * TaxBuddy Database Layer
 * Handles localStorage persistence for profile, categories, and expenses
 */

(function() {
  'use strict';

  console.log('[TaxBuddy] db.js loading...');

  // ============ STORAGE KEYS ============
  const STORAGE_KEYS = {
    profile: 'taxbuddy_profile',
    categories: 'taxbuddy_categories',
    expenses: 'taxbuddy_expenses',
    initialized: 'taxbuddy_initialized'
  };

  // ============ CATEGORY ICONS ============
  const CATEGORY_ICONS = {
    phone_internet: '📱',
    travel: '🚗',
    equipment_software: '💻',
    professional_services: '📋',
    insurance: '🛡️',
    medical: '🏥',
    donations: '💝',
    bank_charges: '🏦',
    other_work: '📦'
  };

  // ============ TIER 1 CATEGORIES ============
  const TIER_1_CATEGORIES = [
    {
      id: 'bank_charges',
      name: 'Bank charges & interest',
      description: 'Monthly fees and interest from accounts used for work',
      tip: null,
      isSystem: true,
      isEnabled: false,
      isLocked: false
    },
    {
      id: 'travel',
      name: 'Work travel',
      description: 'Petrol, Uber, parking, flights for work purposes',
      tip: null,
      isSystem: true,
      isEnabled: false,
      isLocked: false
    },
    {
      id: 'phone_internet',
      name: 'Phone & internet',
      description: 'The portion of your phone and WiFi used for work',
      tip: 'You can claim up to 50% if you work from home',
      isSystem: true,
      isEnabled: false,
      isLocked: false,
      showWorkPercentage: true
    },
    {
      id: 'equipment_software',
      name: 'Equipment & software',
      description: 'Laptop, phone, tools, software subscriptions',
      tip: null,
      isSystem: true,
      isEnabled: false,
      isLocked: false,
      showWorkPercentage: true
    },
    {
      id: 'professional_services',
      name: 'Professional services',
      description: 'Accountant fees, legal costs, consulting',
      tip: null,
      isSystem: true,
      isEnabled: false,
      isLocked: false
    },
    {
      id: 'insurance',
      name: 'Insurance',
      description: 'Business insurance, professional indemnity',
      tip: null,
      isSystem: true,
      isEnabled: false,
      isLocked: false
    },
    {
      id: 'medical',
      name: 'Medical expenses',
      description: 'Medical aid contributions and out-of-pocket costs',
      tip: 'Expenses over 7.5% of your income get extra tax relief',
      isSystem: true,
      isEnabled: false,
      isLocked: false
    },
    {
      id: 'donations',
      name: 'Donations',
      description: 'Donations to Section 18A approved charities',
      tip: 'These charities give you a tax certificate',
      isSystem: true,
      isEnabled: false,
      isLocked: false
    },
    {
      id: 'other_work',
      name: 'Other work expenses',
      description: 'Anything else that\'s work-related',
      tip: null,
      isSystem: true,
      isEnabled: true,
      isLocked: true
    }
  ];

  // ============ RECOMMENDATIONS BY INCOME TYPE ============
  const RECOMMENDATIONS = {
    employee: ['phone_internet', 'medical', 'donations'],
    freelancer: ['phone_internet', 'equipment_software', 'professional_services', 'travel'],
    business: ['professional_services', 'travel', 'insurance', 'equipment_software'],
    mixed: ['phone_internet', 'equipment_software', 'professional_services', 'travel', 'medical', 'donations', 'insurance']
  };

  // ============ MOTIVATIONAL COPY ============
  const MOTIVATIONAL_COPY = {
    employee: {
      emoji: '✨',
      text: 'Nice choice! Employees tracking these categories typically claim R8,000 – R15,000 in deductions each year.'
    },
    freelancer: {
      emoji: '✨',
      text: 'Great picks! Freelancers tracking these categories typically claim R15,000 – R40,000 in deductions each year. That\'s real money back in your pocket.'
    },
    business: {
      emoji: '✨',
      text: 'Smart selections! Business owners tracking these categories typically claim R25,000 – R60,000 in deductions annually.'
    },
    mixed: {
      emoji: '✨',
      text: 'Excellent choices! People with mixed income tracking these categories typically claim R20,000 – R45,000 in deductions each year.'
    }
  };

  // ============ TAX TIPS ============
  const TAX_TIPS = [
    'Remember: You can claim up to 50% of your phone bill if you use it for work',
    'Quick tip: Take photos of paper receipts — SARS accepts digital copies',
    'Did you know? Uber and Bolt trips for work meetings are deductible',
    'Pro tip: Keep your work and personal expenses separate for easier tracking',
    'Tax fact: You can claim home office expenses if you work from home regularly',
    'Remember: Professional development courses related to your work are deductible',
    'Did you know? Equipment that costs under R7,000 can be claimed in full',
    'Tip: Medical expenses above 7.5% of your income get extra tax relief'
  ];

  // ============ DEFAULT PROFILE ============
  const DEFAULT_PROFILE = {
    incomeType: null,
    paysProvisionalTax: null,
    cadence: 'monthly',
    typicalMonthlyIncome: null,
    incomeVaries: null,
    wantsEstimate: true,
    estimateDetail: 'simple',
    enabledCategoryIds: ['other_work'],
    captureMode: 'as_i_go',
    reminderDay: 25,
    reminderPreference: 'evening',
    reminderTime: '18:00',
    hasTaxPractitioner: false,
    taxPractitionerEmail: null,
    currentStep: 0,
    lastCompletedStep: 0,
    setupComplete: false,
    usedQuickSetup: false,
    createdAt: null,
    updatedAt: null
  };

  // ============ DATABASE CLASS ============
  class TaxBuddyDatabase {
    constructor() {
      this.initializeIfNeeded();
    }

    initializeIfNeeded() {
      const initialized = localStorage.getItem(STORAGE_KEYS.initialized);
      if (!initialized) {
        this.seedCategories();
        localStorage.setItem(STORAGE_KEYS.initialized, 'true');
      }
    }

    seedCategories() {
      localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(TIER_1_CATEGORIES));
    }

    reset() {
      localStorage.removeItem(STORAGE_KEYS.profile);
      localStorage.removeItem(STORAGE_KEYS.categories);
      localStorage.removeItem(STORAGE_KEYS.expenses);
      localStorage.removeItem(STORAGE_KEYS.initialized);
      this.initializeIfNeeded();
    }

    // ============ PROFILE METHODS ============
    getProfile() {
      const stored = localStorage.getItem(STORAGE_KEYS.profile);
      if (stored) {
        try {
          return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
        } catch (e) {
          console.error('Failed to parse profile:', e);
        }
      }
      return { ...DEFAULT_PROFILE, createdAt: new Date().toISOString() };
    }

    saveProfile(profile) {
      const toSave = { ...profile, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(toSave));
      return toSave;
    }

    updateProfile(updates) {
      const current = this.getProfile();
      return this.saveProfile({ ...current, ...updates });
    }

    isSetupComplete() {
      return this.getProfile().setupComplete === true;
    }

    // ============ CATEGORY METHODS ============
    getCategories() {
      const stored = localStorage.getItem(STORAGE_KEYS.categories);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse categories:', e);
        }
      }
      return [...TIER_1_CATEGORIES];
    }

    getEnabledCategories() {
      const profile = this.getProfile();
      const categories = this.getCategories();
      return categories.filter(cat => profile.enabledCategoryIds.includes(cat.id));
    }

    getCategoryById(id) {
      const categories = this.getCategories();
      return categories.find(cat => cat.id === id);
    }

    getCategoryIcon(categoryId) {
      return CATEGORY_ICONS[categoryId] || '📦';
    }

    getRecommendedIds(incomeType) {
      return RECOMMENDATIONS[incomeType] || [];
    }

    getMotivationalCopy(incomeType) {
      return MOTIVATIONAL_COPY[incomeType] || MOTIVATIONAL_COPY.freelancer;
    }

    getRandomTip() {
      return TAX_TIPS[Math.floor(Math.random() * TAX_TIPS.length)];
    }

    applyQuickSetup() {
      const profile = {
        ...DEFAULT_PROFILE,
        incomeType: 'freelancer',
        paysProvisionalTax: 'not_sure',
        cadence: 'monthly',
        incomeVaries: true,
        wantsEstimate: true,
        estimateDetail: 'simple',
        enabledCategoryIds: ['other_work', ...RECOMMENDATIONS.freelancer],
        captureMode: 'as_i_go',
        reminderDay: 25,
        reminderPreference: 'evening',
        reminderTime: '18:00',
        hasTaxPractitioner: false,
        currentStep: 5,
        lastCompletedStep: 4,
        setupComplete: true,
        usedQuickSetup: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return this.saveProfile(profile);
    }

    // ============ EXPENSE METHODS ============
    getExpenses() {
      const stored = localStorage.getItem(STORAGE_KEYS.expenses);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse expenses:', e);
        }
      }
      return [];
    }

    saveExpenses(expenses) {
      localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
      return expenses;
    }

    addExpense(expense) {
      const expenses = this.getExpenses();
      const newExpense = {
        id: 'exp_' + Date.now(),
        ...expense,
        claimableAmount: expense.amount * (expense.workPercentage / 100),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      expenses.unshift(newExpense);
      this.saveExpenses(expenses);
      console.log('[TaxBuddy Analytics]', { event: 'expense_added', categoryId: expense.categoryId, amount: expense.amount, hasReceipt: !!expense.receiptImage });
      return newExpense;
    }

    updateExpense(id, updates) {
      const expenses = this.getExpenses();
      const index = expenses.findIndex(e => e.id === id);
      if (index === -1) return null;

      const updated = {
        ...expenses[index],
        ...updates,
        claimableAmount: (updates.amount || expenses[index].amount) * ((updates.workPercentage || expenses[index].workPercentage) / 100),
        updatedAt: new Date().toISOString()
      };
      expenses[index] = updated;
      this.saveExpenses(expenses);
      console.log('[TaxBuddy Analytics]', { event: 'expense_edited', expenseId: id });
      return updated;
    }

    deleteExpense(id) {
      const expenses = this.getExpenses();
      const filtered = expenses.filter(e => e.id !== id);
      this.saveExpenses(filtered);
      console.log('[TaxBuddy Analytics]', { event: 'expense_deleted', expenseId: id });
      return true;
    }

    getExpenseById(id) {
      const expenses = this.getExpenses();
      return expenses.find(e => e.id === id);
    }

    getExpensesByMonth(year, month) {
      const expenses = this.getExpenses();
      return expenses.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
    }

    getExpensesByCategory(categoryId) {
      const expenses = this.getExpenses();
      return expenses.filter(e => e.categoryId === categoryId);
    }

    getTotalClaimable() {
      const expenses = this.getExpenses();
      return expenses.reduce((sum, e) => sum + (e.claimableAmount || 0), 0);
    }

    getThisMonthTotal() {
      const now = new Date();
      const expenses = this.getExpensesByMonth(now.getFullYear(), now.getMonth());
      return expenses.reduce((sum, e) => sum + (e.claimableAmount || 0), 0);
    }

    getExpenseCount() {
      return this.getExpenses().length;
    }

    getRecentExpenses(limit = 5) {
      const expenses = this.getExpenses();
      return expenses.slice(0, limit);
    }

    getExpensesGroupedByMonth() {
      const expenses = this.getExpenses();
      const grouped = {};

      expenses.forEach(expense => {
        const date = new Date(expense.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[key]) {
          grouped[key] = { expenses: [], total: 0, count: 0 };
        }
        grouped[key].expenses.push(expense);
        grouped[key].total += expense.claimableAmount || 0;
        grouped[key].count++;
      });

      return grouped;
    }
  }

  // ============ EXPORTS ============
  const dbInstance = new TaxBuddyDatabase();

  window.TaxBuddyDB = {
    db: dbInstance,
    TIER_1_CATEGORIES,
    RECOMMENDATIONS,
    MOTIVATIONAL_COPY,
    DEFAULT_PROFILE,
    CATEGORY_ICONS,
    TAX_TIPS
  };

  console.log('[TaxBuddy] db.js loaded successfully');
})();
