/**
 * Created by Andrew on 27.06.2014.
 */

var ImpExView = Backbone.View.extend({
	events:         {
		"click .export":     "_export",
		"dragstart .export": "dragexport",
		'dragover .import':  "dragover",
		'drop .import':      "dropimport",
		'click .import':     'clickimport',
		'change .icsv':      'fileimport'
	},
	//tagName:'div',
	template:       _.template($('#impex-view').html()),
	render:         function () {
		this.delegateEvents();
		this.$el.html(this.template());
		this.$('[data-toggle="tooltip"]').tooltip({placement: 'bottom'});
		return this;
	},
	dragover:       function (ev) {
		ev.dataTransfer.dropEffect = 'copy';
		ev.preventDefault();
	},
	fileimport:     function () {
		this.Import(this.$('.icsv')[0].files);
	},
	dropimport:     function (ev) {
		ev.preventDefault();
		if (ev.dataTransfer.files && ev.dataTransfer.files.length) {
			this.Import(ev.dataTransfer.files);
		} else {
			this.Import(ev.dataTransfer.getData("Text"));
		}
	},
	Import:         function (data) {
		if (!data) return;
		ImportModel.parseFile(data);
		//var modal = new Modal();
		//modal.show(new ImportDisplay());
		//this.importLoadHnd(data, modal);
	},
	importError:    function (m) {
		events.trigger('importError', {msg: m});
	},
	importLoad:     function (data) {
		return loadTexts(data, this.importError);
	},
	importLoadHnd:  function (data, modal) {
		modal.set({header: "Import: Load Data", footer: ''});
		var $this = this;
		this.importLoad(data).then(
			function (inf) {
				$this.importParseHnd(inf, modal);
			},
			function (inf) { // error parse data
				if (!inf) {
					modal.setButtons(modal.body.fatalButtons());
					return;
				}
				modal.waitClick(modal.body.rncButtons()).done(function (btn) {
					if (btn == 'next') $this.importParseHnd(inf, modal);
					if (btn == 'retry') $this.importLoadHnd(data, modal);
				});
			}
		);
	},
	importParse:    function (inf) {
		var ret = new $.Deferred();
		if (!_.isArray(inf)) {
			this.importError("Internal error");
			ret.reject();
		} else {
			var promises = _.map(inf, function (el) {
				var data = el.data;
				var name = el.name;
				var ret  = new jQuery.Deferred();
				data     = _.map(data.split('\r\n'), function (s) {
					return s.trim();
				});
				var p    = [];
				while (data.length) {
					var idx = _.indexOf(data, "");
					var r   = [];
					if (idx > 0) {
						r = data.splice(0, idx + 1);
					} else {
						r    = data;
						data = [];
					}
					var tblname = r.shift();
					p.push(schema.CSVTable(tblname, r, name));
				}
				$.when.apply($, p).then(
					function () {
						ret.resolve(arguments);
					},
					function () {
						ret.reject(arguments);
					}
				);
				return ret.promise();
			}, this);
			$.when.apply($, promises).done(function () {
				ret.resolve(_.uniq(_.flatten(arguments)));
			}).fail(function () {
				ret.reject(_.uniq(_.compact(_.flatten(arguments))));
			});
		}
		return ret.promise();
	},
	importParseHnd: function (inf, modal) {
		modal.set({header: "Import: Parse Data", footer: ''});
		var $this = this;
		this.importParse(inf).then(
			function (names) {
				$this.importSaveHnd(names, modal);
			},
			function (names) { // error parse data
				if (!names) {
					modal.setButtons(modal.body.fatalButtons());
					return;
				}
				modal.waitClick(modal.body.ncButtons()).done(function () {
					$this.importSaveHnd(names, modal);
				});
			}
		);
	},
	importSave:     function (names) {
		var ret      = new jQuery.Deferred();
		var promises = _.map(names, function (name) {
			var r   = new jQuery.Deferred();
			var tbl = schema.table(name);
			var res;
			if (tbl instanceof Backbone.Collection) {
				res = tbl.syncSave(function (err) {
					err['tbl'] = name;
					events.trigger('importError', err);
				});
				if (!res) {
					r.resolve();
				} else {
					res.then(_.bind(r.resolve, r), _.bind(r.reject, r, name));
				}
			} else {
				if (tbl.hasChanged()) {
					this.listenTo(tbl, 'invalid', function (m, err) {
						events.trigger('importError', {msg: err, tbl: name});
					});
					var err   = false;
					this.listenTo(tbl, 'err', function (data, msg, field) {
						err = true;
						events.trigger('importError', {msg: msg, tbl: name, fld: field});
					});
					var $this = this;
					res       = tbl.save(tbl.changedAttributes(), {
						patch:   true,
						success: function (model, response, option) {
							$this.stopListening(tbl, 'err');
							if (err) {
								r.reject(name);
							} else {
								r.resolve();
							}
						},
						error:   function (model, response, option) {
							events.trigger('importError', {msg: xhrError(response), tbl: name});
							$this.stopListening(tbl, 'err');
							r.reject(name);
						}
					});
					this.stopListening(tbl, 'invalid');
					if (!res) {
						this.stopListening(tbl, 'err');
						r.reject();
					}
				} else {
					r.resolve();
				}
			}
			return r.promise();
		}, this);
		$.when.apply($, promises).done(function () {
			ret.resolve();
		}).fail(function () {
			ret.reject(_.uniq(_.compact(_.flatten(arguments))));
		});
		return ret.promise();
	},
	importSaveHnd:  function (names, modal) {
		modal.set({header: "Import: Save Data", footer: ''});
		var $this = this;
		this.importSave(names).then(
			function () {
				modal.set({header: "Import: Done"});
				modal.setButtons(modal.body.doneButtons());
			},
			function (names) { // error parse data
				modal.waitClick(modal.body.rcButtons()).done(function () {
					$this.importSaveHnd(names, modal);
				});
			}
		);
	},
	clickimport:    function () {
		this.$('.icsv').click();
	},
	csvExport:      function () {
		var models = this.model.models;
		setTimeout(function () {
			ExportModel.run(models);
		}, 0);
	},
	_export:        function () {
		this.csvExport();
	},
	dragexport:     function (ev) {
		var tmp              = $.ajaxSettings.async;
		$.ajaxSettings.async = false;
		this.csvExport().done(function (txt) {
			ev.dataTransfer.setData("Text", txt);
		});
		$.ajaxSettings.async = tmp;
	}
});

