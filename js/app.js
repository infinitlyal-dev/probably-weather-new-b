/**
 * TaxBuddy Application
 * Setup Wizard + Core App (Dashboard, Expenses, Add/Edit)
 */

(function() {
  'use strict';

  console.log('[TaxBuddy] app.js loading...');

  // ============ DEPENDENCIES ============
  if (!window.TaxBuddyDB) {
    console.error('[TaxBuddy] FATAL: TaxBuddyDB not loaded!');
    return;
  }

  const db = window.TaxBuddyDB.db;
  const RECOMMENDATIONS = window.TaxBuddyDB.RECOMMENDATIONS;
  const MOTIVATIONAL_COPY = window.TaxBuddyDB.MOTIVATIONAL_COPY;

  // ============ STATE ============
  let state = {
    currentScreen: 'welcome',
    currentStep: 0,
    stepStartTime: Date.now(),
    wizardStartTime: null,
    editingExpenseId: null,
    currentFilter: 'all',
    currentCategoryFilter: null
  };

  // ============ DOM HELPERS ============
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ============ UTILITIES ============
  function formatCurrency(amount) {
    return 'R ' + (amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatMonthYear(dateStr) {
    const [year, month] = dateStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function getTaxYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month < 2) return `${year - 1}/${year.toString().slice(-2)}`;
    return `${year}/${(year + 1).toString().slice(-2)}`;
  }

  function getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  function showToast(message, type = 'success') {
    const existing = $('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============ ANALYTICS ============
  const Analytics = {
    log(event, data = {}) {
      console.log('[TaxBuddy Analytics]', { event, timestamp: new Date().toISOString(), ...data });
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
    },
    dashboardViewed() {
      this.log('dashboard_viewed', { totalExpenses: db.getExpenseCount(), totalAmount: db.getTotalClaimable() });
    },
    filterApplied(filterType) {
      this.log('filter_applied', { filterType });
    }
  };

  // ============ ROUTING ============
  function navigate(screen, data = {}) {
    state.currentScreen = screen;
    if (data.expenseId) state.editingExpenseId = data.expenseId;

    // Update URL hash
    const hash = screen === 'dashboard' ? '' : screen;
    history.pushState({ screen, ...data }, '', hash ? `#${hash}` : '#');

    renderScreen(screen);
  }

  function handleHashChange() {
    const hash = location.hash.slice(1) || 'dashboard';

    // Check if setup is complete
    if (!db.isSetupComplete() && !['welcome', 'wizard'].includes(hash) && !hash.startsWith('step-')) {
      navigate('welcome');
      return;
    }

    if (hash.startsWith('edit-')) {
      const expenseId = hash.replace('edit-', '');
      navigate('edit-expense', { expenseId });
    } else {
      navigate(hash);
    }
  }

  // ============ SCREEN RENDERING ============
  function renderScreen(screen) {
    // Hide all screens
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('.wizard-container')?.classList.remove('active');

    // Show/hide navigation
    const showNav = ['dashboard', 'expenses', 'add-expense', 'edit-expense', 'settings'].includes(screen);
    const nav = $('#bottom-nav');
    if (nav) nav.style.display = showNav ? 'flex' : 'none';

    // Render specific screen
    switch (screen) {
      case 'welcome':
        $('#welcome')?.classList.add('active');
        break;
      case 'wizard':
        $('.wizard-container')?.classList.add('active');
        break;
      case 'completion':
        $('#completion')?.classList.add('active');
        break;
      case 'dashboard':
        renderDashboard();
        $('#app-dashboard')?.classList.add('active');
        Analytics.dashboardViewed();
        break;
      case 'expenses':
        renderExpensesList();
        $('#app-expenses')?.classList.add('active');
        break;
      case 'add-expense':
        renderExpenseForm();
        $('#app-expense-form')?.classList.add('active');
        break;
      case 'edit-expense':
        renderExpenseForm(state.editingExpenseId);
        $('#app-expense-form')?.classList.add('active');
        break;
      case 'settings':
        $('#app-settings')?.classList.add('active');
        break;
      default:
        if (screen.startsWith('step-')) {
          $('.wizard-container')?.classList.add('active');
          showStep(parseInt(screen.replace('step-', '')));
        }
    }

    // Update nav active state
    updateNavState(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNavState(screen) {
    $$('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.screen === screen) item.classList.add('active');
      if (screen === 'edit-expense' && item.dataset.screen === 'expenses') item.classList.add('active');
    });
  }

  // ============ DASHBOARD ============
  function renderDashboard() {
    const container = $('#app-dashboard');
    if (!container) return;

    const totalClaimable = db.getTotalClaimable();
    const thisMonthTotal = db.getThisMonthTotal();
    const expenseCount = db.getExpenseCount();
    const recentExpenses = db.getRecentExpenses(5);
    const tip = db.getRandomTip();

    container.innerHTML = `
      <div class="app-header">
        <div class="header-left">
          <span class="app-logo">🌿</span>
          <span class="app-title">TaxBuddy</span>
        </div>
        <div class="header-right">
          <span class="tax-year">${getTaxYear()} Tax Year</span>
        </div>
      </div>

      <div class="dashboard-content">
        <div class="greeting-section">
          <h1>${getGreeting()}, welcome back 👋</h1>
          <p>Here's your tax tracking progress</p>
        </div>

        <div class="summary-cards-row">
          <div class="summary-card-item">
            <div class="summary-card-value">${formatCurrency(totalClaimable)}</div>
            <div class="summary-card-label">Total potential deductions</div>
          </div>
          <div class="summary-card-item">
            <div class="summary-card-value">${formatCurrency(thisMonthTotal)}</div>
            <div class="summary-card-label">This month</div>
          </div>
          <div class="summary-card-item">
            <div class="summary-card-value">${expenseCount}</div>
            <div class="summary-card-label">Expenses logged</div>
          </div>
        </div>

        <button class="btn btn-primary btn-large quick-add-btn" onclick="TaxBuddyApp.navigate('add-expense')">
          ➕ Add an Expense
        </button>

        ${expenseCount === 0 ? renderEmptyState() : renderRecentExpenses(recentExpenses)}

        <div class="tip-of-day">
          <span class="tip-icon">💡</span>
          <span>${tip}</span>
        </div>
      </div>
    `;
  }

  function renderEmptyState() {
    return `
      <div class="empty-state-card">
        <div class="empty-state-icon">📝</div>
        <h3>Ready to start tracking?</h3>
        <p>Every expense you log is a potential deduction. Start with something simple — maybe your phone bill or a work-related purchase.</p>
        <button class="btn btn-primary" onclick="TaxBuddyApp.navigate('add-expense')">Add my first expense</button>
      </div>
    `;
  }

  function renderRecentExpenses(expenses) {
    return `
      <div class="recent-expenses-section">
        <div class="section-header">
          <h3>Recent expenses</h3>
          <a href="#expenses" class="view-all-link">View all →</a>
        </div>
        <div class="expense-list">
          ${expenses.map(exp => renderExpenseCard(exp)).join('')}
        </div>
      </div>
    `;
  }

  function renderExpenseCard(expense, showFullDate = false) {
    const category = db.getCategoryById(expense.categoryId);
    const icon = db.getCategoryIcon(expense.categoryId);
    const dateDisplay = showFullDate ? formatDate(expense.date) : formatDate(expense.date);
    const hasReceipt = expense.receiptImage ? '<span class="receipt-indicator">📎</span>' : '';

    return `
      <div class="expense-card" onclick="TaxBuddyApp.navigate('edit-expense', { expenseId: '${expense.id}' })">
        <div class="expense-card-left">
          <span class="expense-icon">${icon}</span>
          <div class="expense-details">
            <div class="expense-description">${expense.description} ${hasReceipt}</div>
            <div class="expense-meta">${category?.name || 'Other'} · ${dateDisplay}</div>
            ${expense.workPercentage < 100 ? `<div class="expense-claim">${expense.workPercentage}% work use · ${formatCurrency(expense.claimableAmount)} claimable</div>` : ''}
          </div>
        </div>
        <div class="expense-amount">${formatCurrency(expense.amount)}</div>
      </div>
    `;
  }

  // ============ EXPENSES LIST ============
  function renderExpensesList() {
    const container = $('#app-expenses');
    if (!container) return;

    const allExpenses = db.getExpenses();
    const expenseCount = allExpenses.length;

    container.innerHTML = `
      <div class="app-header">
        <h1>Your Expenses</h1>
        <span class="expense-count">${expenseCount} expense${expenseCount !== 1 ? 's' : ''} logged</span>
      </div>

      <div class="filter-bar">
        <button class="filter-chip ${state.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
        <button class="filter-chip ${state.currentFilter === 'this-month' ? 'active' : ''}" data-filter="this-month">This month</button>
        <button class="filter-chip ${state.currentFilter === 'last-month' ? 'active' : ''}" data-filter="last-month">Last month</button>
        <select class="category-filter-select" id="category-filter">
          <option value="">By category</option>
          ${db.getEnabledCategories().map(cat => `<option value="${cat.id}" ${state.currentCategoryFilter === cat.id ? 'selected' : ''}>${cat.name}</option>`).join('')}
        </select>
      </div>

      <div class="expenses-list-container" id="expenses-list-container">
        ${renderFilteredExpenses()}
      </div>
    `;

    // Attach filter handlers
    $$('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        state.currentFilter = chip.dataset.filter;
        state.currentCategoryFilter = null;
        $('#category-filter').value = '';
        Analytics.filterApplied(chip.dataset.filter);
        renderExpensesList();
      });
    });

    $('#category-filter')?.addEventListener('change', (e) => {
      state.currentCategoryFilter = e.target.value || null;
      state.currentFilter = 'all';
      Analytics.filterApplied('category:' + e.target.value);
      renderExpensesList();
    });
  }

  function renderFilteredExpenses() {
    let expenses = db.getExpenses();
    const now = new Date();

    // Apply time filter
    if (state.currentFilter === 'this-month') {
      expenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    } else if (state.currentFilter === 'last-month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      expenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      });
    }

    // Apply category filter
    if (state.currentCategoryFilter) {
      expenses = expenses.filter(e => e.categoryId === state.currentCategoryFilter);
    }

    if (expenses.length === 0) {
      return `
        <div class="empty-state-card">
          <div class="empty-state-icon">🔍</div>
          <h3>No expenses found</h3>
          <p>Try adjusting your filters or add a new expense</p>
          <button class="btn btn-primary" onclick="TaxBuddyApp.navigate('add-expense')">Add Expense</button>
        </div>
      `;
    }

    // Group by month
    const grouped = {};
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) {
        grouped[key] = { expenses: [], total: 0 };
      }
      grouped[key].expenses.push(expense);
      grouped[key].total += expense.claimableAmount || 0;
    });

    const sortedKeys = Object.keys(grouped).sort().reverse();

    return sortedKeys.map(key => `
      <div class="month-group">
        <div class="month-header">
          <span class="month-name">${formatMonthYear(key)}</span>
          <span class="month-total">${formatCurrency(grouped[key].total)} (${grouped[key].expenses.length} expense${grouped[key].expenses.length !== 1 ? 's' : ''})</span>
        </div>
        <div class="expense-list">
          ${grouped[key].expenses.map(exp => renderExpenseCard(exp, true)).join('')}
        </div>
      </div>
    `).join('');
  }

  // ============ EXPENSE FORM ============
  function renderExpenseForm(expenseId = null) {
    const container = $('#app-expense-form');
    if (!container) return;

    const isEdit = !!expenseId;
    const expense = isEdit ? db.getExpenseById(expenseId) : null;
    const enabledCategories = db.getEnabledCategories();

    // Determine if we should show work percentage
    const selectedCategoryId = expense?.categoryId || 'other_work';
    const selectedCategory = db.getCategoryById(selectedCategoryId);
    const showWorkPercentage = selectedCategory?.showWorkPercentage || false;

    container.innerHTML = `
      <div class="form-header">
        <button class="back-btn" onclick="history.back()">← Back</button>
        <h1>${isEdit ? 'Edit Expense' : 'Add Expense'}</h1>
      </div>

      <form id="expense-form" class="expense-form">
        <div class="form-group">
          <label class="form-label">Receipt photo <span class="optional-badge">Optional</span></label>
          <div class="receipt-upload" id="receipt-upload">
            ${expense?.receiptImage ?
              `<div class="receipt-preview">
                <img src="${expense.receiptImage}" alt="Receipt">
                <button type="button" class="remove-receipt-btn" onclick="TaxBuddyApp.removeReceipt()">✕ Remove</button>
              </div>` :
              `<div class="receipt-placeholder">
                <span class="receipt-placeholder-icon">📷</span>
                <span>Tap to add receipt photo</span>
              </div>`
            }
            <input type="file" id="receipt-input" accept="image/*" style="display: none;">
          </div>
          <p class="field-helper">💡 Photos help if SARS ever asks for proof</p>
        </div>

        <div class="form-group">
          <label class="form-label">How much? <span class="required">*</span></label>
          <div class="amount-input-wrapper">
            <span class="amount-prefix">R</span>
            <input type="number" id="expense-amount" class="amount-input" placeholder="0.00" step="0.01" min="0" value="${expense?.amount || ''}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">What was it for? <span class="required">*</span></label>
          <input type="text" id="expense-description" class="text-input" placeholder="e.g. Vodacom monthly bill, Uber to client meeting" value="${expense?.description || ''}" required>
        </div>

        <div class="form-group">
          <label class="form-label">Category <span class="required">*</span></label>
          <div class="category-chips" id="category-chips">
            ${enabledCategories.map(cat => `
              <label class="category-chip ${expense?.categoryId === cat.id || (!expense && cat.id === 'other_work') ? 'selected' : ''}">
                <input type="radio" name="categoryId" value="${cat.id}" ${expense?.categoryId === cat.id || (!expense && cat.id === 'other_work') ? 'checked' : ''}>
                <span class="chip-icon">${db.getCategoryIcon(cat.id)}</span>
                <span class="chip-label">${cat.name.split(' ')[0]}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Date <span class="required">*</span></label>
          <input type="date" id="expense-date" class="date-input" value="${expense?.date || getTodayString()}" max="${getTodayString()}" required>
        </div>

        <div class="form-group work-percentage-group" id="work-percentage-group" style="display: ${showWorkPercentage ? 'block' : 'none'}">
          <label class="form-label">What percentage is for work?</label>
          <select id="expense-work-percentage" class="select-input">
            <option value="25" ${expense?.workPercentage === 25 ? 'selected' : ''}>25%</option>
            <option value="50" ${expense?.workPercentage === 50 || !expense ? 'selected' : ''}>50%</option>
            <option value="75" ${expense?.workPercentage === 75 ? 'selected' : ''}>75%</option>
            <option value="100" ${expense?.workPercentage === 100 ? 'selected' : ''}>100%</option>
          </select>
          <p class="field-helper">💡 Only claim the portion you actually use for work</p>
        </div>

        <div class="form-group">
          <label class="form-label">Notes <span class="optional-badge">Optional</span></label>
          <textarea id="expense-notes" class="textarea-input" placeholder="Any extra details..." rows="2">${expense?.notes || ''}</textarea>
        </div>

        <input type="hidden" id="expense-receipt" value="${expense?.receiptImage || ''}">

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-large" id="save-expense-btn">
            ${isEdit ? 'Save Changes' : 'Save Expense'}
          </button>
        </div>

        ${isEdit ? `
          <div class="delete-section">
            <button type="button" class="btn btn-danger-outline" id="delete-expense-btn">
              Delete Expense
            </button>
          </div>
        ` : ''}
      </form>
    `;

    // Attach event handlers
    setupExpenseFormHandlers(isEdit, expenseId);
  }

  function setupExpenseFormHandlers(isEdit, expenseId) {
    // Receipt upload
    const receiptUpload = $('#receipt-upload');
    const receiptInput = $('#receipt-input');

    receiptUpload?.addEventListener('click', (e) => {
      if (!e.target.classList.contains('remove-receipt-btn')) {
        receiptInput?.click();
      }
    });

    receiptInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Image too large. Please use an image under 5MB.', 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          $('#expense-receipt').value = event.target.result;
          receiptUpload.innerHTML = `
            <div class="receipt-preview">
              <img src="${event.target.result}" alt="Receipt">
              <button type="button" class="remove-receipt-btn" onclick="TaxBuddyApp.removeReceipt()">✕ Remove</button>
            </div>
            <input type="file" id="receipt-input" accept="image/*" style="display: none;">
          `;
        };
        reader.readAsDataURL(file);
      }
    });

    // Category change - show/hide work percentage
    $$('input[name="categoryId"]').forEach(input => {
      input.addEventListener('change', (e) => {
        $$('.category-chip').forEach(c => c.classList.remove('selected'));
        e.target.closest('.category-chip').classList.add('selected');

        const category = db.getCategoryById(e.target.value);
        const workPercentageGroup = $('#work-percentage-group');
        if (category?.showWorkPercentage) {
          workPercentageGroup.style.display = 'block';
        } else {
          workPercentageGroup.style.display = 'none';
          $('#expense-work-percentage').value = '100';
        }
      });
    });

    // Form submission
    $('#expense-form')?.addEventListener('submit', (e) => {
      e.preventDefault();

      const amount = parseFloat($('#expense-amount').value);
      const description = $('#expense-description').value.trim();
      const categoryId = $('input[name="categoryId"]:checked')?.value;
      const date = $('#expense-date').value;
      const workPercentage = parseInt($('#expense-work-percentage').value) || 100;
      const notes = $('#expense-notes').value.trim();
      const receiptImage = $('#expense-receipt').value;

      if (!amount || !description || !categoryId || !date) {
        showToast('Please fill in all required fields', 'error');
        return;
      }

      const expenseData = {
        amount,
        description,
        categoryId,
        date,
        workPercentage,
        notes: notes || null,
        receiptImage: receiptImage || null
      };

      if (isEdit) {
        db.updateExpense(expenseId, expenseData);
        showToast('Expense updated!');
      } else {
        db.addExpense(expenseData);
        showToast(`Expense saved! ${formatCurrency(amount * workPercentage / 100)} added to your deductions`);
      }

      navigate('expenses');
    });

    // Delete button
    $('#delete-expense-btn')?.addEventListener('click', () => {
      showDeleteConfirmation(expenseId);
    });
  }

  function removeReceipt() {
    $('#expense-receipt').value = '';
    const receiptUpload = $('#receipt-upload');
    receiptUpload.innerHTML = `
      <div class="receipt-placeholder">
        <span class="receipt-placeholder-icon">📷</span>
        <span>Tap to add receipt photo</span>
      </div>
      <input type="file" id="receipt-input" accept="image/*" style="display: none;">
    `;

    // Re-attach handlers
    const receiptInput = $('#receipt-input');
    receiptUpload.addEventListener('click', () => receiptInput?.click());
    receiptInput?.addEventListener('change', handleReceiptUpload);
  }

  function handleReceiptUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        $('#expense-receipt').value = event.target.result;
        $('#receipt-upload').innerHTML = `
          <div class="receipt-preview">
            <img src="${event.target.result}" alt="Receipt">
            <button type="button" class="remove-receipt-btn" onclick="TaxBuddyApp.removeReceipt()">✕ Remove</button>
          </div>
          <input type="file" id="receipt-input" accept="image/*" style="display: none;">
        `;
      };
      reader.readAsDataURL(file);
    }
  }

  function showDeleteConfirmation(expenseId) {
    const expense = db.getExpenseById(expenseId);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Delete this expense?</h3>
        <p>This will remove ${formatCurrency(expense.amount)} from your records. This can't be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $('#confirm-delete-btn').addEventListener('click', () => {
      db.deleteExpense(expenseId);
      modal.remove();
      showToast('Expense deleted');
      navigate('expenses');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // ============ WIZARD FUNCTIONS (from original) ============
  function showScreen(screenId) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    $('.wizard-container')?.classList.remove('active');

    if (screenId === 'wizard') {
      $('.wizard-container')?.classList.add('active');
    } else {
      $(`#${screenId}`)?.classList.add('active');
    }

    state.currentScreen = screenId;
  }

  function showStep(stepNum) {
    $$('.step').forEach(s => s.classList.remove('active'));
    $(`#step-${stepNum}`)?.classList.add('active');

    state.currentStep = stepNum;
    updateProgressBar(stepNum);
    Analytics.stepViewed(stepNum);

    if (stepNum === 2) renderStep2();
    if (stepNum === 3) renderStep3();
    if (stepNum === 4) renderStep4();

    db.updateProfile({ currentStep: stepNum });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgressBar(step) {
    const progressText = $('#progress-text');
    const progressFill = $('#progress-fill');
    if (progressText) progressText.textContent = `Step ${step} of 4`;
    if (progressFill) progressFill.style.width = `${((step - 1) / 3) * 100}%`;

    $$('.progress-dot').forEach(dot => {
      const dotStep = parseInt(dot.dataset.step);
      dot.classList.remove('active', 'completed');
      if (dotStep < step) dot.classList.add('completed');
      else if (dotStep === step) dot.classList.add('active');
    });
  }

  function goToStep(step) {
    const profile = db.getProfile();
    if (step < 1 || step > 4) return;

    const lastCompleted = profile.lastCompletedStep || 0;
    if (step > 1 && step > lastCompleted + 1) return;

    showScreen('wizard');
    showStep(step);
    history.pushState({ step }, '', `#step-${step}`);
  }

  function goBack() {
    if (state.currentStep > 1) goToStep(state.currentStep - 1);
  }

  function goNext() {
    const profile = db.getProfile();
    if (!validateStep(state.currentStep)) return;

    Analytics.stepCompleted(state.currentStep, profile.incomeType);
    db.updateProfile({ lastCompletedStep: Math.max(profile.lastCompletedStep, state.currentStep) });

    if (state.currentStep < 4) {
      goToStep(state.currentStep + 1);
    } else {
      completeSetup();
    }
  }

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
        return true;
      case 3:
        const enabledNonLocked = profile.enabledCategoryIds.filter(id => id !== 'other_work');
        if (enabledNonLocked.length === 0) {
          showError('category-error', 'Pick at least one category to track. You can always add more later!');
          return false;
        }
        return true;
      case 4:
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

  function setupStep1() {
    const profile = db.getProfile();

    $$('input[name="incomeType"]').forEach(input => {
      if (profile.incomeType === input.value) {
        input.checked = true;
        input.closest('.option-card')?.classList.add('selected');
        $('#provisional-section')?.classList.add('visible');
      }

      input.addEventListener('change', (e) => {
        $$('#income-type-cards .option-card').forEach(c => c.classList.remove('selected'));
        e.target.closest('.option-card')?.classList.add('selected');
        db.updateProfile({ incomeType: e.target.value, enabledCategoryIds: ['other_work'], incomeVaries: null });
        $('#provisional-section')?.classList.add('visible');
        updateContinueButton(1);
      });
    });

    $$('input[name="provisionalTax"]').forEach(input => {
      if (profile.paysProvisionalTax === input.value) input.checked = true;
      input.addEventListener('change', (e) => {
        db.updateProfile({ paysProvisionalTax: e.target.value });
        const explainer = $('#provisional-explainer');
        if (e.target.value === 'not_sure') explainer?.classList.add('visible');
        else explainer?.classList.remove('visible');
      });
    });

    if (profile.paysProvisionalTax === 'not_sure') {
      $('#provisional-explainer')?.classList.add('visible');
    }

    $('#step1-continue')?.addEventListener('click', goNext);
    updateContinueButton(1);
  }

  function setupStep2() {
    $$('#cadence-segment .segment').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#cadence-segment .segment').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        db.updateProfile({ cadence: btn.dataset.value });
        const helper = $('#cadence-helper');
        if (helper) helper.textContent = btn.dataset.value === 'varies' ? 'No problem — we\'ll help you track it flexibly' : '';
      });
    });

    $('#monthly-income')?.addEventListener('input', (e) => {
      db.updateProfile({ typicalMonthlyIncome: e.target.value ? parseInt(e.target.value) : null });
    });

    $('#income-varies')?.addEventListener('change', (e) => {
      db.updateProfile({ incomeVaries: e.target.checked });
      const helper = $('#income-varies-helper');
      if (helper) helper.textContent = e.target.checked ? 'We\'ll help you track the ups and downs' : '';
    });

    $('#wants-estimate')?.addEventListener('change', (e) => {
      db.updateProfile({ wantsEstimate: e.target.checked });
      const section = $('#estimate-detail-section');
      if (e.target.checked) section?.classList.add('visible');
      else section?.classList.remove('visible');
    });

    $$('#estimate-detail-cards .small-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('#estimate-detail-cards .small-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        db.updateProfile({ estimateDetail: card.querySelector('input')?.value });
      });
    });

    $('#step2-back')?.addEventListener('click', goBack);
    $('#step2-continue')?.addEventListener('click', goNext);
  }

  function renderStep2() {
    const profile = db.getProfile();

    if (profile.incomeVaries === null) {
      const shouldVary = ['freelancer', 'business', 'mixed'].includes(profile.incomeType);
      db.updateProfile({ incomeVaries: shouldVary });
      const checkbox = $('#income-varies');
      if (checkbox) checkbox.checked = shouldVary;
      if (shouldVary) {
        const helper = $('#income-varies-helper');
        if (helper) helper.textContent = 'We\'ll help you track the ups and downs';
      }
    } else {
      const checkbox = $('#income-varies');
      if (checkbox) checkbox.checked = profile.incomeVaries;
      if (profile.incomeVaries) {
        const helper = $('#income-varies-helper');
        if (helper) helper.textContent = 'We\'ll help you track the ups and downs';
      }
    }

    $$('#cadence-segment .segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === profile.cadence);
    });

    if (profile.typicalMonthlyIncome) {
      const input = $('#monthly-income');
      if (input) input.value = profile.typicalMonthlyIncome;
    }

    const wantsEstimate = $('#wants-estimate');
    if (wantsEstimate) wantsEstimate.checked = profile.wantsEstimate;
    if (profile.wantsEstimate) $('#estimate-detail-section')?.classList.add('visible');

    $$('#estimate-detail-cards .small-card').forEach(card => {
      const val = card.querySelector('input')?.value;
      card.classList.toggle('selected', val === profile.estimateDetail);
    });
  }

  function setupStep3() {
    $('#use-recommended-btn')?.addEventListener('click', () => {
      const profile = db.getProfile();
      const recommended = RECOMMENDATIONS[profile.incomeType] || [];
      db.updateProfile({ enabledCategoryIds: ['other_work', ...recommended] });
      renderStep3();
      updateContinueButton(3);
    });

    $('#step3-back')?.addEventListener('click', goBack);
    $('#step3-continue')?.addEventListener('click', goNext);
  }

  function renderStep3() {
    const profile = db.getProfile();
    const categories = db.getCategories();
    const recommended = RECOMMENDATIONS[profile.incomeType] || [];

    const list = $('#category-list');
    if (!list) return;

    list.innerHTML = categories.map(cat => {
      const isRecommended = recommended.includes(cat.id);
      const isEnabled = profile.enabledCategoryIds.includes(cat.id);
      const isLocked = cat.isLocked;

      return `
        <div class="category-item ${isEnabled ? 'enabled' : ''} ${isLocked ? 'locked' : ''}" data-id="${cat.id}">
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

    $$('.category-item').forEach(item => {
      if (item.classList.contains('locked')) return;
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const currentProfile = db.getProfile();
        let enabled = [...currentProfile.enabledCategoryIds];

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
    if (!callout) return;

    const enabledNonLocked = profile.enabledCategoryIds.filter(id => id !== 'other_work');
    if (enabledNonLocked.length > 0 && copy) {
      callout.innerHTML = `<p><span class="emoji">${copy.emoji}</span> ${copy.text}</p>`;
      callout.classList.add('visible');
    } else {
      callout.classList.remove('visible');
    }
  }

  function setupStep4() {
    $$('#capture-mode-cards input[name="captureMode"]').forEach(input => {
      input.addEventListener('change', () => {
        $$('#capture-mode-cards .option-card').forEach(c => c.classList.remove('selected'));
        input.closest('.option-card')?.classList.add('selected');
        db.updateProfile({ captureMode: input.value });
      });
    });

    $$('.number-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = $(`#${btn.dataset.target}`);
        if (!input) return;
        let val = parseInt(input.value) || 25;
        val = btn.classList.contains('minus') ? Math.max(1, val - 1) : Math.min(28, val + 1);
        input.value = val;
        db.updateProfile({ reminderDay: val });
      });
    });

    $('#reminder-day')?.addEventListener('change', (e) => {
      let val = Math.max(1, Math.min(28, parseInt(e.target.value) || 25));
      e.target.value = val;
      db.updateProfile({ reminderDay: val });
    });

    $$('#reminder-pref-segment .segment').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#reminder-pref-segment .segment').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        db.updateProfile({ reminderPreference: btn.dataset.value });
        populateTimeOptions(btn.dataset.value);
      });
    });

    $('#reminder-time')?.addEventListener('change', (e) => {
      db.updateProfile({ reminderTime: e.target.value });
    });

    $('#has-practitioner')?.addEventListener('change', (e) => {
      db.updateProfile({ hasTaxPractitioner: e.target.checked });
      const section = $('#practitioner-section');
      if (e.target.checked) section?.classList.add('visible');
      else section?.classList.remove('visible');
    });

    $('#practitioner-email')?.addEventListener('input', (e) => {
      db.updateProfile({ taxPractitionerEmail: e.target.value || null });
    });

    $('#step4-back')?.addEventListener('click', goBack);
    $('#step4-continue')?.addEventListener('click', goNext);
  }

  function renderStep4() {
    const profile = db.getProfile();

    $$('#capture-mode-cards .option-card').forEach(card => {
      const input = card.querySelector('input');
      if (input?.value === profile.captureMode) {
        input.checked = true;
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    const reminderDay = $('#reminder-day');
    if (reminderDay) reminderDay.value = profile.reminderDay;

    $$('#reminder-pref-segment .segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === profile.reminderPreference);
    });

    populateTimeOptions(profile.reminderPreference);
    const reminderTime = $('#reminder-time');
    if (reminderTime) reminderTime.value = profile.reminderTime;

    const hasPractitioner = $('#has-practitioner');
    if (hasPractitioner) hasPractitioner.checked = profile.hasTaxPractitioner;
    if (profile.hasTaxPractitioner) $('#practitioner-section')?.classList.add('visible');
    if (profile.taxPractitionerEmail) {
      const email = $('#practitioner-email');
      if (email) email.value = profile.taxPractitionerEmail;
    }
  }

  function populateTimeOptions(preference) {
    const select = $('#reminder-time');
    if (!select) return;

    const profile = db.getProfile();
    const isMorning = preference === 'morning';
    const times = isMorning ? ['07:00', '08:00', '09:00', '10:00', '11:00'] : ['17:00', '18:00', '19:00', '20:00', '21:00'];

    select.innerHTML = times.map(t => `<option value="${t}">${t}</option>`).join('');

    const defaultTime = isMorning ? '09:00' : '18:00';
    if (times.includes(profile.reminderTime)) {
      select.value = profile.reminderTime;
    } else {
      select.value = defaultTime;
      db.updateProfile({ reminderTime: defaultTime });
    }
  }

  function completeSetup() {
    db.updateProfile({ setupComplete: true, lastCompletedStep: 4 });
    Analytics.wizardCompleted(db.getProfile());
    renderCompletion();
    showScreen('completion');
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
    const summaryItems = $('#summary-items');
    if (!summaryItems) return;

    summaryItems.innerHTML = `
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
    if (!container) return;

    const colors = ['#0D9488', '#F59E0B', '#10B981', '#3B82F6', '#EC4899'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: absolute; width: 10px; height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%; top: -10px; opacity: 0;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        animation: confettiFall ${1.5 + Math.random()}s ease-out ${Math.random() * 0.5}s forwards;
      `;
      container.appendChild(confetti);
    }

    if (!document.getElementById('confetti-styles')) {
      const style = document.createElement('style');
      style.id = 'confetti-styles';
      style.textContent = `@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(200px) rotate(720deg); opacity: 0; } }`;
      document.head.appendChild(style);
    }

    setTimeout(() => { container.innerHTML = ''; }, 3000);
  }

  function quickSetup() {
    Analytics.quickSetupUsed();
    db.applyQuickSetup();
    Analytics.wizardCompleted(db.getProfile());
    renderCompletion();
    showScreen('completion');
    createConfetti();
  }

  function updateContinueButton(step) {
    const profile = db.getProfile();
    switch (step) {
      case 1:
        const btn1 = $('#step1-continue');
        if (btn1) btn1.disabled = !profile.incomeType;
        break;
      case 3:
        const btn3 = $('#step3-continue');
        const enabledNonLocked = profile.enabledCategoryIds.filter(id => id !== 'other_work');
        if (btn3) btn3.disabled = enabledNonLocked.length === 0;
        break;
    }
  }

  function setupHistory() {
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.step) {
        showScreen('wizard');
        showStep(e.state.step);
      } else if (e.state && e.state.screen) {
        renderScreen(e.state.screen);
      } else {
        handleHashChange();
      }
    });
  }

  // ============ INITIALIZATION ============
  function init() {
    console.log('[TaxBuddy] Initializing...');

    const profile = db.getProfile();

    // Setup wizard step handlers
    setupStep1();
    setupStep2();
    setupStep3();
    setupStep4();
    setupHistory();

    // Welcome screen handlers
    $('#welcome-start-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      Analytics.wizardStarted();
      goToStep(1);
    });

    $('#welcome-quick-setup')?.addEventListener('click', (e) => {
      e.preventDefault();
      quickSetup();
    });

    // Completion screen handlers
    $('#add-expense-btn')?.addEventListener('click', () => {
      navigate('add-expense');
    });

    $('#dashboard-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('dashboard');
    });

    // Progress dot navigation
    $$('.progress-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const step = parseInt(dot.dataset.step);
        const currentProfile = db.getProfile();
        if (step <= currentProfile.lastCompletedStep) goToStep(step);
      });
    });

    // Bottom nav handlers
    $$('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const screen = item.dataset.screen;
        if (screen) navigate(screen);
      });
    });

    // Determine initial screen
    if (profile.setupComplete) {
      handleHashChange();
    } else if (profile.currentStep > 0) {
      showScreen('wizard');
      showStep(profile.currentStep);
    } else {
      showScreen('welcome');
    }

    console.log('[TaxBuddy] Initialization complete!');
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);

  // Expose public API
  window.TaxBuddyApp = {
    navigate,
    removeReceipt,
    reset: () => { db.reset(); location.reload(); }
  };

  window.TaxBuddyDebug = {
    reset: () => { db.reset(); location.reload(); },
    getProfile: () => db.getProfile(),
    getExpenses: () => db.getExpenses(),
    addTestExpenses: () => {
      const categories = ['phone_internet', 'travel', 'equipment_software', 'professional_services', 'other_work'];
      const descriptions = ['Vodacom monthly', 'Uber to client', 'Software subscription', 'Accountant fee', 'Office supplies'];
      for (let i = 0; i < 10; i++) {
        const catIndex = Math.floor(Math.random() * categories.length);
        db.addExpense({
          amount: Math.floor(Math.random() * 2000) + 100,
          description: descriptions[catIndex] + ' ' + (i + 1),
          categoryId: categories[catIndex],
          date: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          workPercentage: [50, 75, 100][Math.floor(Math.random() * 3)],
          notes: ''
        });
      }
      location.reload();
    }
  };
})();
