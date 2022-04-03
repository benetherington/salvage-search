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
                const searchResults = await BIDFAX_S.searcher(vin);
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
    searcher: async (vin)=>{
        // Fetch Captcha token
        const token = await BIDFAX_S.fetchCaptchaToken()
                                    .catch(()=>{throw captchaMessage});
        
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
        const searchResults = doc.querySelectorAll(".caption");
        if (!searchResults.length)  {throw "search returned no results."}
        if (searchResults.length>5) {throw "search returned no results."}
        
        // Get listing URLs
        const listingUrls = Array.from(searchResults).map(BIDFAX_S.getUrlFromCaption);
        const lotNumbers = listingUrls.map(url=>/\d{8}/.exec(url)[0]);
        
        // Check listing URLs
        if (!listingUrls.some(el=>el)) {
            console.log("BidFax found results, but not listing URLs.");
            throw "search returned a result, but it's invalid.";
        }
        
        // Split results
        const listingUrl = listingUrls.pop();
        const lotNumber = lotNumbers.pop();
        const extras = {listingUrls, lotNumbers};
        
        // Send back results
        return {salvage: "bidfax", listingUrl, lotNumber, extras};
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
    },
    getUrlFromCaption: (el)=>{
        const anchor = el.querySelector("a")
        if (!anchor) return;
        return anchor.href;
    }
};


/*--------*\
  DOWNLOAD
\*--------*/
const BIDFAX_D = {
    URL_PATTERN: "*://en.bidfax.info/*",
    lotNumberFromTab: async (poctraTab)=>{
        try {
            const code = `(${BIDFAX_API.getLotNumber.toString()})()`
            const framesResults = await browser.tabs.executeScript(poctraTab.id, {code});
            const frameResults = framesResults[0]
            return frameResults
        } catch (error) {throw `Poctra: ${error}`}
    },
    getLotNumber: ()=>{
        // Primary method, look at the grid of information
        let infoGrid = "";
        try {
            infoGrid = document.getElementById("aside").innerText;
        } catch {}
        
        // Find lotNumber from info grid
        let lotNumber = "";
        try {
            // first try, very specific
            lotNumber = /(stock|lot) (no|number)\W+(?<lotNumber>\d*)/i.exec(infoGrid)[3];
        } catch {
            // backup, less specific
            try {lotNumber = /\W(\d{8})/i.exec(infoGrid)[1];} catch {}
        };
        
        // Find salvageName from info grid
        let salvageName = "";
        try {
            // first try, very specific
            salvageName = /auction\W+(\w*)/i.exec(infoGrid)[1];
        } catch {
            // backup, less specific
            try {salvageName = /(iaai|copart)/i.exec(infoGrid)[0];} catch {}
        }
        
        // Backup method, look at the SEO data
        if (!lotNumber) {
            try {
                const seo = document.querySelector("meta[name=description]").content;
                lotNumber = /\W(\d{8})/i.exec(seo)[1];
            } catch {}
        }
        // Find salvageName from headline
        if (!salvageName) {
            try {
                const seo = document.querySelector("meta[name=description]").content;
                salvageName = /(iaai|copart)/i.exec(seo)[0];
            } catch {}
        }
        
        // Clean up results
        lotNumber = lotNumber.trim();
        salvageName = salvageName.trim().toLowerCase();
        
        return {lotNumber, salvageName};
    }
}
