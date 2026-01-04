/**
 * Pro-Finance Tour Component
 * Guides users through the application features using Shepherd.js
 */

ProFinance.tour = {
    driver: null,
    
    // Check if tour has been completed
    hasSeenTour: function() {
        return localStorage.getItem('pro-finance-tour-completed') === 'true';
    },
    
    // Mark tour as completed
    completeTour: function() {
        localStorage.setItem('pro-finance-tour-completed', 'true');
    },

    // Initialize the tour
    init: function() {
        if (typeof Shepherd === 'undefined') {
            console.warn('Shepherd.js not loaded');
            return;
        }

        // Create tour instance
        this.driver = new Shepherd.Tour({
            useModalOverlay: true,
            defaultStepOptions: {
                classes: 'shepherd-theme-custom',
                scrollTo: true,
                cancelIcon: {
                    enabled: true
                },
                buttons: [
                    {
                        text: 'Back',
                        action: this.back.bind(this),
                        classes: 'btn btn-sm btn-secondary'
                    },
                    {
                        text: 'Next',
                        action: this.next.bind(this),
                        classes: 'btn btn-sm btn-primary'
                    }
                ]
            }
        });

        this.configureSteps();
        
        // Expose start method globally or strictly through this module
        window.startTour = this.start.bind(this);
    },
    
    // Helper to reference tour instance navigation
    next: function() {
        return this.driver.next();
    },
    
    back: function() {
        return this.driver.back();
    },
    
    complete: function() {
        this.completeTour();
        return this.driver.complete();
    },

    // Define tour steps
    configureSteps: function() {
        const steps = [
            {
                id: 'welcome',
                title: 'Welcome to Pro-Finance! 👋',
                text: 'Your personal command center for advanced financial planning. Let\'s take a quick tour to get you started.',
                buttons: [
                    {
                        text: 'Skip Tour',
                        action: this.complete.bind(this),
                        classes: 'btn btn-sm btn-secondary'
                    },
                    {
                        text: 'Let\'s Go!',
                        action: this.next.bind(this),
                        classes: 'btn btn-sm btn-primary'
                    }
                ]
            },
            {
                id: 'flow-view',
                attachTo: { element: '.view-tab[data-view="flow"]', on: 'bottom' },
                title: 'The Flow 🌊',
                text: 'This is your default view. Track your monthly income, expenses, and savings flow here. Visualize where every rupee goes.',
                beforeShowPromise: function() {
                    return ProFinance.ui.switchView('flow');
                }
            },
            {
                id: 'add-data',
                attachTo: { element: '#add-data-btn', on: 'bottom' },
                title: 'Add Your Data ➕',
                text: 'Start by adding your Income Sources, Expenses, Assets, and Loans. The more data you add, the smarter the insights.',
            },
            {
                id: 'reservoir-view',
                attachTo: { element: '.view-tab[data-view="reservoir"]', on: 'bottom' },
                title: 'Wealth & Goals 🏦',
                text: 'Switch to this view to plan your long-term goals (like a house or retirement) and track your Net Worth growth over time.',
                beforeShowPromise: function() {
                    return ProFinance.ui.switchView('reservoir');
                }
            },
            {
                id: 'family-office',
                attachTo: { element: '.app-sidebar', on: 'right' },
                title: 'Family Office 👨‍👩‍👧‍👦',
                text: 'Manage finances for your entire family. Add family members and assign income/expenses to them for a holistic view.',
                beforeShowPromise: function() {
                    // Ensure we are back to flow view or just highlight sidebar
                    // The sidebar is visible in both views
                    return new Promise(resolve => resolve());
                }
            },
            {
                id: 'settings',
                attachTo: { element: '#settings-btn', on: 'bottom' },
                title: 'Settings & data ⚙️',
                text: 'Customize your experience, export your data, or reset everything from here.',
                buttons: [
                    {
                        text: 'Back',
                        action: this.back.bind(this),
                        classes: 'btn btn-sm btn-secondary'
                    },
                    {
                        text: 'Finish',
                        action: this.complete.bind(this),
                        classes: 'btn btn-sm btn-primary'
                    }
                ]
            }
        ];

        this.driver.addSteps(steps);
    },

    // Start the tour
    start: function() {
        if (!this.driver) {
            this.init();
        }
        
        // Ensure we start from the beginning
        this.driver.start();
    }
};
