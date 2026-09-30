/**
 * ============================================================================
 *  VELLEE LUXE — Product Creation Automation (Google Apps Script)
 * ============================================================================
 *
 *  What this does:
 *    1. Every 5 minutes, looks inside one "parent" Google Drive folder.
 *    2. Each sub-folder named like  style-colour-fit  (e.g. oxford-white-tailored)
 *       is treated as ONE product.
 *    3. For every new sub-folder that contains photos, it:
 *         - reads style / colour / fit from the folder name
 *         - collects up to 6 image links
 *         - asks Gemini to write the name, description, care and SEO text
 *         - adds a new row to the "Products" tab with status = "draft"
 *         - remembers the folder so it is never processed twice
 *
 *  Script Properties (Project Settings > Script Properties):
 *    PRODUCTS_DRIVE_FOLDER_ID  (required)  ID of the parent Drive folder
 *    GEMINI_API_KEY            (required)  Google AI Studio API key
 *    SPREADSHEET_ID            (optional)  ID of the Google Sheet. If empty, the
 *                                          sheet this script is attached to is used.
 *    GEMINI_MODEL              (optional)  Override the Gemini model name.
 *    MAKE_IMAGES_PUBLIC        (optional)  "true" (default) / "false". When true,
 *                                          product photos are set to
 *                                          "Anyone with the link can view" so the
 *                                          website can display them.
 *
 *  Internal property (managed by the script, do not edit by hand):
 *    PROCESSED_FOLDER_IDS      JSON array of folder IDs already processed.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var PRODUCTS_SHEET_NAME = 'Products';
var ORDERS_SHEET_NAME = 'Orders';

var PRODUCT_HEADERS = [
  'id',               // A
  'slug',             // B
  'name',             // C
  'description',      // D
  'price',            // E
  'compareAtPrice',   // F
  'sizes',            // G
  'style',            // H
  'colour',           // I
  'fit',              // J
  'driveFolderId',    // K
  'images',           // L
  'careInstructions', // M
  'seoTitle',         // N
  'seoDescription',   // O
  'status',           // P
  'stock',            // Q
  'createdAt',        // R
  'updatedAt'         // S
];

// Headers for the Orders tab (the script never writes order rows, it only
// creates the tab so the website has somewhere to put them).
var ORDER_HEADERS = [
  'orderId', 'createdAt', 'customerName', 'email', 'phone', 'address',
  'items', 'subtotal', 'shipping', 'total', 'paymentStatus', 'paymentId',
  'fulfillmentStatus', 'notes'
];

var VALID_STYLES = ['oxford', 'linen', 'poplin', 'chambray', 'twill', 'flannel', 'dobby'];
var VALID_FITS = ['tailored', 'relaxed', 'oversized', 'slim'];

var STYLE_DESCRIPTIONS = {
  oxford: 'Oxford = classic woven cotton with a soft basket-weave texture',
  linen: 'Linen = breathable summer fabric with a natural slub',
  poplin: 'Poplin = smooth, crisp, lightweight plain-weave cotton',
  chambray: 'Chambray = light denim-look cotton, casual and soft',
  twill: 'Twill = diagonal-weave cotton, durable with a subtle sheen',
  flannel: 'Flannel = brushed cotton, soft and warm',
  dobby: 'Dobby = cotton with a small woven geometric texture'
};

var FIT_DESCRIPTIONS = {
  tailored: 'Tailored = structured close fit',
  relaxed: 'Relaxed = comfortable ease',
  oversized: 'Oversized = modern dropped shoulder',
  slim: 'Slim = trim, narrow cut through chest and waist'
};

var IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
var IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
var MAX_IMAGES = 6;

var DEFAULT_SIZES = 'S,M,L,XL,XXL';
var DEFAULT_STOCK = 'unlimited';
var DEFAULT_STATUS = 'draft';

// Gemini: first model tried is GEMINI_MODEL (if set), then these in order.
// Older models get retired by Google over time, so we fall back automatically.
var GEMINI_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash'];
var GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Apps Script stops any run after 6 minutes. Stop picking up new folders
// after this many milliseconds so we always finish cleanly.
var MAX_RUNTIME_MS = 4.5 * 60 * 1000;
var MAX_FOLDERS_PER_RUN = 10;

// ---------------------------------------------------------------------------
// MAIN — called by the 5-minute trigger
// ---------------------------------------------------------------------------

/**
 * Checks the parent Drive folder for new product folders and adds each new
 * one to the Products sheet as a draft.
 */
