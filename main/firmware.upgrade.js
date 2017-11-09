/**
 * Redefine translate function
 * @param text
 * @returns {*}
 */
function t(text) {
	return App.getTranslation(text);
}

/**
 * Disable ajax caching
 */
$.ajaxSetup({cache: false});

/**
 * Extend Backbone events
 * @type {{}}
 */
var events = {};
_.extend(events, Backbone.Events);

/**
 * Firmware view with controls for the automatic update
 * of the web-interface and firmware
 */
var FirmwareView = Backbone.View.extend({

	/**
	 * Progress bar view
	 */
	viewProgressBar: undefined,

	/**
	 * Modal window view
	 */
	modal: undefined,

	/**
	 * Model for the upgrade management
	 */
	firmwareModel: undefined,

	/**
	 * Model for the visualization of the upgrade process
	 */
	percentageModel: undefined,

	/**
	 * Events
	 */
	events: {
		"click #btn-firmware-update": "onFirmwareUpdateClick"
	},

	/**
	 * On firmware update click
	 */
	onFirmwareUpdateClick: function () {
		var template   = _.template($("#modal-template").html());
		var modalBlock = $("#customer-modal");
		modalBlock.empty().append(template());
		$("#customer-email").val(Api.deviceData.email);
		modalBlock.modal();
	},
	/**
	 * Run upgrade process
	 */
	upgrade:               function () {
		this.firmwareModel                     = new FirmwareInfo();
		var self                               = this;

		/**
		 * Initialize percentage models
		 * for web-interface and firmware update
		 */
		this.percentageModelWeb                = new PercentageModel();
		this.percentageModelWeb.set('name', App.getTranslation('Upgrade web-interface'));
		this.percentageModelFirmware           = new PercentageModel();
		this.percentageModelFirmware.set('name', App.getTranslation('Upgrade firmware'));

		/**
		 * Initialize modal window
		 */
		this.modal                             = new Modal();
		this.modal.set({
			header: App.getTranslation("System upgrade")
		});

		/**
		 * Initialize progress bars view
		 * and set current percentage models to view
		 */
		this.viewProgressBar                   = new UpgradeProgress({
			modal: self.modal
		});
		this.viewProgressBar.modelWebInterface = this.percentageModelWeb;
		this.viewProgressBar.modelFirmware     = this.percentageModelFirmware;
		this.viewProgressBar.initEvents();
		//this.viewProgressBar.activeModel       = 1;
		self.viewProgressBar.render();
		self.viewProgressBar.isRunning         = true;

		/**
		 * Show modal and set current percentage model
		 */
		this.modal.show();
		this.firmwareModel.percentageModel     = self.percentageModelWeb;
		this.firmwareModel.viewProgressBar     = self.viewProgressBar;

		/**
		 * Set necessary actions for web-interface upgrade
		 * @type {string[]}
		 */
		this.firmwareModel.actions             = ["getDwlId", "getDwlFileLocation", "getDwlFile", "uploadDwlFile"];
		this.firmwareModel.run().always(function (response) {
			/**
			 * If web-interface upgrade was successful
			 * than run upgrade process for firmware
			 */
			if (!response.error) {
				self.viewProgressBar.modelWebInterface.set('success', true);
				self.firmwareModel.percentageModel = self.percentageModelFirmware;
				self.firmwareModel.actions         = ["getFirmwareID", "getFirmwareFileLocation", "getFirmwareFile", "sendFirmwareStatus", "uploadFirmware", "flashFirmware"];
				self.viewProgressBar.isRunning = true;
				self.firmwareModel.run().always(function (responseFirmware) {
					/**
					 * Update progress bar status
					 */
					var progressBarFirmware      = self.viewProgressBar.$el.find('.progress-bar-firmware');
					var progressBarClassFirmware = 'progress-bar-' + (!responseFirmware.error ? 'success' : 'danger');
					$(progressBarFirmware).removeClass('active').addClass(progressBarClassFirmware);
					if (!responseFirmware.error) {
						App.pushMessage(App.getTranslation("Upgrade is complete. Follow the flash process steps to finish."), "success");
					}
					self.viewProgressBar.buildReport(self.firmwareModel.history);
				});

			}
			else {
				var progressBar      = self.viewProgressBar.$el.find('.progress-bar-web');
				var progressBarClass = 'progress-bar-danger';
				$(progressBar).removeClass('active').addClass(progressBarClass);
				self.viewProgressBar.buildReport(self.firmwareModel.history);
			}


		});
	}
});

