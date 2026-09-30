# Vellee Luxe — Product Automation Setup Guide

This guide sets up the robot that turns a Google Drive folder of photos into a product row in your Google Sheet. You only do this once. It takes about 20 minutes.

**What you need:**
- A Google account (your normal Gmail works)
- A computer with Google Chrome (other browsers work too)
- The file `apps-script.gs` (it is in the same `scripts` folder as this guide)

**How it works when it is finished:**
1. You make a folder in Google Drive called something like `oxford-white-tailored`.
2. You put the shirt photos inside it.
3. Within about 5 minutes, a new row appears in your Google Sheet with the product name, description, care instructions and SEO text already written. Its status is `draft`, so nothing goes live until you say so.

---

## Step 1 — Create the Google Sheet

1. Open **https://sheets.google.com** and sign in.
2. Click the big **Blank spreadsheet** tile (the one with a coloured plus sign) near the top left.
3. A new sheet opens. At the top left it says **Untitled spreadsheet**. Click on those words.
4. Type **Vellee Luxe — Store Data** and press **Enter**.
5. Leave this tab open. You will come back to it.

> You do not need to type any column headings. The script adds them for you in Step 5.

---

## Step 2 — Create the Apps Script project

The script must be attached to the sheet you just made.

1. In your Google Sheet, look at the menu bar at the top (File, Edit, View, Insert, Format, Data, Tools, **Extensions**, Help).
2. Click **Extensions**.
3. Click **Apps Script**.
4. A new browser tab opens with the Apps Script editor. It shows a file called **Code.gs** with a few lines of code like `function myFunction() { }`.
5. At the top left it says **Untitled project**. Click on those words, type **Vellee Luxe Automation**, and click **Rename**.

---

## Step 3 — Paste the code

1. On your computer, open the file `apps-script.gs` (in the `scripts` folder of the Vellee Luxe project) with **Notepad** (right-click the file > **Open with** > **Notepad**).
2. In Notepad, press **Ctrl + A** (selects everything), then **Ctrl + C** (copies it).
3. Go back to the Apps Script browser tab.
4. Click anywhere inside the code area of **Code.gs**.
5. Press **Ctrl + A** (selects the old sample code), then press **Delete**. The code area should now be empty.
6. Press **Ctrl + V** to paste the Vellee Luxe code.
7. Press **Ctrl + S** to save (or click the floppy-disk **Save project** icon above the code).
8. If there is a red error message at the bottom, the copy did not work fully. Repeat this step from the start.

---

## Step 4 — Set the Script Properties

Script Properties are the script's private settings: where your photos live, and the key it uses to talk to Gemini (Google's AI).

### 4a. Get your Drive folder ID

1. Open **https://drive.google.com** in a new tab.
2. Click **+ New** (top left) > **New folder**.
3. Name it **Vellee Luxe Products** and click **Create**.
4. Double-click the new folder to open it.
5. Look at the address bar at the top of the browser. It looks like this:
   `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz123456`
6. The long jumble after `/folders/` is the **folder ID** (in this example `1AbCdEfGhIjKlMnOpQrStUvWxYz123456`). Copy it and paste it into a Notepad file for now.

   > If there is a `?` in the address, copy only the part **before** the `?`.

### 4b. Get your Gemini API key (free)

1. Open **https://aistudio.google.com/apikey** and sign in with the same Google account.
2. If asked, accept the terms.
3. Click **Create API key**. If it asks you to choose a project, pick any one shown or click **Create API key in new project**.
4. A long key starting with `AIza...` appears. Click **Copy**.
5. Paste it into your Notepad file too.

> Treat this key like a password. Do not post it or send it to anyone. The free tier is plenty for adding products.

### 4c. Enter the properties

1. Go back to the Apps Script tab.
2. On the far left there is a thin column of icons. Click the **gear icon** (Project Settings). If you hover over it, it says "Project Settings".
3. Scroll to the bottom of the page to the section called **Script Properties**.
4. Click **Add script property**.
5. In the **Property** box type exactly: `PRODUCTS_DRIVE_FOLDER_ID`
   In the **Value** box paste your folder ID from 4a.
6. Click **Add script property** again.
   **Property:** `GEMINI_API_KEY`
   **Value:** paste your API key from 4b.
