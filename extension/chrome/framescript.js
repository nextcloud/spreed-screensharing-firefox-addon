/**
 * Nextcloud Firefox extension.
 *
 * Script that will be loaded in all frames (i.e. tabs and windows).
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

(function(cfmm) {

	var START_SCREENSHARING_MESSAGE = 'webrtcStartScreensharing';
	var STOP_SCREENSHARING_MESSAGE = 'webrtcStopScreensharing';

	var NAMESPACE = 'nextcloud-spreed';

	var initialized = false;
	var unique_id;

	var extensionData = {
		id: null,
		version: null
	};

	var logMessage = function() {
		sendSyncMessage(NAMESPACE + ':log', Array.prototype.slice.call(arguments));
	};

	(function(data) {
		var d = data && data[0];
		if (d && d.version && d.id) {
			extensionData.id = d.id;
			extensionData.version = d.version;
		} else {
			throw new Error('Extension information not found.');
		}
	})(cfmm.sendSyncMessage(NAMESPACE + ':ExtensionDataSync'));

	var hasClass = function(element, cls) {
		return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
	};

	var isNextcloudSpreedApp = function(document) {
		if (!document) {
			return false;
		}

		var nc = document.getElementById('app');
		if (!nc || !hasClass(nc, 'nc-enable-screensharing-extension')) {
			return false;
		}

		return true;
	};

	var messageHandler = function(event) {
		var window = cfmm.content;
		if (!initialized || event.origin != window.location.origin || !event.data) {
			return;
		}

		var host = window.location.hostname;
		var data = event.data;
		switch (data.type) {
			case 'webrtcStartScreensharing':
				logMessage("start screensharing", host);
				sendSyncMessage(NAMESPACE + ':' + START_SCREENSHARING_MESSAGE, {"host": host});
				window.postMessage({'type': 'webrtcScreensharingWhitelisted', 'id': data.id}, event.origin);
				break;

			case 'webrtcStopScreensharing':
				logMessage("stop screensharing", host);
				sendSyncMessage(NAMESPACE + ':' + STOP_SCREENSHARING_MESSAGE, {"host": host});
				break;
		}
	};

	var removeHandlers = function(window, document) {
		if (!initialized) {
			return;
		}

		window.removeEventListener('message', messageHandler);
		initialized = false;
	};

	var showAvailability = function(document) {
		var nc = document.getElementById('app');
		nc.setAttribute('data-firefoxExtensionData', JSON.stringify(extensionData));
	};

	var installHandlers = function(window, document) {
		// Only add extension if the page is running the Nextcloud Spreed -app.
		if (!isNextcloudSpreedApp(document)) {
			removeHandlers(document);
			return;
		}

		removeHandlers(document);
		logMessage('Detected Nextcloud Spreed app.');
		window.addEventListener('message', messageHandler);
		showAvailability(document);
		initialized = true;
	};

	var loaded = function() {
		if (!cfmm.content) {
			return;
		}
		installHandlers(cfmm.content, cfmm.content.document);
	};

	var init = function(msg) {
		if (msg.data) {
			unique_id = msg.data.unique_id;
		}
		loaded();
		cfmm.removeMessageListener(NAMESPACE + ':startup', init);
	};

	var teardown = function(msg) {
		if (unique_id !== msg.data.unique_id) {
			return;
		}

		cfmm.removeMessageListener(NAMESPACE + ':startup', init);
		cfmm.removeMessageListener(NAMESPACE + ':teardown', teardown);
		removeHandlers(cfmm.content, cfmm.content.document);
		unique_id = null;
	};

	cfmm.addEventListener('DOMContentLoaded', loaded);
	cfmm.addEventListener('load', loaded);
	cfmm.addMessageListener(NAMESPACE + ':startup', init);
	cfmm.addMessageListener(NAMESPACE + ':teardown', teardown);

	// logMessage('Loaded framescript.js');
})(this);