function checkNewProductFolders() {
  var startTime = Date.now();

  // Stop two runs from overlapping (e.g. a manual run during a trigger run).
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10 * 1000)) {
    Logger.log('Another run is already in progress. Skipping this run.');
    return;
  }

  try {
    var props = PropertiesService.getScriptProperties();
    var parentId = props.getProperty('PRODUCTS_DRIVE_FOLDER_ID');
    if (!parentId) {
      throw new Error('Script Property PRODUCTS_DRIVE_FOLDER_ID is not set. See APPS_SCRIPT_SETUP.md step 4.');
    }

    var parentFolder;
    try {
      parentFolder = DriveApp.getFolderById(parentId.trim());
    } catch (e) {
      throw new Error('Could not open the Drive folder with ID "' + parentId + '". Check PRODUCTS_DRIVE_FOLDER_ID. (' + e.message + ')');
    }

    var sheet = getProductsSheet_();
    var processedIds = getProcessedFolderIds_();
    var sheetFolderIds = getColumnValues_(sheet, 'driveFolderId');

    Logger.log('Checking folder "' + parentFolder.getName() + '" for new products...');

    var subFolders = parentFolder.getFolders();
    var added = 0;
    var skipped = 0;

    while (subFolders.hasNext()) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        Logger.log('Time limit approaching. Remaining folders will be handled on the next run.');
        break;
      }
      if (added >= MAX_FOLDERS_PER_RUN) {
        Logger.log('Processed ' + MAX_FOLDERS_PER_RUN + ' folders this run. The rest will be handled on the next run.');
        break;
      }

      var folder = subFolders.next();
      var folderId = folder.getId();
      var folderName = folder.getName();

      // Already done? (checked in Script Properties AND in the sheet itself)
      if (processedIds.indexOf(folderId) !== -1) continue;
      if (sheetFolderIds.indexOf(folderId) !== -1) {
        // Row exists but ID wasn't remembered (e.g. properties reset) — remember it now.
        markFolderProcessed_(folderId);
        processedIds.push(folderId);
        continue;
      }

      var parsed = parseFolderName(folderName);
      if (!parsed) {
        Logger.log('SKIPPED "' + folderName + '": name does not match style-colour-fit. ' +
          'Styles: ' + VALID_STYLES.join(', ') + '. Fits: ' + VALID_FITS.join(', ') + '. ' +
          'Rename the folder and it will be picked up on the next run.');
        skipped++;
        continue;
      }

      var images = getImageUrls(folderId);
      if (images.length === 0) {
        Logger.log('WAITING on "' + folderName + '": no photos yet. It will be picked up once photos are uploaded.');
        skipped++;
        continue;
      }

      try {
        Logger.log('NEW product folder: "' + folderName + '" (' + images.length + ' image(s)).');
        var content = generateProductContent(parsed.style, parsed.colour, parsed.fit, images.length);

        addProductToSheet({
          name: content.name,
          description: content.description,
          careInstructions: content.careInstructions,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
          style: parsed.style,
          colour: parsed.colour,
          fit: parsed.fit,
          driveFolderId: folderId,
          images: images
        });

        markFolderProcessed_(folderId);
        processedIds.push(folderId);
        added++;
      } catch (err) {
        // Folder is NOT marked processed, so it will be retried next run.
        Logger.log('ERROR processing "' + folderName + '": ' + err.message);
      }
    }

    Logger.log('Done. Added ' + added + ' product(s). Skipped/waiting: ' + skipped + '.');
  } catch (err) {
    Logger.log('FATAL: ' + err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Helpers (public — can be run individually for testing)
// ---------------------------------------------------------------------------

/**
 * Parses a folder name like "oxford-white-tailored" or "linen-sky-blue-relaxed".
 * First part = style, last part = fit, everything in between = colour.
 *
 * @param {string} folderName
 * @return {{style: string, colour: string, fit: string}|null} null if invalid
 */
function parseFolderName(folderName) {
  if (!folderName || typeof folderName !== 'string') return null;

  // Be forgiving: "Linen Sky_Blue  Relaxed" -> "linen-sky-blue-relaxed"
  var cleaned = folderName.trim().toLowerCase().replace(/[\s_]+/g, '-');
  var parts = cleaned.split('-').filter(function (p) { return p.length > 0; });

  if (parts.length < 3) return null;

  var style = parts[0];
  var fit = parts[parts.length - 1];
  var colourParts = parts.slice(1, parts.length - 1);

  if (VALID_STYLES.indexOf(style) === -1) return null;
  if (VALID_FITS.indexOf(fit) === -1) return null;
  if (colourParts.length === 0) return null;

  return {
    style: style,
    colour: colourParts.join('-'),
    fit: fit
  };
}

/**
 * Returns up to 6 direct-view image URLs from a Drive folder, sorted by file
 * name (so "01.jpg" comes before "02.jpg" — name your main photo first).
 *
 * @param {string} folderId
 * @return {string[]}
 */
function getImageUrls(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var imageFiles = [];

  while (files.hasNext()) {
    var file = files.next();
    if (file.isTrashed()) continue;
    if (isImageFile_(file)) imageFiles.push(file);
  }

  imageFiles.sort(function (a, b) {
    return a.getName().localeCompare(b.getName(), undefined, { numeric: true, sensitivity: 'base' });
  });

  var selected = imageFiles.slice(0, MAX_IMAGES);
  var makePublic = shouldMakeImagesPublic_();

  return selected.map(function (file) {
    if (makePublic) {
      try {
        if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK &&
            file.getSharingAccess() !== DriveApp.Access.ANYONE) {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          Logger.log('  Shared image "' + file.getName() + '" as "Anyone with the link can view".');
        }
      } catch (e) {
        Logger.log('  WARNING: could not change sharing on "' + file.getName() + '": ' + e.message +
          '. The website may not be able to show this image until you share it manually.');
      }
    }
    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  });
}

/**
 * Calls Gemini to write product copy. Never throws: if Gemini fails, logs the
 * error and returns placeholder content so the product row is still created.
 *
 * @param {string} style
 * @param {string} colour
 * @param {string} fit
 * @param {number} imageCount
 * @return {{name: string, description: string, careInstructions: string, seoTitle: string, seoDescription: string}}
 */
function generateProductContent(style, colour, fit, imageCount) {
  var fallback = buildPlaceholderContent_(style, colour, fit);

  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    Logger.log('WARNING: GEMINI_API_KEY is not set. Using placeholder content.');
    return fallback;
  }

  var colourReadable = colour.replace(/-/g, ' ');
  var prompt =
    'Generate product content for a premium men\'s shirt with these attributes:\n' +
    '- Style: ' + capitalize_(style) + ' (' + (STYLE_DESCRIPTIONS[style] || 'premium woven cotton') + ')\n' +
    '- Colour: ' + colourReadable + '\n' +
    '- Fit: ' + capitalize_(fit) + ' (' + (FIT_DESCRIPTIONS[fit] || '') + ')\n' +
    '- Number of product photos: ' + (imageCount || 0) + '\n' +
    '\n' +
    'Brand: Vellee Luxe — premium Indian men\'s fashion. Clean, modern, aspirational. NOT traditional/ethnic.\n' +
    '\n' +
    'Return a JSON object with exactly these fields:\n' +
    '{\n' +
    '  "name": "4-6 word product name (e.g., \'Oxford White Tailored Shirt\')",\n' +
    '  "description": "3-4 sentence compelling product description. Start with the feel/occasion, then construction, then styling. No buzzwords like \'elevate\' or \'effortlessly\'. Write for a 25-year-old urban Indian man.",\n' +
    '  "careInstructions": "2-3 care instructions, comma-separated",\n' +
    '  "seoTitle": "SEO title under 60 chars",\n' +
    '  "seoDescription": "SEO meta description under 155 chars"\n' +
    '}\n' +
    '\n' +
    'Return ONLY the JSON object, no markdown, no other text.';

  var payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json'
    }
  };

  var models = getGeminiModels_();
  var lastError = '';

  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    try {
      var response = UrlFetchApp.fetch(GEMINI_ENDPOINT + model + ':generateContent', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': apiKey.trim() },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var code = response.getResponseCode();
      var body = response.getContentText();

      if (code === 404 || (code === 400 && /not found|not supported/i.test(body))) {
        // Model retired or unavailable — try the next one.
        lastError = 'Model ' + model + ' unavailable (HTTP ' + code + ')';
        Logger.log('  ' + lastError + '. Trying next model...');
        continue;
      }
      if (code === 429 || code >= 500) {
        // Rate limited / server hiccup — wait briefly and try the next model.
        lastError = 'Model ' + model + ' returned HTTP ' + code;
        Logger.log('  ' + lastError + '. Waiting 3s and trying next model...');
        Utilities.sleep(3000);
        continue;
      }
      if (code !== 200) {
        lastError = 'HTTP ' + code + ': ' + body.substring(0, 500);
        break; // e.g. bad API key — no point trying other models
      }

      var json = JSON.parse(body);
      var text = extractGeminiText_(json);
      if (!text) {
        lastError = 'Empty response from ' + model + ': ' + body.substring(0, 300);
        continue;
      }

      var content = parseJsonLoose_(text);
      var result = normaliseContent_(content, fallback);
      Logger.log('  Gemini (' + model + ') generated: "' + result.name + '"');
      return result;
    } catch (e) {
      lastError = 'Model ' + model + ' error: ' + e.message;
      Logger.log('  ' + lastError);
    }
  }

  Logger.log('WARNING: Gemini failed (' + lastError + '). Using placeholder content — edit the row in the sheet before publishing.');
  return fallback;
}

