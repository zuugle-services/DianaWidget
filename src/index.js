import DianaWidget from './core/widget';

// Initialize the widget when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  try {
    // Use window.dianaActivityConfig if available, or empty object
    const config = window.dianaActivityConfig || {};
    window.dianawidget = new DianaWidget(config);
  } catch (error) {
    console.error("Failed to initialize Diana Widget:", error);
    // Fallback UI if initialization fails
    const fallback = document.createElement('div');
    fallback.style.padding = '20px';
    fallback.style.backgroundColor = '#ffebee';
    fallback.style.border = '1px solid #ef9a9a';
    fallback.style.borderRadius = '4px';
    fallback.style.margin = '10px';
    fallback.innerHTML = `
      <h3 style="color: #c62828; margin-top: 0;">Diana Widget Failed to Load</h3>
      <p>We're unable to load the diana widget transit planner at this time. Please try again later.</p>
      <p><small>Error: ${error.message}</small></p>
    `;
    document.getElementById("dianaWidgetContainer").innerHTML = "";
    document.getElementById("dianaWidgetContainer").appendChild(fallback);
  }
});