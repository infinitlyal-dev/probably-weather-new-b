/**
 * TaxBuddy Setup Wizard
 * Complete 4-step wizard + completion for South African tax profile setup
 */

// ============ DEPENDENCIES ============

const { db, CATEGORY_RECOMMENDATIONS, MOTIVATIONAL_COPY } = window.TaxBuddyDB;

// ============ STATE ============

let currentStep = 1;
let stepStartTime = Date.now();
let profile = {};

// ============ DOM HELPERS ============

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============ ANALYTICS ============

const Analytics = {
  log(event, data = {}) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    };
    console.log('[Analytics]', payload);
    // Future: send to analytics service
  },

  wizardStarted() {
    this.log('wizard_started', { incomeType: null });
  },

  stepCompleted(step, incomeType) {
    const duration = Math.round((Date.now() - stepStartTime) / 1000);
    this.log('wizard_step_completed', {
      step,
      incomeType,
      duration_seconds: duration,
    });
  },

  wizardCompleted(incomeType, categoriesEnabled, usedQuickSetup) {
    this.log('wizard_completed', {
      incomeType,
      categoriesEnabled,
      usedQuickSetup,
    });
  },

  wizardAbandoned(lastStep, incomeType) {
    this.log('wizard_abandoned', {
      lastStep,
      incomeType,
    });
  },
};

// ============ TOAST ============

function showToast(message = 'Progress saved') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2000);
}

// ============ VALIDATION ============

function validateStep(step) {
  clearErrors();

  switch (step) {
    case 1:
      if (!profile.incomeType) {
        showError('income-type-error', 'Please select your income type');
        return false;
      }
      return true;

    case 2:
      // All fields optional or have defaults
      return true;

    case 3:
      // Must have at least one category besides other_work
      const enabledNonRequired = profile.enabledCategoryIds.filter(
        id => id !== 'income_received' && id !== 'other_work'
      );
      if (enabledNonRequired.length === 0) {
        showError('category-error', 'Please select at least one expense category');
        return false;
      }
      return true;

    case 4:
      // All fields optional or have defaults
      return true;

    default:
      return true;
  }
}

function showError(elementId, message) {
  const el = $(`#${elementId}`);
  if (el) {
    el.textContent = message;
    el.style.display = 'block';
  }
}

function clearErrors() {
  $$('.error-message').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

// ============ PROGRESS BAR ============

function updateProgressBar() {
  const fill = $('#progress-fill');
  const text = $('#progress-text');
  const steps = $$('.progress-steps .step');

  // Update text
  text.textContent = `Step ${currentStep} of 4`;

  // Calculate fill width (0% at step 1, 100% at step 4)
  const percent = ((currentStep - 1) / 3) * 100;
  fill.style.width = `${percent}%`;

  // Update step indicators
  steps.forEach((step) => {
    const stepNum = parseInt(step.dataset.step, 10);
    step.classList.remove('active', 'completed', 'clickable');

    if (stepNum < currentStep) {
      step.classList.add('completed', 'clickable');
    } else if (stepNum === currentStep) {
      step.classList.add('active');
    }
    // Future steps remain unstyled (not clickable)
  });
}

// ============ STEP NAVIGATION ============

function showStep(step) {
  // Hide all steps
  $$('.wizard-step').forEach(s => s.classList.remove('active'));

  // Show target step
  const stepId = step === 'complete' ? 'step-complete' : `step-${step}`;
  const stepEl = $(`#${stepId}`);
  if (stepEl) {
    stepEl.classList.add('active');
  }

  // Update nav visibility
  const nav = $('#wizard-nav');
  if (step === 'complete') {
    nav.style.display = 'none';
  } else {
    nav.style.display = 'flex';
    $('#btn-back').style.visibility = step === 1 ? 'hidden' : 'visible';
    $('#btn-next').textContent = step === 4 ? 'Complete Setup' : 'Continue';
  }

  // Update progress bar for numbered steps
  if (typeof step === 'number') {
    currentStep = step;
    stepStartTime = Date.now();
    updateProgressBar();
  }

  // Update button state
  updateNextButtonState();
}

function goToStep(step) {
  if (step < 1 || step > 4) return;

  // Can only go to completed steps or current step
  const canNavigate = step <= profile.lastCompletedStep + 1;
  if (!canNavigate) return;

  showStep(step);
  renderCurrentStep();
}

function updateNextButtonState() {
  const btn = $('#btn-next');
  let isValid = false;

  switch (currentStep) {
    case 1:
      isValid = profile.incomeType !== null;
      break;
    case 2:
      isValid = true;
      break;
    case 3:
      const enabledNonRequired = (profile.enabledCategoryIds || []).filter(
        id => id !== 'income_received' && id !== 'other_work'
      );
      isValid = enabledNonRequired.length > 0;
      break;
    case 4:
      isValid = true;
      break;
  }

  btn.disabled = !isValid;
}

// ============ STEP RENDERERS ============

function renderStep1() {
  // Income type
  if (profile.incomeType) {
    const radio = $(`input[name="incomeType"][value="${profile.incomeType}"]`);
    if (radio) radio.checked = true;
  }

  // Provisional tax
  if (profile.paysProvisionalTax) {
    const radio = $(`input[name="paysProvisionalTax"][value="${profile.paysProvisionalTax}"]`);
    if (radio) radio.checked = true;
  }

  // Explainer state
  updateExplainerVisibility();
}

function renderStep2() {
  // Cadence
  $$('#cadence-options .btn-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === profile.cadence);
  });

  // Monthly income
  const incomeInput = $('#monthly-income');
  if (profile.typicalMonthlyIncome) {
    incomeInput.value = profile.typicalMonthlyIncome;
  } else {
    incomeInput.value = '';
  }

  // Income varies - default based on income type if not explicitly set
  if (profile.incomeVaries === null || profile.incomeVaries === undefined) {
    profile.incomeVaries = ['freelancer', 'business', 'mixed'].includes(profile.incomeType);
  }
  $('#income-varies').checked = profile.incomeVaries;

  // Wants estimate
  $('#wants-estimate').checked = profile.wantsEstimate;

  // Estimate detail
  $$('#estimate-detail-options .btn-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === profile.estimateDetail);
  });

  // Show/hide estimate detail
  $('#estimate-detail-group').style.display = profile.wantsEstimate ? 'block' : 'none';
}