/**
 * Turns a product name into a URL slug and makes it unique.
 * "Oxford White Tailored Shirt" -> "oxford-white-tailored-shirt"
 * If taken: "oxford-white-tailored-shirt-1", "-2", ...
 *
 * @param {string} name
 * @param {string[]=} existingSlugs  Optional; read from the sheet if omitted.
 * @return {string}
 */
function generateSlug(name, existingSlugs) {
  if (!existingSlugs) {
    existingSlugs = getColumnValues_(getProductsSheet_(), 'slug');
  }
  var taken = {};
  existingSlugs.forEach(function (s) { if (s) taken[String(s).toLowerCase()] = true; });

  var base = String(name || 'shirt')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  if (!base) base = 'shirt';

  var slug = base;
  var n = 1;
  while (taken[slug]) {
    slug = base + '-' + n;
    n++;
  }
  return slug;
}

/**
 * Appends one product row to the Products sheet.
 *
 * @param {Object} productData  { name, description, careInstructions, seoTitle,
 *                                seoDescription, style, colour, fit,
 *                                driveFolderId, images[], price?, compareAtPrice? }
 * @return {Object} The row that was written, as an object.
 */
function addProductToSheet(productData) {
  var sheet = getProductsSheet_();
  var now = new Date().toISOString();
  var slug = generateSlug(productData.name, getColumnValues_(sheet, 'slug'));

  var row = {
    id: Utilities.getUuid(),
    slug: slug,
    name: productData.name || '',
    description: productData.description || '',
    price: productData.price !== undefined ? productData.price : '',
    compareAtPrice: productData.compareAtPrice !== undefined ? productData.compareAtPrice : '',
    sizes: DEFAULT_SIZES,
    style: productData.style || '',
    colour: productData.colour || '',
    fit: productData.fit || '',
    driveFolderId: productData.driveFolderId || '',
    images: JSON.stringify(productData.images || []),
    careInstructions: productData.careInstructions || '',
    seoTitle: productData.seoTitle || '',
    seoDescription: productData.seoDescription || '',
    status: DEFAULT_STATUS,
    stock: DEFAULT_STOCK,
    createdAt: now,
    updatedAt: now
  };

  var values = PRODUCT_HEADERS.map(function (h) { return row[h]; });
  var newRow = sheet.getLastRow() + 1;
  var range = sheet.getRange(newRow, 1, 1, PRODUCT_HEADERS.length);

  // Keep text columns as plain text so Sheets doesn't auto-convert
  // timestamps into dates or "S,M,L" into something else.
  var textCols = ['id', 'slug', 'sizes', 'driveFolderId', 'images', 'status', 'stock', 'createdAt', 'updatedAt'];
  textCols.forEach(function (h) {
    sheet.getRange(newRow, PRODUCT_HEADERS.indexOf(h) + 1).setNumberFormat('@');
  });

  range.setValues([values]);
  SpreadsheetApp.flush();

  Logger.log('  Added row ' + newRow + ': ' + row.name + ' (slug: ' + slug + ', status: draft)');
  return row;
}

