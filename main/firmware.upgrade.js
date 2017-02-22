var FirmwareView = Backbone.View.extend({
	template:              _.template($("#firmware-update-block").html()),
	viewProgressBar:       undefined,
	modal:                 undefined,
	firmwareModel:         undefined,
	percentageModel:       undefined,
	events:                {
		"click #btn-firmware-update": "onFirmwareUpdateClick"
	},
	render:                function () {
		this.delegateEvents();
		this.$el.html(this.template());
		this.firmwareModel = new FirmwareInfo();
		return this;
	},
	onFirmwareUpdateClick: function (e) {
		var self                           = this;
		this.percentageModel               = new PercentageModel();
		this.modal                         = new Modal();
		this.modal.set({
			header: t("System upgrade")
		});
		this.viewProgressBar               = new FirmwareProgress({
			model: self.percentageModel,
			modal: self.modal
		});
		self.viewProgressBar.render();
		this.modal.show();
		this.firmwareModel.percentageModel = self.percentageModel;
		this.firmwareModel.run().always(function (response) {
			console.log("arguments", arguments);
			var progressBar      = self.viewProgressBar.$el.find('.progress-bar');
			var progressBarClass = 'progress-bar-' + (!response.error ? 'success' : 'danger');
			$(progressBar).removeClass('active').addClass(progressBarClass);
			self.viewProgressBar.buildReport(self.firmwareModel.history);
		});
	}
});


var FirmwareInfo = Backbone.Model.extend({
	    percentageModel: undefined,
	    siteUrl:         'http://help-micro.kiev.ua',
	    history:         [],
	    actionsLabels:   {},


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

	    loadFirmwareScript: function () {
		    var deferred = $.Deferred();
		    if (!_.isUndefined(window.Firmware)) {
			    deferred.resolve();
		    }
		    else {
			    $.getScript("/Firmware.js").always(function () {
				    deferred.resolve();
			    });
		    }

		    return deferred.promise();
	    },

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

	    getFirmwareID: function () {
		    var deferred = $.Deferred();
		    var self     = this;
		    self.percentageModel.set("percentage", 0);
		    self.percentageModel.set("name", self.actionsLabels[arguments.callee.name]);
		    self.loadFirmwareScript().done(function () {
			    $.ajax({
				    url:      '/cgi/fw_version',
				    dataType: 'json',
				    timeout:  20000,
				    error:    function () {
					    return deferred.reject(t("Cash register error"));
				    },
				    success:  function (response) {
					    self.percentageModel.set("percentage", 100);
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
		    });

		    return deferred.promise();
	    },

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
				    if (!_.isUndefined(response["fw_info_error"]) && (response["fw_info_error"] != "0")) {
					    return deferred.reject(schema.error(response["fw_info_error"]));
				    }
				    else {
					    return deferred.resolve(data);
				    }
			    }
		    });
		    return deferred.promise();
	    },

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
				    return deferred.reject(t("Cash register error"));
			    },
			    success:     function () {
				    return deferred.resolve();
			    }
		    });

		    return deferred.promise();
	    },

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
		    }

		    return deferred.promise();
	    },

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
			    error:    function (response) {
				    return deferred.reject(t("Network error"));
			    },
			    success:  function (rawResponse) {
				    self.percentageModel.set("percentage", 100);
				    rawResponse = rawResponse.slice(1, -1);
				    var items   = $.parseJSON(rawResponse);
				    var dwlLink = self.siteUrl + '/' + items[0]["link"] + "?v=" + (new Date()).getTime().toString();
				    dwlLink = "http://help-micro.com.ua/dwl/cz/cz.test.dwl";
				    return deferred.resolve(dwlLink);
			    }
		    });

		    return deferred.promise();
	    },

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
				    return deferred.reject(t("Cash register error"));
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

	    run: function () {
		    this.history       = [];
		    this.actionsLabels = {
			    getDwlFile:              t("Download dwl file"),
			    uploadDwlFile:           t("Upload dwl file to cash register"),
			    getFirmwareID:           t("Get firmware ID"),
			    getFirmwareFileLocation: t("Get firmware file location"),
			    sendFirmwareStatus:      t("Upload firmware status"),
			    uploadFirmware:          t("Upload firmware"),
			    getFirmwareFile:         t("Download firmware file"),
			    getDwlFileLocation:      t("Get dwl file location"),
			    getDwlId:                t("Get dwl id")
		    };
		    var deferred       = $.Deferred();
		    this.handleData(deferred).done(function () {
			    return deferred.resolve({
				    error: false
			    });
		    }).fail(function () {
			    return deferred.reject({
				    error: true
			    });
		    });
		    return deferred.promise();
	    },


	    pushDataToHistory: function (id, isError, result) {
		    this.history.push({
			    id:     id,
			    error:  isError,
			    result: result
		    });
	    },

	    handleData: function (deferred, taskNumber, data) {
		    var self = this;
		    if (_.isUndefined(taskNumber)) {
			    taskNumber = 0;
		    }
		    //var actions = ["getDwlId", "getDwlFileLocation", "getDwlFile", "uploadDwlFile"];
		    var actions = ["getDwlId", "getDwlFileLocation", "getDwlFile", "uploadDwlFile", "getFirmwareID", "getFirmwareFileLocation", "getFirmwareFile", "sendFirmwareStatus", "uploadFirmware"];
		    var task    = actions[taskNumber];
		    var taskLabel = this.actionsLabels[task];
		    this[task](data).then(function (response) {
			    taskNumber++;
			    self.pushDataToHistory(taskLabel, false, t("Done"));
			    if (taskNumber < actions.length) {
				    self.handleData(deferred, taskNumber, response);
			    }
			    else {
				    return deferred.resolve({
					    error: false
				    });
			    }
		    }).fail(function (responseText) {
			    self.pushDataToHistory(taskLabel, true, responseText);
			    App.pushMessage(responseText, "error");
			    return deferred.reject({
				    error: true
			    });
		    });
		    return deferred.promise();
	    }

    })
	;

var FirmwareProgress = ImportProgress.extend({
	events:      {},
	buildReport: function (history) {
		var importReport   = new ImportReport();
		importReport.model = history;
		this.$el.find('.import-report').empty().append(importReport.render().$el);
		this.hideStopButton();
	},
});