var ImportReport = Backbone.View.extend({
	tagName: 'div',
	template: _.template($("#import-report").html()),
	events: {
		"click .spoiler-trigger": "toggleSpoiler"
	},
	render: function () {
		this.delegateEvents();
		this.$el.html(this.template({
			models: this.model
		}));
		return this;
	},
	toggleSpoiler: function (e) {
		console.dir(this);
		$(this).parent().next().collapse('toggle');
	}
});

var ImportDisplay = Backbone.View.extend({
	tagName:      'ul',
	className:    'list-group',
	initialize:   function () {
		this.listenTo(events, 'importError', this.addError);
	},
	errTmpl:      _.template($('#impex-err').html(), 0, {variable: 'd'}),
	addError:     function (err) {
		noty({
			text: err,
			type: 'error'
		});

		this.$el.append(this.errTmpl(err));
	},
	fatalButtons: function () {
		return {cancel: ['Close', 'danger', 1]};
	},
	rncButtons:   function () {
		return {
			retry:  'Retry',
			next:   ['Next', 'primary'],
			cancel: ['Close', 'danger']
		};
	},
	ncButtons:    function () {
		return {
			next:   ['Next', 'primary'],
			cancel: ['Close', 'danger']
		};
	},
	rcButtons:    function () {
		return {
			retry:  'Retry',
			cancel: ['Close', 'danger']
		};
	},
	doneButtons:  function () {
		return {cancel: ['Done', 'primary', 1]};
	}
});