// ---------------------------------------------------------------------------
// Setup functions — run once by hand
// ---------------------------------------------------------------------------

/**
 * Creates the 5-minute trigger for checkNewProductFolders.
 * Safe to run more than once: removes old copies first.
 */
function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'checkNewProductFolders') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  if (removed) Logger.log('Removed ' + removed + ' old trigger(s).');

  ScriptApp.newTrigger('checkNewProductFolders')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('SUCCESS: checkNewProductFolders will now run automatically every 5 minutes.');
}

/**
 * Creates the Products tab (with headers) and the Orders tab if missing.
 * Safe to run more than once.
 */
function setupSpreadsheet() {
  var ss = getSpreadsheet_();

  // Products
  var products = ss.getSheetByName(PRODUCTS_SHEET_NAME);
  if (!products) {
    // Re-use the default empty "Sheet1" if it's the only, empty tab.
    var sheets = ss.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0 && sheets[0].getName() !== ORDERS_SHEET_NAME) {
      products = sheets[0].setName(PRODUCTS_SHEET_NAME);
    } else {
      products = ss.insertSheet(PRODUCTS_SHEET_NAME);
    }
    Logger.log('Created "' + PRODUCTS_SHEET_NAME + '" tab.');
  }
  writeHeadersIfMissing_(products, PRODUCT_HEADERS);

  // Orders
  var orders = ss.getSheetByName(ORDERS_SHEET_NAME);
  if (!orders) {
    orders = ss.insertSheet(ORDERS_SHEET_NAME);
    Logger.log('Created "' + ORDERS_SHEET_NAME + '" tab.');
  }
  writeHeadersIfMissing_(orders, ORDER_HEADERS);

  Logger.log('SUCCESS: Spreadsheet "' + ss.getName() + '" is ready.');
}

