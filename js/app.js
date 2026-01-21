/**
 * TaxBuddy Setup Wizard
 * Main application logic with warm, educational UX
 */

// ============ DEPENDENCIES ============
const { db, TIER_1_CATEGORIES, RECOMMENDATIONS, MOTIVATIONAL_COPY } = window.TaxBuddyDB;

// ============ STATE ============
let state = {
  currentScreen: 'welcome',
  currentStep: 0,
  stepStartTime: Date.now(),
  wizardStartTime: null
};

// ============ DOM HELPERS ============
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============ ANALYTICS ============
const Analytics = {
  log(event, data = {}) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...data
    };
    console.log('[TaxBuddy Analytics]', payload);
  },

  wizardStarted() {
    state.wizardStartTime = Date.now();
    this.log('wizard_started');
  },

  stepViewed(step) {
    state.stepStartTime = Date.now();
    this.log('wizard_step_viewed', { step });
  },

  stepCompleted(step, incomeType) {
    const duration = Math.round((Date.now() - state.stepStartTime) / 1000);
    this.log('wizard_step_completed', { step, incomeType, duration_seconds: duration });
  },

  quickSetupUsed() {
    this.log('wizard_quick_setup_used');
  },

  wizardCompleted(profile) {
    const totalDuration = Math.round((Date.now() - (state.wizardStartTime || Date.now())) / 1000);
    this.log('wizard_completed', {
      incomeType: profile.incomeType,
      categoriesEnabled: profile.enabledCategoryIds.length,
      usedQuickSetup: profile.usedQuickSetup,
      total_duration_seconds: totalDuration
    });
  }
};

// ============ SCREEN MANAGEMENT ============
function showScreen(screenId) {
  // Hide all screens
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('.wizard-container').classList.remove('active');

  // Show target
  if (screenId === 'wizard') {
    $('.wizard-container').classList.add('active');
  } else {
    const screen = $(`#${screenId}`);
    if (screen) screen.classList.add('active');
  }

  state.currentScreen = screenId;
}

function showStep(stepNum) {
  // Hide all steps
  $$('.step').forEach(s => s.classList.remove('active'));

  // Show target step
  const step = $(`#step-${stepNum}`);
  if (step) step.classList.add('active');

  state.currentStep = stepNum;
  updateProgressBar(stepNum);
  Analytics.stepViewed(stepNum);

  // Render step-specific content
  if (stepNum === 2) renderStep2();
  if (stepNum === 3) renderStep3();
  if (stepNum === 4) renderStep4();

  // Save current position
  const profile = db.getProfile();
  db.updateProfile({ currentStep: stepNum });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgressBar(step) {
  // Update text
  $('#progress-text').textContent = `Step ${step} of 4`;

  // Update fill (0% at step 1, 100% at step 4)
  const percent = ((step - 1) / 3) * 100;
  $('#progress-fill').style.width = `${percent}%`;

  // Update dots
  $$('.progress-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'completed');

    if (dotStep < step) {
      dot.classList.add('completed');
    } else if (dotStep === step) {
      dot.classList.add('active');
    }
  });
}

// ============ NAVIGATION ============
function goToStep(step) {
  const profile = db.getProfile();

  // Can only go to completed steps or current step
  if (step > profile.lastCompletedStep + 1) return;
  if (step < 1 || step > 4) return;

  showScreen('wizard');
  showStep(step);

  // Update browser history
  history.pushState({ step }, '', `#step-${step}`);
}

function goBack() {
  if (state.currentStep > 1) {
    goToStep(state.currentStep - 1);
  }
}

function goNext() {
  const profile = db.getProfile();

  // Validate current step
  if (!validateStep(state.currentStep)) return;

  // Mark step completed
  Analytics.stepCompleted(state.currentStep, profile.incomeType);
  db.updateProfile({
    lastCompletedStep: Math.max(profile.lastCompletedStep, state.currentStep)
  });

  if (state.currentStep < 4) {
    goToStep(state.currentStep + 1);
  } else {
    completeSetup();
  }
}

