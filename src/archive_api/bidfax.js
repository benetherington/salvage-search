const captchaMessage =
    "CAPTCHA failed. Please click on a listing before trying again.";

const BIDFAX_API = {
    NAME: "bidfax",
    URL_PATTERN: "*://en.bidfax.info/*",
    URL_REGEXP: /bidfax\.info/,

    /*------*\
      SEARCH
    \*------*/
    search: (vin, notify = sendNotification) => {
        return new Promise(async (resolve, reject) => {
            try {
                const searchResults = await BIDFAX_API.searcher(vin);
                notify("BidFax: found a match!", "success");
                // TODO: if initial scrape didn't work, load the tab and get
                // data from there.
                resolve(searchResults);
            } catch (error) {
                console.log(`BidFax rejecting: ${error}`);
                const sent = notify(`BidFax: ${error}.`);
                if (sent && error === captchaMessage) {
                    // Captcha failed. Only notify if another searcher has not
                    // yet been successful
                    const newTabHidesPopup = await browserIsChrome();
                    const active = !newTabHidesPopup;
                    browser.tabs.create({
                        url: "https://en.bidfax.info",
                        active,
                    });
                }
                reject();
            }
        });
    },
    searcher: async (vin) => {
        // Fetch Captcha token
        const token = await BIDFAX_API.fetchCaptchaToken().catch(() => {
            throw captchaMessage;
        });

        // Configure VIN search
        const searchUrl = new URL("https://en.bidfax.info/");
        searchUrl.searchParams.append("do", "search");
        searchUrl.searchParams.append("subaction", "search");
        searchUrl.searchParams.append("story", vin);
        searchUrl.searchParams.append("token2", token);
        searchUrl.searchParams.append("action2", "search_action");

        // Fetch search results
        const response = await fetch(searchUrl);

        // Check response
        if (response.status === 301) {
            // Moved Permanently is returned when the token is invalid or
            // missing.
            console.log("BidFax wants a CAPTCHA check");
            throw captchaMessage;
        }
        if (!response.ok) {
            throw "something went wrong on their end...";
        }

        // Parse response content
        const parser = new DOMParser();
        const doc = parser.parseFromString(await response.text(), "text/html");

        // Check result count
        const searchResults = doc.querySelectorAll(".caption");
        if (!searchResults.length) {
            throw "search returned no results.";
        }
        if (searchResults.length > 5) {
            throw "search returned no results.";
        }

        // Get listing details
        const resultsDetails = Array.from(searchResults).map(
            BIDFAX_API.getDetailsFromCaption,
        );

        // Get the first complete result
        let resultDetails = resultsDetails.find(
            (detail) =>
                detail.listingUrl && detail.lotNumber && detail.salvageName,
        );

        // Send back results
        return resultDetails;
    },
    fetchCaptchaToken: async () => {
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
        let tokenTab = await browser.tabs.create({url, active: false});

        // Inject content script to interact with the page
        await browser.tabs.executeScript(tokenTab.id, {
            code: `(()=>{
                document.getElementById("search").value = "5YJ3E1EA8LF";
                document.getElementById("submit").click()
            })()`,
        });

        // Asynchronously wait for tab to update with token
        return new Promise((resolve, reject) => {
            // Set maximum iterations before timeout
            const checkInterval = 20; // 20ms
            let iterationsLeft = 150; // 20ms*150 = 3s

            // Start checking the tab
            const intervalId = setInterval(async () => {
                // Update tab
                tokenTab = await browser.tabs.get(tokenTab.id);

                // No token yet?
                if (!/token2/.exec(tokenTab.url)) {
                    // Keep waiting...
                    if (iterationsLeft-- > 1) return;

                    // ... or time out
                    clearInterval(intervalId);
                    reject(`Timed out: ${tokenTab.url}`);
                }

                // Halt interval
                clearInterval(intervalId);

                // Get token from URL
                const tokenUrl = new URL(tokenTab.url);
                const token = tokenUrl.searchParams.get("token2");

                // Finish up
                browser.tabs.remove(tokenTab.id);
                resolve(token);
            }, checkInterval);
        });
    },
    getDetailsFromCaption: (el) => {
        let listingUrl;
        try {
            listingUrl = el.querySelector("a").href;
        } catch {}

        let salvageName;
        try {
            const auction = el.querySelector(".short-storyup").innerText;
            isIaai = auction.toLowerCase().includes("iaai");
            isCopart = auction.toLowerCase().includes("copart");
            if (!isIaai && !isCopart) throw "";
            if (isIaai && isCopart) throw "";
            salvageName = isIaai ? "iaai" : "copart";
            // can also do qS(".short-storyup span").classList[0]
        } catch {}

        let lotNumber;
        try {
            const maybeLotNumbers = Array.from(
                el.querySelectorAll(".short-story"),
            );
            const lotPara = maybeLotNumbers.find((p) =>
                p.innerText.toLowerCase().includes("lot"),
            );
            lotNumber = /\d{8}/.exec(lotPara.innerText)[0];
        } catch {}

        return {listingUrl, salvageName, lotNumber};
    },

    /*------*\
      SCRAPE
    \*------*/
    URL_PATTERN: "*://en.bidfax.info/*",
    lotNumberFromTab: async (bidfaxTab) => {
        try {
            const code = `(${BIDFAX_API.getLotNumber.toString()})()`;
            const framesResults = await browser.tabs.executeScript(
                bidfaxTab.id,
                {code},
            );
            const frameResults = framesResults[0];
            return frameResults;
        } catch (error) {
            throw `Bidfax: ${error}`;
        }
    },
    getLotNumber: () => {
        // Primary method, look at the grid of information
        let infoGrid = "";
        try {
            infoGrid = document.getElementById("aside").innerText;
        } catch {}

        // Find lotNumber from info grid
        let lotNumber = "";
        try {
            // first try, very specific
            lotNumber = /(stock|lot) (no|number)\W+(?<lotNumber>\d*)/i.exec(
                infoGrid,
            )[3];
        } catch {
            // backup, less specific
            try {
                lotNumber = /\W(\d{8})/i.exec(infoGrid)[1];
            } catch {}
        }

        // Find salvageName from info grid
        let salvageName = "";
        try {
            // first try, very specific
            salvageName = /auction\W+(\w*)/i.exec(infoGrid)[1];
        } catch {
            // backup, less specific
            try {
                salvageName = /(iaai|copart)/i.exec(infoGrid)[0];
            } catch {}
        }

        // Backup method, look at the SEO data
        if (!lotNumber) {
            try {
                const seo = document.querySelector(
                    "meta[name=description]",
                ).content;
                lotNumber = /\W(\d{8})/i.exec(seo)[1];
            } catch {}
        }
        // Find salvageName from headline
        if (!salvageName) {
            try {
                const seo = document.querySelector(
                    "meta[name=description]",
                ).content;
                salvageName = /(iaai|copart)/i.exec(seo)[0];
            } catch {}
        }

        // Clean up results
        lotNumber = lotNumber.trim();
        salvageName = salvageName.trim().toLowerCase();

        return {lotNumber, salvageName};
    },
};

SALVAGE_APIS.bidfax = BIDFAX_API;
