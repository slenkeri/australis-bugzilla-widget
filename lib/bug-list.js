/* ********
 * Requires
 * ********/
let Preferences = require('sdk/preferences/service');
let BugzillaApi = require('./bz.js/bz');
let Bug = require('./bug').Bug;


/**
 * Class to manage a list of bugs.
 *
 * @constructor
 */
exports.BugList = function (manager, categoryName, queryParameters, filterFunction) {
    // Document
    this.document = manager.document;

    // Bugzilla API client
    this.bz = BugzillaApi.createClient({
        url: "https://api-dev.bugzilla.mozilla.org/latest",
        timeout: 30000
    });

    // Bug Manager
    this.manager = manager;

    // Bug list info
    this.categoryName = categoryName;
    this.queryParameters = queryParameters;
    this.isInList = filterFunction;

    // Bugs
    this.bugs = [];
    this.viewedBugsPref = 'australis-bugzilla-widget.list.'+this.categoryName+'.viewedBugs';
    this.viewedBugs = Preferences.isSet(this.viewedBugsPref) ?
        Preferences.get(this.viewedBugsPref).split(',').map(function (idStr) { return parseInt(idStr); }) :
        [];

    // Expand/ collapse state
    this.isExpanded = false;

}

exports.BugList.prototype = {
    /**
     * Sets the document, points element references to it, and wires event handlers up to it.
     * 
     * @param {XULDocument} document Document in which this bug list appears.
     */
    setDocument: function (document) {
        // Document
        this.document = document;

        // Elements
        this.boxElement = this.document.getElementById(this.categoryName);
        this.categoryHeadElement = this.boxElement.getElementsByClassName('category-head')[0];
        this.countElement = this.boxElement.getElementsByClassName('category-count')[0];
        this.newCountElement = this.boxElement.getElementsByClassName('category-new-count')[0];
        this.listElement = this.boxElement.getElementsByClassName('bug-list')[0];

        // Bug documents
        for (var i = 0; i < this.bugs.length; i++) {
            this.bugs[i].setDocument(this.document);
        }

        // Event handlers
        this.categoryHeadElement.addEventListener('click', this.onClick.bind(this), false);
    },

    /**
     * Sets the email of the user whose bugs are listed.
     *
     * @param {string} userEmail Email of the user whose bugs are listed.
     */
    setUserEmail: function (userEmail) {
        // Replace username in query parameters
        var params = this.queryParameters;
        if ('value0-0-0' in params) {
            params['value0-0-0'] = userEmail; // Set email1
        }
        if ('email1' in params) {
            params['email1'] = userEmail; // Set email1
        }
        if ('value0-0-1' in params) {
            params['value0-0-1'] = userEmail; // Set email2
        }

        // Get bugs for new user
        this.update();
    },

    /**
     * Refresh the bug list's data.
     */
    update: function () {
        // Grab bugs from the API
        this.bz.searchBugs(this.queryParameters, this.onBugsReceived.bind(this));
    },

    /**
     * Sets the bugs returned from the query.
     *         this.isNewBug = false;
            description.setAttribute('class', 'bug text-link');
            this.bugList.draw();
        }

     * @param  {error} error Any errors that come down from the server.
     * @param  {array} bugs Array of Bugzilla API bug objects.
     */
    onBugsReceived: function (error, bugs) {
        if (error) {
            // Vomit
            console.log(error);
        }
        else {
            // Clear old bugs
            this.bugs.length = 0;
            var newBugs = 0;

            // Set the updated bugs
            for (var i = 0; i < bugs.length; i++) {
                var bug = bugs[i];

                if (this.isInList(bug)) {
                    // Create a Bug object and append it to the array
                    this.bugs.push(new Bug(this, bug));

                    // Set the bug's document
                    this.bugs[this.bugs.length-1].setDocument(this.document);

                    // Determine whether the bug is new
                    if (this.viewedBugs.indexOf(bug.id) === -1) {
                        this.bugs[this.bugs.length-1].isNewBug = true;
                    }
                }
            }
        }

        // Update UI
        if (this.document !== null) {
            this.draw();
        }
    },

    /**
     * Display the bugs in the UI.
     */
    draw: function () {
        // Write bug list count
        this.countElement.value = this.bugs.length;

        // Write new bug count
        var numNewBugs = this.bugs.length - this.viewedBugs.length;
        this.newCountElement.value = '('+(numNewBugs > 0 ? numNewBugs : 0)+')';

        // Clear old bug HTML
        this.clearBugElements();

        // Draw Bug items
        this.bugs.forEach(function (bug, index, bugs) {
            bug.draw();
        });

        // Preserve expand/collapse state
        //
        // When we hide the view and re-open it, onViewShowing fires BugManager.draw().
        // This nukes all XUL and re-draws, starting with bug-list.xul.
        // Lists are collapsed by default, so a list with isExpanded == true will still render collapsed.
        if (this.isExpanded) {
            this.expand();
        }
    },

    /**
     * Clears the bug elements from the list element.
     *
     * Used to remove old data when redrawing the UI.
     */
    clearBugElements: function () {
        while (this.listElement.hasChildNodes()) {
            this.listElement.removeChild(this.listElement.firstChild);
        }
    },

    /**
     * Open the category's bug list.
     */
    expand: function () {
        this.listElement.style.display = 'block';
        this.isExpanded = true;
    },

    /**
     * Close the category's bug list.
     */
    collapse: function () {
        this.listElement.style.display = 'none';
        this.isExpanded = false;
    },

    /**
     * Handle a user clicking on this list.
     *
     * @param {event} event Event object sent from DOM.
     */
    onClick: function (event) {
        // Toggle expanded state
        if (this.isExpanded) {
            this.collapse();
        }
        else {
            // Collapse other lists
            for (var i in this.manager.bugLists) {
                var list = this.manager.bugLists[i];

                if (list.isExpanded) {
                    list.collapse();
                }
            }

            // Expand this list
            this.expand();
        }

        event.preventDefault();
    },

    /**
     * Mark a given bug ID as viewed.
     *
     * Adds the bug to the viewed bugs list and writes that list to the preferences file.
     *
     * @param  {int} bugId ID of the viewed bug.
     */
    markAsViewed: function (bugId) {
        // Add to viewed array
        if (this.viewedBugs.indexOf(bugId) === -1) {
            this.viewedBugs.push(bugId);
        }

        // Write to prefs list
        Preferences.set(this.viewedBugsPref, this.viewedBugs.join(','));
    }

}
