/**
 * Manages the navigation between different pages within the widget.
 */
export class PageManager {
    /**
     * Initializes the PageManager.
     * @param {HTMLElement} formPageElement - The DOM element for the form page.
     * @param {HTMLElement} resultsPageElement - The DOM element for the results page.
     * @param {HTMLElement} innerContainerElement - The DOM element for the inner container holding the pages.
     * @param {HTMLElement} menuPageElement - The DOM element for the menu page.
     * @param {HTMLElement} contentPageElement - The DOM element for the content page.
     */
    constructor(formPageElement, resultsPageElement, innerContainerElement, menuPageElement, contentPageElement) {
        this.formPage = formPageElement;
        this.resultsPage = resultsPageElement;
        this.innerContainer = innerContainerElement;
        this.menuPage = menuPageElement; // Added menu page
        this.contentPage = contentPageElement; // Added content page
        this.activePage = null; // To keep track of the currently active main page (form or results)

        if (!this.formPage || !this.resultsPage || !this.innerContainer || !this.menuPage || !this.contentPage) {
            console.error("PageManager: One or more page elements are missing. Navigation might not work correctly.");
        }
    }

    _hideAllPages() {
        if (this.formPage) this.formPage.classList.remove("active");
        if (this.resultsPage) this.resultsPage.classList.remove("active");
        if (this.menuPage) this.menuPage.classList.remove("active");
        if (this.contentPage) this.contentPage.classList.remove("active");
    }

    /**
     * Navigates to the form page.
     */
    navigateToForm() {
        this._hideAllPages();
        if (this.formPage) this.formPage.classList.add("active");
        this.activePage = this.formPage;
        if (this.innerContainer) {
            // Style for form page (typically primary background)
            this.innerContainer.style.backgroundColor = "var(--bg-primary)";
        }
    }

    /**
     * Navigates to the results page.
     */
    navigateToResults() {
        this._hideAllPages();
        if (this.resultsPage) this.resultsPage.classList.add("active");
        this.activePage = this.resultsPage;
        if (this.innerContainer) {
            // Style for results page (typically secondary background)
            this.innerContainer.style.transform = "unset"; // Reset any transforms
            this.innerContainer.style.backgroundColor = "var(--bg-secondary)";
        }
    }

    /**
     * Navigates to the menu page.
     */
    navigateToMenu() {
        this._hideAllPages();
        if (this.menuPage) this.menuPage.classList.add("active");
        if (this.innerContainer) {
            this.innerContainer.style.backgroundColor = "var(--bg-primary)"; // Or a specific menu background
        }
    }

    /**
     * Navigates to the content page.
     */
    navigateToContentPage() {
        this._hideAllPages();
        if (this.contentPage) this.contentPage.classList.add("active");
        if (this.innerContainer) {
            this.innerContainer.style.backgroundColor = "var(--bg-primary)"; // Or a specific content page background
        }
    }

    /**
     * Returns to the previously active main page (form or results).
     * If no specific active page was tracked, defaults to form page.
     */
    returnToActivePage() {
        this._hideAllPages();
        if (this.activePage === this.resultsPage) {
            this.navigateToResults();
        } else {
            this.navigateToForm(); // Default to form page
        }
    }
}
