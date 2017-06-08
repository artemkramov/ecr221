/**
 * Model with credentials for the cloud
 */
var CloudConnectModel = Backbone.Model.extend({
	defaults: {
		cloudUuid:  "085761719",
		cloudToken: "454822"
	}
});


/**
 * Registration model
 */
var CloudRegisterModel = Backbone.Model.extend({

	defaults: {
		email:     '',
		dic_popl:  '',
		id_provoz: '',
		id_pokl:   '',
		pos_uid:   ''
	}

});

/**
 * API client for sending information to cloud
 * @type {{connectModel, registerModel, init, getSerialNumber, getConnectModel, getRegisterModel, sendData, connect, register, sendZReport, getLatestZReport}}
 */
var Cloud = (function () {

	/**
	 * Endpoint address of the API
	 * @type {string}
	 */
	var apiEndpoint = "https://devapi-standard.pos-data.eu";

	return {
		/**
		 * Connect model
		 */
		connectModel: undefined,

		/**
		 * Register model
		 */
		registerModel: undefined,

		/**
		 * Get serial number of the device
		 * @returns {*}
		 */
		getSerialNumber: function () {
			return ecrStatus.get("serial");
		},

		/**
		 * Get the connect model
		 * @returns {*}
		 */
		getConnectModel: function () {
			if (_.isUndefined(this.connectModel)) {
				this.connectModel = new CloudConnectModel();
				//this.connectModel.set("cloudUuid", this.getSerialNumber());
			}
			return this.connectModel;
		},

		/**
		 * Get the register model
		 * @returns {*}
		 */
		getRegisterModel: function () {
			if (_.isUndefined(this.registerModel)) {
				this.registerModel = new CloudRegisterModel();
			}
			return this.registerModel;
		},

		/**
		 * Send data to the cloud
		 * @param request
		 * @param postData
		 * @param ignoreAuthorization
		 * @returns {*}
		 */
		sendData: function (request, postData, ignoreAuthorization) {
			var self = this;
			/**
			 * Set credentials data
			 * @type {{username: *, password: *}}
			 */
			var data = {
				username: self.connectModel.get('cloudUuid'),
				password: self.connectModel.get('cloudToken')
			};
			/**
			 * Check if we ignore the authorization fields
			 */
			if (_.isUndefined(ignoreAuthorization)) {
				data = _.extend(data, {
					data: postData
				});
			}
			else {
				data = postData;
			}
			/**
			 * Set method name
			 */
			data.request = request;
			var deferred = $.Deferred();
			$.ajax({
				url:      apiEndpoint,
				type:     'post',
				dataType: 'json',
				data:     JSON.stringify(data),
				error:    function (response) {
					return deferred.reject({
						response: response,
						message:  response.statusText,
						type:     "danger"
					});
				},
				success:  function (response) {

					return deferred.resolve({
						response: response,
						message:  t("Connected successfully!"),
						type:     "success"
					});


				}
			});
			return deferred.promise();

		},

		/**
		 * Connect to the cloud
		 * @returns {*}
		 */
		connect: function () {
			return this.sendData("", {});
		},

		/**
		 * Send data for registration
		 * @param registerData
		 * @returns {*}
		 */
		register: function (registerData) {
			return this.sendData("registration", {
				data: [
					registerData
				]
			}, true);
		},

		/**
		 * Send Z-report to the cloud
		 * @param reportData
		 * @returns {*}
		 */
		sendZReport: function (reportData) {
			return this.sendData("post_z_report", reportData);
		},

		/**
		 * Get the latest Z-report number in the cloud system
		 * @returns {*}
		 */
		getLatestZReport: function () {
			return this.sendData("get_last_z_report_id", []);
		},

		/**
		 * Get the latest cash register tape item
		 * @param datetime
		 * @returns {*}
		 */
		getLatestTapeItem: function (datetime) {
			return this.sendData("get_last_receipt_item_id_after_datetime", [
				{
					datetime: datetime
				}
			]);
		},

		/**
		 * Send current tape items to the panel
		 * @param items
		 * @returns {*}
		 */
		sendTapeItems: function (items) {
			return this.sendData("post_receipt_items", items);
		},

		/**
		 * Send backup zip file
		 * @param formData
		 * @returns {*}
		 */
		sendBackupFile: function (formData) {
			var self = this;
			/**
			 * Set credentials data
			 * @type {{username: *, password: *}}
			 */
			var data = {
				username: self.connectModel.get('cloudUuid'),
				password: self.connectModel.get('cloudToken')
			};
			formData.append("username", data.username);
			formData.append("password", data.password);
			formData.append("request", "backup");

			var deferred = $.Deferred();
			$.ajax({
				url:      apiEndpoint,
				type:     'post',
				processData: false,
				contentType: false,
				data:     formData,
				error:    function (response) {
					return deferred.reject({
						response: response,
						message:  response.statusText,
						type:     "danger"
					});
				},
				success:  function (response) {

					return deferred.resolve({
						response: response,
						message:  t("Connected successfully!"),
						type:     "success"
					});


				}
			});
			return deferred.promise();
		}

	};

})();