/**
 * Init basic event that are not connected with view
 */
$(document).ready(function () {

	/**
	 * Submit form which sends user data
	 * to the server
	 */
	$(document).on("submit", "#customer-form-upgrade", function () {
		var email        = $(this).find("#customer-email").val();
		var button       = $(this).find("input[type=submit]");
		$(button).button("loading");
		Api.sendDataToServer(email).always(function () {
			$("#customer-modal").modal("hide");
			$(button).button("reset");

			/**
			 * Run upgrade process
			 */
			var firmwareView = new FirmwareView();
			firmwareView.upgrade();
		});
		return false;
	});

	/**
	 * Event on Z-report click
	 */
	$(document).on("click", "#btn-print-z-report", function () {
		var button = $(this);
		button.attr("disabled", true);
		$.ajax({
			url:     '/cgi/proc/printreport?0',
			type:    'get',
			cache:   true,
			success: function (response) {
				/**
				 * Parse response to detect the error
				 */
				$(button).removeAttr("disabled");
				if (_.isObject(response) && !_.isUndefined(response['err']) && !_.isEmpty(response['err'])) {
					App.pushMessage(App.getTranslation(response['err'], 'err'), "error");
				}
			},
			error:   function () {
				$(button).removeAttr("disabled");
				//App.pushMessage(App.getTranslation("Cash register error"), "error");
			}
		})
	});


});

/**
 * Modal.
 * Handle modal dialog stored to #modalDialog DOM element. Assumed that it Bootstarap 3 modal.
 * Can set the window title in header part as string.
 * Can set the footer as set of buttons or raw
 * Can set the dialog body as another Backbone.View object
 * Emit clickDlg event on button clicking or closing the dialog
 */
var Modal = Backbone.View.extend({
	/**
	 * Events for the modal window
	 */
	events: {
		'click .modal-footer button': 'click',
		'hidden.bs.modal':            'cancel'
	},

	/**
	 * Related DOM element
	 */
	el: '#modalDialog',

	/**
	 * Trigger hide window event
	 */
	cancel: function () {
		events.trigger('clickDlg', 'hide');
	},

	/**
	 * Trigger click events
	 * @param ev
	 */
	click: function (ev) {
		events.trigger('clickDlg', $(ev.target).data('ev'));
	},

	waitClick: function (buttons) {
		if (buttons) this.setButtons(buttons);
		var ret = new $.Deferred();
		this.listenTo(events, 'clickDlg', function (btn) {
			if ((btn == 'cancel') || (btn == 'hide')) {
				ret.reject(btn);
			} else {
				ret.resolve(btn);
			}
			//if (btn=='cancel') this.hide();
		});
		return ret.promise();
	},

	/**
	 * Show modal window
	 * @param body
	 */
	show: function (body) {
		if (body) {
			if (this.body) {
				this.body.remove();
				delete this.body;
			}
			this.body = body;
			this.set({body: body.$el});
		}
		this.$el.modal("show");
	},

	/**
	 * Hide modal window
	 */
	hide: function () {
		this.$el.modal("hide");
	},

	/**
	 * Set modal window data
	 * @param value
	 */
	set: function (value) {
		_.isString(value) && (value = {body: value});
		if (_.isObject(value)) {
			var t;
			('header' in value) && this.$('.modal-title').html(value.header);
			if ('body' in value) {
				t = this.$('.modal-body').empty();
				if (value.body) t.append(value.body);
			}
			if ('footer' in value) {
				t = this.$('.modal-footer').empty();
				if (value.footer) t.append(value.footer);
			}
		}
	},

	/**
	 * Set modal window buttons
	 * @param value
	 */
	setButtons: function (value) {
		var content = "";
		if (_.isObject(value)) {
			_.each(value, function (el, idx) {
				var btn_class   = 'default';
				var btn_text    = "OK";
				var btn_dismiss = false;
				if (_.isString(el)) {
					btn_text = el;
				} else if (_.isArray(el)) {
					(el.length > 0) && (btn_text = el[0]);
					(el.length > 1) && (btn_class = el[1]);
					(el.length > 2) && (btn_dismiss = true);
				} else if (_.isObject(el)) {
					('name' in el) && (btn_text = el['name']);
					('type' in el) && (btn_class = el['type']);
					btn_dismiss = 'dismiss' in el;
				}
				content += ['<button type="button" class="btn btn-', btn_class, '" data-ev="', idx, '"',
					btn_dismiss ? ' data-dismiss="modal"' : "", '>', btn_text, '</button>'].join('');
			});
		}
		this.set({footer: content});
	}
});

