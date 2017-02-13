var CloudConnectModel = Backbone.Model.extend({
	defaults: {
		cloudUuid:  "085761719",
		cloudToken: "454822"
	}
});


var CloudRegisterModel = Backbone.Model.extend({

	defaults: {
		email:     '',
		dic_popl:  '',
		id_provoz: '',
		id_pokl:   '',
		pos_uid:   ''
	}

});

var Cloud = (function () {

	var apiEndpoint = "https://devapi-standard.pos-data.eu";

	return {
		connectModel:  undefined,
		registerModel: undefined,
		init:          function () {

		},

		getSerialNumber: function () {
			return ecrStatus.get("serial");
		},

		getConnectModel: function () {
			if (_.isUndefined(this.connectModel)) {
				this.connectModel = new CloudConnectModel();
				//this.connectModel.set("cloudUuid", this.getSerialNumber());
			}
			return this.connectModel;
		},

		getRegisterModel: function () {
			if (_.isUndefined(this.registerModel)) {
				this.registerModel = new CloudRegisterModel();
			}
			return this.registerModel;
		},

		sendData: function (request, postData, ignoreAuthorization) {
			var self = this;
			var data = {
				username: self.connectModel.get('cloudUuid'),
				password: self.connectModel.get('cloudToken')
			};
			if (_.isUndefined(ignoreAuthorization)) {
				data = _.extend(data, {
					data: postData
				});
			}
			else {
				data = postData;
			}
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

		connect: function () {
			return this.sendData("", {});
		},

		register: function (registerData) {
			return this.sendData("registration", {
				data: [
					registerData
				]
			}, true);
		},

		sendZReport: function (reportData) {
			return this.sendData("post_z_report", reportData);
		},

	};

})();


var CloudView = Backbone.View.extend({

	template: _.template($("#cloud-block").html()),
	render:   function () {
		this.$el.empty();
		var connectView = new CloudConnect({
			model: Cloud.getConnectModel()
		});

		var registerModel = Cloud.getRegisterModel();


		var registerView = new CloudRegister({
			model: registerModel
		});

		var synchronizeView = new CloudSynchronizeView({
			model: new Backbone.Model()
		});

		/**
		 * Load cloud data
		 * to the current view
		 */
		var leftColumn = new LeftColumn({
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

var CloudBlock = Backbone.View.extend({
	render: function () {
		var self = this;
		this.delegateEvents();
		this.$el.empty();
		this.$el.append(this.template(
			self.model.toJSON()
		));

		return this;
	},

	initialize: function () {
		_.bindAll(this, "changed");
	},

	changed: function (evt) {
		var changed     = evt.currentTarget;
		var value       = $(evt.currentTarget).val();
		var obj         = {};
		obj[changed.id] = value;
		this.model.set(obj);
	},

	pushMessage: function (message, type) {
		var alert = new Alert({
			model: {
				type:    type,
				message: message
			}
		});
		this.$el.find(".cloud-message-block").html(alert.render().$el);
	}

});

var CloudConnect = CloudBlock.extend({

	template: _.template($("#cloud-connect").html()),
	events:   {
		"change input.form-control": "changed",
		"change select":             "changed",
		"click #btn-cloud-connect":  "onConnectClick"
	},


	onConnectClick: function (e) {
		var self = this;
		$(e.target).button("loading");
		Cloud.connect().always(function (response) {
			$(e.target).button("reset");
			self.pushMessage(response.message, response.type);
		});
	},

});

var CloudRegister = CloudBlock.extend({

	template: _.template($("#cloud-registration").html()),
	events:   {
		"change input.form-control.cloud-registration": "changed",
		"change select":                                "changed",
		"submit #form-cloud-registration":              "onRegisterClick"
	},


	onRegisterClick: function (e) {
		var self = this;
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

var CloudSynchronizeView = CloudBlock.extend({

	template: _.template($("#cloud-synchronize").html()),
	events:   {
		"click #btn-cloud-z-report": "onZReportClick"
	},
	onZReportClick: function (e) {
		var self = this;
		var button = $(e.target);
		$(button).button("loading");
		this.getZReportData().done(function (zReportData) {
			Cloud.sendZReport([zReportData]).always(function (resultData) {
				$(button).button("reset");
				if (resultData.response["R"] && resultData.response["R"] == "OK") {
					self.pushMessage(t("Sent Z-report successfully!"), "success");
				}
				else {
					self.pushMessage(t("Sent Z-report error."), "danger");
				}
			});
		}).fail(function () {
			$(button).button("reset");
			self.pushMessage(t("Something went wrong with getting of Z-report data"), "danger");
		});
	},

	getZReportData: function (number) {
		var deferred = $.Deferred();
		var url = '/cgi/ejourn';
		var data = {};
		if (!_.isUndefined(number)) {
			data.Z = number;
		}
		$.ajax({
			url: url,
			type: 'get',
			dataType: 'json',
			data: data,
			error: function () {
				return deferred.reject();
			},
			success: function(response) {
				return deferred.resolve(response);
			}
		});
		return deferred.promise();
	}


});





