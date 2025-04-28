import styles from '!!css-loader?{"sourceMap":false,"exportType":"string"}!./styles/widget.css'

export default class DianaWidget {
  // Default configuration
  defaultConfig = {
    activityName: "[Activity Name]",
    activityType: "[Activity Type]",
    requiredFields: [
      'activityStartLocation',
      'activityStartLocationType',
      'activityEndLocation',
      'activityEndLocationType',
      'activityEarliestStartTime',
      'activityLatestEndTime',
      'activityDurationMinutes'
    ],
    activityEarliestStartTimeFlexible: true,
    activityLatestEndTimeFlexible: true,
    activityStartLocationDisplayName: null,
    activityEndLocationDisplayName: null,
    activityStartTimeLabel: null,
    activityEndTimeLabel: null,
    apiBaseUrl: "https://api.zuugle-services.net",
    apiToken: "development-token"
  };

  constructor(config = {}) {
    // Validate and merge configuration
    this.config = this.validateConfig(config);

    // Initialize state
    this.state = {
      fromConnections: [],
      toConnections: [],
      selectedDate: new Date(),
      loading: false,
      error: null,
      suggestions: [],
      activeTimeFilters: { from: null, to: null },
      recommendedToIndex: 0,
      recommendedFromIndex: 0,
      activityTimes: {
        start: '',
        end: '',
        duration: '',
        warning_earlystart: false,
        warning_lateend: false,
        warning_duration: false,
      }
    };

    // Initialize the widget
    this.injectBaseStyles();
    this.initDOM();
    this.setupEventListeners();
    this.initCalendar();
    // this.applyTheme();
  }

  validateConfig(userConfig) {
    const config = { ...this.defaultConfig, ...userConfig };

    // Check for required fields
    const missingFields = this.defaultConfig.requiredFields.filter(
      field => !userConfig[field]
    );

    if (missingFields.length > 0) {
      console.error(`Missing required configuration: ${missingFields.join(', ')}`);
      throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
    }

    return config;
  }

  injectBaseStyles() {
    if (!document.getElementById('diana-styles')) {
      const style = document.createElement('style');
      style.id = 'diana-styles';
      style.textContent = styles.toString();
      document.head.appendChild(style);
    }
  }

  initDOM() {
    // Create main container
    this.container = document.getElementById("dianaWidgetContainer");
    let dianaContainer = document.createElement('div');
    dianaContainer.className = 'diana-container';
    this.container.appendChild(dianaContainer);
    this.container = dianaContainer;
    // Render modal HTML
    this.container.innerHTML = this.getModalHTML();

    // Cache DOM elements
    this.cacheDOMElements();

    // Set initial accessibility attributes
    this.setupAccessibility();

    // Set initial date display
    this.updateDateDisplay(this.state.selectedDate);
  }