/**
 * Model for working with system upgrade
 */
var FirmwareInfo = Backbone.Model.extend({

	/**
	 * Model for progress bar work
	 */
	percentageModel: undefined,

	/**
	 * View for the progress bar
	 */
	viewProgressBar: undefined,

	/**
	 * Url for the fetching of the external data
	 */
	siteUrl: 'http://help-micro.kiev.ua',

	/**
	 * Log data of the upgrade process
	 */
	history: [],

	/**
	 * Display labels for the upgrade actions
	 */
	actionsLabels: {},

	/**
	 * Load dwl file by the link
	 * @param dwlLink
	 * @returns {*}
	 */
	getDwlFile: function (dwlLink) {
		var self                   = this;
		var deferred               = $.Deferred();
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		var request                = new XMLHttpRequest();
		request.open("GET", dwlLink, true);
		request.responseType       = "arraybuffer";
		request.send();
		request.onprogress         = function (event) {
			var percentage = 100;
			if (event.lengthComputable) {
				percentage = Math.round(100 * event.loaded / event.total);
			}
			self.percentageModel.set("percentage", percentage);
		};
		request.onreadystatechange = function () {
			if (request.readyState == 4) {
				if (request.status == 200) {
					return deferred.resolve(request.response);
				}
				else {
					return deferred.reject(t("Network error"));
				}
			}
		};
		return deferred.promise();
	},

	/**
	 * Upload dwl file to the cash register
	 * @param arrayBuffer
	 * @returns {*}
	 */
	uploadDwlFile: function (arrayBuffer) {
		var deferred = $.Deferred();
		var self     = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);

		var request                = new XMLHttpRequest();

		request.upload.addEventListener("progress", function (evt) {
			var percentage = 100;
			if (evt.lengthComputable) {
				percentage = Math.round(evt.loaded / evt.total * 100);
				self.percentageModel.set("percentage", percentage);
			}
		}, false);
		request.onreadystatechange = function () {
			if (request.readyState == 4) {
				if (request.status == 200) {
					setTimeout(function () {
						return deferred.resolve(request.response);
					}, 40000);

				}
				else {
					return deferred.reject(t("Cash register error"));
				}
			}
		};
		request.open("POST", "cgi/pdwl", true);
		request.setRequestHeader("Content-Type", "application/octet-stream");
		request.send(arrayBuffer);

		return deferred.promise();
	},

	/**
	 * Get the firmware ID of the device
	 * @returns {*}
	 */
	getFirmwareID: function () {
		var deferred = $.Deferred();
		var self     = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);

		$.ajax({
			url:      '/cgi/fw_version',
			dataType: 'json',
			timeout:  20000,
			error:    function () {
				return deferred.reject(t("Cash register error"));
			},
			success:  function (response) {
				self.percentageModel.set("percentage", 100);
				/**
				 * Exception for the old devices
				 */
				if (response['hw_guid'] == 'x22809AEBC7C140008EE38A4336B443C4') {
					$.ajax({
						url:     '/cgi/dwlid',
						error:   function () {
							return deferred.reject();
						},
						success: function (responseState) {
							deferred.resolve(responseState);
						}
					});
				}
				else {
					var responseState                  = {};
					responseState[response['hw_guid']] = 1;
					return deferred.resolve(responseState);
				}
			}
		});
		return deferred.promise();
	},

	/**
	 * Get the link to the firmware file
	 * from the web-server data
	 * @param responseState
	 * @returns {*}
	 */
	getFirmwareFileLocation: function (responseState) {
		var self       = this;
		var deferred   = $.Deferred();
		var keys       = Object.keys(responseState);
		var firmwareID = keys[0];
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		$.ajax({
			url:      self.siteUrl + '/hexget.php',
			data:     {
				id: firmwareID
			},
			dataType: 'json',
			error:    function () {
				return deferred.reject(t("Network error"));
			},
			success:  function (response) {
				self.percentageModel.set("percentage", 100);
				var firmwareLocation = self.siteUrl + response[0]["path"] + "?v=" + (new Date()).getTime();
				return deferred.resolve(firmwareLocation);
			}
		});
		return deferred.promise();
	},

	/**
	 * Send firmware status data to the cash register
	 * @param data
	 * @returns {*}
	 */
	sendFirmwareStatus: function (data) {
		var deferred   = $.Deferred();
		var self       = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		var statusData = {
			fw_guid:    data.status.guid,
			fw_version: data.status.version,
			fw_descr:   data.status.description
		};
		$.ajax({
			url:         '/cgi/fw_version',
			type:        'post',
			contentType: 'application/json; charset=utf-8',
			dataType:    'json',
			data:        JSON.stringify(statusData),
			error:       function () {
				return deferred.reject(t("Cash register error"));
			},
			success:     function (response) {
				self.percentageModel.set("percentage", 100);
				var result = Api.checkResponseForError(response);
				if (!result.success) {
					return deferred.reject(App.getTranslation(result.error, "err"));
				}
				else {
					return deferred.resolve(data);
				}
			}
		});
		return deferred.promise();
	},

	/**
	 * Upload firmware data to the cash register
	 * @param data
	 * @returns {*}
	 */
	uploadFirmware: function (data) {
		var deferred = $.Deferred();
		var self     = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		$.ajax({
			xhr:         function () {
				var xhr = new window.XMLHttpRequest();
				xhr.upload.addEventListener("progress", function (evt) {
					if (evt.lengthComputable) {
						var percentComplete = Math.round(evt.loaded * 100 / evt.total);
						self.percentageModel.set("percentage", percentComplete);
					}
				}, false);

				return xhr;
			},
			url:         '/cgi/fw_upload/',
			data:        data.binaryData.data,
			type:        'post',
			processData: false,
			contentType: 'application/octet-stream',
			error:       function () {
				return deferred.reject(App.getTranslation("Cash register error"));
			},
			success:     function (response) {
				var result = Api.checkResponseForError(response);
				if (!result.success) {
					return deferred.reject(App.getTranslation(result.error, "err"));
				}
				return deferred.resolve();
			}
		});

		return deferred.promise();
	},

	/**
	 * Flash available firmware to the cash register
	 * @returns {*}
	 */
	flashFirmware: function () {
		var deferred = $.Deferred();
		var self     = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		$.ajax({
			url:     '/cgi/fw_burn',
			type:    'post',
			error:   function () {
				return deferred.reject(App.getTranslation("Cash register error"));
			},
			success: function (response) {
				self.percentageModel.set("percentage", 100);
				var result = Api.checkResponseForError(response);
				if (!result.success) {
					return deferred.reject(App.getTranslation(result.error, "err"));
				}
				return deferred.resolve();
			}
		});
		return deferred.promise();
	},

	/**
	 * Download firmware file by the web-link
	 * @param firmwareLocation
	 * @returns {*}
	 */
	getFirmwareFile: function (firmwareLocation) {
		var deferred               = $.Deferred();
		var self                   = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		var request                = new XMLHttpRequest();
		request.open("GET", firmwareLocation, true);
		request.send();
		request.onprogress         = function (event) {
			var percentage = 100;
			if (event.lengthComputable) {
				percentage = Math.round(100 * event.loaded / event.total);
			}
			self.percentageModel.set("percentage", percentage);
		};
		request.onreadystatechange = function () {
			if (request.readyState == 4) {
				$("body").removeClass("uploading");
				if (request.status == 200) {
					var data = Firmware.parseHexFile(request.responseText, 10, true);
					if (data.isValid) {
						return deferred.resolve(data);
					}
					else {
						return deferred.reject(t("Network error"));
					}
				}
				else {
					return deferred.reject(t("Network error"));
				}
			}
		};

		return deferred.promise();
	},

	/**
	 * Get the dwl file location
	 * @param dwlID
	 * @returns {*}
	 */
	getDwlFileLocation: function (dwlID) {
		var deferred = $.Deferred();
		var self     = this;
		self.percentageModel.set("percentage", 0);
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);

		$.ajax({
			url:      self.siteUrl + '/dwlget.php',
			type:     'get',
			dataType: 'text',
			data:     {
				id: dwlID
			},
			error:    function () {
				return deferred.reject(App.getTranslation("Network error"));
			},
			success:  function (rawResponse) {
				self.percentageModel.set("percentage", 100);
				rawResponse = rawResponse.slice(1, -1);
				var items   = $.parseJSON(rawResponse);
				var dwlLink = self.siteUrl + '/' + items[0]["link"] + "?v=" + (new Date()).getTime().toString();
				return deferred.resolve(dwlLink);
			}
		});

		return deferred.promise();
	},

	/**
	 * Get the dwl ID of the cash register
	 * @returns {*}
	 */
	getDwlId: function () {
		var deferred = $.Deferred();
		var self     = this;
		self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		self.percentageModel.set("percentage", 0);
		$.ajax({
			url:      '/cgi/dwlid',
			type:     'get',
			dataType: 'json',
			error:    function () {
				return deferred.reject(App.getTranslation("Cash register error"));
			},
			success:  function (response) {
				self.percentageModel.set("percentage", 100);
				var keys  = Object.keys(response);
				var dwlID = keys[0];
				return deferred.resolve(dwlID);
			}
		});

		return deferred.promise();
	},

	/**
	 * Run the upgrade process
	 * @returns {*}
	 */
	run:             function () {
		var self = this;

		var upgradeDwlLabel      = App.getTranslation("Upgrade web-interface");
		var upgradeFirmwareLabel = App.getTranslation("Upgrade firmware");

		/**
		 * Initiate labels
		 * @type {{getDwlFile: *, uploadDwlFile: *, getFirmwareID: *, getFirmwareFileLocation: *, sendFirmwareStatus: *, uploadFirmware: *, getFirmwareFile: *, getDwlFileLocation: *, getDwlId: *}}
		 */
		this.actionsLabels = {
			getDwlFile:              upgradeDwlLabel,
			uploadDwlFile:           upgradeDwlLabel,
			getFirmwareID:           upgradeFirmwareLabel,
			getFirmwareFileLocation: upgradeFirmwareLabel,
			sendFirmwareStatus:      upgradeFirmwareLabel,
			uploadFirmware:          upgradeFirmwareLabel,
			getFirmwareFile:         upgradeFirmwareLabel,
			getDwlFileLocation:      upgradeDwlLabel,
			getDwlId:                upgradeDwlLabel,
			flashFirmware:           upgradeFirmwareLabel
		};

		this.isRunning = true;
		var deferred   = $.Deferred();
		this.handleData(deferred).done(function () {
			self.isRunning = false;
			return deferred.resolve({
				error: false
			});
		}).fail(function () {
			self.isRunning = false;
			return deferred.reject({
				error: true
			});
		});
		return deferred.promise();
	},
	/**
	 * Insert log data
	 * @param id
	 * @param isError
	 * @param result
	 */
	pushPartialData: function (id, isError, result) {
		var isAlreadyInHistory = false;
		_.each(this.history, function (item) {
			if (item.id == id) {
				item.error         = isError;
				item.result        = result;
				isAlreadyInHistory = true;
			}
		});
		if (!isAlreadyInHistory) {
			this.history.push({
				id:     id,
				error:  isError,
				result: result
			});
		}
	},

	/**
	 * Run the special task based on the given number
	 * @param deferred
	 * @param taskNumber
	 * @param data
	 * @returns {*}
	 */
	handleData: function (deferred, taskNumber, data) {
		var self = this;
		if (_.isUndefined(taskNumber)) {
			taskNumber = 0;
		}
		var actions   = this.actions;
		console.log('actions', actions);
		/**
		 * Tasks ti implement
		 * @type {string[]}
		 */
		    //var actions   = ["getDwlId", "getDwlFileLocation", "getDwlFile", "uploadDwlFile", "getFirmwareID", "getFirmwareFileLocation", "getFirmwareFile", "sendFirmwareStatus", "uploadFirmware", "flashFirmware"];
		var task      = actions[taskNumber];
		var taskLabel = this.actionsLabels[task];
		this[task](data).then(function (response) {
			taskNumber++;
			self.pushPartialData(taskLabel, false, App.getTranslation("Done"));
			if (taskNumber < actions.length && self.viewProgressBar.isRunning) {
				self.handleData(deferred, taskNumber, response);
			}
			else {
				self.viewProgressBar.isRunning = false;
				return deferred.resolve({
					error: false
				});
			}
		}).fail(function (responseText) {
			self.pushPartialData(taskLabel, true, App.getTranslation("Error"));
			App.pushMessage(responseText, "error");
			return deferred.reject({
				error: true
			});
		});
		return deferred.promise();
	}

});

