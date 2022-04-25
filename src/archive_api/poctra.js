const POCTRA_API = {
    NAME: "poctra",
    URL_PATTERN: "*://*.poctra.com/*/id-*/*",
    URL_REGEXP: /poctra\.com/,

    /*------*\
      SEARCH
    \*------*/
    search: (vin, notify = sendNotification) => {
        return new Promise(async (resolve, reject) => {
            try {
                const searchResults = await POCTRA_API.searcher(vin);
                notify("Poctra: found a match!", "success");
                resolve(searchResults);
            } catch (error) {
                console.log(`Poctra rejecting: ${error}`);
                notify(`Poctra: ${error}.`);
                reject();
            }
        });
    },
    searcher: async (vin) => {
        // Configure VIN search
        const searchUrl = new URL("https://poctra.com/search/ajax");
        const method = "POST";
        const headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        };

        // Build request body. For some reason, these aren't passed as params.
        const params = new URLSearchParams();
        params.set("q", vin);
        params.set("by", "");
        params.set("asc", "");
        params.set("page", 1);
        const body = params.toString();

        // Fetch search results
        const response = await fetch(searchUrl, {method, headers, body});

        // Check response
        if (!response.ok) throw "something went wrong on their end...";

        // Parse response content
        const parser = new DOMParser();
        const doc = parser.parseFromString(await response.text(), "text/html");
        // set base URI so that relative links work
        const base = doc.createElement("base");
        base.href = searchUrl;
        doc.head.append(base);

        // Check result count
        const searchResults = doc.querySelectorAll(".clickable-row");
        if (searchResults.length === 0 || searchResults.length > 3) {
            throw "search returned no results.";
        }

        // Get listing details
        const resultsDetails = Array.from(searchResults).map(
            POCTRA_API.getDetailsFromClickableRow,
        );

        // Get the first complete result
        let resultDetails = resultsDetails.find(
            (detail) =>
                detail.listingUrl && detail.lotNumber && detail.salvageName,
        );

        // Send back results
        return resultDetails;
    },
    getDetailsFromClickableRow: (el) => {
        let listingUrl;
        try {
            listingUrl = el.querySelector("a").href;
        } catch {}

        let infoText;
        try {
            infoText = el.querySelector("p").innerText;
        } catch {}

        let salvageName;
        try {
            isIaai = infoText.toLowerCase().includes("iaai");
            isCopart = infoText.toLowerCase().includes("copart");
            if (!isIaai && !isCopart) throw "";
            if (isIaai && isCopart) throw "";
            salvageName = isIaai ? "iaai" : "copart";
        } catch {}

        let lotNumber;
        try {
            lotNumber = /\d{8}/.exec(infoText)[0];
        } catch {}

        return {listingUrl, salvageName, lotNumber};
    },

    /*------*\
      SCRAPE
    \*------*/
    lotNumberFromTab: async (poctraTab) => {
        try {
            const code = `(${POCTRA_API.getLotNumber.toString()})()`;
            const framesResults = await browser.tabs.executeScript(
                poctraTab.id,
                {code},
            );
            const frameResults = framesResults[0];
            return frameResults;
        } catch (error) {
            throw `Poctra: ${error}`;
        }
    },
    getLotNumber: () => {
        // A button links to the salvage site, this is the best place to find
        // our info!
        let viewButton;
        try {
            viewButton =
                document.querySelector(".btn-primary[type=button]") ||
                document.querySelector(".btn-primary[href*=copart i]") ||
                document.querySelector(".btn-primary[href*=iaai i]");
        } catch {}

        // Find lotNumber from button
        let lotNumber = "";
        try {
            lotNumber = /lot\/(\d{8})/.exec(viewButton.href)[1];
        } catch {}
        // Backup: find lotNumber from headline
        try {
            const headline = document.querySelector("h2").innerText;
            lotNumber = /\d{8}/.exec(headline)[0];
        } catch {}
        // Backup: find lotNumber in SEO data
        if (!lotNumber) {
            try {
                const seo = document.querySelector(
                    "meta[name=description]",
                ).content;
                lotNumber = /\W(\d{8})/i.exec(seo)[1];
            } catch {}
        }
        // Backup: find lotNumber in image url
        if (!lotNumber) {
            try {
                const imageSrc = document.getElementById("mainImage").src;
                lotNumber = /(\d{8}).jpg/i.exec(imageSrc)[1];
            } catch {}
        }

        // Find salvageName from button
        let salvageName = "";
        try {
            if (
                /iaai/i.exec(viewButton.href) ||
                /iaai/i.exec(viewButton.innerText)
            )
                salvageName = "iaai";
            else if (
                /copart/i.exec(viewButton.href) ||
                /copart/i.exec(viewButton.innerText) ||
                /us lot/i.exec(viewButton.innerText)
            )
                salvageName = "copart";
        } catch {}
        // Backup: find salvageName in image url
        if (!salvageName) {
            try {
                const imageSrc = document.getElementById("mainImage").src;
                salvageName = /(copart|iaai)/i.exec(imageSrc)[0];
            } catch {}
        }
        // Backup: infer salvageName from headline
        if (!salvageName) {
            try {
                const headline = document.querySelector("h2").innerText;
                if (/stock/i.exec(headline)) salvageName = "iaai";
                else if (/lot/i.exec(headline)) salvageName = "copart";
            } catch {}
        }
        // Backup: find salvageName in SEO data
        if (!salvageName) {
            try {
                const seo = document.querySelector(
                    "meta[name=description]",
                ).content;
                salvageName = /(iaai|copart)/i.exec(seo)[0];
            } catch {
                // Backup to the backup: infer salvageName
                const seo = document.querySelector(
                    "meta[name=description]",
                ).content;
                if (/stock/i.exec(seo)) salvageName = "iaai";
                else if (/lot/i.exec(seo)) salvageName = "copart";
            }
        }
        // Backup: find salvageName in modal
        if (!salvageName) {
            try {
                if (document.getElementById("iaaiModal")) salvageName = "iaai";
                else if (document.getElementById("copartModal"))
                    salvageName = "copart";
            } catch {}
        }

        // Clean up results
        lotNumber = lotNumber.trim();
        salvageName = salvageName.trim().toLowerCase();

        return {lotNumber, salvageName};
    },
};

SALVAGE_APIS.poctra = POCTRA_API;
