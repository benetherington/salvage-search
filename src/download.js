const salvageNameToObject = {
    "iaai": IAAI_D,
    "copart": COPART_D,
    "poctra": POCTRA_D,
    "bidfax": BIDFAX_D
}


/*----------*\
  TAB FINDER
\*----------*/
const findBestTab = async()=>{
    // Find all salvage tabs
    let salvageTabs = await browser.tabs.query({
        url: [
            COPART_D.URL_PATTERN, IAAI_D.URL_PATTERN,
            POCTRA_D.URL_PATTERN, BIDFAX_D.URL_PATTERN
        ]
    });
    
    // Decide which tab is best
    // if a tab is active, discard all others
    let activeTabs = salvageTabs.filter(t=>t.active);
    if (activeTabs.length) salvageTabs = activeTabs;
    
    // sort decending by ID
    const recentTabs = salvageTabs.sort(
        (a, b) => a.id-b.id
    );
    
    // select most recently opened
    return recentTabs.pop();
};
const getSalvageFromTab = (tab)=>{
    // Identify primary sites
    if (/copart\.com/i .test(tab.url)) return COPART_D;
    if (/iaai\.com/i   .test(tab.url)) return IAAI_D;
    
    // Identify archive sites
    if (/poctra\.com/i .test(tab.url)) return POCTRA_D;
    if (/bidfax\.info/i.test(tab.url)) return BIDFAX_D;
}
const getTabInfo = async()=>{
    const bestTab = await findBestTab();
    if (!bestTab) return;
    const salvage = getSalvageFromTab(bestTab);
    const salvageName = salvage.NAME;
    const lotNumber = await salvage.lotNumberFromTab(bestTab);
    return {salvageName, lotNumber};
}


/*---------------*\
  DOWNLOAD IMAGES
\*---------------*/
const getImageUrls = async(lotNumber, salvageName)=>{
    // Find download object
    const salvage = salvageNameToObject[salvageName];
    
    // Fetch image info
    const imageInfo = await salvage.imageInfoFromLotNumber(lotNumber);
    
    // Fetch image urls
    return await salvage.imageUrlsFromInfo(imageInfo)
}


/*---------*\
  MESSAGING
\*---------*/
// Init messaging ports
let dPort;
browser.runtime.onConnect.addListener( async connectingPort=>{
    if (connectingPort.name!=="download") return;
    dPort = connectingPort;
    dPort.onMessage.addListener(download)
})

// Handle messages
const download = async (message)=>{
    // Find tabs on request
    if (message.findTabs) return dPort.postMessage(await getTabInfo());
    
    // Interpret message data
    const {query, salvageName} = message;
    const lotNumber = validateLot(query);
    
    // Check message data
    if (!lotNumber) {
        console.log("download message handler received an invalid lot number")
        console.log(message)
        return;
    }
    
    // Fetch images
    const imageUrls = getImageUrls(lotNumber, salvageName);
    
    // Send images to downloads folder
    console.log(imageUrls)
};




console.log("download-background loaded")
