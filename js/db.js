/**
 * TaxBuddy Database Layer
 * Handles localStorage persistence and category seeding
 */

// ============ STORAGE KEYS ============
const STORAGE_KEYS = {
  profile: 'taxbuddy_profile',
  categories: 'taxbuddy_categories',
  initialized: 'taxbuddy_initialized'
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
    isLocked: false
  },
  {
    id: 'equipment_software',
    name: 'Equipment & software',
    description: 'Laptop, phone, tools, software subscriptions',
    tip: null,
    isSystem: true,
    isEnabled: false,
    isLocked: false
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
    isLocked: true // Always on
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

// ============ DEFAULT PROFILE ============
const DEFAULT_PROFILE = {
  // Step 1
  incomeType: null,
  paysProvisionalTax: null,

  // Step 2
  cadence: 'monthly',
  typicalMonthlyIncome: null,
  incomeVaries: null, // Computed based on incomeType
  wantsEstimate: true,
  estimateDetail: 'simple',

  // Step 3
  enabledCategoryIds: ['other_work'],

  // Step 4
  captureMode: 'as_i_go',
  reminderDay: 25,
  reminderPreference: 'evening',
  reminderTime: '18:00',
  hasTaxPractitioner: false,
  taxPractitionerEmail: null,

  // Meta
  currentStep: 0, // 0 = welcome screen
  lastCompletedStep: 0,
  setupComplete: false,
  usedQuickSetup: false,
  createdAt: null,
  updatedAt: null
};

// ============ DATABASE CLASS ============
class TaxBuddyDB {
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
    const toSave = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(toSave));
    return toSave;
  }

  updateProfile(updates) {
    const current = this.getProfile();
    const updated = { ...current, ...updates };
    return this.saveProfile(updated);
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

  getRecommendedIds(incomeType) {
    return RECOMMENDATIONS[incomeType] || [];
  }

  getMotivationalCopy(incomeType) {
    return MOTIVATIONAL_COPY[incomeType] || MOTIVATIONAL_COPY.freelancer;
  }

  // ============ QUICK SETUP ============

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
      currentStep: 5, // Completion
      lastCompletedStep: 4,
      setupComplete: true,
      usedQuickSetup: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.saveProfile(profile);
  }
}

// ============ EXPORTS ============
const db = new TaxBuddyDB();

window.TaxBuddyDB = {
  db,
  TIER_1_CATEGORIES,
  RECOMMENDATIONS,
  MOTIVATIONAL_COPY,
  DEFAULT_PROFILE
};
