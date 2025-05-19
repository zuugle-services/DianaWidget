/**
 * Manages the navigation between different pages within the widget.
 */
export class PageManager {
    /**
     * Initializes the PageManager.
     * @param {HTMLElement} formPageElement - The DOM element for the form page.
     * @param {HTMLElement} resultsPageElement - The DOM element for the results page.
     * @param {HTMLElement} innerContainerElement - The DOM element for the inner container holding the pages.
     */
    constructor(formPageElement, resultsPageElement, innerContainerElement) {
        this.formPage = formPageElement;
        this.resultsPage = resultsPageElement;
        this.innerContainer = innerContainerElement;

        if (!this.formPage || !this.resultsPage || !this.innerContainer) {
            console.error("PageManager: One or more page elements are missing. Navigation might not work correctly.");
        }
    }

    /**
     * Navigates to the form page.
     */
    navigateToForm() {
        if (this.resultsPage) this.resultsPage.classList.remove("active");
        if (this.formPage) this.formPage.classList.add("active");
        if (this.innerContainer) {
            // Style for form page (typically primary background)
            this.innerContainer.style.backgroundColor = "var(--bg-primary)";
        }
    }

    /**
     * Navigates to the results page.
     */
    navigateToResults() {
        if (this.formPage) this.formPage.classList.remove("active");
        if (this.resultsPage) this.resultsPage.classList.add("active");
        if (this.innerContainer) {
            // Style for results page (typically secondary background)
            this.innerContainer.style.transform = "unset"; // Reset any transforms
            this.innerContainer.style.backgroundColor = "var(--bg-secondary)";
        }
    }
}