7. Click **Save script properties**.

What each property means:

| Property | Required? | What it is |
|---|---|---|
| `PRODUCTS_DRIVE_FOLDER_ID` | Yes | The Drive folder where you create one sub-folder per product. |
| `GEMINI_API_KEY` | Yes | Lets the script ask Gemini to write product text. |
| `SPREADSHEET_ID` | No | Only needed if the script is **not** attached to the sheet. Since you opened it via Extensions > Apps Script, leave this out. |
| `GEMINI_MODEL` | No | Leave out. Only set this if the product text ever stops being generated and a newer Gemini model name is needed (for example `gemini-2.5-flash`). |
| `MAKE_IMAGES_PUBLIC` | No | Leave out. By default the script sets each product photo to "Anyone with the link can view" so the website can show it. Set to `false` only if you want to share photos yourself. |
| `PROCESSED_FOLDER_IDS` | Do not add | The script creates this itself to remember which folders it has already done. Do not edit it. |

Property names must be typed exactly as shown: capital letters and underscores, no spaces.

---

## Step 5 — Run `setupSpreadsheet()`

This creates the **Products** and **Orders** tabs with the right column headings.

1. On the far left icon column, click the **< >** icon (Editor) to go back to the code.
2. Above the code there is a toolbar with **Run**, **Debug**, and a drop-down box showing a function name.
3. Click that drop-down and choose **setupSpreadsheet**.
4. Click **Run**.
5. **The first time only**, Google asks for permission:
   1. A box says **Authorization required**. Click **Review permissions**.
   2. Choose your Google account.
   3. You may see **Google hasn't verified this app**. This is normal: it is your own script. Click **Advanced** (small text, bottom left), then click **Go to Vellee Luxe Automation (unsafe)**.
   4. A list of permissions appears (see and edit your spreadsheets, your Drive files, connect to an external service). Click **Allow**.
6. At the bottom an **Execution log** panel opens. Wait until you see:
   `SUCCESS: Spreadsheet "Vellee Luxe — Store Data" is ready.`
7. Switch to your Google Sheet tab. You should now see two tabs at the bottom: **Products** and **Orders**. The Products tab has bold headings in row 1: `id, slug, name, description, price, ...` through `updatedAt`.

**Optional check:** choose **getConfig** in the drop-down and click **Run**. The log should show your folder ID, a masked API key (like `AIza...x9Q2`), and lines saying `Drive folder OK` and `Spreadsheet OK`. If it says `PROBLEM`, go back to Step 4 and recheck the values.

**Optional check:** choose **testGemini** and click **Run**. After a few seconds the log shows a sample product (Oxford White Tailored Shirt) with a name and description. If the description starts with `[PLACEHOLDER`, the API key is wrong or missing.

---

## Step 6 — Run `setupTrigger()`

This turns on the automatic check every 5 minutes.

1. In the function drop-down, choose **setupTrigger**.
2. Click **Run**.
3. The log should show:
   `SUCCESS: checkNewProductFolders will now run automatically every 5 minutes.`
4. To confirm, click the **alarm clock icon** (Triggers) in the left icon column. You should see one row: function **checkNewProductFolders**, event **Time-based**, every 5 minutes.

You only need to do this once. It keeps running even when your computer is off. Running it again is safe; it replaces the old trigger rather than adding a second one.

---

## Step 7 — Create your first product folder

### The naming rule

Folder names must be: **style-colour-fit**, all joined with hyphens `-`.

- **style** (first word) must be one of:
  `oxford`, `linen`, `poplin`, `chambray`, `twill`, `flannel`, `dobby`
- **fit** (last word) must be one of:
  `tailored`, `relaxed`, `oversized`, `slim`
- **colour** is everything in between. It can be more than one word, joined with hyphens.

| Good folder names | Why |
|---|---|
| `oxford-white-tailored` | style = oxford, colour = white, fit = tailored |
| `linen-sky-blue-relaxed` | colour = sky-blue (two words is fine) |
| `poplin-navy-slim` | |
| `flannel-olive-green-oversized` | |

| Bad folder names | Problem |
|---|---|
| `white-oxford-tailored` | style must come first |
| `oxford-white` | fit is missing |
| `denim-blue-slim` | "denim" is not one of the allowed styles |
| `oxford-white-regular` | "regular" is not one of the allowed fits |

