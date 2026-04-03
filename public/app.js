import { bootstrapSession } from "./js/app-shell.js";
import { initializeForms, attachEventListeners } from "./js/events.js";
import { resetCategoryEditor } from "./js/features/categories.js";

attachEventListeners();
initializeForms();
resetCategoryEditor();
bootstrapSession();
