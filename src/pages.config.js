/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Ajustes from './pages/Ajustes';
import Configuracion from './pages/Configuracion';
import Consultas from './pages/Consultas';
import Contactos from './pages/Contactos';
import EditorListaWhatsApp from './pages/EditorListaWhatsApp';
import Home from './pages/Home';
import Hoy from './pages/Hoy';
import ListasWhatsApp from './pages/ListasWhatsApp';
import Pipeline from './pages/Pipeline';
import Plantillas from './pages/Plantillas';
import Reportes from './pages/Reportes';
import Variables from './pages/Variables';
import ScraperDashboard from './pages/ScraperDashboard';
import __Layout from './Layout.jsx';



export const PAGES = {
    "Ajustes": Ajustes,
    "Configuracion": Configuracion,
    "Consultas": Consultas,
    "Contactos": Contactos,
    "EditorListaWhatsApp": EditorListaWhatsApp,
    "Home": Home,
    "Hoy": Hoy,
    "ListasWhatsApp": ListasWhatsApp,
    "Pipeline": Pipeline,
    "Plantillas": Plantillas,
    "Reportes": Reportes,
    "Variables": Variables,
    "ScraperDashboard": ScraperDashboard,
}

export const pagesConfig = {
    mainPage: "ScraperDashboard",
    Pages: PAGES,
    Layout: __Layout,
};