var ExportModel = function () {
	return {
		/**
		 * The counter of the popup window
		 */
		counter: 0,

		/**
		 * Flag which shows if the export is in progress
		 */
		isRunning: false,

		/**
		 * Modal window
		 */
		modal: false,

		/**
		 * Start the export
		 * @param models
		 * @returns {*}
		 */
		run:              function (models) {
			this.isRunning = true;
			var self       = this;
			var deferred   = new jQuery.Deferred();
			/**
			 * Write the fetching of the all models to the promises
			 * @type {Array|*}
			 */
			var promises   = _.map(models, function (model) {
				return schema.tableFetch(model.get('id'));
			});
			this.modal     = new Modal();
			var compiled   = _.template($("#progress-bar-block").html());
			this.counter++;
			this.modal.set({
				header: t("Export"),
				body:   compiled({
					id: self.getId()
				})
			});
			this.modal.show();
			/**
			 * Wait until the promises will be finished
			 */
			$.when.apply($, promises).done(function () {
				var zip = new JSZip();
				self.setProgressData(0);
				_.each(models, function (model) {
					/**
					 * If the flag is running than export all related records of the model
					 */
					if (self.isRunning) {
						self.setProgressData(0);
						var progressBlock = self.getProgressBlock();
						$(progressBlock).find("#model-name").text(model.get('name'));
						var data          = [];
						var modelData     = schema.table(model.get('id'));
						if (modelData.models) {
							var length = modelData.models.length;
							modelData.models.forEach(function (item, index) {
								/**
								 * Update the progress bar and push data
								 * @type {number}
								 */
								var percentage = Math.round(100 * index / length);
								self.setProgressData(percentage);
								data.push(item.attributes);
							});
						}
						else {
							data.push(modelData.attributes);
						}

						self.setProgressData(100);
						var csv           = Papa.unparse(data);
						zip.file(model.get('id') + ".csv", csv);
					}
				});
				if (self.isRunning) {
					zip.generateAsync({type: "blob"})
						.then(function (content) {
							// see FileSaver.js
							self.stop();
							self.saveAs(content, t("Export") + ".zip");
						});
				}
				deferred.resolve();
			}).fail(function () {
				deferred.reject();
			});
			return deferred.promise();
		},
		/**
		 * Stop export mechanism
		 */
		stop:             function () {
			ExportModel.isRunning = false;
			ExportModel.modal.hide();
		},
		/**
		 * Save the zip file
		 * @param blob
		 * @param fileName
		 */
		saveAs:           function (blob, fileName) {
			var a      = document.createElement("a");
			document.body.appendChild(a);
			a.style    = "display: none";
			var url    = window.URL.createObjectURL(blob);
			a.href     = url;
			a.download = fileName;
			a.click();
			window.URL.revokeObjectURL(url);
		},
		/**
		 * Get the ID of the export item
		 * @returns {string}
		 */
		getId:            function () {
			return "export-" + this.counter.toString();
		},
		/**
		 * Get the progress bar block
		 * @returns {*|jQuery|HTMLElement}
		 */
		getProgressBlock: function () {
			var id = ExportModel.getId();
			return $("#" + id.toString());
		},
		/**
		 * Set the progress data
		 * @param data
		 */
		setProgressData:  function (data) {
			var block      = this.getProgressBlock;
			var percentage = data + '%';
			$(block).find('.progress-bar').css({
				width: percentage
			}).text(percentage);
		}
	};
}();

