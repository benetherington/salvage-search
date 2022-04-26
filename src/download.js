/*----------*\
  TAB FINDER
\*----------*/
const findBestTab = async () => {
    // Get tab URL patterns from loaded APIs
    const urlPatterns = Object.values(SALVAGE_APIS)
        .map((api) => api.URL_PATTERN)
        .filter((u) => u);

    // Find all salvage tabs
    let salvageTabs = await browser.tabs.query({
        url: urlPatterns,
    });

    // Decide which tab is best
    // if a tab is active, discard all others
    let activeTabs = salvageTabs.filter((t) => t.active);
    if (activeTabs.length) salvageTabs = activeTabs;

    // sort decending by ID
    const recentTabs = salvageTabs.sort((a, b) => a.id - b.id);

    // select most recently opened
    return recentTabs.pop();
};
const getSalvageFromTab = (tab) => {
    const salvage = Object.values(SALVAGE_APIS).find((api) =>
        api.URL_REGEXP.exec(tab.url),
    );
    return salvage;
};
const getTabInfo = async () => {
    const bestTab = await findBestTab();
    if (!bestTab) return;
    const salvage = getSalvageFromTab(bestTab);
    const {lotNumber, salvageName} = await salvage.lotNumberFromTab(bestTab);
    return {salvageName, lotNumber};
};

/*---------------*\
  DOWNLOAD IMAGES
\*---------------*/
const fetchImageUrls = async (lotNumber, salvageName) => {
    // Fetch image info
    const salvage = SALVAGE_APIS[salvageName];
    const imageInfo = await salvage.imageInfoFromLotNumber(lotNumber);

    // Fetch image urls
    const heroImages = await salvage.heroImages(imageInfo);
    const {walkaroundUrls, panoUrls} = await salvage.bonusImages(imageInfo);

    console.log(`Collected images.`);
    return {heroImages, walkaroundUrls, panoUrls};
};
const saveImages = (
    salvageName,
    lotNumber,
    {heroImages, walkaroundUrls, panoUrls},
) => {
    // Check for hero images, save them
    if (heroImages) {
        heroImages.forEach((url, idx) => {
            browser.downloads.download({
                url,
                saveAs: false,
                filename: `${salvageName}-${lotNumber}/${idx}.jpg`,
            });
        });
        console.log(`Saved ${heroImages.length} heroImages.`);
    }

    // Check for walkaround images, save them
    if (walkaroundUrls) openWalkEditor(salvageName, lotNumber, walkaroundUrls);
    else console.log("No walkaround images.");

    // Check for panorama images, save them
    if (panoUrls) openPanoEditor(salvageName, lotNumber, panoUrls);
    else console.log("No panorama images.");
};
const openWalkEditor = async (salvageName, lotNumber, walkaroundUrls) => {
    // Build an event listener in this scope
    const listenUrl = await browser.runtime.getURL("/walkaround/composer.html");
    const updatedListener = async (tabId, changeInfo)=>{
        // Wait for tab to finish loading
        if (changeInfo.status!=="complete") return;
        
        // Make sure this is the right tab (Chrome doesn't include url in
        // changeInfo after loading status)
        const tab = await browser.tabs.get(tabId);
        const tabUrl = tab.url;
        if (tabUrl !== listenUrl) return;
        
        // Send panorama data
        await browser.tabs.sendMessage(tabId, {
            salvageName,
            lotNumber,
            walkaroundUrls,
        });

        // Stop listening
        browser.tabs.onUpdated.removeListener(updatedListener);
    };

    // Start listening for changes on the tab we're about to open
    browser.tabs.onUpdated.addListener(updatedListener)
    
    // Open a panorama viewer tab
    await browser.tabs.create({url: "/walkaround/composer.html"});
};
const openPanoEditor = async (salvageName, lotNumber, panoUrls) => {
    // Build an event listener in this scope
    const listenUrl = await browser.runtime.getURL("/panorama/composer.html");
    const updatedListener = async (tabId, changeInfo)=>{
        // Wait for tab to finish loading
        if (changeInfo.status!=="complete") return;
        
        // Make sure this is the right tab
        const tab = await browser.tabs.get(tabId);
        const tabUrl = tab.url;
        if (tabUrl !== listenUrl) return;
        
        // Send panorama data
        await browser.tabs.sendMessage(tabId, {
            salvageName,
            lotNumber,
            panoUrls,
        });

        // Stop listening
        browser.tabs.onUpdated.removeListener(updatedListener);
    };

    // Start listening for changes on the tab we're about to open
    browser.tabs.onUpdated.addListener(updatedListener)
    
    // Open a panorama viewer tab
    await browser.tabs.create({url: "/panorama/composer.html"});
};

/*---------*\
  MESSAGING
\*---------*/
// Init messaging ports
let dPort;
browser.runtime.onConnect.addListener(async (connectingPort) => {
    if (connectingPort.name !== "download") return;
    dPort = connectingPort;
    dPort.onMessage.addListener(download);
});

// Handle messages
const download = async (message)=>{
    try {
        // Find tabs on request
        if (message.findTabs) return dPort.postMessage(await getTabInfo());

        // Interpret message data
        const {query, salvageName} = message;
        const lotNumber = validateLot(query);

        // Check message data
        if (!lotNumber) {
            console.log(
                "download message handler received an invalid lot number",
            );
            console.log(message);
            return;
        }

        // Fetch images
        const imageUrls = await fetchImageUrls(lotNumber, salvageName);

        // Send images to downloads folder
        await saveImages(salvageName, lotNumber, imageUrls);

        // Wrap up
        const complete = true;
        const feedback = {
            message: "Images saved to downloads folder!",
            displayAs: "success",
        };
        dPort.postMessage({complete, feedback});
    } catch (error) {
        console.error(error);
        const complete = true;
        const feedback = {
            message: error,
            displayAs: "error",
        };
        dPort.postMessage({complete, feedback});
    }
};

console.debug("download loaded");
