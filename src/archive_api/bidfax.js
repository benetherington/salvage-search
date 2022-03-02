/*------*\
  SEARCH  
\*------*/
const BIDFAX_S = {
    __proto__: Archive,
    NAME: "bidfax",
    search: (vinOrVehicle, notify=sendNotification)=>{
        // TODO: this appears to be broken again. 1FMCU02Z58KB50453 exemplar.
        let vin = vinOrVehicle.vin || vinOrVehicle;
        return new Promise(async (resolve, reject)=>{
            try {
                // FETCH GC TOKEN
                let homeUrl = "https://en.bidfax.info";
                let tokenTab = await browser.tabs.create({url:homeUrl, active:false})
                await browser.tabs.executeScript(tokenTab.id,{code:
                    `(()=>{
                        document.querySelector("#submit").click()
                    })()`
                })
                let token = await browser.tabs.executeScript(tokenTab.id, {code:
                    `(()=>{return (new URL(document.querySelector("link[rel=alternate]").href)).searchParams.get('token2');})()`
                })[0]
                browser.tabs.remove(tokenTab.id)
                
                // SEARCH
                let searchUrl = new URL("https://en.bidfax.info/")
                searchUrl.searchParams.append("do", "search")
                searchUrl.searchParams.append("subaction", "search")
                searchUrl.searchParams.append("story", vin)
                searchUrl.searchParams.append("token2", token)
                searchUrl.searchParams.append("action2", "search_action")
                let response = await fetch(searchUrl);
                if (!response.ok) { throw "something went wrong on their end..." }
                if (response.status === 301) {
                    // Moved Permanently is returned when the GC token is invalid or
                    // missing.
                    console.log("BidFax wants a CAPTCHA check")
                    browser.tabs.create({url:homeUrl})
                    throw "CAPTCHA failed. Please click on a listing before trying again."
                }
                // CHECK FOR RESULTS
                let parser = new DOMParser()
                let doc = parser.parseFromString(await response.text(), "text/html");
                let searchResults = doc.querySelectorAll(".thumbnail.offer");
                if (!searchResults.length)  {throw "search returned no results."}
                if (searchResults.length>3) {throw "search returned no results."}
                // PARSE RESULTS
                searchResult = searchResults[0]
                // FIND PAGE LINK
                let lotLinkElement = searchResult.querySelector(".caption a");
                if (!lotLinkElement) {throw "the website has changed. Please send Ben "+
                                            "your search terms so he can fix it."}
                let vehicle = {listingUrl: lotLinkElement.href}
                // NOTIFY
                try {
                    let yardNameElement = searchResult.querySelector(".short-storyup span");
                    let yardName = yardNameElement.innerText.trim();
                    if (yardName==="iaai"  ) {vehicle.salvage=IAAI_S}
                    if (yardName==="copart") {vehicle.salvage=COPART_S}
                    let lotNumberElement = searchResult.querySelector(".short-story span");
                    let lotNumber = stockNumberElement.innerText;
                    vehicle.lotNumber = lotNumber
                    notify( `BidFax: found a match at ${yardName}! `+
                            `Lot ${lotNumber}.`, {displayAs: "success"} )
                } catch {
                    notify( "BidFax: found a match!", {displayAs: "success"})
                }
                // SUCCESS!
                resolve(()=>{vehicle})
            } catch (error) {
                console.log(`BidFax rejecting: ${error}`)
                notify(`BidFax: ${error}`, {displayAs: "error"})
                reject()
            }
        })
    }
};


/*--------*\
  DOWNLOAD
\*--------*/
const BIDFAX_D = {
    URL_PATTERN: "*://en.bidfax.info/*",
    lotNumbersFromTab: async (bidfaxTab)=>{
        let code = `(${BIDFAX_D.getLotNumber.toString()})()`
        let framesResults = await browser.tabs.executeScript(bidfaxTab.id,{code});
        let frameResults = framesResults[0]
        let vehicle = {lotNumber: frameResults.lotNumber};
        if (frameResults.copart) {vehicle.salvage = "copart"};
        if (frameResults.iaai  ) {vehicle.salvage = "iaai"  };
        return vehicle;
    },
    getLotNumber: ()=>{ // TODO: update to match poctra, ie return an object with iaai/copart keys
        // GET LOT INFO
        let infoElement = document.querySelector("#aside")
        if (!infoElement) {return null;}
        // LOOK FOR CORRECT INFO
        const INFO_REGEX = /Auction:\s+((?<iaai>iaai)|(?<copart>copart))(?:.*\n\n)*Lot number:\s+(?<lotNumber>\d{8})/gim;
        let infoMatch = INFO_REGEX.exec(infoElement.innerText);
        if (!infoMatch) {return null;}
        return infoMatch.groups;
    }
}