var ImportModel = (function () {

	return {
		/**
		 * The counter of the popup window
		 */
		counter: 0,

		/**
		 * Modal window
		 */
		modal: false,

		/**
		 * Check if the import is running
		 */
		isRunning: false,

		/**
		 * Allowed extensions of file to upload
		 */
		allowedExtensions: ['zip'],

		/**
		 * Related view
		 */
		view: false,

		/**
		 * Error label for the import
		 */
		errorLabel: "importError",

		/**
		 * History of the import process
		 */
		history: [],

		/**
		 * Parse the input file
		 * @param fileList
		 */
		parseFile:           function (fileList) {
			if (!this.view)
				this.view = new ImportDisplay();
			var self     = this;
			this.history = [];
			self.loadFile(fileList).done(function (zipFileLoaded) {
				self.modal     = new Modal();
				var compiled   = _.template($("#progress-bar-block").html());
				self.counter++;
				self.modal.set({
					header: t("Import"),
					body:   compiled({
						id: self.getId()
					})
				});
				self.modal.show();
				self.isRunning = true;
				/**
				 * Loop through the files in zip
				 */
				_.each(zipFileLoaded.files, function (backupFile) {
					var tableName = backupFile.name.match(/^.*?([^\\/.]*)[^\\/]*$/)[1];
					/**
					 * Init schema data
					 */
					var modelData = schema.get(tableName);
					if (self.isRunning && modelData) {
						backupFile.async("string").then(function (csvText) {

							/**
							 * Parse CSV data
							 */
							self.parseCSV(csvText, backupFile.name).done(function (parsedData) {
								/**
								 * Wait until we fetch all records from the table
								 * @type {*[]}
								 */
								var promises = [
									schema.tableFetch(tableName)
								];
								$.when.apply($, promises).done(function () {
									/**
									 * Reset the progress bar and set the current import model
									 */
									self.setProgressData(0);
									var progressBlock = self.getProgressBlock();
									$(progressBlock).find("#model-name").text(tableName);
									var options       = {
										schema: modelData,
										urlAdd: schema.url + '/' + tableName
									};
									options.model     = TableModel.extend(options);
									var tableData     = schema.table(tableName);
									/**
									 * If the model data - table data
									 */
									if (modelData && modelData.attributes.tbl) {
										var idAttribute  = modelData.attributes.key ? modelData.attributes.key : 'id';
										/**
										 * Split the data to chunks
										 * @type {number}
										 */
										var n            = 2;
										var lists        = _.groupBy(parsedData, function (element, index) {
											return Math.floor(index / n);
										});
										lists            = _.toArray(lists);
										_.each(lists, function (list, index) {
											var collection = new TableCollection(false, options);
											_.each(list, function (item) {
												if (self.isRunning) {
													/**
													 * Check if the item is in the current collection
													 */
													collection.url = options.urlAdd;
													var model      = new Backbone.Model(item);
													var row        = self.findRowInCollection(model, tableData.models, idAttribute);
													model.isNew    = function () {
														return true; //(typeof row == 'undefined');
													};
													if (row && _.isObject(row) && !_.isEqual(row.attributes, model.attributes)) {
														model.hasChanged        = function () {
															return true;
														};
														model.changedAttributes = function () {
															return model.attributes;
														};
													}
													collection.push(model);
												}

											});
											/**
											 * Update progress bar with current percentage
											 * @type {number}
											 */
											var percentage = Math.round(100 * (index + 1) / lists.length);
											self.setProgressData(percentage);
											collection.syncSave(function (response) {
												if (!_.isEmpty(response.msg) && self.isRunning) {
													events.trigger(self.errorLabel, response.msg);
													modelData.result = response.msg;
													self.history.push(modelData);
													self.stop();
												}
											});
										});
										modelData.result = t("Finished");
										self.history.push(modelData);
									}
									else {
										if (modelData && modelData.attributes.key) {
											options.idAttribute = modelData.attributes.key;
										}
									}
								});
							});
						});
					}
				});
			});

			//file              = fileList[0];
			//var fileReader    = new FileReader();
			//fileReader.onload = function (fileLoadedEvent) {
			//	var zipFileLoaded = new JSZip();
			//
			//	/**
			//	 * Read the zip file
			//	 */
			//	zipFileLoaded.loadAsync(fileLoadedEvent.target.result).then(function (zip) {
			//		self.modal     = new Modal();
			//		var compiled   = _.template($("#progress-bar-block").html());
			//		self.counter++;
			//		self.modal.set({
			//			header: t("Import"),
			//			body:   compiled({
			//				id: self.getId()
			//			})
			//		});
			//		self.modal.show();
			//		self.isRunning = true;
			//		/**
			//		 * Loop through the files in zip
			//		 */
			//		_.each(zipFileLoaded.files, function (backupFile) {
			//			if (self.isRunning) {
			//				backupFile.async("string").then(function (csvText) {
			//					var parsedData = Papa.parse(csvText, {
			//						header: true
			//					});
			//					var tableName  = backupFile.name.match(/^.*?([^\\/.]*)[^\\/]*$/)[1];
			//					var promises   = [
			//						schema.tableFetch(tableName)
			//					];
			//					$.when.apply($, promises).done(function () {
			//						self.setProgressData(0);
			//						var progressBlock = self.getProgressBlock();
			//						$(progressBlock).find("#model-name").text(tableName);
			//						//console.log(progressBlock);
			//						/**
			//						 * Init schema data
			//						 */
			//						var modelData = schema.get(tableName);
			//						var options   = {
			//							schema: modelData,
			//							urlAdd: schema.url + '/' + tableName
			//						};
			//						options.model = TableModel.extend(options);
			//						var tableData = schema.table(tableName);
			//						/**
			//						 * If the model data - table data
			//						 */
			//						if (modelData && modelData.attributes.tbl) {
			//							var idAttribute = modelData.attributes.key ? modelData.attributes.key : 'id';
			//							/**
			//							 * Split the data to chunks
			//							 * @type {number}
			//							 */
			//							var n           = 2;
			//							var lists       = _.groupBy(parsedData.data, function (element, index) {
			//								return Math.floor(index / n);
			//							});
			//							lists           = _.toArray(lists);
			//							_.each(lists, function (list, index) {
			//								var collection = new TableCollection(false, options);
			//								_.each(list, function (item) {
			//									if (self.isRunning) {
			//										/**
			//										 * Check if the item is in the current collection
			//										 */
			//										collection.url = options.urlAdd;
			//										var model      = new Backbone.Model(item);
			//										var row        = self.findRowInCollection(model, tableData.models, idAttribute);
			//										model.isNew    = function () {
			//											return (typeof row == 'undefined');
			//										};
			//										if (row && _.isObject(row) && !_.isEqual(row.attributes, model.attributes)) {
			//											model.hasChanged        = function () {
			//												return true;
			//											};
			//											model.changedAttributes = function () {
			//												return model.attributes;
			//											};
			//										}
			//										collection.push(model);
			//									}
			//
			//								});
			//								var percentage = Math.round(100 * (index + 1) / lists.length);
			//								self.setProgressData(percentage);
			//								collection.syncSave(function (response) {
			//									console.dir(response);
			//								});
			//							});
			//						}
			//						else {
			//							if (modelData && modelData.attributes.key) {
			//								options.idAttribute = modelData.attributes.key;
			//							}
			//						}
			//					});
			//				});
			//			}
			//		});
			//	});
			//};
			//
			//fileReader.readAsArrayBuffer(file);
		},
		/**
		 * Load zip file and get its content
		 * @param fileList
		 * @returns {*}
		 */
		loadFile:            function (fileList) {
			var deferred   = $.Deferred();
			file           = fileList[0];
			var fileReader = new FileReader();
			var extension  = file.name.substring(file.name.lastIndexOf('.') + 1);
			if (_.indexOf(this.allowedExtensions, extension) >= 0) {
				var zipFileLoaded = new JSZip();
				fileReader.onload = function (fileLoadedEvent) {
					/**
					 * Read the zip file
					 */
					zipFileLoaded.loadAsync(fileLoadedEvent.target.result).then(function (zip) {
						return deferred.resolve(zipFileLoaded);
					});
				};
				fileReader.readAsArrayBuffer(file);
			}
			else {
				events.trigger(this.errorLabel, t("Not correct file format."));
				return deferred.reject();
			}
			return deferred.promise();
		},
		/**
		 * Parse CSV text to
		 * @param csvText
		 * @param fileName
		 * @returns {*}
		 */
		parseCSV:            function (csvText, fileName) {
			var deferred   = $.Deferred();
			var parsedData = Papa.parse(csvText, {
				header: true
			});

			if (!_.isEmpty(parsedData.errors)) {
				var errorCollection = [
					fileName + ":"
				];
				var maxErrorLength  = 3;
				/**
				 * Collect all errors (max lines - maxErrorLength) to the string
				 */
				_.each(parsedData.errors, function (item) {
					if (maxErrorLength > errorCollection.length) {
						var message = t(item.message);
						if (item.row) {
							message += " - " + t("row") + " " + item.row;
						}
						errorCollection.push(message);
					}
				});
				var errorMessage    = errorCollection.join("<br />");
				var modelData       = {
					id:     fileName,
					result: errorMessage
				};
				this.history.push(modelData);
				events.trigger(this.errorLabel, errorMessage);
				this.stop();
			}
			else {
				return deferred.resolve(parsedData.data);
			}

			return deferred.promise();
		},
		/**
		 * Get the ID of the popup
		 * @returns {string}
		 */
		getId:               function () {
			return "import-" + this.counter.toString();
		},
		/**
		 * Get the progress block
		 * @returns {*|jQuery|HTMLElement}
		 */
		getProgressBlock:    function () {
			var id = ImportModel.getId();
			return $("#" + id.toString());
		},
		/**
		 * Set the progress data
		 * @param data
		 */
		setProgressData:     function (data) {
			var block      = this.getProgressBlock();
			var percentage = data + '%';
			$(block).find('.progress-bar').css({
				width: percentage
			}).text(percentage);
		},
		/**
		 * Find the row on the collection
		 * @param row
		 * @param models
		 * @param idAttribute
		 * @returns {*|{}}
		 */
		findRowInCollection: function (row, models, idAttribute) {
			var condition          = {};
			condition[idAttribute] = row[idAttribute];
			return _.find(models, function (model) {
				return model.attributes[idAttribute] == row.attributes[idAttribute];
			});
		},
		/**
		 * Stop import mechanism
		 */
		stop:                function () {
			ImportModel.isRunning = false;

		},
		/**
		 * Build import report
		 */
		buildImportReport:   function () {
			var self        = this;
			var progressBar = this.getProgressBlock();
			console.dir(self.history);
			var importReport = new ImportReport({
				model: self.history
			});
			progressBar.find('.import-report').html(importReport.render().$el.html());
		},
	};

})();