// ============ VALIDATION ============
function validateStep(step) {
  clearErrors();
  const profile = db.getProfile();

  switch (step) {
    case 1:
      if (!profile.incomeType) {
        showError('income-type-error', 'Pick your income type to continue. Don\'t worry, you can change this later!');
        return false;
      }
      return true;

    case 2:
      // All optional with defaults
      return true;

    case 3:
      const enabledNonLocked = profile.enabledCategoryIds.filter(id => id !== 'other_work');
      if (enabledNonLocked.length === 0) {
        showError('category-error', 'Pick at least one category to track. You can always add more later!');
        return false;
      }
      return true;

    case 4:
      const day = parseInt($('#reminder-day').value);
      if (day < 1 || day > 28) {
        $('#reminder-day').value = 25;
        db.updateProfile({ reminderDay: 25 });
      }
      return true;

    default:
      return true;
  }
}

function showError(elementId, message) {
  const el = $(`#${elementId}`);
  if (el) {
    el.textContent = message;
    el.classList.add('visible');
  }
}

function clearErrors() {
  $$('.error-message').forEach(el => {
    el.classList.remove('visible');
    el.textContent = '';
  });
}

// ============ STEP 1: INCOME TYPE ============
function setupStep1() {
  const profile = db.getProfile();

  // Income type cards
  $$('input[name="incomeType"]').forEach(input => {
    // Restore saved value
    if (profile.incomeType === input.value) {
      input.checked = true;
      input.closest('.option-card').classList.add('selected');
      $('#provisional-section').classList.add('visible');
    }

    input.addEventListener('change', (e) => {
      // Update visual state
      $$('#income-type-cards .option-card').forEach(c => c.classList.remove('selected'));
      e.target.closest('.option-card').classList.add('selected');

      // Save and show provisional section
      db.updateProfile({
        incomeType: e.target.value,
        enabledCategoryIds: ['other_work'], // Reset categories
        incomeVaries: null // Will be computed in step 2
      });

      $('#provisional-section').classList.add('visible');
      updateContinueButton(1);
    });
  });

  // Provisional tax pills
  $$('input[name="provisionalTax"]').forEach(input => {
    if (profile.paysProvisionalTax === input.value) {
      input.checked = true;
    }

    input.addEventListener('change', (e) => {
      db.updateProfile({ paysProvisionalTax: e.target.value });

      // Show explainer if "not sure"
      if (e.target.value === 'not_sure') {
        $('#provisional-explainer').classList.add('visible');
      } else {
        $('#provisional-explainer').classList.remove('visible');
      }
    });
  });

  // Restore provisional explainer state
  if (profile.paysProvisionalTax === 'not_sure') {
    $('#provisional-explainer').classList.add('visible');
  }

  // Continue button
  $('#step1-continue').addEventListener('click', goNext);
  updateContinueButton(1);
}

// ============ STEP 2: INCOME DETAILS ============
function setupStep2() {
  // Cadence segment
  $$('#cadence-segment .segment').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#cadence-segment .segment').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      db.updateProfile({ cadence: btn.dataset.value });

      // Show helper for "varies"
      if (btn.dataset.value === 'varies') {
        $('#cadence-helper').textContent = 'No problem — we\'ll help you track it flexibly';
      } else {
        $('#cadence-helper').textContent = '';
      }
    });
  });

  // Monthly income
  $('#monthly-income').addEventListener('input', (e) => {
    const val = e.target.value;
    db.updateProfile({ typicalMonthlyIncome: val ? parseInt(val) : null });
  });

  // Income varies toggle
  $('#income-varies').addEventListener('change', (e) => {
    db.updateProfile({ incomeVaries: e.target.checked });
    if (e.target.checked) {
      $('#income-varies-helper').textContent = 'We\'ll help you track the ups and downs';
    } else {
      $('#income-varies-helper').textContent = '';
    }
  });

  // Wants estimate toggle
  $('#wants-estimate').addEventListener('change', (e) => {
    db.updateProfile({ wantsEstimate: e.target.checked });
    if (e.target.checked) {
      $('#estimate-detail-section').classList.add('visible');
    } else {
      $('#estimate-detail-section').classList.remove('visible');
    }
  });

  // Estimate detail cards
  $$('#estimate-detail-cards .small-card').forEach(card => {
    card.addEventListener('click', () => {
      $$('#estimate-detail-cards .small-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      db.updateProfile({ estimateDetail: card.querySelector('input').value });
    });
  });

  // Navigation
  $('#step2-back').addEventListener('click', goBack);
  $('#step2-continue').addEventListener('click', goNext);
}

