/**
 * Content for the Help and Support page for the DianaWidget.
 * Each language key (e.g., EN, DE) contains the HTML string for that language.
 */
export const helpContent = {
    EN: `
    <style>
      .help-section h2, .help-section h3, .help-section h4 { margin-bottom: 0.5em; }
      .help-section h3 { margin-top: 1.5em; }
      .help-section h4 { margin-top: 1em; font-size: 1.1em; }
      .help-section ol, .help-section ul { margin-left: 1.5em; margin-bottom: 1em; }
      .help-section li { margin-bottom: 0.75em; }
      .help-section strong { color: #333; }
      .help-section .icon-inline { vertical-align: middle; display: inline-block; margin: 0 0.2em; }
      .help-section hr { border: 0; height: 1px; background-color: #eee; margin: 2em 0; }
    </style>
    <div class="help-section">
      <h2>Help & Support <span class="icon-inline">👋</span></h2>
      <p>Welcome to the DianaWidget help section! We're here to assist you in planning your journey to and from your desired activity using public transport.</p>

      <hr>

      <h3>How to Use the DianaWidget:</h3>
      <ol>
        <li>
          <h4>1. Enter Your Starting Point <span class="icon-inline">📍</span></h4>
          <p>In the "Your Location" field (or similar, depending on the integration), type your starting address or a known public transport stop. As you type, relevant suggestions will appear. Please select the one that best matches your starting point.</p>
          <p>Alternatively, if available, click the <strong>location icon</strong> (target icon: 
          <svg class="icon-inline" style="pointer-events: auto; cursor: pointer;" width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line>
          </svg>
          ) to use your current geographical location. You may need to grant location permissions to your browser for this feature to work.</p>
        </li>
        <li>
          <h4>2. Select the Date(s) for Your Activity <span class="icon-inline">📅</span></h4>
          <ul>
            <li><strong>For a Single-Day Activity:</strong> You'll typically find options like "Today," "Tomorrow," or an "Other Date" button. Clicking "Other Date" will open a calendar allowing you to pick a specific date.</li>
            <li><strong>For a Multi-Day Activity:</strong> The widget will provide options to select both a start date and an end date for your activity, using a calendar interface.</li>
          </ul>
        </li>
        <li>
          <h4>3. Initiate the Search <span class="icon-inline">🔍</span></h4>
          <p>Once your location and date(s) are set, click the "Search" button (or similar) to find transport connections.</p>
        </li>
        <li>
          <h4>4. Review Your Connections <span class="icon-inline">📊</span></h4>
          <p>The results page will display:</p>
          <ul>
            <li>Suggested public transport connections <strong>to your activity</strong> (usually in the top section).</li>
            <li>Information about your planned activity (often in the middle section).</li>
            <li>Suggested public transport connections <strong>from your activity</strong> back to your starting point (usually in the bottom section).</li>
          </ul>
          <p>You can often swipe or click through different time slots or connection options. Clicking on a specific time slot will reveal more detailed journey information, including transfers, modes of transport, and estimated durations.</p>
        </li>
      </ol>

      <hr>

      <h3>Troubleshooting Tips <span class="icon-inline">💡</span></h3>
      <p>Encountering an issue? Here are a few common solutions:</p>

      <h4><strong>If you encounter "No connections found":</strong></h4>
      <ul>
        <li>Try refining your starting location. Sometimes, a major nearby transport hub or a slightly different address format can yield better results.</li>
        <li>Double-check that the selected date(s) and times are realistic for public transport operating hours in that region.</li>
        <li>For multi-day activities, ensure your selected start date is not after your end date.</li>
        <li>The service covers many regions, but coverage might be limited in some very remote areas or for specific cross-border connections if not explicitly supported.</li>
      </ul>

      <h4><strong>If you see error messages:</strong></h4>
      <ul>
        <li>First, please check your internet connection.</li>
        <li>If your internet is working, the issue might be temporary on the service side. We recommend trying again after a short while.</li>
        <li>Ensure that the API token used for the widget is current and valid, especially if you are integrating the widget yourself.</li>
      </ul>

      <hr>

      <h3>Need More Help? <span class="icon-inline">💬</span></h3>
      <p>If these tips don't resolve your issue, or if you have other questions, please don't hesitate to get in touch. You can find our contact details on the "Contact" page within this widget, or visit our main company website for more information about Zuugle Services:</p>
      <p><a href="https://www.zuugle-services.com" target="_blank" rel="noopener noreferrer">www.zuugle-services.com</a></p>
      <p>For specific inquiries regarding the DianaWidget, including licensing or integration support, you can also email us directly at <a href="mailto:office@zuugle-services.com">office@zuugle-services.com</a>.</p>
    </div>
  `,
    DE: `
    <style>
      .help-section h2, .help-section h3, .help-section h4 { margin-bottom: 0.5em; }
      .help-section h3 { margin-top: 1.5em; }
      .help-section h4 { margin-top: 1em; font-size: 1.1em; }
      .help-section ol, .help-section ul { margin-left: 1.5em; margin-bottom: 1em; }
      .help-section li { margin-bottom: 0.75em; }
      .help-section strong { color: #333; }
      .help-section .icon-inline { vertical-align: middle; display: inline-block; margin: 0 0.2em; }
      .help-section hr { border: 0; height: 1px; background-color: #eee; margin: 2em 0; }
    </style>
    <div class="help-section">
      <h2>Hilfe & Support <span class="icon-inline">👋</span></h2>
      <p>Willkommen im Hilfebereich des DianaWidgets! Wir unterstützen Sie gerne bei der Planung Ihrer An- und Abreise zu Ihrer gewünschten Aktivität mit öffentlichen Verkehrsmitteln.</p>

      <hr>

      <h3>So verwenden Sie das DianaWidget:</h3>
      <ol>
        <li>
          <h4>1. Geben Sie Ihren Startpunkt ein <span class="icon-inline">📍</span></h4>
          <p>Tippen Sie in das Feld "Ihr Standort" (oder ähnlich, je nach Integration) Ihre Startadresse oder eine bekannte Haltestelle des öffentlichen Nahverkehrs ein. Während Sie tippen, erscheinen relevante Vorschläge. Bitte wählen Sie den Vorschlag aus, der Ihrem Startpunkt am besten entspricht.</p>
          <p>Alternativ können Sie, falls verfügbar, auf das <strong>Standort-Symbol</strong> klicken (Zielscheibensymbol: 
          <svg class="icon-inline" style="pointer-events: auto; cursor: pointer;" width="18.75" height="18.75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="0" x2="12" y2="5"></line><line x1="0" y1="12" x2="5" y2="12"></line><line x1="12" y1="19" x2="12" y2="24"></line><line x1="19" y1="12" x2="24" y2="12"></line>
          </svg>
          ), um Ihren aktuellen geografischen Standort zu verwenden. Möglicherweise müssen Sie Ihrem Browser erlauben, auf Ihren Standort zuzugreifen.</p>
        </li>
        <li>
          <h4>2. Wählen Sie das Datum für Ihre Aktivität aus <span class="icon-inline">📅</span></h4>
          <ul>
            <li><strong>Für eine eintägige Aktivität</strong>: Sie finden in der Regel Optionen wie "Heute", "Morgen" oder eine Schaltfläche "Anderes Datum". Ein Klick auf "Anderes Datum" öffnet einen Kalender, in dem Sie ein bestimmtes Datum auswählen können.</li>
            <li><strong>Für eine mehrtägige Aktivität</strong>: Das Widget bietet Ihnen Optionen zur Auswahl eines Start- und Enddatums für Ihre Aktivität über eine Kalenderoberfläche.</li>
          </ul>
        </li>
        <li>
          <h4>3. Starten Sie die Suche <span class="icon-inline">🔍</span></h4>
          <p>Sobald Ihr Standort und das/die Datum(e) festgelegt sind, klicken Sie auf die Schaltfläche "Suchen" (oder ähnlich), um nach Verkehrsverbindungen zu suchen.</p>
        </li>
        <li>
          <h4>4. Überprüfen Sie Ihre Verbindungen <span class="icon-inline">📊</span></h4>
          <p>Die Ergebnisseite zeigt Ihnen:</p>
          <ul>
            <li>Vorgeschlagene Verbindungen des öffentlichen Nahverkehrs <strong>zu Ihrer Aktivität</strong> (normalerweise im oberen Bereich).</li>
            <li>Informationen zu Ihrer geplanten Aktivität (oft im mittleren Bereich).</li>
            <li>Vorgeschlagene Verbindungen des öffentlichen Nahverkehrs <strong>von Ihrer Aktivität</strong> zurück zu Ihrem Startpunkt (normalerweise im unteren Bereich).</li>
          </ul>
          <p>Sie können oft durch verschiedene Zeitfenster oder Verbindungsoptionen wischen oder klicken. Ein Klick auf ein bestimmtes Zeitfenster zeigt detailliertere Reiseinformationen an, einschließlich Umstiege, Verkehrsmittel und geschätzte Fahrzeiten.</p>
        </li>
      </ol>

      <hr>

      <h3>Tipps zur Fehlerbehebung <span class="icon-inline">💡</span></h3>
      <p>Stoßen Sie auf ein Problem? Hier sind einige häufige Lösungen:</p>

      <h4><strong>Falls "Keine Verbindungen gefunden" angezeigt wird:</strong></h4>
      <ul>
        <li>Versuchen Sie, Ihren Startort zu präzisieren. Manchmal kann ein größerer Verkehrsknotenpunkt in der Nähe oder ein leicht anderes Adressformat bessere Ergebnisse liefern.</li>
        <li>Überprüfen Sie nochmals, ob das/die gewählte(n) Datum(e) und Zeiten realistisch für die Betriebszeiten der öffentlichen Verkehrsmittel in dieser Region sind.</li>
        <li>Stellen Sie bei mehrtägigen Aktivitäten sicher, dass Ihr gewähltes Startdatum nicht nach Ihrem Enddatum liegt.</li>
        <li>Der Dienst deckt viele Regionen ab, die Abdeckung kann jedoch in einigen sehr abgelegenen Gebieten oder bei bestimmten grenzüberschreitenden Verbindungen, sofern nicht ausdrücklich unterstützt, eingeschränkt sein.</li>
      </ul>

      <h4><strong>Falls Fehlermeldungen angezeigt werden:</strong></h4>
      <ul>
        <li>Bitte überprüfen Sie zuerst Ihre Internetverbindung.</li>
        <li>Wenn Ihre Internetverbindung funktioniert, könnte das Problem vorübergehend auf der Serviceseite liegen. Wir empfehlen, es nach kurzer Zeit erneut zu versuchen.</li>
        <li>Stellen Sie sicher, dass der für das Widget verwendete API-Token aktuell und gültig ist, insbesondere wenn Sie das Widget selbst integrieren.</li>
      </ul>

      <hr>

      <h3>Benötigen Sie weitere Hilfe? <span class="icon-inline">💬</span></h3>
      <p>Wenn diese Tipps Ihr Problem nicht lösen oder wenn Sie andere Fragen haben, zögern Sie bitte nicht, uns zu kontaktieren. Unsere Kontaktdaten finden Sie auf der Seite "Kontakt" in diesem Widget, oder besuchen Sie unsere Firmenwebseite für weitere Informationen über Zuugle Services:</p>
      <p><a href="https://www.zuugle-services.com" target="_blank" rel="noopener noreferrer">www.zuugle-services.com</a></p>
      <p>Für spezifische Anfragen zum DianaWidget, einschließlich Lizenzierung oder Integrationsunterstützung, können Sie uns auch direkt eine E-Mail an <a href="mailto:office@zuugle-service.com">office@zuugle-service.com</a> senden.</p>
    </div>
  `
};