/**
 * Logs (and returns) the current configuration. The API key is masked in the log.
 */
function getConfig() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    PRODUCTS_DRIVE_FOLDER_ID: props.getProperty('PRODUCTS_DRIVE_FOLDER_ID'),
    GEMINI_API_KEY: props.getProperty('GEMINI_API_KEY'),
    SPREADSHEET_ID: props.getProperty('SPREADSHEET_ID'),
    GEMINI_MODEL: props.getProperty('GEMINI_MODEL'),
    MAKE_IMAGES_PUBLIC: props.getProperty('MAKE_IMAGES_PUBLIC')
  };

  var key = config.GEMINI_API_KEY;
  var masked = key ? key.substring(0, 4) + '...' + key.substring(key.length - 4) : '(NOT SET)';

  Logger.log('--- Vellee Luxe configuration ---');
  Logger.log('PRODUCTS_DRIVE_FOLDER_ID: ' + (config.PRODUCTS_DRIVE_FOLDER_ID || '(NOT SET)'));
  Logger.log('GEMINI_API_KEY:           ' + masked);
  Logger.log('SPREADSHEET_ID:           ' + (config.SPREADSHEET_ID || '(not set — using the attached sheet)'));
  Logger.log('GEMINI_MODEL:             ' + (config.GEMINI_MODEL || '(default: ' + GEMINI_MODELS[0] + ')'));
  Logger.log('MAKE_IMAGES_PUBLIC:       ' + (config.MAKE_IMAGES_PUBLIC || '(default: true)'));
  Logger.log('Folders already processed: ' + getProcessedFolderIds_().length);

  // Quick health checks
  try {
    if (config.PRODUCTS_DRIVE_FOLDER_ID) {
      Logger.log('Drive folder OK: "' + DriveApp.getFolderById(config.PRODUCTS_DRIVE_FOLDER_ID.trim()).getName() + '"');
    }
  } catch (e) {
    Logger.log('Drive folder PROBLEM: ' + e.message);
  }
  try {
    Logger.log('Spreadsheet OK: "' + getSpreadsheet_().getName() + '"');
  } catch (e) {
    Logger.log('Spreadsheet PROBLEM: ' + e.message);
  }

  return config;
}