function renderStep2() {
  const profile = db.getProfile();

  // Set income varies default based on income type
  if (profile.incomeVaries === null) {
    const shouldVary = ['freelancer', 'business', 'mixed'].includes(profile.incomeType);
    db.updateProfile({ incomeVaries: shouldVary });
    $('#income-varies').checked = shouldVary;
    if (shouldVary) {
      $('#income-varies-helper').textContent = 'We\'ll help you track the ups and downs';
    }
  } else {
    $('#income-varies').checked = profile.incomeVaries;
    if (profile.incomeVaries) {
      $('#income-varies-helper').textContent = 'We\'ll help you track the ups and downs';
    }
  }

  // Restore other values
  $$('#cadence-segment .segment').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === profile.cadence);
  });

  if (profile.typicalMonthlyIncome) {
    $('#monthly-income').value = profile.typicalMonthlyIncome;
  }

  $('#wants-estimate').checked = profile.wantsEstimate;
  if (profile.wantsEstimate) {
    $('#estimate-detail-section').classList.add('visible');
  }

  $$('#estimate-detail-cards .small-card').forEach(card => {
    const val = card.querySelector('input').value;
    card.classList.toggle('selected', val === profile.estimateDetail);
  });
}

// ============ STEP 3: CATEGORIES ============
function setupStep3() {
  // Use recommended button
  $('#use-recommended-btn').addEventListener('click', () => {
    const profile = db.getProfile();
    const recommended = RECOMMENDATIONS[profile.incomeType] || [];
    const newEnabled = ['other_work', ...recommended];
    db.updateProfile({ enabledCategoryIds: newEnabled });
    renderStep3();
    updateContinueButton(3);
  });

  // Navigation
  $('#step3-back').addEventListener('click', goBack);
  $('#step3-continue').addEventListener('click', goNext);
}

function renderStep3() {
  const profile = db.getProfile();
  const categories = db.getCategories();
  const recommended = RECOMMENDATIONS[profile.incomeType] || [];

  const list = $('#category-list');
  list.innerHTML = categories.map(cat => {
    const isRecommended = recommended.includes(cat.id);
    const isEnabled = profile.enabledCategoryIds.includes(cat.id);
    const isLocked = cat.isLocked;

    return `
      <div class="category-item ${isEnabled ? 'enabled' : ''} ${isLocked ? 'locked' : ''}"
           data-id="${cat.id}"
           data-testid="category-toggle-${cat.id}">
        <div class="category-toggle"></div>
        <div class="category-content">
          <div class="category-header">
            <span class="category-name">${cat.name}</span>
            ${isRecommended ? '<span class="category-badge recommended">Recommended</span>' : ''}
            ${isLocked ? '<span class="category-badge required">Required</span>' : ''}
          </div>
          <div class="category-desc">${cat.description}</div>
          ${cat.tip ? `<div class="category-tip">${cat.tip}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  $$('.category-item').forEach(item => {
    if (item.classList.contains('locked')) return;

    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const profile = db.getProfile();
      let enabled = [...profile.enabledCategoryIds];

      if (enabled.includes(id)) {
        enabled = enabled.filter(i => i !== id);
        item.classList.remove('enabled');
      } else {
        enabled.push(id);
        item.classList.add('enabled');
      }

      db.updateProfile({ enabledCategoryIds: enabled });
      updateMotivationalCallout();
      updateContinueButton(3);
    });
  });

  updateMotivationalCallout();
  updateContinueButton(3);
}

function updateMotivationalCallout() {
  const profile = db.getProfile();
  const copy = MOTIVATIONAL_COPY[profile.incomeType];
  const callout = $('#motivational-callout');

  // Show if at least one non-locked category is enabled
  const enabledNonLocked = profile.enabledCategoryIds.filter(id => id !== 'other_work');
  if (enabledNonLocked.length > 0 && copy) {
    callout.innerHTML = `<p><span class="emoji">${copy.emoji}</span> ${copy.text}</p>`;
    callout.classList.add('visible');
  } else {
    callout.classList.remove('visible');
  }
}

