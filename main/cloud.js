/**
 * Model with credentials for the cloud
 */
var CloudConnectModel = Backbone.Model.extend({
	defaults: {
		cloudUuid:  "",
		cloudToken: ""
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

	var protocol = 'https://';

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
		 * Check if the cloud mechanism is supported
		 */
		isSupported: false,

		/**
		 * Check if products are synchronized with Cloud
		 */
		isProductSynchronizationOn: false,

		/**
		 * Tables which are controlled from the Cloud
		 */
		managedTables: ["PLU"],

		/**
		 * Get serial number of the device
		 * @returns {*}
		 */
		getSerialNumber: function () {
			return ecrStatus.get("serial");
		},

		getApiEndPoint: function () {
			var deferred = $.Deferred();
			schema.tableFetchIgnoreCache('Cloud').done(function () {
				var data = schema.tableIgnoreCache('Cloud');
				return deferred.resolve(protocol + data.get('Address'));
			}).fail(function () {
				return deferred.reject("/");
			});
			return deferred.promise();
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
		 * Check if the Cloud functionality supported
		 */
		checkIfSupported: function () {
			var deferred = $.Deferred();
			var self     = this;
			$.ajax({
				url:      "/cgi/tbl/Cloud",
				dataType: "json",
				success:  function () {
					self.isSupported = true;
					$.ajax({
						url:      "/cgi/tbl/Net",
						dataType: "json",
						success:  function (response) {
							self.isProductSynchronizationOn = 0;
							//self.isProductSynchronizationOn = response['NetPsw'] != 0;
							return deferred.resolve();
						},
						error:    function () {
							return deferred.reject();
						}
					});
				},
				error:    function () {
					return deferred.reject();
				}
			});

			return deferred.promise();
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
			self.getApiEndPoint().always(function (apiEndpoint) {
				$.ajax({
					url:      apiEndpoint,
					type:     'post',
					dataType: 'json',
					data:     JSON.stringify(data),
					error:    function (response) {
						return deferred.reject({
							response: response,
							message:  t(response.statusText),
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
		 * Connect device to Cloud API
		 * @param connectData
		 * @returns {*}
		 */
		connectToApi: function (connectData) {
			return this.sendData("connect_device", connectData);
		},

		/**
		 * Connect device to Cloud API
		 * @param connectData
		 * @returns {*}
		 */
		disconnectFromApi: function (connectData) {
			return this.sendData("disconnect_device", connectData);
		},

		/**
		 * Get all changes what have to be applied to products
		 * @returns {*}
		 */
		syncProducts: function (tag, limit) {
			return this.sendData("get_operations", [{
				tag:   tag,
				limit: limit
			}]);
		},

		/**
		 * Get all changes what have to be applied to products
		 * @returns {*}
		 */
		syncProductsCount: function (tag) {
			return this.sendData("get_operations_count", [{
				tag: tag
			}]);
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
			self.getApiEndPoint().always(function (apiEndpoint) {
				$.ajax({
					url:         apiEndpoint,
					type:        'post',
					processData: false,
					contentType: false,
					data:        formData,
					error:       function (response) {
						return deferred.reject({
							response: response,
							message:  response.statusText,
							type:     "danger"
						});
					},
					success:     function (response) {

						return deferred.resolve({
							response: response,
							message:  t("Connected successfully!"),
							type:     "success"
						});
					}
				});
			});
			return deferred.promise();
		}

	};

})();