/**
 * Model for the percentage display
 */
var PercentageModel = Backbone.Model.extend({
	defaults: {
		id:         "s",
		name:       "",
		percentage: 0,
		success: false
	}
});

/**
 * Upgrade report view
 */
var UpgradeReport = Backbone.View.extend({
	template:      _.template($("#import-report").html()),
	events:        {
		"click .spoiler-trigger": "toggleSpoiler"
	},
	render:        function () {
		this.$el.html(this.template({
			models: this.model
		}));
		this.delegateEvents();
		return this;
	},
	toggleSpoiler: function (e) {
		$(e.target).parent().next().collapse('toggle');
	}
});

/**
 * Progress bar view for the displaying of the current task`s progress
 */
var UpgradeProgress = Backbone.View.extend({
	/**
	 * Template of the view
	 */
	template: _.template($("#progress-bar-block").html()),

	/**
	 * Modal view
	 */
	modal: {},

	/**
	 * Check if the upgrade process is running
	 */
	isRunning: false,

	/**
	 * Events of the view
	 */
	events: {
		"click .btn-import-stop": "onButtonStopClick"
	},

	modelWebInterface: undefined,

	modelFirmware: undefined,

	activeModel: 1,

	/**
	 * Initialize all listeners
	 * @param options
	 */
	initialize: function (options) {
		this.listenTo(events, 'clickDlg', this.stop);
		this.modal = options.modal;
	},

	initEvents: function () {
		this.listenTo(this.modelWebInterface, 'change', this.render);
		this.listenTo(this.modelFirmware, 'change', this.render);
	},

	/**
	 * Finish method
	 */
	finish: function () {
		this.stop(true, true);
	},

	getActiveModel: function () {
		return this.activeModel == 1 ? this.modelWebInterface : this.modelFirmware;
	},

	/**
	 * Hide stop button
	 */
	hideStopButton: function () {
		this.$el.find('.btn-import-stop').hide();
	},

	/**
	 * Build report based on the upgrade history
	 * @param history
	 */
	buildReport: function (history) {
		var upgradeReport   = new UpgradeReport();
		upgradeReport.model = history;
		this.$el.find('.import-report').empty().append(upgradeReport.render().$el);
		this.hideStopButton();
	},
	/**
	 * Render view
	 * @returns {UpgradeProgress}
	 */
	render:      function () {
		this.$el.html(this.template({
			modelWebInterface: this.modelWebInterface,
			modelFirmware:     this.modelFirmware
		}));
		this.modal.set({
			body: this.$el
		});
		this.$el.find(".btn-import-stop").hide();
		this.delegateEvents();
		return this;
	},

	/**
	 * On button Stop click event
	 */
	onButtonStopClick: function () {
		this.isRunning = false;
		this.buildReport();
	},
	/**
	 * Stop upgrade process
	 */
	stop:              function () {
		this.isRunning = false;
	}

});