// ============ STEP 4: PREFERENCES ============
function setupStep4() {
  // Capture mode cards
  $$('#capture-mode-cards input[name="captureMode"]').forEach(input => {
    input.addEventListener('change', () => {
      $$('#capture-mode-cards .option-card').forEach(c => c.classList.remove('selected'));
      input.closest('.option-card').classList.add('selected');
      db.updateProfile({ captureMode: input.value });
    });
  });

  // Number input buttons
  $$('.number-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $(`#${btn.dataset.target}`);
      let val = parseInt(input.value) || 25;

      if (btn.classList.contains('minus')) {
        val = Math.max(1, val - 1);
      } else {
        val = Math.min(28, val + 1);
      }

      input.value = val;
      db.updateProfile({ reminderDay: val });
    });
  });

  $('#reminder-day').addEventListener('change', (e) => {
    let val = parseInt(e.target.value);
    val = Math.max(1, Math.min(28, val || 25));
    e.target.value = val;
    db.updateProfile({ reminderDay: val });
  });

  // Reminder preference
  $$('#reminder-pref-segment .segment').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#reminder-pref-segment .segment').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pref = btn.dataset.value;
      db.updateProfile({ reminderPreference: pref });
      populateTimeOptions(pref);
    });
  });

  // Reminder time
  $('#reminder-time').addEventListener('change', (e) => {
    db.updateProfile({ reminderTime: e.target.value });
  });

  // Tax practitioner toggle
  $('#has-practitioner').addEventListener('change', (e) => {
    db.updateProfile({ hasTaxPractitioner: e.target.checked });
    if (e.target.checked) {
      $('#practitioner-section').classList.add('visible');
    } else {
      $('#practitioner-section').classList.remove('visible');
    }
  });

  // Practitioner email
  $('#practitioner-email').addEventListener('input', (e) => {
    db.updateProfile({ taxPractitionerEmail: e.target.value || null });
  });

  // Navigation
  $('#step4-back').addEventListener('click', goBack);
  $('#step4-continue').addEventListener('click', goNext);
}

function renderStep4() {
  const profile = db.getProfile();

  // Capture mode
  $$('#capture-mode-cards .option-card').forEach(card => {
    const input = card.querySelector('input');
    if (input.value === profile.captureMode) {
      input.checked = true;
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  });

  // Reminder day
  $('#reminder-day').value = profile.reminderDay;

  // Reminder preference
  $$('#reminder-pref-segment .segment').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === profile.reminderPreference);
  });

  // Populate and select time
  populateTimeOptions(profile.reminderPreference);
  $('#reminder-time').value = profile.reminderTime;

  // Practitioner
  $('#has-practitioner').checked = profile.hasTaxPractitioner;
  if (profile.hasTaxPractitioner) {
    $('#practitioner-section').classList.add('visible');
  }
  if (profile.taxPractitionerEmail) {
    $('#practitioner-email').value = profile.taxPractitionerEmail;
  }
}

function populateTimeOptions(preference) {
  const select = $('#reminder-time');
  const profile = db.getProfile();

  const isMorning = preference === 'morning';
  const times = isMorning
    ? ['07:00', '08:00', '09:00', '10:00', '11:00']
    : ['17:00', '18:00', '19:00', '20:00', '21:00'];

  select.innerHTML = times.map(t => `<option value="${t}">${t}</option>`).join('');

  // Select current or default
  const defaultTime = isMorning ? '09:00' : '18:00';
  const currentTime = profile.reminderTime;

  if (times.includes(currentTime)) {
    select.value = currentTime;
  } else {
    select.value = defaultTime;
    db.updateProfile({ reminderTime: defaultTime });
  }
}

// ============ COMPLETION ============
function completeSetup() {
  const profile = db.getProfile();

  db.updateProfile({
    setupComplete: true,
    lastCompletedStep: 4
  });

  Analytics.wizardCompleted(db.getProfile());

  renderCompletion();
  showScreen('completion');

  // Trigger confetti animation
  createConfetti();
}

