/**
 * TaxBuddy Database Layer
 * Uses localStorage as a simple JSON store
 * Provides seeded Tier 1 categories and Profile management
 */

// ============ STORAGE KEYS ============

const DB_KEYS = {
  profile: 'taxbuddy_profile',
  categories: 'taxbuddy_categories',
  initialized: 'taxbuddy_db_initialized',
};

// ============ TIER 1 CATEGORIES (System/Locked) ============

const TIER1_CATEGORIES = [
  {
    id: 'income_received',
    slug: 'income_received',
    name: 'Income received',
    isSystem: true,
    isSpecial: true,  // Always enabled, not shown in wizard list
    isEnabled: true,
    lockedEnabled: true,
  },
  {
    id: 'bank_charges',
    slug: 'bank_charges',
    name: 'Bank charges & interest',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'travel_local',
    slug: 'travel_local',
    name: 'Work-related travel (local)',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'phone_internet',
    slug: 'phone_internet',
    name: 'Phone & internet (work use)',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'equipment_software',
    slug: 'equipment_software',
    name: 'Equipment & software',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'professional_services',
    slug: 'professional_services',
    name: 'Professional services',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'insurance',
    slug: 'insurance',
    name: 'Insurance (relevant policies)',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'medical',
    slug: 'medical',
    name: 'Medical aid & medical expenses',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'donations',
    slug: 'donations',
    name: 'Donations (approved)',
    isSystem: true,
    isSpecial: false,
    isEnabled: false,
    lockedEnabled: false,
  },
  {
    id: 'other_work',
    slug: 'other_work',
    name: 'Other work expenses (custom)',
    isSystem: true,
    isSpecial: false,
    isEnabled: true,  // Always enabled by default
    lockedEnabled: true,  // Cannot be disabled
  },
];

// ============ RECOMMENDATIONS BY INCOME TYPE ============

const CATEGORY_RECOMMENDATIONS = {
  employee: ['phone_internet', 'medical', 'donations'],
  freelancer: ['phone_internet', 'equipment_software', 'professional_services', 'travel_local'],
  business: ['professional_services', 'travel_local', 'insurance', 'equipment_software'],
  mixed: ['phone_internet', 'equipment_software', 'professional_services', 'travel_local', 'insurance', 'medical', 'donations'],
};

// ============ DEFAULT PROFILE ============

const DEFAULT_PROFILE = {
  // Step 1: Tax Situation
  incomeType: null,
  paysProvisionalTax: null,

  // Step 2: Income Basics
  cadence: 'monthly',
  typicalMonthlyIncome: null,
  incomeVaries: null,  // Computed based on incomeType if not set
  wantsEstimate: true,
  estimateDetail: 'simple',

  // Step 3: Categories
  enabledCategoryIds: ['income_received', 'other_work'],  // Minimum defaults

  // Step 4: Capture Preferences
  captureMode: 'as_you_go',
  reminderPreference: 'evening',
  reminderDay: 25,
  reminderTime: '18:00',
  hasTaxPractitioner: false,
  taxPractitionerEmail: null,

  // Wizard Meta
  setupComplete: false,
  lastCompletedStep: 0,
  usedQuickSetup: false,
  createdAt: null,
  updatedAt: null,
};

// ============ DATABASE CLASS ============

class TaxBuddyDB {
  constructor() {
    this.initializeIfNeeded();
  }

  /**
   * Initialize the database with seed data if not already done
   */
  initializeIfNeeded() {
    const initialized = localStorage.getItem(DB_KEYS.initialized);
    if (!initialized) {
      this.seedCategories();
      localStorage.setItem(DB_KEYS.initialized, 'true');
    }
  }

  /**
   * Seed Tier 1 categories into the database
   */
  seedCategories() {
    localStorage.setItem(DB_KEYS.categories, JSON.stringify(TIER1_CATEGORIES));
  }

  /**
   * Reset the database (for testing)
   */
  reset() {
    localStorage.removeItem(DB_KEYS.profile);
    localStorage.removeItem(DB_KEYS.categories);
    localStorage.removeItem(DB_KEYS.initialized);
    this.initializeIfNeeded();
  }

  // ============ PROFILE METHODS ============

  /**
   * Get the current profile, or create a new one if it doesn't exist
   */
  getProfile() {
    const stored = localStorage.getItem(DB_KEYS.profile);
    if (stored) {
      try {
        return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse profile:', e);
      }
    }
    return { ...DEFAULT_PROFILE, createdAt: new Date().toISOString() };
  }

  /**
   * Save the profile to the database
   */
  saveProfile(profile) {
    const toSave = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(DB_KEYS.profile, JSON.stringify(toSave));
    return toSave;
  }

  /**
   * Update specific fields on the profile
   */
  updateProfile(updates) {
    const current = this.getProfile();
    const updated = { ...current, ...updates };
    return this.saveProfile(updated);
  }

  /**
   * Check if profile setup is complete
   */
  isSetupComplete() {
    const profile = this.getProfile();
    return profile.setupComplete === true;
  }

  /**
   * Get the step to resume from (lastCompletedStep + 1, minimum 1)
   */
  getResumeStep() {
    const profile = this.getProfile();
    return Math.max(1, Math.min(4, (profile.lastCompletedStep || 0) + 1));
  }

  // ============ CATEGORY METHODS ============

  /**
   * Get all categories
   */
  getCategories() {
    const stored = localStorage.getItem(DB_KEYS.categories);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse categories:', e);
      }
    }
    return [...TIER1_CATEGORIES];
  }

  /**
   * Get categories visible in the wizard (excluding special ones like income_received)
   */
  getWizardCategories() {
    return this.getCategories().filter(c => !c.isSpecial);
  }

  /**
   * Get recommended category IDs for an income type
   */
  getRecommendedCategories(incomeType) {
    return CATEGORY_RECOMMENDATIONS[incomeType] || [];
  }

  /**
   * Update which categories are enabled
   */
  updateCategoryEnabled(categoryId, isEnabled) {
    const categories = this.getCategories();
    const category = categories.find(c => c.id === categoryId);
    if (category && !category.lockedEnabled) {
      category.isEnabled = isEnabled;
      localStorage.setItem(DB_KEYS.categories, JSON.stringify(categories));
    }
    return categories;
  }

  /**
   * Get enabled category IDs from profile
   */
  getEnabledCategoryIds() {
    const profile = this.getProfile();
    return profile.enabledCategoryIds || ['income_received', 'other_work'];
  }

  /**
   * Set enabled category IDs on profile
   */
  setEnabledCategoryIds(ids) {
    // Ensure required categories are always included
    const requiredIds = ['income_received', 'other_work'];
    const finalIds = [...new Set([...requiredIds, ...ids])];
    return this.updateProfile({ enabledCategoryIds: finalIds });
  }
}

// ============ MOTIVATIONAL COPY ============

const MOTIVATIONAL_COPY = {
  employee: 'Employees tracking these categories typically claim R8,000–R20,000 in deductions annually.',
  freelancer: 'Freelancers tracking these categories typically claim R15,000–R40,000 in deductions annually.',
  business: 'Business owners tracking these categories typically claim R25,000–R60,000 in deductions annually.',
  mixed: 'People with mixed income tracking these categories typically claim R20,000–R50,000 in deductions annually.',
};

// ============ EXPORTS ============

// Create singleton instance
const db = new TaxBuddyDB();

// Export for use in app.js
window.TaxBuddyDB = {
  db,
  TIER1_CATEGORIES,
  CATEGORY_RECOMMENDATIONS,
  DEFAULT_PROFILE,
  MOTIVATIONAL_COPY,
};
