/*------------------*\
  SETTINGS ACCESSORS
\*------------------*/
const searchPrimaries = async (vin, notify, settings = null) => {
    // Set up
    if (!settings) {
        settings = await defaultedSettings();
    }
    const searchPromises = [];

    // Start searches
    if (settings.searchCopart) {
        searchPromises.push(COPART_API.search(vin, notify));
    }
    if (settings.searchIaai) {
        searchPromises.push(IAAI_API.search(vin, notify));
    }
    if (settings.searchRow52) {
        searchPromises.push(ROW52_API.search(vin, notify));
    }

    // Return search results, with a guaranteed rejection in case none were
    // enabled in settings.
    return Promise.any([...searchPromises, Promise.reject()]);
};
const searchArchives = async (query, notify) => {
    // Set up
    const settings = await defaultedSettings();
    const archivePromises = [];

    // Start searches
    if (settings.searchPoctra) {
        archivePromises.push(POCTRA_API.search(query, notify));
    }
    if (settings.searchBidfax) {
        archivePromises.push(BIDFAX_API.search(query, notify));
    }
    if (settings.searchStatvin) {
        archivePromises.push(STATVIN_API.search(query, notify));
    }

    // Return search results, with a guaranteed rejection in case none were
    // enabled in settings.
    return Promise.any([...archivePromises, Promise.reject()]);
}

const openTabAndSendMessage = async ({listingUrl, lotNumber, salvageName}) => {
    // Open new tab to the listing page, keeping it in the background if
    // activating it will hide the popup (and displayed messages).
    const newTabHidesPopup = await browserIsChrome();
    const active = !newTabHidesPopup
    const resultsTab = browser.tabs.create({url: searchResults.listingUrl, active})

    // Determine button states
    const downloadable = ["iaai", "copart"].includes(salvageName);
    const complete = true;

    // Send success message
    sPort.postMessage({
        downloadable,
        complete,
        listingUrl,
        lotNumber,
        salvageName,
    });

    // If we didn't get the lot number, we need to send a follow-up message
    if (!lotNumber && downloadable) {
        // Find the correct API
        const salvage = SALVAGE_APIS[salvageName];

        // Fetch info
        const tabInfo = await salvage.lotNumberFromTab(await resultsTab);
        sPort.postMessage({...tabInfo});
    } else if (!lotNumber) {
        sendNotification(
            "This salvage yard is not supported for image downloads.",
        );
    }
};

/*---------------*\
  MESSAGE HANDLER
\*---------------*/
const search = async (message) => {
    // Create a notifier tunnel
    const notify = notifyUntilSuccess();

    // Search primaries
    try {
        let searchResults;

        // Do specific search if forced
        if (message.salvageName === "iaai") {
            console.log("Starting forced search at IAAI");
            searchResults = await searchPrimaries(message.query, notify, {
                searchIaai: true,
            });
        } else if (message.salvageName === "copart") {
            console.log("Starting forced search at Copart");
            searchResults = await searchPrimaries(message.query, notify, {
                searchCopart: true,
            });
        }

        // Do general primaries search
        else {
            searchResults = await searchPrimaries(message.query, notify);
        }
        openTabAndSendMessage(searchResults);

        // if no error was thrown, our search was successful.
        return;
    } catch (error) {
        if (!(error instanceof AggregateError)) {
            console.log(error);
            sendNotification(`An error occurred: ${error}`, "error");
        }
        if (message.salvageName) {
            console.log("Forced search came up empty");
        } else {
            console.log("primary searches empty, trying archives");
        }
    }

    // Search archives
    try {
        if (message.salvageName) throw AggregateError("");
        const searchResults = await searchArchives(message.query, notify);
        openTabAndSendMessage(searchResults);
        return;
    } catch (error) {
        // Let the user know if it's not Promise.all's error.
        if (!(error instanceof AggregateError)) {
            console.log(error);
            sendNotification(`An error occurred: ${error}`, "error");
        }
        // Let the user know searches failed without unexpected errors.
        console.log("archive searches empty");
        sPort.postMessage({
            feedback: {
                action: "feedback-message",
                message: "Search complete. No results found.",
                displayAs: "error",
            },
            complete: true,
        });
        return;
    }
};

/*----*\
  PORT
\*----*/
let sPort;
browser.runtime.onConnect.addListener(async (connectingPort) => {
    if (connectingPort.name !== "search") return;
    sPort = connectingPort;
    sPort.onMessage.addListener(search);
});

console.log("search loaded!");