function renderCompletion() {
  const profile = db.getProfile();

  const incomeTypeLabels = {
    employee: '💼 Employee',
    freelancer: '🎨 Freelancer',
    business: '🏢 Business Owner',
    mixed: '🔀 Mixed Income'
  };

  const categoryCount = profile.enabledCategoryIds.length;
  const reminderLabel = `🔔 Reminders on the ${profile.reminderDay}${getOrdinal(profile.reminderDay)} at ${profile.reminderTime}`;

  $('#summary-items').innerHTML = `
    <div class="summary-item">
      <span class="summary-item-icon">${incomeTypeLabels[profile.incomeType]?.split(' ')[0] || '📋'}</span>
      <span>${incomeTypeLabels[profile.incomeType]?.split(' ').slice(1).join(' ') || profile.incomeType}</span>
    </div>
    <div class="summary-item">
      <span class="summary-item-icon">📁</span>
      <span>${categoryCount} expense ${categoryCount === 1 ? 'category' : 'categories'} active</span>
    </div>
    <div class="summary-item">
      <span class="summary-item-icon">🔔</span>
      <span>Reminders on the ${profile.reminderDay}${getOrdinal(profile.reminderDay)} at ${profile.reminderTime}</span>
    </div>
  `;
}

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function createConfetti() {
  const container = $('#confetti');
  const colors = ['#0D9488', '#F59E0B', '#10B981', '#3B82F6', '#EC4899'];

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: absolute;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -10px;
      opacity: 0;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation: confettiFall ${1.5 + Math.random()}s ease-out ${Math.random() * 0.5}s forwards;
    `;
    container.appendChild(confetti);
  }

  // Add confetti animation
  if (!document.getElementById('confetti-styles')) {
    const style = document.createElement('style');
    style.id = 'confetti-styles';
    style.textContent = `
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(200px) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Clean up after animation
  setTimeout(() => {
    container.innerHTML = '';
  }, 3000);
}

// ============ QUICK SETUP ============
function quickSetup() {
  Analytics.quickSetupUsed();
  db.applyQuickSetup();
  Analytics.wizardCompleted(db.getProfile());
  renderCompletion();
  showScreen('completion');
  createConfetti();
}

// ============ CONTINUE BUTTON STATE ============
function updateContinueButton(step) {
  const profile = db.getProfile();
  let isValid = false;

  switch (step) {
    case 1:
      isValid = !!profile.incomeType;
      $('#step1-continue').disabled = !isValid;
      break;
    case 3:
      const enabledNonLocked = profile.enabledCategoryIds.filter(id => id !== 'other_work');
      isValid = enabledNonLocked.length > 0;
      $('#step3-continue').disabled = !isValid;
      break;
  }
}

// ============ BROWSER HISTORY ============
function setupHistory() {
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.step) {
      showScreen('wizard');
      showStep(e.state.step);
    } else if (location.hash === '' || location.hash === '#welcome') {
      showScreen('welcome');
    }
  });
}

// ============ INITIALIZATION ============
function init() {
  const profile = db.getProfile();

  // Setup all step handlers
  setupStep1();
  setupStep2();
  setupStep3();
  setupStep4();
  setupHistory();

  // Welcome screen handlers
  $('#welcome-start-btn').addEventListener('click', () => {
    Analytics.wizardStarted();
    goToStep(1);
  });

  $('#welcome-quick-setup').addEventListener('click', (e) => {
    e.preventDefault();
    quickSetup();
  });

  // Completion screen handlers
  $('#add-expense-btn').addEventListener('click', () => {
    showScreen('add-expense');
  });

  $('#dashboard-btn').addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('dashboard');
  });

  // Progress dot navigation
  $$('.progress-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const step = parseInt(dot.dataset.step);
      const profile = db.getProfile();

      // Only allow clicking completed steps
      if (step <= profile.lastCompletedStep) {
        goToStep(step);
      }
    });
  });

  // Resume from saved state
  if (profile.setupComplete) {
    renderCompletion();
    showScreen('completion');
  } else if (profile.currentStep > 0) {
    // Resume wizard
    showScreen('wizard');
    showStep(profile.currentStep);
  } else {
    // Fresh start
    showScreen('welcome');
  }
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