/**
 * General view for cloud handling
 */
var CloudView = Backbone.View.extend({

	template: _.template($("#cloud-block").html()),
	render:   function () {
		this.$el.empty();

		/**
		 * Get connect view
		 */
		var connectView = new CloudConnect({
			model: Cloud.getConnectModel()
		});

		var registerModel = Cloud.getRegisterModel();

		/**
		 * Get register view
		 */
		var registerView = new CloudRegister({
			model: registerModel
		});

		/**
		 * Get synchronization view
		 */
		var synchronizeView = new CloudSynchronizeView({
			model: new Backbone.Model()
		});

		/**
		 * Load cloud data
		 * to the current view
		 */
		var leftColumn   = new LeftColumn({
			model: {
				models: []
			}
		});
		this.$el.append(this.template());
		this.$el.find("#cloud-connect").append(connectView.render().$el);
		this.$el.find("#cloud-register").append(registerView.render().$el);
		this.$el.find("#cloud-synchronize").append(synchronizeView.render().$el);
		this.$el.find("#sidebar-left").append(leftColumn.render().$el);
		this.delegateEvents();

		return this;
	}

});

/**
 * General cloud view with basic functions
 */
var CloudBlock = Backbone.View.extend({

	/**
	 * Default render function
	 * @returns {CloudBlock}
	 */
	render: function () {
		var self = this;
		this.delegateEvents();
		this.$el.empty();
		this.$el.append(this.template(
			self.model.toJSON()
		));
		return this;
	},

	/**
	 * Bind all event to changed method
	 */
	initialize: function () {
		_.bindAll(this, "changed");
	},

	/**
	 * Update the model data from the changed inputs
	 * @param evt
	 */
	changed: function (evt) {
		var changed     = evt.currentTarget;
		var value       = $(evt.currentTarget).val();
		var obj         = {};
		obj[changed.id] = value;
		this.model.set(obj);
	},

	/**
	 * Push message to the block
	 * @param message
	 * @param type
	 */
	pushMessage: function (message, type) {
		var alert = new Alert({
			model: {
				type:    type,
				message: message
			}
		});
		this.$el.find(".cloud-message-block").html(alert.render().$el);
	},

	/**
	 * Show message and reset button after requests
	 * @param button
	 * @param message
	 * @param type
	 */
	showMessage: function (button, message, type) {
		this.pushMessage(message, type);
		$(button).button("reset");
	}

});

/**
 * Connect view
 */
var CloudConnect = CloudBlock.extend({

	template:   _.template($("#cloud-connect").html()),
	events:     {
		"change input.form-control":   "changed",
		"change select":               "changed",
		"click #btn-cloud-connect":    "onConnectClick",
		"click #btn-cloud-disconnect": "onDisconnectClick"
	},
	/**
	 * Button for connecting
	 */
	btnConnect: '#btn-cloud-connect',

	/**
	 * Button for the disconnecting
	 */
	btnDisconnect: '#btn-cloud-disconnect',

	/**
	 * On connect event
	 * @param e
	 */
	onConnectClick: function (e) {
		var self = this;
		$(e.target).button("loading");
		Cloud.connect().always(function (response) {
			$(e.target).button("reset");
			var message = response.message;
			/**
			 * If connected successfully then show synchronization panel and hide connect button
			 */
			if (response.type == "success") {
				$(e.target).hide();
				$(self.btnDisconnect).show();
				self.changeSynchronizationVisibility(1);
				$("#cloud-connect").find(".form-control").attr("readonly", true);
			}
			else {
				message = t("Network error");
			}
			self.pushMessage(message, response.type);
		});
	},

	/**
	 * On disconnect event
	 * @param e
	 */
	onDisconnectClick: function (e) {
		$(e.target).hide();
		this.changeSynchronizationVisibility(0);
		$(this.btnConnect).show();
		$("#cloud-connect").find(".form-control").removeAttr("readonly");
	},

	/**
	 * Hide or show synchronization panel
	 * @param state
	 */
	changeSynchronizationVisibility: function (state) {
		var target = $("#cloud-synchronize");
		if (state) {
			$(target).show();
		}
		else {
			$(target).hide();
		}
	}

});

