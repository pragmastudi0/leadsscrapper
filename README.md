# Leads Scrapper

Scraper de negocios multi-fuente (Google Maps, Instagram, sitios web). Genera leads con nombre, teléfono, dirección y web en formato JSON y CSV.

---

## Requisitos

- Node.js 18 o superior
- npm

---

## Instalación

```bash
git clone https://github.com/pragmastudi0/leadsscrapper.git
cd leadsscrapper/business-scraper
npm install
npx playwright install chromium
```

---

## Configuración

Creá un archivo `.env` dentro de `business-scraper/` copiando el ejemplo:

```bash
cp .env.example .env
```

Editá el `.env` con tus búsquedas:

```env
# Palabras clave a buscar (separadas por coma)
SEARCH_KEYWORDS=contador,estudio contable,asesoría impositiva

# Ciudades donde buscar (separadas por coma)
SEARCH_CITIES=Córdoba,Rosario,Buenos Aires

# Cantidad máxima de leads por combinación keyword+ciudad
SEARCH_LIMIT=10
```

> Si no creás el `.env`, usa los valores por defecto: busca "restaurante,cafetería" en Córdoba y Buenos Aires.

---

## Cómo correrlo

```bash
cd business-scraper
npm run dev
```

La terminal va a ir mostrando en tiempo real lo que encuentra:

```
INFO  🔍 Recolectando URLs del feed (máx 10)...
DEBUG   + URL #1: Estudio Contable Martínez
DEBUG   + URL #2: Contadores Asociados Rosario
INFO  📜 Scroll #1 — 8/10 URLs encontradas
INFO  ✅ Recolección terminada: 10 URLs únicas

INFO  [1/10] Abriendo lugar...
INFO  [1/10] 🏪 Estudio Contable Martínez
DEBUG      📞 +54 351 555-1234  |  📍 San Martín 450, Córdoba  |  🌐 estudiomartinez.com
✅ Lead guardado: Estudio Contable Martínez (1/10)
```

---

## Resultados

Los leads se guardan automáticamente en `business-scraper/` al terminar:

| Archivo | Descripción |
|---|---|
| `leads.json` | Todos los leads en formato JSON |
| `leads.csv` | Listo para abrir en Excel o Google Sheets |

---

## Estructura del proyecto

```
leadsscrapper/
├── business-scraper/        ← Scraper TypeScript (CLI)
│   ├── src/
│   │   ├── scrapers/        ← Google Maps, Instagram, Website
│   │   ├── services/        ← Limpieza, validación, deduplicación
│   │   ├── outputs/         ← Exporta a JSON, CSV, Google Sheets
│   │   ├── config/          ← Configuración y variables de entorno
│   │   └── index.ts         ← Punto de entrada
│   ├── .env.example
│   └── package.json
└── dashboard/               ← Dashboard visual (React + Vite)
```

---

## Google Sheets (opcional)

Si querés exportar directo a Google Sheets:

1. Creá un proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitá la API de Google Sheets
3. Descargá las credenciales como `credentials.json` y ponelo en `business-scraper/`
4. En el `.env` agregá:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=tu_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials.json
```