// ---------------------------------------------------------------------------
// Optional utilities for testing / maintenance
// ---------------------------------------------------------------------------

/** Runs the folder-name parser on a few examples and logs the results. */
function testParseFolderName() {
  ['oxford-white-tailored', 'linen-sky-blue-relaxed', 'Poplin Navy Slim', 'denim-blue-slim', 'oxford-tailored']
    .forEach(function (n) {
      Logger.log(n + '  ->  ' + JSON.stringify(parseFolderName(n)));
    });
}

/** Calls Gemini once with sample values to check the API key works. */
function testGemini() {
  var result = generateProductContent('oxford', 'white', 'tailored', 3);
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Forgets that a folder was processed so it will be picked up again on the
 * next run. Delete its row in the sheet first, or it will be skipped anyway.
 * Usage: edit the ID below, then run.
 */
function forgetProcessedFolder(folderId) {
  if (!folderId) {
    Logger.log('Pass a folder ID, e.g. forgetProcessedFolder("1AbC...").');
    return;
  }
  var ids = getProcessedFolderIds_().filter(function (id) { return id !== folderId; });
  PropertiesService.getScriptProperties().setProperty('PROCESSED_FOLDER_IDS', JSON.stringify(ids));
  Logger.log('Folder ' + folderId + ' will be re-processed on the next run (if it has no row in the sheet).');
}

// ---------------------------------------------------------------------------
// Private helpers (names end with _ so they don't appear in the Run menu)
// ---------------------------------------------------------------------------

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id && id.trim()) {
    return SpreadsheetApp.openById(id.trim());
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('No spreadsheet found. Either open this script from the sheet (Extensions > Apps Script) or set the SPREADSHEET_ID Script Property.');
  }
  return active;
}

function getProductsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(PRODUCTS_SHEET_NAME);
  if (!sheet) {
    setupSpreadsheet();
    sheet = ss.getSheetByName(PRODUCTS_SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) writeHeadersIfMissing_(sheet, PRODUCT_HEADERS);
  return sheet;
}

function writeHeadersIfMissing_(sheet, headers) {
  var firstCell = sheet.getLastRow() > 0 ? String(sheet.getRange(1, 1).getValue()).trim() : '';
  if (firstCell === headers[0]) return;

  if (sheet.getLastRow() > 0) {
    // Something is in row 1 that isn't our header — insert a header row above it.
    sheet.insertRowBefore(1);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  Logger.log('Wrote headers on "' + sheet.getName() + '".');
}

/** Returns all non-empty values (as strings) from the column with this header. */
function getColumnValues_(sheet, headerName) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  var col = headers.indexOf(headerName);
  if (col === -1) col = PRODUCT_HEADERS.indexOf(headerName); // fall back to expected position
  if (col === -1) return [];
  return sheet.getRange(2, col + 1, lastRow - 1, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v !== ''; });
}

