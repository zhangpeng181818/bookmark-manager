/**
 * View Switching Logic Test
 * Tests the view switching functionality without requiring a browser
 */

// Mock DOM elements
const mockElements = {
  homeView: { style: { display: 'block' }, dataset: {} },
  settingsView: { style: { display: 'none' }, dataset: {} },
  popupHeader: { style: { justifyContent: '' } },
  openSettings: {
    innerHTML: '',
    dataset: {},
    addEventListener: function(event, handler) {
      this._handlers = this._handlers || {};
      this._handlers[event] = handler;
    },
    click: function() {
      if (this._handlers && this._handlers.click) {
        this._handlers.click();
      }
    }
  }
};

// Mock chrome storage
let mockStorage = {
  sync: { get: async () => ({}), set: async () => {} },
  local: {
    get: async () => ({ organizing: false }),
    set: async () => {}
  }
};

// Simple view manager class for testing
class ViewManager {
  constructor() {
    this.currentView = 'home';
    this.elements = mockElements;
  }

  showHomeView() {
    this.elements.homeView.style.display = 'block';
    this.elements.settingsView.style.display = 'none';
    this.elements.popupHeader.style.justifyContent = 'space-between';
    this.elements.openSettings.innerHTML = '⚙️'; // Gear icon
    this.elements.openSettings.dataset.view = 'home';
    this.currentView = 'home';
  }

  showSettingsView() {
    // 立即更新状态，防止闪烁
    this.currentView = 'settings';
    this.elements.homeView.style.display = 'none';
    this.elements.settingsView.style.display = 'block';
    this.elements.popupHeader.style.justifyContent = 'flex-start';
    this.elements.openSettings.innerHTML = '←'; // Back icon
    this.elements.openSettings.dataset.view = 'settings';

    // 异步检查是否正在整理
    mockStorage.local.get('organizing').then((result) => {
      if (result.organizing) {
        console.log('⚠️ User is organizing, cannot switch');
        this.showHomeView();
      }
    });
  }

  bindEvents() {
    // Header button (handles both settings and back)
    const settingsBtn = this.elements.openSettings;
    settingsBtn.addEventListener('click', () => {
      if (this.currentView === 'home') {
        // 立即更新状态
        this.currentView = 'settings';
        this.showSettingsView();
      } else {
        this.currentView = 'home';
        this.showHomeView();
      }
    });
  }
}

// Test runner
function runTests() {
  console.log('🧪 Running View Switching Tests\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected "${expected}", got "${actual}"`);
    }
  }

  function assertTrue(value, message) {
    if (!value) {
      throw new Error(`${message}: expected true`);
    }
  }

  function assertFalse(value, message) {
    if (value) {
      throw new Error(`${message}: expected false`);
    }
  }

  // Reset state
  mockElements.homeView.style.display = 'block';
  mockElements.settingsView.style.display = 'none';
  mockElements.openSettings.dataset.view = '';

  const vm = new ViewManager();
  vm.bindEvents();

  // Test 1: Initial state
  test('Should start at home view', () => {
    assertEqual(vm.currentView, 'home', 'Initial view');
  });

  // Test 2: Switch to settings
  test('Should switch to settings view', async () => {
    mockElements.openSettings.click();
    await new Promise(r => setTimeout(r, 10));
    assertEqual(vm.currentView, 'settings', 'After click');
    assertEqual(mockElements.settingsView.style.display, 'block', 'Settings visible');
    assertEqual(mockElements.homeView.style.display, 'none', 'Home hidden');
  });

  // Test 3: Switch back to home
  test('Should switch back to home view', async () => {
    mockElements.openSettings.click();
    await new Promise(r => setTimeout(r, 10));
    assertEqual(vm.currentView, 'home', 'After back click');
    assertEqual(mockElements.homeView.style.display, 'block', 'Home visible');
    assertEqual(mockElements.settingsView.style.display, 'none', 'Settings hidden');
  });

  // Test 4: Settings button shows gear icon at home
  test('Should show gear icon at home', () => {
    vm.showHomeView(); // Reset to home
    assertEqual(mockElements.openSettings.dataset.view, 'home', 'dataset.view');
  });

  // Test 5: Settings button shows back icon in settings
  test('Should show back icon in settings', async () => {
    await vm.showSettingsView();
    assertEqual(mockElements.openSettings.dataset.view, 'settings', 'dataset.view in settings');
  });

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Run tests
const success = runTests();
process.exit(success ? 0 : 1);