/**
 * Cloud register view
 */
var CloudRegister = CloudBlock.extend({

	template: _.template($("#cloud-registration").html()),
	events:   {
		"change input.form-control.cloud-registration": "changed",
		"change select":                                "changed",
		"submit #form-cloud-registration":              "onRegisterClick"
	},

	/**
	 * Event on register button click
	 * @param e
	 * @returns {boolean}
	 */
	onRegisterClick: function (e) {
		var self = this;
		/**
		 * Fetch all EET information
		 */
		$.when(schema.tableFetch("EET")).done(function () {
			var eetModel           = schema.table("EET");
			var registerData       = {};
			registerData.email     = self.model.get("cloudEmail");
			registerData.dic_popl  = eetModel.get("DIC_POPL");
			registerData.id_provoz = eetModel.get("ID_PROVOZ");
			registerData.id_pokl   = eetModel.get("ID_POKL");
			registerData.pos_uid   = Cloud.getSerialNumber();

			$(e.target).find("#btn-cloud-register").button("loading");

			Cloud.register(registerData).always(function (responseData) {
				$(e.target).find("#btn-cloud-register").button("reset");
				if (responseData.response["R"] && responseData.response["R"] == "OK") {
					self.pushMessage(t("Check your e-mail for further instructions."), "success");
				}
				else {
					self.pushMessage(t("Error while registration in the cloud. Check your EET data."), "danger");
				}

			});

		});
		return false;


	}

});

/**
 * Cloud synchronization view
 */
