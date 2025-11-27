/**
 * Manages the navigation between different pages within the widget.
 */
export class PageManager {
    /** DOM element for the form page */
    formPage: HTMLElement | null;
    /** DOM element for the results page */
    resultsPage: HTMLElement | null;
    /** DOM element for the inner container holding the pages */
    innerContainer: HTMLElement | null;
    /** DOM element for the content page */
    contentPage: HTMLElement | null;
    /** Currently active main page (form or results) */
    activePage: HTMLElement | null;

    /**
     * Initializes the PageManager.
     * @param formPageElement - The DOM element for the form page.
     * @param resultsPageElement - The DOM element for the results page.
     * @param innerContainerElement - The DOM element for the inner container holding the pages.
     * @param contentPageElement - The DOM element for the content page.
     */
    constructor(
        formPageElement: HTMLElement | null, 
        resultsPageElement: HTMLElement | null, 
        innerContainerElement: HTMLElement | null, 
        contentPageElement: HTMLElement | null
    ) {
        this.formPage = formPageElement;
        this.resultsPage = resultsPageElement;
        this.innerContainer = innerContainerElement;
        this.contentPage = contentPageElement;
        this.activePage = null;

        if (!this.formPage || !this.resultsPage || !this.innerContainer || !this.contentPage) {
            console.error("PageManager: One or more page elements are missing. Navigation might not work correctly.");
        }
    }

    private _hideAllPages(): void {
        if (this.formPage) this.formPage.classList.remove("active");
        if (this.resultsPage) this.resultsPage.classList.remove("active");
        if (this.contentPage) this.contentPage.classList.remove("active");
    }

    /**
     * Navigates to the form page.
     */
    navigateToForm(): void {
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
    navigateToResults(): void {
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
     * Navigates to the content page.
     */
    navigateToContentPage(): void {
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
    returnToActivePage(): void {
        this._hideAllPages();
        if (this.activePage === this.resultsPage) {
            this.navigateToResults();
        } else {
            this.navigateToForm(); // Default to form page
        }
    }
}
