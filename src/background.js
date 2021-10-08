/*---------------------------------------------------------------------------*\
MESSAGES

All messages have a similar syntax, whether being sent from background scripts
to content scripts or vice versa:
    {
        type: String,
        values: Array
    }

Type is like an event name, it flags the message as being intended for a certain
recipient.

-- "popup-action": Sent by the toolbar popup when the user has interacted with
it. Values will be Objects that contain an "action" String, and possibly other
values.

-- "copart", "iaai": Sent by background scripts as well as content scripts.
Values are ususally Strings, containing URLs, blobs, or the stand-in
"storage-local", when blobs are so long that they've been tucked away in storage
for retrieval.

-- "feedback": Sent by background scripts when something has gone wrong and the
user should be notified. Values are Objects with an action key and optional
additional key/options as determined by the action:

    -- "feedback-message": Requres message key, which should be paired with a
        string to display to the user in a pop-up. Duration defaults to 5000ms,
        closeable defaults to true, displayAs defaults to "status." Two other
        options for displayAs are "success" and "error." This decides the color
        of the popup.
    -- "download-started": Starts the progress bar animation at 0%
    -- "download-tab": Requires images key, a number representing the total
        units at which the progress bar displays 100%.
    -- "tab-increment": Increments the progress bar one unit.
    -- "download-finished": Stops the progress bar animation and switches the
        button to enabled/standby display.
    -- "download-abort": Stops the progress bar animation and disables the
        button.

\*---------------------------------------------------------------------------*/

browser.runtime.onMessage.addListener( (message)=>{
    if (message.type === "popup-action") {
        for (value of message.values) {
            if (value.action === "download") {
                downloadImages()
            } else if (value.action === "search"){
                openSalvagePages(value.vin)
            };
        };
    };
})

console.log("background loaded!")
