import { getWidgetHeaderHTML } from './partials/_widgetHeader';
import { getMenuDropdownHTML } from './partials/_menuDropdown';

/**
 * Generates the HTML for a generic content page.
 * @param {object} args - Arguments including t (translation function).
 * @returns {string} HTML string for the content page.
 */
export function getContentPageTemplateHTML(args) {
    const {t} = args;

    const menuDropdownHTML = getMenuDropdownHTML({t, dropdownId: 'contentMenuDropdown', isShareDisabled: true});
    // The title is set dynamically later, so we pass the required ID for the element.
    const headerHTML = getWidgetHeaderHTML({
        t,
        title: '',
        titleId: 'contentPageTitle',
        showBackButton: true,
        backButtonId: 'contentPageBackBtn',
        menuDropdownHTML
    });

    return `
      <div id="contentPage" class="modal-page">
        ${headerHTML}
        <div id="contentPageBody" class="modal-body content-page-body">
        </div>
        <div class="widget-footer"><a href="https://zuugle-services.com" target="_new">powered by Zuugle Services</a></div>
      </div>
    `;
}
