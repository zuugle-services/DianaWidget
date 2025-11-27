/**
 * Template arguments interface (generic)
 */
interface TemplateArgs {
    [key: string]: unknown;
}

/**
 * Template module interface
 */
interface TemplateModule {
    [key: string]: ((args: TemplateArgs) => string) | unknown;
}

/**
 * Manages the loading and rendering of UI templates.
 */
export class UIManager {
    /**
     * Initializes the UIManager.
     * Templates are expected to be JavaScript modules exporting a function
     * that returns an HTML string. The function name should be `get<TemplateName>HTML`.
     * For example, for 'formPageTemplate', it expects `getFormPageTemplateHTML`.
     */
    constructor() {
        // Base path for dynamic imports is relative to this UIManager.ts file.
        // If UIManager.ts is in components/ and templates are in templates/,
        // the path for dynamic import would be `../templates/${templateFileName}`.
    }

    /**
     * Loads an HTML template.
     * @param templateFileName - The name of the template file (e.g., 'formPageTemplate').
     * @param args - An object containing arguments to pass to the template function (config, t, state, etc.).
     * @returns A promise that resolves with the HTML string of the template.
     */
    async loadTemplate(templateFileName: string, args: TemplateArgs): Promise<string> {
        try {
            // Construct the function name, e.g., formPageTemplate -> getFormPageTemplateHTML
            const functionName = `get${templateFileName.charAt(0).toUpperCase() + templateFileName.slice(1)}HTML`;

            // Dynamically import the template module.
            // The path is relative to UIManager.ts (components/UIManager.ts)
            // going up to the parent and then into templates/
            const module: TemplateModule = await import(`../templates/${templateFileName}`);

            if (module && typeof module[functionName] === 'function') {
                // Call the template function with the provided arguments
                return (module[functionName] as (args: TemplateArgs) => string)(args);
            } else {
                throw new Error(`Template function '${functionName}' not found in ${templateFileName}`);
            }
        } catch (error) {
            console.error(`Error loading template module ${templateFileName}:`, error);
            // Provide a fallback error message in the UI
            return `<p style="color: red; padding: 10px;">Error loading template: ${templateFileName}. Please check the console for more details.</p>`;
        }
    }
}