var CloudSynchronizeView = CloudBlock.extend({

	template: _.template($("#cloud-synchronize").html()),
	events:   {
		"click #btn-cloud-z-report":  "onZReportClick",
		"click #btn-cloud-cash-tape": "onCashTapeClick",
		"click #btn-cloud-backup":    "onBackupClick"
	},

	onCashTapeClick: function (e) {
		var self   = this;
		var button = $(e.target);
		$(button).button("loading");

		/**
		 * Set the old datetime in case if there is no Z-report present
		 * @type {number}
		 */
		var startDatetime = 1262304000;

		/**
		 * Get the datetime of the latest Z-report
		 */
		self.getZReportData().then(function (zReportLastData) {

			if (!_.isEmpty(zReportLastData)) {
				var items     = zReportLastData["ejourn"];
				startDatetime = items[items.length - 1]["datetime"];
			}
			/**
			 * Get ID of the last actual tape item
			 */
			Cloud.getLatestTapeItem(startDatetime).always(function (resultDataTapeItem) {
				if (resultDataTapeItem.response["R"] || resultDataTapeItem.response.status == 404) {
					var startTapeNumber = 0;
					if (resultDataTapeItem.response["R"] == "OK") {
						startTapeNumber = resultDataTapeItem.response["data"][0]["receipt_item_id"];
					}
					self.getCheckTapeData(startTapeNumber).then(function (tapeData) {
						if (_.isEmpty(tapeData)) {
							self.showMessage(button, t("Nothing to synchronize"), "success");
							return;
						}
						Cloud.sendTapeItems(tapeData).always(function (result) {
							if (result.response["R"]) {
								self.showMessage(button, t("Cash register tape synchronized successfully"), "success");
							}
							else {
								self.showMessage(button, t("Network error"), "danger");
							}
						});

					});

				}
				else {
					self.showMessage(button, t("Network error"), "danger");
				}
			});
			console.log("start datetime", startDatetime);


		});
	},

	/**
	 * Event on click to sync Z-reports
	 * @param e
	 */
	onZReportClick: function (e) {
		var self   = this;
		var button = $(e.target);
		$(button).button("loading");

		/**
		 * Get latest Z-report number from Cloud
		 */
		Cloud.getLatestZReport().always(function (resultDataZReport) {
			console.log("response", resultDataZReport.response);
			if (resultDataZReport.response["R"]) {
				var startReport = 0;
				var lastReport  = 1;
				/**
				 * Get the last Z-report number from cash register
				 */
				self.getZReportData().then(function (zReportLastData) {
					if (resultDataZReport.response["R"] == "OK") {
						lastReport = parseInt(resultDataZReport.response["data"][0]["Z"]);
						/**
						 * If the last report in the cloud isn't actual
						 * then find needed Z-report's numbers
						 */
						if (lastReport < zReportLastData.Z) {
							startReport = lastReport;
							lastReport  = zReportLastData.Z;
						}
						else {
							startReport = lastReport;
						}
					}
					if (resultDataZReport.response["R"] == "404") {
						if (_.isEmpty(zReportLastData)) {
							lastReport = 0;
						}
						else {
							lastReport = zReportLastData.Z;
						}
					}


					var promises = [];
					console.log('Data: ', startReport, lastReport);
					for (var i = startReport + 1; i <= lastReport; i++) {
						promises.push(self.sendZReportDataByNumber(i));
					}
					if (!_.isEmpty(promises)) {
						$.when.apply($, promises).always(function () {
							self.showMessage(button, t("Sent Z-report successfully!"), "success");
						});
					}
					else {
						self.showMessage(button, t("Nothing to synchronize"), "success");
					}

				});
			}
			else {
				self.showMessage(button, t("Network error"), "danger");
			}
		});
	},

	/**
	 * Get Z-report data from cash register by number
	 * @param number
	 * @returns {*}
	 */
	getZReportData: function (number) {
		var self     = this;
		var deferred = $.Deferred();
		var url      = '/cgi/ejourn';
		var data     = {};
		if (!_.isUndefined(number)) {
			data.Z = number;
		}
		$.ajax({
			url:      url,
			type:     'get',
			dataType: 'json',
			data:     data,
			error:    function () {
				self.showCashRegisterErrorMessage();
				return deferred.reject();
			},
			success:  function (response) {
				return deferred.resolve(response);
			}
		});
		return deferred.promise();
	},

	/**
	 * Get all check tape data after the given number
	 * @param number
	 * @returns {*}
	 */
	getCheckTapeData: function (number) {
		var self     = this;
		var deferred = $.Deferred();
		var url      = '/cgi/chk';
		var data     = {
			id: number
		};
		$.ajax({
			url:      url,
			type:     'get',
			dataType: 'json',
			data:     data,
			error:    function () {
				self.showCashRegisterErrorMessage();
				return deferred.reject();
			},
			success:  function (response) {
				return deferred.resolve(response);
			}
		});
		return deferred.promise();
	},

	/**
	 * Send Z-report to cloud by number
	 * @param number
	 * @returns {*}
	 */
	sendZReportDataByNumber: function (number) {
		var self     = this;
		var deferred = $.Deferred();
		this.getZReportData(number).always(function (zReportData) {
			Cloud.sendZReport([zReportData]).always(function (resultData) {
				return deferred.resolve();
			});
		});

		return deferred.promise();
	},

	/**
	 * Show error when cash register is unreachable
	 */
	showCashRegisterErrorMessage: function () {
		this.$el.find(".btn").button("reset");
		this.pushMessage(t("Cash register error"), "danger");
	},

	/**
	 * Make the backup archive
	 * @param e
	 */
	onBackupClick: function (e) {
		var self = this;
		var button = $(e.target);
		$(button).button("loading");
		var exportView                 = new ExportView();
		var models                     = _.filter(schema.models, function (model) {
			/**
			 * Check if the table even exportable
			 * by checking if the allowed attributes are available
			 */
			var data = _.findWhere(exportView.getBackupSchema(), {'id': model.get('id')});
			if (_.isObject(data) && _.isEmpty(data.allowedAttributes)) {
				return false;
			}
			return true;
		});
		ExportModel.isReturn           = true;
		ExportModel.specialSchemaItems = exportView.getBackupSchema();
		ExportModel.run(models).done(function (zip) {
			exportView.exportLogo().done(function (response) {
				$(button).button("reset");
				zip.file("logo.bmp", response, {binary: true});
				zip.generateAsync({type: "blob"})
					.then(function (content) {
						ExportModel.stop();
						console.log("content", content);
						/**
						 * Test send to local web-server
						 */
						var fd = new FormData();
						fd.append('backupFile', content);
						Cloud.sendBackupFile(fd).done(function () {
							self.showMessage(button, t("Backup was send successfully"), "success");
						}).fail(function () {
							self.showMessage(button, t("Network error"), "danger");
						});
						//$.ajax({
						//	type: 'POST',
						//	url: 'http://test.ak/upload/upload.php',
						//	data: fd,
						//	processData: false,
						//	contentType: false
						//}).done(function(data) {
						//	console.log('done');
						//});
						//ExportModel.saveAs(content, t("Backup") + ".zip");
					});
			}).fail(function () {
				ExportModel.stop();
				self.showCashRegisterErrorMessage();
			});

		}).fail(function () {
			ExportModel.stop();
			self.showCashRegisterErrorMessage();
		});
	}


});