function renderStep3() {
  const list = $('#category-list');
  const categories = db.getWizardCategories();
  const recommended = CATEGORY_RECOMMENDATIONS[profile.incomeType] || [];

  // Ensure enabledCategoryIds exists
  if (!profile.enabledCategoryIds) {
    profile.enabledCategoryIds = ['income_received', 'other_work'];
  }

  list.innerHTML = categories.map(cat => {
    const isRecommended = recommended.includes(cat.id);
    const isLocked = cat.lockedEnabled;
    const isEnabled = profile.enabledCategoryIds.includes(cat.id);

    return `
      <label class="category-item ${isLocked ? 'locked' : ''}" data-testid="category-${cat.slug}">
        <input type="checkbox"
               class="category-checkbox"
               value="${cat.id}"
               ${isEnabled ? 'checked' : ''}
               ${isLocked ? 'disabled' : ''}>
        <span class="category-info">
          <span class="category-name">${cat.name}</span>
          ${isRecommended ? '<span class="category-badge recommended">Recommended</span>' : ''}
          ${isLocked ? '<span class="category-badge locked">Always on</span>' : ''}
        </span>
      </label>
    `;
  }).join('');

  // Add event listeners to checkboxes
  list.querySelectorAll('.category-checkbox').forEach(cb => {
    cb.addEventListener('change', handleCategoryChange);
  });

  // Update motivational text
  updateMotivationalText();
}

function renderStep4() {
  // Capture mode
  const captureRadio = $(`input[name="captureMode"][value="${profile.captureMode}"]`);
  if (captureRadio) captureRadio.checked = true;

  // Reminder preference
  $$('#reminder-pref-options .btn-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === profile.reminderPreference);
  });

  // Reminder day dropdown
  const daySelect = $('#reminder-day');
  daySelect.innerHTML = '';
  for (let d = 1; d <= 28; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (d === profile.reminderDay) opt.selected = true;
    daySelect.appendChild(opt);
  }

  // Reminder time dropdown - varies based on preference
  updateReminderTimeOptions();

  // Tax practitioner
  $('#has-practitioner').checked = profile.hasTaxPractitioner;
  $('#practitioner-email-group').style.display = profile.hasTaxPractitioner ? 'block' : 'none';
  if (profile.taxPractitionerEmail) {
    $('#practitioner-email').value = profile.taxPractitionerEmail;
  }
}

function updateReminderTimeOptions() {
  const timeSelect = $('#reminder-time');
  const isMorning = profile.reminderPreference === 'morning';

  // Morning: 06:00-12:00, Evening: 17:00-22:00
  const startHour = isMorning ? 6 : 17;
  const endHour = isMorning ? 12 : 22;
  const defaultTime = isMorning ? '09:00' : '18:00';

  // If current time is outside new range, reset to default
  const currentHour = parseInt(profile.reminderTime?.split(':')[0] || '0', 10);
  if (currentHour < startHour || currentHour > endHour) {
    profile.reminderTime = defaultTime;
  }

  timeSelect.innerHTML = '';
  for (let h = startHour; h <= endHour; h++) {
    const time = `${h.toString().padStart(2, '0')}:00`;
    const opt = document.createElement('option');
    opt.value = time;
    opt.textContent = time;
    if (time === profile.reminderTime) opt.selected = true;
    timeSelect.appendChild(opt);
  }
}

