/*------*\
  SEARCH  
\*------*/
const captchaMessage = "CAPTCHA failed. \
Please click on a listing before trying again.";

const BIDFAX_S = {
    __proto__: Archive,
    NAME: "bidfax",
    search: (vin, notify=sendNotification)=>{
        return new Promise( async (resolve, reject)=>{
            try {
                const searchResults = await BIDFAX_S.searcher(vin, notify);
                notify(
                    `BidFax: found a match!`,
                    {displayAs: "success"}
                )
                resolve(searchResults)
            } catch (error) {
                console.log(`BidFax rejecting: ${error}`)
                const sent = notify(`BidFax: ${error}.`, {displayAs: "status"})
                if (sent && error===captchaMessage) {
                    // Captcha failed. Only notify if another searcher has not
                    // yet been successful
                    browser.tabs.create({url:"https://en.bidfax.info"})
                }
                reject()
            }
        })
    },
    searcher: async (vin, notify)=>{
        // TODO: this appears to be broken again. 1FMCU02Z58KB50453 exemplar.
        
        // Fetch Captcha token
        const tokenPromise = BIDFAX_S.fetchCaptchaToken();
        tokenPromise.catch(()=>{throw captchaMessage;})
        const token = await tokenPromise;
        
        // Configure VIN search
        const searchUrl = new URL("https://en.bidfax.info/")
        searchUrl.searchParams.append("do", "search")
        searchUrl.searchParams.append("subaction", "search")
        searchUrl.searchParams.append("story", vin)
        searchUrl.searchParams.append("token2", token)
        searchUrl.searchParams.append("action2", "search_action")
        
        // Fetch search results
        const response = await fetch(searchUrl);
        
        // Check response
        if (!response.ok) { throw "something went wrong on their end..." }
        if (response.status === 301) {
            // Moved Permanently is returned when the token is invalid or
            // missing.
            console.log("BidFax wants a CAPTCHA check")
            throw captchaMessage;
        }
        
        
        // Parse response content
        const parser = new DOMParser();
        const doc = parser.parseFromString(await response.text(), "text/html");
        
        // Check result count
        const searchResults = doc.querySelectorAll(".thumbnail.offer");
        if (!searchResults.length)  {throw "search returned no results."}
        if (searchResults.length>3) {throw "search returned no results."}
        
        // Get listing URLs
        const listingUrls = [];
        searchResults.forEach(
            el=>listingUrls.push(el.querySelector(".caption a").href)
        );
        
        // Check listing URLs
        if (!listingUrls.some(el=>el)) {
            console.log("BidFax found results, but not listing URLs.");
            throw "search returned a result, but it's invalid.";
        }
        
        // Split results
        const listingUrl = listingUrls.pop();
        const extras = listingUrls;
        
        // Send back results
        return {salvage: "bidfax", listingUrl, extras};
    },
    fetchCaptchaToken: async ()=>{
        /*
        A bit of a nightmare solution for Bidfax' recaptcha implementation.
        Loads a new Bidfax page and does a dummy search, waits for the recaptcha
        token to be served, and resolves with the token.
        
        These tokens are good for two minutes, in the future, maybe we should
        cache them?
        */
        // Configure token capture tab
        const url = "https://en.bidfax.info";
        
        // Open token capture tab
        let tokenTab = await browser.tabs.create({url, active:false});
        
        // Inject content script to interact with the page
        await browser.tabs.executeScript(tokenTab.id, {code:
            `(()=>{
                document.getElementById("search").value = "5YJ3E1EA8LF";
                document.getElementById("submit").click()
            })()`
        })
        
        // Asynchronously wait for tab to update with token
        return new Promise((resolve, reject)=>{
            // Set maximum iterations before timeout
            const checkInterval = 20; // 20ms
            let iterationsLeft = 150; // 20ms*150 = 3s
            
            // Start checking the tab
            const intervalId = setInterval(async()=>{
                // Update tab
                tokenTab = await browser.tabs.get(tokenTab.id);
                
                // No token yet?
                if (!/token2/.exec(tokenTab.url)) {
                    // Keep waiting...
                    if (iterationsLeft-->1) return;
                    
                    // ... or time out
                    clearInterval(intervalId)
                    reject(`Timed out: ${tokenTab.url}`)
                };
                
                // Halt interval
                clearInterval(intervalId)
                
                // Get token from URL
                const tokenUrl = new URL(tokenTab.url);
                const token = tokenUrl.searchParams.get('token2');
                
                // Finish up
                browser.tabs.remove(tokenTab.id)
                resolve(token);
            }, checkInterval)
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
