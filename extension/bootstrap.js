/**
 * Nextcloud Firefox extension.
 *
 * @author Joachim Bauch <bauch@struktur.de>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

/* https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions */
/* https://developer.mozilla.org/en-US/docs/Extensions/bootstrap.js */
/* https://github.com/HenrikJoreteg/getScreenMedia/blob/master/firefox-extension-sample/bootstrap.js */

/* https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions#Reason_constants */
var APP_STARTUP = 1;
var APP_SHUTDOWN = 2;
var ADDON_ENABLE = 3;
var ADDON_DISABLE = 4;
var ADDON_INSTALL = 5;
var ADDON_UNINSTALL = 6;
var ADDON_UPGRADE = 7;
var ADDON_DOWNGRADE = 8;
var NAMESPACE = 'nextcloud-spreed';

var START_SCREENSHARING_MESSAGE = 'webrtcStartScreensharing';
var STOP_SCREENSHARING_MESSAGE = 'webrtcStopScreensharing';

/**
 * Extension api
 * @returns {object}
 */
var api = (function() {
	var SCREENSHARING_ADD_DOMAIN_EVENT = 'ExtensionAddDomain';
	var SCREENSHARING_REMOVE_DOMAIN_EVENT = 'ExtensionRemoveDomain';
	var SCREENSHARING_ALLOWED_DOMAINS_PREF = 'media.getusermedia.screensharing.allowed_domains';

	/* https://developer.mozilla.org/en-US/Add-ons/Working_with_multiprocess_Firefox#Porting_to_the_message_manager */
	/* https://github.com/mdn/e10s-example-addons/tree/master/run-script-in-all-pages/ported-message-manager/src/chrome/content */
	var globalMM = Components.classes["@mozilla.org/globalmessagemanager;1"].getService(Components.interfaces.nsIMessageListenerManager);

	var preferences = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
	var hasBootstrapped = false;

	var registeredDomains = {};

	var unique_id = Date.now();

	var extensionData = {
		id: null,
		version: null
	};
	/**
	 * @param {Object} data Object holding extension information
	 * @param {String} data.id The extension id
	 * @param {String} data.version The current extension version
	 */
	var setExtensionData = function(data) {
		if (data.id && data.version) {
			extensionData.id = data.id;
			extensionData.version = data.version;
		} else {
			throw new Error('Data object invalid and without relevant properties.');
		}
	};
	var getExtensionData = function() {
		return extensionData;
	};
	/**
	 * Append domains to the Firefox list of allowed screensharing domains
	 * @param {array} domains List of domains to append to allowed screensharing domains
	 * @param {boolean} force If a domain already exists append it anyway to current domain list
	 */
	var insertDomains = function(addDomains, force) {
		var domainsToAppend = [];
		var domains = preferences.getCharPref(SCREENSHARING_ALLOWED_DOMAINS_PREF).split(',');
		// Prevent inserting a domain that is already part of the list
		for (var i = 0; i < addDomains.length; i++) {
			if (force || domains.indexOf(addDomains[i]) < 0) {
				domainsToAppend.push(addDomains[i]);
				console.log(NAMESPACE,'Adding domain', addDomains[i]);
			} else {
				console.log(NAMESPACE,'Domain exists', addDomains[i]);
			}
		}
		if (domains.length > 0 || domainsToAppend.length > 0) {
			preferences.setCharPref(SCREENSHARING_ALLOWED_DOMAINS_PREF, domains.concat(domainsToAppend).join(','));
		} else {
			throw new Error('No screensharing domains');
		}
	};
	/**
	 * Remove domains from the Firefox list of allowed screensharing domains
	 * @param {array} domains List of domains to remove from allowed screensharing domains
	 */
	var removeDomains = function(deleteDomains) {
		var domains = preferences.getCharPref(SCREENSHARING_ALLOWED_DOMAINS_PREF).split(',');
		var modified = false;
		for (var i = 0; i < deleteDomains.length; i++) {
			var x = domains.lastIndexOf(deleteDomains[i]);
			if (x >= 0) {
				console.log(NAMESPACE,'Removed domain', deleteDomains[i], 'at index', x);
				domains.splice(x, 1);
				modified = true;
			}
		}
		if (modified) {
			preferences.setCharPref(SCREENSHARING_ALLOWED_DOMAINS_PREF, domains.join(','));
		}
	};
	var insertDynamicDomain = function(domain) {
		if (domain) {
			if (registeredDomains.hasOwnProperty(domain)) {
				registeredDomains[domain] += 1;
				return;
			}
			registeredDomains[domain] = 1;
			console.log(NAMESPACE, "Insert", domain);
			insertDomains([domain], true);
		} else {
			throw new Error('Domain argument undefined.');
		}
	};
	var removeDynamicDomain = function(domain) {
		if (domain) {
			if (!registeredDomains.hasOwnProperty(domain)) {
				return;
			}
			registeredDomains[domain] -= 1;
			if (registeredDomains[domain] > 0) {
				return;
			}
			delete registeredDomains[domain];
			console.log(NAMESPACE, "Remove", domain);
			removeDomains([domain]);
		} else {
			throw new Error('Domain argument undefined.');
		}
	};

	var addDomainListener = function(event) {
		if (!event || !event.data || !event.data.host) {
			return;
		}

		console.log(NAMESPACE, "Add domain", event.data.host);
		insertDynamicDomain(event.data.host);
	};

	var removeDomainListener = function(event) {
		if (!event || !event.data || !event.data.host) {
			return;
		}

		console.log(NAMESPACE, "Remove domain", event.data.host);
		removeDynamicDomain(event.data.host);
	};

	var syncExtensionData = function() {
		return getExtensionData();
	};

	var logMessage = function(event) {
		var args = event.data || [];
		args.splice(0, 0, NAMESPACE);
		console.log.apply(console, args);
	};

	var bootstrap = function(data) {
		if (hasBootstrapped) {
			// Ensure we are not loading scripts more than once into a tab.
			return;
		}

		console.log(NAMESPACE, "bootstrap");
		setExtensionData({id: data.id, version: data.version});
		globalMM.addMessageListener(NAMESPACE + ':ExtensionDataSync', syncExtensionData);
		globalMM.addMessageListener(NAMESPACE + ':log', logMessage);
		globalMM.addMessageListener(NAMESPACE + ':' + START_SCREENSHARING_MESSAGE, addDomainListener);
		globalMM.addMessageListener(NAMESPACE + ':' + STOP_SCREENSHARING_MESSAGE, removeDomainListener, true);
		globalMM.loadFrameScript("chrome://nextcloud-screensharing/content/framescript.js", true);
		globalMM.broadcastAsyncMessage(NAMESPACE + ':startup', {'unique_id': unique_id});
		hasBootstrapped = true;
		console.log(NAMESPACE, "bootstrap done");
	};

	var teardown = function() {
		if (!hasBootstrapped) {
			return;
		}

		console.log(NAMESPACE, "teardown");
		globalMM.broadcastAsyncMessage(NAMESPACE + ':teardown', {'unique_id': unique_id});
		globalMM.removeDelayedFrameScript('chrome://nextcloud-screensharing/content/framescript.js');
		globalMM.removeMessageListener(NAMESPACE + ':ExtensionDataSync', syncExtensionData);
		globalMM.removeMessageListener(NAMESPACE + ':log', logMessage);
		globalMM.removeMessageListener(NAMESPACE + ':' + START_SCREENSHARING_MESSAGE, addDomainListener);
		globalMM.removeMessageListener(NAMESPACE + ':' + STOP_SCREENSHARING_MESSAGE, removeDomainListener, true);
		hasBootstrapped = false;
		console.log(NAMESPACE, "teardown done");
	};

	return {
		bootstrap: bootstrap,
		teardown: teardown
	};
})();

function startup(data, reason) {
	api.bootstrap(data);
}

function shutdown(data, reason) {
	api.teardown();
}

function install(data, reason) {}

function uninstall(data, reason) {}