function updateMotivationalText() {
  const el = $('#motivational-text');
  const copy = MOTIVATIONAL_COPY[profile.incomeType];
  if (copy && profile.enabledCategoryIds.length > 2) {
    el.innerHTML = `<p>${copy}</p>`;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function updateExplainerVisibility() {
  const explainer = $('#provisional-explainer');
  const isNotSure = profile.paysProvisionalTax === 'not_sure';
  explainer.style.display = isNotSure ? 'block' : 'none';
}

function renderCurrentStep() {
  switch (currentStep) {
    case 1: renderStep1(); break;
    case 2: renderStep2(); break;
    case 3: renderStep3(); break;
    case 4: renderStep4(); break;
  }
  updateNextButtonState();
}

// ============ EVENT HANDLERS ============

function handleCategoryChange(e) {
  const id = e.target.value;
  if (e.target.checked) {
    if (!profile.enabledCategoryIds.includes(id)) {
      profile.enabledCategoryIds.push(id);
    }
  } else {
    profile.enabledCategoryIds = profile.enabledCategoryIds.filter(c => c !== id);
  }
  saveProgress();
  updateNextButtonState();
  updateMotivationalText();
}

function handleUseRecommended() {
  const recommended = CATEGORY_RECOMMENDATIONS[profile.incomeType] || [];
  // Start with required + recommended
  profile.enabledCategoryIds = ['income_received', 'other_work', ...recommended];
  saveProgress();
  renderStep3();
}

function handleQuickSetup() {
  // Set defaults for quick setup
  profile.incomeType = 'freelancer';
  profile.paysProvisionalTax = 'not_sure';
  profile.cadence = 'monthly';
  profile.incomeVaries = true;
  profile.wantsEstimate = true;
  profile.estimateDetail = 'simple';
  profile.enabledCategoryIds = [
    'income_received',
    'other_work',
    ...CATEGORY_RECOMMENDATIONS.freelancer,
  ];
  profile.captureMode = 'as_you_go';
  profile.reminderPreference = 'evening';
  profile.reminderDay = 25;
  profile.reminderTime = '18:00';
  profile.hasTaxPractitioner = false;
  profile.usedQuickSetup = true;
  profile.setupComplete = true;
  profile.lastCompletedStep = 4;

  saveProgress();

  Analytics.wizardCompleted(
    profile.incomeType,
    profile.enabledCategoryIds.length,
    true
  );

  showStep('complete');
}

function setupEventListeners() {
  // Step 1: Income type selection
  $$('input[name="incomeType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      profile.incomeType = e.target.value;
      profile.incomeVaries = null; // Reset to recompute in step 2
      profile.enabledCategoryIds = ['income_received', 'other_work']; // Reset categories
      saveProgress();
      updateNextButtonState();
    });
  });

  // Step 1: Provisional tax selection
  $$('input[name="paysProvisionalTax"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      profile.paysProvisionalTax = e.target.value;
      updateExplainerVisibility();
      saveProgress();
    });
  });

  // Step 1: Explainer toggle
  $('#explainer-toggle').addEventListener('click', () => {
    const content = $('#explainer-content');
    const icon = $('.explainer-icon');
    const isOpen = content.classList.contains('open');
    content.classList.toggle('open');
    icon.textContent = isOpen ? '+' : '−';
  });

  // Step 1: Quick setup
  $('#quick-setup-link').addEventListener('click', (e) => {
    e.preventDefault();
    handleQuickSetup();
  });

  // Step 2: Cadence buttons
  $$('#cadence-options .btn-option').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#cadence-options .btn-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      profile.cadence = btn.dataset.value;
      saveProgress();
    });
  });

  // Step 2: Monthly income
  $('#monthly-income').addEventListener('input', (e) => {
    const val = e.target.value;
    profile.typicalMonthlyIncome = val ? parseInt(val, 10) : null;
    saveProgress();
  });

  // Step 2: Income varies toggle
  $('#income-varies').addEventListener('change', (e) => {
    profile.incomeVaries = e.target.checked;
    saveProgress();
  });

  // Step 2: Wants estimate toggle
  $('#wants-estimate').addEventListener('change', (e) => {
    profile.wantsEstimate = e.target.checked;
    $('#estimate-detail-group').style.display = e.target.checked ? 'block' : 'none';
    saveProgress();
  });

  // Step 2: Estimate detail buttons
  $$('#estimate-detail-options .btn-option').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#estimate-detail-options .btn-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      profile.estimateDetail = btn.dataset.value;
      saveProgress();
    });
  });

  // Step 3: Use recommended button
  $('#use-recommended-btn').addEventListener('click', handleUseRecommended);

  // Step 4: Capture mode
  $$('input[name="captureMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      profile.captureMode = e.target.value;
      saveProgress();
    });
  });

  // Step 4: Reminder preference buttons
  $$('#reminder-pref-options .btn-option').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#reminder-pref-options .btn-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      profile.reminderPreference = btn.dataset.value;
      updateReminderTimeOptions();
      saveProgress();
    });
  });

  // Step 4: Reminder day
  $('#reminder-day').addEventListener('change', (e) => {
    profile.reminderDay = parseInt(e.target.value, 10);
    saveProgress();
  });

  // Step 4: Reminder time
  $('#reminder-time').addEventListener('change', (e) => {
    profile.reminderTime = e.target.value;
    saveProgress();
  });

  // Step 4: Has practitioner toggle
  $('#has-practitioner').addEventListener('change', (e) => {
    profile.hasTaxPractitioner = e.target.checked;
    $('#practitioner-email-group').style.display = e.target.checked ? 'block' : 'none';
    saveProgress();
  });

  // Step 4: Practitioner email
  $('#practitioner-email').addEventListener('input', (e) => {
    profile.taxPractitionerEmail = e.target.value || null;
    saveProgress();
  });

  // Navigation: Back button
  $('#btn-back').addEventListener('click', () => {
    if (currentStep > 1) {
      showStep(currentStep - 1);
      renderCurrentStep();
    }
  });

  // Navigation: Next/Complete button
  $('#btn-next').addEventListener('click', () => {
    if (!validateStep(currentStep)) return;

    // Mark step as completed
    Analytics.stepCompleted(currentStep, profile.incomeType);
    profile.lastCompletedStep = Math.max(profile.lastCompletedStep || 0, currentStep);

    if (currentStep < 4) {
      showStep(currentStep + 1);
      renderCurrentStep();
      saveProgress();
    } else {
      // Complete setup
      profile.setupComplete = true;
      saveProgress();

      Analytics.wizardCompleted(
        profile.incomeType,
        profile.enabledCategoryIds.length,
        profile.usedQuickSetup || false
      );

      showStep('complete');
    }
  });

  // Progress step clicks (go back to completed steps)
  $$('.progress-steps .step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step, 10);
      if (stepNum <= (profile.lastCompletedStep || 0) + 1 && stepNum < currentStep) {
        goToStep(stepNum);
      }
    });
  });

  // Completion: Go to dashboard
  $('#btn-go-dashboard').addEventListener('click', () => {
    navigateTo('home');
  });

  // Completion: Add expense
  $('#btn-add-expense').addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('expenses-new');
  });

  // Dashboard: Add expense button
  $('#dashboard-add-expense').addEventListener('click', () => {
    navigateTo('expenses-new');
  });

  // Expenses: Back to dashboard
  $('#back-to-dashboard').addEventListener('click', () => {
    navigateTo('home');
  });

  // Track abandonment on page unload
  window.addEventListener('beforeunload', () => {
    if (!profile.setupComplete && profile.incomeType) {
      Analytics.wizardAbandoned(currentStep, profile.incomeType);
    }
  });
}

// ============ NAVIGATION ============

function navigateTo(pageId) {
  // Hide all pages
  $('#setup-wizard').style.display = 'none';
  $('#home').classList.add('hidden');
  $('#expenses-new').classList.add('hidden');

  // Show target page
  const page = $(`#${pageId}`);
  if (page) {
    page.classList.remove('hidden');
    if (pageId === 'setup-wizard') {
      page.style.display = 'block';
    }
  }
}

// ============ PERSISTENCE ============

function saveProgress() {
  try {
    db.saveProfile(profile);
    showToast();
  } catch (e) {
    console.error('Failed to save progress:', e);
    showToast('Failed to save');
  }
}

function loadProgress() {
  profile = db.getProfile();
  return profile;
}

// ============ INITIALIZATION ============

function init() {
  // Load saved profile
  loadProgress();

  // If setup complete, go to home
  if (profile.setupComplete) {
    navigateTo('home');
    return;
  }

  // Log wizard started (only if truly new)
  if (!profile.incomeType) {
    Analytics.wizardStarted();
  }

  // Setup event listeners
  setupEventListeners();

  // Resume from last step
  const resumeStep = db.getResumeStep();
  showStep(resumeStep);
  renderCurrentStep();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
