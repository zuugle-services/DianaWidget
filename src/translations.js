export default {
  EN: {
    origin: "Origin",
    enterOrigin: "Enter origin",
    destination: "Destination",
    activityDate: "Activity date",
    search: "Search",
    selectDate: "Select",
    datePickerTitle: "Select Activity Date",
    apply: "Apply",
    cancel: "Cancel",
    back: "Back",
    loadingConnectionsI: "Incoming connections are loading...",
    loadingConnectionsO: "Outgoing connections are loading...",
    loadingStateSearching: "Searching...",
    noConnections: "No connection details available",
    transfers: "transfers",
    durationHoursShort: "h",
    durationHoursLong: "hours",
    durationMinutesShort: "min",
    durationMinutesLong: "minutes",
    activityStart: "Start time",
    activityEnd: "End time",
    activityDuration: "Duration",
    noConnectionDetails: "No connection details available",
    noConnectionElements: "No connection elements available",
    warnings: {
      earlyStart: "Warning: Earlier Arrival than recommended starting time of activity!",
      lateEnd: "Warning: Later Departure than recommended ending time of activity!",
      duration: "Warning: Activity duration below recommended"
    },
    errors: {
      originRequired: "Please enter an origin location",
      dateRequired: "Please select a date",
      connectionError: "Failed to load connections. Please try again.",
      suggestionError: "Failed to load suggestions. Please try again.",
      activityTimeError: "Failed to calculate activity times. Please try again."
    },
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    shortDays: ["M", "T", "W", "T", "F", "S", "S"],
    ariaLabels: {
      topSlider: "Available time slots",
      bottomSlider: "Available return time slots",
      searchButton: "Search for connections",
      backButton: "Go back to search form",
      previousMonth: "Previous month",
    },
    waiting: {
      beforeActivity: "Waiting for activity to start",
      afterActivity: "Waiting after activity ends"
    }
  },
  DE: {
    origin: "Startort",
    enterOrigin: "Startort eingeben",
    destination: "Zielort",
    activityDate: "Aktivitätsdatum",
    search: "Suchen",
    selectDate: "Auswählen",
    datePickerTitle: "Aktivitätsdatum wählen",
    apply: "Übernehmen",
    cancel: "Abbrechen",
    back: "Zurück",
    loadingConnectionsI: "Verbindungen werden geladen...",
    loadingConnectionsO: "Verbindungen werden geladen...",
    loadingStateSearching: "Suche...",
    noConnections: "Keine Verbindungsdetails verfügbar",
    transfers: "Umstiege",
    durationHoursShort: "h",
    durationHoursLong: "Stunden",
    durationMinutesShort: "Min",
    durationMinutesLong: "Minuten",
    activityStart: "Startzeit",
    activityEnd: "Endzeit",
    activityDuration: "Dauer",
    warnings: {
      earlyStart: "Warnung: Frühere Ankunft als empfohlene Startzeit!",
      lateEnd: "Warnung: Spätere Abfahrt als empfohlene Endzeit!",
      duration: "Warnung: Aktivitätsdauer unter Empfehlung"
    },
    errors: {
      originRequired: "Bitte geben Sie einen Startort ein",
      dateRequired: "Bitte wählen Sie ein Datum",
      connectionError: "Verbindungsdaten konnten nicht geladen werden.",
      suggestionError: "Vorschläge konnten nicht geladen werden.",
      activityTimeError: "Aktivitätszeiten konnten nicht geladen werden"
    },
    months: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
    shortDays: ["M", "D", "M", "D", "F", "S", "S"],
    ariaLabels: {
      topSlider: "Verfügbare Zeitfenster",
      bottomSlider: "Verfügbare Rückkehrzeitfenster",
      searchButton: "Verbindungen suchen",
      backButton: "Zurück zum Suchformular",
      previousMonth: "Vorheriger Monat",
    },
    waiting: {
      beforeActivity: "Warten auf den Beginn der Aktivität",
      afterActivity: "Warten nach dem Ende der Aktivität"
    }
  }
};