  getModalHTML() {
    return `
      <div id="activityModal" class="modal visible">
        <div id="innerContainer" class="modal-content">
          <!-- Form Page -->
          <div id="formPage" class="modal-page active">
            <div class="widget-header">
              <div class="widget-header-button">
                <button class="back-btn">&#9776;</button>
              </div>
              <div class="widget-header-heading">
                ${this.config.activityName}
              </div>
            </div>

            <form class="modal-body" aria-labelledby="formHeading">
              <div style="position:relative" class="form-section">
                <p id="originLabel">Origin</p>
                <div class="input-container">
                  <svg class="input-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  <input type="text" class="input-field" id="originInput" 
                         placeholder="Enter origin" value=""
                         aria-labelledby="originLabel">
                  <svg class="input-icon-right" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="7"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="12" y1="0" x2="12" y2="5"></line>
                    <line x1="-80" y1="10" x2="5" y2="12"></line>
                    <line x1="12" y1="20" x2="12" y2="50"></line>
                    <line x1="50" y1="10" x2="20" y2="12"></line>
                  </svg>
                </div>  
                <div id="suggestions" class="suggestions-container" role="listbox"></div>
              </div>
            
              <div class="form-section">
                <p id="destinationLabel">Destination</p>
                <div class="input-container">
                  <svg class="input-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <input type="text" class="input-field disabled" id="destinationInput" 
                         placeholder="Destination" value="Pre filled" readonly
                         aria-labelledby="destinationLabel">
                </div>
              </div>

              <div class="form-section">
                <p id="dateLabel">Activity date</p>
                <div class="date-input-container" role="button" aria-labelledby="dateLabel" tabindex="0">
                  <div class="date-input">
                    <svg class="date-input-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span id="dateDisplay" class="date-input-display placeholder">Select</span>
                    <svg class="date-input-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                  <input type="date" id="activityDate" aria-hidden="true">
                </div>
              </div>

              <div class="form-footer">
                <button type="submit" class="btn apply-btn" id="searchBtn">Search</button>
              </div>
            </form>
          </div>

          <!-- Results Page -->
          <div id="resultsPage" class="modal-page">
            <div class="modal-body-result">
              <div id="errorContainer" class="error-message" style="display: none" role="alert"></div>

              <div class="slider-wrapper etc">
                <div class="widget-header">
                  <div class="widget-header-button">
                    <button class="back-btn">&#9776;</button>
                  </div>
                  <div class="widget-header-heading">
                    ${this.config.activityName}
                  </div>
                </div>

                <div id="backBtn" class="widget-response-back-button" role="button" tabindex="0">
                  <div>&#x2190;</div>
                  <div>Back</div>
                </div>

                <div style='font-size:12px; display:none;'>Incoming Dates: </div>
                <div class="slider" id="topSlider" role="group" aria-label="Available time slots"></div>
              </div>

              <div class="middle-box" id="responseBox" aria-live="polite">
                Incoming connections are loading...
              </div>

              <div id="activity-time">
                ${this.config.activityName}
              </div>

              <div class="middle-box" id="responseBox-bottom" aria-live="polite">
                Outgoing connections are loading...
              </div>

              <div class="slider-wrapper slider-wrap-fixed">
                <div style='font-size:12px; display:none;'>Outgoing Dates: </div>
                <div class="slider" id="bottomSlider" role="group" aria-label="Available return time slots"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  cacheDOMElements() {
    this.elements = {
      modal: this.container.querySelector("#activityModal"),
      innerContainer: this.container.querySelector("#innerContainer"),
      formPage: this.container.querySelector("#formPage"),
      resultsPage: this.container.querySelector("#resultsPage"),
      originInput: this.container.querySelector("#originInput"),
      suggestionsContainer: this.container.querySelector("#suggestions"),
      activityDate: this.container.querySelector("#activityDate"),
      dateDisplay: this.container.querySelector("#dateDisplay"),
      searchBtn: this.container.querySelector("#searchBtn"),
      backBtn: this.container.querySelector("#backBtn"),
      errorContainer: this.container.querySelector("#errorContainer"),
      responseBox: this.container.querySelector("#responseBox"),
      responseBoxBottom: this.container.querySelector("#responseBox-bottom"),
      topSlider: this.container.querySelector("#topSlider"),
      bottomSlider: this.container.querySelector("#bottomSlider"),
      activityTimeBox: this.container.querySelector("#activity-time")
    };
  }

  setupAccessibility() {
    // Form inputs
    this.elements.originInput.setAttribute('aria-autocomplete', 'list');
    this.elements.originInput.setAttribute('aria-controls', 'suggestions');
    this.elements.originInput.setAttribute('aria-expanded', 'false');

    // Date picker
    this.elements.activityDate.setAttribute('aria-hidden', 'true');

    // Buttons
    this.elements.searchBtn.setAttribute('aria-label', 'Search for connections');
    this.elements.backBtn.setAttribute('aria-label', 'Go back to search form');

    // Live regions
    this.elements.responseBox.setAttribute('aria-busy', 'false');
    this.elements.responseBoxBottom.setAttribute('aria-busy', 'false');
  }

  setupEventListeners() {
    // Address input with debouncing
    this.elements.originInput.addEventListener('input', (e) => {
      this.elements.originInput.removeAttribute("data-lat");
      this.elements.originInput.removeAttribute("data-lon");
      this.debounce(
        this.handleAddressInput(e.target.value),
        300
      );
    });


    // Suggestion selection
    this.elements.suggestionsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-item')) {
        this.handleSuggestionSelect(e.target.dataset.value, e.target.dataset.lat, e.target.dataset.lon);
      }
    });

    // close suggestions box when clicking outside
    document.addEventListener("click", (e) => {
      if (this.elements.suggestionsContainer.style.display &&
          !this.elements.suggestionsContainer.contains(e.target)) {
        this.state.suggestions = [];
        this.renderSuggestions();
      }
    });

    // Form submission
    this.elements.searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSearch();
    });

    // Navigation
    this.elements.backBtn.addEventListener('click', () => this.navigateToForm());

    // Keyboard navigation for suggestions
    this.elements.originInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        this.handleSuggestionNavigation(e);
      } else if (e.key === 'Enter') {
        this.handleSuggestionEnter(e);
      }
    });
  }

  // Event handlers
  async handleAddressInput(query) {
    if (query.length < 2) {
      this.state.suggestions = [];
      this.renderSuggestions();
      return;
    }

    try {
      const results = await this.fetchSuggestions(query);
      this.state.suggestions = results.features;
      this.renderSuggestions();
    } catch (error) {
      this.showError("Failed to load suggestions. Please try again.");
    }
  }

  handleSuggestionSelect(value, lat, lon) {
    this.elements.originInput.value = value;
    this.elements.originInput.setAttribute('data-lat', lat);
    this.elements.originInput.setAttribute('data-lon', lon);
    this.state.suggestions = [];
    this.renderSuggestions();
    this.elements.originInput.focus();
  }

  async handleSearch() {
    if (!this.elements.originInput.value) {
      this.showError("Please enter an origin location");
      return;
    }

    if (!this.elements.activityDate.value) {
      if (!this.state.selectedDate) {
        this.showError("Please select a date");
        return;
      } else {
        this.elements.activityDate.value = this.formatDatetime(this.state.selectedDate);
      }
    }

    this.setLoadingState(true);
    try {
      await this.fetchActivityData();
      this.navigateToResults();
      this.slideToRecommendedConnections();

    } catch (error) {
      console.error(error);
      this.showError("Failed to load connections. Please try again.");
    } finally {
      this.setLoadingState(false);
    }
  }

  // Data fetching
  async fetchSuggestions(query) {
    const response = await fetch(
      `${this.config.apiBaseUrl}/address-autocomplete?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "Authorization": `Bearer ${this.config.apiToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async fetchActivityData() {
    let params = {
      date: this.elements.activityDate.value,
      activity_name: this.config.activityName,
      activity_type: this.config.activityType,
      activity_start_location: this.config.activityStartLocation,
      activity_start_location_type: this.config.activityStartLocationType,
      activity_end_location: this.config.activityEndLocation,
      activity_end_location_type: this.config.activityEndLocationType,
      activity_earliest_start_time: this.config.activityEarliestStartTime,
      activity_latest_end_time: this.config.activityLatestEndTime,
      activity_duration_minutes: this.config.activityDurationMinutes
    };

    if (this.elements.originInput.attributes["data-lat"] !== undefined && this.elements.originInput.attributes["data-lon"] !== undefined) {
      params["user_start_location"] = this.elements.originInput.attributes['data-lat'].value.toString() + "," + this.elements.originInput.attributes['data-lon'].value.toString();
      params["user_start_location_type"] = "coordinates";
    } else {
      params["user_start_location"] = this.elements.originInput.value;
      params["user_start_location_type"] = "address";
    }

    if (this.config.activityStartLocationDisplayName) {
      params.activity_start_location_display_name = this.config.activityStartLocationDisplayName;
    }
    if (this.config.activityEndLocationDisplayName) {
        params.activity_end_location_display_name = this.config.activityEndLocationDisplayName;
    }
    if (this.config.activityEarliestStartTimeFlexible) {
        params.activity_earliest_start_time_flexible = this.config.activityEarliestStartTimeFlexible;
    }
    if (this.config.activityLatestEndTimeFlexible) {
        params.activity_latest_end_time_flexible = this.config.activityLatestEndTimeFlexible;
    }
    if (this.config.activityStartTimeLabel) {
        params.activity_start_time_label = this.config.activityStartTimeLabel;
    }
    if (this.config.activityEndTimeLabel) {
        params.activity_end_time_label = this.config.activityEndTimeLabel;
    }

    const queryString = new URLSearchParams(params);

    const response = await fetch(
      `${this.config.apiBaseUrl}/connections?${queryString}`,
      {
        headers: {
          "Authorization": `Bearer ${this.config.apiToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch connections: ${response.status}`);
    }

    const result = await response.json();

    if (!result?.connections?.from_activity || !result?.connections?.to_activity) {
      throw new Error("No connection data available");
    }

    this.state.toConnections = result.connections.to_activity;
    this.state.fromConnections = result.connections.from_activity;

    // Ensure valid indices (fallback to 0 if invalid)
    this.state.recommendedToIndex = Math.max(0, Math.min(
      result.connections.recommended_to_activity_connection || 0,
      this.state.toConnections.length - 1
    ));

    this.state.recommendedFromIndex = Math.max(0, Math.min(
      result.connections.recommended_from_activity_connection || 0,
      this.state.fromConnections.length - 1
    ));

    this.renderConnectionResults();
  }

  // Rendering methods
  renderSuggestions() {
    this.elements.suggestionsContainer.innerHTML = this.state.suggestions
      .map(feature => `
        <div class="suggestion-item" 
             role="option"
             tabindex="0"
             data-value="${feature.diana_properties.display_name.replace(/"/g, '&quot;')}"
             data-location_type="${feature.diana_properties.location_type}"
             data-lat="${feature.geometry.coordinates[1]}"
             data-lon="${feature.geometry.coordinates[0]}">
          ${feature.diana_properties.display_name}
        </div>
      `).join('');

    this.elements.suggestionsContainer.style.display =
      this.state.suggestions.length > 0 ? 'block' : 'none';
    this.elements.originInput.setAttribute('aria-expanded',
      this.state.suggestions.length > 0 ? 'true' : 'false');
  }

  renderConnectionResults() {
    // Render sliders with recommended connections
    this.renderTimeSlots('topSlider', this.state.toConnections, 'to');
    this.renderTimeSlots('bottomSlider', this.state.fromConnections, 'from');

    // Set initial active filters using recommended indices
    if (this.state.toConnections.length > 0) {
      const recommendedTo = this.state.toConnections[this.state.recommendedToIndex];
      const startTime = recommendedTo.connection_start_timestamp.split(" ")[1].substring(0, 5);
      const endTime = recommendedTo.connection_end_timestamp.split(" ")[1].substring(0, 5);
      this.filterConnectionsByTime('to', startTime, endTime);
    }

    if (this.state.fromConnections.length > 0) {
      const recommendedFrom = this.state.fromConnections[this.state.recommendedFromIndex];
      const startTime = recommendedFrom.connection_start_timestamp.split(" ")[1].substring(0, 5);
      const endTime = recommendedFrom.connection_end_timestamp.split(" ")[1].substring(0, 5);
      this.filterConnectionsByTime('from', startTime, endTime);
    }

    // Add swipe behavior
    this.addSwipeBehavior('topSlider');
    this.addSwipeBehavior('bottomSlider');
  }

  renderTimeSlots(sliderId, connections, type) {
    const slider = this.elements[sliderId];
    slider.innerHTML = '';

    connections.forEach((conn, index) => {
      const startTime = conn.connection_start_timestamp.split(" ")[1].substring(0, 5);
      const endTime = conn.connection_end_timestamp.split(" ")[1].substring(0, 5);
      const duration = this.calculateTimeDifference(
        conn.connection_start_timestamp,
        conn.connection_end_timestamp
      );

      const btn = document.createElement('button');
      btn.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="font-size: 14px; margin-bottom: 4px; font-weight: bold;">
            ${startTime} - ${endTime}
          </div>
          <div style="display: flex; justify-content:space-between; width: 100%;
                      width: -moz-available;          /* WebKit-based browsers will ignore this. */
                      width: -webkit-fill-available;  /* Mozilla-based browsers will ignore this. */
                      width: fill-available;
                      align-items: center; font-size: 12px; color: #666;">
            <span>${duration}</span>
            <div style="display: flex; gap:2px; align-items: center;">
              <span>${conn.connection_transfers}</span>
              <svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.8537 8.85354L12.8537 10.8535C12.7598 10.9474 12.6326 11.0001 12.4999 11.0001C12.3672 11.0001 12.24 10.9474 12.1462 10.8535C12.0523 10.7597 11.9996 10.6325 11.9996 10.4998C11.9996 10.3671 12.0523 10.2399 12.1462 10.146L13.293 8.99979H2.70678L3.85366 10.146C3.94748 10.2399 4.00018 10.3671 4.00018 10.4998C4.00018 10.6325 3.94748 10.7597 3.85366 10.8535C3.75983 10.9474 3.63259 11.0001 3.49991 11.0001C3.36722 11.0001 3.23998 10.9474 3.14616 10.8535L1.14616 8.85354C1.09967 8.8071 1.06279 8.75196 1.03763 8.69126C1.01246 8.63056 0.999512 8.5655 0.999512 8.49979C0.999512 8.43408 1.01246 8.36902 1.03763 8.30832C1.06279 8.24762 1.09967 8.19248 1.14616 8.14604L3.14616 6.14604C3.23998 6.05222 3.36722 5.99951 3.49991 5.99951C3.63259 5.99951 3.75983 6.05222 3.85366 6.14604C3.94748 6.23986 4.00018 6.36711 4.00018 6.49979C4.00018 6.63247 3.94748 6.75972 3.85366 6.85354L2.70678 7.99979H13.293L12.1462 6.85354C12.0523 6.75972 11.9996 6.63247 11.9996 6.49979C11.9996 6.36711 12.0523 6.23986 12.1462 6.14604C12.24 6.05222 12.3672 5.99951 12.4999 5.99951C12.6326 5.99951 12.7598 6.05222 12.8537 6.14604L14.8537 8.14604C14.9001 8.19248 14.937 8.24762 14.9622 8.30832C14.9873 8.36902 15.0003 8.43408 15.0003 8.49979C15.0003 8.5655 14.9873 8.63056 14.9622 8.69126C14.937 8.75196 14.9001 8.8071 14.8537 8.85354Z" fill="black"/>
              </svg>
            </div>
          </div>
        </div>
      `;