Capital letters and spaces are forgiven (`Oxford White Tailored` works), but it is best to stick to lowercase and hyphens.

### Make the folder

1. Open **https://drive.google.com** and open your **Vellee Luxe Products** folder.
2. Click **+ New** > **New folder**.
3. Type `oxford-white-tailored` and click **Create**.
4. Double-click the new folder to open it.
5. Drag your product photos from your computer into the browser window (or click **+ New** > **File upload**).
   - Use **.jpg, .jpeg, .png or .webp** files.
   - Up to **6** photos are used. Extra ones are ignored.
   - Photos are used in **file-name order**, so name your main photo `01.jpg`, then `02.jpg`, `03.jpg`, and so on.

> **Tip:** Upload the photos straight after creating the folder. If the script checks while the folder is still empty, it just waits and tries again 5 minutes later. It only picks up a folder once it has at least one photo.

---

## Step 8 — Check it worked

1. Wait **5 to 10 minutes**.
2. Open your Google Sheet and click the **Products** tab.
3. You should see a new row with:
   - **name**, e.g. *Oxford White Tailored Shirt*
   - **slug**, e.g. `oxford-white-tailored-shirt` (this becomes the web address of the product)
   - **description**, **careInstructions**, **seoTitle**, **seoDescription**: written by Gemini
   - **style / colour / fit**: `oxford` / `white` / `tailored`
   - **images**: a list of links in square brackets `["https://drive.google.com/uc?export=view&id=..."]`
   - **sizes**: `S,M,L,XL,XXL`
   - **status**: `draft`
   - **stock**: `unlimited`
   - **price** and **compareAtPrice**: **empty. Fill these in yourself** (numbers only, e.g. `1999`).
4. Read the description. Edit anything you want to change directly in the cell.
5. When the product is ready to go live, change **status** from `draft` to `active` (or whatever status your website uses to show products).

### Don't want to wait? Run it by hand

1. In the Apps Script tab, choose **checkNewProductFolders** in the drop-down.
2. Click **Run**.
3. The log shows what happened, for example:
   `NEW product folder: "oxford-white-tailored" (4 image(s)).`
   `Added row 2: Oxford White Tailored Shirt (slug: oxford-white-tailored-shirt, status: draft)`

### Seeing what the automatic runs did

1. In Apps Script, click the **list icon** (Executions) in the left icon column.
2. Each row is one run. Click a row to see its log messages.

---

## Troubleshooting

| What you see | What it means / what to do |
|---|---|
| No new row after 10 minutes | Open **Executions** (Step 8) and read the latest log. |
| Log says `SKIPPED "...": name does not match style-colour-fit` | Rename the folder to follow the rule in Step 7. It will be picked up on the next run automatically. |
| Log says `WAITING on "...": no photos yet` | Upload at least one .jpg/.png/.webp photo into that folder. |
| Description starts with `[PLACEHOLDER — edit before publishing]` | Gemini could not be reached (wrong API key, or a daily limit hit). The row was still created: write the text yourself, or delete the row and see "Redo a product" below. Run **testGemini** to check the key. |
| `PRODUCTS_DRIVE_FOLDER_ID is not set` | Go back to Step 4c. Check the spelling of the property name. |
| `Could not open the Drive folder` | The folder ID is wrong. Redo Step 4a, copying only the part after `/folders/`. |
| Photos don't show on the website | Right-click each photo in Drive > **Share** > under General access choose **Anyone with the link** > **Viewer**. |
| A product appeared twice | Should not happen. Delete the extra row. |

### Redo a product

The script never processes the same folder twice, even if you delete its row. To make it try again:

1. Delete the product's row in the **Products** tab (right-click the row number > **Delete row**).
2. In Drive, create a **new** folder with the same name and move the photos into it. The new folder has a new ID, so the script will treat it as new. (You can delete the old empty folder.)

### Turning the automation off

1. In Apps Script, click the **alarm clock icon** (Triggers).
2. Hover over the `checkNewProductFolders` row, click the **three dots** on the right > **Delete trigger**.
3. To turn it back on later, run **setupTrigger** again (Step 6).
