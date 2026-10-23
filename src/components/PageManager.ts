/** Direction of a page change; drives the slide animation (see `.page-enter-*` in _base.scss). */
type PageDirection = 'forward' | 'back';

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
     * Shows `page` and hides the others. When another page was on screen, the new one slides in
     * from the side given by `direction`; the first page shown (initial render) does not animate.
     */
    private _showPage(page: HTMLElement | null, direction: PageDirection): void {
        const pages = [this.formPage, this.resultsPage, this.contentPage];
        const replacesVisiblePage = pages.some(p => p && p !== page && p.classList.contains('active'));
        this._hideAllPages();
        if (!page) return;

        page.classList.remove('page-enter-forward', 'page-enter-back');
        page.classList.add('active');
        if (replacesVisiblePage) {
            void page.offsetWidth; // Restart the animation if the same direction is used twice.
            page.classList.add(`page-enter-${direction}`);
        }
    }

    /**
     * Navigates to the form page.
     */
    navigateToForm(direction: PageDirection = 'back'): void {
        this._showPage(this.formPage, direction);
        this.activePage = this.formPage;
        if (this.innerContainer) {
            // Style for form page (typically primary background)
            this.innerContainer.style.backgroundColor = "var(--bg-primary)";
        }
    }

    /**
     * Navigates to the results page.
     */
    navigateToResults(direction: PageDirection = 'forward'): void {
        this._showPage(this.resultsPage, direction);
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
        this._showPage(this.contentPage, 'forward');
        if (this.innerContainer) {
            this.innerContainer.style.backgroundColor = "var(--bg-primary)"; // Or a specific content page background
        }
    }

    /**
     * Returns to the previously active main page (form or results).
     * If no specific active page was tracked, defaults to form page.
     */
    returnToActivePage(): void {
        if (this.activePage === this.resultsPage) {
            this.navigateToResults('back');
        } else {
            this.navigateToForm('back');
        }
    }
}