      btn.addEventListener('click', () => {
        this.filterConnectionsByTime(type, startTime, endTime);
      });

      // Add 'active-time' class if this is the recommended connection
      const isRecommended = (
        (type === 'to' && index === this.state.recommendedToIndex) ||
        (type === 'from' && index === this.state.recommendedFromIndex)
      );

      if (isRecommended) {
        btn.classList.add('active-time');
      }

      slider.appendChild(btn);
    });
  }

  filterConnectionsByTime(type, startTime, endTime) {
    const connections = type === 'from' ? this.state.fromConnections : this.state.toConnections;
    const sliderId = type === 'from' ? 'bottomSlider' : 'topSlider';
    const targetBox = type === 'from' ? this.elements.responseBoxBottom : this.elements.responseBox;

    // Update active button in slider
    const slider = this.elements[sliderId];
    const buttons = slider.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.classList.remove('active-time');
      if (btn.textContent.includes(`${startTime} - ${endTime}`)) {
        btn.classList.add('active-time');
      }
    });

    // Filter connections
    const filtered = connections.filter(conn => {
      const connStart = conn.connection_start_timestamp.split(" ")[1].substring(0, 5);
      const connEnd = conn.connection_end_timestamp.split(" ")[1].substring(0, 5);
      return connStart === startTime && connEnd === endTime;
    });

    this.updateActivityTimeBox(filtered[0], type);

    // Render connection details
    targetBox.innerHTML = this.renderConnectionDetails(filtered, type);
  }

  updateActivityTimeBox(connection, type) {
    if (!connection) return;

    try {
      const connectionStartTime = connection.connection_start_timestamp.split(" ")[1];
      const connectionEndTime = connection.connection_end_timestamp.split(" ")[1];

      let startTime, endTime, duration, hoursminutes, hours, minutes;

      if (type === 'to') {
        // For "to activity" connections, calculate latest possible start
        const earliestStart = this.config.activityEarliestStartTime;
        startTime = this.getLaterTime(connectionEndTime, earliestStart);

        if (!this.config.activityEarliestStartTimeFlexible) {
          this.state.activityTimes.warning_earlystart = this.getLaterTime(startTime, earliestStart) === earliestStart;
        }

        // Store for later use with "from activity" connections
        this.state.activityTimes.start = startTime;
      } else {
        // For "from activity" connections, calculate earliest possible end
        const latestEnd = this.config.activityLatestEndTime;
        endTime = this.getEarlierTime(connectionStartTime, latestEnd);

        if (!this.config.activityLatestEndTimeFlexible) {
          this.state.activityTimes.warning_lateend = this.getEarlierTime(endTime, latestEnd) === latestEnd;
        }

        // Calculate duration using stored start time
        startTime = this.state.activityTimes.start;
        [duration, hoursminutes] = this.calculateDuration(startTime, endTime);
        [hours, minutes] = hoursminutes.map(Number);

        this.state.activityTimes.warning_duration = (hours*60 + minutes) < this.config.activityDurationMinutes;

        // Update state
        this.state.activityTimes.end = endTime;
        this.state.activityTimes.duration = duration;
      }

      // Update the activity time box
      this.elements.activityTimeBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600; font-size: 18px; color: #111827;">
              ${this.config.activityName}
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="font-size: 14px; color: #6B7280; font-weight: 600;">
                ${this.state.activityTimes.warning_earlystart ?
                    `<div class="activity-time-warning-text">Warning: Earlier Arrival than recommended starting time of activity!</div>` : ''}
                <div>${this.config.activityStartTimeLabel || 'Start time'}: ${this.state.activityTimes.start || '--:--'}</div>
                <div>${this.config.activityEndTimeLabel || 'End time'}: ${this.state.activityTimes.end || '--:--'}</div>
                ${this.state.activityTimes.warning_lateend ?
                    `<div class="activity-time-warning-text">Warning: Later Departure than recommended ending time of activity!</div>` : ''}
                <div>Duration: ${this.state.activityTimes.duration || '-- hrs'}</div>
                ${this.state.activityTimes.warning_duration ?
                    `<div class="activity-time-warning-text">Warning: Activity duration below recommended (${this.getTimeFormatFromMinutes(this.config.activityDurationMinutes)})!</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error updating activity time box:", error);
    }
  }

  renderConnectionDetails(connections, type) {
    if (!connections || connections.length === 0) {
      return '<div>No connection details available</div>';
    }

    return connections.map(conn => {
      if (!conn.connection_elements || conn.connection_elements.length === 0) {
        return '<div>No connection elements available</div>';
      }

      let html = `
        <div class="connection-meta">
          <span>${conn.connection_start_timestamp.split(" ")[1].substring(0, 5)} - 
                ${conn.connection_end_timestamp.split(" ")[1].substring(0, 5)}</span>
          <span>${this.calculateTimeDifference(
            conn.connection_start_timestamp,
            conn.connection_end_timestamp
          )}</span>
          <span>${conn.connection_transfers} transfers</span>
        </div>
        <div class="connection-elements">
      `;

      // Render each connection element (departures)
      conn.connection_elements.forEach((element, index) => {
        const departureTime = element.departure_time.split("T")[1]?.substring(0, 5) || '--:--';
        const arrivalTime = element.arrival_time.split("T")[1]?.substring(0, 5) || '--:--';
        const duration = this.calculateElementDuration(
          element.departure_time,
          element.arrival_time
        );

        let icon;
        if (element.type !== 'JNY') {
          icon = this.getTransportIcon(element.type || 'DEFAULT');
        } else {
          icon = this.getTransportIcon(element.vehicle_type || 'DEFAULT');
        }

        if (index === 0) {
          if (type === "from") {
            html += `
              <div class="connection-element">
                <div class="element-time">
                  <span>${departureTime}</span> ${this.config.activityEndLocationDisplayName || element.from_location}
                </div>
                <div id="eleCont">
                  <span class="element-icon">${this.getTransportIcon('WALK')}</span>
                  <span class="element-duration">Departure</span>
                </div>
              </div>
            `;
          } else {
            html += `
              <div class="connection-element">
                <div class="element-time">
                  <span>${departureTime}</span> ${this.elements.originInput.value}
                </div>
                <div id="eleCont">
                  <div class="element-crcl"></div>
                  <span class="element-icon">${icon}</span>
                  <span class="element-duration">${element.vehicle_name || duration}</span>
                </div>
              </div>
            `;
          }
        } else {
          html += `
            <div class="connection-element">
              <div class="element-time">
                <span>${departureTime}</span> ${element.from_location}
              </div>
              <div id="eleCont">
                <div class="element-crcl"></div>
                <span class="element-icon">${icon}</span>
                <span class="element-duration">${element.vehicle_name || duration}</span>
              </div>
            </div>
          `;
        }



        // If this is the last element, also show the final destination (to_location)
        if (index === conn.connection_elements.length - 1) {
          if (type === "to") {
            html += `
              <div class="connection-element">
                <div class="element-time">
                  <span>${arrivalTime}</span> ${this.config.activityStartLocationDisplayName || element.to_location}
                </div>
                <div id="eleCont">
                  <div class="element-crcl"></div>
                  <span class="element-icon">${this.getTransportIcon('WALK')}</span>
                  <span class="element-duration">Arrival</span>
                </div>
              </div>
            `;
          } else {
            html += `
              <div class="connection-element">
                <div class="element-time">
                  <span>${arrivalTime}</span> ${this.elements.originInput.value}
                </div>
              </div>
            `;
          }
        }
      });

      html += `</div>`;
      return html;
    }).join('');
  }

  // Calendar methods (from original implementation)
  initCalendar() {
    // Check if mobile device
    if (window.matchMedia("(max-width: 768px)").matches) {
      // Show native date input for mobile
      this.elements.activityDate.type = "date";
      this.elements.activityDate.addEventListener("change", (e) => {
        this.state.selectedDate = new Date(e.target.value);
        this.updateDateDisplay(this.state.selectedDate);
      });
      return; // Skip custom calendar initialization
    }

    const dateInputContainer = this.container.querySelector(".date-input-container");

    // Create calendar container
    const calendarContainer = document.createElement("div");
    calendarContainer.className = "calendar-container";
    dateInputContainer.appendChild(calendarContainer);

    // Track selected date
    let selectedDate = this.state.selectedDate;
    let currentViewMonth = this.state.selectedDate.getMonth();
    let currentViewYear = this.state.selectedDate.getFullYear();

    // Render calendar function
    const renderCalendar = () => {
      const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();
      const firstDayOfMonth = new Date(currentViewYear, currentViewMonth, 1).getDay();

      // Calendar HTML
      calendarContainer.innerHTML = `
        <div class="calendar-header">
          <p class="calendar-title">Select Activity Date</p>
        </div>
        <div class="calendar-body">
          <div class="calendar-nav">
            <button class="calendar-nav-btn prev-month" aria-label="Previous month">
              <svg width="6" height="12" viewBox="0 0 6 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.3 11L1.66938 6.76428C1.2842 6.3149 1.2842 5.65177 1.66939 5.20238L5.3 0.966667" stroke="#656C6E" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="calendar-month-year">${this.getMonthName(currentViewMonth)} ${currentViewYear}</div>
            <button class="calendar-nav-btn next-month" aria-label="Next month">
              <svg width="6" height="12" viewBox="0 0 6 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0.699999 1L4.33061 5.23572C4.7158 5.6851 4.7158 6.34823 4.33061 6.79762L0.699999 11.0333" stroke="#656C6E" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="calendar-grid">
            <div class="calendar-day-header">S</div>
            <div class="calendar-day-header">M</div>
            <div class="calendar-day-header">T</div>
            <div class="calendar-day-header">W</div>
            <div class="calendar-day-header">T</div>
            <div class="calendar-day-header">F</div>
            <div class="calendar-day-header">S</div>
            ${this.generateCalendarDaysHTML(daysInMonth, firstDayOfMonth, currentViewYear, currentViewMonth)}
          </div>
        </div>
        <div class="calendar-footer">
          <button type="button" class="calendar-footer-btn calendar-cancel-btn">Cancel</button>
          <button type="button" class="calendar-footer-btn calendar-apply-btn">Apply</button>
        </div>
      `;

      // Event listeners for calendar navigation
      calendarContainer.querySelector(".prev-month").addEventListener("click", (e) => {
        e.stopPropagation();
        currentViewMonth--;
        if (currentViewMonth < 0) {
          currentViewMonth = 11;
          currentViewYear--;
        }
        renderCalendar();
      });

      calendarContainer.querySelector(".next-month").addEventListener("click", (e) => {
        e.stopPropagation();
        currentViewMonth++;
        if (currentViewMonth > 11) {
          currentViewMonth = 0;
          currentViewYear++;
        }
        renderCalendar();
      });

      // Apply/cancel buttons
      calendarContainer.querySelector(".calendar-cancel-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        calendarContainer.classList.remove("active");
      });

      calendarContainer.querySelector(".calendar-apply-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.selectedDate = selectedDate;
        this.elements.activityDate.value = this.formatDatetime(this.state.selectedDate);
        this.updateDateDisplay(this.state.selectedDate);
        calendarContainer.classList.remove("active");
      });

      // Day selection
      const dayElements = calendarContainer.querySelectorAll(".calendar-day:not(.disabled)");
      dayElements.forEach(day => {
        day.addEventListener("click", (e) => {
          e.stopPropagation();
          dayElements.forEach(d => d.classList.remove("selected"));
          day.classList.add("selected");
          selectedDate = new Date(currentViewYear, currentViewMonth, parseInt(day.textContent));
        });
      });
    };

    // Toggle calendar visibility
    dateInputContainer.addEventListener("click", (e) => {
      if (window.matchMedia("(max-width: 768px)").matches) return;
      e.stopPropagation();
      calendarContainer.classList.toggle("active");
      if (calendarContainer.classList.contains("active")) {
        renderCalendar();
      }
    });

    // Close calendar when clicking outside
    document.addEventListener("click", (e) => {
      if (calendarContainer.classList.contains("active") &&
          !dateInputContainer.contains(e.target) &&
          !calendarContainer.contains(e.target)) {
        calendarContainer.classList.remove("active");
      }
    });

    // Initialize with today's date
    renderCalendar();
  }

  formatDatetime(date) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  generateCalendarDaysHTML(daysInMonth, firstDayOfMonth, year, month) {
    let html = "";
    const today = new Date();

    // Empty cells for days before the first of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      html += "<div></div>";
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = date.toDateString() === this.state.selectedDate.toDateString();

      html += `<div class="calendar-day${isToday ? " today" : ""}${isSelected ? " selected" : ""}">${day}</div>`;
    }

    return html;
  }

  getMonthName(month) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[month];
  }

  // Utility methods
  updateDateDisplay(date) {
    if (date && !isNaN(date.getTime())) {
      const options = { day: "numeric", month: "short", year: "numeric" };
      this.elements.dateDisplay.textContent = date.toLocaleDateString("en-US", options);
      this.elements.dateDisplay.classList.remove("placeholder");
    } else {
      this.elements.dateDisplay.textContent = "Select";
      this.elements.dateDisplay.classList.add("placeholder");
    }
  }

  calculateTimeDifference(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end - start;
    const totalHours = (diff / (1000 * 60 * 60)).toFixed(1);
    return `${totalHours} hrs`;
  }

  calculateElementDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end - start;
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} min`;
  }

  getTransportIcon(type) {
    const icons = {
      1: `<svg width="16" height="16" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 0.5H2.5C1.96957 0.5 1.46086 0.710714 1.08579 1.08579C0.710714 1.46086 0.5 1.96957 0.5 2.5V10.5C0.5 11.0304 0.710714 11.5391 1.08579 11.9142C1.46086 12.2893 1.96957 12.5 2.5 12.5H3L2.1 13.7C2.0606 13.7525 2.03194 13.8123 2.01564 13.8759C1.99935 13.9395 1.99574 14.0057 2.00503 14.0707C2.01431 14.1357 2.03631 14.1982 2.06976 14.2547C2.10322 14.3112 2.14747 14.3606 2.2 14.4C2.25253 14.4394 2.3123 14.4681 2.37591 14.4844C2.43952 14.5007 2.50571 14.5043 2.57071 14.495C2.63571 14.4857 2.69825 14.4637 2.75475 14.4302C2.81125 14.3968 2.8606 14.3525 2.9 14.3L4.25 12.5H7.75L9.1 14.3C9.17957 14.4061 9.29801 14.4762 9.42929 14.495C9.56056 14.5137 9.69391 14.4796 9.8 14.4C9.90609 14.3204 9.97622 14.202 9.99498 14.0707C10.0137 13.9394 9.97956 13.8061 9.9 13.7L9 12.5H9.5C10.0304 12.5 10.5391 12.2893 10.9142 11.9142C11.2893 11.5391 11.5 11.0304 11.5 10.5V2.5C11.5 1.96957 11.2893 1.46086 10.9142 1.08579C10.5391 0.710714 10.0304 0.5 9.5 0.5ZM2.5 1.5H9.5C9.76522 1.5 10.0196 1.60536 10.2071 1.79289C10.3946 1.98043 10.5 2.23478 10.5 2.5V6.5H1.5V2.5C1.5 2.23478 1.60536 1.98043 1.79289 1.79289C1.98043 1.60536 2.23478 1.5 2.5 1.5ZM9.5 11.5H2.5C2.23478 11.5 1.98043 11.3946 1.79289 11.2071C1.60536 11.0196 1.5 10.7652 1.5 10.5V7.5H10.5V10.5C10.5 10.7652 10.3946 11.0196 10.2071 11.2071C10.0196 11.3946 9.76522 11.5 9.5 11.5ZM4 9.75C4 9.89834 3.95601 10.0433 3.8736 10.1667C3.79119 10.29 3.67406 10.3861 3.53701 10.4429C3.39997 10.4997 3.24917 10.5145 3.10368 10.4856C2.9582 10.4567 2.82456 10.3852 2.71967 10.2803C2.61478 10.1754 2.54335 10.0418 2.51441 9.89632C2.48547 9.75083 2.50032 9.60003 2.55709 9.46299C2.61386 9.32594 2.70999 9.20881 2.83332 9.1264C2.95666 9.04399 3.10166 9 3.25 9C3.44891 9 3.63968 9.07902 3.78033 9.21967C3.92098 9.36032 4 9.55109 4 9.75ZM9.5 9.75C9.5 9.89834 9.45601 10.0433 9.3736 10.1667C9.29119 10.29 9.17406 10.3861 9.03701 10.4429C8.89997 10.4997 8.74917 10.5145 8.60368 10.4856C8.4582 10.4567 8.32456 10.3852 8.21967 10.2803C8.11478 10.1754 8.04335 10.0418 8.01441 9.89632C7.98547 9.75083 8.00033 9.60003 8.05709 9.46299C8.11386 9.32594 8.20999 9.20881 8.33332 9.1264C8.45666 9.04399 8.60166 9 8.75 9C8.94891 9 9.13968 9.07902 9.28033 9.21967C9.42098 9.36032 9.5 9.55109 9.5 9.75Z" fill="#34C759"/>
          </svg>`,
      WALK: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.50003 5C9.8956 5 10.2823 4.8827 10.6112 4.66294C10.9401 4.44318 11.1964 4.13082 11.3478 3.76537C11.4992 3.39992 11.5388 2.99778 11.4616 2.60982C11.3844 2.22186 11.194 1.86549 10.9142 1.58579C10.6345 1.30608 10.2782 1.1156 9.89021 1.03843C9.50225 0.96126 9.10012 1.00087 8.73467 1.15224C8.36921 1.30362 8.05686 1.55996 7.83709 1.88886C7.61733 2.21776 7.50003 2.60444 7.50003 3C7.50003 3.53043 7.71075 4.03914 8.08582 4.41422C8.46089 4.78929 8.9696 5 9.50003 5ZM9.50003 2C9.69781 2 9.89115 2.05865 10.0556 2.16853C10.2201 2.27841 10.3482 2.43459 10.4239 2.61732C10.4996 2.80004 10.5194 3.00111 10.4808 3.19509C10.4422 3.38907 10.347 3.56726 10.2071 3.70711C10.0673 3.84696 9.8891 3.9422 9.69512 3.98079C9.50114 4.01937 9.30007 3.99957 9.11735 3.92388C8.93462 3.84819 8.77844 3.72002 8.66856 3.55557C8.55868 3.39112 8.50003 3.19778 8.50003 3C8.50003 2.73478 8.60539 2.48043 8.79293 2.29289C8.98046 2.10536 9.23482 2 9.50003 2ZM13.5 9C13.5 9.13261 13.4474 9.25979 13.3536 9.35356C13.2598 9.44732 13.1326 9.5 13 9.5C10.7932 9.5 9.69066 8.38688 8.80503 7.4925C8.63378 7.31938 8.47003 7.155 8.30503 7.0025L7.46566 8.9325L9.79066 10.5931C9.85542 10.6394 9.9082 10.7004 9.94462 10.7712C9.98104 10.842 10 10.9204 10 11V14.5C10 14.6326 9.94735 14.7598 9.85359 14.8536C9.75982 14.9473 9.63264 15 9.50003 15C9.36742 15 9.24025 14.9473 9.14648 14.8536C9.05271 14.7598 9.00003 14.6326 9.00003 14.5V11.2575L7.05816 9.87L4.95878 14.6994C4.91993 14.7887 4.85581 14.8648 4.77431 14.9182C4.69281 14.9716 4.59747 15 4.50003 15C4.43137 15.0002 4.36345 14.9859 4.30066 14.9581C4.17911 14.9053 4.08351 14.8064 4.03488 14.6831C3.98624 14.5598 3.98855 14.4222 4.04128 14.3006L7.42128 6.5275C6.83941 6.42438 6.11378 6.6025 5.25253 7.06375C4.56566 7.44263 3.92458 7.89917 3.34191 8.42438C3.24465 8.51149 3.11717 8.55711 2.98673 8.55148C2.85628 8.54584 2.73321 8.48941 2.64383 8.39423C2.55444 8.29905 2.50584 8.17268 2.5084 8.04213C2.51096 7.91159 2.56448 7.78723 2.65753 7.69563C2.81378 7.54875 6.51316 4.11875 8.82753 6.12813C9.06691 6.33563 9.29503 6.56563 9.51503 6.78875C10.3869 7.66875 11.21 8.5 13 8.5C13.1326 8.5 13.2598 8.55268 13.3536 8.64645C13.4474 8.74022 13.5 8.86739 13.5 9Z" fill="#FF9500"/>
            </svg>`,
      TRSF: `<svg width="16" height="16" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.8537 8.85354L12.8537 10.8535C12.7598 10.9474 12.6326 11.0001 12.4999 11.0001C12.3672 11.0001 12.24 10.9474 12.1462 10.8535C12.0523 10.7597 11.9996 10.6325 11.9996 10.4998C11.9996 10.3671 12.0523 10.2399 12.1462 10.146L13.293 8.99979H2.70678L3.85366 10.146C3.94748 10.2399 4.00018 10.3671 4.00018 10.4998C4.00018 10.6325 3.94748 10.7597 3.85366 10.8535C3.75983 10.9474 3.63259 11.0001 3.49991 11.0001C3.36722 11.0001 3.23998 10.9474 3.14616 10.8535L1.14616 8.85354C1.09967 8.8071 1.06279 8.75196 1.03763 8.69126C1.01246 8.63056 0.999512 8.5655 0.999512 8.49979C0.999512 8.43408 1.01246 8.36902 1.03763 8.30832C1.06279 8.24762 1.09967 8.19248 1.14616 8.14604L3.14616 6.14604C3.23998 6.05222 3.36722 5.99951 3.49991 5.99951C3.63259 5.99951 3.75983 6.05222 3.85366 6.14604C3.94748 6.23986 4.00018 6.36711 4.00018 6.49979C4.00018 6.63247 3.94748 6.75972 3.85366 6.85354L2.70678 7.99979H13.293L12.1462 6.85354C12.0523 6.75972 11.9996 6.63247 11.9996 6.49979C11.9996 6.36711 12.0523 6.23986 12.1462 6.14604C12.24 6.05222 12.3672 5.99951 12.4999 5.99951C12.6326 5.99951 12.7598 6.05222 12.8537 6.14604L14.8537 8.14604C14.9001 8.19248 14.937 8.24762 14.9622 8.30832C14.9873 8.36902 15.0003 8.43408 15.0003 8.49979C15.0003 8.5655 14.9873 8.63056 14.9622 8.69126C14.937 8.75196 14.9001 8.8071 14.8537 8.85354Z" fill="black"/>
             </svg>`,
      DEFAULT: `<svg width="16" height="16" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 0.5C7.5 0.632608 7.44732 0.759785 7.35355 0.853553C7.25979 0.947321 7.13261 1 7 1H5C4.86739 1 4.74021 0.947321 4.64645 0.853553C4.55268 0.759785 4.5 0.632608 4.5 0.5C4.5 0.367392 4.55268 0.240215 4.64645 0.146447C4.74021 0.0526785 4.86739 0 5 0H7C7.13261 0 7.25979 0.0526785 7.35355 0.146447C7.44732 0.240215 7.5 0.367392 7.5 0.5ZM7 11H5C4.86739 11 4.74021 11.0527 4.64645 11.1464C4.55268 11.2402 4.5 11.3674 4.5 11.5C4.5 11.6326 4.55268 11.7598 4.64645 11.8536C4.74021 11.9473 4.86739 12 5 12H7C7.13261 12 7.25979 11.9473 7.35355 11.8536C7.44732 11.7598 7.5 11.6326 7.5 11.5C7.5 11.3674 7.44732 11.2402 7.35355 11.1464C7.25979 11.0527 7.13261 11 7 11ZM11 0H9.5C9.36739 0 9.24021 0.0526785 9.14645 0.146447C9.05268 0.240215 9 0.367392 9 0.5C9 0.632608 9.05268 0.759785 9.14645 0.853553C9.24021 0.947321 9.36739 1 9.5 1H11V2.5C11 2.63261 11.0527 2.75979 11.1464 2.85355C11.2402 2.94732 11.3674 3 11.5 3C11.6326 3 11.7598 2.94732 11.8536 2.85355C11.9473 2.75979 12 2.63261 12 2.5V1C12 0.734784 11.8946 0.48043 11.7071 0.292893C11.5196 0.105357 11.2652 0 11 0ZM11.5 4.5C11.3674 4.5 11.2402 4.55268 11.1464 4.64645C11.0527 4.74021 11 4.86739 11 5V7C11 7.13261 11.0527 7.25979 11.1464 7.35355C11.2402 7.44732 11.3674 7.5 11.5 7.5C11.6326 7.5 11.7598 7.44732 11.8536 7.35355C11.9473 7.25979 12 7.13261 12 7V5C12 4.86739 11.9473 4.74021 11.8536 4.64645C11.7598 4.55268 11.6326 4.5 11.5 4.5ZM11.5 9C11.3674 9 11.2402 9.05268 11.1464 9.14645C11.0527 9.24021 11 9.36739 11 9.5V11H9.5C9.36739 11 9.24021 11.0527 9.14645 11.1464C9.05268 11.2402 9 11.3674 9 11.5C9 11.6326 9.05268 11.7598 9.14645 11.8536C9.24021 11.9473 9.36739 12 9.5 12H11C11.2652 12 11.5196 11.8946 11.7071 11.7071C11.8946 11.5196 12 11.2652 12 11V9.5C12 9.36739 11.9473 9.24021 11.8536 9.14645C11.7598 9.05268 11.6326 9 11.5 9ZM0.5 7.5C0.632608 7.5 0.759785 7.44732 0.853553 7.35355C0.947321 7.25979 1 7.13261 1 7V5C1 4.86739 0.947321 4.74021 0.853553 4.64645C0.759785 4.55268 0.632608 4.5 0.5 4.5C0.367392 4.5 0.240215 4.55268 0.146447 4.64645C0.0526785 4.74021 0 4.86739 0 5V7C0 7.13261 0.0526785 7.25979 0.146447 7.35355C0.240215 7.44732 0.367392 7.5 0.5 7.5ZM2.5 11H1V9.5C1 9.36739 0.947321 9.24021 0.853553 9.14645C0.759785 9.05268 0.632608 9 0.5 9C0.367392 9 0.240215 9.05268 0.146447 9.14645C0.0526785 9.24021 0 9.36739 0 9.5V11C0 11.2652 0.105357 11.5196 0.292893 11.7071C0.48043 11.8946 0.734784 12 1 12H2.5C2.63261 12 2.75979 11.9473 2.85355 11.8536C2.94732 11.7598 3 11.6326 3 11.5C3 11.3674 2.94732 11.2402 2.85355 11.1464C2.75979 11.0527 2.63261 11 2.5 11ZM2.5 0H1C0.734784 0 0.48043 0.105357 0.292893 0.292893C0.105357 0.48043 0 0.734784 0 1V2.5C0 2.63261 0.0526785 2.75979 0.146447 2.85355C0.240215 2.94732 0.367392 3 0.5 3C0.632608 3 0.759785 2.94732 0.853553 2.85355C0.947321 2.75979 1 2.63261 1 2.5V1H2.5C2.63261 1 2.75979 0.947321 2.85355 0.853553C2.94732 0.759785 3 0.632608 3 0.5C3 0.367392 2.94732 0.240215 2.85355 0.146447C2.75979 0.0526785 2.63261 0 2.5 0Z" fill="#AEAEB2"/>
             </svg>`,
    };

    return icons[type] || icons["DEFAULT"];
  }

  getLaterTime(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    if (h1 > h2 || (h1 === h2 && m1 > m2)) {
      return `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`;
    }
    return `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
  }

  getEarlierTime(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    if (h1 < h2 || (h1 === h2 && m1 < m2)) {
      return `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`;
    }
    return `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
  }

  calculateDuration(startTime, endTime) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return [`${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min`, [hours, minutes]];
    }
    return [`${minutes} min`, [0, minutes]];
  }

  getTimeFormatFromMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} hr${hours !== 1 ? 's' : ''} ${mins} min`
    }
    return `${mins} min`;
  }

  addSwipeBehavior(sliderId) {
    const slider = this.elements[sliderId];
    let startX, scrollLeft, isDown = false;

    slider.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
      isDown = false;
    });

    slider.addEventListener('mouseup', () => {
      isDown = false;
    });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 2;
      slider.scrollLeft = scrollLeft - walk;
    });

    // Touch events for mobile
    slider.addEventListener('touchstart', (e) => {
      isDown = true;
      startX = e.touches[0].pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('touchend', () => {
      isDown = false;
    });

    slider.addEventListener('touchmove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.touches[0].pageX - slider.offsetLeft;
      const walk = (x - startX) * 2;
      slider.scrollLeft = scrollLeft - walk;
    });
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Navigation methods
  navigateToResults() {
    this.elements.formPage.classList.remove("active");
    this.elements.resultsPage.classList.add("active");
    this.elements.innerContainer.style.transform = "unset";
  }

  slideToRecommendedConnections() {
    let topSlider = this.elements["topSlider"];
    let topActiveBtn = topSlider.querySelector('.active-time');
    if (topActiveBtn) {
      topSlider.scrollLeft = topActiveBtn.offsetLeft - (topSlider.offsetWidth / 2) + (topActiveBtn.offsetWidth / 2);
    }

    let bottomSlider = this.elements["bottomSlider"];
    let bottomActiveBtn = bottomSlider.querySelector('.active-time');
    if (bottomActiveBtn) {
      bottomSlider.scrollLeft = bottomActiveBtn.offsetLeft - (bottomSlider.offsetWidth / 2) + (bottomActiveBtn.offsetWidth / 2);
    }
  }

  navigateToForm() {
    this.elements.resultsPage.classList.remove("active");
    this.elements.formPage.classList.add("active");
  }

  setLoadingState(isLoading) {
    this.state.loading = isLoading;
    this.elements.searchBtn.disabled = isLoading;
    this.elements.searchBtn.textContent = isLoading ? "Searching..." : "Search";
    this.elements.searchBtn.setAttribute('aria-busy', isLoading);
  }

  showError(message) {
    this.state.error = message;
    this.elements.errorContainer.textContent = message;
    this.elements.errorContainer.style.display = message ? "block" : "none";

    if (message) {
      console.error(`Error: ${message}`);
    }
  }
}