function getProcessedFolderIds_() {
  var raw = PropertiesService.getScriptProperties().getProperty('PROCESSED_FOLDER_IDS');
  if (!raw) return [];
  try {
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    Logger.log('WARNING: PROCESSED_FOLDER_IDS was corrupted; starting fresh (the sheet is still checked, so no duplicates).');
    return [];
  }
}

function markFolderProcessed_(folderId) {
  var ids = getProcessedFolderIds_();
  if (ids.indexOf(folderId) === -1) ids.push(folderId);
  PropertiesService.getScriptProperties().setProperty('PROCESSED_FOLDER_IDS', JSON.stringify(ids));
}

function isImageFile_(file) {
  var mime = String(file.getMimeType() || '').toLowerCase();
  if (IMAGE_MIME_TYPES.indexOf(mime) !== -1) return true;
  var name = String(file.getName() || '').toLowerCase();
  var dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.indexOf(name.substring(dot + 1)) !== -1;
}

function shouldMakeImagesPublic_() {
  var v = PropertiesService.getScriptProperties().getProperty('MAKE_IMAGES_PUBLIC');
  if (v === null || v === undefined || String(v).trim() === '') return true;
  return String(v).trim().toLowerCase() !== 'false';
}

function getGeminiModels_() {
  var custom = PropertiesService.getScriptProperties().getProperty('GEMINI_MODEL');
  var list = GEMINI_MODELS.slice();
  if (custom && custom.trim()) {
    list = list.filter(function (m) { return m !== custom.trim(); });
    list.unshift(custom.trim());
  }
  return list;
}

function extractGeminiText_(json) {
  try {
    var parts = json.candidates[0].content.parts;
    return parts.map(function (p) { return p.text || ''; }).join('').trim();
  } catch (e) {
    return '';
  }
}

/** Parses JSON even if the model wrapped it in ```json fences or extra text. */
function parseJsonLoose_(text) {
  var t = String(text).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    var start = t.indexOf('{');
    var end = t.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(t.substring(start, end + 1));
    }
    throw new Error('Could not parse JSON from Gemini response: ' + t.substring(0, 200));
  }
}

/** Fills any missing field from the fallback and enforces length limits. */
function normaliseContent_(content, fallback) {
  content = content || {};
  function pick(field) {
    var v = content[field];
    if (Array.isArray(v)) v = v.join(', ');
    v = v === undefined || v === null ? '' : String(v).trim();
    return v || fallback[field];
  }
  return {
    name: pick('name'),
    description: pick('description'),
    careInstructions: pick('careInstructions'),
    seoTitle: truncate_(pick('seoTitle'), 60),
    seoDescription: truncate_(pick('seoDescription'), 155)
  };
}

function buildPlaceholderContent_(style, colour, fit) {
  var colourWords = colour.split('-').map(capitalize_).join(' ');
  var name = capitalize_(style) + ' ' + colourWords + ' ' + capitalize_(fit) + ' Shirt';
  return {
    name: name,
    description: '[PLACEHOLDER — edit before publishing] A ' + colourWords.toLowerCase() + ' ' +
      style + ' shirt in a ' + fit + ' fit from Vellee Luxe.',
    careInstructions: 'Machine wash cold, Do not bleach, Iron on medium heat',
    seoTitle: truncate_(name + ' | Vellee Luxe', 60),
    seoDescription: truncate_('Shop the ' + name + ' from Vellee Luxe — premium men\'s shirts made for modern India.', 155)
  };
}

function capitalize_(s) {
  s = String(s || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate_(s, max) {
  s = String(s || '');
  if (s.length <= max) return s;
  var cut = s.substring(0, max - 1);
  var lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) cut = cut.substring(0, lastSpace);
  return cut.replace(/[\s,.;:|-]+$/, '') + '…';
}
